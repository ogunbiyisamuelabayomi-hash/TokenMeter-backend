const allowedTransitions = {
  trialing: {
    payment_succeeded: "active"
  },
  active: {
    payment_failed: "past_due"
  },
  past_due: {
    payment_succeeded: "active",
    third_retry_failed: "suspended"
  },
  suspended: {
    invoice_paid: "active"
  }
};

function getNextSubscriptionStatus(currentStatus, event) {
  return allowedTransitions[currentStatus]?.[event] || null;
}

module.exports = { getNextSubscriptionStatus };