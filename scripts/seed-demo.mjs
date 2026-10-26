#!/usr/bin/env node
/**
 * PhoneZone SEED-DEMO - creates a throw-away demo database with FAKE data.
 *
 * Why: the owner's real folder contains customer Aadhaar photos, names and phone
 * numbers. Nobody should ever have to test against that. This script builds a
 * completely separate database under os.tmpdir() and fills it with invented
 * sellers, customers, phones (Luhn-VALID fake IMEIs), sales and - once the
 * repairs module exists - repair customers and jobs.
 *
 * It NEVER writes into data/ or data11/. Double-click SEED-DEMO.bat.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const BACKEND = path.join(ROOT, "backend", "src");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "phonezone-demo-"));
process.env.PHONEZONE_DATA_DIR = dataDir;
process.env.PHONEZONE_PORT = "47888";

const ADMIN = { email: "owner@demo.test", password: "demo-pass-123" };

/** All demo people and phones use clearly fake values (0000000000-style range). */
const SELLERS = [
  { name: "Ravi Demo", phone: "9111100001", address: "12 Demo Street", id_proof_type: "aadhaar", id_number: "DEMO-A-0001" },
  { name: "Sita Demo", phone: "9111100002", address: "48 Sample Road", id_proof_type: "pan", id_number: "DEMO-P-0002" },
  { name: "Imran Demo", phone: "9111100003", address: "7 Test Lane", id_proof_type: "voter_id", id_number: "DEMO-V-0003" },
  { name: "Neha Demo", phone: "9111100004", address: "99 Example Nagar", id_proof_type: "driving_license", id_number: "DEMO-D-0004" },
  { name: "Arjun Demo", phone: "9111100005", address: "3 Placeholder Colony", id_proof_type: "aadhaar", id_number: "DEMO-A-0005" },
];

const CUSTOMERS = [
  { name: "Kabir Demo", phone: "9222200001", address: "1 Buyer Street", id_proof_type: "aadhaar", id_number: "DEMO-C-0001" },
  { name: "Meera Demo", phone: "9222200002", address: "2 Buyer Street", id_proof_type: "pan", id_number: "DEMO-C-0002" },
  { name: "Yash Demo", phone: "9222200003", address: "3 Buyer Street", id_proof_type: "voter_id", id_number: "DEMO-C-0003" },
  { name: "Diya Demo", phone: "9222200004", address: "4 Buyer Street", id_proof_type: "aadhaar", id_number: "DEMO-C-0004" },
  { name: "Rohit Demo", phone: "9222200005", address: "5 Buyer Street", id_proof_type: "driving_license", id_number: "DEMO-C-0005" },
];

/**
 * Fake but Luhn-VALID IMEIs (each check digit was computed, not invented), so
 * the demo data passes the same server-side validation real data must pass.
 */
const IMEIS = [
  "490154203237518",
  "353967118612343",
  "352999085511233",
  "869123456789015",
  "351756051523027",
  "358240051111110",
];

const PHONES = [
  { phone_name: "Samsung Galaxy A54", model: "SM-A546E", condition: "excellent", purchase_price: 16500, selling_price: 19999, variant: "8GB / 128GB", colour: "Awesome Violet" },
  { phone_name: "Apple iPhone 13", model: "A2633", condition: "good", purchase_price: 38000, selling_price: 44999, variant: "128GB", colour: "Midnight" },
  { phone_name: "Xiaomi Redmi Note 12", model: "23021RAAEG", condition: "good", purchase_price: 8200, selling_price: 10999, variant: "6GB / 128GB", colour: "Onyx Gray" },
  { phone_name: "Oppo Reno 8", model: "CPH2359", condition: "excellent", purchase_price: 19500, selling_price: 23999, variant: "8GB / 256GB", colour: "Shimmer Gold" },
  { phone_name: "Vivo Y21", model: "V2111", condition: "fair", purchase_price: 5400, selling_price: 7499, variant: "4GB / 64GB", colour: "Diamond Glow" },
  { phone_name: "Realme Narzo 50", model: "RMX3286", condition: "good", purchase_price: 7100, selling_price: 9299, variant: "6GB / 128GB", colour: "Speed Blue" },
];

/* ------------------------------------------------------------------ */

// Import the real backend only after PHONEZONE_DATA_DIR points at the temp dir.
const { createServer } = await import(pathToFileURL(path.join(BACKEND, "server.js")).href);
const { closeDatabase, getDb } = await import(pathToFileURL(path.join(BACKEND, "db", "index.js")).href);

