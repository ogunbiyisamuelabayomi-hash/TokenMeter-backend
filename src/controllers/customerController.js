
const pool = require("../config/database");

// Create a new customer
const createCustomer = async (req, res) => {
  try {
    const { name, email } = req.body;

    // Check if name was provided
    if (!name) {
      return res.status(400).json({
        message: "Name is required"
      });
    }

    // Check if email was provided
    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    // Check if the customer already exists
    const [existingCustomer] = await pool.query(
      "SELECT id FROM customers WHERE email = ?",
      [email]
    );

    if (existingCustomer.length > 0) {
      return res.status(409).json({
        message: "Customer already exists"
      });
    }

    // Create the customer
    const [result] = await pool.query(
      "INSERT INTO customers (name, email) VALUES (?, ?)",
      [name, email]
    );

    return res.status(201).json({
      message: "Customer created successfully",
      customer: {
        id: result.insertId,
        name,
        email
      }
    });
  } catch (error) {
    console.error("Create customer error:", error.message);

    return res.status(500).json({
      message: "Unable to create customer"
    });
  }
};

// Get all customers
const getCustomers = async (req, res) => {
  try {
    const [customers] = await pool.query(
      "SELECT id, name, email, monthly_spending_cap_kobo, created_at FROM customers ORDER BY id DESC"
    );

    return res.status(200).json({
      message: "Customers retrieved successfully",
      customers
    });
  } catch (error) {
    console.error("Get customers error:", error.message);

    return res.status(500).json({
      message: "Unable to retrieve customers"
    });
  }
};


const setSpendingCap = async (req, res) => {
  try {
    const { id } = req.params;
    const { monthlySpendingCapKobo } = req.body;

    if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) {
      return res.status(400).json({
        message: "Valid customer ID is required"
      });
    }

    if (
      !Number.isSafeInteger(monthlySpendingCapKobo) ||
      monthlySpendingCapKobo < 0
    ) {
      return res.status(400).json({
        message: "Spending cap must be a non-negative integer in kobo"
      });
    }

    const [customers] = await pool.query(
      "SELECT id FROM customers WHERE id = ?",
      [Number(id)]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    await pool.query(
      "UPDATE customers SET monthly_spending_cap_kobo = ? WHERE id = ?",
      [monthlySpendingCapKobo, Number(id)]
    );

    return res.status(200).json({
      message: "Monthly spending cap updated successfully",
      customerId: Number(id),
      monthlySpendingCapKobo
    });
  } catch (error) {
    console.error("Set spending cap error:", error.message);

    return res.status(500).json({
      message: "Unable to update spending cap"
    });
  }
};


const { calculateUsageLines } = require("../services/billingCalculator");

// Check whether a customer can make another AI request
const checkSpending = async (req, res) => {
  try {
    const { id } = req.params;
    const { estimatedCostKobo } = req.body;

    if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) {
      return res.status(400).json({
        message: "Valid customer ID is required"
      });
    }

    if (
      !Number.isSafeInteger(estimatedCostKobo) ||
      estimatedCostKobo < 0
    ) {
      return res.status(400).json({
        message: "Estimated cost must be a non-negative integer in kobo"
      });
    }

    // Find the customer and their spending cap
    const [customers] = await pool.query(
      `SELECT id, monthly_spending_cap_kobo
       FROM customers
       WHERE id = ?`,
      [Number(id)]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    const cap = customers[0].monthly_spending_cap_kobo;

    // No spending cap means there is no cap-based restriction
    if (cap === null) {
      return res.status(200).json({
        allowed: true,
        message: "No monthly spending cap is set"
      });
    }

    // Find the customer's subscription and plan
    const [subscriptions] = await pool.query(
      `SELECT s.plan_id, p.monthly_base_fee_kobo
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.customer_id = ?
       ORDER BY s.id DESC
       LIMIT 1`,
      [Number(id)]
    );

    if (subscriptions.length === 0) {
      return res.status(404).json({
        message: "Customer has no subscription"
      });
    }

    const subscription = subscriptions[0];

    // Get the current UTC calendar month
    const now = new Date();
    const monthStart = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1
    ));
    const nextMonth = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      1
    ));

    const toMySQLDate = (date) =>
      date.toISOString().slice(0, 23).replace("T", " ");

    // Count this month's usage for each meter
    const [usageTotals] = await pool.query(
      `SELECT meter_name, SUM(quantity) AS total_quantity
       FROM usage_events
       WHERE customer_id = ?
         AND event_time >= ?
         AND event_time < ?
       GROUP BY meter_name`,
      [
        Number(id),
        toMySQLDate(monthStart),
        toMySQLDate(nextMonth)
      ]
    );

    // Start with the monthly base fee
    let currentSpend = Number(subscription.monthly_base_fee_kobo);

    if (!Number.isSafeInteger(currentSpend)) {
      throw new Error("Base fee exceeds safe integer range");
    }

    // Add the current month's usage charges
    for (const usage of usageTotals) {
      const [tiers] = await pool.query(
        `SELECT from_quantity, to_quantity, price_per_unit_kobo
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

      const lines = calculateUsageLines(
        tiers,
        Number(usage.total_quantity)
      );

      for (const line of lines) {
        currentSpend += line.amountKobo;
      }
    }

    if (!Number.isSafeInteger(currentSpend)) {
      throw new Error("Current spend exceeds safe integer range");
    }

    const projectedSpend = currentSpend + estimatedCostKobo;

    if (!Number.isSafeInteger(projectedSpend)) {
      return res.status(400).json({
        message: "Projected spending exceeds safe integer range"
      });
    }

    // Stop the request if it would reach or exceed the cap
    if (projectedSpend >= Number(cap)) {
      return res.status(403).json({
        allowed: false,
        message: "Monthly spending cap reached. Request blocked.",
        currentSpendKobo: currentSpend,
        estimatedCostKobo,
        spendingCapKobo: Number(cap)
      });
    }

    // Warn when projected spending reaches 80% of the cap
    if (projectedSpend >= Number(cap) * 0.8) {
      return res.status(200).json({
        allowed: true,
        warning: "You have reached 80% of your monthly spending cap",
        currentSpendKobo: currentSpend,
        projectedSpendKobo: projectedSpend,
        spendingCapKobo: Number(cap)
      });
    }

    return res.status(200).json({
      allowed: true,
      message: "Request is within the monthly spending cap",
      currentSpendKobo: currentSpend,
      projectedSpendKobo: projectedSpend,
      spendingCapKobo: Number(cap)
    });
  } catch (error) {
    console.error("Check spending error:", error.message);

    return res.status(500).json({
      message: "Unable to check spending"
    });
  }
};


module.exports = {
  createCustomer,
  getCustomers,
  setSpendingCap,
  checkSpending
};
