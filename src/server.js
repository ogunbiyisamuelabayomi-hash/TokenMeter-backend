require("dotenv").config();

const app = require("./app");
const pool = require("./config/database");
const cron = require("node-cron");

const {
  processDuePaymentRetries
} = require("./jobs/paymentRetryJob");

const PORT = process.env.PORT || 4620;

async function startServer() {
  try {
    const connection = await pool.getConnection();

    console.log("MySQL database connected successfully");

    connection.release();

    app.listen(PORT, () => {
  console.log(`TokenMeter server running on port ${PORT}`);

  // Check for due payment retries every minute
 cron.schedule("* * * * *", async () => {
  try {
    await processDuePaymentRetries();
  } catch (error) {
    console.error("Payment retry job failed:", error.message);
  }
});

  console.log("Payment retry scheduler started");
});
  } catch (error) {
    console.error("Unable to connect to MySQL:", error.message);
    process.exit(1);
  }
}

startServer();