/**
 * Aadhaar Secure QR - offline decode (Step 3 accuracy booster).
 *
 * Every modern Aadhaar card (PVC, e-Aadhaar print, letter) carries a "Secure
 * QR" whose payload is a huge decimal number. Offline decoding is fully
 * documented by UIDAI and implemented by pyaadhaar:
 *
 *   decimal string -> BigInt -> big-endian bytes -> gzip inflate
 *   -> fields separated by byte 255:
 *      [version?] email_mobile_status, referenceid, name, dob, gender,
 *      careof, district, landmark, house, location, pincode, postoffice,
 *      state, street, subdistrict, vtc [, last4 of mobile] , photo(JPEG), signature(256B)
 *
 * Old (pre-secure) cards instead carry plain XML - we handle that too.
 *
 * The QR holds the FULL 12-digit number reference (referenceid starts with the
 * last 4 digits) plus exact name/dob/gender/address - no OCR errors at all.
 * Everything runs in the browser; nothing leaves the machine.
 */
import { inflate } from "pako";
import jsQR from "jsqr";

export interface AadhaarQrData {
  idNumber: string; // full 12-digit number
  name?: string;
  dob?: string; // YYYY-MM-DD when a full DOB is known
  yob?: string; // YYYY when only the birth year is known
  gender?: "male" | "female" | "transgender";
  address?: string;
  mobileMasked?: string; // last 4 digits (V3+ QRs)
  referenceId?: string;
  photoBytes?: Uint8Array; // embedded JPEG of the card holder
  kind: "secure" | "legacy";
}

const normGender = (g?: string): AadhaarQrData["gender"] | undefined => {
  const s = (g || "").trim().toLowerCase();
  if (s.startsWith("m")) return "male";
  if (s.startsWith("f")) return "female";
  if (s.startsWith("t")) return "transgender";
  return undefined;
};

const pad2 = (n: string | number) => String(n).padStart(2, "0");

/** "01-01-2005" | "01/01/2005" | "2005" -> ISO date or year. */
const parseDob = (raw?: string): { dob?: string; yob?: string } => {
  const s = (raw || "").trim();
  if (!s) return {};
  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return { dob: `${m[3]}-${pad2(m[2])}-${pad2(m[1])}` };
  m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return { dob: `${m[1]}-${pad2(m[2])}-${pad2(m[3])}` };
  m = s.match(/^(\d{4})$/);
  if (m) return { yob: m[1] };
  return {};
};

const joinAddress = (f: Record<string, string>): string => {
  const order = ["careof", "house", "street", "landmark", "location", "vtc", "postoffice", "district", "subdistrict", "state", "pincode"];
  const parts = order.map((k) => (f[k] || "").trim().replace(/\s*-\s*$/, "")).filter(Boolean);
  // de-duplicate consecutive identical parts (UIDAI data often repeats)
  const out: string[] = [];
  for (const p of parts) {
    if (!out.length || out[out.length - 1].toLowerCase() !== p.toLowerCase()) out.push(p);
  }
  return out.join(", ");
};

/** Decode a gzip+255-delimited Secure QR payload (bytes after inflate). */
export const parseSecureQrBytes = (bytes: Uint8Array): AadhaarQrData | null => {
  const text = (start: number, end: number) =>
    new TextDecoder("iso-8859-1").decode(bytes.slice(start, end));

  // Delimiter positions of byte 255.
  const delim: number[] = [-1];
  for (let i = 0; i < bytes.length; i++) if (bytes[i] === 255) delim.push(i);

  // Fields: [version?] status, ref, name, dob, gender, careof, district,
  // landmark, house, location, pincode, postoffice, state, street,
  // subdistrict, vtc [, last4mobile]
  const names = ["email_mobile_status", "referenceid", "name", "dob", "gender", "careof", "district", "landmark", "house", "location", "pincode", "postoffice", "state", "street", "subdistrict", "vtc"];
  const f: Record<string, string> = {};
  const versionMarker = text(delim[0] + 1, delim[1] ?? delim[0] + 1);
  const isVersioned = /^V\d/.test(versionMarker);
  const fields = isVersioned ? ["version", ...names, "last_4_digits_mobile_no"] : names;

  if (delim.length < fields.length) return null; // not enough separators
  for (let i = 0; i < fields.length; i++) {
    f[fields[i]] = text(delim[i] + 1, delim[i + 1]);
  }

  const ref = f.referenceid || "";
  if (!/^\d{4,}/.test(ref)) return null; // reference id must start with digits

  // referenceid = last4 of Aadhaar + day+month+year of birth + 2-digit version
  // e.g. "3456" + "42" + "0201" + "07" -> last digit of the number is ref[3].
  const last4 = ref.slice(0, 4);
  const { dob, yob } = parseDob(f.dob);

  const addr = joinAddress(f);
  return {
    idNumber: "", // assembled by caller from OCR number + last4
    name: (f.name || "").trim() || undefined,
    dob,
    yob,
    gender: normGender(f.gender),
    address: addr || undefined,
    mobileMasked: f.last_4_digits_mobile_no?.trim() || undefined,
    referenceId: ref,
    kind: "secure",
  };
};

