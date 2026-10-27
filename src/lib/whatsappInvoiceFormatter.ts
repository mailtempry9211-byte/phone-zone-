import { numberToWords } from "@/utils/numberToWords";

export type SapathTextLanguage = "hindi" | "english" | "both";

export interface FormatPurchaseOptions {
  includeSapathPatra?: boolean;
  sapathLanguage?: SapathTextLanguage;
}

export interface FormatSaleOptions {
  broker?: boolean;
  brokerAmount?: number;
  brokerName?: string;
}

function formatMaskedId(type: string, num: string): string {
  if (!num) return "N/A";
  const clean = num.replace(/\D/g, "");
  if (type?.toLowerCase().includes("aadhaar") && clean.length === 12) {
    return `XXXX-XXXX-${clean.slice(8)}`;
  }
  return num;
}

function getValidEmail(email?: string): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  if (trimmed.includes("@") && trimmed.includes(".")) {
    return trimmed;
  }
  return null;
}

function formatTerms(termsRaw?: string, fallback: string[] = []): string {
  const lines = (termsRaw || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const list = lines.length > 0 ? lines : fallback;
  return list.map((item, idx) => `${idx + 1}. ${item.replace(/^\d+[\.\)]\s*/, "")}`).join("\n");
}

export function formatSapathPatraText(
  phone: any,
  adminSettings: any,
  language: SapathTextLanguage = "both"
): string {
  const bizName = adminSettings?.business_name || "PHONEZONE";
  const seller = phone?.sellers || {};
  const sellerName = seller?.name || "N/A";
  const sellerPhone = seller?.phone || "N/A";
  const sellerAddress = seller?.address || "N/A";
  const idType = seller?.id_proof_type || "Aadhaar";
  const idNumber = seller?.id_number || "";
  const imei = phone?.imei_number || "N/A";
  const imei2 = phone?.imei2_number;
  const brand = phone?.phone_name || "";
  const model = phone?.model || "";
  const variant = phone?.variant ? ` (${phone.variant})` : "";
  const fullModel = `${brand} ${model}${variant}`.trim() || "Mobile Phone";
  const amount = Number(phone?.purchase_price || 0);
  const formattedAmount = amount > 0 ? `₹${amount.toLocaleString("en-IN")}/-` : "N/A";
  const amountWords = amount > 0 ? `${numberToWords(amount)} Rupees Only` : "";
  const dateStr = phone?.purchase_date
    ? new Date(phone.purchase_date).toLocaleDateString("en-IN")
    : new Date().toLocaleDateString("en-IN");

  const showHindi = language === "hindi" || language === "both";
  const showEnglish = language === "english" || language === "both";

  const hindiClauses = `1. मैं उपरोक्त मोबाइल फोन (${fullModel}, IMEI: ${imei}) का वास्तविक, वैधानिक और एकमात्र स्वामी हूँ तथा इसे मैंने वैध साधनों से प्राप्त किया है।
2. यह फोन किसी भी प्रकार से चोरी, छिनैती, गुमशुदा, धोखाधड़ी अथवा किसी अपराध से संबंधित नहीं है। इसके विरुद्ध किसी भी थाने में कोई रिपोर्ट/मुकदमा दर्ज नहीं है।
3. इस फोन पर किसी बैंक/फाइनेंस कंपनी अथवा संस्था की कोई EMI, ऋण, देनदारी या तृतीय पक्ष का कोई दावा/अधिकार शेष नहीं है।
4. मैंने अपना Google/Apple ID, स्क्रीन लॉक एवं Find My Device/Activation Lock स्वयं हटा दिया है तथा संपूर्ण व्यक्तिगत डेटा मिटा दिया है।
5. मैंने यह फोन अपनी स्वेच्छा से ${bizName} को ${formattedAmount} में बेचा है और पूर्ण धनराशि प्राप्त कर ली है। अब कोई लेन-देन शेष नहीं है। यह विक्रय अंतिम है।
6. मैंने फोन की वर्तमान स्थिति, स्क्रैच और कमियों की सही-सही जानकारी दी है और कोई बात नहीं छिपाई है।
7. मैं वयस्क (18 वर्ष से अधिक) हूँ और बिना किसी दबाव या प्रभाव के यह शपथ पत्र दे रहा/रही हूँ।
8. यदि यह फोन भविष्य में चोरी/विवादित पाया जाता है या मेरा कोई कथन असत्य निकलता है, तो इसकी सम्पूर्ण दीवानी व आपराधिक जिम्मेदारी मेरी होगी और दुकान को हुई क्षति की भरपाई मैं करूँगा/करूँगी।`;

  const englishClauses = `1. I am the lawful, bona fide and sole owner of the above mobile device (${fullModel}, IMEI: ${imei}) acquired through legal means.
2. This device is not stolen, snatched, lost, obtained by fraud or involved in any police case or criminal offense.
3. There are no pending EMIs, loans, hypothecation or third-party financial dues on this phone.
4. I have personally removed my Google/Apple accounts, screen locks and Find My Device / iCloud, and wiped all private data.
5. I have voluntarily sold this device to ${bizName} for ${formattedAmount} and received full payment in final settlement.
6. I have disclosed the true physical, cosmetic and functional condition of the device without concealing any defect.
7. I am an adult (above 18 years) executing this statutory declaration freely along with my verified identity proof.
8. If this device is ever found stolen, blocked by CEIR/DoT, blacklisted or if my declarations are false, I accept 100% legal, civil & criminal liability.`;

  return `⚖️ *कानूनी शपथ पत्र एवं घोषणा (DECLARATION & UNDERTAKING)*
━━━━━━━━━━━━━━━━━━━━━━━━━━
🏪 *Shop:* ${bizName}
📍 *Address:* ${(adminSettings?.address || "").replace(/\n/g, ", ")}
📞 *Contact:* ${adminSettings?.phone_primary || ""}${adminSettings?.phone_secondary ? ` | ${adminSettings.phone_secondary}` : ""}

📋 *संदर्भ (Reference Details):*
• Ref No: PUR-${imei}
• Date: ${dateStr}
• Phone: *${fullModel}*
• IMEI 1: \`${imei}\`${imei2 ? `\n• IMEI 2: \`${imei2}\`` : ""}
• Amount Paid: *${formattedAmount}*${amountWords ? ` (${amountWords})` : ""}

👤 *घोषणाकर्ता / विक्रेता (Seller Declarant):*
• Name: *${sellerName}*
• Mobile: ${sellerPhone}
• Address: ${sellerAddress}
• ID: ${(idType).toUpperCase()} (${formatMaskedId(idType, idNumber)})

━━━━━━━━━━━━━━━━━━━━━━━━━━
${showHindi ? `📜 *शपथ पत्र (हिंदी - Statutory Clauses):*
${hindiClauses}
` : ""}${showEnglish ? `📜 *UNDERTAKING (English - Legal Undertaking):*
${englishClauses}
` : ""}━━━━━━━━━━━━━━━━━━━━━━━━━━
✍️ *विक्रेता हस्ताक्षर (Seller Signature):* [रिकॉर्ड में डिजिटल रूप से सत्यापित]
⚖️ *भारतीय साक्ष्य अधिनियम एवं BNS के अंतर्गत कानूनी रूप से बाध्यकारी दस्तावेज*`;
}

export function formatPurchaseInvoiceText(
  phone: any,
  adminSettings: any,
  options?: FormatPurchaseOptions
): string {
  const bizName = adminSettings?.business_name || "PHONEZONE";
  const tagline = adminSettings?.business_tagline?.trim();
  const ownerName = adminSettings?.owner_name?.trim();
  const udyam = adminSettings?.udyam_number?.trim();

  const seller = phone?.sellers || {};
  const imei = phone?.imei_number || "N/A";
  const imei2 = phone?.imei2_number;
  const brand = phone?.phone_name || "";
  const model = phone?.model || "";
  const variant = phone?.variant || "-";
  const colour = phone?.colour || "-";
  const condition = phone?.condition ? phone.condition.charAt(0).toUpperCase() + phone.condition.slice(1) : "Good";
  const price = Number(phone?.purchase_price || 0);
  const paymentMethod = phone?.payment_method
    ? phone.payment_method.charAt(0).toUpperCase() + phone.payment_method.slice(1)
    : "Cash";

  const accessories: string[] = [];
  if (phone?.bill_available) accessories.push("✓ Original Bill");
  if (phone?.box_available) accessories.push("✓ Original Box");
  if (phone?.charger_available) accessories.push("✓ Original Charger");
  const accessoriesSection = accessories.length > 0 ? `\n\n📦 *Accessories Included:*\n${accessories.join("\n")}` : "";

  const termsText = formatTerms(adminSettings?.terms_and_conditions_purchase || adminSettings?.terms_and_conditions, [
    "Device verified on official government CEIR / DoT portal (www.ceir.gov.in).",
    "Seller is legally responsible if phone is ever reported lost, stolen or blacklisted.",
    "Subject to local jurisdiction only.",
  ]);

  const validEmail = getValidEmail(adminSettings?.email);

  let message = `📱 *${bizName} - Purchase Invoice (खरीद बिल)*
${tagline ? `✨ _${tagline}_\n` : ""}${ownerName ? `👤 *Proprietor:* ${ownerName}\n` : ""}${udyam ? `📜 *Udyam Reg. No:* ${udyam}\n` : ""}
📋 *Invoice Details:*
• Invoice No: PUR-${imei}
• Invoice Date: ${new Date().toLocaleDateString("en-IN")}
• Purchase Date: ${phone?.purchase_date ? new Date(phone.purchase_date).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")}

📱 *Device Details:*
• Brand: ${brand}
• Model: ${model}
• Variant: ${variant}
• Colour: ${colour}
• IMEI: \`${imei}\`${imei2 ? `\n• IMEI 2: \`${imei2}\`` : ""}
• Condition: ${condition}
• Purchase Amount: *₹${price.toLocaleString("en-IN")}*
• Payment Method: ${paymentMethod}${accessoriesSection}

👤 *Seller Information:*
• Name: ${seller?.name || "N/A"}
• Mobile: ${seller?.phone || "N/A"}
• Address: ${seller?.address || "N/A"}
• ID Type: ${(seller?.id_proof_type || "ID").toUpperCase()}
• ID Number: ${formatMaskedId(seller?.id_proof_type || "", seller?.id_number || "")}

💰 *Amount in Words:* ${numberToWords(price)} Rupees Only

📋 *Terms & Conditions (नियम एवं शर्तें):*
${termsText}

📞 *Store Contact Information:*
${adminSettings?.address || ""}
Phone: ${adminSettings?.phone_primary || ""}${adminSettings?.phone_secondary ? ` | ${adminSettings.phone_secondary}` : ""}
${adminSettings?.whatsapp_number ? `WhatsApp: ${adminSettings.whatsapp_number}\n` : ""}${adminSettings?.instagram ? `Instagram: ${adminSettings.instagram}\n` : ""}${validEmail ? `Email: ${validEmail}\n` : ""}${adminSettings?.google_business_url ? `Store Location: ${adminSettings.google_business_url}\n` : ""}
🙏 *Thank you for your business with ${bizName}!*`;

  if (options?.includeSapathPatra) {
    const sapathText = formatSapathPatraText(phone, adminSettings, options.sapathLanguage || "both");
    message += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n${sapathText}`;
  }

  return message;
}

