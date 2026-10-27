/**
 * useAadhaarOcr - offline Aadhaar card reading (Step 3).
 *
 * Engine: tesseract.js (kept because it is the best general OCR we have in-browser).
 * Accuracy helpers around it:
 *  1. Secure QR decode first (jsQR) - exact name/DOB/gender/address when the card
 *     has a QR, and only a light tesseract pass for the printed number.
 *  2. One enhanced tesseract pass on a contrast-stretched, upscaled grayscale frame.
 *  3. A second, cheaper pass on the original color file when the enhanced pass
 *     missed the name/address (enhancement can wash out text that the color frame
 *     still shows clearly).
 *
 * Runs from /ocr/* (copied into public/ by scripts/copy-ocr-assets.mjs) so it is
 * fully offline. The worker + language data load lazily on the FIRST scan only.
 */
import { useCallback, useRef, useState } from "react";
import { parseAadhaarText, pickBestAadhaar, scoreAadhaar, type AadhaarData } from "@/lib/aadhaarParser";
import { decodeAadhaarQrFromImage, assembleIdNumber, type AadhaarQrData } from "@/lib/aadhaarQr";
import { verhoeffValidate } from "@/lib/verhoeff";

export type OcrStatus = "idle" | "loading" | "reading" | "done" | "error";

export interface OcrState {
  status: OcrStatus;
  progress: number; // 0..1
  data: AadhaarData | null;
  raw: string;
  error: string;
  viaQr: boolean;
}

const IDLE: OcrState = { status: "idle", progress: 0, data: null, raw: "", error: "", viaQr: false };

/** Rotate an image blob by deg (90/180/270) via canvas, return a new blob. */
const rotateImage = async (src: Blob, deg: number): Promise<Blob> => {
  const bitmap = await createImageBitmap(src);
  const swap = deg % 180 !== 0;
  const w = swap ? bitmap.height : bitmap.width;
  const h = swap ? bitmap.width : bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.translate(w / 2, h / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not rotate the image."))),
      // JPEG: PNG-encoding a full phone photo frame is slow on mid-range phones.
      "image/jpeg",
      0.92,
    );
  });
};

/**
 * Cap the working photo at SCAN_MAX_LONG_SIDE px. A 12-megapixel phone shot makes
 * every later pass (QR ladder + 4 OCR rotations) painfully slow - the card text is
 * already comfortably readable at this size, so we shrink ONCE up front and all
 * later passes work on the small copy. This is the main "stuck on phone" fix.
 */
const SCAN_MAX_LONG_SIDE = 2200;
/** Slot for the tesseract worker+lang init so it starts while QR is running. */
let workerPromise: Promise<any> | null = null;
const downscaleForScan = async (src: File | Blob): Promise<File | Blob> => {
  try {
    const bitmap = await createImageBitmap(src);
    const long = Math.max(bitmap.width, bitmap.height);
    if (long <= SCAN_MAX_LONG_SIDE) {
      bitmap.close();
      return src;
    }
    const scale = SCAN_MAX_LONG_SIDE / long;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
    return blob ?? src;
  } catch {
    return src;
  }
};

/**
 * pdfjs v6 relies on ES2025 `Uint8Array.prototype.toHex` which older Chromium
 * builds (the desktop webview) don't ship - patch it before pdf.js loads.
 */
const ensureUint8ArrayHex = () => {
  const proto = Uint8Array.prototype as unknown as Record<string, unknown>;
  if (typeof proto.toHex !== "function") {
    proto.toHex = function (this: Uint8Array) {
      let out = "";
      for (let i = 0; i < this.length; i++) out += this[i].toString(16).padStart(2, "0");
      return out;
    };
  }
  if (typeof proto.toBase64 !== "function") {
    const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    proto.toBase64 = function (this: Uint8Array) {
      let out = "";
      for (let i = 0; i < this.length; i += 3) {
        const b0 = this[i], b1 = this[i + 1], b2 = this[i + 2];
        out +=
          B64[b0 >> 2] +
          B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)] +
          (b1 === undefined ? "=" : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]) +
          (b2 === undefined ? "=" : B64[b2 & 63]);
      }
      return out;
    };
  }
};

/**
 * If the file is a PDF (e-Aadhaar download), render page 1 to a canvas at high
 * resolution (PDF-QR decodes perfectly; PNG screenshots of the same PDF are
 * usually too small). Returns null for non-PDF input.
 */
