/**
 * PhoneZone local backend. Binds to 127.0.0.1 only - never a public network.
 * Serves the built frontend (frontend/dist) so the Electron window loads
 * everything from localhost with no internet and no CDN.
 */
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { SERVER } from "./config/business.js";
import { APP_ROOT, defaultDataDir, ensureDirs, PATHS } from "./config/paths.js";
import { initDatabase, closeDatabase, getDb } from "./db/index.js";
import { ensureBootstrapAdmin, purgeExpiredSessions } from "./services/authService.js";
import { buildRouter } from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { AppError } from "./lib/errors.js";

export function createServer() {
  ensureDirs();

  initDatabase();
  const bootstrap = ensureBootstrapAdmin();
  purgeExpiredSessions();

  const app = express();
  // Security headers for the whole app + API. The API returns JSON and the
  // frontend is a local Vite build, so nothing here needs a permissive policy:
  // `default-src 'none'` on responses stops a leaked document from being framed
  // or scripted. (Images in the admin UI are same-origin data/blob/file URLs.)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'"],
          workerSrc: ["'self'", "blob:"],
          childSrc: ["'self'", "blob:"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "blob:", "data:"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      // The app is served over http://127.0.0.1 in normal desktop use, so a
      // forced HSTS upgrade would break the loopback origin.
      hsts: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());

  // CORS support for Mobile APK & remote clients
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, apikey");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Injected runtime config for desktop/remote offline mode
  app.get("/runtime-config.js", (_req, res) => {
    const { getSupabaseConfig } = require ? {} : {}; // ESM imported below or via helper
    let supabaseUrl = (process.env.SUPABASE_URL || "").trim();
    let supabaseKey = (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();
    if (!supabaseUrl || !supabaseKey) {
      try {
        const s = getDb().prepare("SELECT supabase_url, supabase_anon_key FROM admin_settings LIMIT 1").get();
        if (s) {
          if (!supabaseUrl && s.supabase_url) supabaseUrl = s.supabase_url.trim();
          if (!supabaseKey && s.supabase_anon_key) supabaseKey = s.supabase_anon_key.trim();
        }
      } catch {}
    }
    if (!supabaseUrl) supabaseUrl = "https://rkhzhozrslrfsqlpgjav.supabase.co";

    const isOffline = process.env.PHONEZONE_OFFLINE === "true" && !supabaseUrl;
    res.type("application/javascript").send(
      `window.__PHONEZONE_OFFLINE__ = ${isOffline ? "true" : "false"};\n` +
      `window.__SUPABASE_URL__ = ${JSON.stringify(supabaseUrl)};\n` +
      `window.__SUPABASE_ANON_KEY__ = ${JSON.stringify(supabaseKey)};\n`
    );
  });

  app.use("/api", buildRouter());

  // Static frontend (built Vite output or Vite dev server fallback)
  const dist = path.join(APP_ROOT, "dist");
  const distIndex = path.join(dist, "index.html");
  if (fs.existsSync(distIndex)) {
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(distIndex));
  } else {
    app.use(async (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      try {
        const viteUrl = `http://127.0.0.1:8080${req.originalUrl}`;
        const viteRes = await fetch(viteUrl);
        res.status(viteRes.status);
        viteRes.headers.forEach((val, key) => {
          if (!["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
            res.setHeader(key, val);
          }
        });
        const buf = Buffer.from(await viteRes.arrayBuffer());
        res.send(buf);
      } catch (_err) {
        res.status(502).send("Vite server on port 8080 is loading... Please refresh in 5 seconds.");
      }
    });
  }

  // Friendly errors out, technical detail to the log file.
  app.use((err, _req, res, _next) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: err.message, code: err.code });
    logger.error("Unhandled request error", err);
    res.status(500).json({
      error: "Something went wrong. Your data has not been lost. Please try again.",
      code: "internal_error",
    });
  });

  return { app, bootstrap };
}

const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isMain) {
  const { app, bootstrap } = createServer();
  const server = app.listen(SERVER.port, SERVER.host, () => {
    logger.info(`PhoneZone backend listening on http://${SERVER.host}:${SERVER.port}`);
    console.log(`Data directory: ${PATHS.dataDir}`);
    // Never print a password. An admin is only auto-created when the operator
    // supplied PHONEZONE_ADMIN_PASSWORD themselves (see ensureBootstrapAdmin).
    if (bootstrap.created) {
      console.log(`\nAdmin account created from PHONEZONE_ADMIN_PASSWORD: ${bootstrap.email}\n`);
    } else {
      const db = getDb();
      const count = db.prepare("SELECT COUNT(*) AS c FROM users").get()?.c || 0;
      if (count === 0) {
        console.log("No accounts exist yet - finish the first-run setup screen to create the owner account.\n");
      }
    }

    // Auto-sync persistent business profile, users, and data from Supabase Cloud on boot
    import("./services/supabaseSyncService.js")
      .then((m) => m.syncFromSupabaseOnBoot().catch((err) => logger.warn("Supabase boot sync error", err)))
      .catch(() => {});

    // Auto-start background services (Native Baileys WhatsApp & Ngrok)
    import("./services/baileysService.js")
      .then((m) => m.initBaileys().catch((err) => logger.warn("Baileys init error", err)))
      .catch(() => {});
    import("./services/ngrokService.js")
      .then((m) => m.autoStartTunnelOnBoot().catch((err) => logger.warn("Ngrok auto-start error", err)))
      .catch(() => {});

    // Auto-load embedded TAC database on fresh installs if empty
    import("./services/tacService.js")
      .then((m) => m.ensureEmbeddedTacLoaded().catch((err) => logger.warn("TAC auto-load error", err)))
      .catch(() => {});

    // Automated keep-alive pinger for Render / cloud hosting (pings /api/health every 10 min)
    const keepAliveUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
    if (keepAliveUrl) {
      const pingTarget = `${keepAliveUrl.replace(/\/$/, "")}/api/health`;
      setInterval(async () => {
        try {
          await fetch(pingTarget);
          logger.info(`Keep-alive ping sent to ${pingTarget}`);
        } catch (_err) {}
      }, 10 * 60 * 1000); // 10 minutes
    }
  });
  const shutdown = () => {
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
