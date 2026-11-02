
const pool = require("../config/database");
const { calculateUsageLines } = require("../services/billingCalculator");
const {
  calculateProratedBaseFees
} = require("../services/prorationCalculator");
const { getCurrentTime } = require("../utils/clock");

// Close a billing period and generate its invoice
const closeBillingPeriod = async (req, res) => {
  let connection;
  let billingPeriodId;

  try {
    const { customerId, periodStart, periodEnd } = req.body;

    if (!customerId || !Number.isSafeInteger(Number(customerId)) ||
        Number(customerId) < 1) {
      return res.status(400).json({
        message: "Valid customer ID is required"
      });
    }

    if (!periodStart || !periodEnd ||
        Number.isNaN(Date.parse(periodStart)) ||
        Number.isNaN(Date.parse(periodEnd))) {
      return res.status(400).json({
        message: "Valid period start and end dates are required"
      });
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    if (start >= end) {
      return res.status(400).json({
        message: "Period end must be after period start"
      });
    }

    // Wait until the 48-hour late-event window has passed
    const fortyEightHours = 48 * 60 * 60 * 1000;

    if (getCurrentTime().getTime() < end.getTime() + fortyEightHours) {
      return res.status(400).json({
        message: "Billing period cannot close until 48 hours after its end"
      });
    }

    const toMySQLDate = (date) =>
      date.toISOString().slice(0, 23).replace("T", " ");

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Check whether the customer exists
    const [customers] = await connection.query(
      "SELECT id FROM customers WHERE id = ?",
      [Number(customerId)]
    );

    if (customers.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    // Find the customer's subscription and plan
    const [subscriptions] = await connection.query(
      `SELECT s.id AS subscription_id, s.plan_id,
              p.name AS plan_name, p.monthly_base_fee_kobo
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.customer_id = ?
       ORDER BY s.id DESC
       LIMIT 1
       FOR UPDATE`,
      [Number(customerId)]
    );

    if (subscriptions.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: "Customer has no subscription"
      });
    }

    const subscription = subscriptions[0];

    // Create the billing period, or reuse it if already present
    await connection.query(
      `INSERT INTO billing_periods
       (customer_id, period_start, period_end, status)
       VALUES (?, ?, ?, 'open')
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [
        Number(customerId),
        toMySQLDate(start),
        toMySQLDate(end)
      ]
    );

    const periodId = (
      await connection.query(
        `SELECT id, status FROM billing_periods
         WHERE customer_id = ?
           AND period_start = ?
           AND period_end = ?
         FOR UPDATE`,
        [
          Number(customerId),
          toMySQLDate(start),
          toMySQLDate(end)
        ]
      )
    )[0][0];
    billingPeriodId = periodId.id;

    if (periodId.status === "closed") {
      const [existingInvoices] = await connection.query(
        "SELECT id, subtotal_kobo, status FROM invoices WHERE billing_period_id = ?",
        [periodId.id]
      );

      await connection.commit();

      return res.status(200).json({
        message: "Billing period was already closed",
        invoice: existingInvoices[0] || null
      });
    }

   
    // Prepare invoice lines
    let invoiceLines = [];
   
    // Get all plan changes that happened before this billing period ended
    const [planChanges] = await connection.query(
      `SELECT
          spc.old_plan_id,
          spc.new_plan_id,
          DATE_FORMAT(
            spc.effective_at,
            '%Y-%m-%dT%H:%i:%s.%fZ'
          ) AS effective_at
       FROM subscription_plan_changes spc
       WHERE spc.subscription_id = ?
       ORDER BY spc.effective_at ASC`,
      [
        subscription.subscription_id,
      ]
    );

    // Find the plan active at the beginning of this billing period
    let startingPlanId = Number(subscription.plan_id);

    if (planChanges.length > 0) {
      const changesBeforeOrAtStart = planChanges.filter(
        change => new Date(change.effective_at) <= start
      );

      if (changesBeforeOrAtStart.length > 0) {
        startingPlanId = Number(
          changesBeforeOrAtStart[
            changesBeforeOrAtStart.length - 1
          ].new_plan_id
        );
      } else {
        // No change before the period started.
        // Use the old plan from the first recorded change.
        startingPlanId = Number(planChanges[0].old_plan_id);
      }
    }

    // Keep only plan changes inside this billing period
    const changesDuringPeriod = planChanges.filter(change => {
      const changeDate = new Date(change.effective_at);
      return changeDate > start && changeDate < end;
    });

    // Build the periods during which each plan was active
    const planSegments = [];

    let currentPlanId = startingPlanId;
    let segmentStart = start;

    for (const change of changesDuringPeriod) {
      const changeDate = new Date(change.effective_at);

      planSegments.push({
        planId: currentPlanId,
        periodStart: segmentStart,
        periodEnd: changeDate
      });

      currentPlanId = Number(change.new_plan_id);
      segmentStart = changeDate;
    }

    // Add the final plan period
    planSegments.push({
      planId: currentPlanId,
      periodStart: segmentStart,
      periodEnd: end
    });

    // The plan active at the end of the period prices usage
    const usagePlanId = currentPlanId;


    // Calculate the prorated base fee for every plan period
    for (const segment of planSegments) {
      const [plans] = await connection.query(
        `SELECT name, monthly_base_fee_kobo
         FROM plans
         WHERE id = ?`,
        [segment.planId]
      );

      if (plans.length === 0) {
        throw new Error("Plan not found during billing calculation");
      }

      const plan = plans[0];

      const proratedLines = calculateProratedBaseFees([
        {
          planName: plan.name,
          monthlyFeeKobo: Number(plan.monthly_base_fee_kobo),
          periodStart: segment.periodStart,
          periodEnd: segment.periodEnd,
          billingStart: start,
          billingEnd: end
        }
      ]);

      invoiceLines.push(...proratedLines);
    }


    // Get the usage total for each meter during this period
    const [usageTotals] = await connection.query(
      `SELECT meter_name, SUM(quantity) AS total_quantity
       FROM usage_events
       WHERE customer_id = ?
         AND event_time >= ?
         AND event_time < ?
       GROUP BY meter_name`,
      [
        Number(customerId),
        toMySQLDate(start),
        toMySQLDate(end)
      ]
    );

    // Calculate each meter using its plan's graduated tiers
    for (const usage of usageTotals) {
      const [tiers] = await connection.query(
        `SELECT meter_name, from_quantity, to_quantity,
                price_per_unit_kobo
         FROM price_tiers
         WHERE plan_id = ? AND meter_name = ?
         ORDER BY from_quantity`,
        [usagePlanId, usage.meter_name]
      );

      if (tiers.length === 0) {
        throw new Error(
          `No pricing tiers found for meter: ${usage.meter_name}`
        );
      }

      const totalQuantity = Number(usage.total_quantity);

      if (!Number.isSafeInteger(totalQuantity)) {
        throw new Error("Usage quantity exceeds safe integer range");
      }

      const usageLines = calculateUsageLines(tiers, totalQuantity);

      for (const line of usageLines) {
        invoiceLines.push({
          ...line,
          description: `${usage.meter_name}: ${line.description}`
        });
      }
    }

    // Calculate invoice total using integer kobo
    const subtotalKobo = invoiceLines.reduce(
      (total, line) => total + line.amountKobo,
      0
    );

    if (!Number.isSafeInteger(subtotalKobo)) {
      throw new Error("Invoice total exceeds safe integer range");
    }

    // Create one invoice for this customer and billing period
    const [invoiceResult] = await connection.query(
      `INSERT INTO invoices
       (customer_id, billing_period_id, subtotal_kobo, status)
       VALUES (?, ?, ?, 'pending')`,
      [Number(customerId), periodId.id, subtotalKobo]
    );

    const invoiceId = invoiceResult.insertId;

    // Save the invoice line items
    for (const line of invoiceLines) {
      await connection.query(
        `INSERT INTO invoice_lines
         (invoice_id, description, line_type, quantity,
          unit_price_kobo, amount_kobo)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          line.description,
          line.lineType,
          line.quantity,
          line.unitPriceKobo,
          line.amountKobo
        ]
      );
    }

    // Mark the billing period as closed
    await connection.query(
      `UPDATE billing_periods
       SET status = 'closed', closed_at = UTC_TIMESTAMP(3)
       WHERE id = ?`,
      [periodId.id]
    );

    await connection.commit();

    return res.status(201).json({
      message: "Invoice generated successfully",
      invoice: {
        id: invoiceId,
        customerId: Number(customerId),
        billingPeriodId: periodId.id,
        subtotalKobo,
        status: "pending",
        lines: invoiceLines
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

   
    if (error.code === "ER_DUP_ENTRY" && billingPeriodId) {
      const [existingInvoices] = await pool.query(
        `SELECT id, customer_id, billing_period_id,
                subtotal_kobo, status
         FROM invoices
         WHERE customer_id = ?
           AND billing_period_id = ?`,
       [Number(req.body.customerId), billingPeriodId]
      );

      if (existingInvoices.length > 0) {
        return res.status(200).json({
          message: "Invoice already exists for this billing period",
          invoice: existingInvoices[0]
        });
      }
    }

    console.error("Close billing period error:", error.message);

    return res.status(500).json({
      message: "Unable to generate invoice"
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = { closeBillingPeriod };
