
const { calculateUsageLines } = require("../src/services/billingCalculator");

const tiers = [
  {
    from_quantity: 1,
    to_quantity: 1000000,
    price_per_unit_kobo: 2
  },
  {
    from_quantity: 1000001,
    to_quantity: null,
    price_per_unit_kobo: 1
  }
];

const totalQuantity = 1500000;

const lines = calculateUsageLines(tiers, totalQuantity);

const calculatedTotal = lines.reduce(
  (total, line) => total + line.amountKobo,
  0
);

const expectedTotal = 2500000;

console.log("Graduated Pricing Test");
console.log("----------------------");

console.log("Total usage:", totalQuantity);

console.log("\nInvoice lines:");

lines.forEach((line, index) => {
  console.log(`Line ${index + 1}:`);
  console.log("Description:", line.description);
  console.log("Quantity:", line.quantity);
  console.log("Unit price:", line.unitPriceKobo, "kobo");
  console.log("Amount:", line.amountKobo, "kobo");
});

console.log("\nCalculated total:", calculatedTotal, "kobo");
console.log("Expected total:", expectedTotal, "kobo");

if (calculatedTotal === expectedTotal) {
  console.log("\nPASSED: Billing calculation is correct.");
} else {
  console.log("\nFAILED: Billing calculation is incorrect.");
}
