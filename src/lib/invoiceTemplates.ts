/**
 * Invoice / bill template engine.
 *
 * Four genuinely different print layouts (not just recoloured copies of one
 * another), all in a black-and-gold palette with no gradients so they print
 * cleanly on any inkjet, laser or thermal printer:
 *
 *  - "heritage" : an elegant letterhead bill (Vyapar-ish A4). Centred
 *                 letterhead, black title band, boxed party details, item table
 *                 with a black header, right-aligned totals.
 *  - "ledger"   : a dense, fully ruled accounting print (Tally-ish). Company on
 *                 the left, document title on the right, label/value grid,
 *                 monospaced figures and column-wise right-aligned amounts.
 *  - "receipt"  : a narrow 74 mm walk-in bill (Busy/POS style). Stacked
 *                 left-label / right-value rows, dashed separators, big total -
 *                 fits a thermal roll or prints centred on A4.
 *  - "luxury"   : an ultra-minimal dark sheet with gold accents - large photo
 *                 tiles and generous white space, for premium listings.
 *
 * The two tabs that generate invoices (InventoryTab, SoldTab) only assemble the
 * data; every layout detail lives here so the styles can never drift apart.
 */
import { numberToWords } from "@/utils/numberToWords";
import { buildSapathPatraHtml } from "./sapathPatraTemplates";

/* ------------------------------------------------------------------ palette */

const INK = "#111111";
const INK_SOFT = "#3d3a34";
const GOLD = "#C9A227";
const GOLD_SOFT = "#F1D48A";
const GOLD_DARK = "#8A6D1F";
const HAIR = "#DCD3BC";
const WASH = "#FAF7EF";

const PHOTO_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjI1MCIgdmlld0JveD0iMCAwIDI1MCAyNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyNTAiIGhlaWdodD0iMjUwIiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjEyNSIgeT0iMTI1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM2Nzc0OEIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIwLjNlbSI+SW1hZ2Ugbm90IGZvdW5kPC90ZXh0Pgo8L3N2Zz4=";

/* -------------------------------------------------------------------- types */

export type InvoiceKind = "purchase" | "sale";
export type InvoiceStyle = "heritage" | "ledger" | "receipt" | "luxury";
export type InvoicePhotoChoice = "none" | "product" | "purchase" | "both";

export interface InvoiceCustomization {
  photos: InvoicePhotoChoice;
  style: InvoiceStyle;
  broker: boolean;
  /** only read when broker is true; must be > 0 */
  brokerAmount: number;
  brokerName: string;
  includeSapathPatra?: boolean;
  action?: "pdf" | "preview" | "whatsapp";
}

export const DEFAULT_INVOICE_STYLE: InvoiceStyle = "heritage";

/** Descriptions shown in the customize dialog. */
export const INVOICE_STYLES: Array<{ id: InvoiceStyle; label: string; hint: string }> = [
  {
    id: "heritage",
    label: "Heritage (Black & Gold)",
    hint: "Centred letterhead and black banner - the polished bill you hand over",
  },
  {
    id: "ledger",
    label: "Ledger (Tally style)",
    hint: "Fully ruled grid with right-aligned figures - accounting print",
  },
  {
    id: "receipt",
    label: "Compact bill (74 mm)",
    hint: "Narrow stacked bill for a thermal roll or a quick walk-in sale",
  },
  {
    id: "luxury",
    label: "Luxury (dark & gold)",
    hint: "Ultra-minimal dark sheet with gold accents and large photo tiles",
  },
];

/** Anything unknown (or a style id from an older build) falls back to Heritage. */
export function normalizeInvoiceStyle(style: string | null | undefined): InvoiceStyle {
  return style === "ledger" || style === "receipt" || style === "luxury" ? style : "heritage";
}

/* ---------------------------------------------------------------- utilities */

export const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const inr = (value: unknown): string => {
  const n = Number(value);
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN")}`;
};

const num = (value: unknown): string => {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-IN");
};

const day = (value: unknown): string => {
  const d = value ? new Date(String(value)) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toLocaleDateString("en-IN") : d.toLocaleDateString("en-IN");
};

