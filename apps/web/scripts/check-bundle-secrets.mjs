#!/usr/bin/env node
// Cửa gác: quét bản build web (dist/) tìm bí mật trước khi đưa lên Vercel. Bắt dính thì exit 1.
// Dùng: node scripts/check-bundle-secrets.mjs [--dir <thư mục build>] [--env-dir <thư mục chứa .env*>]
//   mặc định: --dir = dist cạnh thư mục scripts; --env-dir = thư mục web (nơi vite.config đọc .env*).
//
// Dò theo BA lớp, vì môi trường build trên Vercel KHÔNG có bí mật của máy chủ (chúng nằm ở Railway),
// nên dò giá trị theo tên biến thôi là không đủ:
//   1. HÌNH DẠNG giá trị bí mật: tiền tố khoá thật phổ biến (Google AIza…, Stripe sk_live_/rk_live_/whsec_,
//      AWS AKIA…, GitHub ghp_…, Slack xox…, OpenAI/Anthropic sk-…), JWT (đặc biệt role service_role của
//      Supabase), địa chỉ có user:mật_khẩu@ (postgres, mysql, redis…), khối -----BEGIN … PRIVATE KEY-----.
//      Dò cả trên bản đã nối chuỗi ("postgres"+"ql://…" → "postgresql://…") để chuỗi cắt đôi không lọt.
//   2. GIÁ TRỊ của mọi biến môi trường lúc build có tên mang nghĩa bí mật (…SECRET, …API_KEY, …TOKEN,
//      …PASSWORD, DATABASE_URL…), lấy từ process.env và các tệp .env* cạnh vite.config (Vite đọc các tệp này).
//   3. TÊN biến: tên biến máy chủ, tên biến mang nghĩa bí mật, biến VITE_* ngoài danh sách cho phép.
// Không bao giờ in giá trị bí mật ra log: chỉ in loại, 4 ký tự đầu và độ dài.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Biến VITE_* được phép xuất hiện trong bản build (Vite nhúng thẳng vào mã chạy trên trình duyệt). Hiện chưa dùng biến nào.
export const ALLOWED_VITE_VARS = [];

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '..');

const SERVER_SECRET_NAMES = ['JWT_ACCESS_SECRET', 'DATABASE_URL', 'DIRECT_URL'];
const FORBIDDEN_STRINGS = [...SERVER_SECRET_NAMES, 'postgresql://', 'postgres://'];
// Giá trị ngắn quá thì dễ trùng ngẫu nhiên, không dò.
const MIN_VALUE_LENGTH = 8;

// Tên biến môi trường mang nghĩa bí mật: giá trị của chúng không được nằm trong bản build.
const SENSITIVE_ENV_NAME =
  /(SECRET|PASSWORD|PASSWD|PASSPHRASE|PRIVATE|TOKEN|API_?KEY|ACCESS_?KEY|SERVICE_?ROLE|CREDENTIAL|SIGNING|_DSN$|DATABASE_URL|DIRECT_URL|CONNECTION_STRING|_KEY$)/i;

// Tên biến bí mật xuất hiện như chữ trong mã (thường là dấu vết `process.env.X` / `define` sót lại).
const SENSITIVE_NAME_IN_CODE =
  /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:SECRET(?:_KEY)?|PASSWORD|PRIVATE_KEY|API_KEY|SERVICE_ROLE(?:_KEY)?|ACCESS_KEY(?:_ID)?|AUTH_TOKEN|HASH_SECRET)\b/g;

/** Hình dạng giá trị bí mật. `check` (tuỳ chọn) lọc thêm sau khi khớp. */
export const SECRET_SHAPES = [
  { kind: 'khoá Google API (AIza…)', re: /AIza[0-9A-Za-z_-]{30,}/g },
  { kind: 'khoá bí mật Stripe (sk_live_/sk_test_)', re: /\bsk_(?:live|test)_[0-9A-Za-z]{10,}/g },
  { kind: 'khoá hạn chế Stripe (rk_live_/rk_test_)', re: /\brk_(?:live|test)_[0-9A-Za-z]{10,}/g },
  { kind: 'bí mật webhook (whsec_)', re: /\bwhsec_[0-9A-Za-z]{20,}/g },
  { kind: 'khoá OpenAI/Anthropic (sk-…)', re: /\bsk-(?:proj-|ant-[a-z0-9]+-)?[A-Za-z0-9_-]{20,}/g },
  { kind: 'khoá AWS (AKIA/ASIA…)', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: 'thẻ GitHub (ghp_/gho_/ghs_…)', re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/g },
  { kind: 'thẻ Slack (xox…)', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { kind: 'bí mật OAuth Google (GOCSPX-)', re: /\bGOCSPX-[A-Za-z0-9_-]{20,}/g },
  { kind: 'khoá SendGrid (SG.…)', re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g },
  { kind: 'khoá riêng (-----BEGIN … PRIVATE KEY-----)', re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g },
  { kind: 'tệp khoá tài khoản dịch vụ Google', re: /"type"\s*:\s*"service_account"|"private_key_id"\s*:/g },
  {
    // user:mật_khẩu@ trong mọi địa chỉ (postgres, mysql, mongodb, redis, amqp…). Bắt cả đuôi "ql://u:p@" của chuỗi cắt đôi.
    kind: 'địa chỉ kèm mật khẩu (scheme://user:pass@)',
    re: /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s"'`/@:]+:[^\s"'`/@]+@/g,
  },
  {
    kind: 'JWT',
    re: /\beyJ[A-Za-z0-9_-]{6,}\.eyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]*/g,
    describe(match) {
      const payload = decodeJwtPart(match.split('.')[1] ?? '');
      return payload && /service_role/.test(payload) ? 'JWT role service_role (khoá toàn quyền Supabase)' : 'JWT';
    },
  },
];

