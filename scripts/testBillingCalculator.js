
const { calculateUsageLines } = require("../src/services/billingCalculator");

const tiers = [
  {
    from_quantity: 1,
    to_quantity: 1000,
    price_per_unit_kobo: 2
  },
  {
    from_quantity: 1001,
    to_quantity: null,
    price_per_unit_kobo: 1
  }
];

const lines = calculateUsageLines(tiers, 1500);

console.log("Invoice usage lines:");
console.log(lines);

const totalKobo = lines.reduce(
  (total, line) => total + line.amountKobo,
  0
);

console.log("Total usage charge:", totalKobo, "kobo");

if (totalKobo !== 2500) {
  throw new Error("Billing calculation test failed");
}

console.log("Billing calculation test passed!");
