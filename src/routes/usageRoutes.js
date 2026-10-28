
const express = require("express");
const router = express.Router();

const {
  createUsageEvent,
  getUsageEvents
} = require("../controllers/usageController");

router.post("/", createUsageEvent);
router.get("/", getUsageEvents);

module.exports = router;
