/**
 * ocr.js - Express router for offline, high-speed Aadhaar & IMEI recognition.
 */
import express from "express";
import multer from "multer";
import { ocrAadhaarBuffer, ocrImeiBuffer } from "../services/ocrService.js";
import { badRequest } from "../lib/errors.js";

const upload = multer({
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
});

export function buildOcrRouter(staffMiddleware) {
  const r = express.Router();

  // Helper to extract image buffer from multipart file or JSON base64
  const extractBuffer = (req) => {
    if (req.file && req.file.buffer) {
      return req.file.buffer;
    }
    const b64 = req.body?.image;
    if (typeof b64 === "string" && b64.length > 50) {
      const clean = b64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
      return Buffer.from(clean, "base64");
    }
    return null;
  };

  /**
   * POST /api/ocr/aadhaar
   * Recognizes Aadhaar from photo.
   */
  r.post("/aadhaar", upload.single("image"), async (req, res, next) => {
    try {
      const buffer = extractBuffer(req);
      if (!buffer) {
        throw badRequest("No image uploaded. Provide an image file or base64 string.");
      }

      const side = req.body?.side || req.query?.side || undefined;
      const result = await ocrAadhaarBuffer(buffer, side);
      if (!result || !result.data) {
        return res.json({
          success: false,
          error: "Could not detect Aadhaar details in this photo. Please try a closer, well-lit picture.",
          raw: result?.raw || "",
        });
      }

      return res.json({
        success: true,
        data: result.data,
        raw: result.raw,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/ocr/imei
   * Recognizes IMEI from photo via barcode or printed label OCR.
   */
  r.post("/imei", upload.single("image"), async (req, res, next) => {
    try {
      const buffer = extractBuffer(req);
      if (!buffer) {
        throw badRequest("No image uploaded. Provide an image file or base64 string.");
      }

      const result = await ocrImeiBuffer(buffer);
      if (!result || !result.imei) {
        return res.json({
          success: false,
          error: "Could not find a valid IMEI in this photo. Move closer to the IMEI label or enter it manually.",
        });
      }

      return res.json({
        success: true,
        imei: result.imei,
        via: result.via || "ocr",
        checksumOk: !!result.checksumOk,
      });
    } catch (err) {
      next(err);
    }
  });

  return r;
}

