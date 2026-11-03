import express from "express";
import { getLicenseStatus, activateLicense, deactivateLicense } from "./licenseService.js";
import { getDeviceInfo } from "./hardwareId.js";

/**
 * Universal Plug-and-Play Licensing Express Router
 * Mount in ANY project using:
 *   app.use("/api/license", licenseRouter);
 */
export const licenseRouter = express.Router();

// 1. Current license status (Public / Zero-auth so frontend can check on startup)
licenseRouter.get("/status", async (_req, res) => {
  try {
    const status = getLicenseStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to check license status" });
  }
});

// 2. Hardware ID and platform info
licenseRouter.get("/device-info", (_req, res) => {
  try {
    const info = getDeviceInfo();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to get device info" });
  }
});

// 3. Activate license key
licenseRouter.post("/activate", async (req, res) => {
  try {
    const { licenseKey, customerName, shopName } = req.body || {};
    if (!licenseKey) {
      return res.status(400).json({ success: false, error: "License key is required." });
    }
    const result = await activateLicense({ licenseKey, customerName, shopName });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message || "Activation failed" });
  }
});

// 4. Deactivate machine / release device slot
licenseRouter.post("/deactivate", async (_req, res) => {
  try {
    const result = await deactivateLicense();
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message || "Deactivation failed" });
  }
});

export default licenseRouter;
