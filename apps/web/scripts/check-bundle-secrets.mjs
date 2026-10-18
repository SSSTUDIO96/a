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
//      Dò cả trên bản đã nối chuỗi ("postgres"+"ql://…" → "postgresql://…", `AIza${'…'}`) để chuỗi cắt đôi không lọt,
//      và trên chuỗi giải ra từ cách giấu phổ biến: ["AIza","…"].join(""), atob("…"), Buffer.from("…","base64"),
//      String.fromCharCode(65,73,…), chuỗi mã hoá URL ("postgresql%3A%2F%2F…").
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
  // Supabase dạng mới: sb_secret_ là khoá toàn quyền (sb_publishable_ là khoá công khai, được phép).
  { kind: 'khoá bí mật Supabase (sb_secret_…)', re: /\bsb_secret_[A-Za-z0-9_-]{20,}/g },
  // Mapbox: sk. là thẻ bí mật (pk. là thẻ công khai cho trình duyệt, được phép).
  { kind: 'thẻ bí mật Mapbox (sk.eyJ…)', re: /\bsk\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { kind: 'SID tài khoản Twilio (AC…)', re: /\bAC[0-9a-f]{32}\b/g },
  { kind: 'SID khoá API Twilio (SK…)', re: /\bSK[0-9a-f]{32}\b/g },
  // Thẻ xác thực Twilio chỉ là 32 chữ số hex — dễ trùng mã băm, nên chỉ bắt khi được gán cho tên kiểu token/secret.
  {
    kind: 'thẻ xác thực Twilio (token 32 hex)',
    re: /\b(?:auth_?token|token|api_?secret|secret)["']?\s*[:=]\s*["'`][0-9a-f]{32}["'`]/gi,
  },
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
// `AIza${'…'}` (chuỗi hằng chèn vào chuỗi mẫu) → `AIza…`.
export function joinConcatenatedStrings(content) {
  return content.replace(/(["'`])\s*\+\s*\1/g, '').replace(/\$\{\s*(["'])((?:(?!\1)[^\\\n`])*)\1\s*\}/g, '$2');
}

const STR = String.raw`(["'\x60])((?:(?!\1)[^\\\n])*)\1`;
const STRING_LITERAL = new RegExp(STR, 'g');
// ["a","b",…].join("") hoặc .join('') — mảng toàn chuỗi hằng ghép lại không có dấu nối.
const ARRAY_JOIN = /\[\s*((?:(["'`])(?:(?!\2)[^\\\n])*\2\s*,\s*)*(["'`])(?:(?!\3)[^\\\n])*\3)\s*,?\s*\]\s*\.join\(\s*(["'`])\4\s*\)/g;
const ATOB = /\batob\(\s*(["'`])([A-Za-z0-9+/_-]{8,}={0,2})\1\s*\)/g;
const BUFFER_BASE64 = /\bBuffer\.from\(\s*(["'`])([A-Za-z0-9+/_-]{8,}={0,2})\1\s*,\s*(["'`])base64(?:url)?\3\s*\)/g;
const FROM_CHAR_CODE = /\bString\.fromCharCode\(\s*((?:(?:0x[0-9a-fA-F]{1,6}|\d{1,7})\s*,\s*){3,}(?:0x[0-9a-fA-F]{1,6}|\d{1,7}))\s*\)/g;
const URL_ENCODED = /(?:%[0-9A-Fa-f]{2}|[A-Za-z0-9._~+-])*%3A%2F%2F(?:%[0-9A-Fa-f]{2}|[A-Za-z0-9._~+-])*/gi;

// latin1: giữ nguyên từng byte, chuỗi ASCII giấu trong dữ liệu nhị phân vẫn dò được.
function decodeBase64(b64) {
  return Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1');
}

/**
 * Chuỗi giải ra từ các cách giấu thường gặp — không thể dò bằng hình dạng trên mã gốc.
 * Trả [{ via, text }]; text được bọc nháy để các mẫu có \b vẫn khớp ở hai đầu.
 */
export function revealHiddenStrings(content) {
  const out = [];
  const push = (via, text) => {
    if (text) out.push({ via, text: `"${text}"` });
  };
  for (const m of content.matchAll(ARRAY_JOIN)) {
    push('mảng .join("")', [...m[1].matchAll(STRING_LITERAL)].map((x) => x[2]).join(''));
  }
  for (const m of content.matchAll(ATOB)) push('atob', decodeBase64(m[2]));
  for (const m of content.matchAll(BUFFER_BASE64)) push('Buffer.from base64', decodeBase64(m[2]));
  for (const m of content.matchAll(FROM_CHAR_CODE)) {
    const codes = m[1].split(',').map((x) => Number(x.trim()));
    if (codes.every((c) => Number.isInteger(c) && c >= 0 && c <= 0x10ffff)) push('String.fromCharCode', String.fromCodePoint(...codes));
  }
  for (const m of content.matchAll(URL_ENCODED)) {
    try {
      push('mã hoá URL', decodeURIComponent(m[0]));
    } catch {
      // %xx hỏng: không giải được thì thôi.
    }
  }
  return out;
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

// Liệt kê tệp thường. Mục không xem được (liên kết hỏng, không có quyền) hoặc không phải tệp thường (FIFO, socket…)
// vào `unreadable` kèm lý do — không quét được thì không cho qua, và phải nói tên.
function listFiles(dir, out = { files: [], unreadable: [] }) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch (err) {
      out.unreadable.push({ path: p, reason: err instanceof Error ? err.message : String(err) });
      continue;
    }
    if (st.isDirectory()) listFiles(p, out);
    else if (st.isFile()) out.files.push(p);
    else out.unreadable.push({ path: p, reason: 'không phải tệp thường' });
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
  // Chuỗi giải ra từ join/atob/fromCharCode/mã hoá URL: báo kèm "(giải từ …)".
  const layers = [...texts.map((text) => ({ via: null, text })), ...revealHiddenStrings(joined)];
  const suffix = (via) => (via ? ` (giải từ ${via})` : '');

  for (const s of FORBIDDEN_STRINGS) {
    const hit = layers.find((l) => l.text.includes(s));
    if (hit) found.push(`chứa "${s}"${suffix(hit.via)}`);
  }

  const names = new Set(content.match(/\bVITE_[A-Z0-9_]+/g) ?? []);
  for (const name of names) {
    if (!ALLOWED_VITE_VARS.includes(name)) found.push(`chứa biến ${name} (không có trong danh sách cho phép)`);
  }
  for (const name of new Set(content.match(SENSITIVE_NAME_IN_CODE) ?? [])) {
    if (!SERVER_SECRET_NAMES.includes(name)) found.push(`chứa tên biến bí mật ${name}`);
  }

  const seen = new Set();
  for (const { via, text } of layers) {
    for (const shape of SECRET_SHAPES) {
      for (const m of text.matchAll(shape.re)) {
        // Cùng một bí mật thấy ở cả bản gốc và bản đã nối chuỗi → chỉ tính một lần.
        if ([...seen].some((s) => s.includes(m[0]) || m[0].includes(s))) continue;
        seen.add(m[0]);
        const kind = shape.describe ? shape.describe(m[0]) : shape.kind;
        found.push(`chứa ${kind}${suffix(via)}: ${mask(m[0])}`);
      }
    }
  }

  for (const { name, value } of sensitiveValues(env)) {
    // Không in giá trị ra log — chỉ in tên biến.
    const hit = layers.find((l) => l.text.includes(value));
    if (hit) found.push(`chứa GIÁ TRỊ của biến ${name}${suffix(hit.via)}`);
  }
  return found;
}

/**
 * Quét cả thư mục build. Trả { code, lines }: code 1 khi có vi phạm, có tệp không đọc được, thư mục rỗng hoặc không có.
 * `readFile` thay được trong bài thử (giả lập tệp không đọc được khi chạy bằng root).
 */
export function checkBundleDir(dir, env, { readFile = readFileSync } = {}) {
  const lines = [];
  let listed;
  try {
    listed = listFiles(dir);
  } catch {
    return { code: 1, lines: [`Cửa gác bí mật: không đọc được thư mục ${dir} — chạy vite build trước.`] };
  }
  const total = listed.files.length + listed.unreadable.length;
  if (total === 0) {
    return { code: 1, lines: [`Cửa gác bí mật: thư mục ${dir} rỗng — không có gì để quét, coi là không đạt.`] };
  }
  const unreadable = [...listed.unreadable];
  let scanned = 0;
  let violations = 0;
  let dirtyFiles = 0;
  for (const f of listed.files) {
    let content;
    try {
      // latin1 giữ nguyên từng byte: tệp nhị phân (phông, ảnh) vẫn dò được chuỗi ASCII giấu bên trong.
      const buf = readFile(f);
      content = buf.toString('utf8');
      if (content.includes('\ufffd')) content = buf.toString('latin1');
    } catch (err) {
      unreadable.push({ path: f, reason: err instanceof Error ? err.message : String(err) });
      continue;
    }
    scanned += 1;
    const reasons = scanContent(content, env);
    if (reasons.length > 0) dirtyFiles += 1;
    for (const r of reasons) {
      violations += 1;
      lines.push(`VI PHẠM ${relative(process.cwd(), f)}: ${r}`);
    }
  }
  for (const u of unreadable) lines.push(`KHÔNG ĐỌC ĐƯỢC ${relative(process.cwd(), u.path)}: ${u.reason}`);
  const summary = `Cửa gác bí mật: đã quét ${scanned}/${total} tệp · ${violations} vi phạm · ${dirtyFiles}/${total} tệp dính`;
  lines.push(unreadable.length > 0 ? `${summary} · ${unreadable.length} tệp không đọc được` : summary);
  return { code: violations > 0 || unreadable.length > 0 || scanned < total ? 1 : 0, lines };
}

function main() {
  const { dir, envDir } = parseArgs(process.argv.slice(2));
  const env = { ...readEnvFiles(envDir, process.env.MODE ?? 'production'), ...process.env };
  const { code, lines } = checkBundleDir(dir, env);
  for (const line of lines) (code === 0 ? console.log : console.error)(line);
  process.exit(code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
