const express = require("express");
const router = express.Router();

const {
  createSubscription,
  getSubscriptions,
  transitionSubscription,
  changeSubscriptionPlan
} = require("../controllers/subscriptionController");

router.post("/", createSubscription);
router.get("/", getSubscriptions);

router.patch("/:id/status", transitionSubscription);

// Change subscription plan
router.patch("/:id/plan", changeSubscriptionPlan);

module.exports = router;