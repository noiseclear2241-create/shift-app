// アプリのアイコン（PNG）を作るスクリプト。外部の部品を使わず、図形を1ピクセルずつ描いて保存する。
// 実行：node scripts/make-icons.mjs  → public/icons/ に出力
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BLUE = [29, 78, 216];
const LIGHT = [219, 228, 255];
const WHITE = [255, 255, 255];

const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

/** 座標（0〜1）ごとの色。青い背景に白いカレンダー。マスク可能アイコンのため絵柄は中央80%に収める */
function color(u, v) {
  // カレンダーを留めるリング
  for (const rx of [0.38, 0.62]) {
    if (inRoundRect(u, v, rx - 0.025, 0.24, rx + 0.025, 0.36, 0.02)) return WHITE;
  }
  if (inRoundRect(u, v, 0.24, 0.3, 0.76, 0.76, 0.05)) {
    if (v < 0.41) return WHITE;
    // 日付のマス（3列×2行）。1つだけ塗って「予定の日」に見せる
    const cols = [0.33, 0.5, 0.67];
    const rows = [0.52, 0.65];
    for (const [ri, ry] of rows.entries()) {
      for (const [ci, cx] of cols.entries()) {
        if (inRoundRect(u, v, cx - 0.05, ry - 0.045, cx + 0.05, ry + 0.045, 0.015)) {
          return ri === 0 && ci === 1 ? BLUE : LIGHT;
        }
      }
    }
    return WHITE;
  }
  return BLUE;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // フィルターなし
    for (let x = 0; x < size; x++) {
      const [r, g, b] = color((x + 0.5) / size, (y + 0.5) / size);
      raw.set([r, g, b], row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8bit
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(`public/icons/${name}`, png(size));
}
console.log('public/icons にアイコンを作成しました');
