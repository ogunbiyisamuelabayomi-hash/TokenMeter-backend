const { schedulePaymentRetry } = require("../src/services/paymentRetryService");

async function testPaymentRetry() {
  try {
    const result = await schedulePaymentRetry(3);

    console.log(result);
  } catch (error) {
    console.error("Retry test error:", error.message);
  }

  process.exit();
}

testPaymentRetry();