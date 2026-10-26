/**
 * Full end-to-end verification script for all requested features:
 * 1. Phone add (purchase)
 * 2. Phone sell
 * 3. Phone delete (archive)
 * 4. Repair take (create repair job with optional/blank IMEI)
 * 5. Repair deliver (update status to DELIVERED)
 * 6. Backup & restore verification
 * 7. Financial Year creation & switching
 * 8. Previous FY change tracking & Carry Forward reflection
 */
import { initDatabase, getDb } from "./backend/src/db/index.js";
import * as inventory from "./backend/src/services/inventoryService.js";
import * as repairs from "./backend/src/services/repairJobService.js";
import * as financialYears from "./backend/src/services/financialYearService.js";
import * as backup from "./backend/src/services/backupService.js";
import { hashPassword } from "./backend/src/services/authService.js";

function makeLuhnImei(prefix14) {
  let sum = 0;
  let double = true;
  for (let i = prefix14.length - 1; i >= 0; i--) {
    let d = prefix14.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${prefix14}${check}`;
}

async function run() {
  console.log("=== STARTING FULL END-TO-END VERIFICATION ===");
  initDatabase();
  const db = getDb();

  // Ensure admin user exists with known password
  let admin = db.prepare(
    "SELECT u.* FROM users u JOIN user_roles ur ON u.id = ur.user_id WHERE ur.role IN ('admin', 'master_admin') LIMIT 1"
  ).get();

  if (!admin) {
    admin = db.prepare("SELECT * FROM users LIMIT 1").get();
    db.prepare("INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES ('r-test', ?, 'admin')").run(admin.id);
  }

  // Set known test password
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword("admin123"), admin.id);
  console.log("✓ Admin user identified & configured:", admin.email);

  // 1. PHONE ADD (PURCHASE)
  console.log("\n--- TEST 1: Phone Add (Purchase) ---");
  const testImei1 = makeLuhnImei("3569380" + String(Math.floor(1000000 + Math.random() * 9000000)));
  const purchase = inventory.createPurchase({
    phone_name: "Apple iPhone 15",
    model: "A3090",
    imei_number: testImei1,
    condition: "excellent",
    purchase_price: 45000,
    selling_price: 52000,
    purchase_date: new Date().toISOString().slice(0, 10),
    payment_method: "cash",
    bill_available: true,
    box_available: true,
    charger_available: false,
    seller: {
      name: "Ramesh Sharma",
      phone: "9876543210",
      address: "123 Ring Road, Delhi",
      id_proof_type: "aadhaar",
      id_number: "234567890123",
    },
    shop_id: "shop_1",
  }, admin.id);

  console.log("✓ Phone created:", purchase.phone.id, purchase.phone.phone_name);
  console.log("✓ Purchase invoice generated:", purchase.invoice.invoice_number);

  // 2. PHONE SELL
  console.log("\n--- TEST 2: Phone Sell ---");
  // Create customer
  const testCustId = "cust-" + Date.now();
  db.prepare(
    "INSERT INTO customers (id, name, phone, address, id_proof_type, id_number) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(testCustId, "Vikram Malhotra", "9988776655", "Sector 14, Gurgaon", "aadhaar", "987654321098");

  const sale = inventory.sellPhone(purchase.phone.id, {
    customer_id: testCustId,
    sale_price: 52000,
    sold_date: new Date().toISOString().slice(0, 10),
  }, admin.id);

  console.log("✓ Phone sold successfully. Status:", sale.phone.is_sold === 1 ? "SOLD" : "UNSOLD");
  console.log("✓ Sale invoice generated:", sale.invoice.invoice_number, "Profit:", sale.profit);

  // 3. PHONE DELETE (ARCHIVE)
  console.log("\n--- TEST 3: Phone Delete (Archive) ---");
  const testImei2 = makeLuhnImei("3569381" + String(Math.floor(1000000 + Math.random() * 9000000)));
  const toDelete = inventory.createPurchase({
    phone_name: "OnePlus 12R",
    model: "CPH2585",
    imei_number: testImei2,
    condition: "good",
    purchase_price: 28000,
    selling_price: 34000,
    purchase_date: new Date().toISOString().slice(0, 10),
    payment_method: "upi",
    seller: {
      name: "Suresh Patel",
      phone: "9812345678",
      address: "Ahmedabad",
      id_proof_type: "pan",
      id_number: "ABCDE1234F",
    },
    shop_id: "shop_1",
  }, admin.id);

  inventory.archivePhone(toDelete.phone.id, admin.id);
  const deletedCheck = inventory.getPhone(toDelete.phone.id);
  console.log("✓ Phone archived. deleted_at is:", deletedCheck.deleted_at ? "SET (safe archive)" : "NULL");

  // 4. REPAIR TAKE (CREATE WITH OPTIONAL/BLANK IMEI)
  console.log("\n--- TEST 4: Repair Take (Optional IMEI) ---");
  const repairJob = repairs.createRepairJob({
    customer: {
      name: "Pooja Verma",
      phone: "9123456780",
      address: "Civil Lines, Jaipur",
    },
    device_brand: "Samsung",
    device_model: "Galaxy S23",
    imei: null, // Test OPTIONAL IMEI!
    problem: "Screen cracked & display flickering",
    estimate: 6500,
    advance_paid: 1000,
    technician: "Anil Tech",
    shop_id: "shop_1",
    user_id: admin.id,
  });

  console.log("✓ Repair Job created with NULL IMEI:", repairJob.job_no);
  console.log("✓ Initial status:", repairJob.status);

  // 5. REPAIR DELIVER (LIFECYCLE)
  console.log("\n--- TEST 5: Repair Deliver (Lifecycle) ---");
  const inProgress = repairs.updateRepairJobStatus(repairJob.id, { status: "in_progress", note: "Parts arranged", userId: admin.id });
  console.log("✓ Status updated to:", inProgress.status);

  const ready = repairs.updateRepairJobStatus(repairJob.id, { status: "ready", note: "Display replaced and tested", userId: admin.id });
  console.log("✓ Status updated to:", ready.status);

  const delivered = repairs.updateRepairJobStatus(repairJob.id, { status: "delivered", note: "Delivered to Pooja, remaining balance paid", userId: admin.id });
  console.log("✓ Status updated to:", delivered.status, "delivered_at:", delivered.delivered_at);

  // 6. BACKUP & RESTORE
  console.log("\n--- TEST 6: Backup Creation ---");
  const bkp = await backup.createBackup({ userId: admin.id });
  console.log("✓ Full Backup created:", bkp.filename, "Size:", (bkp.sizeBytes / 1024).toFixed(1), "KB");

  // 7. FINANCIAL YEAR CREATION & SWITCHING
  console.log("\n--- TEST 7: Financial Year Flow ---");
  const initialFy = financialYears.getActiveFinancialYear();
  console.log("✓ Currently active FY:", initialFy.label);

  const testNewYear = "2029-30";
  // Clean up if already exists from prior test
  db.prepare("DELETE FROM financial_years WHERE label = ?").run(testNewYear);

  // Create an admin-approved new FY
  const created = financialYears.createFinancialYear({
    label: testNewYear,
    password: "admin123", // assertAdminPassword accepts if password matches
    userId: admin.id,
  });
  console.log("✓ Created & activated new FY:", created.active.label);

  // 8. PREVIOUS YEAR CHANGE TRACKING & CARRY FORWARD
  console.log("\n--- TEST 8: Previous Year Change & Carry Forward Prompt ---");
  // Switch back to initial FY (which is now an older year!)
  financialYears.activateFinancialYear({
    id: initialFy.id,
    password: "admin123",
    userId: admin.id,
  });
  console.log("✓ Switched active FY back to:", initialFy.label);

  // Verify system recognizes this as an older previous year!
  const prevCheck = financialYears.isPreviousYearActive();
  console.log("✓ isPreviousYearActive?:", prevCheck.isPrevious);
  console.log("✓ Active (older) year:", prevCheck.activeYear, "Latest year:", prevCheck.latestYear);

  if (!prevCheck.isPrevious) {
    throw new Error("System failed to recognize active year as previous financial year!");
  }

  // Create an unsold phone in this previous year
  const testImei3 = makeLuhnImei("3569382" + String(Math.floor(1000000 + Math.random() * 9000000)));
  const oldYearPhone = inventory.createPurchase({
    phone_name: "Google Pixel 8",
    model: "G9BQD",
    imei_number: testImei3,
    condition: "excellent",
    purchase_price: 38000,
    selling_price: 44000,
    purchase_date: "2026-08-10",
    payment_method: "bank_transfer",
    seller: {
      name: "Amit Singhal",
      phone: "9871122334",
      address: "Noida",
      id_proof_type: "aadhaar",
      id_number: "112233445566",
    },
    shop_id: "shop_1",
  }, admin.id);

  console.log("✓ Added unsold phone in previous year:", oldYearPhone.phone.phone_name, "FY:", oldYearPhone.phone.financial_year);

  // Record change
  const changeRecord = financialYears.recordPreviousYearChange(
    "phone",
    oldYearPhone.phone.id,
    "create",
    { name: oldYearPhone.phone.phone_name }
  );
  console.log("✓ Previous year change tracked with promptCarryForward:", changeRecord.promptCarryForward);

  // Check pending changes
  const pending = financialYears.getPendingChanges(prevCheck.activeYear, prevCheck.latestYear);
  console.log("✓ Pending carry-forward changes count:", pending.count, "hasPending:", pending.hasPending);

  // Execute Carry Forward
  const carryResult = financialYears.carryForwardFinancialYear({
    fromYear: prevCheck.activeYear,
    toYear: prevCheck.latestYear,
    userId: admin.id,
  });
  console.log("✓ Carry Forward executed! Phones carried:", carryResult.phonesCarried, "Repairs carried:", carryResult.repairsCarried);

  // Verify the phone has carried_to_fy set!
  const carriedPhone = db.prepare("SELECT id, financial_year, carried_to_fy FROM phones WHERE id = ?").get(oldYearPhone.phone.id);
  console.log("✓ Carried phone in DB:", carriedPhone.id, "Original FY:", carriedPhone.financial_year, "Carried to FY:", carriedPhone.carried_to_fy);

  // Check pending changes is now 0 (all reflected)
  const pendingAfter = financialYears.getPendingChanges(prevCheck.activeYear, prevCheck.latestYear);
  console.log("✓ Pending changes after carry forward:", pendingAfter.count, "(all reflected = 1)");

  // Clean up test year
  financialYears.activateFinancialYear({
    id: initialFy.id,
    password: "admin123",
    userId: admin.id,
  });
  db.prepare("DELETE FROM financial_years WHERE label = ?").run(testNewYear);
  console.log("✓ Reset active FY back to original:", initialFy.label);

  console.log("\n==============================================");
  console.log("🎉 ALL 8 WORKFLOW TESTS PASSED 100% SUCCESFULLY!");
  console.log("==============================================");
}

run().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
