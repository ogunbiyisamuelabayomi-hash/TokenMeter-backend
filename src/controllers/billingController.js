
const pool = require("../config/database");
const { calculateUsageLines } = require("../services/billingCalculator");

// Close a billing period and generate its invoice
const closeBillingPeriod = async (req, res) => {
  let connection;

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

    if (Date.now() < end.getTime() + fortyEightHours) {
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

    // Add the monthly base fee as an invoice line
    const baseFeeKobo = Number(subscription.monthly_base_fee_kobo);

    if (!Number.isSafeInteger(baseFeeKobo)) {
      throw new Error("Base fee exceeds safe integer range");
    }

    const invoiceLines = [{
      description: `Monthly base fee - ${subscription.plan_name}`,
      lineType: "base_fee",
      quantity: 1,
      unitPriceKobo: baseFeeKobo,
      amountKobo: baseFeeKobo
    }];

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
        [subscription.plan_id, usage.meter_name]
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

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "An invoice already exists for this billing period"
      });
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
