
const express = require("express");
const router = express.Router();

const {
  createInvoicePayment,
  verifyInvoicePayment
} = require("../controllers/paymentController");

const {
  handleSquadWebhook
} = require("../controllers/webhookController");

const verifySquadWebhook = require("../middleware/verifySquadWebhook");

// Payment routes
router.post("/invoice", createInvoicePayment);
router.post("/verify", verifyInvoicePayment);

// Squad webhook route
router.post(
  "/webhook",
  verifySquadWebhook,
  handleSquadWebhook
);

module.exports = router;