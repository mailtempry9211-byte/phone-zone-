# PhoneZone WhatsApp Marketing Extension (Chrome MV3)

This Chrome extension connects your local PhoneZone ERP with WhatsApp Web to dispatch opt-in customer updates and marketing messages safely.

## Safety & Compliance
- **Opt-In Only:** Messages are queued strictly for customers with `whatsapp_opt_in = 1` who have not opted out.
- **Server Rate Limits:** Dispatches are paced with 25-70s delays and a strict daily cap (default 50 messages/day) to prevent account restrictions.
- **Active Hours:** The PhoneZone backend only releases messages between 10:00 AM and 8:00 PM.
- **Zero Scraping:** This extension does not read or scrape any chats from WhatsApp Web.

## How to Install in Google Chrome
1. Open Google Chrome and go to `chrome://extensions/`.
2. Turn ON **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** (top-left button).
4. Select the `extension/` folder inside this PhoneZone directory.
5. The extension icon **PhoneZone WhatsApp Dispatcher** will appear in your Chrome toolbar.

## How to Use
1. Open PhoneZone Admin Dashboard -> **Marketing** tab.
2. Click **Create Extension Token** and copy the generated token.
3. Click the PhoneZone extension icon in Chrome:
   - Server URL: `http://127.0.0.1:47713` (default local port)
   - API Bearer Token: paste the copied token
   - Click **Save**
4. Open [WhatsApp Web](https://web.whatsapp.com/) in a Chrome tab and scan the QR code with your phone.
5. In the extension popup, click **Start Dispatcher**. It will pace and send queued messages automatically!

