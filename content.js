
document.addEventListener("copy", (event) => {
  const imageItem = Array.from(event.clipboardData?.items || []).find((item) =>
    item.type.startsWith("image/")
  );

  if (imageItem) {
    const imageFile = imageItem.getAsFile();
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = () => {
        chrome.runtime.sendMessage({
          type: "ADD_CLIPBOARD_IMAGE",
          imageData: reader.result,
          source: window.location.hostname
        }).catch((error) => console.debug("Clipboard image message failed:", error));
      };
      reader.readAsDataURL(imageFile);
    }
    return;
  }

  // Copy event ke baad selected text read karne ki koshish karein.
  setTimeout(() => {
    const selectedText = window.getSelection()?.toString() || "";

    if (!selectedText.trim()) {
      return;
    }

    chrome.runtime.sendMessage({
      type: "ADD_CLIPBOARD_ITEM",
      text: selectedText,
      source: window.location.hostname
    }).catch((error) => {
      console.debug("Clipboard history message failed:", error);
    });
  }, 100);
});
