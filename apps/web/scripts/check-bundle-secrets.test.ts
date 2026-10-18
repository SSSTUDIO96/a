import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
// @ts-expect-error — tệp .mjs không có khai báo kiểu; chỉ dùng hàm thuần.
import { checkBundleDir, readEnvFiles } from './check-bundle-secrets.mjs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(WEB, 'scripts', 'check-bundle-secrets.mjs');
const temps: string[] = [];

function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'cua-gac-'));
  temps.push(d);
  return d;
}

// Môi trường sạch: chỉ PATH, để bài thử không phụ thuộc biến đang có trên máy.
function runGate(dir: string, env: Record<string, string> = {}, extraArgs: string[] = []) {
  const r = spawnSync(process.execPath, [SCRIPT, '--dir', dir, ...extraArgs], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', ...env } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

function writeBundle(files: Record<string, string>): string {
  const dir = tempDir();
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

// Khoá giả ghép lúc chạy (không để nguyên khối trong mã nguồn, khỏi bị máy quét bí mật của kho mã báo nhầm).
const j = (...parts: string[]) => parts.join('');
const GOOGLE = j('AIza', 'SyD-thuChamGiaKhoaGoogle0123456789ab');
const STRIPE = j('sk_', 'live_', 'thuChamGiaThanhToan0123456789');
const SUPABASE_SERVICE_ROLE = j('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', '.', 'eyJyb2xlIjoic2VydmljZV9yb2xlIn0', '.thu-cham');
const GEMINI_VALUE = 'gm-bi-mat-gemini-0123456789-abcdef';
const JWT_VALUE = 'tho-cham-jwt-bi-mat-0123456789-abcdefgh';

// Đúng 6 tệp trong bộ "dist-gia" của thợ chấm (biên bản nghiệm thu web 1, mục T2).
const DIST_GIA: Record<string, string> = {
  'assets/a-khoa-google.js': `const maps="${GOOGLE}";console.log(maps);`,
  'assets/b-gemini-tu-define.js': `const g="${GEMINI_VALUE}";fetch("https://x/?k="+g);`,
  'assets/c-supabase-service-role.js': `const s="${SUPABASE_SERVICE_ROLE}";`,
  'assets/d-the-thanh-toan.js': `const p="${STRIPE}";`,
  'assets/e-chuoi-ket-noi-cat-doi.js': `const db="postgres"+"ql://makeup:makeup_local@db.internal:5432/x";`,
  'assets/f-jwt-that.js': `const j="${JWT_VALUE}";`,
};

// Bộ "dist-la" của thợ chấm đợt sửa 1 (biên bản N-J2): 10 dạng khoá lọt khi môi trường build KHÔNG có biến bí mật.
// Khoá giả ghép lúc chạy như trên. b64/charCodes dựng từ chính khoá Google giả.
const GOOGLE_2 = j('AIza', 'SyD4kq9Zx8Wm2Lp0Qr7Tu5Vb3Nc1Ej6Hg0Fs');
const SB_SECRET = j('sb_', 'secret_', 'N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz');
const MAPBOX_SECRET = j('sk', '.eyJ1IjoibWFrZXVwIiwiYSI6ImNsdGVzdDAwMDAwMDAwMDAwMDAwMDAwIn0', '.abcdefghijklmnopqrstuv');
const TWILIO_SID = j('AC', '0123456789abcdef0123456789abcdef');
const TWILIO_API_KEY = j('SK', 'fedcba9876543210fedcba9876543210');
const TWILIO_TOKEN = j('0123456789abcdef', '0123456789abcdef');
const DIST_LA: Record<string, [string, RegExp]> = {
  'assets/a-mang-join.js': [`const k=["AIza","${GOOGLE_2.slice(4)}"].join('');fetch('https://gen.googleapis.com?key='+k)`, /khoá Google API/],
  'assets/b-base64.js': [`const k=atob('${Buffer.from(GOOGLE_2).toString('base64')}');`, /khoá Google API .*giải từ atob/],
  'assets/c-supabase-moi.js': [`const s='${SB_SECRET}';createClient(u,s)`, /khoá bí mật Supabase \(sb_secret_/],
  'assets/d-mapbox-secret.js': [`mapboxgl.accessToken='${MAPBOX_SECRET}';`, /thẻ bí mật Mapbox/],
  'assets/e-twilio.js': [`const twilio={sid:'${TWILIO_SID}',token:'${TWILIO_TOKEN}'};`, /SID tài khoản Twilio[\s\S]*thẻ xác thực Twilio/],
  'assets/f-fromcharcode.js': [`const k=String.fromCharCode(${[...GOOGLE_2].map((c) => c.charCodeAt(0)).join(',')});`, /khoá Google API .*giải từ String\.fromCharCode/],
  'assets/g-template.js': ["const k=`AIza${'" + GOOGLE_2.slice(4) + "'}`;", /khoá Google API/],
  'assets/h-cong-chuoi.js': [`const k='AIza'+'${GOOGLE_2.slice(4)}';`, /khoá Google API/],
  'assets/i-url-ma-hoa.js': ["const c='postgresql%3A%2F%2Fmakeup%3Amatkhau%40db.supabase.co%3A5432%2Fpostgres';", /chứa "postgresql:\/\/"/],
  'assets/j-doi-chung-stripe.js': [`const k='${j('sk_', 'live_', '51Hxxxxxxxxxxxxxxxxxxxxxx')}';`, /khoá bí mật Stripe/],
};

afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

describe('cửa gác bí mật — vế BẮT', () => {
  it('bộ dist-gia của thợ chấm, môi trường build có GEMINI_API_KEY và JWT_ACCESS_SECRET → bắt đủ 6/6 tệp, exit 1', () => {
    const r = runGate(writeBundle(DIST_GIA), { GEMINI_API_KEY: GEMINI_VALUE, JWT_ACCESS_SECRET: JWT_VALUE });
    expect(r.code).toBe(1);
    for (const name of Object.keys(DIST_GIA)) expect(r.out).toContain(name.split('/')[1]);
    expect(r.out).toContain('GIÁ TRỊ của biến GEMINI_API_KEY');
    expect(r.out).toContain('GIÁ TRỊ của biến JWT_ACCESS_SECRET');
    expect(r.out).toContain('service_role');
    expect(r.out).toMatch(/đã quét 6\/6 tệp · [1-9]\d* vi phạm · 6\/6 tệp dính/);
    // Không in giá trị bí mật ra log.
    for (const v of [GOOGLE, STRIPE, SUPABASE_SERVICE_ROLE, GEMINI_VALUE, JWT_VALUE, 'makeup_local']) expect(r.out).not.toContain(v);
  });

  it('bộ dist-gia, môi trường build KHÔNG có bí mật (đúng tình cảnh Vercel) → vẫn bắt 4/6 tệp theo hình dạng, exit 1', () => {
    const r = runGate(writeBundle(DIST_GIA));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/a-khoa-google\.js: chứa khoá Google API/);
    expect(r.out).toMatch(/c-supabase-service-role\.js: chứa JWT role service_role/);
    expect(r.out).toMatch(/d-the-thanh-toan\.js: chứa khoá bí mật Stripe/);
    expect(r.out).toMatch(/e-chuoi-ket-noi-cat-doi\.js: chứa "postgresql:\/\/"/);
    expect(r.out).toMatch(/e-chuoi-ket-noi-cat-doi\.js: chứa địa chỉ kèm mật khẩu/);
    expect(r.out).toMatch(/đã quét 6\/6 tệp · [1-9]\d* vi phạm · 4\/6 tệp dính/);
  });

  const shapes: [string, string][] = [
    ['tên biến JWT_ACCESS_SECRET', 'const a="JWT_ACCESS_SECRET";'],
    ['tên biến DATABASE_URL', 'x.DATABASE_URL'],
    ['tên biến DIRECT_URL', 'x.DIRECT_URL'],
    ['tên biến bí mật bất kỳ (GEMINI_API_KEY)', 'process.env.GEMINI_API_KEY'],
    ['chuỗi postgresql://', 'fetch("postgresql://u:p@h:5432/db")'],
    ['biến VITE_* ngoài danh sách cho phép', 'const k="VITE_STRIPE_SECRET";'],
    ['khoá Google AIza…', `k="${GOOGLE}"`],
    ['khoá Stripe sk_test_', `k="${j('sk_', 'test_', 'abcdefghij0123456789')}"`],
    ['khoá Stripe rk_live_', `k="${j('rk_', 'live_', 'abcdefghij0123456789')}"`],
    ['bí mật webhook whsec_', `k="${j('whsec_', 'abcdefghij0123456789abcdef')}"`],
    ['khoá OpenAI sk-proj-', `k="${j('sk-', 'proj-', 'abcdefghij0123456789abcd')}"`],
    ['khoá Anthropic sk-ant-', `k="${j('sk-', 'ant-api03-', 'abcdefghij0123456789abcd')}"`],
    ['khoá AWS AKIA…', `k="${j('AKIA', 'ABCDEFGHIJKLMNOP')}"`],
    ['thẻ GitHub ghp_', `k="${j('ghp_', 'abcdefghij0123456789abcdefghij0123')}"`],
    ['thẻ Slack xoxb-', `k="${j('xoxb-', '1234567890-abcdefghij')}"`],
    ['bí mật OAuth Google GOCSPX-', `k="${j('GOCSPX-', 'abcdefghij0123456789ab')}"`],
    ['khoá riêng PEM', `k="${j('-----BEGIN ', 'RSA PRIVATE KEY-----')}\\nMIIE"`],
    ['khoá riêng PEM không tên thuật toán', `k="${j('-----BEGIN ', 'PRIVATE KEY-----')}"`],
    ['tệp tài khoản dịch vụ Google', `k={"type": "service_account","project_id":"x"}`],
    ['chuỗi kết nối mysql có mật khẩu', 'k="mysql://root:matkhau@10.0.0.1/db"'],
    ['chuỗi kết nối redis có mật khẩu', 'k="rediss://default:matkhau@cache.internal:6380"'],
    ['chuỗi kết nối mongodb+srv có mật khẩu', 'k="mongodb+srv://u:matkhau@cluster0.x.net/db"'],
    ['chuỗi postgres cắt ba bằng nháy đơn', "k='post'+'gres'+'://u:matkhau@h/db'"],
    ['JWT service_role', `k="${SUPABASE_SERVICE_ROLE}"`],
  ];
  for (const [label, content] of shapes) {
    it(`bắt ${label} → exit 1, in tên tệp, tử số/mẫu số`, () => {
      const r = runGate(writeBundle({ 'index.html': '<html></html>', 'assets/index-abc.js': `console.log(1);${content}` }));
      expect(r.code).toBe(1);
      expect(r.out).toContain('VI PHẠM');
      expect(r.out).toContain('index-abc.js');
      expect(r.out).toMatch(/đã quét 2\/2 tệp · [1-9]\d* vi phạm · 1\/2 tệp dính/);
    });
  }

  it('bắt GIÁ TRỊ của mọi biến có tên mang nghĩa bí mật trong môi trường build, không in giá trị ra log', () => {
    const secret = 'gia-tri-bi-mat-0123456789-abcdefghij';
    for (const name of ['JWT_ACCESS_SECRET', 'GEMINI_API_KEY', 'VNPAY_HASH_SECRET', 'MOMO_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SMTP_PASSWORD', 'SENTRY_AUTH_TOKEN', 'VITE_GOOGLE_MAPS']) {
      const r = runGate(writeBundle({ 'a.js': `var s="${secret}";` }), { [name]: secret });
      expect(r.code, name).toBe(1);
      expect(r.out, name).toContain(`GIÁ TRỊ của biến ${name}`);
      expect(r.out, name).not.toContain(secret);
    }
  });

  it('đọc được bí mật trong các tệp .env* mà Vite nạp (loadEnv)', () => {
    const root = writeBundle({ '.env': 'GEMINI_API_KEY="khoa-trong-tep-env-0123456789"\n# ghi chú\nexport A=1', '.env.production.local': 'DB_PASSWORD=mat-khau-prod-012345' });
    expect(readEnvFiles(root, 'production')).toEqual({ GEMINI_API_KEY: 'khoa-trong-tep-env-0123456789', A: '1', DB_PASSWORD: 'mat-khau-prod-012345' });
  });

  it('giá trị bí mật chỉ nằm trong tệp .env.production.local (không có trong process.env) → vẫn bắt, exit 1', () => {
    const envDir = writeBundle({ '.env.production.local': `GEMINI_API_KEY=${GEMINI_VALUE}\n` });
    const r = runGate(writeBundle({ 'assets/index-abc.js': `const g="${GEMINI_VALUE}";` }), {}, ['--env-dir', envDir]);
    expect(r.code).toBe(1);
    expect(r.out).toContain('GIÁ TRỊ của biến GEMINI_API_KEY');
    expect(r.out).not.toContain(GEMINI_VALUE);
  });

  it('vite build thật nhét khoá Gemini qua `define` (đúng lỗi #5 của ssaas) → exit 1', async () => {
    const root = writeBundle({
      'index.html': '<!doctype html><html><body><script type="module" src="./main.js"></script></body></html>',
      'main.js': 'console.log("goi AI", process.env.GEMINI_API_KEY);',
    });
    const outDir = join(root, 'dist');
    // Ca 1: khoá đúng hình dạng Google → bắt dù môi trường quét không có biến.
    const key = j('AIza', 'SyThoChamKhoaGeminiThat0123456789abc');
    await build({ root, configFile: false, logLevel: 'silent', define: { 'process.env.GEMINI_API_KEY': JSON.stringify(key) }, build: { outDir, emptyOutDir: true } });
    let r = runGate(outDir);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/index-[\w-]+\.js: chứa khoá Google API/);
    // Ca 2: khoá không có hình dạng quen → bắt nhờ giá trị của biến GEMINI_API_KEY lúc build.
    await build({ root, configFile: false, logLevel: 'silent', define: { 'process.env.GEMINI_API_KEY': JSON.stringify(GEMINI_VALUE) }, build: { outDir, emptyOutDir: true } });
    r = runGate(outDir, { GEMINI_API_KEY: GEMINI_VALUE });
    expect(r.code).toBe(1);
    expect(r.out).toContain('GIÁ TRỊ của biến GEMINI_API_KEY');
  });

  it('bộ dist-la của thợ chấm đợt sửa 1, môi trường build KHÔNG có bí mật → bắt đủ 10/10 tệp, đúng loại, không in giá trị', () => {
    const files = Object.fromEntries(Object.entries(DIST_LA).map(([name, [content]]) => [name, content]));
    const r = runGate(writeBundle(files));
    expect(r.code).toBe(1);
    for (const [name, [, kind]] of Object.entries(DIST_LA)) {
      const lines = r.out.split('\n').filter((l) => l.includes(name.split('/')[1]));
      expect(lines.length, name).toBeGreaterThan(0);
      expect(lines.join('\n'), name).toMatch(kind);
    }
    expect(r.out).toMatch(/đã quét 10\/10 tệp · [1-9]\d* vi phạm · 10\/10 tệp dính/);
    for (const v of [GOOGLE_2, SB_SECRET, MAPBOX_SECRET, TWILIO_SID, TWILIO_TOKEN, 'matkhau']) expect(r.out).not.toContain(v);
  });

  const moreShapes: [string, string][] = [
    ['SID khoá API Twilio (SK…)', `k="${TWILIO_API_KEY}"`],
    ['thẻ xác thực Twilio đặt tên authToken', `c={accountSid:x,authToken:"${TWILIO_TOKEN}"}`],
    ['mảng chuỗi join("") ghép khoá Stripe', `k=["sk_li","ve_","${j('abcdefghij', '0123456789')}"].join("")`],
    ['mảng chuỗi join() có dấu cách trong ngoặc', `k=[ 'sb_secret_', '${SB_SECRET.slice(10)}' ].join( '' )`],
    ['atob chuỗi base64 ra chuỗi kết nối có mật khẩu', `k=atob("${Buffer.from('postgres://u:matkhau@h:5432/db').toString('base64')}")`],
    ['Buffer.from(…, "base64") ra khoá Supabase mới', `k=Buffer.from('${Buffer.from(SB_SECRET).toString('base64')}','base64').toString()`],
  ];
  for (const [label, content] of moreShapes) {
    it(`bắt ${label} → exit 1, in tên tệp`, () => {
      const r = runGate(writeBundle({ 'index.html': '<html></html>', 'assets/index-abc.js': `console.log(1);${content}` }));
      expect(r.code).toBe(1);
      expect(r.out).toContain('index-abc.js');
      expect(r.out).toMatch(/đã quét 2\/2 tệp · [1-9]\d* vi phạm · 1\/2 tệp dính/);
    });
  }

  // Biên bản N-J4 (J-d): tệp không đọc được mà vẫn báo đạt. Không quét được tệp nào thì không cho qua, và phải nói tên tệp.
  it('một tệp trong thư mục build không đọc được (lỗi khi đọc) → exit 1, in tên tệp, "đã quét 1/2"', () => {
    const dir = writeBundle({ 'index.html': '<html></html>', 'assets/khoa-doc.js': 'console.log(1)' });
    const r = checkBundleDir(dir, {}, {
      readFile: (p: string) => {
        if (p.endsWith('khoa-doc.js')) throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
        return Buffer.from('<html></html>');
      },
    });
    expect(r.code).toBe(1);
    expect(r.lines.join('\n')).toMatch(/KHÔNG ĐỌC ĐƯỢC .*khoa-doc\.js/);
    expect(r.lines.join('\n')).toMatch(/đã quét 1\/2 tệp/);
  });

  it('liên kết hỏng trong thư mục build → exit 1, in tên tệp (không dừng cả lượt quét với lời chung chung)', () => {
    const dir = writeBundle({ 'index.html': '<html></html>' });
    symlinkSync(join(dir, 'khong-co-that.js'), join(dir, 'lien-ket-hong.js'));
    const r = runGate(dir);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/KHÔNG ĐỌC ĐƯỢC .*lien-ket-hong\.js/);
    expect(r.out).toMatch(/đã quét 1\/2 tệp/);
  });

  it.skipIf(spawnSync('mkfifo', ['--version']).status !== 0)('tệp đặc biệt (FIFO) trong thư mục build → exit 1, in tên tệp, không treo', () => {
    const dir = writeBundle({ 'index.html': '<html></html>' });
    expect(spawnSync('mkfifo', [join(dir, 'ong-dan.js')]).status).toBe(0);
    const r = runGate(dir);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/KHÔNG ĐỌC ĐƯỢC .*ong-dan\.js/);
  });

  it('thư mục rỗng hoặc không có → exit 1 (không quét được thì không cho qua)', () => {
    expect(runGate(tempDir()).code).toBe(1);
    expect(runGate(join(tempDir(), 'khong-co')).code).toBe(1);
  });
});

