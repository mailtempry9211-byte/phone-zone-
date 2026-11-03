import Database from "../backend/node_modules/better-sqlite3/lib/index.js";
import path from "path";
import os from "os";

const dbPath = path.join(os.homedir(), "AppData", "Roaming", "PhoneZone", "database", "phonezone.db");
const db = new Database(dbPath);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
console.log("TABLES:", tables.map(t => t.name));

console.log("\nINVOICES:");
console.table(db.prepare("SELECT id, invoice_number, invoice_type, amount, issued_at, shop_id, financial_year FROM invoices").all());

console.log("\nPHONES:");
console.table(db.prepare("SELECT id, phone_name, model, purchase_price, selling_price, is_sold, financial_year, created_at FROM phones").all());

console.log("\nREPAIRS:");
console.table(db.prepare("SELECT * FROM repairs").all());
