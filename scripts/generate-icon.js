const fs = require('fs');
const zlib = require('zlib');

function drawPixels(size) {
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      let r = 0, g = 0, b = 0, a = 0;

      // Rounded rect background
      const margin = 0.06;
      const radius = 0.12;
      const inRect = nx >= margin && nx <= (1 - margin) && ny >= margin && ny <= (1 - margin);

      if (inRect) {
        const ix = nx - margin;
        const iy = ny - margin;
        const w = 1 - 2 * margin;
        const h = 1 - 2 * margin;
        let inRounded = true;

        const corners = [
          [radius, radius],
          [w - radius, radius],
          [radius, h - radius],
          [w - radius, h - radius]
        ];
        for (const [cx, cy] of corners) {
          const inCornerX = (ix < radius && cx === radius) || (ix > w - radius && cx === w - radius);
          const inCornerY = (iy < radius && cy === radius) || (iy > h - radius && cy === h - radius);
          if (inCornerX && inCornerY) {
            const dx = ix - cx;
            const dy = iy - cy;
            if (dx * dx + dy * dy > radius * radius) inRounded = false;
          }
        }

        if (inRounded) {
          // Gradient: top #0090FF -> bottom #0060CC
          const t = ny;
          r = Math.round(0x00 * (1 - t) + 0x00 * t);
          g = Math.round(0x90 * (1 - t) + 0x50 * t);
          b = Math.round(0xFF * (1 - t) + 0xCC * t);
          a = 255;

          // Subtle inner shadow at top
          if (ny < margin + 0.04) {
            const st = (ny - margin) / 0.04;
            r = Math.round(r * (0.7 + 0.3 * st));
            g = Math.round(g * (0.7 + 0.3 * st));
            b = Math.round(b * (0.85 + 0.15 * st));
          }

          // === Upload arrow (left) ===
          const ax1 = 0.28, aw = 0.07, aheadW = 0.15, aheadH = 0.14;
          const atop = 0.20, abot = 0.68;

          // Shaft
          if (Math.abs(nx - ax1) <= aw && ny >= atop + aheadH && ny <= abot) {
            r = 255; g = 255; b = 255; a = 240;
          }
          // Arrowhead (triangle pointing up)
          if (ny >= atop && ny < atop + aheadH) {
            const progress = (ny - atop) / aheadH;
            const halfW = aheadW * (0.1 + 0.9 * progress);
            if (Math.abs(nx - ax1) <= halfW) {
              r = 255; g = 255; b = 255; a = 240;
            }
          }
          // Flat bottom bar on shaft
          if (Math.abs(nx - ax1) <= aw * 1.6 && ny > abot - 0.02 && ny <= abot) {
            r = 255; g = 255; b = 255; a = 240;
          }

          // === Download arrow (right) ===
          const ax2 = 0.72;
          const dtop = 1 - abot, dbot = 1 - atop;
          const dheadTop = dbot - aheadH;

          // Shaft
          if (Math.abs(nx - ax2) <= aw && ny >= dtop && ny <= dheadTop) {
            r = 255; g = 255; b = 255; a = 240;
          }
          // Arrowhead (triangle pointing down)
          if (ny > dheadTop && ny <= dbot) {
            const progress = (dbot - ny) / aheadH;
            const halfW = aheadW * (0.1 + 0.9 * progress);
            if (Math.abs(nx - ax2) <= halfW) {
              r = 255; g = 255; b = 255; a = 240;
            }
          }
          // Flat top bar on shaft
          if (Math.abs(nx - ax2) <= aw * 1.6 && ny >= dtop && ny < dtop + 0.02) {
            r = 255; g = 255; b = 255; a = 240;
          }

          // === Horizontal line (separator) in middle ===
          if (ny >= 0.48 && ny <= 0.52 && nx >= 0.18 && nx <= 0.82) {
            // Dashed line
            const seg = Math.floor((nx - 0.18) / 0.06);
            if (seg % 2 === 0) {
              r = 255; g = 255; b = 255; a = 120;
            }
          }
        }
      }

      const pos = (y * size + x) * 4;
      pixels[pos] = r;
      pixels[pos + 1] = g;
      pixels[pos + 2] = b;
      pixels[pos + 3] = a;
    }
  }
  return pixels;
}

function createBMP(size) {
  const pixels = drawPixels(size);
  const pixelDataSize = size * size * 4;
  const maskRowBytes = Math.ceil(size / 32) * 4;
  const maskSize = maskRowBytes * size;
  const headerSize = 40;

  const buf = Buffer.alloc(headerSize + pixelDataSize + maskSize);
  buf.writeUInt32LE(40, 0);
  buf.writeInt32LE(size, 4);
  buf.writeInt32LE(size * 2, 8);
  buf.writeUInt16LE(1, 12);
  buf.writeUInt16LE(32, 14);
  buf.writeUInt32LE(0, 16);
  buf.writeUInt32LE(pixelDataSize + maskSize, 20);

  for (let y = 0; y < size; y++) {
    const srcY = size - 1 - y;
    for (let x = 0; x < size; x++) {
      const srcPos = (srcY * size + x) * 4;
      const dstPos = headerSize + (y * size + x) * 4;
      buf[dstPos] = pixels[srcPos + 2];
      buf[dstPos + 1] = pixels[srcPos + 1];
      buf[dstPos + 2] = pixels[srcPos];
      buf[dstPos + 3] = pixels[srcPos + 3];
    }
  }
  return buf;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let cc = n;
    for (let k = 0; k < 8; k++) {
      if (cc & 1) cc = 0xEDB88320 ^ (cc >>> 1);
      else cc = cc >>> 1;
    }
    table[n] = cc;
  }
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeB = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcData = Buffer.concat([typeB, data]);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, typeB, data, crcB]);
}

function createPNG(size) {
  const pixels = drawPixels(size);
  const rawData = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rawData[y * (size * 4 + 1)] = 0;
    pixels.copy(rawData, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createICO() {
  const sizes = [16, 32, 48, 256];
  const images = sizes.map(s => s === 256 ? createPNG(s) : createBMP(s));

  const headerSize = 6 + sizes.length * 16;
  let totalSize = headerSize;
  images.forEach(img => totalSize += img.length);

  const buf = Buffer.alloc(totalSize);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(sizes.length, 4);

  let dataOffset = headerSize;
  for (let i = 0; i < sizes.length; i++) {
    const off = 6 + i * 16;
    buf.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], off);
    buf.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], off + 1);
    buf.writeUInt8(0, off + 2);
    buf.writeUInt8(0, off + 3);
    buf.writeUInt16LE(1, off + 4);
    buf.writeUInt16LE(32, off + 6);
    buf.writeUInt32LE(images[i].length, off + 8);
    buf.writeUInt32LE(dataOffset, off + 12);
    dataOffset += images[i].length;
  }

  let pos = headerSize;
  for (const img of images) {
    img.copy(buf, pos);
    pos += img.length;
  }
  return buf;
}

// Ensure directories exist
if (!fs.existsSync('public')) fs.mkdirSync('public');
if (!fs.existsSync('build')) fs.mkdirSync('build');

const ico = createICO();
fs.writeFileSync('public/icon.ico', ico);
console.log('Created: public/icon.ico (' + ico.length + ' bytes)');

const png = createPNG(256);
fs.writeFileSync('public/icon.png', png);
console.log('Created: public/icon.png (' + png.length + ' bytes)');

fs.copyFileSync('public/icon.ico', 'build/icon.ico');
console.log('Copied to: build/icon.ico');
