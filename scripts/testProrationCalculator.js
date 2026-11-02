
const {
  calculateProratedBaseFees
} = require("../src/services/prorationCalculator");

// Billing period: November 1 to December 1 (30 days)
const billingStart = "2026-11-01T00:00:00Z";
const billingEnd = "2026-12-01T00:00:00Z";

// Three plan periods:
// Plan 1: November 1 to November 2
// Plan 3: November 2 to November 2
// Plan 1: November 2 to December 1

const planPeriods = [
  {
    planName: "AI Starter Plan",
    monthlyFeeKobo: 500000,
    periodStart: "2026-11-01T00:00:00Z",
    periodEnd: "2026-11-02T12:40:42.980Z",
    billingStart,
    billingEnd
  },
  {
    planName: "AI Pro Plan",
    monthlyFeeKobo: 1000000,
    periodStart: "2026-11-02T12:40:42.980Z",
    periodEnd: "2026-11-02T13:23:04.798Z",
    billingStart,
    billingEnd
  },
  {
    planName: "AI Starter Plan",
    monthlyFeeKobo: 500000,
    periodStart: "2026-11-02T13:23:04.798Z",
    periodEnd: billingEnd,
    billingStart,
    billingEnd
  }
];

const lines = calculateProratedBaseFees(planPeriods);

console.log("Proration test result:");
console.log(lines);

const total = lines.reduce(
  (sum, line) => sum + line.amountKobo,
  0
);

console.log("Total prorated base fee:", total, "kobo");
