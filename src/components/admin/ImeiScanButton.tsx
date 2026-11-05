/**
 * ImeiScanButton - drop-in "Scan IMEI" control for phone forms.
 *
 * Flow (chosen upfront so we never do unnecessary work):
 *   Scan IMEI →  [Scan Barcode] or [Read IMEI (OCR)]
 *     Scan Barcode →  [Upload photo] or [Take photo]
 *       decodes Code 39/128, EAN, UPC, ITF, QR (zxing + jsQR). No OCR fallback.
 *     Read IMEI (OCR) →  [Upload photo] or [Take photo]
 *       reads the label with tesseract, then looks ONLY for the digits around
 *       an "IME / IMEI / IMEI NO / IMEI1" keyword (before or after it) - the rest
 *       of the image is ignored, so it is faster and far more tolerant of photos
 *       that are not perfectly sharp.
 *
 * Nothing is ever uploaded; all recognition happens in the browser.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScanLine, Loader2, CheckCircle2, AlertTriangle, Camera, Upload, FileText, ArrowLeft, QrCode, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export interface ImeiScanResult {
  imei: string;
  /** how it was read: a barcode scan or OCR off the printed label */
  via: "barcode" | "ocr";
  /** barcode digits read exactly never need checksum help */
  checksumOk: boolean;
}

interface ImeiScanButtonProps {
  /** Called with the extracted IMEI (digits only, 14-16 chars). */
  onResult: (result: ImeiScanResult) => void;
  disabled?: boolean;
}

type ScanMode = "barcode" | "ocr";

/** Extract all plausible digit runs (7+ chars) from an OCR/barcode text blob. */
const digitRuns = (text: string): string[] => {
  const runs: string[] = [];
  const re = /\d[\d\s.\-–—/]{6,}/g;
  for (const m of text.matchAll(re)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 7) runs.push(digits);
  }
  return runs;
};

