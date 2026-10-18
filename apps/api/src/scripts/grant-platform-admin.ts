import { hostname, userInfo } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import { createPrisma } from '../lib/prisma';

// Cấp / thu quyền quản trị nền tảng. CHỈ chạy trên máy chủ bởi người vận hành (cần DATABASE_URL thật):
//   pnpm --filter @makeup/api platform:grant-admin -- --email x@y
//   pnpm --filter @makeup/api platform:grant-admin -- --email x@y --revoke
// Không có đường API nào cấp quyền này, không có mật khẩu chung, không có header bí mật
// (Studio Pro cũ mở quyền bằng một mật khẩu dùng chung qua header — PROJECT_AUDIT lỗi số 6).
// Người được cấp đăng nhập bằng tài khoản RIÊNG của họ như mọi người dùng khác.

export interface GrantResult {
  userId: string;
  email: string;
  changed: boolean;
}

function operatorLabel(): string {
  try {
    return `${userInfo().username}@${hostname()}`;
  } catch {
    return `?@${hostname()}`;
  }
}

export async function grantPlatformAdmin(
  db: PrismaClient,
  rawEmail: string,
  opts: { revoke?: boolean } = {},
): Promise<GrantResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) throw new Error(`Email không hợp lệ: "${rawEmail}"`);
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email }, select: { id: true, status: true } });
    if (!user) throw new Error(`Chưa có tài khoản với email ${email} — người đó phải tự đăng ký trước`);
    const existing = await tx.platformAdmin.findUnique({ where: { userId: user.id } });
    if (opts.revoke) {
      if (!existing) return { userId: user.id, email, changed: false };
      await tx.platformAdmin.delete({ where: { userId: user.id } });
    } else {
      if (user.status !== 'ACTIVE') throw new Error(`Tài khoản ${email} đang bị khoá — không cấp quyền`);
      if (existing) return { userId: user.id, email, changed: false };
      // createdById để trống: người vận hành chạy lệnh trên máy chủ, không phải một tài khoản trong hệ thống.
      await tx.platformAdmin.create({ data: { userId: user.id, createdById: null } });
    }
    await tx.auditLog.create({
      data: {
        organizationId: null,
        actorUserId: null,
        action: opts.revoke ? 'platform_admin.revoked' : 'platform_admin.granted',
        entityType: 'platform_admin',
        entityId: user.id,
        data: { email, via: 'script', operator: operatorLabel() },
      },
    });
    return { userId: user.id, email, changed: true };
  });
}

export function parseArgs(argv: string[]): { email: string; revoke: boolean } {
  const args = argv.filter((a) => a !== '--');
  const i = args.indexOf('--email');
  const email = i >= 0 ? args[i + 1] : undefined;
  if (!email || email.startsWith('--')) {
    throw new Error('Cách dùng: pnpm --filter @makeup/api platform:grant-admin -- --email x@y [--revoke]');
  }
  return { email, revoke: args.includes('--revoke') };
}

async function main() {
  const { email, revoke } = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL');
  const db = createPrisma(url);
  try {
    const r = await grantPlatformAdmin(db, email, { revoke });
    const verb = revoke ? 'Thu quyền' : 'Cấp quyền';
    console.log(r.changed ? `${verb} quản trị nền tảng: ${r.email} (${r.userId}) — đã ghi nhật ký` : `${r.email}: không đổi gì (${revoke ? 'vốn không có quyền' : 'đã có quyền'})`);
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
