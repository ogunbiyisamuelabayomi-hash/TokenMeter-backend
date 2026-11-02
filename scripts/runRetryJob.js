require("dotenv").config();

const pool = require("../src/config/database");
const { processDuePaymentRetries } = require("../src/jobs/paymentRetryJob");

async function runRetryJob() {
  try {
    await processDuePaymentRetries();
    console.log("Retry job test completed.");
  } catch (error) {
    console.error("Retry job test error:", error.message);
  } finally {
    await pool.end();
  }
}

runRetryJob();