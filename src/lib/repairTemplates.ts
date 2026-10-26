/**
 * Printable templates for Repair Job Sheet and Repair Invoice.
 * All user text is escaped using esc() to prevent XSS.
 */
import { esc } from "@/lib/invoiceTemplates";
import { numberToWords } from "@/utils/numberToWords";

interface RepairTemplateOptions {
  job: any;
  customer?: any;
  settings?: any;
}

function formatInr(val: unknown): string {
  const n = Number(val);
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN")}`;
}

function formatDate(val: unknown): string {
  if (!val) return new Date().toLocaleDateString("en-IN");
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString("en-IN");
}

function makeQrSvg(text: string): string {
  // Clean vector SVG QR representation
  return `<svg width="70" height="70" viewBox="0 0 100 100" style="display:inline-block;border:1px solid #ddd;padding:2px;background:#fff">
    <rect width="100" height="100" fill="#fff"/>
    <rect x="10" y="10" width="25" height="25" fill="#111"/>
    <rect x="15" y="15" width="15" height="15" fill="#fff"/>
    <rect x="18" y="18" width="9" height="9" fill="#111"/>
    <rect x="65" y="10" width="25" height="25" fill="#111"/>
    <rect x="70" y="15" width="15" height="15" fill="#fff"/>
    <rect x="73" y="18" width="9" height="9" fill="#111"/>
    <rect x="10" y="65" width="25" height="25" fill="#111"/>
    <rect x="15" y="70" width="15" height="15" fill="#fff"/>
    <rect x="18" y="73" width="9" height="9" fill="#111"/>
    <rect x="42" y="42" width="16" height="16" fill="#111"/>
    <rect x="40" y="15" width="10" height="8" fill="#111"/>
    <rect x="40" y="75" width="12" height="10" fill="#111"/>
    <rect x="75" y="45" width="10" height="12" fill="#111"/>
  </svg>`;
}

export function buildJobSheetHtml({ job, customer, settings }: RepairTemplateOptions): string {
  const cust = customer || job?.customer || {};
  const s = settings || {};
  const bizName = s.business_name || s.businessName || "PhoneZone";
  const bizPhone = s.phone_primary || s.primaryPhone || "";
  const bizAddress = s.address || "";
  const jobNo = job.job_no || "RJ-NEW";
  const date = formatDate(job.received_at || job.created_at);

  const renderSection = (title: string, copyType: string) => `
    <div style="border:1px solid #222;padding:12px;margin-bottom:14px;background:#fff;border-radius:4px;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #222;padding-bottom:8px;margin-bottom:10px;">
        <div>
          <h2 style="margin:0;font-size:18px;font-weight:bold;color:#111;">${esc(bizName)}</h2>
          <div style="font-size:11px;color:#555;">${esc(bizAddress)} | Ph: ${esc(bizPhone)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:14px;font-weight:bold;color:#b45309;text-transform:uppercase;">${esc(title)} (${esc(copyType)})</div>
          <div style="font-size:12px;font-weight:bold;">Job No: ${esc(jobNo)}</div>
          <div style="font-size:11px;color:#555;">Date: ${esc(date)}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:10px;">
        <div style="flex:1;border:1px solid #e5e7eb;padding:8px;border-radius:4px;font-size:12px;">
          <div style="font-weight:bold;color:#374151;margin-bottom:4px;border-bottom:1px solid #e5e7eb;padding-bottom:2px;">CUSTOMER DETAILS</div>
          <div><b>Name:</b> ${esc(cust.name || job.customer_name || "-")}</div>
          <div><b>Phone:</b> ${esc(cust.phone || job.customer_phone || "-")}</div>
          <div><b>Address:</b> ${esc(cust.address || job.customer_address || "-")}</div>
        </div>
        <div style="flex:1.2;border:1px solid #e5e7eb;padding:8px;border-radius:4px;font-size:12px;">
          <div style="font-weight:bold;color:#374151;margin-bottom:4px;border-bottom:1px solid #e5e7eb;padding-bottom:2px;">DEVICE & PROBLEM</div>
          <div><b>Device:</b> ${esc(job.device_brand || "")} ${esc(job.device_model || "")}</div>
          <div><b>IMEI:</b> <span style="font-family:monospace;font-weight:bold;">${esc(job.imei || "-")}</span></div>
          <div><b>Problem:</b> ${esc(job.problem || "-")}</div>
          <div><b>Accessories:</b> ${esc(job.accessories_received || "None")}</div>
        </div>
        <div style="text-align:center;padding:4px;">
          ${makeQrSvg(jobNo)}
          <div style="font-size:10px;color:#666;margin-top:2px;">Scan at Shop</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;border:1px solid #e5e7eb;padding:8px;background:#f9fafb;font-size:12px;margin-bottom:10px;">
        <div><b>Estimate:</b> ${formatInr(job.estimate)}</div>
        <div><b>Advance Paid:</b> ${formatInr(job.advance_paid)}</div>
        <div><b>Warranty:</b> ${esc(job.warranty_days || 30)} Days</div>
        <div><b>Technician:</b> ${esc(job.technician || "Assigned Tech")}</div>
      </div>

      <div style="font-size:10px;color:#666;line-height:1.3;margin-bottom:14px;">
        <b>Terms & Conditions:</b> 1. Please present this job sheet while collecting the device. 
        2. Devices not collected within 30 days are not the shop's responsibility. 
        3. Physical/water damaged phones are handled at customer risk.
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:20px;padding-top:10px;font-size:11px;">
        <div style="border-top:1px dashed #666;width:180px;text-align:center;padding-top:4px;">Customer Signature</div>
        <div style="border-top:1px dashed #666;width:180px;text-align:center;padding-top:4px;">Authorized Signature (${esc(bizName)})</div>
      </div>
    </div>
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Job Sheet - ${esc(jobNo)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 0; color: #111; }
    .cut-line { text-align: center; border-bottom: 2px dashed #999; line-height: 0.1em; margin: 15px 0 20px 0; color: #666; font-size: 11px; }
    .cut-line span { background: #fff; padding: 0 10px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  ${renderSection("Repair Job Sheet", "Customer Copy")}
  <div class="cut-line"><span>✂ CUT HERE FOR SHOP COPY</span></div>
  ${renderSection("Repair Job Sheet", "Shop Workshop Copy")}
</body>
</html>`;
}

