import { Prisma, type SubscriptionPlan, type SubscriptionStatus } from '@prisma/client';
import { AppError } from './errors';

// ==================== THUÊ BAO HIỆN HÀNH ====================

// Thời gian ân hạn sau ngày hết hạn: vẫn cho thêm mới trong 7 ngày để chủ kịp chuyển khoản / người vận hành kịp
// ghi gia hạn (chuyển khoản ngân hàng thường chậm 1–3 ngày làm việc, cộng cuối tuần và ngày lễ).
// Trong ân hạn trạng thái hiệu lực VẪN là EXPIRED (để trang quản trị thấy ngay), chỉ có quyền ghi được giữ lại.
// Hết ân hạn → chỉ cho đọc. Không bao giờ xoá dữ liệu.
export const GRACE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Mã gói dùng cho tổ chức CHƯA CÓ thuê bao nào. Không tự đoán "không giới hạn": thiếu gói này là lỗi cấu hình.
export const DEFAULT_PLAN_CODE = 'trial';

export interface SubscriptionState {
  effectiveStatus: SubscriptionStatus;
  // Hạn chót được ghi (endsAt + GRACE_DAYS); null khi thuê bao không có hạn.
  graceEndsAt: Date | null;
  // Đã quá endsAt nhưng còn trong ân hạn.
  inGrace: boolean;
  // Còn được thêm mới / sửa hay không.
  writable: boolean;
}

// Hàm thuần — nguồn duy nhất của luật trạng thái hiệu lực (câu SQL lọc ở EFFECTIVE_STATUS_SQL viết theo đúng luật này).
// - EXPIRED / CANCELLED ghi tay: giữ nguyên, không ân hạn (người vận hành đã chủ động chấm dứt).
// - endsAt ≤ bây giờ: EXPIRED (endsAt là mốc kết thúc, không tính vào kỳ).
// - Còn lại: trạng thái đã ghi (TRIAL / ACTIVE / PAST_DUE).
export function describeSubscription(sub: { status: SubscriptionStatus; endsAt: Date | null }, now: Date): SubscriptionState {
  if (sub.status === 'EXPIRED' || sub.status === 'CANCELLED') {
    return { effectiveStatus: sub.status, graceEndsAt: sub.endsAt, inGrace: false, writable: false };
  }
  if (!sub.endsAt) {
    return { effectiveStatus: sub.status, graceEndsAt: null, inGrace: false, writable: true };
  }
  const graceEndsAt = new Date(sub.endsAt.getTime() + GRACE_DAYS * DAY_MS);
  if (now.getTime() < sub.endsAt.getTime()) {
    return { effectiveStatus: sub.status, graceEndsAt, inGrace: false, writable: true };
  }
  const inGrace = now.getTime() < graceEndsAt.getTime();
  return { effectiveStatus: 'EXPIRED', graceEndsAt, inGrace, writable: inGrace };
}

// Bản SQL của describeSubscription().effectiveStatus, dùng để LỌC danh sách ở trang quản trị.
// Đầu vào: bí danh cột sub_id, sub_status, ends_at; tham số now. Sửa luật ở trên thì sửa cả ở đây (có bài thử so hai bên).
export function effectiveStatusSql(now: Date): Prisma.Sql {
  return Prisma.sql`CASE
    WHEN sub_id IS NULL THEN 'NONE'
    WHEN sub_status IN ('EXPIRED', 'CANCELLED') THEN sub_status
    WHEN ends_at IS NOT NULL AND ends_at <= ${now}::timestamptz THEN 'EXPIRED'
    ELSE sub_status END`;
}

