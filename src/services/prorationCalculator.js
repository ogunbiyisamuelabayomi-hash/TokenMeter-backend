
function calculateProratedBaseFees(planPeriods) {
  const invoiceLines = [];

  for (const period of planPeriods) {
    const {
      planName,
      monthlyFeeKobo,
      periodStart,
      periodEnd,
      billingStart,
      billingEnd
    } = period;

    if (
      !Number.isSafeInteger(monthlyFeeKobo) ||
      monthlyFeeKobo < 0
    ) {
      throw new Error("Plan fee must be a non-negative safe integer");
    }

    const start = new Date(periodStart).getTime();
    const end = new Date(periodEnd).getTime();
    const billingPeriodStart = new Date(billingStart).getTime();
    const billingPeriodEnd = new Date(billingEnd).getTime();

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      !Number.isFinite(billingPeriodStart) ||
      !Number.isFinite(billingPeriodEnd) ||
      start >= end ||
      billingPeriodStart >= billingPeriodEnd
    ) {
      throw new Error("Invalid proration dates");
    }

    const periodDuration = billingPeriodEnd - billingPeriodStart;
    const planDuration = end - start;

    // Use BigInt to avoid floating-point money calculations
    const numerator =
      BigInt(monthlyFeeKobo) * BigInt(planDuration);

    const denominator = BigInt(periodDuration);

    // Round to the nearest kobo, with halves rounded up
    const amountKobo = Number(
      (numerator + denominator / 2n) / denominator
    );

    if (!Number.isSafeInteger(amountKobo)) {
      throw new Error("Prorated fee exceeds safe integer range");
    }

    invoiceLines.push({
      description: `Prorated base fee - ${planName}`,
      lineType: "proration",
      quantity: 1,
      unitPriceKobo: amountKobo,
      amountKobo
    });
  }

  return invoiceLines;
}

module.exports = { calculateProratedBaseFees };

