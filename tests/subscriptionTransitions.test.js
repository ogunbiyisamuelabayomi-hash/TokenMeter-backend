const {
  getNextSubscriptionStatus
} = require("../src/utils/subscriptionTransitions");

describe("Subscription Status Transitions", () => {
  test("trialing should become active after payment succeeds", () => {
    expect(
      getNextSubscriptionStatus("trialing", "payment_succeeded")
    ).toBe("active");
  });

  test("active should become past_due after payment fails", () => {
    expect(
      getNextSubscriptionStatus("active", "payment_failed")
    ).toBe("past_due");
  });

  test("past_due should become suspended after third retry fails", () => {
    expect(
      getNextSubscriptionStatus("past_due", "third_retry_failed")
    ).toBe("suspended");
  });

  test("suspended should become active after invoice is paid", () => {
    expect(
      getNextSubscriptionStatus("suspended", "invoice_paid")
    ).toBe("active");
  });

  test("invalid transitions should return null", () => {
    expect(
      getNextSubscriptionStatus("trialing", "payment_failed")
    ).toBeNull();
  });
});