export function formatSalesInvoiceText(
  phone: any,
  adminSettings: any,
  options?: FormatSaleOptions
): string {
  const bizName = adminSettings?.business_name || "PHONEZONE";
  const tagline = adminSettings?.business_tagline?.trim();
  const ownerName = adminSettings?.owner_name?.trim();
  const udyam = adminSettings?.udyam_number?.trim();

  const customer = phone?.customers || {};
  const imei = phone?.imei_number || "NONE";
  const brand = phone?.phone_name || "";
  const model = phone?.model || "";
  const variant = phone?.variant || "-";
  const colour = phone?.colour || "-";
  const condition = phone?.condition ? phone.condition.charAt(0).toUpperCase() + phone.condition.slice(1) : "Good";

  const isBroker = !!options?.broker;
  const price = isBroker && (options?.brokerAmount || 0) > 0
    ? Number(options.brokerAmount)
    : Number(phone?.selling_price || 0);

  const bankName = adminSettings?.bank_name?.trim();
  const accHolder = adminSettings?.account_holder_name?.trim();
  const accNum = adminSettings?.account_number?.trim();
  const ifsc = adminSettings?.ifsc_code?.trim();

  let bankSection = "";
  if (bankName && accNum) {
    bankSection = `\n\n🏦 *Official Bank Account Details:*
• Bank: ${bankName}
• Account Name: ${accHolder || bizName}
• Account No: ${accNum}
• IFSC Code: ${ifsc || "N/A"}`;
  }

  const termsText = formatTerms(adminSettings?.terms_and_conditions_sale || adminSettings?.terms_and_conditions, [
    "All phones verified against official government CEIR portal (www.ceir.gov.in).",
    "Once sold, goods cannot be returned — replacement or warranty applies as specified on the bill.",
    "Subject to local jurisdiction only.",
  ]);

  const validEmail = getValidEmail(adminSettings?.email);

  return `📱 *${bizName} - ${isBroker ? "Broker" : "Sales"} Tax Receipt*
${tagline ? `✨ _${tagline}_\n` : ""}${ownerName ? `👤 *Proprietor:* ${ownerName}\n` : ""}${udyam ? `📜 *Udyam Reg. No:* ${udyam}\n` : ""}
📋 *Invoice Details:*
• Invoice No: SALE-${imei}
• Invoice Date: ${new Date().toLocaleDateString("en-IN")}
• Sale Date: ${phone?.sold_date ? new Date(phone.sold_date).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")}

📱 *Device Details:*
• Brand: ${brand}
• Model: ${model}
• Variant: ${variant}
• Colour: ${colour}
• IMEI: \`${imei}\`
• Condition: ${condition}
• Total Amount: *₹${price.toLocaleString("en-IN")}*

👤 *Customer Information:*
• Name: ${customer?.name || "Valued Customer"}
• Mobile: ${customer?.phone || "N/A"}
• Address: ${customer?.address || "N/A"}
${customer?.id_number ? `• ID: ${(customer?.id_proof_type || "Govt").toUpperCase()} (${formatMaskedId(customer?.id_proof_type || "", customer?.id_number)})\n` : ""}${isBroker && options?.brokerName ? `• Broker/Agent: ${options.brokerName}\n` : ""}
💰 *Amount in Words:* ${numberToWords(price)} Rupees Only${bankSection}

📋 *Terms & Conditions (विक्रय शर्तें):*
${termsText}

📞 *Store Contact Information:*
${adminSettings?.address || ""}
Phone: ${adminSettings?.phone_primary || ""}${adminSettings?.phone_secondary ? ` | ${adminSettings.phone_secondary}` : ""}
${adminSettings?.whatsapp_number ? `WhatsApp: ${adminSettings.whatsapp_number}\n` : ""}${adminSettings?.instagram ? `Instagram: ${adminSettings.instagram}\n` : ""}${validEmail ? `Email: ${validEmail}\n` : ""}${adminSettings?.google_business_url ? `Store Location: ${adminSettings.google_business_url}\n` : ""}
🙏 *Thank you for purchasing with ${bizName}!*`;
}
