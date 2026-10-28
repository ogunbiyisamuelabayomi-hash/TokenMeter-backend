
function calculateUsageLines(tiers, totalQuantity) {
  if (!Array.isArray(tiers)) {
    throw new Error("Price tiers must be an array");
  }

  if (!Number.isSafeInteger(totalQuantity) || totalQuantity < 0) {
    throw new Error("Total quantity must be a non-negative integer");
  }

  const sortedTiers = [...tiers].sort(
    (a, b) => Number(a.from_quantity) - Number(b.from_quantity)
  );

  const lines = [];

  for (const tier of sortedTiers) {
    const fromQuantity = Number(tier.from_quantity);
    const toQuantity =
      tier.to_quantity === null ? null : Number(tier.to_quantity);
    const pricePerUnitKobo = Number(tier.price_per_unit_kobo);

    // Find how much usage falls inside this tier
    const tierEnd =
      toQuantity === null
        ? totalQuantity
        : Math.min(totalQuantity, toQuantity);

    const tierQuantity = Math.max(
      0,
      tierEnd - fromQuantity + 1
    );

    // Skip tiers that the customer did not use
    if (tierQuantity === 0) {
      continue;
    }

    const amountKobo = tierQuantity * pricePerUnitKobo;

    if (!Number.isSafeInteger(amountKobo)) {
      throw new Error("Usage charge exceeds safe integer range");
    }

    lines.push({
      description: `Usage from ${fromQuantity} to ${
        toQuantity === null ? "above" : toQuantity
      }`,
      lineType: "usage_tier",
      quantity: tierQuantity,
      unitPriceKobo: pricePerUnitKobo,
      amountKobo
    });
  }

  return lines;
}

module.exports = { calculateUsageLines };
