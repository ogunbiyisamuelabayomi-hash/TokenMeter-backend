
const express = require("express");

const router = express.Router();

const {
  createPlan,
  getPlans
} = require("../controllers/planController");

// Create a plan
router.post("/", createPlan);

// Get all plans
router.get("/", getPlans);

module.exports = router;
