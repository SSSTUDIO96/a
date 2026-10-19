import { z } from 'zod';

// Biến tuỳ chọn: dòng "BIEN=" để trống (chép từ .env.example) coi như chưa khai.
const optional = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const S3_KEYS = ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_FORCE_PATH_STYLE'] as const;
const MAIL_HTTP_KEYS = ['MAIL_FROM', 'MAIL_HTTP_URL', 'MAIL_HTTP_API_KEY'] as const;
const LOCAL_PROD_KEYS = ['STORAGE_LOCAL_DIR', 'STORAGE_SIGNING_SECRET', 'STORAGE_PUBLIC_BASE_URL'] as const;

// Thiếu biến bắt buộc thì máy chủ không khởi động — không có giá trị mặc định ngầm cho bí mật.
// Lời báo lỗi chỉ nêu TÊN biến, không bao giờ in giá trị (bí mật không lọt ra log).
const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET phải dài ít nhất 32 ký tự'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    CORS_ORIGINS: z.string().default(''),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    // Đổi thẻ (/auth/refresh) có bộ đếm riêng, theo IP mỗi phút (xem app.ts). Bỏ trống → mặc định theo AUTH_RATE_LIMIT_PER_MINUTE:
    // số lần đổi thẻ SAI (chống dò) = 3 × AUTH…; trần tổng mọi lần đổi thẻ = 30 × AUTH….
    REFRESH_PROBE_LIMIT_PER_MINUTE: optional(z.coerce.number().int().positive()),
    REFRESH_RATE_LIMIT_PER_MINUTE: optional(z.coerce.number().int().positive()),
    // Mở cổng học viên (POST /portal/session, /portal/session/claim): bộ đếm RIÊNG theo IP mỗi phút (bản vẽ E 2.6).
    // Khai sẵn 10 trong .env.example; khai sai (0, chữ, dòng rỗng) → máy chủ không khởi động, lỗi nêu tên biến.
    PORTAL_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),
    // Số tầng proxy đứng trước máy chủ (Railway: 1). 0 = không tin header X-Forwarded-For —
    // tránh bị lách giới hạn tốc độ bằng cách tự đổi IP trong header (biên bản mốc 2, L7).
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    // ===== Kho tệp (ảnh đại diện, logo, album, tài liệu) — đọc ở lib/storage/config.ts =====
    // local = đĩa của máy chủ; s3 = dịch vụ giao thức S3. Production bắt buộc khai; dev/test bỏ trống → local thư mục tạm.
    STORAGE_DRIVER: optional(z.enum(['local', 's3'])),
    STORAGE_LOCAL_DIR: optional(z.string().min(1)),
    STORAGE_SIGNING_SECRET: optional(z.string().min(32, 'STORAGE_SIGNING_SECRET phải dài ít nhất 32 ký tự')),
    STORAGE_PUBLIC_BASE_URL: optional(z.url({ protocol: /^https?$/, error: 'STORAGE_PUBLIC_BASE_URL phải là địa chỉ http(s)' })),
    S3_ENDPOINT: optional(z.url({ protocol: /^https?$/, error: 'S3_ENDPOINT phải là địa chỉ http(s)' })),
    S3_REGION: optional(z.string().min(1)),
    S3_BUCKET: optional(z.string().min(1)),
    S3_ACCESS_KEY_ID: optional(z.string().min(1)),
    S3_SECRET_ACCESS_KEY: optional(z.string().min(1)),
    S3_FORCE_PATH_STYLE: optional(z.enum(['true', 'false'])),
    // ===== Gửi thư (đặt lại mật khẩu) — đọc ở lib/mailer/index.ts =====
    // console = in thư ra nhật ký máy chủ (chạy thử; production KHÔNG nhận); http = gọi API gửi thư qua HTTPS (khung sẵn,
    // chưa bật ở môi trường nào). Bỏ trống: dev/test → console; production → đường quên mật khẩu trả 503 NOT_CONFIGURED.
    MAIL_DRIVER: optional(z.enum(['console', 'http'])),
    // Người gửi hiện trong thư, ví dụ "Makeup Pro <no-reply@makeup.vn>" (bắt buộc khi MAIL_DRIVER=http).
    MAIL_FROM: optional(z.string().min(3).max(200)),
    MAIL_HTTP_URL: optional(z.url({ protocol: /^https?$/, error: 'MAIL_HTTP_URL phải là địa chỉ http(s)' })),
    MAIL_HTTP_API_KEY: optional(z.string().min(8, 'MAIL_HTTP_API_KEY quá ngắn')),
    // Địa chỉ trang web (đường dẫn trong thư = <địa chỉ>/dat-lai-mat-khau#the=…). Production bắt buộc để gửi thư;
    // dev/test bỏ trống → http://localhost:5173.
    WEB_APP_URL: optional(z.url({ protocol: /^https?$/, error: 'WEB_APP_URL phải là địa chỉ http(s)' })),
    // Thẻ đặt lại mật khẩu hết hạn sau bao nhiêu phút (5–1440, mặc định 30).
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  })
  .superRefine((e, ctx) => {
    const need = (key: keyof typeof e, why: string) => {
      if (e[key] === undefined) ctx.addIssue({ code: 'custom', path: [key], message: `thiếu — ${why}` });
    };
    const prod = e.NODE_ENV === 'production';
    if (prod) need('STORAGE_DRIVER', 'production phải chọn kho tệp: local hoặc s3');
    // Driver s3 thiếu biến thì ở môi trường nào cũng không chạy được → báo ngay lúc khởi động.
    if (e.STORAGE_DRIVER === 's3') for (const k of S3_KEYS) need(k, 'bắt buộc khi STORAGE_DRIVER=s3');
    // Driver http thiếu biến thì không gửi được thư ở bất kỳ môi trường nào → báo ngay lúc khởi động (như s3).
    if (e.MAIL_DRIVER === 'http') for (const k of MAIL_HTTP_KEYS) need(k, 'bắt buộc khi MAIL_DRIVER=http');
    // Khoá API gửi thư không được đi qua http trần ở production.
    if (prod && e.MAIL_HTTP_URL?.startsWith('http:')) {
      ctx.addIssue({ code: 'custom', path: ['MAIL_HTTP_URL'], message: 'production phải dùng https' });
    }
    if (prod && e.STORAGE_DRIVER === 'local') {
      for (const k of LOCAL_PROD_KEYS) need(k, 'bắt buộc khi STORAGE_DRIVER=local ở production');
      if (e.STORAGE_SIGNING_SECRET !== undefined && e.STORAGE_SIGNING_SECRET === e.JWT_ACCESS_SECRET) {
        ctx.addIssue({ code: 'custom', path: ['STORAGE_SIGNING_SECRET'], message: 'STORAGE_SIGNING_SECRET phải khác JWT_ACCESS_SECRET' });
      }
    }
  })
  .transform((e) => ({
    ...e,
    REFRESH_PROBE_LIMIT_PER_MINUTE: e.REFRESH_PROBE_LIMIT_PER_MINUTE ?? e.AUTH_RATE_LIMIT_PER_MINUTE * 3,
    REFRESH_RATE_LIMIT_PER_MINUTE: e.REFRESH_RATE_LIMIT_PER_MINUTE ?? e.AUTH_RATE_LIMIT_PER_MINUTE * 30,
  }));

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Cấu hình môi trường không hợp lệ — ${issues}`);
  }
  return parsed.data;
}
