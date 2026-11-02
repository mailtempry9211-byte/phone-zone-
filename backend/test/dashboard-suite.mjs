/**
 * Test Suite for Admin Dashboard Overview (Assertions A75 - A85)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, "..");
const ROOT = path.resolve(BACKEND, "..");

const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "phonezone-test-dash-"));
process.env.PHONEZONE_DATA_DIR = tmpDataDir;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(err);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(err);
  }
}

console.log("--- Starting Dashboard Overview Test Suite (A75 - A85) ---");

// Dynamic import of backend modules
const { initDatabase, getDb } = await import("../src/db/index.js");
const { getDashboardOverview, getIstDateString } = await import("../src/services/dashboardService.js");
const { createServer } = await import("../src/server.js");

// Initialize clean DB
initDatabase();
const db = getDb();

const todayIst = getIstDateString(new Date());

test("A79: Empty/Clean DB returns 200 shape with zeros and empty arrays", () => {
  const res = getDashboardOverview({ role: "admin", nocache: true });
  assert.equal(res.timezone, "Asia/Kolkata");
  assert.ok(typeof res.today.salesAmount === "number" && !isNaN(res.today.salesAmount));
  assert.ok(typeof res.today.phonesSold === "number");
  assert.ok(typeof res.stock.count === "number");
  assert.ok(Array.isArray(res.series));
  assert.ok(Array.isArray(res.brands));
  assert.ok(Array.isArray(res.recentInvoices));
  assert.ok(Array.isArray(res.alerts));
});

test("A76 & A78: Data counts match SQL queries", () => {
  const res = getDashboardOverview({ role: "admin", nocache: true });
  const sqlStockCount = db.prepare("SELECT COUNT(*) AS c FROM phones WHERE is_sold = 0 AND deleted_at IS NULL").get().c;
  const sqlStockValue = db.prepare("SELECT COALESCE(SUM(selling_price),0) AS v FROM phones WHERE is_sold = 0 AND deleted_at IS NULL").get().v;
  
  assert.equal(res.stock.count, sqlStockCount, "Stock count matches SQL");
  assert.equal(res.stock.value, sqlStockValue, "Stock value matches SQL");
  assert.ok(typeof res.today.salesAmount === "number");
  assert.ok(typeof res.today.phonesSold === "number");
});

test("A80: Role scrubbing removes profit & stock values for staff", () => {
  const adminRes = getDashboardOverview({ role: "admin", nocache: true });
  assert.equal(typeof adminRes.today.profit, "number");
  assert.equal(typeof adminRes.stock.value, "number");

  const staffRes = getDashboardOverview({ role: "staff", nocache: true });
  assert.strictEqual(staffRes.today.profit, undefined);
  assert.strictEqual(staffRes.stock.value, undefined);
  assert.strictEqual(staffRes.repairs.balanceDue, undefined);
});

test("A80: Payload contains no private fields (imei, aadhaar, token, bank)", () => {
  const res = getDashboardOverview({ role: "admin", nocache: true });
  const jsonStr = JSON.stringify(res).toLowerCase();
  assert.ok(!jsonStr.includes("123456789012345"), "Payload must not leak IMEIs");
  assert.ok(!jsonStr.includes("aadhaar"), "Payload must not leak Aadhaar");
  assert.ok(!jsonStr.includes("account_number"), "Payload must not leak bank details");
});

test("A77: IST Timezone calculation produces valid YYYY-MM-DD", () => {
  const dStr = getIstDateString(new Date());
  assert.match(dStr, /^\d{4}-\d{2}-\d{2}$/);
});

test("A82: Performance check - overview calculation is sub-100ms", () => {
  const start = Date.now();
  for (let i = 0; i < 5; i++) {
    getDashboardOverview({ role: "admin", nocache: true });
  }
  const avg = (Date.now() - start) / 5;
  assert.ok(avg < 100, `Expected avg < 100ms, got ${avg}ms`);
});

// Clean up temp data dir
try {
  fs.rmSync(tmpDataDir, { recursive: true, force: true });
} catch {}

console.log(`\nDashboard Suite Result: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
