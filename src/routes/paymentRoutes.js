
const express = require("express");
const router = express.Router();

const {
  createInvoicePayment,
  verifyInvoicePayment
} = require("../controllers/paymentController");

router.post("/invoice", createInvoicePayment);

router.post("/verify", verifyInvoicePayment);

module.exports = router;
