/** Verifies open-source / multi-business / first-setup behaviour. Run: cd backend && node test/first-setup-suite.mjs */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "phonezone-setup-"));
process.env.PHONEZONE_DATA_DIR = DATA_DIR;
process.env.PHONEZONE_PORT = "47801";
const { createServer } = await import("../src/server.js");
const { closeDatabase } = await import("../src/db/index.js");
const BASE = `http://127.0.0.1:${Number(process.env.PHONEZONE_PORT)}/api`;
const passed = []; const failed = []; let cookie = "";
function check(name, ok, detail = "") {
  if (ok) passed.push(name); else failed.push(`${name}${detail ? ` -> ${detail}` : ""}`);
  console.log(`${ok ? "  PASS  " : "  FAIL  "}  ${name}${detail ? ` -> ${detail}` : ""}`);
}
async function call(method, url, body, expect = null) {
  const init = { method, headers: { cookie } };
  if (body !== undefined) { init.headers["content-type"] = "application/json"; init.body = JSON.stringify(body); }
  const res = await fetch(`${BASE}${url}`, init);
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { json = text; }
  if (expect !== null && res.status !== expect) throw new Error(`${method} ${url} expected ${expect} got ${res.status}: ${text.slice(0, 200)}`);
  return { status: res.status, body: json };
}
const { app, bootstrap } = createServer();
const server = app.listen(Number(process.env.PHONEZONE_PORT), "127.0.0.1");
await new Promise((r) => server.once("listening", r));

