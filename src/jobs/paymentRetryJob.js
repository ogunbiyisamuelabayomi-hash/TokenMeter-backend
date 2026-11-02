
const pool = require("../config/database");
const {
  initiateSquadPayment
} = require("../services/squadService");
const { getCurrentTime } = require("../utils/clock");

const crypto = require("crypto");

const {
  schedulePaymentRetry
} = require("../services/paymentRetryService");

// Find and process payments whose retry time has arrived
async function processDuePaymentRetries() {
  let connection;

  try {
    connection = await pool.getConnection();

// Get the current time in MySQL DATETIME format 
   
    const currentTime = getCurrentTime()
  .toISOString()
  .slice(0, 19)
  .replace("T", " ");

  // Find failed payments that are due for another attempt
    
    const [dueAttempts] = await connection.query(
      `SELECT id
       FROM payment_attempts
       WHERE status = 'failed'
       AND next_retry_at IS NOT NULL
       AND next_retry_at <= ?
       ORDER BY next_retry_at ASC`,
       [currentTime]
    );

    for (const dueAttempt of dueAttempts) {
      let newAttempt;

      try {
        await connection.beginTransaction();

        // Lock the previous attempt to prevent duplicate retries
        const [attempts] = await connection.query(
          `SELECT id, invoice_id, attempt_number, next_retry_at
           FROM payment_attempts
           WHERE id = ?
           AND status = 'failed'
           AND next_retry_at <= ?
           FOR UPDATE`,
          [dueAttempt.id, currentTime]
        );

        if (attempts.length === 0) {
          await connection.rollback();
          continue;
        }

        const previousAttempt = attempts[0];

        // Get invoice and customer information
        const [invoices] = await connection.query(
          `SELECT i.id, i.customer_id, i.subtotal_kobo, i.status,
                  c.name AS customer_name, c.email AS customer_email
           FROM invoices i
           JOIN customers c ON c.id = i.customer_id
           WHERE i.id = ?
           FOR UPDATE`,
          [previousAttempt.invoice_id]
        );

        if (invoices.length === 0 || invoices[0].status === "paid") {
          await connection.query(
            `UPDATE payment_attempts
             SET next_retry_at = NULL
             WHERE id = ?`,
            [previousAttempt.id]
          );

          await connection.commit();
          continue;
        }

        const invoice = invoices[0];

        // Create the next payment attempt
        const transactionRef =
          `TM${Date.now()}${crypto.randomBytes(4).toString("hex")}`;

        const [result] = await connection.query(
          `INSERT INTO payment_attempts
           (invoice_id, attempt_number, transaction_ref, amount_kobo, status)
           VALUES (?, ?, ?, ?, 'pending')`,
          [
            invoice.id,
            Number(previousAttempt.attempt_number) + 1,
            transactionRef,
            Number(invoice.subtotal_kobo)
          ]
        );

        newAttempt = {
          id: result.insertId,
          invoiceId: invoice.id,
          amountKobo: Number(invoice.subtotal_kobo),
          transactionRef,
          customerName: invoice.customer_name,
          customerEmail: invoice.customer_email
        };

        // Prevent this scheduled retry from running again
        await connection.query(
          `UPDATE payment_attempts
           SET next_retry_at = NULL
           WHERE id = ?`,
          [previousAttempt.id]
        );

        await connection.commit();

        // Initiate the new Squad checkout
// Check whether we are testing payment retries
if (process.env.PAYMENT_RETRY_TEST_MODE === "true") {

  // Simulate a failed payment without contacting Squad
  console.log(
    `TEST MODE: Simulating failed retry for invoice ${newAttempt.invoiceId}`
  );

  const retryResult = await schedulePaymentRetry(newAttempt.id);

  console.log(retryResult);

} else {

  // Real payment retry through Squad
  try {
    const squadResult = await initiateSquadPayment(
      newAttempt.customerEmail,
      newAttempt.customerName,
      newAttempt.amountKobo,
      newAttempt.transactionRef
    );

    console.log(
      `Retry initiated for invoice ${newAttempt.invoiceId}`,
      squadResult.data?.checkout_url
    );

  } catch (error) {
    console.error("Squad retry initiation failed:", error.message);

    await schedulePaymentRetry(newAttempt.id);
  }
}
      } catch (error) {
        await connection.rollback();

        console.error(
          `Retry failed for payment attempt ${dueAttempt.id}:`,
          error.message
        );
      }
    }

  } catch (error) {
    console.error("Payment retry job error:", error.message);

  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  processDuePaymentRetries
};