const titleCase = (value: unknown): string => {
  const s = String(value ?? "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "-";
};

/* ------------------------------------------------------------------ content */

/** The admin_settings fields an invoice can print. */
export interface InvoiceSettingsLike {
  business_name?: string;
  business_tagline?: string;
  address?: string;
  phone_primary?: string;
  phone_secondary?: string;
  email?: string;
  instagram?: string;
  logo_url?: string;
  signature_url?: string;
  owner_name?: string;
  udyam_number?: string;
  /** SQLite stores these flags as 0/1, so accept either shape. */
  setup_completed?: boolean | number;
  udyam_verified?: boolean | number;
  bank_name?: string;
  account_holder_name?: string;
  account_number?: string;
  ifsc_code?: string;
  terms_and_conditions?: string;
  terms_and_conditions_sale?: string;
  terms_and_conditions_purchase?: string;
}

/** A seller or customer record. */
export interface InvoicePartyLike {
  name?: string;
  phone?: string;
  address?: string;
  id_proof_type?: string;
  id_number?: string;
  photo_url?: string;
}

/** The phones row fields an invoice can print. */
export interface InvoicePhoneLike {
  phone_name?: string;
  model?: string;
  variant?: string;
  colour?: string;
  imei_number?: string;
  condition?: string;
  payment_method?: string;
  purchase_date?: string;
  sold_date?: string;
  bill_available?: boolean;
  box_available?: boolean;
  charger_available?: boolean;
  seller_photo_url?: string | null;
  seller_signature_url?: string | null;
  sapath_patra_language?: string;
  imei2_number?: string;
  sellers?: InvoicePartyLike;
  customers?: InvoicePartyLike;
}

export interface InvoiceBuildOptions {
  kind: InvoiceKind;
  style: InvoiceStyle;
  /** admin_settings row */
  settings: InvoiceSettingsLike;
  /** phones row with nested sellers / customers */
  phone: InvoicePhoneLike;
  /** final amount printed on the bill (broker override already applied) */
  amount: number;
  isBroker?: boolean;
  brokerName?: string;
  includeSapathPatra?: boolean;
  action?: "pdf" | "preview" | "whatsapp";
  photoChoice: InvoicePhotoChoice;
  productPhotos?: string[];
  documentPhotos?: string[];
  documentLabel?: string;
  terms: string[];
  fallbackTerms: string[];
}

interface PartyBlock {
  heading: string;
  photo?: string;
  rows: Array<[string, string]>;
}

interface InvoiceContent {
  kind: InvoiceKind;
  style: InvoiceStyle;
  isBroker: boolean;
  brokerName: string;
  includeSapathPatra?: boolean;
  action?: "pdf" | "preview" | "whatsapp";
  title: string;
  shortTitle: string;
  windowTitle: string;
  invoiceNo: string;
  billDateLabel: string;
  billDate: string;
  printedOn: string;
  paymentMethod: string;
  amount: number;
  amountWords: string;
  business: {
    name: string;
    tagline: string;
    address: string;
    phone1: string;
    phone2: string;
    email: string;
    instagram: string;
    udyam: string;
    logo: string;
    signature: string;
    owner: string;
  };
  parties: PartyBlock[];
  item: {
    name: string;
    model: string;
    variant: string;
    colour: string;
    imei: string;
    condition: string;
  };
  accessories: string[];
  photos: Array<{ heading: string; caption: string; urls: string[] }>;
  bank: Array<[string, string]>;
  terms: string[];
  signatures: {
    leftLabel: string;
    leftName: string;
    leftSignature?: string;
    rightLabel: string;
    rightName: string;
    rightSignature?: string;
  };
}

function collectContent(o: InvoiceBuildOptions): InvoiceContent {
  const { settings: s, phone, kind } = o;
  const isSale = kind === "sale";
  const party = isSale ? phone.customers : phone.sellers;
  const imei = phone.imei_number || "NONE";

  const accessories: string[] = [];
  if (phone.bill_available) accessories.push("Original Bill");
  if (phone.box_available) accessories.push("Original Box");
  if (phone.charger_available) accessories.push("Original Charger");

  const photos: InvoiceContent["photos"] = [];
  if (o.productPhotos?.length) {
    photos.push({ heading: "Product Photos", caption: "Photo", urls: o.productPhotos });
  }
  if (o.documentPhotos?.length) {
    photos.push({
      heading: o.documentLabel || (isSale ? "Sales Documents" : "Purchase Documents"),
      caption: "Document",
      urls: o.documentPhotos,
    });
  }

  const bank: Array<[string, string]> = [];
  if (isSale && s.bank_name && s.account_number) {
    if (s.bank_name) bank.push(["Bank", String(s.bank_name)]);
    if (s.account_holder_name) bank.push(["A/C Name", String(s.account_holder_name)]);
    if (s.account_number) bank.push(["A/C No.", String(s.account_number)]);
    if (s.ifsc_code) bank.push(["IFSC", String(s.ifsc_code)]);
  }

  const udyam = s.udyam_number && s.setup_completed && s.udyam_verified ? String(s.udyam_number) : "";

  return {
    kind,
    style: o.style,
    isBroker: !!o.isBroker,
    brokerName: o.brokerName || "",
    title: isSale ? "SALES INVOICE" : "PURCHASE INVOICE",
    shortTitle: isSale ? "SALE BILL" : "PURCHASE BILL",
    windowTitle: `${isSale ? "Sales" : "Purchase"} Invoice - ${phone.phone_name || ""}`,
    invoiceNo: `${isSale ? "SALE" : "PUR"}-${imei}`,
    billDateLabel: isSale ? "Sale Date" : "Purchase Date",
    billDate: day(isSale ? phone.sold_date : phone.purchase_date),
    printedOn: `${new Date().toLocaleDateString("en-IN")} ${new Date().toLocaleTimeString("en-IN")}`,
    paymentMethod: titleCase(phone.payment_method),
    amount: Number(o.amount) || 0,
    amountWords: numberToWords(Number(o.amount) || 0),
    business: {
      name: s.business_name || "",
      tagline: s.business_tagline || "",
      address: s.address || "",
      phone1: s.phone_primary || "",
      phone2: s.phone_secondary || "",
      email: s.email || "",
      instagram: s.instagram || "",
      udyam,
      logo: s.logo_url || "",
      signature: s.signature_url || "",
      owner: s.owner_name || "Owner",
    },
    parties: [
      {
        heading: isSale ? "Sold By" : "Purchased By",
        rows: [
          ["Business", s.business_name || "-"],
          ["Address", s.address || "-"],
          ["Phone", s.phone_primary || "-"],
          ["Email", s.email || "-"],
        ],
      },
      {
        heading: isSale ? "Customer Details" : "Seller Details",
        photo: party?.photo_url || "",
        rows: [
          ["Name", party?.name || "N/A"],
          ["Phone", party?.phone || "N/A"],
          ["Address", party?.address || "N/A"],
          ["ID Type", party?.id_proof_type || "N/A"],
          ["ID Number", party?.id_number || "N/A"],
        ],
      },
    ],
    item: {
      name: phone.phone_name || "-",
      model: phone.model || "-",
      variant: phone.variant || "-",
      colour: phone.colour || "-",
      imei,
      condition: titleCase(phone.condition),
    },
    accessories,
    photos,
    bank,
    terms: o.terms.length > 0 ? o.terms : o.fallbackTerms,
    signatures: {
      leftLabel: isSale ? "Customer Signature" : "Seller Signature",
      leftName: party?.name || (isSale ? "Customer Name" : "Seller Name"),
      leftSignature: !isSale ? (phone.seller_signature_url || "") : "",
      rightLabel: "Authorised Signatory",
      rightName: s.owner_name || "Owner",
      rightSignature: s.signature_url || "",
    },
  };
}

/* ------------------------------------------------------------- css snippets */

/** Solid colours only - no gradients anywhere in any template. */
const baseCss = `
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:#fff;color:${INK};-webkit-print-color-adjust:exact;print-color-adjust:exact}
  table{border-collapse:collapse;width:100%}
  img{max-width:100%}
`;

/**
 * Photo tiles, shared by all three designs.
 *
 * Every tile is the same size no matter what shape the photo is: the image sits
 * inside a fixed-height .frame with object-fit:contain, so a wide or a tall
 * photo is shown whole (letterboxed on white) instead of being cropped. The old
 * rule was height:190px + object-fit:cover, which cut the sides off anything
 * that was not roughly square. Images are never stretched either: the img keeps
 * its own aspect ratio and only shrinks to fit inside the frame.
 */
/* ------------------------------------------------------ 1. heritage (Vyapar) */

const photoCss = `
  .photos{margin-top:20px;break-inside:avoid;page-break-inside:avoid}
  .photos h3{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${GOLD_DARK}}
  .photos h3 span{color:${INK_SOFT};font-weight:600;letter-spacing:1px}
  .photo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,160px));gap:10px;align-items:start}
  .photo{margin:0;border:1px solid ${HAIR};background:#fff;padding:6px;border-radius:4px;text-align:center;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid;width:100%;max-width:160px}
  .photo .frame{width:100%;aspect-ratio:4/3;height:105px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f8f9fa;border-radius:3px}
  .photo img{width:100%;height:100%;object-fit:cover;display:block}
  .photo figcaption{margin-top:6px;font-size:9.5px;letter-spacing:1px;text-transform:uppercase;color:${INK_SOFT}}
`;

/* ------------------------------------------------------ 1. heritage (Vyapar) */

function renderPhotos(c: InvoiceContent, css: string): string {
  if (c.photos.length === 0) return "";
  const blocks = c.photos
    .map(
      (group) => `
      <div class="photos">
        <h3>${esc(group.heading)} <span>&middot; ${group.urls.length}</span></h3>
        <div class="photo-grid">
          ${group.urls
            .map(
              (url, i) => `
            <figure class="photo">
              <div class="frame"><img src="${esc(url)}" alt="${esc(group.heading)} ${i + 1}" onerror="this.src='${PHOTO_PLACEHOLDER}'"></div>
              <figcaption>${esc(group.caption)} ${i + 1}</figcaption>
            </figure>`
            )
            .join("")}
        </div>
      </div>`    )
    .join("");
  return css + blocks;
}


/** The fourth design: a dark, restrained letterhead for premium listings. */
function renderLuxury(c: InvoiceContent): string {
  const css = `
    html,body{margin:0;padding:0}
    body{background:#0c0d10;color:#e8e4da;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .sheet{font-family:"Segoe UI",Arial,Helvetica,sans-serif;color:#e8e4da;max-width:190mm;margin:0 auto;padding:14px 16px 22px}
    .lux-top{display:flex;align-items:center;gap:16px;padding:16px 0 12px;border-bottom:1px solid #2a2b33}
    .lux-top .icon-box{display:inline-flex;align-items:center;justify-content:center;border-radius:8px;background:#17181d;border:1px solid #2e303a;width:46px;height:46px}
    .lux-top .icon-box svg{width:24px;height:24px;color:#c9a227}
    .lux-brand{display:flex;align-items:center;gap:14px}
    .lux-brand .lux-logo{font-family:Georgia,"Times New Roman",serif;font-size:26px;font-weight:700;color:#e8e4da;line-height:1.1}
    .lux-brand .lux-logotag{font-size:10.5px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#c9a227;margin-top:3px}
    .lux-brand-meta{margin-top:12px;text-align:left;font-size:12px;line-height:1.9;color:#b3b0a2}
    .lux-brand-meta .lux-udyam{color:#c9a227;font-weight:600}
    .lux-right{display:flex;flex-direction:column;justify-content:center;align-items:flex-end;text-align:right}
    .lux-right .lux-doc{font-size:10.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c9a227}
    .lux-doc-title{font-family:Georgia,"Times New Roman",serif;font-size:25px;font-weight:700;color:#f4e8d6;margin-top:4px;line-height:1.15}
    .lux-doc-line{font-size:11px;color:#9a958a;line-height:1.7}
    .lux-doc-line b{color:#c9a227}
    .lux-badge{font-family:"Segoe UI",Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#c9a227;margin-top:6px;padding:5px 10px;background:#17181d;border:1px solid #2e303a;border-radius:6px}
    .lux-main{padding:14px 0 10px}
    .lux-party{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .lux-card{background:#111217;border:1px solid #25262e;border-radius:10px;padding:14px 15px;display:flex;flex-direction:column}
    .lux-card .lux-card-head{display:flex;align-items:center;gap:10px;color:#c9a227}
    .lux-card .lux-card-head svg{width:16px;height:16px}
    .lux-card h4{margin:0;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;font-weight:700;color:#f4e8d6}
    .lux-card .lux-body{display:flex;flex-direction:column;gap:5px;margin-top:8px}
    .lux-card .lux-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12px;border-bottom:1px solid #1c1d24;padding:4px 0}
    .lux-card .lux-row:last-child{border-bottom:none}
    .lux-card .lux-k{color:#9a958a;font-weight:600;min-width:75px;text-transform:uppercase;font-size:10px;letter-spacing:0.8px;flex-shrink:0}
    .lux-card .lux-v{color:#f4e8d6;text-align:right;word-break:break-word}
    .lux-items{border:1px solid #25262e;border-radius:10px;overflow:hidden;width:100%;border-collapse:collapse}
    .lux-card .lux-body b{display:inline-block;min-width:80px;color:#9a958a;margin-right:6px}
    .lux-item{margin-top:16px}
    .lux-items{border:1px solid #25262e;border-radius:10px;overflow:hidden}
    .lux-items thead th{background:#17181d;color:#c9a227;font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;text-align:left;padding:10px 12px;border-bottom:1px solid #25262e}
    .lux-items thead th.right{text-align:right}
    .lux-items td{padding:11px 12px;border-bottom:1px solid #25262e;font-size:12.5px;vertical-align:top}
    .lux-items td:first-child{text-align:center}
    .lux-items .name{font-weight:700;color:#f4e8d6}
    .lux-items .sub{color:#9a958a;font-size:11.5px;margin-top:2px}
    .lux-access{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12px;color:#c9c6bb}
    .lux-access .check{color:#c9a227;font-weight:700}
    .lux-bottom{margin-top:16px;display:flex;gap:14px}
    .lux-words{flex:1;border:1px solid #25262e;border-radius:10px;background:#111217;padding:13px 14px}
    .lux-words .lux-k{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c9a227;font-weight:700;margin-bottom:6px}
    .lux-words .lux-v{font-size:13px;font-style:italic;color:#f4e8d6}
    .lux-totals{width:230px;flex:none}
    .lux-totals .lux-k{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#9a958a;font-weight:700}
    .lux-totals .lux-row{padding:9px 11px;border-bottom:1px solid #25262e;font-size:12.5px}
    .lux-totals .lux-row:last-child{border-bottom:0}
    .lux-totals .lux-row .v{color:#f4e8d6;font-weight:700}
    .lux-total{background:#17181d;border:1px solid #c9a227;border-radius:8px}
    .lux-bank{margin-top:16px;border:1px solid #25262e;border-radius:10px;background:#111217}
    .lux-bank h4{margin:0;padding:11px 14px;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#c9a227;border-bottom:1px solid #25262e}
    .lux-bank .lux-body{font-size:12px;line-height:1.8;color:#c9c6bb}
    .lux-bank .lux-body b{display:inline;color:#9a958a}
    .lux-photos{margin-top:18px}
    .lux-photos .photos{margin-top:10px}
    .lux-photos .photos h3{margin:0 0 8px;font-size:10.5px;letter-spacing:1.8px;text-transform:uppercase;color:#c9a227}
    .lux-photos .photos h3 span{color:#9a958a;font-weight:600}
    .lux-photos .photo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,160px));gap:10px;align-items:start}
    .lux-photos .photo{margin:0;border:1px solid #25262e;background:#0c0d10;padding:6px;text-align:center;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid}
    .lux-photos .photo .frame{width:100%;aspect-ratio:4/3;height:105px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#14151a;border-radius:3px}
    .lux-photos .photo img{width:100%;height:100%;object-fit:cover;display:block}
    .lux-photos .photo figcaption{margin-top:6px;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#9a958a}
    .lux-terms{margin-top:18px}
    .lux-terms .terms-card{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
    .lux-terms .terms-card > div{background:#111217;border:1px solid #25262e;border-radius:10px;padding:13px}
    .lux-terms .terms-card h4{margin:0;font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:#c9a227;padding-bottom:6px;border-bottom:1px solid #25262e}
    .lux-terms .terms-card p{margin:0;font-size:11px;color:#c9c6bb;line-height:1.7}
    .lux-signs{margin-top:16px;display:flex;gap:10px}
    .lux-signs .sign{flex:1;border:1px solid #25262e;border-radius:10px;padding:14px 15px}
    .lux-signs .sign h4{margin:0;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#c9a227;padding-bottom:8px}
    .lux-signs .sign .lux-sig{color:#d4af37;font-style:italic;font-size:15px}
    .lux-signs .sign .lux-sig2{color:#c9a227;font-size:11px;margin-top:2px}
    .lux-foot{margin-top:18px;text-align:center}
    .lux-foot .lux-thanks{font-size:12.5px;font-style:italic;color:#c9c6bb}
    .lux-foot .lux-fotter{font-size:11px;color:#9a958a;margin-top:6px;line-height:1.8}
    .lux-foot .lux-pageno{color:#c9a227;font-weight:700}
    @media screen and (max-width:820px){
      .lux-party{grid-template-columns:1fr}
      .lux-top{flex-wrap:wrap}
      .lux-right{align-items:flex-start}
      .lux-bottom{flex-direction:column}
      .lux-totals{width:100%}
      .lux-terms .terms-card{grid-template-columns:1fr}
    }
    @media print{
      body{background:#0c0d10 !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
      .sheet{max-width:100% !important;padding:8mm !important}
      .lux-photos .photo{width:125px !important;max-width:125px !important;flex:0 0 125px !important}
      .lux-photos .photo .frame{height:94px !important;aspect-ratio:4/3 !important}
      .lux-photos .photo-grid{display:flex !important;flex-direction:row !important;flex-wrap:wrap !important}
    }
    `;

  const body = `
  <div class="sheet">
    <div class="lux-top">
      <div class="icon-box">
        ${c.business.logo ? `<img src="${esc(c.business.logo)}" alt="Logo" style="width:22px;height:22px" onerror="this.style.display='none'">` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="3"/><path d="M11 18h2"/></svg>`}
      </div>
      <div class="lux-brand">
        <div class="lux-logo">${esc(c.business.name)}</div>
        <div class="lux-logotag">${esc(c.business.tagline)}</div>
      </div>
      <div class="lux-brand-meta">
        ${c.business.address ? `<div><svg style="width:13px;height:13px;margin-right:6px;vertical-align:middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>${esc(c.business.address)}</div>` : ""}
        <div>
          <svg style="width:13px;height:13px;margin-right:6px;vertical-align:middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>
          ${c.business.phone1 ? `Ph: ${esc(c.business.phone1)}` : ""}${c.business.phone2 ? ` / ${esc(c.business.phone2)}` : ""}
        </div>
        <div>
          <svg style="width:13px;height:13px;margin-right:6px;vertical-align:middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z"/><polyline points="22,6 12,13 2,6"/></svg>
          ${c.business.email ? esc(c.business.email) : ""}
        </div>
        <div>
          <svg style="width:13px;height:13px;margin-right:6px;vertical-align:middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>
          ${c.business.instagram ? `@${esc(c.business.instagram)}` : ""}
        </div>
        ${c.business.udyam ? `<div class="lux-udyam">Udyam Reg. No: ${esc(c.business.udyam)}</div>` : ""}
      </div>
      <div class="lux-right">
        <div class="lux-doc">Sales Invoice</div>
        <div class="lux-doc-title">${esc(c.title)}</div>
        <div class="lux-doc-line"><b>No. :</b> ${esc(c.invoiceNo)}</div>
        <div class="lux-doc-line"><b>Dated :</b> ${esc(c.billDate)}</div>
        <div class="lux-doc-line"><b>Printed :</b> ${esc(c.printedOn)}</div>
        <div class="lux-badge">Buy &middot; Sell &middot; Exchange</div>
      </div>
    </div>

    <div class="lux-main">
      <div class="lux-party">
        <div class="lux-card">
          <div class="lux-card-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            <h4>Sold By</h4>
          </div>
          <div class="lux-body">
            <b>Business :</b> ${esc(c.business.name)}
            <b>Address :</b> ${esc(c.business.address)}
            <b>Phone :</b> ${esc(c.business.phone1)}
            <b>Email :</b> ${esc(c.business.email)}
          </div>
        </div>
        <div class="lux-card">
          <div class="lux-card-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <h4>Customer Details</h4>
          </div>
          <div class="lux-body">
            <b>Name :</b> ${esc(c.parties[1].rows[0][1])}
            <b>Phone :</b> ${esc(c.parties[1].rows[1][1])}
            <b>Address :</b> ${esc(c.parties[1].rows[2][1])}
            <b>ID Type :</b> ${esc(c.parties[1].rows[3][1])}
            <b>ID Number :</b> ${esc(c.parties[1].rows[4][1])}
          </div>
        </div>
      </div>

      <div class="lux-item">
        <table class="lux-items">
          <thead>
            <tr>
              <th style="width:42px">#</th>
              <th>Description</th>
              <th style="width:150px">IMEI</th>
              <th style="width:90px">Condition</th>
              <th class="right" style="width:110px">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>
                <div class="name">${esc(c.item.name)}</div>
                <div class="sub">Model: ${esc(c.item.model)} &nbsp;|&nbsp; Variant: ${esc(c.item.variant)} &nbsp;|&nbsp; Colour: ${esc(c.item.colour)}</div>
              </td>
              <td>${esc(c.item.imei)}</td>
              <td>
                <span style="display:inline-block;padding:3px 10px;border-radius:20px;background:#1f5c2a;border:1px solid #2e7d32;color:#e8f5e1;font-size:11px;letter-spacing:1px">${esc(c.item.condition)}</span>
              </td>
              <td class="right">${inr(c.amount)}</td>
            </tr>
          </tbody>
        </table>
        ${c.accessories.length ? `<div class="lux-access"><span class="check">&#10003;</span> ${c.accessories.map((a) => esc(a)).join(" &nbsp;&nbsp; ")}</div>` : ""}
      </div>

      <div class="lux-bottom">
        <div class="lux-words">
          <span class="lux-k">Amount in words</span>
          <span class="lux-v">Rupees ${esc(c.amountWords)} Only</span>
        </div>
        <div class="lux-totals">
          <div class="lux-row"><span class="lux-k">Sub Total</span><span class="v">${inr(c.amount)}</span></div>
          <div class="lux-row"><span class="lux-k">Payment Mode</span><span class="v">${esc(c.paymentMethod)}</span></div>
          <div class="lux-total">
            <div class="lux-row"><span class="lux-k">TOTAL</span><span class="v">${inr(c.amount)}</span></div>
          </div>
        </div>
      </div>

      ${c.bank.length ? `<div class="lux-bank">
        <h4>Bank details for payment</h4>
        <div class="lux-body">
          ${c.bank.map(([k, v]) => `<b>${esc(k)} :</b> ${esc(v)} `).join(" &nbsp;&nbsp; ")}  
        </div>
      </div>` : ""}

      <div class="lux-photos">
        ${renderPhotos(c, "")}
      </div>

      <div class="lux-terms">
        <div class="terms-card">
          <div>
            <h4>Terms &amp; conditions</h4>
            <p>${c.terms[0] || ""}</p>
          </div>
          <div>
            <h4>Customer signature</h4>
            <div class="lux-sig">${esc(c.parties[1].rows[0][1])}</div>
            <div class="lux-sig2">${esc(c.parties[1].rows[0][1])}</div>
          </div>
          <div>
            <h4>Authorised signatory</h4>
            <div class="lux-sig">${esc(c.signatures.rightName || c.business.owner || c.business.name)}</div>
            <div class="lux-sig2">${esc(c.signatures.rightLabel || "Authorised Signatory")} &middot; ${esc(c.billDate)}</div>
          </div>
        </div>
      </div>

      <div class="lux-foot">
        <div class="lux-thanks">For ${esc(c.business.name)} &mdash; thank you for your business!</div>
        <div class="lux-fotter">
          <div><svg style="width:13px;height:13px;margin-right:6px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>${esc(c.business.address)}</div>
          <div><svg style="width:13px;height:13px;margin-right:6px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>${c.business.phone1 ? `Ph: ${esc(c.business.phone1)}` : ""}</div>
          <div><svg style="width:13px;height:13px;margin-right:6px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z"/><polyline points="22,6 12,13 2,6"/></svg>${esc(c.business.email)}</div>
          <div><svg style="width:13px;height:13px;margin-right:6px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>${c.business.instagram ? `@${esc(c.business.instagram)}` : ""}</div>
        </div>        <div class="lux-pageno">Page 1 of 2</div>
      </div>
    </div>
  </div>`;

  return document(c.windowTitle, css, body);
}

function renderHeritage(c: InvoiceContent): string {
  const css = `
  .sheet{font-family:"Segoe UI",Arial,Helvetica,sans-serif;color:${INK};max-width:190mm;margin:0 auto;padding:26px 24px 34px}
  .brand{display:flex;align-items:center;justify-content:center;gap:20px;text-align:center}
  .brand img{max-height:78px;max-width:130px;object-fit:contain}
  .biz{font-family:Georgia,"Times New Roman",serif;font-size:29px;line-height:1.1;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin:0}
  .tag{margin-top:7px;font-size:11.5px;font-weight:600;letter-spacing:5px;text-transform:uppercase;color:${GOLD_DARK}}
  .brand-meta{margin-top:12px;text-align:center;font-size:12.5px;color:${INK_SOFT};line-height:1.7}
  .brand-meta .udyam{color:${GOLD_DARK};font-weight:600}
  .goldline{margin:15px 0 0;border-top:2px solid ${INK};height:3px;border-bottom:1px solid ${GOLD}}
  .titleband{margin-top:15px;background:${INK};color:${GOLD_SOFT};text-align:center;font-size:14.5px;font-weight:700;letter-spacing:5px;text-transform:uppercase;padding:9px 12px}
  .meta-strip{display:flex;border:1px solid ${HAIR};border-top:0;background:${WASH}}
  .meta-strip div{flex:1;padding:9px 12px;border-left:1px solid ${HAIR}}
  .meta-strip div:first-child{border-left:0}
  .meta-strip .k{font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;color:${GOLD_DARK};font-weight:700}
  .meta-strip .v{font-size:13px;font-weight:600;margin-top:3px;word-break:break-word}
  .parties{display:flex;gap:16px;margin-top:22px}
  .parties .box{flex:1;border:1px solid ${HAIR};min-width:0}
  .parties .box h4{margin:0;background:${INK};color:${GOLD_SOFT};font-size:10.5px;letter-spacing:2.4px;text-transform:uppercase;padding:7px 11px;font-weight:700}
  .parties .body{padding:10px 11px;position:relative}
  .parties .row{font-size:12.5px;line-height:1.75;display:flex;gap:6px}
  .parties .row b{min-width:70px;color:${INK_SOFT};font-weight:600}
  .parties .row span{flex:1;word-break:break-word}
  .party-photo{position:absolute;top:9px;right:9px;width:64px;height:64px;object-fit:contain;background:${WASH};border:1px solid ${HAIR}}
  .items{margin-top:24px;font-size:12.5px}
  .items thead th{background:${INK};color:${GOLD_SOFT};text-align:left;padding:9px 10px;font-size:10.5px;letter-spacing:1.6px;text-transform:uppercase}
  .items thead th.right{text-align:right}
  .items td{padding:11px 10px;border-bottom:1px solid ${HAIR};vertical-align:top}
  .items td.right{text-align:right;font-weight:700;white-space:nowrap}
  .items .name{font-weight:700}
  .items .sub{color:${INK_SOFT};font-size:11.5px;margin-top:3px}
  .items tbody tr:last-child td{border-bottom:1px solid ${INK}}
  .accessories{margin-top:16px;border-left:3px solid ${GOLD};background:${WASH};padding:10px 13px;font-size:12px}
  .accessories b{letter-spacing:1px;text-transform:uppercase;font-size:10.5px;color:${GOLD_DARK}}
  .bottom{margin-top:20px;display:flex;gap:20px;align-items:flex-start}
  .words{flex:1;border:1px solid ${HAIR};background:${WASH};padding:12px 13px;font-size:12.5px;line-height:1.6}
  .words .k{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:${GOLD_DARK};font-weight:700;display:block;margin-bottom:4px}
  .words .v{font-style:italic;font-weight:600}
  .totals{width:250px;flex:none;font-size:13px}
  .totals td{padding:8px 11px;border:1px solid ${HAIR}}
  .totals td:last-child{text-align:right;font-weight:700;white-space:nowrap}
  .totals tr.total td{background:${INK};color:${GOLD_SOFT};border-color:${INK};font-size:16px;letter-spacing:1px}
  .panel{margin-top:22px;border:1px solid ${HAIR}}
  .panel h4{margin:0;background:${WASH};border-bottom:1px solid ${HAIR};color:${GOLD_DARK};font-size:10.5px;letter-spacing:2.2px;text-transform:uppercase;padding:8px 12px}
  .panel .panel-body{padding:12px 13px;font-size:12.5px}
  .bank-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:6px 18px}
  .bank-grid div{display:flex;gap:8px}
  .bank-grid b{color:${INK_SOFT};font-weight:600;min-width:72px}
  .terms ol{margin:0;padding-left:18px;font-size:12px;line-height:1.75}
  .terms li{margin-bottom:4px}
  .signs{margin-top:26px;display:flex;gap:56px}
  .signs .sign{flex:1;text-align:center;font-size:12px}
  .signs .space{height:50px}
  .signs img{max-height:52px;margin-bottom:6px}
  .signs .line{border-top:1px solid ${INK};margin-bottom:6px}
  .signs .role{font-weight:700;letter-spacing:1.4px;text-transform:uppercase;font-size:10.5px;color:${GOLD_DARK}}
  .signs .who{color:${INK_SOFT};margin-top:3px}
  .foot{margin-top:26px;border-top:1px solid ${GOLD};padding-top:12px;text-align:center;font-size:12px;color:${INK_SOFT};line-height:1.7}
  .foot .thanks{font-size:13.5px;font-weight:700;color:${INK};letter-spacing:1px}
  ${photoCss}
  @page{size:A4;margin:11mm}
  @media print{ body{padding:0} .sheet{padding:0} }
  /* On a phone (the invoice is often opened from WhatsApp) stack the columns
     instead of letting them squash. Print output is untouched. */
  @media screen and (max-width:680px){
    .sheet{padding:14px 12px 22px}
    .biz{font-size:22px}
    .meta-strip{flex-wrap:wrap}
    .meta-strip div{flex:1 1 45%;border-top:1px solid ${HAIR}}
    .parties{flex-direction:column}
    .bottom{flex-direction:column}
    .totals{width:100%}
    .items th,.items td{padding:7px 5px;word-break:break-word}
    .items thead th{font-size:9px;letter-spacing:1px}
    .signs{gap:24px}
  }
