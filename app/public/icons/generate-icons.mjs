// 程序化生成 SuperMark 全套图标（参考 iskill-pwa-guideline references/icons）
// 用法：NODE_PATH=/Users/lv/.workbuddy/binaries/node/workspace/node_modules node generate-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// ESM 不认 NODE_PATH：优先从 managed node workspace 绝对路径取 resvg
const RESVG = '/Users/lv/.workbuddy/binaries/node/workspace/node_modules/@resvg/resvg-js/index.js';
const { Resvg } = await import(RESVG).catch(() => import('@resvg/resvg-js'));

const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(here, 'icon.svg'), 'utf8');

const targets = [
  { file: 'icon-192.png', width: 192 },
  { file: 'icon-512.png', width: 512 },
  { file: 'icon-maskable-512.png', width: 512 }, // 图形主体占 62.5%，天然满足 maskable 80% 安全区
  { file: 'apple-touch-icon.png', width: 180 },  // iOS：直角全幅，系统自动裁圆角
];

for (const t of targets) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: t.width } }).render().asPng();
  writeFileSync(join(here, t.file), png);
  console.log('生成', t.file, png.length, 'bytes');
}