const pdfToCanvas = async (file: File | Blob): Promise<HTMLCanvasElement | null> => {
  const isPdf =
    file instanceof File && file.name.toLowerCase().endsWith(".pdf") ||
    (file as Blob & { type?: string }).type === "application/pdf";
  if (!isPdf) return null;
  ensureUint8ArrayHex();
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/ocr/pdf.worker.min.mjs";
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({
    data: buf,
    standardFontDataUrl: "/ocr/standard_fonts/",
    cMapUrl: "/ocr/cmaps/",
    cMapPacked: true,
    // Mobile Chromium: isOffscreenCanvasSupported=true can produce blank renders
    // on Android; desktop needs no change, so gate it.
    isOffscreenCanvasSupported: !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),
  }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  // Mobile Chromium OOMs on very large canvases and then renders BLANK pages -
  // the same PDF decodes fine on desktop and dead on the phone. Cap the render
  // on small-screen/low-memory devices; 1600px long side still reads the QR.
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const maxLong = isMobile ? 1600 : 2400;
  const scale = Math.min(6, maxLong / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;
  // Mobile blank-render guard: if the page rendered essentially empty, retry
  // once at 0.6x scale - a blank canvas never decodes, the smaller one often does.
  const probe = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let light = 0;
  for (let i = 0; i < probe.length; i += 4) {
    const g = (probe[i] * 299 + probe[i + 1] * 587 + probe[i + 2] * 114) / 1000;
    if (g > 235) light++;
  }
  if (light / (probe.length / 4) > 0.97) {
    const vp2 = page.getViewport({ scale: scale * 0.6 });
    canvas.width = Math.round(vp2.width);
    canvas.height = Math.round(vp2.height);
    await page.render({ canvas, canvasContext: ctx, viewport: vp2 } as any).promise;
  }
  await doc.cleanup();
  return canvas;
};

/**
 * Draw the photo to a canvas, upscaled to at least ~1400px on the long side
 * and contrast-stretched. Small phone photos and washed-out prints are the #1
 * OCR killer - this alone rescues a lot of cards.
 */
const enhanceCanvas = async (src: Blob | File, minLongSide = 1400): Promise<HTMLCanvasElement> => {
  const bitmap = await createImageBitmap(src);
  const long = Math.max(bitmap.width, bitmap.height);
  const scale = long < minLongSide ? Math.min(3, minLongSide / long) : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // Grayscale + contrast stretch (2nd and 98th percentile).
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.round((px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000);
    px[i] = px[i + 1] = px[i + 2] = g;
    hist[g]++;
  }
  const total = (px.length / 4) | 0;
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= total * 0.02) {
      lo = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= total * 0.02) {
      hi = v;
      break;
    }
  }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    let v = Math.max(0, Math.min(255, Math.round(((px[i] - lo) * 255) / range)));
    // Push dark ink down, push background paper and plastic reflection up
    if (v < 130) v = Math.max(0, Math.round((v / 130) * 40));
    else if (v > 165) v = 255;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};

const blobFromCanvas = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process the image."))),
      "image/jpeg",
      0.95,
    );
  });

/**
 * Grayscale frame scaled so its long side is `target` px (up to 3x, and down to
 * 0.5x for very large phone photos so a 12-megapixel JPEG cannot stall the hunt).
 *
 * Deliberately NOT contrast-stretched: stretching helps printed text but flattens
 * the light/dark module contrast a QR decoder relies on.
 *
 * `targetLongSide` 0 means native size; anything else rescales so the long side
 * lands there (bounded to 0.5x-3x so a 12-megapixel JPEG cannot stall the hunt).
 * `smooth` picks bilinear vs nearest-neighbour - measured on a real PVC card
 * photo (a ~200px QR in a 739x1600 shot) jsQR misses the QR at 1x, and with
 * SMOOTHED upscaling also misses it at 1.5x, yet locks on at 2x nearest and at
 * 2.5x/3x smoothed. Hence the ladder in tryQr().
 */
