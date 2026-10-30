const pool = require("../config/database");
const { verifySquadPayment } = require("../services/squadService");

const handleSquadWebhook = async (req, res) => {
  try {
    const event = req.body;

    // 1. Check the webhook information
    if (!event || !event.Event || !event.TransactionRef || !event.Body) {
      return res.status(400).json({
        message: "Invalid webhook payload"
      });
    }

    const transactionRef = event.TransactionRef;
    const eventType = event.Event;
    const body = event.Body;

    if (body.transaction_ref !== transactionRef) {
      return res.status(400).json({
        message: "Transaction reference mismatch"
      });
    }

    // 2. We only process successful payment events
    if (eventType !== "charge_successful") {
      return res.status(200).json({
        message: "Webhook event received but not processed"
      });
    }

    // 3. Verify the payment directly with Squad
    const verification = await verifySquadPayment(transactionRef);
    const transaction = verification.data || verification;

    const transactionStatus = String(
      transaction.transaction_status || transaction.status || ""
    ).toLowerCase();

    if (transactionStatus !== "success") {
      return res.status(400).json({
        message: "Squad has not confirmed this payment as successful"
      });
    }

    // 4. Confirm the amount matches the webhook
    const verifiedAmount = Number(
      transaction.transaction_amount ?? transaction.amount
    );

    const webhookAmount = Number(body.amount);

    if (
      !Number.isSafeInteger(verifiedAmount) ||
      verifiedAmount !== webhookAmount
    ) {
      return res.status(400).json({
        message: "Payment amount does not match"
      });
    }

    // 5. Start a database transaction
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Record this webhook. The unique transaction_ref prevents duplicates.
      await connection.execute(
        `INSERT INTO webhook_events
        (transaction_ref, event_type, signature_verified)
        VALUES (?, ?, TRUE)`,
        [transactionRef, eventType]
      );

      // 6. Find and lock the matching payment attempt
      const [payments] = await connection.execute(
        `SELECT id, invoice_id, amount_kobo, status
         FROM payment_attempts
         WHERE transaction_ref = ?
         FOR UPDATE`,
        [transactionRef]
      );

      if (payments.length === 0) {
        throw new Error("Payment attempt not found");
      }

      const payment = payments[0];

      if (Number(payment.amount_kobo) !== verifiedAmount) {
        throw new Error("Payment amount does not match our records");
      }

      // 7. Lock the invoice
      const [invoices] = await connection.execute(
        `SELECT id, customer_id, status
         FROM invoices
         WHERE id = ?
         FOR UPDATE`,
        [payment.invoice_id]
      );

      if (invoices.length === 0) {
        throw new Error("Invoice not found");
      }

      const invoice = invoices[0];

      // 8. Update only if this payment has not already succeeded
      if (
        payment.status !== "successful" &&
        invoice.status !== "paid"
      ) {
        await connection.execute(
          `UPDATE payment_attempts
           SET status = 'successful'
           WHERE id = ?`,
          [payment.id]
        );

        await connection.execute(
          `UPDATE invoices
           SET status = 'paid', paid_at = UTC_TIMESTAMP(3)
           WHERE id = ?`,
          [invoice.id]
        );

        // 9. Activate the customer's subscription after payment
        const [subscriptions] = await connection.execute(
          `SELECT id, status
           FROM subscriptions
           WHERE customer_id = ?
           ORDER BY id DESC
           LIMIT 1
           FOR UPDATE`,
          [invoice.customer_id]
        );

        if (subscriptions.length > 0) {
          const subscription = subscriptions[0];

          if (
            ["trialing", "past_due", "suspended"].includes(
              subscription.status
            )
          ) {
            await connection.execute(
              `UPDATE subscriptions
               SET status = 'active'
               WHERE id = ?`,
              [subscription.id]
            );
          }
        }
      }

      // 10. Mark the webhook as processed
      await connection.execute(
        `UPDATE webhook_events
         SET processed_at = UTC_TIMESTAMP(3)
         WHERE transaction_ref = ?`,
        [transactionRef]
      );

      await connection.commit();

      return res.status(200).json({
        message: "Squad webhook processed successfully"
      });

    } catch (error) {
      await connection.rollback();

      // Duplicate transaction reference means this webhook was already received.
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(200).json({
          message: "Webhook already processed"
        });
      }

      throw error;

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("Squad webhook error:", error.message);

    return res.status(500).json({
      message: "Unable to process Squad webhook"
    });
  }
};

module.exports = { handleSquadWebhook };