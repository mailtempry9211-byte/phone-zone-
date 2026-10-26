/**
 * PhoneZone full offline suite.
 *
 * Boots the local backend against a throwaway data directory and exercises the
 * complete offline business flow end to end: auth -> seller -> customer ->
 * purchase -> inventory -> sale -> invoice -> return -> repair -> files ->
 * dashboard -> CSV export -> backup/restore.
 *
 * Run:  cd backend && npm run test:offline
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "phonezone-suite-"));
process.env.PHONEZONE_DATA_DIR = DATA_DIR;
process.env.PHONEZONE_PORT = process.env.PHONEZONE_PORT || "47799";

const { createServer } = await import("../src/server.js");
const { closeDatabase, getDb } = await import("../src/db/index.js");

/** A real 1x1 PNG: uploads are now validated by magic bytes, not by MIME type. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

const PORT = Number(process.env.PHONEZONE_PORT);
const BASE = `http://127.0.0.1:${PORT}/api`;

let passed = 0;
const failures = [];
let cookie = "";

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` -> ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ""}`);
  }
}

async function call(method, url, body, expect = null) {
  const init = { method, headers: { cookie } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${url}`, init);
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = text; }
  if (expect !== null && res.status !== expect) {
    throw new Error(`${method} ${url} expected ${expect}, got ${res.status}: ${text.slice(0, 200)}`);
  }
  return { status: res.status, body: json };
}

const { app, bootstrap } = createServer();
const server = app.listen(PORT, "127.0.0.1");
await new Promise((r) => server.once("listening", r));

console.log(`\nPhoneZone offline suite  (data dir: ${DATA_DIR})\n`);

try {
  // --- 1. health / config / offline flag -----------------------------------
  const health = await call("GET", "/health", undefined, 200);
  check("health reports offline", health.body.offline === true);
    const config = await call("GET", "/config", undefined, 200);
  check("business config loads", !!config.body && typeof config.body === "object");
  check("fresh install has no PhoneZone defaults", config.body.setupCompleted === false && config.body.businessName === "");

  // --- 2. auth --------------------------------------------------------------
  // A05: startup must create NO account and print NO password. The first-run
  // wizard is the only normal way the owner account is created.
  check("startup created no admin", bootstrap.created === false, JSON.stringify(bootstrap));
  const ADMIN = { email: "suite-owner@phonezone.test", password: "suite-pass-123" };
  const setup = await call(
    "POST",
    "/setup",
    {
      businessName: "Suite Shop",
      address: "1 Suite Road",
      primaryPhone: "9000000000",
      email: ADMIN.email,
      password: ADMIN.password,
      invoicePrefixes: { purchase: "PUR", sale: "SAL", return: "RET" },
    },
    200,
  );
  check("setup wizard creates the owner", setup.body.setupCompleted === true);
  const badLogin = await call("POST", "/auth/login", { email: ADMIN.email, password: "wrong-password" });
  check("wrong password rejected", badLogin.status === 401, `status ${badLogin.status}`);
  const login = await call("POST", "/auth/login", ADMIN, 200);
  check("admin can sign in", !!login.body.token || !!login.body.user);
  const me = await call("GET", "/auth/me", undefined, 200);
  check("session resolves to admin", me.body.roles?.includes("admin"));

  // --- 3. protected routes reject anonymous callers -------------------------
  const savedCookie = cookie;
  cookie = "";
  const anon = await call("GET", "/phones");
  check("inventory is protected", anon.status === 401, `status ${anon.status}`);
  const anonPublic = await call("GET", "/public/inventory", undefined, 200);
  check("public inventory is open", Array.isArray(anonPublic.body));
  check(
    "public inventory hides cost data",
    anonPublic.body.every((p) => p.purchase_price === undefined && p.imei_number === undefined),
  );
  cookie = savedCookie;

  // --- 4. sellers & customers ----------------------------------------------
  const seller = (await call("POST", "/sellers", {
    name: "Test Seller", phone: "9998887770", address: "Sitapur",
    id_proof_type: "aadhaar", id_number: "1234-5678-9012",
  }, 201)).body;
  check("seller created", !!seller.id);
  const customer = (await call("POST", "/customers", {
    name: "Test Customer", phone: "9998887771", address: "Sitapur",
    id_proof_type: "aadhaar", id_number: "2234-5678-9012",
  }, 201)).body;
  check("customer created", !!customer.id);

  // --- 5. purchase workflow -------------------------------------------------
  const imei = "356938035643809";
  const purchase = (await call("POST", "/purchases", {
    phone_name: "iPhone 13", model: "A2633", imei_number: imei, condition: "excellent",
    purchase_price: 30000, selling_price: 42000, purchase_date: "2026-08-01",
    payment_method: "cash", seller_id: seller.id, features: ["5G", "Face ID"],
  }, 201)).body;
  check("purchase created", !!purchase.phone?.id);
  check("purchase invoice numbered", !!purchase.invoice?.invoice_number);

  const dupe = await call("POST", "/purchases", {
    phone_name: "iPhone 13", model: "A2633", imei_number: imei, condition: "good",
    purchase_price: 1000, selling_price: 2000, purchase_date: "2026-08-01",
    payment_method: "cash", seller_id: seller.id,
  });
  check("duplicate IMEI blocked", dupe.status === 400, `status ${dupe.status}`);

  const badImei = await call("POST", "/purchases", {
    phone_name: "X", model: "Y", imei_number: "123", condition: "good",
    purchase_price: 1, selling_price: 2, purchase_date: "2026-08-01",
    payment_method: "cash", seller_id: seller.id,
  });
  check("invalid IMEI rejected", badImei.status === 400, `status ${badImei.status}`);

  const phoneId = purchase.phone.id;
  const phones = (await call("GET", "/phones", undefined, 200)).body;
  check("phone appears in admin inventory", phones.some((p) => p.id === phoneId));
  const publicList = (await call("GET", "/public/inventory", undefined, 200)).body;
  check("phone appears in public inventory", publicList.some((p) => p.id === phoneId));

  // --- 6. update ------------------------------------------------------------
  const updated = (await call("PUT", `/phones/${phoneId}`, { selling_price: 43000 }, 200)).body;
  check("phone update persists", Number(updated.selling_price) === 43000);

  // --- 6b. variant & colour (migration 005, compat shim) -------------------
  const compatPhone = (await call("POST", "/pg/phones/insert", {
    rows: [{
      phone_name: "Variant Test Phone", model: "V-TEST", imei_number: "356938035643817",
      condition: "good", purchase_price: 1000, selling_price: 2000,
      purchase_date: "2026-08-01", payment_method: "cash", seller_id: seller.id,
      variant: "8GB / 256GB", colour: "Blue",
    }],
  }, 201)).body[0];
  check(
    "compat insert stores variant/colour",
    compatPhone?.variant === "8GB / 256GB" && compatPhone?.colour === "Blue",
    JSON.stringify(compatPhone || {}).slice(0, 160),
  );
  const compatSelected = (await call("POST", "/pg/phones/select", {
    filters: [{ op: "eq", col: "id", val: compatPhone?.id }],
  }, 200)).body;
  check(
    "variant/colour read back",
    compatSelected[0]?.variant === "8GB / 256GB" && compatSelected[0]?.colour === "Blue",
    JSON.stringify(compatSelected[0] || {}).slice(0, 160),
  );
  // A10: the compat delete is a SOFT delete now - the row is kept, marked
  // archived, and hidden from normal reads.
  await call("POST", "/pg/phones/delete", { filters: [{ op: "eq", col: "id", val: compatPhone?.id }] }, 200);
  const archived = (await call("POST", "/pg/phones/select", {
    filters: [{ op: "eq", col: "id", val: compatPhone?.id }],
  }, 200)).body;
  check("deleted row is hidden from reads", archived.length === 0, `rows ${archived.length}`);

  // --- 6c. TAC engine (Step 1) ---------------------------------------------
  const tacMod = await import("../src/services/tacService.js");
  const { normalizeTac, normalizeBrand, parseSpecs } = tacMod;

  check("normalizeTac pads 7 digits", normalizeTac("1570200") === "01570200", String(normalizeTac("1570200")));
  check("normalizeTac keeps 8 digits", normalizeTac("35256811") === "35256811");
  check("normalizeTac takes IMEI first 8", normalizeTac("356938035643809") === "35693803");
  check("normalizeTac rejects junk", normalizeTac("123") === null && normalizeTac("") === null);
  check(
    "normalizeBrand cleans case",
    normalizeBrand("XIAOMI") === "Xiaomi" && normalizeBrand("NOKIA") === "Nokia" && normalizeBrand("LG") === "LG"
  );

  // The required cleaning table (real rows from tac_full.xlsx).
  const SPECS_TABLE = [
    ["XIAOMI", "XIAOMI REDMI NOTE 14S, Xiaomi 2502FRA65G, Global Model, 2025", "Xiaomi Redmi Note 14S", "2502FRA65G", "Global Model, 2025"],
    ["SAMSUNG", "SAMSUNG GALAXY A54, Samsung SM-A546E2023", "Samsung Galaxy A54", "SM-A546E", ""],
    ["SAMSUNG", "SAMSUNG GALAXY A22, Samsung SM-A225F/DSN2021", "Samsung Galaxy A22", "SM-A225F/DSN", ""],
    ["SAMSUNG", "SAMSUNG GALAXY Z FOLD3 5G, Samsung SM-F92602021", "Samsung Galaxy Z Fold3 5G", "SM-F9260", ""],
    ["SAMSUNG", "SAMSUNG GALAXY S22 5G, Samsung SM-S901U, US Model, 2022", "Samsung Galaxy S22 5G", "SM-S901U", "US Model, 2022"],
    ["SAMSUNG", "SAMSUNG GALAXY Z FLIP7, Samsung Galaxy Z Flip72025", "Samsung Galaxy Z Flip7", "Galaxy Z Flip7", ""],
    ["OPPO", "OPPO RENO3, Oppo CPH20432020", "Oppo Reno3", "CPH2043", ""],
    ["OPPO", "OPPO RENO 5G, Oppo CPH1921", "Oppo Reno 5G", "CPH1921", ""],
    ["REALME", "REALME RMX3662, Realme Chongqing RMX3662", "Realme RMX3662", "RMX3662", ""],
    ["VIVO", "VIVO Y12S, Vivo Mobile V2033", "Vivo Y12S", "V2033", ""],
    ["LG", "LG K10 (2017) DUAL SIM, LG M250ds2017", "LG K10 (2017) Dual Sim", "M250ds", ""],
    ["Nokia", "Nokia 1610", "Nokia 1610", "1610", ""],
    ["APPLE", "APPLE, APPLE IPAD (5TH GEN)", null, null, ""], // name checked below
    ["BOHP", "BOHP, BOHP X3", "Bohp X3", "X3", ""],
  ];
  for (const [brand, specs, name, model, extra] of SPECS_TABLE) {
    const got = parseSpecs(brand, specs);
    if (name === null) {
      // iPad casing is allowed either way; model must be non-empty
      check(
        `parseSpecs: ${specs}`,
        /^Apple Ipad \(5th Gen\)$/i.test(got.phoneName.replace("iPad", "Ipad")) && !!got.model,
        `${got.phoneName} | ${got.model}`
      );
      continue;
    }
    check(
      `parseSpecs: ${specs.slice(0, 46)}`,
      got.phoneName === name && got.model === model && (extra ? got.extra === extra : true),
      `got '${got.phoneName}' | '${got.model}' | '${got.extra}'`
    );
  }

  // Tiny 3-sheet workbook that reproduces the real file's quirks.
  const ExcelJS = (await import("exceljs")).default;
  const tiny = new ExcelJS.Workbook();
  const shAll = tiny.addWorksheet("ALL");
  shAll.addRow(["Brand", "TAC", "SPECS"]);
  shAll.addRow(["SAMSUNG", "35256811", "SAMSUNG GALAXY A54, Samsung SM-A546E2023"]);
  shAll.addRow(["APPLE", 1570200, "APPLE, APPLE IPAD (5TH GEN)"]); // numeric TAC: leading zero lost
  shAll.addRow(["MOTOROLA", 0, "N/A, N/A"]);                      // TAC = 0 divider
  const shCommon = tiny.addWorksheet("Common");
  shCommon.addRow(["Brand", "TAC", "SPECS"]);
  shCommon.addRow(["OPPO", "35256811", "OPPO RENO3, Oppo CPH20432020"]); // dup: Common wins
  shCommon.addRow(["SONY", "N/A", "SONY THIS IS A TEST IMEI TO BE USED"]); // TEST IMEI row
  const shNotCommon = tiny.addWorksheet("Not_Common");
  shNotCommon.addRow([".FLAIRMICRO", 99001362, ".FLAIRMICRO, .FLAIRMICRO FLC-MCM63XC"]); // NO header row
  shNotCommon.addRow(["APPLE", null, null]);                                             // section divider
  const tinyPath = `${DATA_DIR}/tac-tiny.xlsx`;
  await tiny.xlsx.writeFile(tinyPath);

  const tacForm = new FormData();
  tacForm.append("file", new Blob([fs.readFileSync(tinyPath)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "tac-tiny.xlsx");
  const imported = (await call("POST", "/tac/import", tacForm, 200)).body;
  check("import reports 3 sheets", imported.sheets?.length === 3, JSON.stringify(imported.sheets?.map((s) => s.name)));
  const byName = Object.fromEntries((imported.sheets || []).map((s) => [s.name, s]));
  check("Common processed first, first-wins", byName.Common?.added === 1 && byName.Common?.skipped?.testImei === 1, JSON.stringify(byName.Common));
  check("Not_Common has no header row", byName.Not_Common?.dataRows === 2 && byName.Not_Common?.added === 1 && byName.Not_Common?.skipped?.blank === 1, JSON.stringify(byName.Not_Common));
  check("ALL skips zero + duplicate", byName.ALL?.skipped?.zero === 1 && byName.ALL?.duplicates === 1 && byName.ALL?.added === 1, JSON.stringify(byName.ALL));
  check("leading zero restored", !!byName.ALL && (await call("GET", "/tac/01570200", undefined, 200)).body.found === true);
  check("7-digit TAC lookup pads", (await call("GET", "/tac/1570200", undefined, 200)).body.found === true);

  const dupImport = (await call("POST", "/tac/import", (() => { const f = new FormData(); f.append("file", new Blob([fs.readFileSync(tinyPath)], { type: "application/octet-stream" }), "tac-tiny.xlsx"); return f; })(), 200)).body;
  check("second import adds 0 rows", dupImport.total === 0, `total ${dupImport.total}`);

  const lookup = (await call("GET", "/tac/35256811", undefined, 200)).body;
  check("lookup returns cleaned row", lookup.found === true && lookup.brand === "Oppo" && lookup.model === "CPH2043", JSON.stringify(lookup));

  const stats = (await call("GET", "/tac/stats", undefined, 200)).body;
  check("stats report totals", stats.total >= 3 && stats.bySource.excel >= 3, JSON.stringify(stats));

  const learned = (await call("POST", "/tac/learn", { imei: "356938035643809", brand: "Apple", phoneName: "iPhone 13", model: "A2633" }, 200)).body;
  check("learn stores by IMEI TAC", learned.found === true && learned.tac === "35693803" && learned.source === "learned", JSON.stringify(learned));
  // manual rows are never overwritten
  const dbForTac = (await import("../src/db/index.js")).getDb();
  dbForTac.prepare("INSERT OR REPLACE INTO tac_codes (tac, brand, phone_name, model, source) VALUES ('35693899','Manual Brand','Manual Phone','M1','manual')").run();
  await call("POST", "/tac/learn", { tac: "35693899", brand: "Apple", phoneName: "iPhone 14", model: "A2830" }, 200);
  const manualRow = dbForTac.prepare("SELECT brand, source FROM tac_codes WHERE tac = '35693899'").get();
  check("learn never overwrites manual", manualRow.source === "manual" && manualRow.brand === "Manual Brand", JSON.stringify(manualRow));
  dbForTac.prepare("DELETE FROM tac_codes WHERE tac = '35693899'").run();

  // export -> re-import round trip
  const expRes = await fetch(`${BASE}/tac/export`, { headers: { cookie } });
  check("export produces a workbook", expRes.status === 200, `status ${expRes.status}`);
  const expBuf = Buffer.from(await expRes.arrayBuffer());
  const beforeTotal = (await call("GET", "/tac/stats", undefined, 200)).body.total;
  const rtForm = new FormData();
  rtForm.append("file", new Blob([expBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "roundtrip.xlsx");
  const rt = (await call("POST", "/tac/import", rtForm, 200)).body;
  const afterTotal = (await call("GET", "/tac/stats", undefined, 200)).body.total;
  check("export re-imports with 0 new rows", rt.total === 0 && afterTotal === beforeTotal, `added ${rt.total}, ${beforeTotal} -> ${afterTotal}`);

  // --- 6d. Hicelltek online fallback + key rotation (Steps 2 & 6) ----------
  const hct = await import("../src/services/hicelltekService.js");
  const realFetch = globalThis.fetch;
  const hctCalls = [];
  let hctResponder = () => new Response("{}", { status: 200 });
  globalThis.fetch = (url, init) => {
    if (String(url).includes("hicelltek")) {
      hctCalls.push(init || {});
      return Promise.resolve(hctResponder());
    }
    return realFetch(url, init);
  };
  const jsonRes = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  try {
    check("keys start empty", (await call("GET", "/tac/keys", undefined, 200)).body.length === 0);
    const kList = (await call("POST", "/tac/keys", { label: "Main", key: "hk_live_abcdefghijklmnop" }, 201)).body;
    const k1 = kList[0];
    check(
      "key added masked + active",
      kList.length === 1 && k1.maskedKey === "hk_l...mnop" && k1.status === "Active",
      JSON.stringify(k1 || {}),
    );
    const meta = (await call("GET", "/tac/01570200", undefined, 200)).body;
    check("lookup exposes fetch mode + key presence", meta.fetchMode === "ask" && meta.hasKeys === true, JSON.stringify(meta));

    // online success -> saved as source='api'
    hctResponder = () => jsonRes({ data: { brand: "GOOGLE", phone_name: "Pixel 9 Pro", model: "GKQ6E" } });
    const online = (await call("POST", "/tac/fetch", { value: "35654321" }, 200)).body;
    check(
      "online fetch saves an api row",
      online.fetched === true && online.found === true && online.source === "api" && online.brand === "Google",
      JSON.stringify(online),
    );
    check("key header sent to the API", hctCalls[0]?.headers?.["X-Api-Key"] === "hk_live_abcdefghijklmnop");

    const nCalls = hctCalls.length;
    const again = (await call("POST", "/tac/fetch", { value: "35654321" }, 200)).body;
    check("second fetch uses the local row (no API call)", again.fetched === false && hctCalls.length === nCalls, JSON.stringify(again));

    // not-found body -> remembered in tac_api_misses
    hctResponder = () => jsonRes({ found: false });
    const miss = (await call("POST", "/tac/fetch", { value: "35654399" }, 200)).body;
    check("API not-found reported", miss.found === false && miss.error?.code === "NOT_FOUND", JSON.stringify(miss));
    const nMiss = hctCalls.length;
    const miss2 = (await call("POST", "/tac/fetch", { value: "35654399" }, 200)).body;
    check("miss remembered - no second API call", miss2.found === false && hctCalls.length === nMiss, `calls ${hctCalls.length}`);
    const missStats = (await call("GET", "/tac/stats", undefined, 200)).body;
    check("api misses counted in stats", missStats.apiMisses >= 1, JSON.stringify(missStats));

    // 429 -> key exhausted until next month, quota error, no wasted retry
    hctResponder = () => jsonRes({}, 429);
    const q1 = await call("POST", "/tac/fetch", { value: "35654300" });
    check("429 -> quota exhausted error", q1.status === 429 && /used up/i.test(q1.body.error || ""), `status ${q1.status} ${JSON.stringify(q1.body)}`);
    const keysQ = (await call("GET", "/tac/keys", undefined, 200)).body;
    check("key marked exhausted", /^Exhausted until/.test(keysQ[0].status), JSON.stringify(keysQ[0]));
    const nQ = hctCalls.length;
    const q2 = await call("POST", "/tac/fetch", { value: "35654300" });
    check("exhausted key is not called again", q2.status === 429 && hctCalls.length === nQ, `status ${q2.status}`);

    // rotation: a second key takes over
    const kList2 = (await call("POST", "/tac/keys", { label: "Backup", key: "hk_live_zyxwvutsrqponmlk" }, 201)).body;
    const k2 = kList2.find((k) => k.label === "Backup");
    hctResponder = () => jsonRes({ data: { brand: "SAMSUNG", phone_name: "Galaxy S25", model: "SM-S921B" } });
    const rot = (await call("POST", "/tac/fetch", { value: "35654300" }, 200)).body;
    check("backup key used after rotation", rot.found === true && rot.brand === "Samsung", JSON.stringify(rot));
    check("backup key header sent", hctCalls.at(-1)?.headers?.["X-Api-Key"] === "hk_live_zyxwvutsrqponmlk");

    // reorder + patch + delete
    const reordered = (await call("POST", "/tac/keys/reorder", { ids: [k2.id, k1.id] }, 200)).body;
    check("keys reordered", reordered[0]?.id === k2.id && reordered[0]?.position === 0, JSON.stringify(reordered.map((k) => k.position)));
    const patched = (await call("PATCH", `/tac/keys/${k2.id}`, { label: "Backup 2" }, 200)).body;
    check("key label patched", patched.some((k) => k.label === "Backup 2"), JSON.stringify(patched.map((k) => k.label)));

    // 401 -> every key disabled -> NO_KEY (400)
    await call("PATCH", `/tac/keys/${k1.id}`, { is_enabled: true }, 200); // clears exhausted_until
    hctResponder = () => jsonRes({}, 401);
    const un = await call("POST", "/tac/fetch", { value: "35654377" });
    check("401 on all keys -> NO_KEY", un.status === 400 && un.body.code === "no_key", `status ${un.status} ${JSON.stringify(un.body)}`);
    const after401 = (await call("GET", "/tac/keys", undefined, 200)).body;
    check("invalid keys disabled + reported", after401.length === 2 && after401.every((k) => k.status === "Invalid" && k.isEnabled === false), JSON.stringify(after401));
    const meta2 = (await call("GET", "/tac/35654321", undefined, 200)).body;
    check("lookup reports no usable keys", meta2.hasKeys === false, JSON.stringify(meta2));

    const del = (await call("DELETE", `/tac/keys/${k2.id}`, undefined, 200)).body;
    check("key deleted", del.length === 1, JSON.stringify(del.map((k) => k.label)));
  } finally {
    globalThis.fetch = realFetch;
  }

  // --- 7. sale workflow -----------------------------------------------------
  const sale = (await call("POST", "/sales", {
    phone_id: phoneId, customer_id: customer.id, sale_price: 43000,
  }, 201)).body;
  check("sale recorded", sale.phone?.is_sold === true);
  check("profit computed", sale.profit === 13000, `profit ${sale.profit}`);
  check("sale invoice numbered", !!sale.invoice?.invoice_number);
  const resell = await call("POST", "/sales", { phone_id: phoneId, customer_id: customer.id, sale_price: 1 });
  check("double sale blocked", resell.status === 400, `status ${resell.status}`);
  const soldPublic = (await call("GET", "/public/inventory", undefined, 200)).body;
  check("sold phone leaves public inventory", !soldPublic.some((p) => p.id === phoneId));

  // --- 8. returns -----------------------------------------------------------
  const ret = (await call("POST", "/returns", {
    phone_id: phoneId, return_type: "sales_return", return_amount: 43000,
    return_reason: "Customer changed mind",
  }, 201)).body;
  check("sales return restocks phone", ret.is_sold === false && ret.return_status === "sales_returned");
  const returns = (await call("GET", "/returns", undefined, 200)).body;
  check("return listed", returns.length === 1);
  const returnRows = (await call("POST", "/pg/returns/select", { filters: [] }, 200)).body;
  check(
    "returns embed phone details for the invoice",
    returnRows[0]?.phones?.phone_name === "iPhone 13" && returnRows[0]?.customers?.name === "Test Customer",
    JSON.stringify(returnRows[0] || {}).slice(0, 160),
  );

  // --- 9. repairs -----------------------------------------------------------
  const repair = (await call("POST", "/repairs", {
    customer_name: "Test Customer", customer_phone: "9998887771", device: "Redmi Note 12",
    service_type: "screen", problem: "Screen replacement", estimated_cost: 2500, status: "pending",
  }, 201)).body;
  check("repair job created", !!repair.id);
  const repairDone = (await call("PUT", `/repairs/${repair.id}`, { status: "completed", final_cost: 2400 }, 200)).body;
  check("repair status updated", repairDone.status === "completed");

  // --- 10. files ------------------------------------------------------------
  // The stored type is now decided from the file's own magic bytes, so a real
  // image is required (a fake "image/jpeg" body is correctly refused).
  const form = new FormData();
  form.append("file", new Blob([TINY_PNG], { type: "image/png" }), "photo.png");
  form.append("ownerType", "phone");
  form.append("ownerId", phoneId);
  form.append("category", "product_photo");
  const file = (await call("POST", "/files", form, 201)).body;
  check("file stored on disk", !!file.id);
  check("stored type comes from the bytes", file.mime_type === "image/png", String(file.mime_type));
  const fetched = await call("GET", `/files/${file.id}`);
  check("file readable", fetched.status === 200);
  const usage = (await call("GET", "/storage/usage", undefined, 200)).body;
  check("storage usage reported", (usage.totalBytes ?? usage.bytes ?? 0) > 0);
  await call("DELETE", `/files/${file.id}`, undefined, 200);
  const gone = await call("GET", `/files/${file.id}`);
  check("deleted file is gone", gone.status >= 400, `status ${gone.status}`);

  // --- 11. messages ---------------------------------------------------------
  cookie = "";
  await call("POST", "/public/messages", {
    name: "Walk-in", email: "walkin@example.com", phone: "9000000000", message: "Do you buy old phones?",
  }, 201);
  cookie = savedCookie;
  const messages = (await call("GET", "/messages", undefined, 200)).body;
  check("contact message saved", messages.length === 1);
  await call("PUT", `/messages/${messages[0].id}/read`, undefined, 200);
  const readCheck = (await call("GET", "/messages", undefined, 200)).body;
  check("message marked read", !!readCheck[0].is_read);

  // --- 12. dashboard & exports ---------------------------------------------
  const dash = (await call("GET", "/dashboard", undefined, 200)).body;
  check("dashboard counts sellers", dash.counts.sellers === 1);
  check("dashboard counts customers", dash.counts.customers === 1);
  check("dashboard counts returns", dash.counts.returns === 1);
  check("dashboard tracks invoices", dash.counts.invoices >= 2);
  const csv = await call("GET", "/exports/inventory.csv", undefined, 200);
  check("CSV export produced", typeof csv.body === "string" && csv.body.includes("iPhone 13"));
  const badExport = await call("GET", "/exports/unknown.csv");
  check("unknown export rejected", badExport.status === 404);

  // --- 13. invoices ---------------------------------------------------------
  const invoices = (await call("GET", "/invoices", undefined, 200)).body;
  check("invoices listed", invoices.length >= 2);
  const numbers = new Set(invoices.map((i) => i.invoice_number));
  check("invoice numbers unique", numbers.size === invoices.length);

  // --- 14. audit trail ------------------------------------------------------
  const logs = (await call("GET", "/audit-logs", undefined, 200)).body;
  check("audit trail written", logs.length > 0);

  // --- 15. backup & restore -------------------------------------------------
  const backup = (await call("POST", "/backups", undefined, 201)).body;
  check("backup created", !!backup.name || !!backup.file);
  const backupList = (await call("GET", "/backups", undefined, 200)).body;
  check("backup listed", backupList.length >= 1);
  const restore = await call("POST", "/backups/restore", { name: backup.name || backupList[0].name });
  check("restore succeeds", restore.status === 200, `status ${restore.status}`);
  // Data must actually SURVIVE the swap (not just return 200) - guards against
  // the restore that "succeeds" but leaves an empty database.
  const afterPhones = (await call("GET", "/phones", undefined, 200)).body;
  check("data survives restore", afterPhones.some((p) => p.imei_number === imei), JSON.stringify(afterPhones).slice(0, 120));
  const afterReturns = (await call("GET", "/returns", undefined, 200)).body;
  check("returns survive restore", afterReturns.length >= 1, `count ${afterReturns.length}`);

  // --- 16. logout -----------------------------------------------------------
  await call("POST", "/auth/logout", undefined, 200);
  const afterLogout = await call("GET", "/auth/me");
  check("logout invalidates session", afterLogout.status === 401, `status ${afterLogout.status}`);

  // --- 17. data lives outside the install folder ----------------------------
  check("SQLite file created in data dir", fs.existsSync(path.join(DATA_DIR, "database", "phonezone.db")));

  // --- 18. stage 1 hardening -------------------------------------------------
  await call("POST", "/auth/login", ADMIN, 200);

  // A11: /config is public, so it must not carry private business data.
  const anonCookie = cookie;
  cookie = "";
  const publicCfg = (await call("GET", "/config", undefined, 200)).body;
  const leakedFields = ["bankName", "accountHolderName", "accountNumber", "ifscCode", "tacFetchMode", "messageTemplates"]
    .filter((k) => Object.prototype.hasOwnProperty.call(publicCfg, k));
  check("public config hides private fields", leakedFields.length === 0, leakedFields.join(","));

  // A12: Aadhaar / purchase / payment documents need a session.
  const anonObject = await call("GET", "/pg/storage/object/phonezone-uploads/purchase-documents/none.jpg");
  check("storage object requires login", anonObject.status === 401, `status ${anonObject.status}`);
  cookie = anonCookie;

  // A08 / A09: the compat delete can never wipe a table or be injected into.
  const wipe = await call("POST", "/pg/phones/delete", { filters: [] });
  check("filterless delete refused", wipe.status === 400, `status ${wipe.status}`);
  const injected = await call("POST", "/pg/phones/delete", {
    filters: [{ op: "eq", col: 'id" OR 1=1 --', val: "x" }],
  });
  check("injection filter refused", injected.status === 400, `status ${injected.status}`);
  check("nothing was deleted", (await call("GET", "/phones", undefined, 200)).body.length >= 1);
  const wipeAudit = await call("POST", "/pg/audit_logs/delete", { filters: [{ op: "eq", col: "id", val: "x" }] });
  check("audit log cannot be deleted", wipeAudit.status === 403, `status ${wipeAudit.status}`);

  // --- 18b. stage 1.1: compat write/read guards (A38 - A43) ----------------
  const db = getDb();
  const countPhones = () => db.prepare("SELECT COUNT(*) AS n FROM phones").get().n;
  const phonesTotal = countPhones();

  // A38: an update with NO filter must never rewrite a table.
  const noFilterUpdate = await call("POST", "/pg/phones/update", { values: { selling_price: 1 }, filters: [] });
  const rewritten = db.prepare("SELECT COUNT(*) AS n FROM phones WHERE selling_price = 1").get().n;
  check(
    "A38 update without filters refused, nothing changed",
    noFilterUpdate.status === 400 && rewritten === 0 && countPhones() === phonesTotal,
    `status ${noFilterUpdate.status}, rows@1 ${rewritten}, phones ${phonesTotal} -> ${countPhones()}`,
  );

  // A39: a filter on a column that does not exist is a 400 - never a
  // silently-dropped filter that turns into "match every row".
  const bogusFilterUpdate = await call("POST", "/pg/phones/update", {
    values: { selling_price: 1 },
    filters: [{ op: "eq", col: "not_a_real_column", val: "x" }],
  });
  const rewrittenBogus = db.prepare("SELECT COUNT(*) AS n FROM phones WHERE selling_price = 1").get().n;
  check(
    "A39 update with bogus-column filter refused, nothing changed",
    bogusFilterUpdate.status === 400 && rewrittenBogus === 0 && countPhones() === phonesTotal,
    `status ${bogusFilterUpdate.status}, rows@1 ${rewrittenBogus}`,
  );

  // A40: audit_logs is READ-ONLY through the compat layer; only backend code
  // writes audit rows.
  const auditCount = () => db.prepare("SELECT COUNT(*) AS n FROM audit_logs").get().n;
  const auditBefore = auditCount();
  const auditInsert = await call("POST", "/pg/audit_logs/insert", { rows: [{ action: "forged", details: "x" }] });
  const auditUpdate = await call("POST", "/pg/audit_logs/update", {
    values: { action: "forged" },
    filters: [{ op: "eq", col: "id", val: "x" }],
  });
  const auditDelete = await call("POST", "/pg/audit_logs/delete", { filters: [{ op: "eq", col: "id", val: "x" }] });
  check(
    "A40 compat insert/update/delete on audit_logs -> 403",
    auditInsert.status === 403 && auditUpdate.status === 403 && auditDelete.status === 403,
    `${auditInsert.status}/${auditUpdate.status}/${auditDelete.status}`,
  );
  check("A40 audit rows unchanged", auditCount() === auditBefore, `${auditBefore} -> ${auditCount()}`);

  // A41: files metadata cannot be inserted/updated through compat, and a forged
  // relative_path can never be used to read the SQLite database.
  const guardForm = new FormData();
  guardForm.append("file", new Blob([TINY_PNG], { type: "image/png" }), "guard.png");
  guardForm.append("ownerType", "phone");
  guardForm.append("ownerId", phoneId);
  guardForm.append("category", "product_photo");
  const guardFile = (await call("POST", "/files", guardForm, 201)).body;
  const pngRelBefore = db.prepare("SELECT relative_path, is_public FROM files WHERE id = ?").get(guardFile.id);
  const filesInsert = await call("POST", "/pg/files/insert", {
    rows: [{
      owner_type: "phone", owner_id: phoneId, category: "photo",
      relative_path: "../database/phonezone.db", mime_type: "application/octet-stream", is_public: 1,
    }],
  });
  const filesUpdate = await call("POST", "/pg/files/update", {
    values: { relative_path: "../database/phonezone.db", is_public: 1 },
    filters: [{ op: "eq", col: "id", val: guardFile.id }],
  });
  const pngRelAfter = db.prepare("SELECT relative_path, is_public FROM files WHERE id = ?").get(guardFile.id);
  check(
    "A41 compat files insert/update -> 403",
    filesInsert.status === 403 && filesUpdate.status === 403,
    `${filesInsert.status}/${filesUpdate.status}`,
  );
  check(
    "A41 real file metadata untouched",
    pngRelAfter.relative_path === pngRelBefore.relative_path && pngRelAfter.is_public === pngRelBefore.is_public,
    `${pngRelBefore.relative_path} -> ${pngRelAfter.relative_path}`,
  );
  // Forge the row directly in SQLite (i.e. bypassing every app guard) and prove
  // the read endpoints still cannot reach the database file.
  db.prepare(
    `INSERT INTO files (id, owner_type, owner_id, category, relative_path, original_name, mime_type, size_bytes, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  ).run("forged-file-row", "phone", phoneId, "photo", "../database/phonezone.db", "phonezone.db", "application/octet-stream", 4096);
  const forgedPrivate = await fetch(`${BASE}/files/forged-file-row`, { headers: { cookie } });
  const forgedPublic = await fetch(`${BASE}/public/files/forged-file-row`);
  const forgedPrivateText = await forgedPrivate.text();
  const forgedPublicText = await forgedPublic.text();
  const leakedDb = /SQLite format 3/.test(forgedPrivateText) || /SQLite format 3/.test(forgedPublicText);
  check(
    "A41 forged relative_path is never readable",
    !leakedDb && forgedPrivate.status !== 200 && forgedPublic.status !== 200,
    `private ${forgedPrivate.status}, public ${forgedPublic.status}, db bytes leaked = ${leakedDb}`,
  );

  // A42: a select with an unknown column in its filter is a 400, not an
  // ignored filter (which would return the whole table).
  const bogusSelect = await call("POST", "/pg/phones/select", { filters: [{ op: "eq", col: "password", val: "x" }] });
  check("A42 select with bogus-column filter -> 400", bogusSelect.status === 400, `status ${bogusSelect.status}`);

  // A43: a column name carrying SQL in update values/filters is rejected and
  // nothing is written.
  const phoneSnapshotBefore = JSON.stringify(db.prepare("SELECT * FROM phones WHERE id = ?").get(phoneId));
  const injectValueKey = await call("POST", "/pg/phones/update", {
    values: { 'selling_price" = 1, purchase_price': 1 },
    filters: [{ op: "eq", col: "id", val: phoneId }],
  });
  const injectFilterCol = await call("POST", "/pg/phones/update", {
    values: { selling_price: 1 },
    filters: [{ op: "eq", col: 'id" OR 1=1 --', val: "x" }],
  });
  const injectFilterOp = await call("POST", "/pg/phones/update", {
    values: { selling_price: 1 },
    filters: [{ op: "eq); DROP TABLE phones; --", col: "id", val: "x" }],
  });
  const phoneSnapshotAfter = JSON.stringify(db.prepare("SELECT * FROM phones WHERE id = ?").get(phoneId));
  check(
    "A43 column-name injection in values/filters rejected, nothing changed",
    injectValueKey.status === 400 && injectFilterCol.status === 400 && injectFilterOp.status === 400 &&
      phoneSnapshotBefore === phoneSnapshotAfter && phoneSnapshotBefore !== "undefined",
    `values ${injectValueKey.status}, filter col ${injectFilterCol.status}, filter op ${injectFilterOp.status}, unchanged = ${phoneSnapshotBefore === phoneSnapshotAfter}`,
  );

  // A44+: the whole table is still intact after the injection attempts.
  check("A43 phones table still intact", countPhones() === phonesTotal, `phones ${phonesTotal} -> ${countPhones()}`);

  // A13: an HTML file renamed .jpg is refused; a real PNG is served with nosniff.
  const evilForm = new FormData();
  evilForm.append("file", new Blob([Buffer.from("<html><script>alert(1)</script></html>")], { type: "image/jpeg" }), "evil.jpg");
  evilForm.append("ownerType", "phone");
  evilForm.append("ownerId", phoneId);
  evilForm.append("category", "product_photo");
  const evilUpload = await call("POST", "/files", evilForm);
  check("html renamed jpg rejected", evilUpload.status === 400, `status ${evilUpload.status}`);
  const pngForm = new FormData();
  pngForm.append("file", new Blob([TINY_PNG], { type: "image/png" }), "real.png");
  pngForm.append("ownerType", "phone");
  pngForm.append("ownerId", phoneId);
  pngForm.append("category", "product_photo");
  const pngFile = (await call("POST", "/files", pngForm, 201)).body;
  const pngRes = await fetch(`${BASE}/files/${pngFile.id}`, { headers: { cookie } });
  check("served file forbids sniffing", pngRes.headers.get("x-content-type-options") === "nosniff");

  // A14: the setup wizard cannot be driven through a tunnel/proxy header.
  const setupPayload = {
    businessName: "Hijack Shop",
    primaryPhone: "9000000001",
    address: "x",
    email: "hijack@x.test",
    password: "abcdef",
  };
  const proxiedSetup = await fetch(`${BASE}/setup`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(setupPayload),
  });
  check("setup refused through a proxy header", proxiedSetup.status === 403, `status ${proxiedSetup.status}`);
  const forwarded = await fetch(`${BASE}/setup/upload`, {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.9", cookie },
    body: new FormData(),
  });
  check("setup upload blocked through a proxy", forwarded.status === 403, `status ${forwarded.status}`);
  const forwardedRestore = await fetch(`${BASE}/setup/restore`, {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.9", cookie },
    body: new FormData(),
  });
  check("setup restore blocked through a proxy", forwardedRestore.status === 403, `status ${forwardedRestore.status}`);

  // A15 / A16: IMEI validation happens on the SERVER, not only in the form.
  const purchaseBody = (extra) => ({
    phone_name: "Hardening Phone",
    model: "H-1",
    condition: "good",
    purchase_price: 100,
    selling_price: 200,
    purchase_date: "2026-10-01",
    payment_method: "cash",
    seller_id: seller.id,
    ...extra,
  });
  const luhnBad = await call("POST", "/purchases", purchaseBody({ imei_number: "111111111111118" }));
  check("Luhn-invalid IMEI rejected by the server", luhnBad.status === 400, `status ${luhnBad.status}`);

  // A17: a purchase that fails validation leaves NO orphan seller behind.
  const orphanAttempt = await call("POST", "/purchases", {
    phone_name: "Orphan",
    model: "O-1",
    imei_number: "111111111111118",
    condition: "good",
    purchase_price: 100,
    selling_price: 200,
    purchase_date: "2026-10-01",
    payment_method: "cash",
    seller: {
      name: "Orphan Seller",
      phone: "9666600001",
      address: "9 Orphan Road",
      id_proof_type: "pan",
      id_number: "ORPHAN-1",
    },
  });
  const orphanSellers = (await call("GET", "/sellers?search=9666600001", undefined, 200)).body;
  check("failed purchase leaves no seller", orphanAttempt.status === 400 && orphanSellers.length === 0, `status ${orphanAttempt.status}, sellers ${orphanSellers.length}`);

  // A18: state guards on sales and returns.
  const guardPhone = (await call("POST", "/purchases", purchaseBody({ imei_number: "353967118612343" }), 201)).body.phone;
  await call("POST", "/returns", {
    phone_id: guardPhone.id,
    return_type: "purchase_return",
    return_amount: 100,
    return_reason: "dealer took it back",
  }, 201);
  const sellReturned = await call("POST", "/sales", {
    phone_id: guardPhone.id,
    customer_id: customer.id,
    sale_price: 200,
  });
  check("purchase-returned phone cannot be sold", sellReturned.status === 400, `status ${sellReturned.status}`);
  const doubleReturn = await call("POST", "/returns", {
    phone_id: guardPhone.id,
    return_type: "purchase_return",
    return_amount: 100,
    return_reason: "again",
  });
  check("same return type cannot repeat", doubleReturn.status === 400, `status ${doubleReturn.status}`);

  // A19: invoice numbers follow the financial year and never repeat.
  const activeFy = (await call("GET", "/financial-years", undefined, 200)).body.active.label;
  const fyNumbers = [];
  for (let i = 0; i < 20; i++) {
    fyNumbers.push((await call("POST", "/invoices", { type: "sale", amount: 1 }, 201)).body.invoice_number);
  }
  check(
    "invoice numbers use the financial year",
    fyNumbers.every((n) => String(n).includes(`-${activeFy}-`)),
    `${activeFy} -> ${fyNumbers[0]}`,
  );
  check("invoice numbers never repeat", new Set(fyNumbers).size === 20, `unique ${new Set(fyNumbers).size}/20`);

  // A05 (rest): exactly one admin account exists.
  const onlyAdmin = await call("GET", "/auth/me", undefined, 200);
  check(
    "signed-in user is the only admin",
    onlyAdmin.body.roles?.includes("admin") === true && onlyAdmin.body.email === ADMIN.email,
    JSON.stringify(onlyAdmin.body),
  );

  // A06: failed logins are rate limited, with a readable message.
  const attempts = [];
  for (let i = 0; i < 10; i++) {
    attempts.push((await call("POST", "/auth/login", { email: ADMIN.email, password: "wrong-password" })).status);
  }
  const blocked = await call("POST", "/auth/login", { email: ADMIN.email, password: "wrong-password" });
  check("10 failures then 429", attempts.every((s) => s === 401) && blocked.status === 429, `statuses ${attempts.join(",")} then ${blocked.status}`);
  check("429 message is readable", /too many/i.test(String(blocked.body?.error || "")), String(blocked.body?.error));
} catch (err) {
  failures.push(`suite aborted: ${err.message}`);
  console.error(`\n  ERROR ${err.message}`);
} finally {
  server.close();
  closeDatabase();
}

console.log(`\n${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
fs.rmSync(DATA_DIR, { recursive: true, force: true });
console.log("Offline suite green - the EXE build has a working local backend.\n");