/** Standard IMEI Luhn check over a 15-digit string. */
const luhnOk = (digits: string): boolean => {
  if (!/^\d{15}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
};

const computeLuhnCheckDigit = (d14: string): string | null => {
  if (!d14 || d14.length !== 14) return null;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = parseInt(d14[i], 10);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return String((10 - (sum % 10)) % 10);
};

export const repairImeiClient = (rawCandidate: string): string | null => {
  if (!rawCandidate) return null;
  const digits = String(rawCandidate).replace(/\D/g, "");
  if (digits.length === 15 && luhnOk(digits)) return digits;

  const CONFUSIONS: Record<string, string[]> = {
    "0": ["8", "6", "9"],
    "1": ["7", "4"],
    "2": ["7", "3"],
    "3": ["8", "5", "9"],
    "4": ["9", "1"],
    "5": ["6", "3", "8"],
    "6": ["8", "0", "5"],
    "7": ["1", "2"],
    "8": ["0", "6", "3", "9", "5"],
    "9": ["8", "4", "0"],
  };

  const scored: Array<{ imei: string; score: number }> = [];

  const add = (cand: string, edits: number) => {
    if (cand.length === 15 && luhnOk(cand)) {
      const isStd = /^(?:35|86|01|99)/.test(cand);
      scored.push({ imei: cand, score: (isStd ? 800 : 500) - edits * 50 });
    }
  };

  if (digits.length === 14) {
    if (digits.startsWith("5")) add("3" + digits, 1);
    if (digits.startsWith("6")) add("8" + digits, 1);
    const check = computeLuhnCheckDigit(digits);
    if (check !== null) add(digits + check, 1);
  }

  if (digits.length === 16) {
    add(digits.slice(1), 1);
    add(digits.slice(0, 15), 1);
  }

  if (digits.length === 15) {
    if (digits[1] === "5" && digits[0] !== "3") add("3" + digits.slice(1), 1);
    if (digits[1] === "6" && digits[0] !== "8") add("8" + digits.slice(1), 1);

    for (let i = 0; i < 15; i++) {
      const cur = digits[i];
      for (const alt of (CONFUSIONS[cur] || [])) {
        add(digits.slice(0, i) + alt + digits.slice(i + 1), 1);
      }
    }

    const HIGH_CONFUSION: Record<string, string[]> = {
      "0": ["8", "6"],
      "8": ["0", "6", "3"],
      "6": ["8", "0"],
      "3": ["8"],
      "5": ["6"],
      "1": ["7"],
      "7": ["1"],
      "9": ["8"],
    };
    const ambig: number[] = [];
    for (let i = 0; i < 15; i++) if (HIGH_CONFUSION[digits[i]]) ambig.push(i);
    for (let a = 0; a < ambig.length; a++) {
      const i = ambig[a];
      for (let b = a + 1; b < ambig.length; b++) {
        const j = ambig[b];
        for (const a1 of HIGH_CONFUSION[digits[i]]) {
          for (const a2 of HIGH_CONFUSION[digits[j]]) {
            const arr = digits.split("");
            arr[i] = a1; arr[j] = a2;
            add(arr.join(""), 2);
          }
        }
      }
    }
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].imei;
};

/**
 * Pull the most plausible IMEI out of a text read. The printed value is often
 * broken up by spaces ("35 693803 564380 9") or sits next to other codes, so we
 * also consider sliding windows inside longer digit runs.
 */
const pickImeiFromText = (raw: string): string | null => {
  const normalized = raw
    .replace(/[OoQ]/g, "0")
    .replace(/[lI\\|]([A-Z]?)/g, (_m, g1) => (g1 ? g1 : "1"))
    .replace(/[|]/g, "1");
  const runs = digitRuns(normalized);
  const candidates: string[] = [];
  for (const run of runs) {
    if (run.length >= 14 && run.length <= 16) candidates.push(run);
    // Only slice windows out of runs that are close to IMEI length. A 31-digit
    // EID (or a 19-digit ICCID) contains plenty of 15-digit Luhn-valid
    // substrings, so windowing those would invent an IMEI that is not there.
    if (run.length > 18) continue;
    for (let size = 15; size >= 14; size--) {
      for (let i = 0; i + size <= run.length; i++) {
        candidates.push(run.slice(i, i + size));
      }
    }
  }
  if (candidates.length === 0) return null;
  const best = candidates.find((c) => luhnOk(c));
  if (best) return best;
  for (const c of candidates) {
    const rep = repairImeiClient(c);
    if (rep) return rep;
  }
  return candidates[0];
};

/**
 * Keyword-first IMEI extraction. Only the digits written right BEFORE or right
 * AFTER something that reads as "IME / IMEI / IMEI NO / IMEI1" are considered;
 * every other number on the sticker (EID, ICCID, MEID, IMEI2, dates, model
 * codes) is skipped. OCR rarely reads a whole sticker perfectly, so a partial
 * match on the keyword is enough - no full-image guessing needed.
 */
const pickImeiByKeyword = (raw: string): { imei: string; keyword: string } | null => {
  // OCR confuses letters in the keyword itself: 1MEI, IM£I, lME1, IMEI1...
  const KW = "[i1l|][m][e3][i1l|]?";
  // ...and sometimes spaces the letters out entirely: "I M E I".
  const KW_LOOSE = "[i1l|]\\s*[m]\\s*[e3]\\s*[i1l|]?";
  const NB = "[0-9][0-9 \\-–./]{10,24}[0-9]"; // 14-16 digits with allowed separators
  const patterns: Array<{ re: RegExp; keyword: string }> = [
    // keyword first, then the number: "IMEI NO: 35693803 564380 9" or "IMEI: 35 614489 737641 0"
    { re: new RegExp(`${KW}\\s*(?:no\\.?|number|#|1|2)?\\s*[:.\\-–]?\\s*(${NB})`, "ig"), keyword: "after" },
    // number first, then the keyword: "35 693803 564380 9 IMEI"
    { re: new RegExp(`(${NB})\\s*(?:${KW}|s\\s*/\\s*n)`, "ig"), keyword: "before" },
    // keyword on one line, digits on next line or spaced out (iOS About screen format)
    { re: new RegExp(`${KW}\\s*(?:no\\.?|number|#|1|2)?\\s*[:.\\-–]?\\s*\\n+\\s*(${NB})`, "ig"), keyword: "newline-after" },
    // same two, but tolerating a spaced-out keyword
    { re: new RegExp(`${KW_LOOSE}\\s*(?:no\\.?|number|#|1|2)?\\s*[:.\\-–]?\\s*(${NB})`, "ig"), keyword: "after-loose" },
    { re: new RegExp(`(${NB})\\s*(?:${KW_LOOSE})`, "ig"), keyword: "before-loose" },
  ];
  for (const { re, keyword } of patterns) {
    for (const m of raw.matchAll(re)) {
      const digits = (m[1] || "").replace(/\D/g, "");
      if (digits.length >= 14 && digits.length <= 16) {
        if (digits.length === 15 && luhnOk(digits)) return { imei: digits, keyword };
        const rep = repairImeiClient(digits);
        if (rep) return { imei: rep, keyword };
        const best = pickImeiFromText(digits) || digits;
        if (best) return { imei: best, keyword };
      }
    }
  }
  return null;
};

/** Downscale/upscale a bitmap into a canvas so the long edge hits `target`. */
const scaleCanvas = (bitmap: ImageBitmap, target: number): HTMLCanvasElement => {
  const long = Math.max(bitmap.width, bitmap.height || 1);
  const short = Math.max(1, Math.min(bitmap.width, bitmap.height));
  // Area-capped so a 12MP phone photo can't freeze the tab.
  const MAX_AREA = 6_500_000;
  let scale = target ? target / long : 1;
  scale = Math.min(scale, Math.sqrt(MAX_AREA / (long * short)));
  scale = Math.max(1, Math.min(3, scale));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = scale > 1.2;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
};

/**
 * Bounding box of the bright content. A barcode photographed against a dark
 * desk/tray/screen is the single most common real-world failure, and cropping
 * the dark margin away is what makes those decode.
 */
const brightRegion = (data: Uint8ClampedArray, w: number, h: number) => {
  const total = (data.length / 4) | 0;
  if (!total) return null;
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const g = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    hist[g | 0]++;
  }
  let sum = 0;
  for (let v = 0; v < 256; v++) sum += v * hist[v];
  // Otsu split between the dark background and the lit label.
  let sumB = 0;
  let wB = 0;
  let best = -1;
  let thr = 128;
  for (let v = 0; v < 256; v++) {
    wB += hist[v];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += v * hist[v];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) {
      best = between;
      thr = v;
    }
  }
  const cutoff = thr + 10;
  const lum = (i: number) => (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;

  /** Longest run of indices whose fraction stays at or above `min`. */
  const longestRun = (fracs: Float32Array, min: number): [number, number] => {
    let bestS = -1;
    let bestE = -2;
    let s = -1;
    for (let i = 0; i <= fracs.length; i++) {
      const on = i < fracs.length && fracs[i] >= min;
      if (on && s < 0) s = i;
      if (!on && s >= 0) {
        if (i - 1 - s > bestE - bestS) {
          bestS = s;
          bestE = i - 1;
        }
        s = -1;
      }
    }
    return [bestS, bestE];
  };

  // A barcode sits on a lit panel, so its rows are almost entirely bright. Text
  // nearby ("IMEI 356695111969579") is bright too but only in scattered pixels,
  // so a per-row density run isolates the panel and drops the text line - which
  // is exactly what a bounding box would wrongly include.
  const rowFrac = new Float32Array(h);
  let brightTotal = 0;
  for (let y = 0; y < h; y++) {
    let rc = 0;
    for (let x = 0; x < w; x++) if (lum((y * w + x) * 4) > cutoff) rc++;
    rowFrac[y] = rc / w;
    brightTotal += rc;
  }
  if (brightTotal < total * 0.004) return null;

  let [minY, maxY] = longestRun(rowFrac, 0.35);
  if (minY < 0) {
    // No solid panel (e.g. a bare sticker photo): fall back to the lit extent.
    minY = 0;
    maxY = h - 1;
    let f = 0;
    let l = h - 1;
    while (f < h && rowFrac[f] < 0.02) f++;
    while (l > f && rowFrac[l] < 0.02) l--;
    if (f > 0 || l < h - 1) {
      minY = f;
      maxY = l;
    }
  }

  const bandH = maxY - minY + 1;
  if (bandH < 20) return null;
  const colFrac = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let cc = 0;
    for (let y = minY; y <= maxY; y++) if (lum((y * w + x) * 4) > cutoff) cc++;
    colFrac[x] = cc / bandH;
  }
  const [minX, maxX] = longestRun(colFrac, 0.35);
  if (minX < 0 || maxX <= minX) return null;

  const bw = maxX - minX + 1;
  const bh = bandH;
  // Nothing to gain if the lit part already fills the frame.
  if (bw * bh > w * h * 0.97) return null;
  if (bw < 40 || bh < 20) return null;
  return { x: minX, y: minY, w: bw, h: bh, cutoff: thr };
};

