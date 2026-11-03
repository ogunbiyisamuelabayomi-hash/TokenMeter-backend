
const {
  calculateProratedBaseFees
} = require("../src/services/prorationCalculator");

describe("Proration Calculator", () => {
  test("calculates 10 days of a 31-day billing month", () => {
    const result = calculateProratedBaseFees([
      {
        planName: "AI Starter Plan",
        monthlyFeeKobo: 500000,
        periodStart: "2026-10-01T00:00:00Z",
        periodEnd: "2026-10-11T00:00:00Z",
        billingStart: "2026-10-01T00:00:00Z",
        billingEnd: "2026-11-01T00:00:00Z"
      }
    ]);

    expect(result[0].amountKobo).toBe(161290);
  });

  test("rounds half kobo up to the nearest kobo", () => {
    const result = calculateProratedBaseFees([
      {
        planName: "Rounding Test",
        monthlyFeeKobo: 1,
        periodStart: "2026-04-01T00:00:00Z",
        periodEnd: "2026-04-16T00:00:00Z",
        billingStart: "2026-04-01T00:00:00Z",
        billingEnd: "2026-05-01T00:00:00Z"
      }
    ]);

    expect(result[0].amountKobo).toBe(1);
  });

  test("creates separate fees for two plans in one billing month", () => {
    const result = calculateProratedBaseFees([
      {
        planName: "AI Starter Plan",
        monthlyFeeKobo: 500000,
        periodStart: "2026-10-01T00:00:00Z",
        periodEnd: "2026-10-11T00:00:00Z",
        billingStart: "2026-10-01T00:00:00Z",
        billingEnd: "2026-11-01T00:00:00Z"
      },
      {
        planName: "AI Pro Plan",
        monthlyFeeKobo: 1000000,
        periodStart: "2026-10-11T00:00:00Z",
        periodEnd: "2026-11-01T00:00:00Z",
        billingStart: "2026-10-01T00:00:00Z",
        billingEnd: "2026-11-01T00:00:00Z"
      }
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].amountKobo).toBe(161290);
    expect(result[1].amountKobo).toBe(677419);
    expect(
      result.reduce((total, line) => total + line.amountKobo, 0)
    ).toBe(838709);
  });

  test("rejects a negative monthly fee", () => {
    expect(() =>
      calculateProratedBaseFees([
        {
          planName: "Invalid Plan",
          monthlyFeeKobo: -100,
          periodStart: "2026-10-01T00:00:00Z",
          periodEnd: "2026-10-11T00:00:00Z",
          billingStart: "2026-10-01T00:00:00Z",
          billingEnd: "2026-11-01T00:00:00Z"
        }
      ])
    ).toThrow();
  });
});
