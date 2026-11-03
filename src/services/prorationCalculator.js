
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

    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const billingPeriodStart = new Date(billingStart);
    const billingPeriodEnd = new Date(billingEnd);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      Number.isNaN(billingPeriodStart.getTime()) ||
      Number.isNaN(billingPeriodEnd.getTime()) ||
      start >= end ||
      billingPeriodStart >= billingPeriodEnd
    ) {
      throw new Error("Invalid proration dates");
    }

    // Calculate the number of calendar days in each period
    const planDays = Math.round(
      (Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) -
       Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) /
      (24 * 60 * 60 * 1000)
    );

    const billingDays = new Date(
      Date.UTC(
        billingPeriodEnd.getUTCFullYear(),
        billingPeriodEnd.getUTCMonth(),
        billingPeriodEnd.getUTCDate()
      )
    ).getUTCDate() === 1
      ? Math.round(
          (Date.UTC(
            billingPeriodEnd.getUTCFullYear(),
            billingPeriodEnd.getUTCMonth(),
            billingPeriodEnd.getUTCDate()
          ) -
          Date.UTC(
            billingPeriodStart.getUTCFullYear(),
            billingPeriodStart.getUTCMonth(),
            billingPeriodStart.getUTCDate()
          )) / (24 * 60 * 60 * 1000)
        )
      : new Date(
          Date.UTC(
            billingPeriodStart.getUTCFullYear(),
            billingPeriodStart.getUTCMonth() + 1,
            0
          )
        ).getUTCDate();

    if (planDays < 1 || billingDays < 1) {
      throw new Error("Invalid proration duration");
    }

    // Calculate prorated fee using integer kobo and BigInt
    const numerator =
      BigInt(monthlyFeeKobo) * BigInt(planDays);

    const denominator = BigInt(billingDays);

    // Round to nearest kobo, with halves rounded up
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
