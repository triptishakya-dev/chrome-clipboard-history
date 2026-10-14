
const STORAGE_KEY = "clipboardHistory";
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const MAX_ITEMS = 500;

async function getHistory() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

async function saveHistory(history) {
  await chrome.storage.local.set({
    [STORAGE_KEY]: history
  });
}

async function cleanExpiredItems() {
  const history = await getHistory();
  const cutoff = Date.now() - MAX_AGE_MS;

  const validItems = history
    .filter((item) => item.timestamp >= cutoff)
    .slice(0, MAX_ITEMS);

  await saveHistory(validItems);
}

async function addClipboardItem(item) {
  if (!item || (item.type !== "text" && item.type !== "image")) return;

  const value = item.type === "text" ? item.text?.trim() : item.imageData;
  if (typeof value !== "string" || !value) return;

  const now = Date.now();
  const cutoff = now - MAX_AGE_MS;
  const history = await getHistory();

  const validHistory = history.filter(
    (item) => item.timestamp >= cutoff
  );

  const updatedHistory = [
    {
      id: crypto.randomUUID(),
      type: item.type,
      text: item.type === "text" ? value : undefined,
      imageData: item.type === "image" ? value : undefined,
      timestamp: now,
      source: item.source || "clipboard"
    },
    ...validHistory.filter((existingItem) =>
      item.type === "text"
        ? existingItem.text !== value
        : existingItem.imageData !== value
    )
  ].slice(0, MAX_ITEMS);

  await saveHistory(updatedHistory);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ADD_CLIPBOARD_ITEM") {
    addClipboardItem({ type: "text", text: message.text, source: message.source })
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error("Failed to save clipboard item:", error);
        sendResponse({ success: false });
      });

    return true;
  }

  if (message.type === "ADD_CLIPBOARD_IMAGE") {
    addClipboardItem({ type: "image", imageData: message.imageData, source: message.source })
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error("Failed to save clipboard image:", error);
        sendResponse({ success: false });
      });

    return true;
  }

  if (message.type === "GET_CLIPBOARD_HISTORY") {
    getHistory()
      .then((history) => sendResponse({ history }))
      .catch(() => sendResponse({ history: [] }));

    return true;
  }

  // NEW: Save updated history after deleting an individual item.
  if (message.type === "SAVE_CLIPBOARD_HISTORY") {
    if (!Array.isArray(message.history)) {
      sendResponse({ success: false });
      return;
    }

    const cutoff = Date.now() - MAX_AGE_MS;

    const validHistory = message.history
      .filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          ((item.type === "text" && typeof item.text === "string") ||
            (item.type === "image" && typeof item.imageData === "string")) &&
          Number.isFinite(item.timestamp) &&
          item.timestamp >= cutoff
      )
      .slice(0, MAX_ITEMS);

    saveHistory(validHistory)
      .then(() => sendResponse({ success: true }))
      .catch((error) => {
        console.error("Failed to update clipboard history:", error);
        sendResponse({ success: false });
      });

    return true;
  }

  if (message.type === "CLEAR_CLIPBOARD_HISTORY") {
    saveHistory([])
      .then(() => sendResponse({ success: true }))
      .catch(() => sendResponse({ success: false }));

    return true;
  }
});

async function ensureClipboardReader() {
  const offscreenUrl = "offscreen.html";
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(offscreenUrl)]
  });

  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ["CLIPBOARD"],
      justification: "Read copied screenshots and images into local clipboard history."
    });
  }
}

chrome.alarms.create("clipboardCleanup", {
  periodInMinutes: 60
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "clipboardCleanup") {
    cleanExpiredItems().catch(console.error);
  }
});

chrome.runtime.onStartup.addListener(() => {
  cleanExpiredItems().catch(console.error);
  ensureClipboardReader().catch(console.error);
});

chrome.runtime.onInstalled.addListener(() => {
  cleanExpiredItems().catch(console.error);
  ensureClipboardReader().catch(console.error);
});

ensureClipboardReader().catch(console.error);
