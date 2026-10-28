
const express = require("express");
const router = express.Router();

const {
  closeBillingPeriod
} = require("../controllers/billingController");

router.post("/close", closeBillingPeriod);

module.exports = router;
