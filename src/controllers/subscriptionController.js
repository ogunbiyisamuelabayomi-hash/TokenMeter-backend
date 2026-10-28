
const pool = require("../config/database");

// Create a subscription
const createSubscription = async (req, res) => {
  try {
    const { customerId, planId, trialEndsAt } = req.body;

    // Check if customer ID was provided
    if (!customerId) {
      return res.status(400).json({
        message: "Customer ID is required"
      });
    }

    // Check if plan ID was provided
    if (!planId) {
      return res.status(400).json({
        message: "Plan ID is required"
      });
    }

    // Check if customer exists
    const [customers] = await pool.query(
      "SELECT id FROM customers WHERE id = ?",
      [customerId]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    // Check if plan exists
    const [plans] = await pool.query(
      "SELECT id FROM plans WHERE id = ?",
      [planId]
    );

    if (plans.length === 0) {
      return res.status(404).json({
        message: "Plan not found"
      });
    }

    // Check if the trial end date is valid
    if (
      trialEndsAt !== undefined &&
      trialEndsAt !== null &&
      Number.isNaN(Date.parse(trialEndsAt))
    ) {
      return res.status(400).json({
        message: "Trial end date is invalid"
      });
    }

    // Create the subscription
    const [result] = await pool.query(
      `INSERT INTO subscriptions
       (customer_id, plan_id, status, trial_ends_at, started_at)
       VALUES (?, ?, 'trialing', ?, UTC_TIMESTAMP(3))`,
      [customerId, planId, trialEndsAt || null]
    );

    return res.status(201).json({
      message: "Subscription created successfully",
      subscription: {
        id: result.insertId,
        customerId,
        planId,
        status: "trialing",
        trialEndsAt: trialEndsAt || null
      }
    });
  } catch (error) {
    console.error("Create subscription error:", error.message);

    return res.status(500).json({
      message: "Unable to create subscription"
    });
  }
};

// Get all subscriptions
const getSubscriptions = async (req, res) => {
  try {
    const [subscriptions] = await pool.query(
      `SELECT
         s.id,
         s.customer_id,
         c.name AS customer_name,
         s.plan_id,
         p.name AS plan_name,
         s.status,
         s.trial_ends_at,
         s.started_at
       FROM subscriptions s
       JOIN customers c ON s.customer_id = c.id
       JOIN plans p ON s.plan_id = p.id
       ORDER BY s.id DESC`
    );

    return res.status(200).json({
      message: "Subscriptions retrieved successfully",
      subscriptions
    });
  } catch (error) {
    console.error("Get subscriptions error:", error.message);

    return res.status(500).json({
      message: "Unable to retrieve subscriptions"
    });
  }
};

// Change subscription status using allowed transitions
const transitionSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { event } = req.body;

    if (!id || !Number.isInteger(Number(id)) || Number(id) < 1) {
      return res.status(400).json({
        message: "Valid subscription ID is required"
      });
    }

    if (!event) {
      return res.status(400).json({
        message: "Event is required"
      });
    }

    // Check if the subscription exists
    const [subscriptions] = await pool.query(
      "SELECT id, status FROM subscriptions WHERE id = ?",
      [id]
    );

    if (subscriptions.length === 0) {
      return res.status(404).json({
        message: "Subscription not found"
      });
    }

    const subscription = subscriptions[0];
    const currentStatus = subscription.status;

    // Define the allowed status transitions
    const allowedTransitions = {
      trialing: {
        payment_succeeded: "active"
      },
      active: {
        payment_failed: "past_due"
      },
      past_due: {
        payment_succeeded: "active",
        third_retry_failed: "suspended"
      },
      suspended: {
        invoice_paid: "active"
      }
    };

    const newStatus =
      allowedTransitions[currentStatus]?.[event];

    if (!newStatus) {
      return res.status(400).json({
        message: `Event '${event}' is not allowed for subscription status '${currentStatus}'`
      });
    }

    // Update only if the status has not changed since it was checked
    const [result] = await pool.query(
      `UPDATE subscriptions
       SET status = ?
       WHERE id = ? AND status = ?`,
      [newStatus, id, currentStatus]
    );

    if (result.affectedRows === 0) {
      return res.status(409).json({
        message: "Subscription status changed. Please try again."
      });
    }

    return res.status(200).json({
      message: "Subscription status updated successfully",
      subscription: {
        id: Number(id),
        previousStatus: currentStatus,
        currentStatus: newStatus
      }
    });
  } catch (error) {
    console.error("Transition subscription error:", error.message);

    return res.status(500).json({
      message: "Unable to update subscription status"
    });
  }
};

module.exports = {
  createSubscription,
  getSubscriptions,
  transitionSubscription
};