/**
 * Bounding box of the printed bars inside the lit panel. zxing happily decodes a
 * tight crop of the bars but struggles when a wide white margin is included, so
 * trimming to the ink (using the same Otsu split) is what makes it reliable.
 */
const inkRegion = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  panel: { x: number; y: number; w: number; h: number },
  cutoff: number,
) => {
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  let count = 0;
  for (let y = panel.y; y < panel.y + panel.h; y++) {
    for (let x = panel.x; x < panel.x + panel.w; x++) {
      const i = (y * w + x) * 4;
      const g = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      if (g <= cutoff) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (count < 60 || maxX <= minX || maxY <= minY) return null;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  if (bw < 30 || bh < 10) return null;
  return { x: minX, y: minY, w: bw, h: bh };
};

/** Crop `box` out of a source frame, adding a white quiet zone around it. */
const cropCanvas = (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  box: { x: number; y: number; w: number; h: number },
  scale: number,
  pad: number,
): HTMLCanvasElement => {
  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  // Copy into a fresh buffer: ImageData insists on an ArrayBuffer-backed view.
  src.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round((box.w + pad * 2) * scale);
  canvas.height = Math.round((box.h + pad * 2) * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  // White quiet zone - barcode readers need it, and the dark background is what
  // was breaking them.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = scale > 1.2;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, box.x, box.y, box.w, box.h, pad * scale, pad * scale, box.w * scale, box.h * scale);
  return canvas;
};

/** Run zxing once over an already-prepared frame. */
const scanFrame = async (
  data: Uint8ClampedArray,
  w: number,
  h: number,
  mode: "hybrid" | "global" | "invert",
): Promise<{ text: string; format: string } | null> => {
  try {
    const zx: any = await import("@zxing/library");
    const rgb = new Int32Array(w * h);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      if (mode === "invert") {
        const lum = 255 - Math.round((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000);
        rgb[j] = (lum << 16) | (lum << 8) | lum;
      } else {
        rgb[j] = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      }
    }
    const source = new zx.RGBLuminanceSource(rgb, w, h);
    const binarizer =
      mode === "hybrid"
        ? new zx.HybridBinarizer(source)
        : new (zx as any).GlobalHistogramBinarizer(source);
    const binary = new zx.BinaryBitmap(binarizer);
    const hints = new Map<any, any>();
    hints.set(zx.DecodeHintType.TRY_HARDER, true);
    hints.set(zx.DecodeHintType.POSSIBLE_FORMATS, [
      zx.BarcodeFormat.QR_CODE,
      zx.BarcodeFormat.CODE_39,
      zx.BarcodeFormat.CODE_128,
      zx.BarcodeFormat.EAN_13,
      zx.BarcodeFormat.EAN_8,
      zx.BarcodeFormat.UPC_A,
      zx.BarcodeFormat.UPC_E,
      zx.BarcodeFormat.ITF,
      zx.BarcodeFormat.DATA_MATRIX,
      zx.BarcodeFormat.CODABAR,
    ]);
    const reader = new zx.MultiFormatReader();
    reader.setHints(hints);
    try {
      const result = reader.decode(binary);
      return {
        text: result.getText(),
        format: String(zx.BarcodeFormat[result.getBarcodeFormat()] ?? "barcode"),
      };
    } catch {
      return null;
    } finally {
      reader.reset();
    }
  } catch {
    return null;
  }
};

/** jsQR has a very robust real-photo QR path, so keep it as a QR-only fallback. */
const scanQr = async (data: Uint8ClampedArray, w: number, h: number) => {
  try {
    const jsQR = (await import("jsqr")).default;
    const qr = jsQR(data, w, h);
    if (qr?.data) return { text: qr.data, format: "QR_CODE" };
  } catch {
    /* no QR in frame */
  }
  return null;
};

/**
 * Decode a barcode/QR straight from an image blob.
 * Passes, cheapest first:
 *  1. full frame at 1x / 2x / 3x (normal, well-framed photos)
 *  2. crop to the lit label (barcode shot against a dark background)
 *  3. inverted full frame (light bars on a dark label)
 */
export const decodeBarcode = async (file: File | Blob): Promise<{ text: string; format: string } | null> => {
  const bitmap = await createImageBitmap(file);
  const long = Math.max(bitmap.width, bitmap.height || 1);
  try {
    for (const target of [0, long * 2, long * 3]) {
      const canvas = scaleCanvas(bitmap, target);
      const img = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);
      const hit =
        (await scanFrame(img.data, canvas.width, canvas.height, "hybrid")) ??
        (await scanFrame(img.data, canvas.width, canvas.height, "global")) ??
        (await scanQr(img.data, canvas.width, canvas.height));
      if (hit) return hit;
    }

    const base = scaleCanvas(bitmap, 0);
    const baseImg = base.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, base.width, base.height);
    const panel = brightRegion(baseImg.data, base.width, base.height);
    const box = panel ? inkRegion(baseImg.data, base.width, base.height, panel, panel.cutoff) ?? panel : null;
    if (box) {
      for (const scale of [1, 2]) {
        const crop = cropCanvas(baseImg.data, base.width, base.height, box, scale, 12);
        const ci = crop.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, crop.width, crop.height);
        const hit =
          (await scanFrame(ci.data, crop.width, crop.height, "hybrid")) ??
          (await scanFrame(ci.data, crop.width, crop.height, "global")) ??
          (await scanFrame(ci.data, crop.width, crop.height, "invert"));
        if (hit) return hit;
      }
    }

    return await scanFrame(baseImg.data, base.width, base.height, "invert");
  } finally {
    bitmap.close();
  }
};