function decodeJwtPart(part) {
  try {
    return Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return null;
  }
}

// "a"+"b", 'a' + 'b', `a`+`b` → "ab": chuỗi cắt đôi không qua mặt được phép dò hình dạng.
export function joinConcatenatedStrings(content) {
  return content.replace(/(["'`])\s*\+\s*\1/g, '');
}

function mask(value) {
  return `${value.slice(0, 4)}… (${value.length} ký tự)`;
}

function parseArgs(argv) {
  const arg = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return resolve(i >= 0 && argv[i + 1] ? argv[i + 1] : fallback);
  };
  return { dir: arg('--dir', join(WEB_ROOT, 'dist')), envDir: arg('--env-dir', WEB_ROOT) };
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

/** Đọc KEY=VALUE từ các tệp .env* mà Vite nạp (loadEnv): .env, .env.local, .env.[mode], .env.[mode].local. */
export function readEnvFiles(root = WEB_ROOT, mode = 'production') {
  const out = {};
  for (const name of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      out[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2');
    }
  }
  return out;
}

// Giá trị của các biến nhạy cảm đang có lúc build: lộ giá trị còn nguy hiểm hơn lộ tên.
function sensitiveValues(env) {
  const out = [];
  for (const [name, value] of Object.entries(env)) {
    if (!value || value.length < MIN_VALUE_LENGTH) continue;
    const isSensitive = SERVER_SECRET_NAMES.includes(name) || SENSITIVE_ENV_NAME.test(name);
    const isUnlistedVite = name.startsWith('VITE_') && !ALLOWED_VITE_VARS.includes(name);
    if (isSensitive || isUnlistedVite) out.push({ name, value });
  }
  return out;
}

/** Trả danh sách lý do vi phạm (rỗng = sạch). Không chứa giá trị bí mật. */
export function scanContent(content, env = process.env) {
  const found = [];
  const joined = joinConcatenatedStrings(content);
  // Bản đã nối chuỗi đứng trước: chuỗi cắt đôi được báo ở dạng đầy đủ ("postgresql://…" thay vì "ql://…").
  const texts = joined === content ? [content] : [joined, content];

  for (const s of FORBIDDEN_STRINGS) {
    if (texts.some((t) => t.includes(s))) found.push(`chứa "${s}"`);
  }

  const names = new Set(content.match(/\bVITE_[A-Z0-9_]+/g) ?? []);
  for (const name of names) {
    if (!ALLOWED_VITE_VARS.includes(name)) found.push(`chứa biến ${name} (không có trong danh sách cho phép)`);
  }
  for (const name of new Set(content.match(SENSITIVE_NAME_IN_CODE) ?? [])) {
    if (!SERVER_SECRET_NAMES.includes(name)) found.push(`chứa tên biến bí mật ${name}`);
  }

  const seen = new Set();
  for (const text of texts) {
    for (const shape of SECRET_SHAPES) {
      for (const m of text.matchAll(shape.re)) {
        // Cùng một bí mật thấy ở cả bản gốc và bản đã nối chuỗi → chỉ tính một lần.
        if ([...seen].some((s) => s.includes(m[0]) || m[0].includes(s))) continue;
        seen.add(m[0]);
        const kind = shape.describe ? shape.describe(m[0]) : shape.kind;
        found.push(`chứa ${kind}: ${mask(m[0])}`);
      }
    }
  }

  for (const { name, value } of sensitiveValues(env)) {
    // Không in giá trị ra log — chỉ in tên biến.
    if (texts.some((t) => t.includes(value))) found.push(`chứa GIÁ TRỊ của biến ${name}`);
  }
  return found;
}

function main() {
  const { dir, envDir } = parseArgs(process.argv.slice(2));
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
  const env = { ...readEnvFiles(envDir, process.env.MODE ?? 'production'), ...process.env };
  let scanned = 0;
  let violations = 0;
  let dirtyFiles = 0;
  for (const f of files) {
    let content;
    try {
      // latin1 giữ nguyên từng byte: tệp nhị phân (phông, ảnh) vẫn dò được chuỗi ASCII giấu bên trong.
      const buf = readFileSync(f);
      content = buf.toString('utf8');
      if (content.includes('�')) content = buf.toString('latin1');
    } catch {
      console.error(`KHÔNG ĐỌC ĐƯỢC ${relative(process.cwd(), f)}`);
      continue;
    }
    scanned += 1;
    const reasons = scanContent(content, env);
    if (reasons.length > 0) dirtyFiles += 1;
    for (const r of reasons) {
      violations += 1;
      console.error(`VI PHẠM ${relative(process.cwd(), f)}: ${r}`);
    }
  }
  const summary = `Cửa gác bí mật: đã quét ${scanned}/${files.length} tệp · ${violations} vi phạm · ${dirtyFiles}/${files.length} tệp dính`;
  if (violations > 0 || scanned < files.length) {
    console.error(summary);
    process.exit(1);
  }
  console.log(summary);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