/** Legacy QR: plain XML with all fields as attributes. */
export const parseLegacyQrXml = (xml: string): AadhaarQrData | null => {
  if (!/<\?xml|<Aadhaar|PrintLetterBarcodeData/i.test(xml)) return null;
  const attr = (k: string) => xml.match(new RegExp(`${k}="([^"]*)"`))?.[1];
  const uid = (attr("uid") || "").replace(/\D/g, "");
  if (uid.length !== 12) return null;
  const { dob, yob } = parseDob(attr("dob"));
  const addr = [
    attr("careof"), attr("house"), attr("street"), attr("landmark"),
    attr("loc"), attr("vtc"), attr("po"), attr("dist"), attr("subdist"),
    attr("state"), attr("pc"),
  ].map(s => (s || "").trim()).filter(s => s && s !== "-").join(", ");
  return {
    idNumber: uid,
    name: attr("name") || undefined,
    dob,
    yob,
    gender: normGender(attr("gender")),
    address: addr || undefined,
    kind: "legacy",
  };
};

/**
 * Decode a raw QR string (what the scanner library returns).
 * Returns null when the payload is not an Aadhaar QR.
 */
export const decodeAadhaarQrString = (raw: string): AadhaarQrData | null => {
  const s = (raw || "").trim();
  if (!s) return null;

  // Legacy XML QR.
  const legacy = parseLegacyQrXml(s);
  if (legacy) return legacy;

  // Secure QR: a very long decimal-only string.
  if (!/^\d{200,}$/.test(s)) return null;
  try {
    // decimal -> BigInt -> big-endian bytes (strip leading zero padding)
    const num = BigInt(s);
    let hex = num.toString(16);
    if (hex.length % 2) hex = "0" + hex;
    const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    let start = 0;
    while (start < bytes.length && bytes[start] === 0) start++;
    const compressed = bytes.slice(start);
    // gzip magic 1f 8b
    if (compressed[0] !== 0x1f || compressed[1] !== 0x8b) return null;
    const inflated = inflate(compressed);
    return parseSecureQrBytes(inflated);
  } catch {
    return null;
  }
};

/**
 * Decode the QR visible in an image. Expects RGBA pixel data straight from a
 * canvas. Returns null when jsQR finds no QR or it is not an Aadhaar payload.
 */
export const decodeAadhaarQrFromImage = (data: Uint8ClampedArray, width: number, height: number): AadhaarQrData | null => {
  // Full frame first.
  const direct = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
  if (direct) return decodeAadhaarQrString(direct.data);
  return null;
};

/**
 * Assemble the full 12-digit number: QR only stores the LAST 4 digits, so the
 * first 8 come from the printed number (OCR) and the last 4 from the QR. When
 * OCR also failed we keep the QR-only mask (XXXX XXXX last4).
 */
export const assembleIdNumber = (printedDigits: string | null | undefined, qr: AadhaarQrData): string => {
  const last4 = (qr.referenceId || "").slice(0, 4);
  const printed = (printedDigits || "").replace(/\D/g, "");
  if (printed.length === 12) {
    if (!last4 || printed.endsWith(last4)) return printed;
    // printed number disagrees with the QR - trust the QR digits, they are exact
    return printed.slice(0, 8) + last4;
  }
  return "XXXXXXXX" + last4;
};
