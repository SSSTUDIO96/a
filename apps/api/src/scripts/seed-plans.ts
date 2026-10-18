import { pathToFileURL } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import { createPrisma } from '../lib/prisma';
import { DEFAULT_PLAN_CODE } from '../lib/quota';

// Gói mẫu theo bản yêu cầu gốc: Individual / Pro / Team / Academy / Academy Pro.
// GIÁ ĐỂ 0 — CHỦ TỰ ĐẶT GIÁ (sửa qua PATCH /platform/plans/:planId). Giới hạn là đề xuất ban đầu, null = không giới hạn.
// Chạy lại không ghi đè: gói đã có (theo mã) được giữ nguyên, kể cả giá chủ đã đặt.
//   pnpm --filter @makeup/api platform:seed-plans
//   pnpm --filter @makeup/api platform:seed-plans -- --with-trial   (thêm gói mặc định 'trial' cho tổ chức chưa có thuê bao)

export interface PlanSeed {
  code: string;
  name: string;
  maxStaff: number | null;
  maxAppointmentsPerMonth: number | null;
  maxStorageMb: number | null;
  maxStudents: number | null;
  maxCourses: number | null;
  customDomain: boolean;
  isActive: boolean;
  sortOrder: number;
}

const GB = 1024;

export const SAMPLE_PLANS: PlanSeed[] = [
  // Thợ makeup làm một mình.
  { code: 'individual', name: 'Individual', maxStaff: 1, maxAppointmentsPerMonth: 60, maxStorageMb: 2 * GB, maxStudents: 0, maxCourses: 0, customDomain: false, isActive: true, sortOrder: 10 },
  // Thợ chính + vài trợ lý.
  { code: 'pro', name: 'Pro', maxStaff: 3, maxAppointmentsPerMonth: 200, maxStorageMb: 10 * GB, maxStudents: 0, maxCourses: 0, customDomain: false, isActive: true, sortOrder: 20 },
  // Studio / ekip.
  { code: 'team', name: 'Team', maxStaff: 15, maxAppointmentsPerMonth: 1000, maxStorageMb: 50 * GB, maxStudents: 0, maxCourses: 0, customDomain: true, isActive: true, sortOrder: 30 },
  // Học viện nhỏ: có học viên, khoá học.
  { code: 'academy', name: 'Academy', maxStaff: 10, maxAppointmentsPerMonth: 500, maxStorageMb: 50 * GB, maxStudents: 200, maxCourses: 10, customDomain: true, isActive: true, sortOrder: 40 },
  // Học viện lớn.
  { code: 'academy_pro', name: 'Academy Pro', maxStaff: 30, maxAppointmentsPerMonth: null, maxStorageMb: 200 * GB, maxStudents: 1000, maxCourses: 50, customDomain: true, isActive: true, sortOrder: 50 },
];

// Gói mặc định cho tổ chức chưa có thuê bao: giới hạn như Individual, KHÔNG bán (isActive=false). Chỉ tạo khi được yêu cầu.
export const TRIAL_PLAN: PlanSeed = {
  code: DEFAULT_PLAN_CODE,
  name: 'Dùng thử',
  maxStaff: 1,
  maxAppointmentsPerMonth: 60,
  maxStorageMb: 2 * GB,
  maxStudents: 0,
  maxCourses: 0,
  customDomain: false,
  isActive: false,
  sortOrder: 0,
};

export async function seedPlans(db: PrismaClient, opts: { withTrial?: boolean } = {}) {
  const wanted = opts.withTrial ? [TRIAL_PLAN, ...SAMPLE_PLANS] : SAMPLE_PLANS;
  const created: string[] = [];
  const kept: string[] = [];
  await db.$transaction(async (tx) => {
    for (const p of wanted) {
      const existing = await tx.subscriptionPlan.findUnique({ where: { code: p.code }, select: { id: true } });
      if (existing) {
        kept.push(p.code);
        continue;
      }
      const row = await tx.subscriptionPlan.create({ data: { ...p, priceMonthly: 0n, features: [] } });
      created.push(p.code);
      await tx.auditLog.create({
        data: {
          organizationId: null,
          actorUserId: null,
          action: 'platform.plan_seeded',
          entityType: 'subscription_plan',
          entityId: row.id,
          data: { code: p.code, via: 'script' },
        },
      });
    }
  });
  const hasTrial = (await db.subscriptionPlan.count({ where: { code: DEFAULT_PLAN_CODE } })) > 0;
  return { created, kept, hasTrial };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL');
  const db = createPrisma(url);
  try {
    const r = await seedPlans(db, { withTrial: process.argv.includes('--with-trial') });
    console.log(`Gói mẫu: tạo mới [${r.created.join(', ')}], giữ nguyên [${r.kept.join(', ')}]. Giá để 0 — chủ tự đặt giá.`);
    if (!r.hasTrial) {
      console.warn(
        `Chưa có gói mặc định mã "${DEFAULT_PLAN_CODE}": tổ chức chưa có thuê bao sẽ báo lỗi cấu hình khi kiểm giới hạn. ` +
          'Chạy lại với --with-trial hoặc tạo gói qua POST /platform/plans.',
      );
    }
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
