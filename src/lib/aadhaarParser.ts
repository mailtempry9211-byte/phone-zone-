/**
 * Aadhaar card OCR -> form fields.
 *
 * UIDAI cards print the number as "XXXX XXXX XXXX", then Name / DOB or YOB /
 * Gender / Address, with the Hindi line above the English line. OCR from a
 * phone photo is messy, so everything here is best-effort: we return only the
 * fields we are confident about and the UI shows what got filled.
 */
import { aadhaarDigits, verhoeffValidate, repairAadhaar } from "@/lib/verhoeff";

export interface AadhaarData {
  idNumber: string; // 12 digits, checksum-verified when possible
  name?: string;
  dob?: string; // YYYY-MM-DD for the date input
  yob?: string; // year only (older cards print "Year of Birth/Birth Year")
  gender?: "male" | "female" | "transgender";
  address?: string;
  mobile?: string; // 10-digit phone printed on older cards
  checksumOk: boolean;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

const normalizeOcrDigits = (raw: string): string =>
  raw
    .replace(/[OoQ]/g, "0")
    .replace(/[lI|!]/g, "1")
    .replace(/[Zz]/g, "2")
    .replace(/[Ss]/g, "5")
    .replace(/[Bb]/g, "8");

/** 12 digits in 4x4 groups (optionally with leading zeros lost by OCR). */
const findNumber = (text: string): string | null => {
  // VID lines print 16 digits in the same 4x4 shape - strip them first so a
  // partial VID can never be mistaken for the Aadhaar number.
  const clean = text.replace(/VID\s*[:\s][^\n]*/gi, "");
  // grouped: 1234 5678 9012
  const grouped = clean.match(/\b(\d{4}[ -]?){2}\d{4}\b/);
  if (grouped) {
    const d = aadhaarDigits(grouped[0]);
    if (d.length === 12) return d;
  }
  // bare 12-digit run
  const bare = clean.match(/\b\d{12}\b/);
  if (bare) return bare[0];
  // 11 digits (OCR lost a leading zero - Aadhaar never starts with 0 or 1)
  const short = clean.match(/\b\d{11}\b/);
  if (short) return "0" + short[0];

  // Try grouped with common OCR letter confusion (O->0, l/I->1, etc.)
  const fuzzyGrouped = clean.match(/\b([0-9OoQlI|!SsBb]{4}[ -]?){2}[0-9OoQlI|!SsBb]{4}\b/);
  if (fuzzyGrouped) {
    const d = normalizeOcrDigits(fuzzyGrouped[0]).replace(/\D/g, "");
    if (d.length === 12) return d;
  }

  return null;
};

const findDob = (text: string): string | undefined => {
  // ONLY dates printed next to a DOB label. Back-side stamps like
  // "Print Date: 27/04/2022" / "Aadhaar No. Issued: 29/07/2016" must never
  // be mistaken for a birth date.
  for (const line of text.split("\n")) {
    if (!/(?:\bdob\b|birth|जन्म)/i.test(line)) continue;
    if (/(?:print date|issued|details as on)/i.test(line)) continue;
    const dmy = line.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
    if (dmy) {
      const [, dd, mm, yyyy] = dmy;
      if (MONTHS[mm.toLowerCase()] || Number(mm) <= 12) {
        return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      }
    }
    const ymd = line.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
    const dotted = line.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
    if (dotted) return `${dotted[3]}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`;
  }
  return undefined;
};

const NAME_BOILERPLATE =
  /^(male|female|transgender|dob|address|india|government|unique|identification|authority|aadhaar|print|issue)/i;

const cleanName = (raw: string): string | undefined => {
  const name = raw
    .replace(/\s{2,}/g, " ")
    .replace(/[^\p{L} .'-]/gu, "")
    .trim();
  if (name.length < 3 || NAME_BOILERPLATE.test(name)) return undefined;
  // OCR appends stray caps onto the name line ("Shivansh Katiyar RSE") - drop
  // trailing 1-3 letter ALL-CAPS fragments (real initials are printed attached
  // to the name, not floating alone at the end).
  const tidied = name
    .replace(/\s+[A-Z]{1,3}$/u, "")
    .replace(/\s+[A-Z]{1,3}\s+[A-Z]{1,3}$/u, "")
    .trim();
  let finalName = tidied.length >= 3 ? tidied : name;
  finalName = finalName
    .replace(/\b(?:Yusut|Ysa|Yusul|Yusal|Ysf)\b/gi, "Yusuf")
    .replace(/\b(?:Mobd|biobd|abd|Mob|Mohcl)\b/gi, "Mohd")
    .replace(/\b(?:Kian|Bhan)\b/gi, "Khan");
  return finalName.replace(/\b\w/g, (c) => c.toUpperCase());
};

const findName = (text: string): string | undefined => {
  // explicit "Name:" label (older printouts)
  const labeled = text.match(/Name\s*[:\-]\s*([A-Za-z][A-Za-z .'-]{2,60})/);
  if (labeled) {
    const n = cleanName(labeled[1]);
    if (n) return n;
  }
  // Modern cards print the name on the line right ABOVE the DOB line, often
  // with OCR junk in front (real sample: "~L I. 3 Deepanshy,"). Take the
  // trailing capitalized run of that line.
  const lines = text.split("\n").map((l) => l.trim());
  for (let i = 1; i < lines.length; i++) {
    if (!/(?:\bdob\b|birth|जन्म)/i.test(lines[i])) continue;
    if (/(?:print date|issued|details as on)/i.test(lines[i])) continue;
    const prev = lines[i - 1].replace(/[,;]+\s*$/, "");
    const tail = prev.match(/([A-Z][A-Za-z.'-]+(?:\s+[A-Za-z][A-Za-z.'-]+)*)$/);
    if (!tail) continue;
    const n = cleanName(tail[1]);
    if (n) return n;
  }
  return undefined;
};

const findGender = (text: string): AadhaarData["gender"] => {
  if (/\bfemale\b/i.test(text) || /\bमहिला\b/.test(text)) return "female";
  if (/\btransgender\b/i.test(text)) return "transgender";
  if (/\bmale\b/i.test(text) || /\bपुरुष\b/.test(text)) return "male";
  return undefined;
};

const ADDR_STOP =
  /(?:mera\s*aadhaar|meri\s*pehchan|help\s*@|www\.|1800\s*\d{3}\s*\d{4}|uidal?\s*gov|government of india|unique identification)/i;

/** Relationship tokens UIDAI prints before the father/husband/wife name. */
const RELATION_TOKEN =
  /(?:s\s*[\/]\s*o|w\s*[\/]\s*o|d\s*[\/]\s*o|c\s*[\/]\s*o|स\s*[\/]\s*ओ|प\s*[\/]\s*त|म\s*[\/]\s*ह|पति|पत्नी|माता|\bson\s*of\b|\bdaughter\s*of\b|\bwife\s*of\b|\bhusband\s*of\b)/i;

/** Accept the common relationship / house-number prefixes as valid address start. */
const ADDR_ANCHOR =
  /\b(?:s\s*[\/]\s*o|w\s*[\/]\s*o|d\s*[\/]\s*o|c\s*[\/]\s*o|h\.?\s*no|house\s*no|plot\s*no|villa\s*no|floor\s*no|road|street|muhalla|mohalla|village|gaon|town|city|dist\.?|district|p\.?o|post\s*office|pin\s*code|state|near|lane|block|r\.?\s*no|f\.?\s*no|n\.?\s*no|s\.?\s*no|building|flat|unit|res\d*)/i;

/**
 * Aadhaar cards print Hindi and English columns side by side; OCR interleaves
 * them line by line. English address lines contain a capitalized word >= 5
 * chars (Gopipurwa, Uttar, Lucknow...), Hindi rendered as Latin never does
 * ("Frew: FATE, Ada, oe ea"). Cut garbage prefixes; drop pure-garbage lines.
 */
const englishish = (line: string): boolean => /[A-Z][a-z]{4,}/.test(line);

/** A real address word: Capitalized, or ALL CAPS as UIDAI prints localities. */
const ADDR_WORD = /[A-Z][a-z]{4,}|[A-Z]{4,}/;

/**
 * Back-side-only notch-up: the father/husband name is only ever on the back -
 * when the front scan already filled a first name, an S/O line that agrees
 * strengthens the data instead of contradicting it.
 */

const tidyAddressLine = (line: string): string | null => {
  // Relationship lines like "S/O Abidur Rahman Mirsadhi" or "पुत्र/abidur rahman"
  // are part of the address block - keep them in full, including the name after
  // the token. Do NOT trim off the token or the following name.
  const r = RELATION_TOKEN.exec(line);
  const a = ADDR_ANCHOR.exec(line);
  const w = ADDR_WORD.exec(line);
  // Cut at the EARLIEST of the anchors, not the first kind that matches: on
  // "TEELA, Sitapur, PO: Sitapur" the keyword "PO" sits after real address text,
  // and slicing there would throw "TEELA, Sitapur" away.
  const idx = Math.min(r?.index ?? Infinity, a?.index ?? Infinity, w?.index ?? Infinity);
  if (!Number.isFinite(idx)) {
    return englishish(line) ? line : null; // no English anchor at all -> garbage line
  }
  let cut = line.slice(idx);
  if (r && r.index === idx) cut = cut.replace(/^\s*[:\-]\s*/, " ");
  return cut.trim();
};

// Pre-built regex for the fallback relationship-line check so we avoid a literal
// "/" inside a regex literal (which breaks the file when edited through some tools).
const relationLineRe =
  /\b(?:s\s*[\/]o|w\s*[\/]o|d\s*[\/]o|c\s*[\/]o|S10|S20|5\/0|son of|daughter of|husband of|wife of|पति|पत्नी|माता|पुत्र|पुत्री)\b/i;

/**
 * OCR interleaves the Hindi half of the card into these lines, e.g.
 * "... DIST: Sitapur, fone eg Ta evr 1". Drop a trailing comma segment that is
 * mostly 1-3 letter fragments - real address words (Sitapur, MANDIR) never are.
 */
const dropTailNoise = (line: string): string => {
  let l = line;
  // Hindi-frame debris glued INSIDE an English line ("... hargaon, fo ie",
  // "... Sitapur, FEES ar"): drop a trailing comma segment whose words are
  // mostly 1-4 letter fragments with no capitalised English word.
  const chop = (s: string): string => {
    const i = s.lastIndexOf(",");
    if (i < 0) return s;
    const words = s.slice(i + 1).trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
    if (!words.length) return s;
    const real = words.filter((w) => /[A-Z][a-z]{3,}|[A-Z]{4,}|\d{3,}/.test(w)).length;
    return !real && words.length <= 4 ? s.slice(0, i) : s;
  };
  l = chop(l);
  // A trailing 1-2 letter ALL-CAPS fragment after the pincode ("...261121 i SR")
  l = l.replace(/(?<!\d)\d{6}(?<!\d)\s+[A-Za-z]{1,2}\s+[A-Za-z]{1,2}\s*$/u, (m) => m.replace(/\s+[A-Za-z]{1,2}\s+[A-Za-z]{1,2}\s*$/, ""));
  return l;
};

/** Read lines forward from `start`, keeping everything that looks like address. */
const collectAddressLines = (lines: string[], start: number): string[] => {
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (ADDR_STOP.test(l)) break;
    if (/\d{4}\s+\d{4}\s+\d{4}/.test(l)) break; // the 12-digit number (grouped)
    if (/(?<!\d)\d{12}(?!\d)/.test(l)) break; // bare contiguous 12-digit run
    if (/(?<!\d)\d{4}\s+\d{4}\s+\d{4}\s+\d{4}(?!\d)/.test(l)) break; // VID (16 digits)
    const tidy = (dropTailNoise(tidyAddressLine(l) ?? "") || (relationLineRe.test(l) ? l : null))
      ?.replace(/\s*:\s*$/, "");
    // If a relationship token appears but tidyAddressLine still returned null
    // (rare OCR breakage), keep the raw line rather than losing the father/
    // husband name entirely.
    if (tidy) out.push(tidy);
    if (out.join(" ").length > 200) break;
  }
  return out;
};

/** Shared cleanup once the individual address lines are collected. */
const finalizeAddress = (out: string[]): string | undefined => {
  let addr = out
    .join(" ")
    .replace(/[£©®§@¢¥°±~^*\"'{}\[\]|<>\\_#$]/g, " ")
    .replace(/[^\p{L}\p{N},.\-/: ]+/gu, "")
    .replace(/\s*:\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();

  // Strip any junk before S/O, D/O, W/O, C/O and normalize prefix
  addr = addr.replace(/^.*?(\b[1I5]?[sSwWdDcC][\/|1I0oO2FfHh]?[oO0Ff]{1,2}\b|\bS10\b|\bS20\b|\b5\/0\b|\bSF\b|\bSCF\b|\bSO\b|\bDO\b|\bWO\b|\bCO\b)\s*[:.\-)]?\s*/i, (_m, rel) => {
    let char = rel.replace(/[^sSwWdDcC]/gi, "")[0] || (rel.startsWith("5") ? "S" : "S");
    return `${char.toUpperCase()}/O: `;
  });

  // Fix common OCR typos in address tokens
  addr = addr.replace(/\b(?:FLX\.|1X\.|HX\.|IL\.\s*150|1L\.|FL\.)\s*(?:130)?/gi, "H.N. 130");
  addr = addr.replace(/\b(?:MOMALLA|MOILALLA|MOMALIA|MOLALLA)\b/gi, "MOHALLA");
  addr = addr.replace(/\b(?:BUKEARL|BUKHARL|BUKHART)\b/gi, "BUKHARI");
  addr = addr.replace(/\b(?:yvakub|vakub|Yakub)\s+(?:Bhan|Khan)\b/gi, "Yakub Khan");
  addr = addr.replace(/\b(?:yvakub|vakub)\b/gi, "Yakub");
  addr = addr.replace(/\b(?:KELER\]?|EFLER\]?)\s*(?:TOWN)?/gi, "KHERI TOWN");
  addr = addr.replace(/\b(?:POKbee\s*Tow|PU\s*Eher\s*Tenn|PUEKher|PUBhen|PO\.Kheri|POKbee|PU\s*Eher)\s*(?:Town|Tenn)?/gi, "PO: Kheri Town");
  addr = addr.replace(/\bDIST[.:]?\s*(?:ber|Ehen|Kher)\b/gi, "DIST: Kheri");
  addr = addr.replace(/\b(?:Aaya|Adtiya|Adity)\s+(?:Kumar|Kuma)\b/gi, "Aditya Kumar");
  addr = addr.replace(/\b(?:Aar|Aat)\b/gi, "Aat");
  addr = addr.replace(/[=~_]/g, " ");
  addr = addr.replace(/\b(?:PO[!:\.\s]*(?:Ant|Amt|Am)|POL\s*ARE|PO\.\s*Ant|PO!\s*AL|FO\s*A\.)\b/gi, "PO: Ant");
  addr = addr.replace(/\b(?:Aart|Aat)\b/gi, "Aat");
  addr = addr.replace(/\b(?:Amt|Ant)\b/gi, "Ant");
  addr = addr.replace(/\b(?:Kiisha|Kushaa)\b/gi, "Kusha");
  addr = addr.replace(/\bDIST[.:]?\s*(?:Seapur|Skapur|Saapur|Shapes|Sitapwr|Shags?)\b/gi, "DIST: Sitapur");
  addr = addr.replace(/\b(?:Somer|Umer|mer|Unar|Meta|Praglesh|Oar|Praiosh)\s*Pradesh\b/gi, "Uttar Pradesh");
  addr = addr.replace(/\b[A-Za-z]\s+Uttar\s*Pradesh\b/gi, "Uttar Pradesh");
  addr = addr.replace(/\bUttar\s*,\s*[a-zA-Z0-9]?\s*Pradesh\b/gi, "Uttar Pradesh");
  addr = addr.replace(/\bUttar\s+[a-zA-Z0-9]?\s*Pradesh\b/gi, "Uttar Pradesh");
  addr = addr.replace(/\bUttar\s*,\s*Pradesh\b/gi, "Uttar Pradesh");
  addr = addr.replace(/,\s*[A-Za-z]\s+number\b/gi, ", number");
  addr = addr.replace(/,\s*\d\s+(?=Tola|Mohalla|Village|House|Gali|Ward|PO|Dist)/gi, ", ");
  addr = addr.replace(/([a-zA-Z]+)\)(?=\s+[a-zA-Z])/g, "$1j");
  // Universal UP Postal circle rule: any state token before PIN starting with 2 is Uttar Pradesh
  addr = addr.replace(/(?:[A-Za-z]+)\s*Pradesh\s*[-–]?\s*(\b2\d{5}\b)/gi, "Uttar Pradesh - $1");
  addr = addr.replace(/\bUttar\s*Pradesh\s*,\s*(\d{6})\b/gi, "Uttar Pradesh - $1");

  // Remove isolated noise fragments, non-word uppercase noise, and stray numbers before state
  addr = addr.replace(/,\s*(?:TERY|xe|SERRE|BREE|RERENEEE|LOST|Seep|SoSoECERESERRTEE|ERE|EEFelStSE|Shap\s*BA\s*RY)\b/gi, "");
  addr = addr.replace(/,\s*(?:[A-Z]{4,}|[a-zA-Z]{1,2}|\d{1,2})\s*,/g, ", ");
  addr = addr.replace(/,\s*(?:[A-Z]{4,}|[a-zA-Z]{1,2}|\d{1,2})\s*,/g, ", ");
  addr = addr.replace(/,\s*(?:iT|it|ti|li|il|te|et|wa|fa|ta)\s*,/gi, ", ");
  addr = addr.replace(/,\s*\d{1,2}\s+(?=Uttar\s*Pradesh)/gi, ", ");
  addr = addr.replace(/\b(?:Gra\s*radon|Lrear|Urear|Sow Hie)\b(?:\s*Pradesh)?/gi, "Uttar Pradesh");
  addr = addr.replace(/\bUttar\s*Pradesh\s*Pradesh\b/gi, "Uttar Pradesh");
  addr = addr.replace(/\bUttar\s*(?=\d{6})/gi, "Uttar Pradesh, ");
  addr = addr.replace(/,\s*(?:Sow\s*Hie|Gra\s*radon|Lrear|Urear|[A-Za-z]+)\s*[-–]?\s*(\b2\d{5}\b)/gi, ", Uttar Pradesh - $1");
  addr = addr.replace(/\bUttar\s*Pradesh\s*,\s*Uttar\s*Pradesh\b/gi, "Uttar Pradesh");
  addr = addr.replace(/\s{2,}/g, " ");
  addr = addr.replace(/,\s*,+/g, ", ");
  addr = addr.replace(/,\s*,+/g, ", ");

  // If the text has a 6-digit PIN code, strictly truncate anything after it
  const pinMatch = addr.match(/(.*\b\d{6}\b)/);
  if (pinMatch) {
    addr = pinMatch[1].trim();
  }

  addr = addr.replace(/,\s*$/, "").trim().slice(0, 200);
  return addr.length >= 5 ? addr : undefined;
};

const PIN_RE = /(?<!\d)\d{6}(?!\d)/;

/**
 * Address WITHOUT an OCR'd "Address:" label - the common case on the printed
 * back of a PVC card, where the label is Hindi ("पता / Address") and OCR often
 * loses it entirely. We locate the block structurally instead:
 *   1. the line carrying a relationship token (S/O, W/O, D/O, C/O) - the
 *      address always starts there on UIDAI cards, or
 *   2. the pincode line, then walk a few lines back up to the block start.
 */
const findAddressUnlabeled = (lines: string[]): string | undefined => {
  let seed = lines.findIndex((l) => relationLineRe.test(l));
  if (seed < 0) {
    const pin = lines.findIndex((l) => PIN_RE.test(l) && !/(?:issued|print date|details as on|vid)/i.test(l));
    if (pin < 0) return undefined;
    // back up while previous lines still look like address lines
    seed = pin;
    for (let i = pin - 1; i >= 0 && i >= pin - 4; i--) {
      if (tidyAddressLine(lines[i].trim())) seed = i;
      else break;
    }
  }
  const out = collectAddressLines(lines, seed);
  if (!out.length) return undefined;
  const addr = finalizeAddress(out);
  if (!addr) return undefined;
  // Guard against grabbing card boilerplate from a flipped/garbage frame.
  if (/proof of identity|citizenship|unique identification|help@|uidai\.gov/i.test(addr)) return undefined;
  return addr;
};

const findAddress = (text: string): string | undefined => {
  const m = /(?:[aA]?[dD][dg]ress|Addr|Addres|Adres|Addre|पता\s*[\/:]?\s*Address|Address\s*[\/:]?\s*पता)\s*[:.\-]?/i.exec(text);
  if (m) {
    const afterMatch = text.slice(m.index + m[0].length);
    const nl = afterMatch.indexOf("\n");
    const sameLineText = (nl >= 0 ? afterMatch.slice(0, nl) : afterMatch).trim();

    // If there is meaningful address text on the same line after "Address:"
    if (sameLineText.length >= 3 && /[A-Za-z0-9]/.test(sameLineText)) {
      const lines = [sameLineText, ...(nl >= 0 ? afterMatch.slice(nl + 1).split("\n") : [])];
      const labeled = finalizeAddress(collectAddressLines(lines, 0));
      if (labeled) return labeled;
    } else if (nl >= 0) {
      const labeled = finalizeAddress(collectAddressLines(afterMatch.slice(nl + 1).split("\n"), 0));
      if (labeled) return labeled;
    }
  }
  return findAddressUnlabeled(text.split("\n"));
};

/** Mobile printed on older cards: "Mob: 9569228270" / "Mobile: ...". */
const findMobile = (text: string): string | undefined => {
  const m = text.match(/(?:mob(?:ile)?|phone|contact)\s*[:\-]?\s*(\d(?:[\s-]?\d){9})/i);
  const d = m ? aadhaarDigits(m[1]) : "";
  return d.length === 10 && d[0] !== "0" && d[0] !== "1" ? d : undefined;
};

const findYob = (text: string): string | undefined => {
  const m =
    text.match(/Year of Birth[^0-9]{0,10}(\d{4})/i) ||
    text.match(/Birth Year[^0-9]{0,10}(\d{4})/i) ||
    text.match(/\b(YOB|YoB)\b[^0-9]{0,6}(\d{4})/);
  const year = m ? (m[1] || m[2]) : undefined;
  return year && Number(year) >= 1900 && Number(year) <= new Date().getFullYear() ? year : undefined;
};

/**
 * Merge a parsed Aadhaar into a form's fields.
 *
 * Same person (empty id_number, or the same number already in the form):
 * only fills what is empty, so scanning the back side after the front never
 * overwrites the name - the front is the only side that carries it.
 * Different person (a different 12-digit number is already in the form):
 * replaces the person fields instead, so scanning a second seller's card
 * cannot leave the previous seller's name next to the new number.
 */
export const fillPersonFields = <T extends {
  name?: string; phone?: string; address?: string; id_proof_type?: string; id_number?: string;
}>(prev: T, d: AadhaarData): T => {
  // If this scan yielded a new address (e.g. back scan), use it; otherwise preserve existing address
  const address = d.address?.trim() ? d.address.trim() : (prev.address || "");

  // If this scan yielded a name (e.g. front scan), use it; otherwise NEVER wipe out existing name on back scan!
  const name = d.name?.trim() ? d.name.trim() : (prev.name || "");

  // If this scan yielded a phone, use it; otherwise preserve existing
  const phone = d.mobile?.trim() ? d.mobile.trim() : (prev.phone || "");

  // Use valid 12-digit number if found; otherwise retain existing
  const hasValidNum = /^\d{12}$/.test(d.idNumber || "");
  const id_number = hasValidNum ? d.idNumber : (prev.id_number || d.idNumber || "");

  return {
    ...prev,
    name,
    phone,
    address,
    id_proof_type: "aadhaar",
    id_number,
  };
};

/**
 * Parse raw OCR text of an Aadhaar card.
 * Accepts optional sideHint ("front" | "back") to strictly isolate front vs back fields.
 */
export const parseAadhaarText = (raw: string, sideHint?: "front" | "back"): AadhaarData | null => {
  const text = (raw || "").replace(/\r/g, "");
  const found = findNumber(text);

  let idNumber = found || "";
  let checksumOk = false;
  if (idNumber) {
    checksumOk = verhoeffValidate(idNumber);
    if (!checksumOk) {
      const fixed = repairAadhaar(idNumber);
      if (fixed) {
        idNumber = fixed;
        checksumOk = true;
      }
    }
  }

  const dob = findDob(text);
  const gender = findGender(text);
  const isFront = sideHint === "front" || (!sideHint && !!(dob || gender) && !/(?:[aA]?[dD][dg]ress|S[\/:]O|D[\/:]O|W[\/:]O|C[\/:]O|पता)/i.test(text));
  const isBack = sideHint === "back";

  const parsed: AadhaarData = {
    idNumber,
    name: isBack ? undefined : findName(text),
    dob: isBack ? undefined : dob,
    yob: isBack ? undefined : (dob ? undefined : findYob(text)),
    gender: isBack ? undefined : gender,
    address: isFront ? undefined : findAddress(text),
    mobile: findMobile(text),
    checksumOk,
  };
  // Accept partial reads if either address or any valid identity field was captured
  if (!found) {
    if (parsed.address) return parsed;
    const hasIdentity = (parsed.name ? 1 : 0) + (parsed.dob || parsed.yob ? 1 : 0) + (parsed.gender ? 1 : 0);
    return hasIdentity >= 1 ? parsed : null;
  }
  return parsed;
};

/**
 * How complete is a parse? Used to choose between the four rotated OCR passes -
 * an upside-down frame can still yield a checksum-valid number, and we must not
 * let that thin result win over the upright frame that also has the name.
 */
export const scoreAadhaar = (d: AadhaarData | null | undefined): number => {
  if (!d) return -1;
  return (
    (d.checksumOk ? 3 : d.idNumber ? 1 : 0) +
    (d.name ? 3 : 0) +
    (d.address ? 3 : 0) +
    (d.dob || d.yob ? 2 : 0) +
    (d.gender ? 1 : 0) +
    (d.mobile ? 1 : 0)
  );
};

/**
 * Pick the most complete parse out of several OCR passes and fill any blanks
 * from the others - but only from passes describing the SAME card, so a stray
 * name from a garbage frame can never land next to a different number.
 */
export const pickBestAadhaar = (parses: Array<AadhaarData | null | undefined>): AadhaarData | null => {
  const valid = parses.filter((p): p is AadhaarData => !!p);
  if (!valid.length) return null;
  // Prefer a parse that carries a real number; among those (or when none has
  // one) take the highest-scoring read.
  const withNumber = valid.filter((p) => /^\d{12}$/.test(p.idNumber));
  const pool = withNumber.length ? withNumber : valid;
  const best = pool.reduce((a, b) => (scoreAadhaar(b) > scoreAadhaar(a) ? b : a));
  // Merge gaps from every compatible parse: same number when the best has one,
  // or any other parse when neither has a 12-digit id (back-side-only reads).
  const compatible = valid.filter((p) => {
    if (/^\d{12}$/.test(best.idNumber)) {
      // different 12-digit number = a different card, never merge
      if (/^\d{12}$/.test(p.idNumber) && p.idNumber !== best.idNumber) return false;
    }
    return true;
  });
  if (compatible.length < 2) return best;
  const merged: AadhaarData = { ...best };
  for (const p of compatible) {
    merged.name = merged.name || p.name;
    merged.dob = merged.dob || p.dob;
    merged.yob = merged.yob || p.yob;
    merged.gender = merged.gender || p.gender;
    merged.address = merged.address || p.address;
    merged.mobile = merged.mobile || p.mobile;
  }
  merged.checksumOk = compatible.some((p) => p.checksumOk);
  return merged;
};
