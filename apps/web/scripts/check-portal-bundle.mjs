#!/usr/bin/env node
// Cửa gác riêng của cổng học viên (/hv): bản vẽ E mục 5.1 và 5.3. Chạy sau `vite build`, trong "build".
// Đọc dist/.vite/manifest.json, lấy MỌI tệp JS/CSS mà trang vào hv.html kéo theo (import tĩnh lẫn động) rồi báo ĐỎ khi:
//   1. tổng JS gzip > 90 KB (kể cả React); tổng CSS gzip > 15 KB;
//   2. có khối mã sinh từ src/api/client.ts, src/app/, src/layout/, src/features/ (cổng không được kéo mã app nhân viên);
//   3. mã chứa chuỗi cấm: BYPASS, SUPER_ADMIN, accessToken=, Authorization (cổng dùng cookie phiên riêng, không có thẻ Bearer).
//
// Dùng: node scripts/check-portal-bundle.mjs [--dir <thư mục build>]   (mặc định: dist cạnh thư mục scripts)
// Giới hạn đã biết: manifest chỉ ghi nguồn của khối có "mặt tiền" (trang vào, import động, khối dùng chung); mã gộp thẳng vào khối
// trang vào thì không lộ tên tệp nguồn. Ca đó được bắt bằng lớp 3 (client.ts luôn có "Authorization").
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const ENTRY = 'hv.html';
export const MAX_JS_GZIP = 90 * 1024;
export const MAX_CSS_GZIP = 15 * 1024;
export const FORBIDDEN_STRINGS = ['BYPASS', 'SUPER_ADMIN', 'accessToken=', 'Authorization'];
// Đường nguồn (tương đối so với gốc web) mà cổng không được kéo vào.
export const FORBIDDEN_SOURCES = /^src\/(?:api\/client\.tsx?$|app\/|layout\/|features\/)/;

const HERE = dirname(fileURLToPath(import.meta.url));

const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/** Mọi khối (chunk) mà trang vào kéo theo, theo khoá trong manifest. */
export function collectChunks(manifest, entryKey = ENTRY) {
  if (!manifest[entryKey]) return null;
  const seen = new Set();
  const walk = (key) => {
    if (seen.has(key) || !manifest[key]) return;
    seen.add(key);
    const c = manifest[key];
    for (const k of [...(c.imports ?? []), ...(c.dynamicImports ?? [])]) walk(k);
  };
  walk(entryKey);
  return [...seen].map((key) => ({ key, ...manifest[key] }));
}

/** Trả về { problems: string[], stats }. Không in, không thoát: để bài thử dùng được. */
export function checkPortalBundle(distDir) {
  const problems = [];
  const manifestPath = join(distDir, '.vite', 'manifest.json');
  if (!existsSync(manifestPath)) {
    return { problems: [`Thiếu ${manifestPath} (vite.config.ts phải đặt build.manifest = true)`], stats: null };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const chunks = collectChunks(manifest);
  if (!chunks) return { problems: [`Manifest không có trang vào ${ENTRY} (vite.config.ts: rollupOptions.input.hv)`], stats: null };

  const jsFiles = new Set();
  const cssFiles = new Set();
  for (const c of chunks) {
    if (c.file?.endsWith('.js')) jsFiles.add(c.file);
    for (const css of c.css ?? []) cssFiles.add(css);
    for (const src of [c.src, c.key, c.name].filter(Boolean)) {
      if (FORBIDDEN_SOURCES.test(src)) problems.push(`khối ${c.file ?? c.key} sinh từ ${src}: cổng không được kéo mã app nhân viên`);
    }
  }

  let jsGzip = 0;
  for (const file of jsFiles) {
    const p = join(distDir, file);
    if (!existsSync(p)) {
      problems.push(`manifest ghi ${file} nhưng tệp không có trong ${distDir}`);
      continue;
    }
    const buf = readFileSync(p);
    jsGzip += gz(buf);
    const text = buf.toString('utf8');
    for (const s of FORBIDDEN_STRINGS) {
      if (text.includes(s)) problems.push(`${file} chứa chuỗi cấm "${s}"`);
    }
  }
  let cssGzip = 0;
  for (const file of cssFiles) {
    const p = join(distDir, file);
    if (existsSync(p)) cssGzip += gz(readFileSync(p));
  }
  if (jsGzip > MAX_JS_GZIP) problems.push(`JS của trang vào ${ENTRY} nặng ${kb(jsGzip)} gzip, vượt ngân sách ${kb(MAX_JS_GZIP)}`);
  if (cssGzip > MAX_CSS_GZIP) problems.push(`CSS của trang vào ${ENTRY} nặng ${kb(cssGzip)} gzip, vượt ngân sách ${kb(MAX_CSS_GZIP)}`);

  return { problems, stats: { chunks: chunks.length, jsFiles: jsFiles.size, jsGzip, cssFiles: cssFiles.size, cssGzip } };
}

function main() {
  const i = process.argv.indexOf('--dir');
  const dist = i !== -1 && process.argv[i + 1] ? resolve(process.argv[i + 1]) : join(HERE, '..', 'dist');
  const { problems, stats } = checkPortalBundle(dist);
  if (stats) {
    console.log(
      `check-portal-bundle: ${ENTRY} kéo ${stats.jsFiles} tệp JS (${kb(stats.jsGzip)} gzip / ${kb(MAX_JS_GZIP)}) và ${stats.cssFiles} tệp CSS (${kb(stats.cssGzip)} gzip / ${kb(MAX_CSS_GZIP)}) · ${problems.length} vi phạm`,
    );
  }
  for (const p of problems) console.error(`  - ${p}`);
  if (problems.length) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
