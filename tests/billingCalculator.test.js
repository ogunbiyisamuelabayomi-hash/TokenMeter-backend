const {
  calculateUsageLines
} = require("../src/services/billingCalculator");

describe("Billing Calculator", () => {
  test("should calculate graduated pricing correctly", () => {
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

    const result = calculateUsageLines(tiers, 1500000);

    const total = result.reduce(
      (sum, line) => sum + line.amountKobo,
      0
    );

    expect(total).toBe(2500000);
  });

  test("should return an empty array when usage is zero", () => {
    const tiers = [
      {
        from_quantity: 1,
        to_quantity: 1000000,
        price_per_unit_kobo: 2
      }
    ];

    const result = calculateUsageLines(tiers, 0);

    expect(result).toEqual([]);
  });

  test("should reject negative usage", () => {
    expect(() => {
      calculateUsageLines([], -100);
    }).toThrow("Total quantity must be a non-negative integer");
  });
});