#!/usr/bin/env node
// Cửa gác: quét bản build web (dist/) tìm dấu vết bí mật của máy chủ trước khi đưa lên Vercel.
// Dùng: node scripts/check-bundle-secrets.mjs [--dir <thư mục>]   (mặc định: dist cạnh thư mục scripts)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Biến VITE_* được phép xuất hiện trong bản build (Vite nhúng thẳng vào mã chạy trên trình duyệt). Hiện chưa dùng biến nào.
export const ALLOWED_VITE_VARS = [];

const SERVER_SECRET_NAMES = ['JWT_ACCESS_SECRET', 'DATABASE_URL', 'DIRECT_URL'];
const FORBIDDEN_STRINGS = [...SERVER_SECRET_NAMES, 'postgresql://', 'postgres://'];
// Giá trị ngắn quá thì dễ trùng ngẫu nhiên, không dò.
const MIN_VALUE_LENGTH = 8;

function parseArgs(argv) {
  const i = argv.indexOf('--dir');
  const here = dirname(fileURLToPath(import.meta.url));
  return { dir: resolve(i >= 0 && argv[i + 1] ? argv[i + 1] : join(here, '..', 'dist')) };
}

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listFiles(p));
    else if (st.isFile()) out.push(p);
  }
  return out;
}

// Giá trị thật của các biến nhạy cảm đang có trong môi trường build: lộ giá trị còn nguy hiểm hơn lộ tên.
function sensitiveValues(env) {
  const out = [];
  for (const [name, value] of Object.entries(env)) {
    if (!value || value.length < MIN_VALUE_LENGTH) continue;
    const isServerSecret = SERVER_SECRET_NAMES.includes(name);
    const isUnlistedVite = name.startsWith('VITE_') && !ALLOWED_VITE_VARS.includes(name);
    if (isServerSecret || isUnlistedVite) out.push({ name, value });
  }
  return out;
}

export function scanContent(content, env = process.env) {
  const found = [];
  for (const s of FORBIDDEN_STRINGS) {
    if (content.includes(s)) found.push(`chứa "${s}"`);
  }
  const vite = new Set(content.match(/\bVITE_[A-Z0-9_]+/g) ?? []);
  for (const name of vite) {
    if (!ALLOWED_VITE_VARS.includes(name)) found.push(`chứa biến ${name} (không có trong danh sách cho phép)`);
  }
  for (const { name, value } of sensitiveValues(env)) {
    // Không in giá trị ra log — chỉ in tên biến.
    if (content.includes(value)) found.push(`chứa GIÁ TRỊ của biến ${name}`);
  }
  return found;
}

function main() {
  const { dir } = parseArgs(process.argv.slice(2));
  let files;
  try {
    files = listFiles(dir);
  } catch {
    console.error(`Cửa gác bí mật: không đọc được thư mục ${dir} — chạy vite build trước.`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.error(`Cửa gác bí mật: thư mục ${dir} rỗng — không có gì để quét, coi là không đạt.`);
    process.exit(1);
  }
  let violations = 0;
  for (const f of files) {
    const reasons = scanContent(readFileSync(f).toString('utf8'));
    for (const r of reasons) {
      violations += 1;
      console.error(`VI PHẠM ${relative(process.cwd(), f)}: ${r}`);
    }
  }
  const summary = `Cửa gác bí mật: ${violations} vi phạm / ${files.length} tệp`;
  if (violations > 0) {
    console.error(summary);
    process.exit(1);
  }
  console.log(summary);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
