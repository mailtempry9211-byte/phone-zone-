# PhoneZone - Local Offline Mobile Store ERP

PhoneZone is a secure, offline-first management system designed for Indian mobile-phone shops. It manages phone purchases, sales, customer invoices, returns, a private repairs workshop, inventory cross-checks, and optional remote access.

---

## Quick Start (Run Locally in Your Web Browser)

You do NOT need an EXE or installation to test and run PhoneZone. You can run it directly in your browser:

### Option 1: Double-Click Master Control Panel (Easiest)
1. Double-click `PHONEZONE-CONTROL.bat`.
2. Choose **[1] Start / Restart application**.
3. Open your browser and go to: **`http://127.0.0.1:47713`** (or press [4] Open in browser).

### Option 2: Run via Command Line
```powershell
npm run dev:all
```
This runs both the backend server and the live frontend with hot reload. Open **`http://localhost:8080`** in Chrome or Edge.

---

## First Run Setup Wizard
When you run PhoneZone on a clean database for the first time:
1. Open the app in your browser (`http://127.0.0.1:47713`).
2. The First Run Setup Wizard will appear automatically.
3. Enter your Shop Name, Address, Phone Number, and Admin Password.
4. Click **Complete Setup** to begin using PhoneZone immediately.

---

## Core Features & Usage Guide

- **Inventory / Buying Phones:**
  - Click **Add Phone** in the Inventory tab.
  - Enter the seller's KYC details and the 15-digit IMEI. The system automatically performs a Luhn algorithm validation and looks up the Brand & Model via TAC (Type Allocation Code).
  - Purchase invoices are generated automatically.

- **Sales & Customer Invoices:**
  - Sell unsold phones with a single click. Invoices follow standard Indian Financial Year numbering (e.g., `SAL-2026-27-0001`) and print cleanly on A4 paper.

- **Private Repairs Module:**
  - Navigate to the **Repairs** tab.
  - Log customer repair jobs, assign technicians, track diagnoses, and record parts/labour.
  - If a Motherboard/Board is replaced, the system flags it automatically.
  - Print customer + shop copies of the Job Sheet (with QR code) or the final Repair Invoice.

- **Automated Cross-Checks:**
  - Entering a phone number in Purchase/Sales automatically checks if that customer has a repair history.
  - Entering an IMEI in Purchase alerts staff if that specific phone was ever repaired at your shop (with special warnings if the motherboard was replaced).

- **WhatsApp Marketing (Chrome Extension):**
  - Load the `extension/` folder as an unpacked extension in Google Chrome (`chrome://extensions`).
  - Generate an API Bearer token in the **Marketing** tab.
  - The extension paces promotional and reminder messages through WhatsApp Web safely (25-70s delays, daily limit, opt-in customers only).

- **Multi-Shop Scoping:**
  - Staff users are bound to their shop counter; admin can toggle between shops or view all.
  - Invoice and repair job numbers carry counter-specific codes (`SAL-MAIN-2026-27-0001`, `SAL-B2-2026-27-0001`) preventing collisions.

- **Data Safety & Backups:**
  - Go to **Settings -> Backups** and click **Backup Now**. A full copy of your database, settings, and documents is packaged into an archive without needing any external tools.

---

## Verifying the Codebase

To run the automated verification suite:
```powershell
node scripts/verify-all.mjs
```
or double-click `VERIFY.bat`.