const qrCanvas = async (
  src: Blob | File,
  targetLongSide: number,
  smooth: boolean,
  maxArea = 0,
): Promise<HTMLCanvasElement> => {
  const bitmap = await createImageBitmap(src);
  const long = Math.max(bitmap.width, bitmap.height);
  const aspect = long / Math.max(1, Math.min(bitmap.width, bitmap.height));
  let scale = targetLongSide ? targetLongSide / long : 1;
  // Area cap: a portrait 12MP shot zoomed 2x becomes a ~14MP frame, and jsQR
  // over a frame that size freezes a mid-range phone for minutes. The QR text
  // itself does not grow past ~2.5x, so capping the AREA (long side modelled
  // from short x aspect) keeps each pass under ~6-8 megapixels.
  if (maxArea) {
    scale = Math.min(scale, Math.sqrt(maxArea * aspect) / long);
  }
  scale = Math.max(1, Math.min(3, scale));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = smooth;
  ctx.imageSmoothingQuality = smooth ? "high" : "low";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.round((px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000);
    px[i] = px[i + 1] = px[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};

/**
 * Regions to hunt for a QR in: the full frame plus 4 overlapping quadrants,
 * each upscaled so small card QRs (often <200px in a phone photo) still decode.
 */
const qrRegions = (canvas: HTMLCanvasElement): HTMLCanvasElement[] => {
  const regions = [canvas];
  const w = canvas.width;
  const h = canvas.height;
  const crops: Array<[number, number, number, number]> = [
    [0, 0, 0.62, 0.62],
    [0.38, 0, 0.62, 0.62],
    [0, 0.38, 0.62, 0.62],
    [0.38, 0.38, 0.62, 0.62],
  ];
  for (const [fx, fy, fw, fh] of crops) {
    const cw = Math.round(w * fw);
    const ch = Math.round(h * fh);
    const cx = Math.round(w * fx);
    const cy = Math.round(h * fy);
    const scale = Math.max(1, Math.min(4, 1000 / Math.min(cw, ch)));
    const c2 = document.createElement("canvas");
    c2.width = Math.round(cw * scale);
    c2.height = Math.round(ch * scale);
    const ctx2 = c2.getContext("2d", { willReadFrequently: true })!;
    ctx2.imageSmoothingEnabled = true;
    ctx2.imageSmoothingQuality = "high";
    ctx2.drawImage(canvas, cx, cy, cw, ch, 0, 0, c2.width, c2.height);
    regions.push(c2);
  }
  return regions;
};

/** Try to pull an Aadhaar Secure/Legacy QR out of the photo at several scales. */
const tryQr = async (
  file: File | Blob,
  onStep?: (msg: string) => void,
): Promise<AadhaarQrData | null> => {
  try {
    const pdfCanvas = await pdfToCanvas(file);
    if (pdfCanvas) {
      const ctx = pdfCanvas.getContext("2d", { willReadFrequently: true })!;
      const img = ctx.getImageData(0, 0, pdfCanvas.width, pdfCanvas.height);
      const hit = decodeAadhaarQrFromImage(img.data, pdfCanvas.width, pdfCanvas.height);
      if (hit) return hit;
    }
  } catch {
    /* fall through to image path */
  }
  const scanRegion = (canvas: HTMLCanvasElement): AadhaarQrData | null => {
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return decodeAadhaarQrFromImage(img.data, canvas.width, canvas.height);
    } catch {
      return null;
    }
  };

  // 1) Native pass with quadrant crops - instant when the QR is already large.
  // Whole QR phase gets a hard wall-clock budget; the OCR phase is the fallback
  // and it must always get its share of the 40s the user is willing to wait.
  const qrDeadline = Date.now() + 10_000;
  const outOfTime = () => Date.now() > qrDeadline;
  try {
    onStep?.("Looking for the QR code...");
    const native = await enhanceCanvas(file, 1600);
    for (const region of qrRegions(native)) {
      if (outOfTime()) break;
      const hit = scanRegion(region);
      if (hit) return hit;
    }
  } catch {
    /* fall through to the upscale ladder */
  }

  // 2) Upscale ladder for the common small-QR phone photo. Rung 1 is 2x the
  //    native long side (nearest-neighbour locks on cleanly at a clean 2x);
  //    rungs 2-3 are fixed 2.5x / 3x smoothed upscales, which is what a real
  //    PVC-card photo needed. The full frame alone is enough here, which keeps
  //    the extra passes cheap.
  let long0 = 0;
  try {
    const bm = await createImageBitmap(file);
    long0 = Math.max(bm.width, bm.height);
    bm.close();
  } catch {
    /* fall back to a fixed target */
  }
  const firstTarget = long0 ? long0 * 2 : 3200;
  // Two rungs only, each area-capped: measured on the failing phone shots the
  // working settings were always 2x-nearest or 2.5-3x-smoothed, never anything
  // between them. Fewer, smaller passes = no multi-minute QR hunt.
  const QR_MAX_AREA = 6_500_000;
  const ladder: Array<[number, boolean]> = [
    [firstTarget, false],
    [4000, true],
  ];
  for (let i = 0; i < ladder.length; i++) {
    if (outOfTime()) break;
    const [target, smooth] = ladder[i];
    onStep?.(`Looking for the QR code (zoom pass ${i + 1} of 2)...`);
    let canvas: HTMLCanvasElement;
    try {
      canvas = await qrCanvas(file, target, smooth, QR_MAX_AREA);
    } catch {
      continue;
    }
    const hit = scanRegion(canvas);
    if (hit) return hit;
  }
  return null;
};

/** Read the big printed Aadhaar number from a frame. Tries a couple of PSM values. */
const readPrintedNumber = async (
  worker: any,
  blob: Blob,
): Promise<{ number: string | null; raw: string }> => {
  let best: string | null = null;
  let raw = "";
  const modes: Array<{ label: string; opts: Record<string, string> }> = [
    { label: "block mode", opts: { tessedit_pageseg_mode: "6" } },
    { label: "sparse text", opts: { tessedit_pageseg_mode: "11" } },
  ];
  for (const { label, opts } of modes) {
    const { data } = await worker.recognize(blob, opts);
    raw = data?.text || "";
    const m = raw.match(/\b(\d{4}[ -]?){2}\d{4}\b/);
    if (m) {
      const d = m[0].replace(/\D/g, "");
      if (d.length === 12) {
        best = d;
        break;
      }
      if (!best) best = d;
    }
  }
  return { number: best, raw };
};

export const useAadhaarOcr = () => {
  const [state, setState] = useState<OcrState>(IDLE);
  const workerRef = useRef<any>(null);
  const busyRef = useRef(false);

  const ensureWorker = useCallback(async () => {
    if (!workerRef.current) {
      const { createWorker } = await import("tesseract.js");
      // v7 API: workerBlobURL=true (default) avoids cross-origin importScripts
      // issues when the app is served through ngrok/https tunnel. The worker
      // blob fetches all assets via absolute URLs below, so offline still works.
      workerRef.current = await createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr",
        langPath: "/ocr",
        workerBlobURL: false,
        gzip: true,
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setState((s) => ({ ...s, status: "reading", progress: m.progress ?? 0 }));
          }
        },
      });
    }
    return workerRef.current;
  }, []);

  const scan = useCallback(async (file: File | Blob, side?: "front" | "back") => {
    if (busyRef.current) return;
    busyRef.current = true;
    setState({ ...IDLE, status: "loading" });
    // Kick the tesseract worker load (worker.min.js + wasm + 5MB traineddata)
    // off NOW, in parallel with the QR hunt - first-scan latency is then bound
    // by the sum of the two phases running together, not back to back.
    const { createWorker } = await import("tesseract.js");
    void createWorker;
    const workerP: Promise<any> = ensureWorker().catch(() => null);
    workerPromise = workerP;
    try {
      // Shrink a huge phone photo ONCE; every pass below works on this copy.
      const workFile = await downscaleForScan(file);

      // Fast-path: try Backend Native OCR first (<1.5s, no heavy WASM/memory exhaustion on mobile)
      try {
        setState((s) => ({ ...s, status: "reading", progress: 0.1, error: "Scanning Aadhaar..." }));
        const form = new FormData();
        form.append("image", workFile);
        if (side) form.append("side", side);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const resp = await fetch("/api/ocr/aadhaar", {
          method: "POST",
          body: form,
          signal: controller.signal,
          credentials: "include",
        });
        clearTimeout(timeoutId);
        if (resp.ok) {
          const res = await resp.json();
          if (res.success && res.data) {
            const d = res.data;
            // If user specifically requested back side (address) but backend failed to find an address,
            // don't abort with empty address! Fall through to client-side QR ladder & OCR.
            if (side === "back" && (!d.address || d.address.length < 5)) {
              // fall through to client-side QR ladder & Tesseract
            } else {
              const idNumber = d.idNumber || "";
              const ok = idNumber ? verhoeffValidate(idNumber) : false;
              const data: AadhaarData = {
                idNumber,
                name: side === "back" ? undefined : d.name,
                dob: side === "back" ? undefined : d.dob,
                yob: side === "back" ? undefined : d.yob,
                gender: side === "back" ? undefined : d.gender,
                address: side === "front" ? undefined : d.address,
                checksumOk: ok || !!d.checksumOk,
              };
              setState({
                status: "done",
                progress: 1,
                data,
                raw: res.raw || "",
                error: idNumber
                  ? ok || d.checksumOk ? "" : "Number found but please verify it."
                  : "Card details read - scan front side if number was not captured.",
                viaQr: !!d.viaQr,
              });
              return;
            }
          }
        }
      } catch (_e) {
        // Backend not reachable or timed out: seamlessly falls through to client-side pipeline
      }

      // ---- Pass 0: Secure QR (exact data, no OCR) ------------------------
      setState((s) => ({ ...s, status: "reading", progress: 0.05, error: "Looking for the QR code..." }));
      const qr = await tryQr(workFile, (msg) => {
        setState((s) => ({ ...s, status: "reading", error: msg }));
      });

      const worker = await workerP;

      // ---- QR path: exact fields from the QR, printed number from tesseract
      if (qr) {
        setState((s) => ({ ...s, error: "QR found - reading the printed number..." }));
        let printed: string | null = null;
        let printedRaw = "";
        try {
          if (worker) {
            const res = await readPrintedNumber(worker, await blobFromCanvas(await enhanceCanvas(workFile, 1600)));
            printed = res.number;
            printedRaw = res.raw;
          }
        } catch (_err) {
          /* keep QR data even if printed number reading had an issue */
        }
        const idNumber = assembleIdNumber(printed, qr);
        const data: AadhaarData = {
          idNumber,
          name: side === "back" ? undefined : qr.name,
          dob: side === "back" ? undefined : qr.dob,
          yob: side === "back" ? undefined : qr.yob,
          gender: side === "back" ? undefined : qr.gender,
          address: side === "front" ? undefined : qr.address,
          mobile: undefined,
          checksumOk: /^\d{12}$/.test(idNumber) ? verhoeffValidate(idNumber) : false,
        };
        setState({
          status: "done",
          progress: 1,
          data,
          raw: `QR(${qr.kind})\n` + printedRaw,
          error: /^\d{12}$/.test(idNumber) ? "" : "Read from QR - type the full card number if you have it handy.",
          viaQr: true,
        });
        return;
      }

      // ---- OCR path: score every rotation, keep the most complete read -----
      if (!worker) {
        throw new Error("OCR engine failed to initialize. Please check WebWorker support or reload.");
      }
      // A card photo is often a quarter-turn off portrait, and a sideways frame
      // can still hand back a checksum-valid number while losing the name - so we
      // never stop at the first parse, we compare them (pickBestAadhaar).
      // Order matters for speed: 0° covers upright cards, 270° is the quarter-turn
      // seen on real PVC shots (card rotated inside a portrait frame), then 90°,
      // then 180°. Parallel-run validation shows most reads land in the first two.
      const enhanced = await enhanceCanvas(workFile, 1600);
      const enhancedBlob = await blobFromCanvas(enhanced);

      const rotations = [0, 270, 90, 180];
      // Worn/dirty PVC prints: PSM 6 (uniform block) often loses the big
      // printed number or the address, while PSM 4 (columns) and 11 (sparse)
      // still catch them - measured on a real failing card ("2272 4562 0188"
      // visible only under PSM 4/11). Extra modes run ONLY when the first pass
      // is missing fields, so clean reads never pay the extra time.
      const psmLadder = ["6", "4", "11"];
      const parses: AadhaarData[] = [];
      const passAngle = new Map<AadhaarData, number>();
      let raw = "";

      // Wall-clock budget: a scan must finish in <=40s even on a slow phone.
      // Two full rotations + the colour rescue pass is the practical worst case.
      const OCR_DEADLINE = Date.now() + 40_000;
      let passes = 0;
      const MAX_OCR_PASSES = 3; // rotations only; the rescue pass is extra
      for (let i = 0; i < rotations.length; i++) {
        const deg = rotations[i];
        if (i > 0 && (passes >= MAX_OCR_PASSES || Date.now() > OCR_DEADLINE)) break;
        setState((s) => ({
          ...s,
          status: "reading",
          progress: 0.15 + i * 0.18,
          error: deg === 0 ? "Reading the card with OCR..." : `Trying the card turned ${deg}\u00b0...`,
        }));
        const frameBlob = deg === 0 ? enhancedBlob : await rotateImage(enhancedBlob, deg);
        for (const psm of psmLadder) {
          passes++;
          setState((s) => ({
            ...s,
            status: "reading",
            error: psm === "6" ? (deg === 0 ? "Reading the card with OCR..." : `Trying the card turned ${deg}\u00b0...`) : "Re-reading for missed details...",
          }));
          const { data: passData } = await worker.recognize(frameBlob, { tessedit_pageseg_mode: psm });
          const text = passData?.text || "";
          if (!raw) raw = text;
          const pass = parseAadhaarText(text, side);
          if (pass) {
            parses.push(pass);
            passAngle.set(pass, deg);
            // Only a read with name + address + a valid number is worth stopping for.
            if (scoreAadhaar(pass) >= 12) break;
          }
          // A complete parse in this frame short-circuits the PSM ladder;
          // otherwise keep climbing the ladder within this rotation.
          if (Date.now() > OCR_DEADLINE) break;
        }
        // higher-level stop: did any parse so far score full marks?
        if (parses.length && scoreAadhaar(pickBestAadhaar(parses)) >= 12) break;
      }

      let parsed = pickBestAadhaar(parses);

      // Rescue pass: the untouched color photo often keeps a name line that the
      // contrast-stretched frame washed out. Run it once, in the winning rotation.
      if (!parsed || (side === "front" ? !parsed.name : !parsed.address)) {
        setState((s) => ({ ...s, status: "reading", progress: 0.85, error: "Re-reading the original photo for missed details..." }));
        const winner = parses.reduce<AadhaarData | null>(
          (a, b) => (scoreAadhaar(b) > scoreAadhaar(a) ? b : a),
          null,
        );
        const deg = (winner && passAngle.get(winner)) ?? 0;
        try {
          const rescueBlob = deg === 0 ? workFile : await rotateImage(workFile, deg);
          const { data: rescueData } = await worker.recognize(rescueBlob, { tessedit_pageseg_mode: "4" });
          const rescue = parseAadhaarText(rescueData?.text || "", side);
          if (rescue) {
            parses.push(rescue);
            parsed = pickBestAadhaar(parses);
            if (!raw) raw = rescueData?.text || "";
          }
        } catch {
          /* the enhanced passes stand on their own */
        }
      }

      if (!parsed) {
        setState({
          status: "error",
          progress: 1,
          data: null,
          raw,
          error: "Could not read the card. Try a closer, straight-on picture in good light - or scan the side with the QR code.",
          viaQr: false,
        });
      } else {
        // Verify the number is plausible: 12 digits + Verhoeff (parser may have
        // repaired it). Worn back sides can read name+address but NO number -
        // that is still a useful scan (fills address/name; front side adds the
        // number), so accept a partial parse instead of erroring.
        const ok = parsed.idNumber ? verhoeffValidate(parsed.idNumber.replace(/\D/g, "")) : false;
        setState({
          status: "done",
          progress: 1,
          data: parsed,
          raw,
          error: parsed.idNumber
            ? ok ? "" : "Number found but the checksum failed - please verify it."
            : "Card data read, but the printed number was not visible - scan the front side to capture it.",
          viaQr: false,
        });
      }
    } catch (err: any) {
      console.error("[aadhaar-ocr] scan failed:", err);
      // Surface the REAL error - the assets message was hiding the true cause
      // (phones fail for different reasons than desktops do).
      setState({
        ...IDLE,
        status: "error",
        error: err?.message
          ? `OCR failed: ${err.message}`
          : "OCR failed. Make sure public/ocr assets exist (node scripts/copy-ocr-assets.mjs).",
      });
    } finally {
      busyRef.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    setState(IDLE);
  }, []);

  const destroy = useCallback(async () => {
    try {
      await workerRef.current?.terminate?.();
    } catch {
      /* ignore */
    }
    workerRef.current = null;
  }, []);

  return { ...state, scan, reset, destroy };
};
