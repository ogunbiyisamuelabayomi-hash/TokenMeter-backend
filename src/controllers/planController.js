
const pool = require("../config/database");

// Create a new plan
const createPlan = async (req, res) => {
  let connection;

  try {
    const { name, monthlyBaseFeeKobo, tiers } = req.body;

    // Check if plan name was provided
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Plan name is required"
      });
    }

    // Check if monthly base fee is a valid whole number
    if (
      !Number.isSafeInteger(monthlyBaseFeeKobo) ||
      monthlyBaseFeeKobo < 0
    ) {
      return res.status(400).json({
        message: "Monthly base fee must be a non-negative integer in kobo"
      });
    }

    // Check if price tiers were provided
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return res.status(400).json({
        message: "At least one price tier is required"
      });
    }

    // Sort tiers by their starting quantity
    const sortedTiers = [...tiers].sort(
      (a, b) => a.fromQuantity - b.fromQuantity
    );

    // Validate every tier
    for (let i = 0; i < sortedTiers.length; i++) {
      const tier = sortedTiers[i];

      if (
        typeof tier.meterName !== "string" ||
        !tier.meterName.trim() ||
        !Number.isSafeInteger(tier.fromQuantity) ||
        tier.fromQuantity < 1 ||
        !Number.isSafeInteger(tier.pricePerUnitKobo) ||
        tier.pricePerUnitKobo < 0
      ) {
        return res.status(400).json({
          message: "Each tier needs a meter name, valid starting quantity and non-negative integer price"
        });
      }

      if (
        tier.toQuantity !== null &&
        (!Number.isSafeInteger(tier.toQuantity) ||
          tier.toQuantity < tier.fromQuantity)
      ) {
        return res.status(400).json({
          message: "Tier ending quantity must be greater than or equal to its starting quantity, or null for the final tier"
        });
      }

      // Check that the tiers are continuous and do not overlap
      if (i === 0 && tier.fromQuantity !== 1) {
        return res.status(400).json({
          message: "The first tier must start at quantity 1"
        });
      }

      if (i > 0) {
        const previousTier = sortedTiers[i - 1];

        if (
          previousTier.toQuantity === null ||
          tier.fromQuantity !== previousTier.toQuantity + 1
        ) {
          return res.status(400).json({
            message: "Price tiers must be continuous, without gaps or overlaps"
          });
        }
      }
    }

    // The final tier must cover all remaining usage
    if (sortedTiers[sortedTiers.length - 1].toQuantity !== null) {
      return res.status(400).json({
        message: "The final tier must have toQuantity set to null"
      });
    }

    // Start a database transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Save the plan
    const [planResult] = await connection.query(
      `INSERT INTO plans (name, monthly_base_fee_kobo)
       VALUES (?, ?)`,
      [name.trim(), monthlyBaseFeeKobo]
    );

    const planId = planResult.insertId;

    // Save each price tier
    for (const tier of sortedTiers) {
      await connection.query(
        `INSERT INTO price_tiers
         (plan_id, meter_name, from_quantity, to_quantity, price_per_unit_kobo)
         VALUES (?, ?, ?, ?, ?)`,
        [
          planId,
          tier.meterName.trim(),
          tier.fromQuantity,
          tier.toQuantity,
          tier.pricePerUnitKobo
        ]
      );
    }

    // Save all changes together
    await connection.commit();

    return res.status(201).json({
      message: "Plan created successfully",
      plan: {
        id: planId,
        name: name.trim(),
        monthlyBaseFeeKobo,
        tiers: sortedTiers
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("Create plan error:", error.message);

    return res.status(500).json({
      message: "Unable to create plan"
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Get all plans and their price tiers
const getPlans = async (req, res) => {
  try {
    const [plans] = await pool.query(
      `SELECT
        p.id AS planId,
        p.name,
        p.monthly_base_fee_kobo,
        pt.id AS tierId,
        pt.meter_name,
        pt.from_quantity,
        pt.to_quantity,
        pt.price_per_unit_kobo
       FROM plans p
       LEFT JOIN price_tiers pt ON p.id = pt.plan_id
       ORDER BY p.id, pt.meter_name, pt.from_quantity`
    );

    const result = [];

    for (const row of plans) {
      let plan = result.find((item) => item.id === row.planId);

      if (!plan) {
        plan = {
          id: row.planId,
          name: row.name,
          monthlyBaseFeeKobo: row.monthly_base_fee_kobo,
          tiers: []
        };

        result.push(plan);
      }

      if (row.tierId !== null) {
        plan.tiers.push({
          id: row.tierId,
          meterName: row.meter_name,
          fromQuantity: row.from_quantity,
          toQuantity: row.to_quantity,
          pricePerUnitKobo: row.price_per_unit_kobo
        });
      }
    }

    return res.status(200).json({
      message: "Plans retrieved successfully",
      plans: result
    });
  } catch (error) {
    console.error("Get plans error:", error.message);

    return res.status(500).json({
      message: "Unable to retrieve plans"
    });
  }
};

module.exports = {
  createPlan,
  getPlans
};
