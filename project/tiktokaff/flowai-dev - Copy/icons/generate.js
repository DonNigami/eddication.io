const fs = require('fs');
const zlib = require('zlib');

function createPNG(size) {
  const radius = Math.floor(size * 0.1875);

  const pixels = [];
  const padding = Math.floor(size * 0.25);
  const strokeWidth = Math.max(2, Math.floor(size * 0.08));

  for (let y = 0; y < size; y++) {
    pixels.push(0);
    for (let x = 0; x < size; x++) {
      const inRect = isInsideRoundedRect(x, y, size, size, radius);

      if (!inRect) {
        pixels.push(0, 0, 0, 0);
        continue;
      }

      const lineY1 = Math.floor(size * 0.3125);
      const lineY2 = Math.floor(size * 0.5);
      const lineY3 = Math.floor(size * 0.6875);

      const halfStroke = strokeWidth / 2;
      const onLine1 = Math.abs(y - lineY1) < halfStroke && x >= padding && x <= size - padding;
      const onLine2 = Math.abs(y - lineY2) < halfStroke && x >= padding && x <= size - padding * 1.5;
      const onLine3 = Math.abs(y - lineY3) < halfStroke && x >= padding && x <= size * 0.5;

      if (onLine1 || onLine2 || onLine3) {
        // White text on lines
        pixels.push(255, 255, 255, 255);
      } else {
        // Red background: #EF4444
        pixels.push(239, 68, 68, 255);
      }
    }
  }

  return createPNGBuffer(size, size, Buffer.from(pixels));
}

function isInsideRoundedRect(x, y, w, h, r) {
  if (x < r && y < r) {
    return (x - r) * (x - r) + (y - r) * (y - r) <= r * r;
  }
  if (x >= w - r && y < r) {
    return (x - (w - r)) * (x - (w - r)) + (y - r) * (y - r) <= r * r;
  }
  if (x < r && y >= h - r) {
    return (x - r) * (x - r) + (y - (h - r)) * (y - (h - r)) <= r * r;
  }
  if (x >= w - r && y >= h - r) {
    return (x - (w - r)) * (x - (w - r)) + (y - (h - r)) * (y - (h - r)) <= r * r;
  }
  return true;
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createPNGBuffer(width, height, rawData) {
  const compressed = zlib.deflateSync(rawData, { level: 9 });

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = createChunk('IDAT', compressed);
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    idat,
    iend
  ]);
}

[16, 32, 48, 128].forEach(size => {
  const png = createPNG(size);
  fs.writeFileSync(__dirname + '/icon' + size + '.png', png);
  console.log('Created icon' + size + '.png');
});
