
const pool = require("../src/config/database");

async function testTimezone() {
  try {
    const connection = await pool.getConnection();

    const [results] = await connection.query(`
      SELECT
        @@session.time_zone AS session_timezone,
        NOW(3) AS mysql_current_time,
        UTC_TIMESTAMP(3) AS utc_current_time
    `);

    console.log(results[0]);

    connection.release();
  } catch (error) {
    console.error("Timezone test error:", error.message);
  } finally {
    await pool.end();
  }
}

testTimezone();
