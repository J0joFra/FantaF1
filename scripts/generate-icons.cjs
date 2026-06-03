/**
 * Generates the PWA / TWA launcher icons for GridUp with zero dependencies
 * (hand-rolled PNG encoder). Output: public/icons/*.png
 *
 * Run: node scripts/generate-icons.cjs
 *
 * Design: brand-red rounded panel with a 3×3 "grid" cut-out (GridUp motif),
 * supersampled 3× for smooth edges. Maskable variants add safe-zone padding.
 */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ── PNG encoder ──────────────────────────────────────────────────────────────
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ── Icon renderer ────────────────────────────────────────────────────────────
function render(size, inset) {
  const SS = 3; // supersample factor
  const S = size * SS;
  const a = inset * S;
  const b = S - inset * S;
  const ps = b - a; // panel side
  const rad = ps * 0.22; // corner radius
  const t = ps * 0.06; // gridline thickness
  const f1 = a + ps / 3;
  const f2 = a + (2 * ps) / 3;

  function sample(x, y) {
    // vertical brand-red gradient #E8002D -> #B80024
    const ty = y / S;
    const r = Math.round(0xe8 + (0xb8 - 0xe8) * ty);
    const g = 0x00;
    const bl = Math.round(0x2d + (0x24 - 0x2d) * ty);
    if (x >= a && x <= b && y >= a && y <= b) {
      // rounded-corner mask
      const cx = x < a + rad ? a + rad : x > b - rad ? b - rad : x;
      const cy = y < a + rad ? a + rad : y > b - rad ? b - rad : y;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rad * rad) {
        const onGrid =
          Math.abs(x - f1) < t / 2 ||
          Math.abs(x - f2) < t / 2 ||
          Math.abs(y - f1) < t / 2 ||
          Math.abs(y - f2) < t / 2;
        return onGrid ? [r, g, bl] : [255, 255, 255];
      }
    }
    return [r, g, bl];
  }

  const buf = Buffer.alloc(size * size * 4);
  const n = SS * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let R = 0, G = 0, B = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = sample(x * SS + sx, y * SS + sy);
          R += c[0]; G += c[1]; B += c[2];
        }
      const i = (y * size + x) * 4;
      buf[i] = Math.round(R / n);
      buf[i + 1] = Math.round(G / n);
      buf[i + 2] = Math.round(B / n);
      buf[i + 3] = 255;
    }
  }
  return encodePng(size, size, buf);
}

// ── Emit files ───────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
const files = [
  ["icon-192.png", 192, 0.16],
  ["icon-512.png", 512, 0.16],
  ["icon-maskable-192.png", 192, 0.26],
  ["icon-maskable-512.png", 512, 0.26],
  ["apple-touch-icon.png", 180, 0.16],
];
for (const [name, size, inset] of files) {
  fs.writeFileSync(path.join(outDir, name), render(size, inset));
  console.log("wrote", "public/icons/" + name);
}