// Câu chọn "thuê bao hiện hành" của từng tổ chức: dòng có startsAt ≤ now, mới nhất trước
// (cùng startsAt thì dòng tạo sau thắng). Dùng chung cho danh sách và thống kê ở module platform.
// Thêm cột coverage_end: ngày hết của CHUỖI gia hạn nối tiếp (bằng ends_at nếu không có kỳ nối tiếp; NULL nếu thuê bao
// không hạn HOẶC có kỳ nối tiếp không hạn — Prisma không đọc được 'infinity'). Kỳ nối tiếp = dòng TRIAL/ACTIVE/PAST_DUE bắt đầu sau bây giờ, không muộn hơn mốc hết của
// mắt xích trước (không hở), và hết sau mốc đó. Lọc "sắp hết hạn" dùng coverage_end (expiringSql) — studio đã gia hạn
// nối tiếp không bị đếm là sắp hết hạn (thợ màn quản trị W13).
export function currentSubscriptionsSql(now: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT o.id, o.name, o.slug, o.kind::text AS kind, o.status::text AS status, o.created_at,
           s.id AS sub_id, s.status::text AS sub_status, s.starts_at, s.ends_at,
           p.id AS plan_id, p.code AS plan_code, p.name AS plan_name, p.price_monthly,
           CASE WHEN s.ends_at IS NULL THEN NULL ELSE NULLIF((
             WITH RECURSIVE chain(until) AS (
               SELECT s.ends_at::timestamptz
               UNION ALL
               SELECT nxt.ends_at FROM chain
               CROSS JOIN LATERAL (
                 SELECT COALESCE(y.ends_at::timestamptz, 'infinity'::timestamptz) AS ends_at
                 FROM organization_subscriptions y
                 WHERE y.organization_id = o.id AND y.status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
                   AND y.starts_at > ${now}::timestamptz AND y.starts_at <= chain.until
                   AND COALESCE(y.ends_at, 'infinity'::timestamptz) > chain.until
                 ORDER BY COALESCE(y.ends_at, 'infinity'::timestamptz) DESC
                 LIMIT 1
               ) nxt
               WHERE chain.until < 'infinity'::timestamptz
             )
             SELECT max(until) FROM chain
           ), 'infinity'::timestamptz) END AS coverage_end
    FROM organizations o
    LEFT JOIN LATERAL (
      SELECT x.id, x.status, x.starts_at, x.ends_at, x.plan_id
      FROM organization_subscriptions x
      WHERE x.organization_id = o.id AND x.starts_at <= ${now}::timestamptz
      ORDER BY x.starts_at DESC, x.created_at DESC, x.id DESC
      LIMIT 1
    ) s ON true
    LEFT JOIN subscription_plans p ON p.id = s.plan_id`;
}

// MỘT luật "sắp hết hạn" dùng chung cho danh sách (expiringWithinDays) và thống kê (expiringIn30Days): thuê bao hiện hành
// còn hiệu lực, đã có hạn trong tương lai, và CHUỖI nối tiếp hết trong khoảng [now, until]. Đầu vào: bí danh cột
// effective_status, ends_at, coverage_end (từ currentSubscriptionsSql + effectiveStatusSql).
export function expiringSql(now: Date, until: Date): Prisma.Sql {
  return Prisma.sql`(effective_status IN ('TRIAL', 'ACTIVE', 'PAST_DUE')
    AND ends_at > ${now}::timestamptz AND coverage_end <= ${until}::timestamptz)`;
}

const subscriptionInclude = { plan: true } satisfies Prisma.OrganizationSubscriptionInclude;
export type SubscriptionWithPlan = Prisma.OrganizationSubscriptionGetPayload<{ include: typeof subscriptionInclude }>;

export type CurrentSubscription =
  | { hasSubscription: false }
  | ({ hasSubscription: true; subscription: SubscriptionWithPlan } & SubscriptionState);

// Thuê bao hiện hành = dòng mới nhất có startsAt ≤ now. Chưa có dòng nào → nói rõ "chưa có thuê bao", không đoán.
export async function getCurrentSubscription(
  tx: Prisma.TransactionClient,
  orgId: string,
  now: Date = new Date(),
): Promise<CurrentSubscription> {
  const subscription = await tx.organizationSubscription.findFirst({
    where: { organizationId: orgId, startsAt: { lte: now } },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    include: subscriptionInclude,
  });
  if (!subscription) return { hasSubscription: false };
  return { hasSubscription: true, subscription, ...describeSubscription(subscription, now) };
}

export interface EffectivePlan {
  plan: SubscriptionPlan;
  // 'subscription' = gói của thuê bao hiện hành; 'default' = tổ chức chưa có thuê bao, áp gói mặc định (mã 'trial').
  source: 'subscription' | 'default';
  current: CurrentSubscription;
}

export async function getEffectivePlan(
  tx: Prisma.TransactionClient,
  orgId: string,
  now: Date = new Date(),
): Promise<EffectivePlan> {
  const current = await getCurrentSubscription(tx, orgId, now);
  if (current.hasSubscription) return { plan: current.subscription.plan, source: 'subscription', current };
  const plan = await tx.subscriptionPlan.findUnique({ where: { code: DEFAULT_PLAN_CODE } });
  if (!plan) {
    // Lời cho người dùng studio KHÔNG chứa lệnh vận hành (biên bản máy chủ lát 2, N10); lệnh nằm trong log máy chủ.
    throw new AppError(
      'INTERNAL',
      'Hệ thống chưa cấu hình gói dịch vụ cho tổ chức này. Vui lòng liên hệ bộ phận hỗ trợ.',
      { reason: 'DEFAULT_PLAN_MISSING' },
      `Tổ chức ${orgId} chưa có thuê bao và hệ thống chưa có gói mặc định mã "${DEFAULT_PLAN_CODE}". ` +
        'Tạo gói: pnpm --filter @makeup/api platform:seed-plans -- --with-trial (bản build: pnpm --filter @makeup/api platform:seed-plans:prod -- --with-trial), hoặc gán thuê bao cho tổ chức.',
    );
  }
  return { plan, source: 'default', current };
}

// ==================== CHỈ CHO ĐỌC KHI HẾT HẠN ====================

export const EXPIRED_MESSAGE = 'Gói đã hết hạn — dữ liệu vẫn được giữ, gia hạn để tiếp tục thêm mới';
export const CANCELLED_MESSAGE = 'Gói đã bị huỷ — dữ liệu vẫn được giữ, gia hạn để tiếp tục thêm mới';

// Gọi ở đầu mọi thao tác THÊM MỚI / SỬA của tổ chức. Đọc dữ liệu không cần gọi — hết hạn vẫn xem được hết.
// Tổ chức chưa có thuê bao: được ghi (gói mặc định không có hạn); giới hạn số lượng do assertQuota lo.
export async function assertWritable(tx: Prisma.TransactionClient, orgId: string, now: Date = new Date()): Promise<void> {
  const current = await getCurrentSubscription(tx, orgId, now);
  if (!current.hasSubscription || current.writable) return;
  throw new AppError('FORBIDDEN', current.effectiveStatus === 'CANCELLED' ? CANCELLED_MESSAGE : EXPIRED_MESSAGE, {
    reason: 'SUBSCRIPTION_READ_ONLY',
    effectiveStatus: current.effectiveStatus,
    endsAt: current.subscription.endsAt,
    graceEndsAt: current.graceEndsAt,
  });
}

// ==================== GIỚI HẠN GÓI ====================

export type QuotaKind = 'staff' | 'appointmentsPerMonth' | 'storageMb' | 'students' | 'courses';

const LIMIT_FIELD = {
  staff: 'maxStaff',
  appointmentsPerMonth: 'maxAppointmentsPerMonth',
  storageMb: 'maxStorageMb',
  students: 'maxStudents',
  courses: 'maxCourses',
} as const satisfies Record<QuotaKind, keyof SubscriptionPlan>;

const LABEL: Record<QuotaKind, string> = {
  staff: 'nhân sự',
  appointmentsPerMonth: 'lịch trong tháng',
  storageMb: 'MB dung lượng tệp',
  students: 'học viên',
  courses: 'khoá học',
};

const BYTES_PER_MB = 1024 * 1024;
export function bytesToMb(bytes: number | bigint): number {
  return Number(bytes) / BYTES_PER_MB;
}

// Số đang dùng của từng loại. Định nghĩa (đã ghi trong báo cáo, chủ đầu tư có thể đổi):
// - staff: thành viên chưa rời tổ chức (ACTIVE + SUSPENDED). Mở khoá lại một người đang tạm khoá không tốn thêm chỗ.
// - appointmentsPerMonth: lịch TẠO trong tháng dương lịch hiện tại theo múi giờ của tổ chức, mọi loại, kể cả đã huỷ
//   (để tạo-rồi-huỷ không lách được giới hạn).
// - storageMb: tổng dung lượng tệp chưa xoá (UPLOADING + READY) — tệp đang tải lên đã giữ chỗ.
// - courses: khoá học CHƯA LƯU TRỮ (archived_at IS NULL) — lưu trữ khoá là trả chỗ (BAN-VE-C3 mục 1.0).
// - students: số KHÁCH KHÁC NHAU đang có ghi danh ACTIVE — một học viên học nhiều lớp chỉ tốn một chỗ; huỷ ghi danh
//   cuối cùng của học viên là trả chỗ. Bên gọi (contracts/enroll.ts) gọi SAU khi ghi danh, adding = 0.
export async function getUsage(
  tx: Prisma.TransactionClient,
  orgId: string,
  kind: QuotaKind,
  now: Date = new Date(),
): Promise<number> {
  switch (kind) {
    case 'staff':
      return tx.membership.count({ where: { organizationId: orgId, status: { in: ['ACTIVE', 'SUSPENDED'] } } });
    case 'appointmentsPerMonth': {
      const rows = await tx.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n
        FROM appointments a JOIN organizations o ON o.id = a.organization_id
        WHERE a.organization_id = ${orgId}::uuid
          AND a.created_at >= (date_trunc('month', ${now}::timestamptz AT TIME ZONE o.timezone) AT TIME ZONE o.timezone)`;
      return rows[0]?.n ?? 0;
    }
    case 'storageMb': {
      const agg = await tx.storedFile.aggregate({
        where: { organizationId: orgId, status: { not: 'DELETED' } },
        _sum: { sizeBytes: true },
      });
      return bytesToMb(agg._sum.sizeBytes ?? 0n);
    }
    case 'courses':
      return tx.course.count({ where: { organizationId: orgId, archivedAt: null } });
    case 'students': {
      const rows = await tx.$queryRaw<{ n: number }[]>`
        SELECT count(DISTINCT customer_id)::int AS n
        FROM enrollments
        WHERE organization_id = ${orgId}::uuid AND status = 'ACTIVE'`;
      return rows[0]?.n ?? 0;
    }
  }
}

