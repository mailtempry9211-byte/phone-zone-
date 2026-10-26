/**
 * Minimal public catalog server (binds on separate port, default 47714).
 * Serves ONLY public routes: homepage, public inventory, public files, contact form, public config.
 * Mounts NO auth, NO admin routes, NO /api/pg, NO /api/setup, NO /api/repair.
 */
import fs from "node:fs";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import { APP_ROOT } from "./config/paths.js";
import { SERVER } from "./config/business.js";
import { getDb } from "./db/index.js";
import { newId, badRequest, notFound } from "./lib/errors.js";
import * as inventory from "./services/inventoryService.js";
import * as storage from "./services/storageService.js";
import { publicConfig } from "./routes/index.js";

const PUBLIC_PORT = Number(process.env.PHONEZONE_PUBLIC_PORT || 47714);
const HOST = process.env.PHONEZONE_HOST || "127.0.0.1";

export function createPublicServer() {
  const app = express();

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
        },
      },
      hsts: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    })
  );

  app.use(express.json({ limit: "1mb" }));

  // Public API router
  const api = express.Router();

  api.get("/health", (_req, res) => res.json({ ok: true, catalogServer: true }));
  api.get("/public/inventory", (_req, res) => res.json(inventory.listPublicInventory()));
  api.get("/public-config", (_req, res) => res.json(publicConfig()));
  api.get("/config", (_req, res) => res.json(publicConfig()));

  api.get("/public/files/:id", (req, res) => {
    try {
      const file = storage.getFileRecord(req.params.id);
      if (!file.is_public) return res.status(403).json({ error: "This file is not public." });
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.type(file.mime_type).send(storage.readFile(file.relative_path));
    } catch {
      res.status(404).json({ error: "File not found" });
    }
  });

  api.post("/public/messages", (req, res) => {
    const { name, email, phone, message } = req.body || {};
    if (!name || !email || !message) return res.status(400).json({ error: "Please fill in name, email and message." });
    const cap = (val, max) => String(val || "").slice(0, max);
    if (String(name).length > 100 || String(email).length > 150 || String(message).length > 2000) {
      return res.status(400).json({ error: "Message too long." });
    }
    getDb()
      .prepare("INSERT INTO messages (id, name, email, phone, message) VALUES (?,?,?,?,?)")
      .run(newId(), cap(name, 100), cap(email, 150), cap(phone, 20) || null, cap(message, 2000));
    res.status(201).json({ ok: true });
  });

  // Any non-public API route returns 404 JSON
  api.use((_req, res) => res.status(404).json({ error: "Not found on public catalog server" }));

  app.use("/api", api);

  // Static built frontend (homepage)
  const dist = path.join(APP_ROOT, "dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found on public catalog server" });
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  // Refuse any non-public paths explicitly with 404
  app.use((_req, res) => res.status(404).json({ error: "Not found on public catalog server" }));

  return app;
}

const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isMain) {
  const app = createPublicServer();
  app.listen(PUBLIC_PORT, HOST, () => {
    console.log(`PhoneZone Public Catalog server listening on http://${HOST}:${PUBLIC_PORT}`);
  });
}

