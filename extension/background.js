/**
 * PhoneZone WhatsApp Dispatcher - Background Service Worker (MV3)
 */

let isDispatching = false;
let dispatchTimer = null;

async function getConfig() {
  const data = await chrome.storage.local.get(["serverUrl", "apiToken", "enabled"]);
  return {
    serverUrl: data.serverUrl || "http://127.0.0.1:47713",
    apiToken: data.apiToken || "",
    enabled: !!data.enabled,
  };
}

async function fetchNextMessage() {
  const { serverUrl, apiToken, enabled } = await getConfig();
  if (!enabled || !apiToken) return null;

  try {
    const res = await fetch(`${serverUrl}/api/wa/next`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (res.status === 401) {
      console.warn("[PhoneZone WA] Token rejected or revoked.");
      await chrome.storage.local.set({ enabled: false, lastError: "Token invalid or revoked" });
      return null;
    }

    if (!res.ok) {
      console.warn("[PhoneZone WA] Server returned", res.status);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("[PhoneZone WA] Network error connecting to PhoneZone server:", err);
    return null;
  }
}

async function reportResult(queueId, status, error) {
  const { serverUrl, apiToken } = await getConfig();
  if (!apiToken) return;

  try {
    await fetch(`${serverUrl}/api/wa/result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ queueId, status, error }),
    });
  } catch (err) {
    console.error("[PhoneZone WA] Failed to report result:", err);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "getStatus") {
    getConfig().then((cfg) => {
      sendResponse({ ...cfg, isDispatching });
    });
    return true;
  }

  if (msg.action === "start") {
    chrome.storage.local.set({ enabled: true }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.action === "stop") {
    chrome.storage.local.set({ enabled: false }, () => {
      if (dispatchTimer) clearTimeout(dispatchTimer);
      isDispatching = false;
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.action === "reportResult") {
    reportResult(msg.queueId, msg.status, msg.error).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
});

