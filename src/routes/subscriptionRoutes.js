const express = require("express");
const router = express.Router();

const {
  createSubscription,
  getSubscriptions,
  transitionSubscription
} = require("../controllers/subscriptionController");

router.post("/", createSubscription);
router.get("/", getSubscriptions);

router.patch("/:id/status", transitionSubscription);

module.exports = router;