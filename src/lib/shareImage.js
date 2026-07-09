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

// ── Share/save a ready canvas via the native sheet or web download ──────────────
export async function shareCanvas(
  card,
  { fileName = "gridup.png", title = "GridUP", text = "" } = {}
) {
  if (!card) return "no-canvas";
  const tId = toast.loading("Preparo l'immagine…");
  try {
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

// ── Value formatting for share cards ────────────────────────────────────────────
function fmtVal(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
}

// Fit a name into maxW by shrinking the font a step at a time.
function fitFont(ctx, text, base, maxW, weight = 800) {
  let size = base;
  do {
    ctx.font = `${weight} ${size}px Arial, "Segoe UI", sans-serif`;
    if (ctx.measureText(text).width <= maxW || size <= 24) break;
    size -= 2;
  } while (size > 24);
  return size;
}

/**
 * Draws a fully custom, precise head-to-head card (no page screenshot).
 * data: { heading, mode, d1:{name,code,color}, d2:{name,code,color},
 *         rows:[{label,v1,v2,win}], score:{w1,w2}, winner }
 */
export function buildH2HCard({
  heading = "Testa a testa",
  mode = "",
  d1, d2, rows = [], score = { w1: 0, w2: 0 }, winner = "",
} = {}) {
  const W = 1080;
  const pad = 52;
  const headerH = 196;
  const namesH = 250;
  const scoreH = winner ? 190 : 150;
  const rowH = 70;
  const rowsTop = headerH + namesH + scoreH;
  const footerH = 92;
  const H = rowsTop + rows.length * rowH + 28 + footerH;

  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  // ground
  ctx.fillStyle = "#0e0e15";
  ctx.fillRect(0, 0, W, H);
  // subtle speed lines
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 2;
  for (let y = 40; y < H; y += 46) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // ── header ──
  const g = ctx.createLinearGradient(0, 0, W, headerH);
  g.addColorStop(0, "#E8002D");
  g.addColorStop(1, "#9e0020");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, headerH);
  const badgeS = 100;
  drawBadge(ctx, pad, (headerH - badgeS) / 2, badgeS);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.font = '800 54px Arial, "Segoe UI", sans-serif';
  ctx.fillText("GridUP", pad + badgeS + 24, headerH / 2 - 6);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = '700 28px Arial, "Segoe UI", sans-serif';
  const modeTxt = mode ? `${heading} · ${mode}` : heading;
  ctx.fillText(modeTxt, pad + badgeS + 26, headerH / 2 + 34);

  // ── drivers row ──
  const cy = headerH + 96;
  const xL = W * 0.28, xR = W * 0.72;
  const drawDriver = (x, d) => {
    // colored disc with code
    ctx.beginPath(); ctx.arc(x, cy, 62, 0, Math.PI * 2);
    ctx.fillStyle = d.color || "#888"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = '900 40px Arial, "Segoe UI", sans-serif';
    ctx.fillText((d.code || "").slice(0, 3), x, cy + 2);
    // name
    ctx.textBaseline = "alphabetic";
    const ns = fitFont(ctx, d.name || "", 36, W * 0.4, 800);
    ctx.font = `800 ${ns}px Arial, "Segoe UI", sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.fillText(d.name || "", x, cy + 118);
  };
  drawDriver(xL, d1);
  drawDriver(xR, d2);
  // VS
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = '900 40px Arial, "Segoe UI", sans-serif';
  ctx.fillText("VS", W / 2, cy);

  // ── score ──
  const sy = headerH + namesH + 70;
  ctx.textBaseline = "middle";
  const win1 = score.w1 > score.w2, win2 = score.w2 > score.w1;
  ctx.font = '900 96px Arial, "Segoe UI", sans-serif';
  ctx.textAlign = "right"; ctx.fillStyle = win1 ? (d1.color || "#E8002D") : "rgba(255,255,255,0.5)";
  ctx.fillText(String(score.w1), W / 2 - 44, sy);
  ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = '800 60px Arial, "Segoe UI", sans-serif';
  ctx.fillText("–", W / 2, sy);
  ctx.textAlign = "left"; ctx.fillStyle = win2 ? (d2.color || "#E8002D") : "rgba(255,255,255,0.5)";
  ctx.font = '900 96px Arial, "Segoe UI", sans-serif';
  ctx.fillText(String(score.w2), W / 2 + 44, sy);
  if (winner) {
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    ctx.font = '800 30px Arial, "Segoe UI", sans-serif';
    ctx.fillText(`🏆 ${winner}`, W / 2, sy + 78);
  }

  // ── stat rows ──
  let y = rowsTop;
  ctx.textBaseline = "middle";
  rows.forEach((r, i) => {
    const midY = y + rowH / 2;
    if (i % 2 === 0) { ctx.fillStyle = "rgba(255,255,255,0.03)"; ctx.fillRect(pad, y, W - pad * 2, rowH); }
    // label centered
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.textAlign = "center";
    ctx.font = '600 24px Arial, "Segoe UI", sans-serif';
    ctx.fillText(r.label, W / 2, midY);
    // v1 (left, right-aligned)
    ctx.textAlign = "right";
    ctx.font = '800 34px Arial, "Segoe UI", sans-serif';
    ctx.fillStyle = r.win === 1 ? (d1.color || "#fff") : "rgba(255,255,255,0.7)";
    ctx.fillText(fmtVal(r.v1), W / 2 - 200, midY);
    // v2 (right, left-aligned)
    ctx.textAlign = "left";
    ctx.fillStyle = r.win === 2 ? (d2.color || "#fff") : "rgba(255,255,255,0.7)";
    ctx.fillText(fmtVal(r.v2), W / 2 + 200, midY);
    y += rowH;
  });

  // ── footer ──
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.font = '700 24px Arial, "Segoe UI", sans-serif';
  ctx.fillText("www.formula-rossa.it", W / 2, H - 34);

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
  let card;
  try {
    const snap = await html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
      useCORS: true,
      logging: false,
    });
    card = buildBrandedCanvas(snap, { heading, sub });
  } catch (e) {
    toast.error("Condivisione non riuscita");
    console.error("[shareImage]", e);
    toast.dismiss(tId);
    return "error";
  }
  toast.dismiss(tId);
  return shareCanvas(card, { fileName, title, text });
}
