#!/usr/bin/env node
// vercel.json không đọc được biến môi trường, nên URL máy chủ Railway được ghi vào vercel.json bằng script này,
// và lúc build trên Vercel thì đối chiếu lại với biến API_ORIGIN — lệch là dừng build (không đưa bản trỏ sai lên).
//   node scripts/vercel-config.mjs --write   ghi vercel.json từ API_ORIGIN (vd https://<tên-dịch-vụ>.up.railway.app)
//   node scripts/vercel-config.mjs --check   chạy trong "build"; trên Vercel (VERCEL=1) bắt buộc khớp API_ORIGIN
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'vercel.json');
export const PLACEHOLDER_ORIGIN = 'https://API_ORIGIN-chua-dat.invalid';

export function buildConfig(origin) {
  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    buildCommand: 'pnpm build',
    outputDirectory: 'dist',
    rewrites: [
      // Cùng tên miền: trình duyệt gọi /api/... trên Vercel, Vercel chuyển sang máy chủ Railway. Cookie refresh nhờ vậy là cookie cùng trang.
      { source: '/api/(.*)', destination: `${origin}/api/$1` },
      // Cổng học viên: trang vào riêng hv.html (bản vẽ E mục 5.3). Phải đứng TRƯỚC "/(.*)". Tệp có thật (/hv/manifest.webmanifest) được Vercel phục vụ trước khi xét rewrite.
      { source: '/hv', destination: '/hv.html' },
      { source: '/hv/(.*)', destination: '/hv.html' },
      // SPA: mọi đường còn lại (không phải tệp tĩnh có thật) trả index.html để React Router xử lý.
      { source: '/(.*)', destination: '/index.html' },
    ],
    // PWA: trình duyệt phải luôn hỏi lại sw.js (không giữ bản cũ) và được phép dùng phạm vi "/"; manifest đúng kiểu nội dung.
    headers: [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      { source: '/(.*).webmanifest', headers: [{ key: 'Content-Type', value: 'application/manifest+json' }] },
    ],
  };
}

export function checkOrigin(raw) {
  if (!raw) return 'Thiếu biến môi trường API_ORIGIN (URL máy chủ API trên Railway, dạng https://ten-mien)';
  let u;
  try {
    u = new URL(raw);
  } catch {
    return `API_ORIGIN không phải URL hợp lệ: ${raw}`;
  }
  if (u.protocol !== 'https:') return 'API_ORIGIN phải dùng https://';
  if (u.pathname !== '/' || u.search || u.hash || raw.endsWith('/')) return 'API_ORIGIN chỉ gồm https://tên-miền, không có đường dẫn hay dấu / cuối';
  return null;
}

function apiDestination(config) {
  return config.rewrites?.find((r) => r.source === '/api/(.*)')?.destination;
}

function main() {
  const mode = process.argv[2];
  const origin = process.env.API_ORIGIN;
  if (mode === '--write') {
    const problem = checkOrigin(origin);
    if (problem) {
      console.error(problem);
      process.exit(1);
    }
    writeFileSync(FILE, `${JSON.stringify(buildConfig(origin), null, 2)}\n`);
    console.log(`Đã ghi vercel.json: /api/(.*) → ${origin}/api/$1`);
    return;
  }
  if (mode !== '--check') {
    console.error('Dùng: node scripts/vercel-config.mjs --write | --check');
    process.exit(2);
  }
  const config = JSON.parse(readFileSync(FILE, 'utf8'));
  const dest = apiDestination(config);
  if (!dest) {
    console.error('vercel.json thiếu luật chuyển /api/(.*)');
    process.exit(1);
  }
  if (process.env.VERCEL !== '1') {
    console.log(`vercel.json: /api/(.*) → ${dest} (chỉ đối chiếu API_ORIGIN khi build trên Vercel)`);
    return;
  }
  const problem = checkOrigin(origin);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  if (dest !== `${origin}/api/$1`) {
    console.error(`vercel.json trỏ tới ${dest} nhưng API_ORIGIN là ${origin}. Chạy: API_ORIGIN=${origin} node scripts/vercel-config.mjs --write rồi commit.`);
    process.exit(1);
  }
  console.log(`vercel.json khớp API_ORIGIN (${origin})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
