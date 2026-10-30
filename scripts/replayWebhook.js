require("dotenv").config();

const crypto = require("crypto");

const transactionRef = "TM1793371922909c74bac7d";

const webhookPayload = {
  Event: "charge_successful",
  TransactionRef: transactionRef,
  Body: {
    transaction_ref: transactionRef,
    amount: 500000
  }
};

// Generate the valid Squad webhook signature
const signature = crypto
  .createHmac("sha512", process.env.SQUAD_SECRET_KEY)
  .update(JSON.stringify(webhookPayload))
  .digest("hex")
  .toUpperCase();

async function replayWebhook() {
  for (let i = 1; i <= 10; i++) {
    try {
      const response = await fetch(
        "http://localhost:3030/api/payments/webhook",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-squad-encrypted-body": signature
          },
          body: JSON.stringify(webhookPayload)
        }
      );

      const result = await response.json();

      console.log(`Replay ${i}:`, response.status, result.message);

    } catch (error) {
      console.log(`Replay ${i} failed:`, error.message);
    }
  }
}

replayWebhook();