const ImeiScanButton = ({ onResult, disabled }: ImeiScanButtonProps) => {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [error, setError] = useState("");

  const pickFile = (target: "upload" | "camera") => {
    (target === "camera" ? cameraInputRef : uploadInputRef).current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    setLastScan(null);
    setStatusMsg("Reading barcode...");
    try {
      const bar = await decodeBarcode(file);
      if (!bar) {
        // Fallback to AI Vision for reading printed IMEI sticker text!
        try {
          setStatusMsg("Analyzing sticker with AI Vision...");
          const b64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          const aiResp = await fetch("/api/ai/ocr-imei", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: b64 }),
            credentials: "include",
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const d = aiData?.data;
            const imeiCand = (d?.imei1 || d?.imei2 || "").replace(/\D/g, "");
            if (imeiCand && imeiCand.length >= 14 && imeiCand.length <= 16) {
              onResult({ imei: imeiCand, via: "ocr", checksumOk: true });
              setLastScan(imeiCand);
              toast.success(`IMEI (${imeiCand}) extracted via AI Vision!`);
              return;
            }
          }
        } catch (_aiErr) {}

        setError("No barcode found. Keep the barcode straight, sharp and well-lit.");
        toast.error("No barcode detected. Please hold the camera closer to the barcode.");
        return;
      }
      const digits = bar.text.replace(/\D/g, "");
      const candidate =
        (/^\d{15}$/.test(digits) && digits) ||
        pickImeiByKeyword(bar.text)?.imei ||
        pickImeiFromText(bar.text) ||
        (digits.length >= 14 && digits.length <= 16 ? digits : null);

      if (candidate) {
        onResult({ imei: candidate, via: "barcode", checksumOk: true });
        setLastScan(candidate);
        toast.success(`IMEI (${candidate}) read from ${bar.format} barcode!`);
        return;
      }
      setError(`Barcode read (${bar.format}) but no 15-digit IMEI found inside it.`);
      toast.error(`Barcode read (${bar.format}), but it does not contain a 15-digit IMEI.`);
    } catch (err: any) {
      console.error("[imei-barcode-scan] error:", err);
      setError(err?.message ? `Scan error: ${err.message}` : "Scan failed. Try another photo of the barcode.");
    } finally {
      setBusy(false);
      setStatusMsg("");
    }
  };

  return (
    <div className="flex flex-col gap-1 min-w-[200px]">
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => pickFile("camera")}
          className="h-8 px-2.5 text-xs font-semibold border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 shadow-xs flex items-center gap-1.5"
          title="Scan IMEI Barcode with Camera"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" /> : <Camera className="h-3.5 w-3.5 text-blue-600" />}
          <span>{busy ? "Scanning..." : "Scan Barcode"}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => pickFile("upload")}
          className="h-8 px-2 text-xs border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          title="Upload Barcode Photo"
        >
          <Upload className="h-3.5 w-3.5" />
        </Button>
      </div>

      {busy && statusMsg && (
        <p className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          {statusMsg}
        </p>
      )}

      {error && !busy && (
        <p className="text-[11px] text-rose-500 flex items-center gap-1 font-medium" role="alert">
          <AlertTriangle className="h-3 w-3 shrink-0" /> {error}
        </p>
      )}

      {lastScan && !busy && (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          Scanned: <span className="font-mono font-bold">{lastScan}</span>
        </p>
      )}
    </div>
  );
};

export default ImeiScanButton;
