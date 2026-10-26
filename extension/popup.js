/**
 * PhoneZone WhatsApp Dispatcher - Popup UI Script
 */

const serverUrlInput = document.getElementById("serverUrl");
const apiTokenInput = document.getElementById("apiToken");
const statusBadge = document.getElementById("statusBadge");
const statusText = document.getElementById("statusText");
const saveBtn = document.getElementById("saveBtn");
const toggleBtn = document.getElementById("toggleBtn");

async function loadSettings() {
  const data = await chrome.storage.local.get(["serverUrl", "apiToken", "enabled"]);
  if (data.serverUrl) serverUrlInput.value = data.serverUrl;
  if (data.apiToken) apiTokenInput.value = data.apiToken;

  updateUI(!!data.enabled);
}

function updateUI(enabled) {
  if (enabled) {
    statusBadge.textContent = "ACTIVE";
    statusBadge.className = "badge active";
    toggleBtn.textContent = "Stop Dispatcher";
    toggleBtn.style.background = "#dc2626";
    statusText.textContent = "Dispatcher is polling for pending messages...";
  } else {
    statusBadge.textContent = "STOPPED";
    statusBadge.className = "badge";
    toggleBtn.textContent = "Start Dispatcher";
    toggleBtn.style.background = "#2563eb";
    statusText.textContent = "Dispatcher paused.";
  }
}

saveBtn.addEventListener("click", async () => {
  const serverUrl = serverUrlInput.value.trim() || "http://127.0.0.1:47713";
  const apiToken = apiTokenInput.value.trim();

  await chrome.storage.local.set({ serverUrl, apiToken });
  statusText.textContent = "Settings saved!";
  setTimeout(() => {
    statusText.textContent = "Ready";
  }, 2000);
});

toggleBtn.addEventListener("click", async () => {
  const data = await chrome.storage.local.get(["enabled", "apiToken"]);
  if (!data.enabled && !data.apiToken && !apiTokenInput.value.trim()) {
    alert("Please enter a valid API Bearer Token from PhoneZone Admin Settings.");
    return;
  }

  // Save current values first
  await chrome.storage.local.set({
    serverUrl: serverUrlInput.value.trim() || "http://127.0.0.1:47713",
    apiToken: apiTokenInput.value.trim(),
  });

  const nextState = !data.enabled;
  await chrome.storage.local.set({ enabled: nextState });

  if (nextState) {
    chrome.runtime.sendMessage({ action: "start" });
  } else {
    chrome.runtime.sendMessage({ action: "stop" });
  }

  updateUI(nextState);
});

loadSettings();

