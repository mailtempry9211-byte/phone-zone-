/**
 * PhoneZone WhatsApp Dispatcher - Content Script
 * Executes strictly on https://web.whatsapp.com/*
 * Automatically injects, finds the active chat input, types message, and clicks send.
 */

console.log("[PhoneZone WA] Content script active on WhatsApp Web.");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Find send button or press Enter in editable WhatsApp chat box
async function sendMessageOnWeb(phone, messageText) {
  try {
    // 1. WhatsApp Web chat URL redirect
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const directUrl = `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(messageText)}`;

    if (!window.location.href.includes(formattedPhone)) {
      window.location.href = directUrl;
      return { status: "navigating" };
    }

    // 2. Wait for message box to appear
    let retries = 0;
    let sendBtn = null;
    while (retries < 20) {
      await sleep(1000);
      sendBtn = document.querySelector('button[aria-label="Send"], span[data-icon="send"]');
      if (sendBtn) break;
      retries++;
    }

    if (sendBtn) {
      const clickEl = sendBtn.closest("button") || sendBtn;
      clickEl.click();
      await sleep(1500);
      return { status: "sent" };
    }

    // Fallback: check if invalid phone number popup appeared
    const invalidDialog = document.querySelector('[data-animate-modal-body="true"]');
    if (invalidDialog && invalidDialog.textContent.includes("invalid")) {
      const okBtn = invalidDialog.querySelector('button');
      if (okBtn) okBtn.click();
      return { status: "failed", error: "Phone number not registered on WhatsApp" };
    }

    return { status: "failed", error: "Send button not found or chat did not load in time" };
  } catch (err) {
    return { status: "failed", error: err.message };
  }
}

// Listen for messages from background or popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ ok: true, url: window.location.href });
    return true;
  }

  if (request.action === "dispatch") {
    sendMessageOnWeb(request.phone, request.message).then((result) => {
      sendResponse(result);
    });
    return true;
  }
});
