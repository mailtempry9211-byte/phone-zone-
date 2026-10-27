import { initDatabase, getDb } from "../backend/src/db/index.js";

initDatabase();
const db = getDb();

// 1. Clear carried_to_fy from delivered and cancelled repair jobs
const r1 = db.prepare("UPDATE repair_jobs SET carried_to_fy = NULL WHERE LOWER(status) IN ('delivered', 'cancelled')").run();
console.log("Cleared carried_to_fy from completed repair jobs:", r1.changes);

// 2. Ensure all unsold phones are carried forward to active year 2028-29
const r2 = db.prepare(`
  UPDATE phones
  SET carried_to_fy = '2028-29'
  WHERE is_sold = 0
    AND (return_status IS NULL OR return_status != 'purchase_returned')
    AND deleted_at IS NULL
    AND (financial_year != '2028-29' OR financial_year IS NULL)
`).run();
console.log("Carried forward unsold phones to 2028-29:", r2.changes);

// 3. Ensure active repair jobs are carried forward to 2028-29
const r3 = db.prepare(`
  UPDATE repair_jobs
  SET carried_to_fy = '2028-29'
  WHERE LOWER(status) NOT IN ('delivered', 'cancelled')
    AND deleted_at IS NULL
    AND (financial_year != '2028-29' OR financial_year IS NULL)
`).run();
console.log("Carried forward active repair jobs to 2028-29:", r3.changes);

console.log("Active FY 2028-29 Phones in Inventory:", db.prepare(`
  SELECT id, phone_name, is_sold, financial_year, carried_to_fy
  FROM phones
  WHERE deleted_at IS NULL
    AND (
      (is_sold = 0 AND (return_status IS NULL OR return_status != 'purchase_returned'))
      OR COALESCE(financial_year, '2028-29') = '2028-29'
      OR carried_to_fy = '2028-29'
    )
`).all().length);

console.log("Active FY 2028-29 Repair Accounting:", db.prepare(`
  SELECT
    COUNT(*) AS total_delivered_in_fy,
    SUM(CASE WHEN LOWER(status) = 'delivered' THEN 1 ELSE 0 END) AS delivered_jobs,
    SUM(CASE WHEN LOWER(status) = 'delivered' THEN COALESCE(final_price, estimate, 0) ELSE 0 END) AS total_revenue
  FROM repair_jobs
  WHERE deleted_at IS NULL AND LOWER(status) = 'delivered' AND (COALESCE(financial_year, '2028-29') = '2028-29' OR carried_to_fy = '2028-29')
`).get());

console.log("Active FY 2028-29 Pending Workshop Jobs:", db.prepare(`
  SELECT COUNT(*) as pending
  FROM repair_jobs
  WHERE deleted_at IS NULL AND LOWER(status) NOT IN ('delivered', 'cancelled')
`).get());

process.exit(0);