const { app } = createServer();
const server = app.listen(Number(process.env.PHONEZONE_PORT), "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const BASE = `http://127.0.0.1:${process.env.PHONEZONE_PORT}/api`;

let cookie = "";
async function api(method, url, body) {
  const headers = { cookie };
  let payload;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${url}`, { method, headers, body: payload });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await res.text();
  let parsed = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status, body: parsed };
}

const created = { sellers: 0, customers: 0, phones: 0, sales: 0, repairCustomers: 0, repairJobs: 0 };

try {
  console.log(`\n  Demo data is being written to: ${dataDir}\n`);

  // 1. First-run setup (the only way the owner account is created).
  const setup = await api("POST", "/setup", {
    businessName: "Demo Mobile Shop",
    businessTagline: "Sample data only",
    ownerName: "Demo Owner",
    address: "100 Demo Market Road",
    primaryPhone: "9000011111",
    email: ADMIN.email,
    password: ADMIN.password,
    invoicePrefixes: { purchase: "PUR", sale: "SAL", return: "RET" },
  });
  if (![200, 400].includes(setup.status)) throw new Error(`setup failed: ${setup.status}`);

  const login = await api("POST", "/auth/login", ADMIN);
  if (login.status !== 200) throw new Error(`login failed: ${login.status}`);

  // 2. Sellers + customers.
  const sellerIds = [];
  for (const seller of SELLERS) {
    const res = await api("POST", "/sellers", seller);
    if (res.status === 201) {
      sellerIds.push(res.body.id);
      created.sellers++;
    }
  }
  const customerIds = [];
  for (const customer of CUSTOMERS) {
    const res = await api("POST", "/customers", customer);
    if (res.status === 201) {
      customerIds.push(res.body.id);
      created.customers++;
    }
  }

  // 3. Phones, bought from the demo sellers.
  const phoneIds = [];
  for (let i = 0; i < PHONES.length; i++) {
    const res = await api("POST", "/purchases", {
      ...PHONES[i],
      imei_number: IMEIS[i % IMEIS.length],
      purchase_date: `2026-0${(i % 9) + 1}-1${i % 9}`,
      payment_method: i % 2 ? "upi" : "cash",
      bill_available: i % 2 === 0,
      box_available: i % 3 === 0,
      charger_available: true,
      features: ["4G", "Fingerprint"],
      seller_id: sellerIds[i % sellerIds.length],
    });
    if (res.status === 201) {
      phoneIds.push(res.body.phone.id);
      created.phones++;
    } else {
      console.log(`    (phone ${i + 1} skipped: ${res.body?.error || res.status})`);
    }
  }

  // 4. Sell the first two phones so the Sold / Accounting screens have data.
  for (let i = 0; i < Math.min(2, phoneIds.length); i++) {
    const res = await api("POST", "/sales", {
      phone_id: phoneIds[i],
      customer_id: customerIds[i % customerIds.length],
      sale_price: PHONES[i].selling_price,
      sold_date: `2026-0${i + 5}-15`,
    });
    if (res.status === 201) created.sales++;
  }

  // 5. Repairs (stage 2+). Skipped cleanly while the tables do not exist yet.
  const db = getDb();
  const hasRepairs =
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='repair_customers'").get() &&
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='repair_jobs'").get();

  if (hasRepairs) {
    const repairCustomers = [
      { name: "Anil Demo", phone: "9333300001", address: "9 Repair Street", id_proof_type: "aadhaar", id_number: "DEMO-R-0001" },
      { name: "Priya Demo", phone: "9333300002", address: "10 Repair Street", id_proof_type: "pan", id_number: "DEMO-R-0002" },
    ];
    const repairCustomerIds = [];
    for (const person of repairCustomers) {
      const res = await api("POST", "/repair/customers", person);
      if (res.status === 201) {
        repairCustomerIds.push(res.body.id);
        created.repairCustomers++;
      }
    }
    const jobs = [
      { problem: "Screen replacement", imei: IMEIS[0], estimate: 2500, advance_paid: 500, status: "in_progress" },
      { problem: "Battery replacement", imei: IMEIS[1], estimate: 1200, advance_paid: 200, status: "ready" },
      { problem: "Charging port repair", imei: IMEIS[2], estimate: 900, advance_paid: 0, status: "received" },
    ];
    for (let i = 0; i < jobs.length; i++) {
      const res = await api("POST", "/repair/jobs", {
        repair_customer_id: repairCustomerIds[i % repairCustomerIds.length],
        imei: jobs[i].imei,
        problem: jobs[i].problem,
        estimate: jobs[i].estimate,
        advance_paid: jobs[i].advance_paid,
        status: jobs[i].status,
      });
      if (res.status === 201) created.repairJobs++;
    }
  } else {
    console.log("    Repairs module not installed yet - skipped 2 repair customers and 3 jobs.");
  }

  console.log("  Demo data created:");
  console.log(`    sellers          : ${created.sellers}`);
  console.log(`    customers        : ${created.customers}`);
  console.log(`    phones           : ${created.phones}`);
  console.log(`    sales            : ${created.sales}`);
  console.log(`    repair customers : ${created.repairCustomers}`);
  console.log(`    repair jobs      : ${created.repairJobs}`);
  console.log("");
  console.log("  How to use it:");
  console.log("    set PHONEZONE_DATA_DIR to the folder printed above, then start the app.");
  console.log(`    Login: ${ADMIN.email}  /  ${ADMIN.password}`);
  console.log("");
  console.log("  Your real data in data\\ and data11\\ was NOT touched.");
  console.log("");
} catch (err) {
  console.error(`\n  Demo seeding stopped: ${err.message}\n`);
} finally {
  server.close();
  closeDatabase();
}
