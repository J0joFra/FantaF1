/**
 * Generates source assets for @capacitor/assets (icons + splash) with the
 * GridUp "grid + F1" brand mark. Zero dependencies (hand-rolled PNG encoder
 * with alpha). Output: assets/*.png
 *
 * Run: node scripts/generate-cap-assets.cjs
 * Then: npx capacitor-assets generate --android
 */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ── PNG encoder (RGBA) ───────────────────────────────────────────────────────
const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let tt = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  tt = Math.max(0, Math.min(1, tt));
  return Math.hypot(px - (x1 + tt * dx), py - (y1 + tt * dy));
}

// ── Renderer ─────────────────────────────────────────────────────────────────
// opts: { bg: 'red'|'transparent', badgeInset: number|null }
function render(size, opts) {
  const SS = 3;
  const S = size * SS;
  const hasBadge = opts.badgeInset != null;
  let a, b, ps, rad, t, f1, f2, H, st, wF, w1, gap, totalW, ty0, ty1, fx0, ox0, sx;
  if (hasBadge) {
    a = opts.badgeInset * S;
    b = S - opts.badgeInset * S;
    ps = b - a;
    rad = ps * 0.22;
    t = ps * 0.045;
    f1 = a + ps / 3;
    f2 = a + (2 * ps) / 3;
    H = ps * 0.46; st = H * 0.22; wF = H * 0.52; w1 = H * 0.42; gap = H * 0.16;
    totalW = wF + gap + w1;
    ty0 = a + (ps - H) / 2; ty1 = ty0 + H;
    fx0 = a + (ps - totalW) / 2; ox0 = fx0 + wF + gap; sx = ox0 + (w1 - st) * 0.6;
  }
  function inF(x, y) {
    if (x >= fx0 && x <= fx0 + st && y >= ty0 && y <= ty1) return true;
    if (y >= ty0 && y <= ty0 + st && x >= fx0 && x <= fx0 + wF) return true;
    const my0 = ty0 + (H - st) / 2 - H * 0.02;
    if (y >= my0 && y <= my0 + st && x >= fx0 && x <= fx0 + wF * 0.8) return true;
    return false;
  }
  function in1(x, y) {
    if (x >= sx && x <= sx + st && y >= ty0 && y <= ty1) return true;
    if (y >= ty1 - st && y <= ty1 && x >= ox0 && x <= ox0 + w1) return true;
    if (distSeg(x, y, ox0, ty0 + H * 0.24, sx + st * 0.5, ty0) <= st * 0.55) return true;
    return false;
  }
  function sample(x, y) {
    let bg;
    if (opts.bg === "transparent") bg = [0, 0, 0, 0];
    else {
      const ty = y / S;
      bg = [Math.round(0xe8 + (0xb8 - 0xe8) * ty), 0, Math.round(0x2d + (0x24 - 0x2d) * ty), 255];
    }
    if (hasBadge && x >= a && x <= b && y >= a && y <= b) {
      const cx = x < a + rad ? a + rad : x > b - rad ? b - rad : x;
      const cy = y < a + rad ? a + rad : y > b - rad ? b - rad : y;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= rad * rad) {
        if (inF(x, y) || in1(x, y)) return [0xe8, 0x00, 0x2d, 255];
        const onGrid =
          Math.abs(x - f1) < t / 2 || Math.abs(x - f2) < t / 2 ||
          Math.abs(y - f1) < t / 2 || Math.abs(y - f2) < t / 2;
        return onGrid ? [220, 222, 228, 255] : [255, 255, 255, 255];
      }
    }
    return bg;
  }
  const buf = Buffer.alloc(size * size * 4);
  const n = SS * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let R = 0, G = 0, B = 0, A = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx2 = 0; sx2 < SS; sx2++) {
          const c = sample(x * SS + sx2, y * SS + sy);
          R += c[0] * c[3]; G += c[1] * c[3]; B += c[2] * c[3]; A += c[3];
        }
      const i = (y * size + x) * 4;
      // premultiplied average -> straight alpha
      buf[i] = A ? Math.round(R / A) : 0;
      buf[i + 1] = A ? Math.round(G / A) : 0;
      buf[i + 2] = A ? Math.round(B / A) : 0;
      buf[i + 3] = Math.round(A / n);
    }
  }
  return encodePng(size, size, buf);
}

const outDir = path.join(__dirname, "..", "assets");
fs.mkdirSync(outDir, { recursive: true });
const w = (name, buf) => { fs.writeFileSync(path.join(outDir, name), buf); console.log("wrote assets/" + name); };

w("icon-only.png", render(1024, { bg: "red", badgeInset: 0.12 }));
w("icon-foreground.png", render(1024, { bg: "transparent", badgeInset: 0.2 }));
w("icon-background.png", render(1024, { bg: "red", badgeInset: null }));
w("splash.png", render(2732, { bg: "red", badgeInset: 0.36 }));
w("splash-dark.png", render(2732, { bg: "red", badgeInset: 0.36 }));
