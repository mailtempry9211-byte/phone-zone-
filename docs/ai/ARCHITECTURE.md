# PhoneZone: System Architecture (docs/ai/ARCHITECTURE.md)

## 1. High-Level Process Model

```mermaid
flowchart TD
    subgraph Browser/Electron Window
        FE[React 18 + Vite Frontend]
    end

    subgraph Backend [Express on 127.0.0.1:47713]
        Router["/api (Express Router)"]
        RemoteGuard[remoteGuard Middleware]
        Auth[Auth Service & Hashed Sessions]
        Inv[Inventory & Purchase Service]
        Rep[Repairs Service - Private]
        Compat[Compat Layer /api/pg/*]
        DB[(better-sqlite3 Database)]
        Storage[(Local File Storage)]
    end

    subgraph PublicServer [Optional Minimal Server on 127.0.0.1:47714]
        PubRouter[/api/public & Static Website]
    end

    FE -->|Local HTTP / Proxy| Router
    Router --> RemoteGuard
    RemoteGuard --> Auth
    Auth --> Inv
    Auth --> Rep
    Auth --> Compat
    Inv --> DB
    Rep --> DB
    Compat --> DB
    Inv --> Storage
    Rep --> Storage
```

## 2. Remote Access & Guard Rules
- Remote requests are detected by presence of `X-Forwarded-For` or `Forwarded` headers.
- **When Remote Mode is OFF:**
  - Any request carrying `X-Forwarded-For` receives `403 Forbidden`.
- **When Remote Mode is ON:**
  - Remote requests are blocked from:
    - `/api/setup/*`
    - `/api/backups/*`, `/api/restore/*`, export, import
    - User management routes
    - Storage usage inspection
    - Compat delete operations

## 3. Data Layout
- Local application data structure:
  - `<userData>/companies/<id>/database/phonezone.db`
  - `<userData>/companies/<id>/storage/` (categorized by owner type)
  - `<userData>/companies/<id>/backups/`
  - `<userData>/logs/main.log`
- Storage layout:
  - Public trees: `product_photos`, `business_assets`
  - Private trees: `sellers`, `customers`, `repair`, `repair_customer`, `payments`

## 4. SQLite Migration Policy
- Sequential execution based on filenames in `database/migrations/NNN_*.sql`.
- Standard SQLite syntax: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
- Never use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Use plain `ALTER TABLE ADD COLUMN` strictly when the column does not pre-exist.
- All migrations are verified against both fresh databases and pre-stamped database versions.

## 5. WhatsApp Marketing Architecture
- Chrome MV3 Extension interacts via authenticated bearer tokens hashed in SQLite (`wa_tokens`).
- Extension communicates strictly with `GET /api/wa/next` and `POST /api/wa/result`.
- Queue dispatcher enforces daily limits, delays, and operating hours completely server-side.

