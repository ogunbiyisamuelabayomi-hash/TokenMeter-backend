
const pool = require("../config/database");
const { 
    initiateSquadPayment,
    verifySquadPayment
 } = require("../services/squadService");
const crypto = require("crypto");

// Initiate payment for an existing invoice
const createInvoicePayment = async (req, res) => {
  let connection;

  try {
    const { invoiceId } = req.body;

    if (!Number.isSafeInteger(Number(invoiceId)) || Number(invoiceId) < 1) {
      return res.status(400).json({
        message: "Valid invoice ID is required"
      });
    }

    connection = await pool.getConnection();

    // Find the invoice and customer details
    const [invoices] = await connection.query(
      `SELECT i.id, i.customer_id, i.subtotal_kobo, i.status,
              c.name AS customer_name, c.email AS customer_email
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       WHERE i.id = ?`,
      [Number(invoiceId)]
    );

    if (invoices.length === 0) {
      return res.status(404).json({
        message: "Invoice not found"
      });
    }

    const invoice = invoices[0];

    if (invoice.status === "paid") {
      return res.status(400).json({
        message: "This invoice has already been paid"
      });
    }

    if (invoice.status === "cancelled") {
      return res.status(400).json({
        message: "Cannot pay a cancelled invoice"
      });
    }

    const amountKobo = Number(invoice.subtotal_kobo);

    if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
      return res.status(400).json({
        message: "Invoice amount must be a positive integer in kobo"
      });
    }

    // Generate a unique reference for this payment attempt
    const transactionRef = `TM${Date.now()}${crypto.randomBytes(4).toString("hex")}`;

    // Save the attempt before calling Squad
    const [attempt] = await connection.query(
      `INSERT INTO payment_attempts
       (invoice_id, attempt_number, transaction_ref, amount_kobo, status)
       SELECT ?, COALESCE(MAX(attempt_number), 0) + 1, ?, ?, 'pending'
       FROM payment_attempts
       WHERE invoice_id = ?`,
      [invoice.id, transactionRef, amountKobo, invoice.id]
    );

    // Request a real Squad sandbox checkout session
    const squadResult = await initiateSquadPayment(
      invoice.customer_email,
      invoice.customer_name,
      amountKobo,
      transactionRef
    );

    return res.status(201).json({
      message: "Squad payment initiated",
      invoiceId: invoice.id,
      paymentAttemptId: attempt.insertId,
      amountKobo,
      transactionRef,
      squadResponse: squadResult
    });
  } catch (error) {
    console.error("Create invoice payment error:", error.message);

    return res.status(500).json({
      message: "Unable to initiate payment",
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};


const verifyInvoicePayment = async (req, res) => {
  let connection;

  try {
    const { transactionRef } = req.body;

    if (!transactionRef) {
      return res.status(400).json({
        message: "Transaction reference is required"
      });
    }

    connection = await pool.getConnection();

    // Find the payment attempt in our own database
    const [attempts] = await connection.query(
      `SELECT pa.id, pa.invoice_id, pa.amount_kobo, pa.status,
              pa.transaction_ref
       FROM payment_attempts pa
       WHERE pa.transaction_ref = ?`,
      [transactionRef]
    );

    if (attempts.length === 0) {
      return res.status(404).json({
        message: "Payment attempt not found"
      });
    }

    const attempt = attempts[0];

    // Do not process an already successful payment again
    if (attempt.status === "successful") {
      return res.status(200).json({
        message: "Payment was already verified successfully",
        paymentAttemptId: attempt.id,
        invoiceId: attempt.invoice_id,
        status: "successful"
      });
    }

    // Ask Squad to verify the transaction server-side
    const squadResult = await verifySquadPayment(transactionRef);
    const transaction = squadResult.data;

    // Confirm that the reference and amount match our records
    if (
      !transaction ||
      transaction.transaction_ref !== attempt.transaction_ref ||
      Number(transaction.transaction_amount) !== Number(attempt.amount_kobo)
    ) {
      return res.status(400).json({
        message: "Squad transaction details do not match our payment record"
      });
    }

    const transactionStatus = String(
  transaction.transaction_status || ""
).toLowerCase();

if (transactionStatus !== "success") {
      return res.status(200).json({
        message: "Payment has not succeeded",
        transactionStatus: transaction.transaction_status,
        paymentAttemptId: attempt.id
      });
    }

    await connection.beginTransaction();

    // Lock the invoice and payment attempt to avoid duplicate updates
    const [lockedAttempts] = await connection.query(
      `SELECT id, invoice_id, amount_kobo, status
       FROM payment_attempts
       WHERE id = ?
       FOR UPDATE`,
      [attempt.id]
    );

    const [lockedInvoices] = await connection.query(
      `SELECT id, customer_id, subtotal_kobo, status
       FROM invoices
       WHERE id = ?
       FOR UPDATE`,
      [attempt.invoice_id]
    );

    if (lockedAttempts.length === 0 || lockedInvoices.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: "Payment or invoice record not found"
      });
    }

    if (lockedAttempts[0].status === "successful") {
      await connection.commit();
      return res.status(200).json({
        message: "Payment was already verified successfully",
        paymentAttemptId: attempt.id,
        invoiceId: attempt.invoice_id,
        status: "successful"
      });
    }

    if (
      Number(lockedInvoices[0].subtotal_kobo) !== Number(attempt.amount_kobo)
    ) {
      await connection.rollback();
      return res.status(400).json({
        message: "Payment amount does not match the invoice"
      });
    }

    if (lockedInvoices[0].status === "paid") {
      await connection.rollback();
      return res.status(409).json({
        message: "Invoice is already paid by another payment attempt"
      });
    }

    await connection.query(
      `UPDATE payment_attempts
       SET status = 'successful'
       WHERE id = ?`,
      [attempt.id]
    );

  
await connection.query(
  `UPDATE invoices
   SET status = 'paid', paid_at = UTC_TIMESTAMP(3)
   WHERE id = ?`,
  [attempt.invoice_id]
);

// Find the customer's subscription
const [subscriptions] = await connection.query(
  `SELECT id, status
   FROM subscriptions
   WHERE customer_id = ?
   ORDER BY id DESC
   LIMIT 1
   FOR UPDATE`,
  [lockedInvoices[0].customer_id]
);

if (subscriptions.length === 0) {
  throw new Error("Customer subscription not found");
}

const subscription = subscriptions[0];

let newSubscriptionStatus = subscription.status;

// Apply the correct successful-payment transition
if (
  subscription.status === "trialing" ||
  subscription.status === "past_due" ||
  subscription.status === "suspended"
) {
  newSubscriptionStatus = "active";
}

if (newSubscriptionStatus !== subscription.status) {
  await connection.query(
    `UPDATE subscriptions
     SET status = ?
     WHERE id = ?`,
    [newSubscriptionStatus, subscription.id]
  );
}

await connection.commit();


    await connection.commit();

    return res.status(200).json({
      message: "Payment verified and invoice marked as paid",
      paymentAttemptId: attempt.id,
      invoiceId: attempt.invoice_id,
      status: "successful"
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Verify invoice payment error:", error.message);

    return res.status(500).json({
      message: "Unable to verify payment"
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};


module.exports = {
     createInvoicePayment,
     verifyInvoicePayment
     };
