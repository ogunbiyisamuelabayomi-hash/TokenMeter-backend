
const express = require("express");

const router = express.Router();

const {
  createCustomer,
  getCustomers,
  setSpendingCap,
  checkSpending
} = require("../controllers/customerController");

// Create a customer
router.post("/", createCustomer);

// Get all customers
router.get("/", getCustomers);

// Set spending cap for a customer
router.patch("/:id/spending-cap", setSpendingCap);

// Check spending for a customer
router.post("/:id/spending-check", checkSpending);

module.exports = router;
