/**
 * sapathPatraTemplates.ts
 * Legal Declaration & Undertaking (शपथ पत्र) templates for mobile purchases.
 * Faithful reproduction of statutory buyback declaration from mobile reference.
 */

export type SapathLanguage = "hindi" | "english" | "both";

export interface SapathPatraData {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  shopLogoUrl?: string;
  shopSignatureUrl?: string;

  // Transaction details
  refNo: string;
  date: string;
  amount: number | string;

  // Seller details
  sellerName: string;
  sellerPhone: string;
  sellerAddress: string;
  idProofType: string;
  idNumber: string;
  sellerPhotoUrl?: string | null;
  sellerSignatureUrl?: string | null;

  // Phone details
  brand: string;
  model: string;
  variant?: string;
  colour?: string;
  imei1: string;
  imei2?: string;
  condition?: string;

  language?: SapathLanguage;
}

export function formatAadhaarNumber(idNum: string): string {
  const clean = (idNum || "").replace(/\D/g, "");
  if (clean.length === 12) {
    return `XXXX-XXXX-${clean.slice(8)}`;
  }
  return idNum || "N/A";
}

export function buildSapathPatraHtml(data: SapathPatraData): string {
  const d = data || ({} as any);
  const lang = d.language || "both";
  const showHindi = lang === "hindi" || lang === "both";
  const showEnglish = lang === "english" || lang === "both";

  const numWords = Number(d.amount) ? Number(d.amount).toLocaleString("en-IN") : (d.amount || "0");
  const fullModel = `${d.brand || ""} ${d.model || ""} ${d.variant || ""}`.trim() || "Mobile Phone";
  const refNo = d.refNo || "PUR-REF";

  return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="utf-8">
  <title>शपथ पत्र - ${refNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.45;
      font-size: 11.5px;
      padding: 10px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      border: 1.5px solid #0f172a;
      padding: 18px 22px;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .shop-info {
      flex: 1;
    }
    .shop-title {
      font-size: 22px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .shop-meta {
      font-size: 11px;
      color: #475569;
      margin-top: 2px;
    }
    .doc-badge {
      text-align: center;
      margin: 8px 0;
      background: #f1f5f9;
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
    }
    .doc-badge h2 {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.5px;
    }
    .doc-badge span {
      font-size: 11px;
      color: #64748b;
      display: block;
    }
    .photo-box {
      width: 100px;
      height: 120px;
      border: 1.5px solid #0f172a;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin-left: 14px;
      flex-shrink: 0;
    }
    .photo-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .photo-placeholder {
      font-size: 9.5px;
      color: #94a3b8;
      text-align: center;
      padding: 6px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      background: #f8fafc;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      margin-bottom: 12px;
      font-size: 11px;
    }
    .meta-item {
      display: flex;
      gap: 6px;
    }
    .meta-item strong {
      color: #334155;
      min-width: 105px;
      flex-shrink: 0;
    }
    .meta-item span {
      color: #0f172a;
      word-break: break-word;
    }
    .preamble {
      font-weight: 600;
      margin-bottom: 8px;
      padding: 4px 6px;
      background: #fff;
      border-left: 3px solid #2563eb;
      font-size: 11px;
    }
    .clauses-list {
      list-style-type: decimal;
      padding-left: 18px;
      margin-bottom: 14px;
    }
    .clauses-list li {
      margin-bottom: 7px;
      padding-left: 4px;
      font-size: 10.5px;
      text-align: justify;
    }
    .clause-hi {
      color: #0f172a;
      font-weight: 500;
    }
    .clause-en {
      color: #475569;
      font-size: 10px;
      display: block;
      margin-top: 1px;
      font-style: italic;
    }
    .closing {
      font-size: 10.5px;
      font-weight: 600;
      margin: 10px 0 16px 0;
      text-align: center;
      color: #1e293b;
      padding: 5px;
      border-top: 1px dashed #cbd5e1;
      border-bottom: 1px dashed #cbd5e1;
    }
    .signature-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 18px;
      padding-top: 8px;
    }
    .sign-block {
      text-align: center;
      width: 220px;
    }
    .sign-box {
      height: 70px;
      border-bottom: 1.5px solid #0f172a;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .sign-box img {
      max-height: 65px;
      max-width: 100%;
      object-fit: contain;
    }
    .sign-title {
      font-weight: 700;
      font-size: 11px;
      color: #0f172a;
    }
    .sign-sub {
      font-size: 9.5px;
      color: #64748b;
    }
    @media print {
      body {
        padding: 0;
      }
      .container {
        border: none;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="shop-info">
        <div class="shop-title">${data.shopName || "PhoneZone"}</div>
        <div class="shop-meta">
          ${data.shopAddress ? `<span>${data.shopAddress}</span> • ` : ""}
          <span>Phone: ${data.shopPhone || "N/A"}</span>
        </div>
      </div>
      ${
        data.sellerPhotoUrl
          ? `<div class="photo-box"><img src="${data.sellerPhotoUrl}" alt="Seller Photo" /><div style="font-size:8px;text-align:center;color:#64748b;">Customer Photo</div></div>`
          : `<div class="photo-box"><div class="photo-placeholder">Customer Photo<br>(विक्रेता फोटो)</div></div>`
      }
    </div>

    <!-- Title Badge -->
    <div class="doc-badge">
      <h2>DECLARATION & UNDERTAKING (शपथ पत्र)</h2>
      <span>Statutory declaration by seller of pre-owned mobile device</span>
    </div>

    <!-- Details Grid -->
    <div class="meta-grid">
      <div class="meta-item">
        <strong>Date (दिनांक):</strong>
        <span>${data.date}</span>
      </div>
      <div class="meta-item">
        <strong>Ref No. (संदर्भ सं.):</strong>
        <span>${refNo}</span>
      </div>
      <div class="meta-item">
        <strong>Seller Name (नाम):</strong>
        <span>${data.sellerName}</span>
      </div>
      <div class="meta-item">
        <strong>Mobile (मोबाइल):</strong>
        <span>${data.sellerPhone}</span>
      </div>
      <div class="meta-item">
        <strong>ID Type & No.:</strong>
        <span>${(data.idProofType || "ID").toUpperCase()}: ${formatAadhaarNumber(data.idNumber)}</span>
      </div>
      <div class="meta-item">
        <strong>Purchase Amount:</strong>
        <span><strong>₹${numWords}/-</strong></span>
      </div>
      <div class="meta-item" style="grid-column: 1 / -1;">
        <strong>Address (पता):</strong>
        <span>${data.sellerAddress || "N/A"}</span>
      </div>
      <div class="meta-item" style="grid-column: 1 / -1;">
        <strong>Device Model:</strong>
        <span><strong>${fullModel}</strong></span>
      </div>
      <div class="meta-item">
        <strong>IMEI 1:</strong>
        <span><code style="font-size:11px;font-weight:700;">${data.imei1}</code></span>
      </div>
      <div class="meta-item">
        <strong>IMEI 2:</strong>
        <span><code style="font-size:11px;">${data.imei2 || "N/A"}</code></span>
      </div>
    </div>

    <!-- Preamble -->
    <div class="preamble">
      ${
        showHindi
          ? `मैं, <strong>${data.sellerName}</strong>, निवासी <strong>${data.sellerAddress || ""}</strong>, मोबाइल <strong>${data.sellerPhone}</strong>, पहचान पत्र <strong>${formatAadhaarNumber(data.idNumber)}</strong>, सत्यनिष्ठापूर्वक घोषणा करता/करती हूँ कि:`
          : ""
      }
      ${
        showEnglish
          ? `<div style="font-size:10px;color:#475569;margin-top:2px;">I, <strong>${data.sellerName}</strong>, resident of ${data.sellerAddress || ""}, mobile no. ${data.sellerPhone}, do hereby solemnly declare that:</div>`
          : ""
      }
    </div>

    <!-- 8 Statutory Clauses -->
    <ol class="clauses-list">
      <li>
        ${
          showHindi
            ? `<span class="clause-hi">1. मैं उपरोक्त मोबाइल फोन (<strong>${fullModel}</strong>, IMEI: <strong>${data.imei1}</strong>) का वास्तविक, वैधानिक और एकमात्र स्वामी हूँ तथा इसे मैंने वैध साधनों से प्राप्त किया है।</span>`
            : ""
        }
        ${
          showEnglish
            ? `<span class="clause-en">I am the lawful and sole owner of the above mobile phone (${fullModel}, IMEI: ${data.imei1}). I acquired it lawfully.</span>`
            : ""
        }
      </li>
      <li>
        ${
          showHindi
            ? `<span class="clause-hi">2. यह फोन किसी भी प्रकार से चोरी, छिनैती, गुमशुदा, धोखाधड़ी अथवा किसी अपराध से संबंधित नहीं है। इसके विरुद्ध किसी भी थाने में कोई रिपोर्ट/मुकदमा दर्ज नहीं है और न ही यह किसी विवाद में है।</span>`
            : ""
        }
        ${
          showEnglish
            ? `<span class="clause-en">This phone is not stolen, snatched, lost, obtained by fraud or through any offence. No police complaint is registered against it and it is not in dispute.</span>`
            : ""
        }
      </li>
      <li>
        ${
          showHindi
            ? `<span class="clause-hi">3. इस फोन पर किसी बैंक/फाइनेंस कंपनी अथवा संस्था की कोई EMI, ऋण, देनदारी या तृतीय पक्ष का कोई दावा/अधिकार शेष नहीं है।</span>`
            : ""
        }
        ${
          showEnglish
            ? `<span class="clause-en">There is no EMI, loan, pledge or dues of any bank/finance company or claim of any third party on this phone.</span>`
            : ""
        }
      </li>
      <li>
        ${
          showHindi
            ? `<span class="clause-hi">4. मैंने अपना Google / Apple ID, स्क्रीन लॉक एवं Find My Device / Activation Lock स्वयं हटा दिया है तथा संपूर्ण व्यक्तिगत डेटा मिटा दिया है। दुकान की किसी डेटा की जिम्मेदारी नहीं होगी।</span>`
            : ""
        }
        ${
          showEnglish
            ? `<span class="clause-en">I have removed my Google/Apple ID, screen lock and Find My Device / Activation Lock, and erased all personal data myself. The shop is not responsible for any data.</span>`
            : ""
        }
      </li>
      <li>
        ${
          showHindi
            ? `<span class="clause-hi">5. मैंने यह फोन अपनी स्वेच्छा से <strong>${data.shopName || "PhoneZone"}</strong> को <strong>₹${numWords}/-</strong> में बेचा है और पूर्ण धनराशि प्राप्त कर ली है। अब कोई लेन-देन शेष नहीं है। यह विक्रय अंतिम है।</span>`
            : ""
        }
        ${
          showEnglish
            ? `<span class="clause-en">I have voluntarily sold this phone to ${data.shopName || "PhoneZone"} for ₹${numWords}/- and received the full amount. This sale is final.</span>`
            : ""
        }
      </li>
      <li>
        ${
          showHindi
            ? `<span class="clause-hi">6. मैंने फोन की वर्तमान स्थिति, स्क्रैच और कमियों की सही-सही जानकारी दी है और कोई बात नहीं छिपाई है।</span>`
            : ""
        }
        ${
          showEnglish
            ? `<span class="clause-en">I have truthfully disclosed the condition and defects of the phone and concealed nothing.</span>`
            : ""
        }
      </li>
      <li>
        ${
          showHindi
            ? `<span class="clause-hi">7. मैं वयस्क (18 वर्ष से अधिक) हूँ और बिना किसी दबाव या प्रभाव के यह शपथ पत्र दे रहा/रही हूँ। मैंने स्वयं अपने पहचान पत्र (Aadhaar/PAN) की प्रति संलग्न की है।</span>`
            : ""
        }
        ${
          showEnglish
            ? `<span class="clause-en">I am an adult (above 18 years) giving this declaration without pressure, and have myself provided a copy of my ID proof.</span>`
            : ""
        }
      </li>
      <li>
        ${
          showHindi
            ? `<span class="clause-hi">8. यदि यह फोन भविष्य में चोरी/विवादित पाया जाता है या मेरा कोई कथन असत्य निकलता है, तो इसकी सम्पूर्ण दीवानी व आपराधिक जिम्मेदारी मेरी होगी। दुकान को हुई क्षति की भरपाई मैं करूँगा/करूँगी तथा दुकान मेरी जानकारी पुलिस/प्रशासन को देने हेतु पूर्णतः स्वतंत्र होगी।</span>`
            : ""
        }
        ${
          showEnglish
            ? `<span class="clause-en">If this phone is later found to be stolen/disputed or any statement is false, I alone shall bear full legal and financial liability and compensate the shop for any loss.</span>`
            : ""
        }
      </li>
    </ol>

    <!-- Closing Statement -->
    <div class="closing">
      उपरोक्त सभी कथन मेरे ज्ञान एवं विश्वास में पूर्णतः सत्य हैं। मैंने इसे पढ़कर व समझकर हस्ताक्षर किए हैं।<br>
      <span style="font-size:9.5px;font-weight:normal;color:#475569;">All the above statements are true to the best of my knowledge and belief. I have read and understood this.</span>
    </div>

    <!-- Signatures Section -->
    <div class="signature-row">
      <div class="sign-block">
        <div class="sign-box">
          ${
            data.sellerSignatureUrl
              ? `<img src="${data.sellerSignatureUrl}" alt="Seller Signature" />`
              : `<span style="color:#94a3b8;font-size:10px;">Signature on file</span>`
          }
        </div>
        <div class="sign-title">Signature of Declarant</div>
        <div class="sign-sub">(विक्रेता के हस्ताक्षर)</div>
        <div style="font-size:10px;margin-top:2px;font-weight:600;">${data.sellerName}</div>
      </div>

      <div class="sign-block">
        <div class="sign-box">
          <span style="color:#94a3b8;font-size:10px;">Witness Signature</span>
        </div>
        <div class="sign-title">Witness Signature</div>
        <div class="sign-sub">(गवाह के हस्ताक्षर)</div>
      </div>

      <div class="sign-block">
        <div class="sign-box">
          ${
            data.shopSignatureUrl
              ? `<img src="${data.shopSignatureUrl}" alt="Shop Signature" />`
              : `<span style="color:#2563eb;font-weight:700;font-size:11px;">${data.shopName || "PhoneZone"}</span>`
          }
        </div>
        <div class="sign-title">For ${data.shopName || "PhoneZone"}</div>
        <div class="sign-sub">(अधिकृत हस्ताक्षरकर्ता)</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

