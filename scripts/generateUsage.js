
const API_URL = "http://localhost:3030/api/usage";

const CUSTOMER_ID = 4;

const TOTAL_UNIQUE_EVENTS = 95000;
const TOTAL_DUPLICATES = 5000;
const TOTAL_LATE_EVENTS = 2000;
const BATCH_SIZE = 10;

async function sendUsageEvent(event) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(event)
    });

    const result = await response.json();

    return {
      success: response.ok,
      status: response.status,
      message: result.message
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      message: error.message
    };
  }
}

async function generateUsage() {
  console.log("Starting usage event generation...");

  const now = Date.now();
  const uniqueEvents = [];

  // Generate 95,000 unique events
  for (let i = 1; i <= TOTAL_UNIQUE_EVENTS; i++) {
    let eventTime;

    if (i <= TOTAL_LATE_EVENTS) {
      // These events are 24 hours old
      eventTime = new Date(
        now - 24 * 60 * 60 * 1000
      ).toISOString();
    } else {
      // Normal events from the last hour
      eventTime = new Date(
        now - Math.floor(Math.random() * 60 * 60 * 1000)
      ).toISOString();
    }

    uniqueEvents.push({
      eventId: `tokenmeter-event-${i}`,
      customerId: CUSTOMER_ID,
      meterName: "ai_tokens",
      quantity: Math.floor(Math.random() * 1000) + 1,
      eventTime
    });
  }

  // Add 5,000 duplicate submissions
  const allEvents = [...uniqueEvents];

  for (let i = 0; i < TOTAL_DUPLICATES; i++) {
    const originalEvent = uniqueEvents[i];

    allEvents.push({ ...originalEvent });
  }

  console.log(`Total submissions: ${allEvents.length}`);
  console.log("Sending events to TokenMeter API...");

  let successful = 0;
  let failed = 0;
  let duplicatesRejected = 0;

  // Send events in batches
  for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
    const batch = allEvents.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(event => sendUsageEvent(event))
    );

    for (const result of results) {
      if (result.success) {
        successful++;
      } else {
        failed++;

        if (result.status === 409) {
          duplicatesRejected++;
        }
      }
    }

    const processed = Math.min(
      i + BATCH_SIZE,
      allEvents.length
    );

    if (processed % 1000 === 0 || processed === allEvents.length) {
      console.log(
        `Processed ${processed}/${allEvents.length}`
      );
    }
  }

  console.log("\nUsage generation completed.");
  console.log("--------------------------------");
  console.log(`Total submissions: ${allEvents.length}`);
  console.log(`Successful events: ${successful}`);
  console.log(`Failed events: ${failed}`);
  console.log(`Duplicates rejected (HTTP 409): ${duplicatesRejected}`);
  console.log("--------------------------------");
}

generateUsage();
