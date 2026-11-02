const pool = require("../config/database");
const { getCurrentTime } = require("../utils/clock");

// Record a failed payment and schedule the next retry
async function schedulePaymentRetry(paymentAttemptId) {
  let connection;

  try {
    connection = await pool.getConnection();

    await connection.beginTransaction();

    // Find and lock the payment attempt
    const [attempts] = await connection.query(
      `SELECT id, invoice_id, attempt_number, status
       FROM payment_attempts
       WHERE id = ?
       FOR UPDATE`,
      [paymentAttemptId]
    );

    if (attempts.length === 0) {
      throw new Error("Payment attempt not found");
    }

    const attempt = attempts[0];

    if (attempt.status === "successful") {
      throw new Error("Successful payments cannot be retried");
    }

    if (attempt.status === "failed") {
      throw new Error("This payment attempt has already failed");
    }

    // Find the customer who owns the invoice
    const [invoices] = await connection.query(
      `SELECT customer_id
       FROM invoices
       WHERE id = ?`,
      [attempt.invoice_id]
    );

    if (invoices.length === 0) {
      throw new Error("Invoice not found");
    }

    // Initial attempt = 1
    // Retry 1 = 2
    // Retry 2 = 3
    // Retry 3 = 4

    if (attempt.attempt_number >= 4) {
      await connection.query(
        `UPDATE payment_attempts
         SET status = 'failed', next_retry_at = NULL
         WHERE id = ?`,
        [attempt.id]
      );

      await connection.query(
        `UPDATE subscriptions
         SET status = 'suspended'
         WHERE customer_id = ?
         AND status = 'past_due'`,
        [invoices[0].customer_id]
      );

      await connection.commit();

      return {
        message: "Third retry failed. Subscription suspended."
      };
    }

    // Schedule the next retry
    let retryDays = 1;

    const currentTime = getCurrentTime()
  .toISOString()
  .slice(0, 19)
  .replace("T", " ");

    if (attempt.attempt_number === 2) {
      retryDays = 2;
    }

    if (attempt.attempt_number === 3) {
      retryDays = 2;
    }

    await connection.query(
      `UPDATE payment_attempts
       SET status = 'failed',
    next_retry_at = DATE_ADD(
      ?,
      INTERVAL ? DAY
    )
       WHERE id = ?`,
  [currentTime, retryDays, attempt.id]
    );

    // Mark the subscription as past_due
    await connection.query(
      `UPDATE subscriptions
       SET status = 'past_due'
       WHERE customer_id = ?
       AND status = 'active'`,
      [invoices[0].customer_id]
    );

    await connection.commit();

    return {
      message: "Payment failed. Next retry scheduled.",
      retryInDays: retryDays
    };

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    throw error;

  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  schedulePaymentRetry
};