try {
  console.log(`\nFirst-setup suite  (data dir: ${DATA_DIR})\n`);
  const s0 = await call("GET", "/setup/status", undefined, 200);
  check("fresh: setup not complete", s0.body.setupCompleted === false);
  check("fresh: nothing required configured", s0.body.requiredConfigured === false);
  const c0 = await call("GET", "/config", undefined, 200);
  check("fresh: no PhoneZone in config", !/PhoneZone/.test(JSON.stringify(c0.body)));
  check("fresh: business name empty", c0.body.businessName === "");
  check("fresh: phone empty", c0.body.primaryPhone === "");
  check("fresh: address empty", c0.body.address === "");
  check("fresh: setup flag false", c0.body.setupCompleted === false);

  // A05: no account exists until the wizard runs, and no password is printed.
  check("startup created no admin", bootstrap.created === false, JSON.stringify(bootstrap));

  const businessA = {
    businessName: "Mobile World", businessTagline: "Your Town Mobiles", ownerName: "ABC Dealer",
    address: "12 Main Road, YourTown", primaryPhone: "9999999999", secondaryPhone: "8888888888",
    email: "mobile@yourtown.test", instagram: "@mobileworld", whatsappNumber: "9999999999",
    googleBusinessUrl: "https://g.page/mobileworld", udyamNumber: "UDYAM-XX-1234567",
    termsAndConditions: "1. No returns on sold phones.",
    invoicePrefixes: { purchase: "PUR", sale: "SL", return: "RET" }, currencyCode: "INR",
    businessHours: { monday: { open: "09:00", close: "18:00" } },
    password: "setup-pass-123",
  };
  check("setup writes business profile", (await call("POST", "/setup", businessA, 200)).body.setupCompleted === true);
  // The wizard's account is the one that can sign in - exactly one, and it is
  // never the old bootstrap account.
  const ownerLogin = await call("POST", "/auth/login", { email: businessA.email, password: businessA.password }, 200);
  check("wizard account can sign in", ownerLogin.body.user?.email === businessA.email);
  const ownerMe = await call("GET", "/auth/me", undefined, 200);
  check("wizard account is an admin", ownerMe.body.roles?.includes("admin") === true);
  const legacyBootstrap = await call("POST", "/auth/login", { email: "admin@phonezone.local", password: "whatever" });
  check("no legacy bootstrap account exists", legacyBootstrap.status === 401, `status ${legacyBootstrap.status}`);
  const cA = await call("GET", "/config", undefined, 200);
  check("homepage name = Mobile World", cA.body.businessName === "Mobile World");
  check("homepage phone configured", cA.body.primaryPhone === "9999999999");
  check("homepage instagram configured", cA.body.instagram === "@mobileworld");
  check("terms saved", cA.body.termsAndConditions.includes("No returns"));
  check("setup flag now true", cA.body.setupCompleted === true);

  const seller = (await call("POST", "/sellers", { name: "Test Seller", phone: "7777777777", address: "Seller St", id_proof_type: "aadhaar", id_number: "TEST123" }, 201)).body;
  const customer = (await call("POST", "/customers", { name: "Test Customer", phone: "6666666666", address: "Customer St", id_proof_type: "voter_id", id_number: "CUST001" }, 201)).body;
  const purchase = (await call("POST", "/purchases", { phone_name: "iPhone 13", model: "A2634", imei_number: "111111111111119", condition: "good", purchase_price: 40000, selling_price: 55000, purchase_date: "2026-01-01", payment_method: "cash", seller_id: seller.id }, 201)).body;
  check("purchase created", !!purchase);
  const phonesList = (await call("POST", "/pg/phones/select", { filters: [], order: { column: "created_at", ascending: false } }, 200)).body;
  const found = phonesList.find((p) => p.imei_number === "111111111111119");
  check("phones select returns nested seller", !!found?.sellers);
  check("seller name = Test Seller (not N/A)", found?.sellers?.name === "Test Seller");
  check("seller id number persisted", found?.sellers?.id_number === "TEST123");

  await call("POST", "/sales", { phone_id: found.id, customer_id: customer.id, sale_price: 55000, sold_date: "2026-02-01" });
  const phonesList2 = (await call("POST", "/pg/phones/select", { filters: [], order: { column: "created_at", ascending: false } }, 200)).body;
  const sold = phonesList2.find((p) => p.id === found.id);
  check("phones select returns nested customer", !!sold?.customers);
  check("customer name = Test Customer (not N/A)", sold?.customers?.name === "Test Customer");
  check("customer id number persisted", sold?.customers?.id_number === "CUST001");

  const invoicesList = (await call("POST", "/pg/invoices/select", { filters: [], order: { column: "invoice_type", ascending: false } }, 200)).body;
  const inv = invoicesList.find((i) => i.phone_id === found.id);
  check("invoices select nests phone+seller+customer", !!(inv?.phones && inv?.sellers && inv?.customers));

  const sellerHist = (await call("GET", `/sellers/${seller.id}/history`, undefined, 200)).body;
  check("seller history shows purchased phone", sellerHist.purchases?.some((p) => p.id === found.id));
  check("seller history totals correct", sellerHist.totalSpent === 40000);
  const custHist = (await call("GET", `/customers/${customer.id}/history`, undefined, 200)).body;
    check("customer history shows sold phone", custHist.purchases?.some((p) => p.id === found.id));

  const backup = (await call("POST", "/backups", undefined, 201)).body;
  check("backup created", !!backup.name);
  check("backup file written to disk", fs.existsSync(backup.file) && fs.statSync(backup.file).size > 0);
  let listing = "";
  try {
    // Relative path + cwd: GNU tar reads "C:/..." as a remote host spec.
    listing = execFileSync("tar", ["-tf", path.join("backups", backup.name)], { cwd: DATA_DIR, encoding: "utf8" });
  } catch (e) { console.log("  (tar listing unavailable:", e.message, ")"); }
  check("backup archive contains database", listing.includes("database/phonezone.db"));
  check("backup archive contains storage (media)", listing.includes("storage"));
  //__PART2__
} catch (err) {
  failed.push(`suite aborted: ${err.message}`);
  console.error(`\n  ERROR ${err.message}`);
} finally {
  server.close(); closeDatabase();
}
console.log(`\n${passed.length} passed, ${failed.length} failed\n`);
if (failed.length) { for (const f of failed) console.log(`  - ${f}`); process.exit(1); }
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log("First-setup suite green.\n");
