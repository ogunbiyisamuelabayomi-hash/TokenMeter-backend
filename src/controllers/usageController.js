
const pool = require("../config/database");

// Record a usage event
const createUsageEvent = async (req, res) => {
  try {
    const {
      eventId,
      customerId,
      meterName,
      quantity,
      eventTime
    } = req.body;

    if (!eventId || typeof eventId !== "string" || !eventId.trim()) {
      return res.status(400).json({
        message: "Event ID is required"
      });
    }

    if (eventId.length > 191) {
      return res.status(400).json({
        message: "Event ID must not exceed 191 characters"
      });
    }

    if (!customerId || !Number.isSafeInteger(Number(customerId)) ||
        Number(customerId) < 1) {
      return res.status(400).json({
        message: "Valid customer ID is required"
      });
    }

    if (!meterName || typeof meterName !== "string" ||
        !meterName.trim() || meterName.length > 100) {
      return res.status(400).json({
        message: "Valid meter name is required"
      });
    }

    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        message: "Quantity must be a positive integer"
      });
    }

    if (!eventTime || Number.isNaN(Date.parse(eventTime))) {
      return res.status(400).json({
        message: "A valid event time is required"
      });
    }

    const parsedEventTime = new Date(eventTime);
    const currentTime = Date.now();
    const eventTimestamp = parsedEventTime.getTime();

    // Reject events from the future
    if (eventTimestamp > currentTime) {
      return res.status(400).json({
        message: "Event time cannot be in the future"
      });
    }

    // Accept events up to 48 hours late
    const fortyEightHours = 48 * 60 * 60 * 1000;

    if (currentTime - eventTimestamp > fortyEightHours) {
      return res.status(400).json({
        message: "Event is too old. Events older than 48 hours are rejected."
      });
    }

    // Check if the customer exists
    const [customers] = await pool.query(
      "SELECT id FROM customers WHERE id = ?",
      [Number(customerId)]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    // Convert event time to UTC MySQL DATETIME format
    const mysqlEventTime = parsedEventTime
      .toISOString()
      .slice(0, 23)
      .replace("T", " ");

    // Save the event. The database prevents duplicate event IDs.
    const [result] = await pool.query(
      `INSERT INTO usage_events
       (event_id, customer_id, meter_name, quantity, event_time)
       VALUES (?, ?, ?, ?, ?)`,
      [
        eventId.trim(),
        Number(customerId),
        meterName.trim(),
        quantity,
        mysqlEventTime
      ]
    );

    return res.status(201).json({
      message: "Usage event recorded successfully",
      usageEvent: {
        id: result.insertId,
        eventId: eventId.trim(),
        customerId: Number(customerId),
        meterName: meterName.trim(),
        quantity,
        eventTime: parsedEventTime.toISOString()
      }
    });
  } catch (error) {
    // MySQL error for a duplicate unique value
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "This event ID has already been recorded"
      });
    }

    console.error("Create usage event error:", error.message);

    return res.status(500).json({
      message: "Unable to record usage event"
    });
  }
};

// Retrieve recorded usage events
const getUsageEvents = async (req, res) => {
  try {
    const [events] = await pool.query(
      `SELECT id, event_id, customer_id, meter_name,
              quantity, event_time, received_at
       FROM usage_events
       ORDER BY id DESC`
    );

    return res.status(200).json({
      message: "Usage events retrieved successfully",
      usageEvents: events
    });
  } catch (error) {
    console.error("Get usage events error:", error.message);

    return res.status(500).json({
      message: "Unable to retrieve usage events"
    });
  }
};

module.exports = {
  createUsageEvent,
  getUsageEvents
};
