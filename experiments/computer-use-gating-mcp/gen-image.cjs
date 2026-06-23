// 生成 gating 测试用的固定 PNG —— 内含暗号,用来判定模型是否真"看到"了图。
// 用 spike 里已装的 sharp(SVG→PNG)。运行:
//   NODE_PATH=../local-computer-use-spike/node_modules node gen-image.cjs
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SECRET = 'CU-GATE-9F3K7';
const BG = '#0f9b8e'; // teal

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400">
  <rect width="640" height="400" fill="${BG}"/>
  <circle cx="540" cy="80" r="42" fill="#ffd23f"/>
  <text x="320" y="180" font-family="monospace" font-size="64" font-weight="bold"
        fill="#ffffff" text-anchor="middle">${SECRET}</text>
  <text x="320" y="250" font-family="sans-serif" font-size="28"
        fill="#e6fffb" text-anchor="middle">computer-use gating test</text>
  <text x="320" y="300" font-family="sans-serif" font-size="22"
        fill="#c9fff7" text-anchor="middle">background: teal · circle: yellow</text>
</svg>`;

const out = path.join(__dirname, 'test-image.png');
sharp(Buffer.from(svg))
  .png()
  .toFile(out)
  .then((info) => {
    console.log(`wrote ${out} (${info.width}x${info.height}, ${info.size} bytes)`);
    console.log(`SECRET = ${SECRET}  BG = teal  circle = yellow`);
  })
  .catch((e) => { console.error(e); process.exit(1); });
