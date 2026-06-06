import html2canvas from "html2canvas";
import { Capacitor } from "@capacitor/core";

/**
 * Captures a DOM element as a PNG and opens the native share sheet
 * (Instagram, WhatsApp, …) with the image attached.
 *
 * - In the Capacitor app: writes the PNG to the cache and shares the file
 *   via @capacitor/share (native share sheet).
 * - In a normal browser: uses the Web Share API with the file when available,
 *   otherwise downloads the PNG.
 *
 * Elements marked with `data-html2canvas-ignore` are excluded from the capture.
 */
export async function shareElementAsImage(el, { fileName = "gridup.png", title = "GridUP", text = "" } = {}) {
  if (!el) return "no-element";

  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
    useCORS: true,
    logging: false,
  });

  // ── Native (Capacitor) ──
  if (Capacitor?.isNativePlatform?.()) {
    const base64 = canvas.toDataURL("image/png").split(",")[1];
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const path = `gridup-${Date.now()}.png`;
    await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    await Share.share({ title, text, files: [uri] });
    return "shared-native";
  }

  // ── Web ──
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png", 0.95));
  if (!blob) return "error";
  const file = new File([blob], fileName, { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return "shared-web";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
    }
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
