import { it, expect } from 'vitest';
import { makeDeps } from '../test/helpers';
it('createdAt của nhật ký lấy giờ lúc ghi hay giờ bắt đầu transaction', async () => {
  const d = makeDeps();
  const r = await d.db.$transaction(async (tx) => {
    const t0 = (await tx.$queryRaw<{ t: Date }[]>`SELECT now() AS t`)[0]!.t;
    await tx.$executeRaw`SELECT pg_sleep(1)`;
    const row = await tx.auditLog.create({ data: { action: 'thu.gio', entityType: 'thu' } });
    return { t0, created: row.createdAt };
  }, { timeout: 10000 });
  const diff = r.created.getTime() - r.t0.getTime();
  console.log(`[thợ chấm] createdAt - now()(đầu transaction) = ${diff} ms`);
  expect(diff).toBeGreaterThan(900);
  await d.db.$disconnect();
});
