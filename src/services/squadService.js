
require("dotenv").config();

const SQUAD_BASE_URL = "https://sandbox-api-d.squadco.com";

async function initiateSquadPayment(email, customerName, amountKobo, transactionRef) {
  if (!process.env.SQUAD_SECRET_KEY) {
    throw new Error("Squad secret key is missing from .env");
  }

  if (!email || !customerName || !transactionRef) {
    throw new Error("Email, customer name and transaction reference are required");
  }

  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    throw new Error("Payment amount must be a positive integer in kobo");
  }

  const response = await fetch(
    `${SQUAD_BASE_URL}/transaction/initiate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SQUAD_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        currency: "NGN",
        initiate_type: "inline",
        transaction_ref: transactionRef,
        customer_name: customerName
      })
    }
  );

  const result = await response.json();

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message || `Squad payment request failed: ${response.status}`
    );
  }

  return result;
}


async function verifySquadPayment(transactionRef) {
  if (!process.env.SQUAD_SECRET_KEY) {
    throw new Error("Squad secret key is missing from .env");
  }

  if (!transactionRef) {
    throw new Error("Transaction reference is required");
  }

  const response = await fetch(
    `${SQUAD_BASE_URL}/transaction/verify/${encodeURIComponent(transactionRef)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.SQUAD_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const result = await response.json();

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.message || `Squad verification failed: ${response.status}`
    );
  }

  return result;
}

module.exports = {
   initiateSquadPayment,
   verifySquadPayment 
  };