describe('cửa gác bí mật — vế GIỮ', () => {
  it('chuỗi trông giống nhưng không phải bí mật → 0 vi phạm', () => {
    const r = runGate(
      writeBundle({
        'a.js': [
          'fetch("https://react.dev/errors/418")',
          'el.style.maskImage="mask-image"',
          'mailto:"hotro@makeup.vn"',
          'u="https://user@host.vn/x"', // có user, không có mật khẩu
          'k="sk_live"', // tiền tố trơ trọi
          'n="ACCESS_TOKEN_TTL_SECONDS"',
          'a="AIza"',
          'b="eyJ"',
          'c="BEGIN PUBLIC KEY"',
        ].join(';'),
      }),
      { NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production', CI: '1' },
    );
    expect(r.out).toMatch(/đã quét 1\/1 tệp · 0 vi phạm · 0\/1 tệp dính/);
    expect(r.code).toBe(0);
  });

  it('dạng công khai / trông giống nhưng không phải khoá (Supabase publishable, Mapbox pk., join/atob/fromCharCode chữ thường, mã băm hex) → 0 vi phạm', () => {
    const r = runGate(
      writeBundle({
        'a.js': [
          `k="${j('sb_', 'publishable_', 'N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz')}"`,
          `mapboxgl.accessToken="${j('pk', '.eyJ1IjoibWFrZXVwIiwiYSI6ImNsdGVzdDAwMDAwMDAwMDAwMDAwMDAwIn0', '.abcdefghijklmnopqrstuv')}"`,
          'cls=["ui-input","ui-input--right"].join(" ")',
          'p=["a","b","c"].join("")',
          `t=atob("${Buffer.from('Xin chào, đây là chữ thường').toString('base64')}")`,
          'd=atob(s)',
          's=String.fromCharCode(e)',
          'z=String.fromCharCode(72,101,108,108,111)',
          'integrity="sha384-0123456789abcdef0123456789abcdef"',
          'id="0123456789abcdef0123456789abcdef"',
          'sk="sk.abc"',
          'q="%3A%2F%2Fexample.com"',
        ].join(';'),
      }),
    );
    expect(r.out).toMatch(/đã quét 1\/1 tệp · 0 vi phạm · 0\/1 tệp dính/);
    expect(r.code).toBe(0);
  });

  it('bản build thật của web sạch → exit 0, in "đã quét N/N tệp · 0 vi phạm"', async () => {
    const outDir = tempDir();
    await build({ root: WEB, configFile: join(WEB, 'vite.config.ts'), logLevel: 'silent', build: { outDir, emptyOutDir: true } });
    // Môi trường giống Vercel: có biến hệ thống nhưng không có bí mật của máy chủ.
    const r = runGate(outDir, { NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: '4e9423d0123456789abcdef', CI: '1' });
    expect(r.out).toMatch(/đã quét ([1-9]\d*)\/\1 tệp · 0 vi phạm · 0\/\1 tệp dính/);
    expect(r.code).toBe(0);
  });
});
