# PhoneZone OpenWA WhatsApp Gateway Integration Guide

This guide explains how PhoneZone connects to **[rmyndharis/OpenWA](https://github.com/rmyndharis/OpenWA)** for automated WhatsApp messaging and PDF document dispatch.

---

## 🎯 Architecture Overview

PhoneZone connects directly to the OpenWA REST Gateway running locally (default: `http://localhost:2785`) or on any remote server without requiring any Chrome extensions or browser automation.

### 🌟 Dual WhatsApp Session Architecture
As requested, PhoneZone natively supports **Two Independent WhatsApp Sessions**:
1. **Sales Channel (`phonezone-sales`)**: Dispatches purchase bills, sales invoices (PDFs), and promotional marketing campaigns.
2. **Repairs Channel (`phonezone-repairs`)**: Dispatches repair job receipts, diagnosis reports, and "Ready for Pickup" status alerts.
3. **Unified Mode Toggle**: If the shop uses only one single WhatsApp number for both sales and repairs, the user can toggle *"Use single WhatsApp number for both Sales & Repairs"*, and all dispatches automatically route through the primary sales session.

---

## 🚀 How to Run OpenWA

In a terminal on your computer or server:

```bash
# Clone the OpenWA repo
git clone https://github.com/rmyndharis/OpenWA.git
cd OpenWA

# Start via Docker
docker compose -f docker-compose.dev.yml up -d
```

OpenWA will start listening on `http://localhost:2785`.

---

## 📲 How to Link WhatsApp in PhoneZone

1. In PhoneZone, go to **Admin Panel &rarr; Marketing** tab.
2. At the top, you will see the **OpenWA Self-Hosted WhatsApp API Gateway** card.
3. Select whether you want to link **Sales WhatsApp Session** or **Repair Dept WhatsApp Session**.
4. The live QR code from OpenWA will display automatically on the screen.
5. Open WhatsApp on your phone &rarr; **Linked Devices** &rarr; **Link a Device** &rarr; Scan the QR code.
6. The session will instantly show **"Connected & Ready"**.

---

## 📄 Automated PDF & Message Dispatch Endpoints

- **Send Text Message**: `POST /api/wa/gateway/send-text`
  - Body: `{ "phone": "919876543210", "message": "Text...", "channel": "sales" | "repairs" }`
- **Send Invoice PDF**: `POST /api/wa/gateway/send-invoice-pdf`
  - Body: `{ "phone": "919876543210", "invoiceId": "<uuid>", "channel": "sales" }`
  - Automatically loads the rendered invoice PDF buffer, converts to base64, and calls OpenWA's `/send-document` endpoint with official receipt naming.

