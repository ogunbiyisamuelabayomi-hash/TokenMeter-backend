
const pool = require("../src/config/database");

async function checkInvoices() {
  try {
    console.log("Starting independent invoice verification...\n");

    const [invoices] = await pool.query(`
      SELECT
        i.id AS invoice_id,
        i.customer_id,
        i.subtotal_kobo,
        COALESCE(SUM(il.amount_kobo), 0) AS calculated_total
      FROM invoices i
      LEFT JOIN invoice_lines il
        ON i.id = il.invoice_id
      GROUP BY
        i.id,
        i.customer_id,
        i.subtotal_kobo
      ORDER BY i.id ASC
    `);

    if (invoices.length === 0) {
      console.log("No invoices found.");
      return;
    }

    let passed = 0;
    let failed = 0;

    for (const invoice of invoices) {
      const recordedTotal = Number(invoice.subtotal_kobo);
      const calculatedTotal = Number(invoice.calculated_total);

      if (recordedTotal === calculatedTotal) {
        passed++;

        console.log(
          `Invoice ${invoice.invoice_id}: PASSED`
        );
      } else {
        failed++;

        console.log(
          `Invoice ${invoice.invoice_id}: FAILED`
        );

        console.log(`Recorded: ${recordedTotal} kobo`);
        console.log(`Calculated: ${calculatedTotal} kobo`);
      }
    }

    console.log("\n--------------------------------");
    console.log(`Total invoices checked: ${invoices.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log("--------------------------------");

    if (failed > 0) {
      console.log("Some invoices have incorrect totals.");
    } else {
      console.log("All invoice totals are correct.");
    }
  } catch (error) {
    console.error("Invoice verification error:", error.message);
  } finally {
    await pool.end();
  }
}

checkInvoices();