// Kiểm giới hạn gói TRƯỚC khi thêm mới, trong CÙNG transaction với lệnh thêm.
// - Gọi assertWritable trước: hết hạn quá ân hạn → 403 (chỗ thêm mới chỉ cần gọi một hàm này).
// - Giới hạn null = không giới hạn.
// - adding: số lượng sắp thêm; với storageMb là số MB (được lẻ — dùng bytesToMb(sizeBytes)).
// - Khoá tư vấn theo (tổ chức, loại) đến hết transaction: hai yêu cầu thêm cùng lúc phải xếp hàng,
//   không thể cùng đọc "còn 1 chỗ" rồi cùng thêm. Khoá riêng theo loại nên không vướng khoá dòng của module khác.
export async function assertQuota(
  tx: Prisma.TransactionClient,
  orgId: string,
  kind: QuotaKind,
  adding: number = 1,
  now: Date = new Date(),
): Promise<void> {
  if (!(adding >= 0) || !Number.isFinite(adding)) throw new Error(`assertQuota: adding không hợp lệ (${adding})`);
  await assertWritable(tx, orgId, now);
  const { plan } = await getEffectivePlan(tx, orgId, now);
  const limit = plan[LIMIT_FIELD[kind]];
  if (limit === null) return;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`quota:${kind}:${orgId}`}))::text`;
  const used = await getUsage(tx, orgId, kind, now);
  if (used + adding > limit) {
    const shown = kind === 'storageMb' ? Math.round(used * 10) / 10 : used;
    throw new AppError(
      'CONFLICT',
      `Đã đạt giới hạn gói ${plan.name}: tối đa ${limit} ${LABEL[kind]} (đang dùng ${shown}). Nâng gói để thêm.`,
      { reason: 'QUOTA_EXCEEDED', kind, planCode: plan.code, limit, used, adding },
    );
  }
}