`;
  const body = `
<div class="sheet">
  <div class="brand">
    ${c.business.logo ? `<img src="${esc(c.business.logo)}" alt="Logo" onerror="this.style.display='none'">` : ""}
    <div>
      <h1 class="biz">${esc(c.business.name)}</h1>
      ${c.business.tagline ? `<div class="tag">${esc(c.business.tagline)}</div>` : ""}
    </div>
  </div>
  <div class="brand-meta">
    ${c.business.address ? `<div>${esc(c.business.address)}</div>` : ""}
    <div>
      ${c.business.phone1 ? `Ph: ${esc(c.business.phone1)}` : ""}
      ${c.business.phone2 ? ` | ${esc(c.business.phone2)}` : ""}
      ${c.business.email ? ` | ${esc(c.business.email)}` : ""}
      ${c.business.instagram ? ` | @${esc(c.business.instagram)}` : ""}
    </div>
    ${c.business.udyam ? `<div class="udyam">Udyam Reg. No: ${esc(c.business.udyam)}</div>` : ""}
  </div>
  <div class="goldline"></div>

  <div class="titleband">${esc(c.title)}${c.isBroker ? " &middot; BROKER COPY" : ""}</div>

  <div class="meta-strip">
    <div><div class="k">Invoice No.</div><div class="v">${esc(c.invoiceNo)}</div></div>
    <div><div class="k">${esc(c.billDateLabel)}</div><div class="v">${esc(c.billDate)}</div></div>
    <div><div class="k">Payment Mode</div><div class="v">${esc(c.paymentMethod)}</div></div>
    <div><div class="k">Printed On</div><div class="v">${esc(c.printedOn)}</div></div>
  </div>

  <div class="parties">
    ${c.parties.map(
    (p) => `
      <div class="box">
        <h4>${esc(p.heading)}</h4>
        <div class="body">
          ${p.photo ? `<img class="party-photo" src="${esc(p.photo)}" alt="" onerror="this.style.display='none'">` : ""}
          ${p.rows.map(([k, v]) => `<div class="row"><b>${esc(k)}:</b><span>${esc(v)}</span></div>`).join("")}
        </div>
      </div>`
  ).join("")}
  </div>

  ${c.isBroker ? `<div style="margin-top:16px;font-size:12.5px"><b>Issued through:</b> ${esc(c.brokerName || "Broker")}</div>` : ""}

  <table class="items">
    <thead>
      <tr>
        <th style="width:38px">#</th>
        <th>Description</th>
        <th style="width:150px">IMEI</th>
        <th style="width:90px">Condition</th>
        <th class="right" style="width:110px">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>
          <div class="name">${esc(c.item.name)}</div>
          <div class="sub">Model: ${esc(c.item.model)} &nbsp;|&nbsp; Variant: ${esc(c.item.variant)} &nbsp;|&nbsp; Colour: ${esc(c.item.colour)}</div>
        </td>
        <td>${esc(c.item.imei)}</td>
        <td>${esc(c.item.condition)}</td>
        <td class="right">${inr(c.amount)}</td>
      </tr>
    </tbody>
  </table>

  ${c.accessories.length ? `<div class="accessories"><b>Accessories included:</b> ${c.accessories.map((a) => `&#10003; ${esc(a)}`).join(" &nbsp;&nbsp; ")}</div>` : ""}

  <div class="bottom">
    <div class="words">
      <span class="k">Amount in words</span>
      <span class="v">Rupees ${esc(c.amountWords)} Only</span>
    </div>
    <table class="totals">
      <tr><td>Sub Total</td><td>${inr(c.amount)}</td></tr>
      <tr class="total"><td>TOTAL</td><td>${inr(c.amount)}</td></tr>
    </table>
  </div>

  ${c.bank.length ? `
  <div class="panel">
    <h4>Bank details for payment</h4>
    <div class="panel-body bank-grid">
      ${c.bank.map(([k, v]) => `<div><b>${esc(k)}:</b><span>${esc(v)}</span></div>`).join("")}
    </div>
  </div>` : ""}

  ${renderPhotos(c, "")}

  <div class="panel terms">
    <h4>Terms &amp; conditions</h4>
    <div class="panel-body">
      <ol>${c.terms.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
    </div>
  </div>

  <div class="signs">
    <div class="sign">
      <div class="space">${c.signatures.leftSignature ? `<img src="${esc(c.signatures.leftSignature)}" alt="Signature" style="max-height:50px;object-fit:contain;" onerror="this.style.display='none'">` : ""}</div>
      <div class="line"></div>
      <div class="role">${esc(c.signatures.leftLabel)}</div>
      <div class="who">${esc(c.signatures.leftName)}</div>
    </div>
    <div class="sign">
      <div class="space">${c.business.signature ? `<img src="${esc(c.business.signature)}" alt="Signature" onerror="this.style.display='none'">` : ""}</div>
      <div class="line"></div>
      <div class="role">${esc(c.signatures.rightLabel)}</div>
      <div class="who">${esc(c.signatures.rightName)} &middot; ${esc((/* @__PURE__ */ new Date()).toLocaleDateString("en-IN"))}</div>
    </div>
  </div>

  <div class="foot">
    <div class="thanks">Thank you for your business!</div>
    <div>
      ${c.business.address ? `${esc(c.business.address)}<br>` : ""}
      ${c.business.phone1 ? `Ph: ${esc(c.business.phone1)}${c.business.phone2 ? ` / ${esc(c.business.phone2)}` : ""}` : ""}${c.business.email ? ` &nbsp;|&nbsp; ${esc(c.business.email)}` : ""}
    </div>
  </div>
</div>`;
  return document(c.windowTitle, css, body);
}
function renderLedger(c: InvoiceContent): string {
  const css = `
  .sheet{font-family:"Segoe UI",Arial,sans-serif;color:${INK};max-width:196mm;margin:0 auto;padding:20px 18px 30px}
  .goldline{border-top:4px solid ${GOLD};border-bottom:2px solid ${INK}}
  .box{border:2px solid ${INK};border-top:0}
  .head{display:flex;justify-content:space-between;gap:18px;padding:12px 14px;border-bottom:2px solid ${INK}}
  .co-name{font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;line-height:1.25}
  .co-meta{font-size:11.5px;color:${INK_SOFT};margin-top:3px;line-height:1.6}
  .doc{text-align:right;flex:none}
  .doc-title{font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${GOLD_DARK}}
  .doc-line{font-family:"Consolas","Courier New",monospace;font-size:11.5px;margin-top:4px;color:${INK}}
  .grid{font-size:12px;border-bottom:2px solid ${INK}}
  .grid th{width:14%;background:#F2EFE7;border-right:1px solid ${INK};border-bottom:1px solid ${INK};text-align:left;padding:6px 9px;font-size:10px;letter-spacing:1.3px;text-transform:uppercase;font-weight:700;color:${INK_SOFT};vertical-align:top}
  .grid td{border-right:1px solid ${INK};border-bottom:1px solid ${INK};padding:6px 9px;vertical-align:top;word-break:break-word}
  .grid td:last-child,.grid th:last-child{border-right:0}
  .grid tr:last-child th,.grid tr:last-child td{border-bottom:0}
  .photo-cell img{width:56px;height:56px;object-fit:contain;background:#fff;border:1px solid ${GOLD};float:right}
  .items{font-size:12px}
  .items th{border:1px solid ${INK};background:#F2EFE7;padding:7px 8px;font-size:10px;letter-spacing:1.3px;text-transform:uppercase;text-align:left;font-weight:700;color:${INK_SOFT}}
  .items td{border:1px solid ${INK};padding:8px;vertical-align:top}
  .items .num{text-align:right;font-family:"Consolas","Courier New",monospace;white-space:nowrap}
  .items .desc b{display:block}
  .items .desc span{display:block;color:${INK_SOFT};font-size:11.5px;margin-top:2px}
  .items tfoot td{border:1px solid ${INK}}
  .items tfoot .label{text-align:right;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;font-size:11px}
  .items tfoot .grand td{background:${INK};color:${GOLD_SOFT};font-weight:700}
  .items tfoot .grand .num{font-size:15px}
  .items tfoot .words{font-style:italic;font-size:11.5px}
  .cols{display:flex;gap:0;border:2px solid ${INK};border-top:0}
  .cols .col{flex:1;border-right:1px solid ${INK}}
  .cols .col:last-child{border-right:0}
  .cols h4{margin:0;background:#F2EFE7;border-bottom:1px solid ${INK};font-size:10px;letter-spacing:1.6px;text-transform:uppercase;padding:6px 10px;color:${INK_SOFT}}
  .cols .col-body{padding:9px 10px;font-size:12px;line-height:1.7}
  .kv{display:flex;gap:8px}
  .kv b{min-width:78px;color:${INK_SOFT};font-weight:600}
  .kv span{flex:1;word-break:break-word}
  .terms-list{margin:0;padding-left:16px;font-size:11.5px;line-height:1.7}
  .terms-list li{margin-bottom:3px}
  .signs{display:flex;border:2px solid ${INK};border-top:0}
  .signs .sign{flex:1;padding:10px 12px 12px;border-right:1px solid ${INK};text-align:center}
  .signs .sign:last-child{border-right:0}
  .signs .gap{height:52px}
  .signs img{max-height:48px;margin-bottom:4px}
  .signs .line{border-top:1px solid ${INK};margin-bottom:5px}
  .signs .role{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;font-weight:700;color:${GOLD_DARK}}
  .signs .who{font-size:11.5px;color:${INK_SOFT};margin-top:2px}
  .foot{display:flex;justify-content:space-between;gap:10px;border:2px solid ${INK};border-top:0;background:${WASH};padding:8px 12px;font-size:11px;color:${INK_SOFT}}
  .foot b{color:${INK}}
  ${photoCss}
  .photo-grid{grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
  .photo .frame{height:126px}
  .photos{border:2px solid ${INK};border-top:0;padding:10px 12px;margin-top:0}
  .photos h3{border-bottom:1px solid ${INK};padding-bottom:6px}
  @page{size:A4;margin:10mm}
  @media print{ body{padding:0} .sheet{padding:0} }
  @media screen and (max-width:680px){
    .sheet{padding:12px 10px 20px}
    .head{flex-direction:column}
    .doc{text-align:left}
    .grid th{word-break:break-word}
    .cols{flex-direction:column}
    .cols .col{border-right:0;border-bottom:1px solid ${INK}}
    .cols .col:last-child{border-bottom:0}
    .items th,.items td{padding:6px 4px;word-break:break-word}
    .items .num{font-size:10.5px}
  }
`;
  const kvRows = [
    [c.parties[1].heading, c.parties[1].rows[0][1]],
    ["Phone", c.parties[1].rows[1][1]],
    ["ID Proof", `${c.parties[1].rows[3][1]} / ${c.parties[1].rows[4][1]}`],
    ["Address", c.parties[1].rows[2][1]],
    [c.billDateLabel, c.billDate],
    ["Payment Mode", c.paymentMethod]
  ];
  const body = `
<div class="sheet">
  <div class="goldline"></div>
  <div class="box">
    <div class="head">
      <div>
        <div class="co-name">${esc(c.business.name)}</div>
        ${c.business.tagline ? `<div class="co-meta">${esc(c.business.tagline)}</div>` : ""}
        ${c.business.address ? `<div class="co-meta">${esc(c.business.address)}</div>` : ""}
        <div class="co-meta">
          ${c.business.phone1 ? `Ph: ${esc(c.business.phone1)}` : ""}${c.business.phone2 ? ` / ${esc(c.business.phone2)}` : ""}${c.business.email ? ` &nbsp;|&nbsp; ${esc(c.business.email)}` : ""}${c.business.instagram ? ` &nbsp;|&nbsp; @${esc(c.business.instagram)}` : ""}
        </div>
        ${c.business.udyam ? `<div class="co-meta">Udyam Reg. No: ${esc(c.business.udyam)}</div>` : ""}
      </div>
      <div class="doc">
        <div class="doc-title">${esc(c.title)}</div>
        <div class="doc-line">No. : ${esc(c.invoiceNo)}</div>
        <div class="doc-line">Dated : ${esc(c.billDate)}</div>
        <div class="doc-line">Printed : ${esc(c.printedOn)}</div>
        ${c.isBroker ? `<div class="doc-line">Broker : ${esc(c.brokerName || "Broker")}</div>` : ""}
      </div>
    </div>

    <table class="grid">
      ${kvRows.map(
    ([k, v]) => `<tr><th>${esc(k)}</th><td colspan="3">${esc(v)}</td></tr>`
  ).join("")}
    </table>

    <table class="items">
      <thead>
        <tr>
          <th style="width:42px" class="num">S.No</th>
          <th>Description of goods</th>
          <th style="width:150px">IMEI No.</th>
          <th style="width:80px">Qty</th>
          <th style="width:110px" class="num">Rate</th>
          <th style="width:120px" class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="num">1</td>
          <td class="desc">
            <b>${esc(c.item.name)}</b>
            <span>Model: ${esc(c.item.model)} &middot; Variant: ${esc(c.item.variant)} &middot; Colour: ${esc(c.item.colour)}</span>
            <span>Condition: ${esc(c.item.condition)}${c.accessories.length ? ` &middot; With: ${c.accessories.map((a) => esc(a)).join(", ")}` : ""}</span>
          </td>
          <td>${esc(c.item.imei)}</td>
          <td class="num">1</td>
          <td class="num">${num(c.amount)}</td>
          <td class="num">${num(c.amount)}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="grand">
          <td colspan="5" class="label">Total</td>
          <td class="num">${num(c.amount)}</td>
        </tr>
        <tr>
          <td colspan="6" class="words">Amount (in words): Rupees ${esc(c.amountWords)} Only</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="cols">
    ${c.bank.length ? `<div class="col">
      <h4>Bank details</h4>
      <div class="col-body">
        ${c.bank.map(([k, v]) => `<div class="kv"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join("")}
      </div>
    </div>` : ""}
    <div class="col">
      <h4>Amount</h4>
      <div class="col-body">
        <div class="kv"><b>Total</b><span><b>${inr(c.amount)}</b></span></div>
        <div class="kv"><b>Payment</b><span>${esc(c.paymentMethod)}</span></div>
      </div>
    </div>
  </div>

  <div class="cols">
    <div class="col">
      <h4>Terms &amp; conditions</h4>
      <div class="col-body">
        <ol class="terms-list">${c.terms.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
      </div>
    </div>
  </div>

  ${renderPhotos(c, "")}

  <div class="signs">
    <div class="sign">
      <div class="gap">${c.signatures.leftSignature ? `<img src="${esc(c.signatures.leftSignature)}" alt="Signature" style="max-height:48px;object-fit:contain;" onerror="this.style.display='none'">` : ""}</div>
      <div class="line"></div>
      <div class="role">${esc(c.signatures.leftLabel)}</div>
      <div class="who">${esc(c.signatures.leftName)}</div>
    </div>
    <div class="sign">
      <div class="gap">${c.business.signature ? `<img src="${esc(c.business.signature)}" alt="Signature" onerror="this.style.display='none'">` : ""}</div>
      <div class="line"></div>
      <div class="role">${esc(c.signatures.rightLabel)}</div>
      <div class="who">${esc(c.signatures.rightName)}</div>
    </div>
  </div>

  <div class="foot">
    <span><b>For ${esc(c.business.name)}</b> &mdash; thank you for your business.</span>
    <span>${c.business.phone1 ? `Ph: ${esc(c.business.phone1)}` : ""}${c.business.email ? ` &middot; ${esc(c.business.email)}` : ""}</span>
  </div>
</div>`;
  return document(c.windowTitle, css, body);
}
function renderReceipt(c: InvoiceContent): string {
  const css = `
  body{font-family:"Segoe UI",Consolas,Arial,sans-serif}
  .bill{width:74mm;margin:0 auto;padding:10px 8px 14px;font-size:11px;color:${INK}}
  .co{text-align:center;font-size:15px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;line-height:1.3}
  .tag{text-align:center;font-size:9.5px;letter-spacing:2.6px;text-transform:uppercase;color:${GOLD_DARK};margin-top:3px}
  .meta{text-align:center;font-size:9.5px;color:${INK_SOFT};line-height:1.55;margin-top:2px}
  .bar{border-top:3px solid ${GOLD};margin-top:7px}
  .doc{text-align:center;font-size:11.5px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;padding:6px 0 0}
  .sep{border-top:1px dashed ${INK};margin:7px 0}
  .heavier{border-top:2px solid ${INK}}
  .kv{display:flex;gap:6px;justify-content:space-between;line-height:1.65}
  .kv .k{color:${INK_SOFT}}
  .kv .v{text-align:right;font-weight:600;word-break:break-word;max-width:62%}
  .lbl{font-size:9.5px;letter-spacing:2px;text-transform:uppercase;color:${GOLD_DARK};font-weight:700;margin-bottom:3px}
  .item{font-weight:700;font-size:12px;line-height:1.4}
  .sub{color:${INK_SOFT};font-size:10px;margin-top:2px}
  .total{display:flex;justify-content:space-between;align-items:baseline;font-weight:700;font-size:14px;letter-spacing:1px}
  .total .amt{font-size:16px}
  .words{font-size:10px;font-style:italic;color:${INK_SOFT};margin-top:3px}
  .note{font-size:10px;line-height:1.6}
  ol.terms{margin:0;padding-left:15px;font-size:10px;line-height:1.6}
  ol.terms li{margin-bottom:2px}
  .signs{display:flex;justify-content:space-between;gap:10px;margin-top:26px;font-size:9.5px;text-align:center}
  .signs .sign{flex:1}
  .signs .line{border-top:1px solid ${INK};margin-bottom:4px}
  .signs .role{letter-spacing:1.2px;text-transform:uppercase;color:${GOLD_DARK};font-weight:700}
  .thanks{text-align:center;margin-top:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;font-size:10.5px}
  ${photoCss}
  .photos{margin-top:10px}
  .photos h3{font-size:9.5px;letter-spacing:1.6px;margin-bottom:6px}
  .photo-grid{grid-template-columns:1fr;gap:8px}
  .photo{padding:5px}
  .photo .frame{height:38mm}
  .photo figcaption{font-size:9px;letter-spacing:1px;margin-top:4px}
  @page{size:74mm auto;margin:4mm}
  @media print{ body{padding:0} .bill{width:auto;padding:0} }
`;
  const kv = (k, v) => `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
  const party = c.parties[1];
  const body = `
<div class="bill">
  <div class="co">${esc(c.business.name)}</div>
  ${c.business.tagline ? `<div class="tag">${esc(c.business.tagline)}</div>` : ""}
  ${c.business.address ? `<div class="meta">${esc(c.business.address)}</div>` : ""}
  <div class="meta">
    ${c.business.phone1 ? `Ph: ${esc(c.business.phone1)}` : ""}${c.business.phone2 ? ` / ${esc(c.business.phone2)}` : ""}
  </div>
  ${c.business.email || c.business.instagram ? `<div class="meta">${c.business.email ? esc(c.business.email) : ""}${c.business.instagram ? ` | @${esc(c.business.instagram)}` : ""}</div>` : ""}
  <div class="bar"></div>

  <div class="doc">${esc(c.shortTitle)}${c.isBroker ? " (BROKER)" : ""}</div>
  <div class="sep"></div>
  ${kv("Bill No.", c.invoiceNo)}
  ${kv(c.billDateLabel, c.billDate)}
  ${kv("Payment", c.paymentMethod)}
  ${c.isBroker ? kv("Broker", c.brokerName || "Broker") : ""}
  <div class="sep"></div>

  <div class="lbl">${esc(party.heading)}</div>
  ${kv("Name", party.rows[0][1])}
  ${kv("Phone", party.rows[1][1])}
  ${kv("Address", party.rows[2][1])}
  ${kv(party.rows[3][0], party.rows[3][1])}
  ${kv(party.rows[4][0], party.rows[4][1])}
  <div class="sep"></div>

  <div class="lbl">Item</div>
  <div class="item">${esc(c.item.name)}</div>
  <div class="sub">${esc(c.item.model)} &middot; ${esc(c.item.variant)} &middot; ${esc(c.item.colour)} &middot; ${esc(c.item.condition)}</div>
  ${kv("IMEI", c.item.imei)}
  ${kv("Qty", "1")}
  ${c.accessories.length ? kv("With", c.accessories.join(", ")) : ""}
  <div class="sep"></div>
  <div class="total"><span>TOTAL</span><span class="amt">${inr(c.amount)}</span></div>
  <div class="words">Rupees ${esc(c.amountWords)} Only</div>
  <div class="sep heavier"></div>

  ${c.bank.length ? `<div class="lbl">Bank</div>${c.bank.map(([k, v]) => kv(k, v)).join("")}<div class="sep"></div>` : ""}

  <div class="lbl">Terms</div>
  <ol class="terms">${c.terms.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>

  ${renderPhotos(c, "")}

  <div class="signs">
    <div class="sign">
      ${c.signatures.leftSignature ? `<img src="${esc(c.signatures.leftSignature)}" alt="Signature" style="max-height:36px;object-fit:contain;margin-bottom:4px;" onerror="this.style.display='none'">` : ""}
      <div class="line"></div>
      <div class="role">${esc(c.signatures.leftLabel)}</div>
    </div>
    <div class="sign">
      ${c.business.signature ? `<img src="${esc(c.business.signature)}" alt="Signature" style="max-height:36px;object-fit:contain;margin-bottom:4px;" onerror="this.style.display='none'">` : ""}
      <div class="line"></div>
      <div class="role">${esc(c.signatures.rightLabel)}</div>
    </div>
  </div>

  <div class="thanks">Thank you! Visit again</div>
</div>`;
  return document(c.windowTitle, css, body);
}

function document(title: string, css: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
${baseCss}
${css}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/* ------------------------------------------------------------ entry point */

export function buildInvoiceHtml(options: InvoiceBuildOptions): string {
  const content = collectContent(options);
  let baseHtml = "";
  switch (normalizeInvoiceStyle(options.style)) {
    case "ledger":
      baseHtml = renderLedger(content);
      break;
    case "receipt":
      baseHtml = renderReceipt(content);
      break;
    case "luxury":
      baseHtml = renderLuxury(content);
      break;
    default:
      baseHtml = renderHeritage(content);
      break;
  }

  if (options.kind === "purchase" && options.includeSapathPatra) {
    const s = options.settings;
    const p = options.phone;
    const seller = p.sellers;
    const sapathHtml = buildSapathPatraHtml({
      shopName: s?.business_name || "PhoneZone",
      shopAddress: s?.address || "",
      shopPhone: s?.phone_primary || "",
      shopLogoUrl: s?.logo_url || "",
      shopSignatureUrl: s?.signature_url || "",
      refNo: `PUR-${p.imei_number || "NONE"}`,
      date: p.purchase_date ? new Date(p.purchase_date).toLocaleDateString() : new Date().toLocaleDateString(),
      amount: options.amount,
      sellerName: seller?.name || "N/A",
      sellerPhone: seller?.phone || "N/A",
      sellerAddress: seller?.address || "N/A",
      idProofType: seller?.id_proof_type || "Aadhaar",
      idNumber: seller?.id_number || "N/A",
      sellerPhotoUrl: p.seller_photo_url || null,
      sellerSignatureUrl: p.seller_signature_url || null,
      brand: p.phone_name || "",
      model: p.model || "",
      variant: p.variant || "",
      colour: p.colour || "",
      imei1: p.imei_number || "",
      imei2: p.imei2_number || "",
      condition: p.condition || "good",
      language: (p.sapath_patra_language as any) || "both",
    });

    const styleMatch = sapathHtml.match(/<style>([\s\S]*?)<\/style>/i);
    const bodyMatch = sapathHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      const extraCss = styleMatch ? `<style>${styleMatch[1]}</style>` : "";
      const extraBody = `<div style="page-break-before: always;" class="sapath-page-break"></div>${bodyMatch[1]}`;
      return baseHtml.replace("</body>", `${extraCss}${extraBody}</body>`);
    }
  }

  return baseHtml;
}

/* ------------------------------------------------------- default T & C text */

export const DEFAULT_SALE_TERMS: string[] = [
  "All phones has been checked for stolen/blocked report from official government website www.ceir.gov.in",
  "If in any case phone is marked as Lost/Stolen/Blacklisted then seller is responsible for it.",
  "Good once sold cannot be taken back only exchange (if mentioned on bill) in certain cases only.",
  "Subject to local jurisdiction only.",
];

export const DEFAULT_PURCHASE_TERMS: string[] = [
  "All phones has been checked for stolen/blocked report from official government website www.ceir.gov.in",
  "If in any case phone is marked as Lost/Stolen/Blacklisted then seller is responsible for it.",
  "Subject to local jurisdiction (Sitapur) only.",
];
