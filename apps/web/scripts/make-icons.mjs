#!/usr/bin/env node
// Dựng biểu tượng app (PWA) từ hình vẽ SVG bằng Chromium của @playwright/test (đã có sẵn, không thêm thư viện).
// Chạy tay khi đổi nhận diện, rồi nộp PNG + SVG vào kho:   node scripts/make-icons.mjs
//
// Nhận diện: nét vẽ biểu tượng "brand" (cây bút) của src/layout/navIcons.tsx, màu nhấn --accent #A63D62 (src/styles/tokens.css).
// Cổng học viên: cùng khuôn nhưng nền xanh --ok #2F7D72 và hình mũ cử nhân ("khoa-hoc" trong navIcons.tsx), để hai app phân biệt được trên màn hình chính.
//
// Ba kiểu ra:
//   icon-192/512     : "any", tràn nền, hình chiếm khoảng 60% khung.
//   icon-maskable-512: "maskable", hình gọn trong vòng an toàn 80% (Android cắt tròn/vuông bo đều được).
//   apple-touch-icon : 180x180, TRÀN nền, không bo góc, không trong suốt (iOS tự bo góc, ô trong suốt sẽ thành nền đen).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// Nét vẽ lưới 24x24, chép nguyên từ navIcons.tsx. center = tâm hình vẽ trong lưới.
const BRANDS = {
  '': {
    bg: '#A63D62',
    paths: ['M14 3l7 7-9 9H5v-7z', 'M11 6l7 7'],
    center: [13, 11],
    scale: { any: 19, maskable: 16 },
  },
  'hv-': {
    bg: '#2F7D72',
    paths: ['M2 9l10-5 10 5-10 5z', 'M6 11v5c2 2 10 2 12 0v-5M22 9v6'],
    center: [12, 11.5],
    scale: { any: 15, maskable: 12.5 },
  },
};

export function iconSvg(brand, kind) {
  const b = BRANDS[brand];
  const s = b.scale[kind];
  const [cx, cy] = b.center;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${b.bg}"/>
  <g transform="translate(256 256) scale(${s}) translate(${-cx} ${-cy})" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
${b.paths.map((d) => `    <path d="${d}"/>`).join('\n')}
  </g>
</svg>
`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const render = async (svg, size, file) => {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`<style>html,body{margin:0;padding:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
      await page.screenshot({ path: join(OUT, file), omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } });
      console.log('ghi', file, `${size}x${size}`);
    };
    for (const brand of Object.keys(BRANDS)) {
      const any = iconSvg(brand, 'any');
      writeFileSync(join(OUT, `${brand}icon.svg`), any);
      await render(any, 192, `${brand}icon-192.png`);
      await render(any, 512, `${brand}icon-512.png`);
      await render(any, 180, `${brand}apple-touch-icon.png`);
      await render(iconSvg(brand, 'maskable'), 512, `${brand}icon-maskable-512.png`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
