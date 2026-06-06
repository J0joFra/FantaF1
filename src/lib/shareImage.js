import html2canvas from "html2canvas";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

// ── rounded rect path ─────────────────────────────────────────────────────────
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── GridUp "grid + F1" badge ───────────────────────────────────────────────────
function drawBadge(ctx, x, y, s) {
  roundRectPath(ctx, x, y, s, s, s * 0.22);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.save();
  roundRectPath(ctx, x, y, s, s, s * 0.22);
  ctx.clip();
  ctx.strokeStyle = "#dcdee4";
  ctx.lineWidth = s * 0.05;
  [1 / 3, 2 / 3].forEach((f) => {
    ctx.beginPath(); ctx.moveTo(x + s * f, y); ctx.lineTo(x + s * f, y + s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + s * f); ctx.lineTo(x + s, y + s * f); ctx.stroke();
  });
  ctx.restore();
  ctx.fillStyle = "#E8002D";
  ctx.font = `800 ${Math.round(s * 0.4)}px Arial, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("F1", x + s / 2, y + s / 2 + s * 0.02);
}

// ── branded card: GridUp header + content snapshot + footer ─────────────────────
function buildBrandedCanvas(snap, { heading = "GridUP", sub = "" } = {}) {
  const W = 1080;
  const pad = 40;
  const headerH = 180;
  const footerH = 78;
  const badgeS = 108;
  const innerW = W - pad * 2;
  const scale = innerW / snap.width;
  const snapH = Math.round(snap.height * scale);
  const capH = sub ? 72 : 16;
  const contentTop = headerH + 20 + capH;
  const H = contentTop + snapH + 24 + footerH;

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");

  // background
  ctx.fillStyle = "#eceef1";
  ctx.fillRect(0, 0, W, H);

  // header (red gradient)
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "#E8002D");
  g.addColorStop(1, "#B80024");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, headerH);

  drawBadge(ctx, pad, (headerH - badgeS) / 2, badgeS);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = '800 56px Arial, "Segoe UI", sans-serif';
  ctx.fillText("GridUP", pad + badgeS + 26, headerH / 2 - 4);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = '600 26px Arial, "Segoe UI", sans-serif';
  ctx.fillText(heading, pad + badgeS + 28, headerH / 2 + 32);

  // caption (matchup / subtitle)
  if (sub) {
    ctx.fillStyle = "#111827";
    ctx.font = '800 34px Arial, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(sub, W / 2, headerH + 20 + 46, W - pad * 2);
  }

  // content snapshot
  ctx.drawImage(snap, pad, contentTop, innerW, snapH);

  // footer
  ctx.fillStyle = "#9ca3af";
  ctx.font = '600 24px Arial, "Segoe UI", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("gridup-f1.web.app", W / 2, H - 30);

  return c;
}

/**
 * Captures a DOM element, wraps it in a branded GridUp card, and opens the
 * native share sheet (Instagram, WhatsApp, …) with the image attached.
 * Elements marked `data-html2canvas-ignore` are excluded from the capture.
 */
export async function shareElementAsImage(
  el,
  { fileName = "gridup.png", title = "GridUP", text = "", heading = "GridUP", sub = "" } = {}
) {
  if (!el) return "no-element";

  const tId = toast.loading("Preparo l'immagine…");
  try {
    const snap = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
      useCORS: true,
      logging: false,
    });
    const card = buildBrandedCanvas(snap, { heading, sub });

    // ── Native (Capacitor) ──
    if (Capacitor?.isNativePlatform?.()) {
      const base64 = card.toDataURL("image/png").split(",")[1];
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
    const blob = await new Promise((res) => card.toBlob(res, "image/png", 0.95));
    if (!blob) throw new Error("toBlob failed");
    const file = new File([blob], fileName, { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title, text });
        return "shared-web";
      } catch (e) {
        if (e && e.name === "AbortError") return "cancelled";
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast.success("Immagine salvata");
    return "downloaded";
  } catch (e) {
    const msg = (e && (e.message || e.errorMessage)) || String(e);
    toast.error("Condivisione non riuscita: " + msg);
    console.error("[shareImage]", e);
    return "error";
  } finally {
    toast.dismiss(tId);
  }
}