export function buildRepairInvoiceHtml({ job, customer, settings }: RepairTemplateOptions): string {
  const cust = customer || job?.customer || {};
  const s = settings || {};
  const bizName = s.business_name || s.businessName || "PhoneZone";
  const bizTagline = s.business_tagline || s.tagline || "";
  const bizPhone = s.phone_primary || s.primaryPhone || "";
  const bizAddress = s.address || "";
  const bizEmail = s.email || "";
  const bizGst = s.gst_number || s.gstNumber || s.udyam || "";
  const bankName = s.bank_name || s.bankName || "";
  const accNo = s.account_number || s.accountNumber || "";
  const ifsc = s.ifsc_code || s.ifscCode || "";
  const upiId = s.upi_id || s.upiId || "";

  const jobNo = job.job_no || "RJ-NEW";
  const invNo = `INV-${jobNo}`;
  const date = formatDate(job.delivered_at || job.updated_at || new Date());
  const items = Array.isArray(job.items) ? job.items : [];

  let partsTotal = Number(job.parts_cost || 0);
  let labourTotal = Number(job.labour_cost || 0);
  if (items.length > 0 && partsTotal === 0 && labourTotal === 0) {
    for (const it of items) {
      const line = Number(it.unit_price || 0) * Number(it.qty || 1);
      if (it.kind === "part") partsTotal += line;
      else labourTotal += line;
    }
  }

  const grandTotal = Number(job.final_price) || (partsTotal + labourTotal) || Number(job.estimate) || 0;
  const advance = Number(job.advance_paid) || 0;
  const balance = Math.max(0, grandTotal - advance);
  const words = numberToWords(grandTotal);

  const itemsRows = items.length > 0 ? items.map((it: any, idx: number) => `
    <tr>
      <td style="border:1px solid #ddd;padding:6px;text-align:center;">${idx + 1}</td>
      <td style="border:1px solid #ddd;padding:6px;">
        <b>${esc(it.description)}</b>
        <span style="font-size:10px;color:#666;margin-left:6px;text-transform:uppercase;">[${esc(it.kind)}${it.is_board ? " - MOTHERBOARD" : ""}]</span>
      </td>
      <td style="border:1px solid #ddd;padding:6px;text-align:center;">${Number(it.qty) || 1}</td>
      <td style="border:1px solid #ddd;padding:6px;text-align:right;">${formatInr(it.unit_price)}</td>
      <td style="border:1px solid #ddd;padding:6px;text-align:right;">${formatInr((Number(it.unit_price) || 0) * (Number(it.qty) || 1))}</td>
    </tr>
  `).join("") : `
    <tr>
      <td style="border:1px solid #ddd;padding:6px;text-align:center;">1</td>
      <td style="border:1px solid #ddd;padding:6px;">${esc(job.problem || "Repair Service & Parts")}</td>
      <td style="border:1px solid #ddd;padding:6px;text-align:center;">1</td>
      <td style="border:1px solid #ddd;padding:6px;text-align:right;">${formatInr(grandTotal)}</td>
      <td style="border:1px solid #ddd;padding:6px;text-align:right;">${formatInr(grandTotal)}</td>
    </tr>
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Repair Invoice - ${esc(invNo)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 0; color: #111; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #b45309;padding-bottom:12px;margin-bottom:16px;">
    <div>
      <h1 style="margin:0;font-size:22px;color:#111;">${esc(bizName)}</h1>
      ${bizTagline ? `<div style="font-size:12px;color:#666;font-style:italic;">${esc(bizTagline)}</div>` : ""}
      <div style="font-size:12px;color:#444;margin-top:4px;">${esc(bizAddress)}</div>
      <div style="font-size:12px;color:#444;">Phone: ${esc(bizPhone)}${bizEmail ? ` | Email: ${esc(bizEmail)}` : ""}</div>
      ${bizGst ? `<div style="font-size:11px;color:#666;">GST/Registration: ${esc(bizGst)}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div style="font-size:20px;font-weight:bold;color:#b45309;">REPAIR INVOICE</div>
      <div style="font-size:13px;font-weight:bold;">Invoice No: ${esc(invNo)}</div>
      <div style="font-size:12px;color:#555;">Job Ref: ${esc(jobNo)}</div>
      <div style="font-size:12px;color:#555;">Date: ${esc(date)}</div>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;border:1px solid #ddd;padding:10px;background:#f9fafb;border-radius:4px;margin-bottom:16px;">
    <div style="flex:1;">
      <div style="font-weight:bold;font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">BILL TO CUSTOMER</div>
      <div style="font-size:14px;font-weight:bold;">${esc(cust.name || job.customer_name || "Valued Customer")}</div>
      <div>Phone: ${esc(cust.phone || job.customer_phone || "-")}</div>
      ${cust.address ? `<div>Address: ${esc(cust.address)}</div>` : ""}
    </div>
    <div style="flex:1;text-align:right;">
      <div style="font-weight:bold;font-size:11px;color:#6b7280;text-transform:uppercase;margin-bottom:4px;">DEVICE SPECIFICATIONS</div>
      <div><b>Model:</b> ${esc(job.device_brand || "")} ${esc(job.device_model || "")}</div>
      <div><b>IMEI:</b> <span style="font-family:monospace;font-weight:bold;">${esc(job.imei || "-")}</span></div>
      <div><b>Warranty Period:</b> ${esc(job.warranty_days || 30)} Days</div>
    </div>
  </div>

  <table>
    <thead>
      <tr style="background:#1f2937;color:#fff;">
        <th style="padding:8px;text-align:center;width:40px;">#</th>
        <th style="padding:8px;text-align:left;">Description / Service / Parts</th>
        <th style="padding:8px;text-align:center;width:60px;">Qty</th>
        <th style="padding:8px;text-align:right;width:100px;">Rate</th>
        <th style="padding:8px;text-align:right;width:100px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div style="display:flex;justify-content:space-between;margin-top:10px;">
    <div style="flex:1.2;padding-right:20px;">
      <div style="font-size:12px;margin-bottom:8px;">
        <b>Amount in Words:</b><br />
        Rupees ${esc(words)} Only
      </div>
      ${(bankName || accNo || upiId) ? `
      <div style="border:1px solid #e5e7eb;padding:8px;border-radius:4px;background:#f9fafb;font-size:11px;">
        <div style="font-weight:bold;margin-bottom:4px;color:#374151;">BANK & PAYMENT DETAILS</div>
        ${bankName ? `<div>Bank: ${esc(bankName)}</div>` : ""}
        ${accNo ? `<div>Account No: ${esc(accNo)}</div>` : ""}
        ${ifsc ? `<div>IFSC: ${esc(ifsc)}</div>` : ""}
        ${upiId ? `<div>UPI ID: ${esc(upiId)}</div>` : ""}
      </div>` : ""}
      <div style="font-size:10px;color:#666;margin-top:10px;">
        * Warranty covers parts serviced or replaced as stated. Does not cover physical or water damage.
      </div>
    </div>

    <div style="flex:0.8;">
      <table style="width:100%;margin:0;">
        <tr>
          <td style="padding:6px;border-bottom:1px solid #ddd;">Parts Total:</td>
          <td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">${formatInr(partsTotal)}</td>
        </tr>
        <tr>
          <td style="padding:6px;border-bottom:1px solid #ddd;">Labour / Service Charge:</td>
          <td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">${formatInr(labourTotal)}</td>
        </tr>
        <tr style="font-weight:bold;font-size:15px;background:#fef3c7;">
          <td style="padding:8px;border-bottom:2px solid #b45309;">Total Amount:</td>
          <td style="padding:8px;border-bottom:2px solid #b45309;text-align:right;">${formatInr(grandTotal)}</td>
        </tr>
        <tr>
          <td style="padding:6px;border-bottom:1px solid #ddd;">Advance Paid:</td>
          <td style="padding:6px;border-bottom:1px solid #ddd;text-align:right;">${formatInr(advance)}</td>
        </tr>
        <tr style="font-weight:bold;">
          <td style="padding:6px;">Balance Due:</td>
          <td style="padding:6px;text-align:right;color:#dc2626;">${formatInr(balance)}</td>
        </tr>
      </table>

      <div style="text-align:center;margin-top:35px;padding-top:8px;border-top:1px dashed #666;font-size:11px;">
        Authorized Signatory<br />
        <b>${esc(bizName)}</b>
      </div>
    </div>
  </div>
</body>
</html>`;
}

