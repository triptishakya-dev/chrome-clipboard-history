let lastImageSignature = "";

async function captureClipboardImage() {
  try {
    const clipboardItems = await navigator.clipboard.read();
    const imageItem = clipboardItems.find((item) =>
      item.types.some((type) => type.startsWith("image/"))
    );
    if (!imageItem) return;

    const imageType = imageItem.types.find((type) => type.startsWith("image/"));
    const blob = await imageItem.getType(imageType);
    const imageData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    if (imageData === lastImageSignature) return;
    lastImageSignature = imageData;
    await chrome.runtime.sendMessage({
      type: "ADD_CLIPBOARD_IMAGE",
      imageData,
      source: "system clipboard"
    });
  } catch (_) {
    // Clipboard access is unavailable until Chrome grants clipboard permission.
  }
}

captureClipboardImage();
setInterval(captureClipboardImage, 1500);
