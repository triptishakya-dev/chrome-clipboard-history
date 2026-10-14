
const historyList = document.getElementById("historyList");
const searchInput = document.getElementById("searchInput");
const clearButton = document.getElementById("clearButton");
const itemCount = document.getElementById("itemCount");

let clipboardHistory = [];

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function createIcon(type) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute(
    "d",
    type === "copy"
      ? "M9 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Zm8-3a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2"
      : "M3 6h18M8 6V4h8v2m-7 4v7m4-7v7m4-7v7M5 6l1 15h12l1-15"
  );
  icon.appendChild(path);
  return icon;
}

function createHistoryItem(item) {
  const card = document.createElement("article");
  card.className = "history-item";

  const isImage = item.type === "image";
  const content = isImage ? document.createElement("img") : document.createElement("p");
  content.className = isImage ? "item-image" : "item-text";
  if (isImage) {
    content.src = item.imageData;
    content.alt = "Copied image";
  } else {
    content.textContent = item.text;
  }

  const meta = document.createElement("div");
  meta.className = "item-meta";

  const time = document.createElement("span");
  time.textContent = formatTime(item.timestamp);

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const copyButton = document.createElement("button");
  copyButton.className = "copy-button";
  copyButton.type = "button";
  copyButton.title = isImage ? "Copy image" : "Copy";
  copyButton.setAttribute("aria-label", isImage ? "Copy image" : "Copy");
  copyButton.appendChild(createIcon("copy"));

  copyButton.addEventListener("click", async () => {
    try {
      if (isImage) {
        const response = await fetch(item.imageData);
        const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      } else {
        await navigator.clipboard.writeText(item.text);
      }
      copyButton.classList.add("is-copied");
      copyButton.title = "Copied";

      setTimeout(() => {
        copyButton.classList.remove("is-copied");
        copyButton.title = isImage ? "Copy image" : "Copy";
      }, 1000);
    } catch (error) {
      console.error("Could not copy text:", error);
      copyButton.title = "Copy failed";
    }
  });

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.type = "button";
  deleteButton.title = "Delete";
  deleteButton.setAttribute("aria-label", "Delete");
  deleteButton.appendChild(createIcon("delete"));

  deleteButton.addEventListener("click", async () => {
    clipboardHistory = clipboardHistory.filter(
      (entry) => entry.id !== item.id
    );

    await sendMessage({
      type: "SAVE_CLIPBOARD_HISTORY",
      history: clipboardHistory
    });

    renderHistory();
  });

  actions.append(copyButton, deleteButton);
  meta.append(time, actions);
  card.append(content, meta);

  return card;
}

function renderHistory() {
  const query = searchInput.value.trim().toLowerCase();

  const filteredHistory = clipboardHistory.filter((item) =>
    item.type === "image" || item.text.toLowerCase().includes(query)
  );

  historyList.replaceChildren();

  if (filteredHistory.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-state";
    emptyMessage.textContent = query
      ? "No matching clipboard items found."
      : "No clipboard history yet. Copy text, an image, or a screenshot.";
    historyList.appendChild(emptyMessage);
  } else {
    filteredHistory.forEach((item) => {
      historyList.appendChild(createHistoryItem(item));
    });
  }

  itemCount.textContent =
    `${clipboardHistory.length} ${clipboardHistory.length === 1 ? "item" : "items"}`;
}

async function loadHistory() {
  try {
    const response = await sendMessage({
      type: "GET_CLIPBOARD_HISTORY"
    });

    clipboardHistory = response?.history || [];
    renderHistory();
  } catch (error) {
    console.error("Could not load clipboard history:", error);
    historyList.textContent = "Unable to load clipboard history.";
  }
}

searchInput.addEventListener("input", renderHistory);

clearButton.addEventListener("click", async () => {
  if (clipboardHistory.length === 0) return;

  const confirmed = confirm(
    "Are you sure you want to delete all clipboard history?"
  );

  if (!confirmed) return;

  try {
    await sendMessage({
      type: "CLEAR_CLIPBOARD_HISTORY"
    });

    clipboardHistory = [];
    renderHistory();
  } catch (error) {
    console.error("Could not clear clipboard history:", error);
  }
});

loadHistory();
