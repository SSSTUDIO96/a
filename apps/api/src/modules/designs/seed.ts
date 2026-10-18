// Chép 6 câu chúc mặc định (DEFAULT_GREETING_PHRASES của packages/shared) vào một tổ chức.
// Gọi trong CÙNG transaction tạo tổ chức (modules/orgs — thợ giữ orgs gọi), giống DEFAULT_MAKEUP_SUBJECTS.
// Chạy lại không nhân đôi: tổ chức đã có câu chúc nào (kể cả đã sửa/ẩn) thì không chép nữa — dùng được để chạy bù
// cho tổ chức tạo trước khi có bảng greeting_phrases.
import type { Prisma } from '@prisma/client';
import { DEFAULT_GREETING_PHRASES } from '@makeup/shared';

// Trả số câu đã chép (6 với tổ chức chưa có câu nào, 0 nếu đã có).
export async function seedDefaultGreetingPhrases(tx: Prisma.TransactionClient, orgId: string): Promise<number> {
  // Khoá dòng tổ chức: hai lần chạy bù cùng lúc không chép hai bộ.
  await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${orgId}::uuid FOR UPDATE`;
  const existing = await tx.greetingPhrase.count({ where: { organizationId: orgId } });
  if (existing > 0) return 0;
  const res = await tx.greetingPhrase.createMany({
    data: DEFAULT_GREETING_PHRASES.map((p, i) => ({
      organizationId: orgId,
      name: p.name,
      appliesTo: [...p.appliesTo],
      title: p.title,
      body: p.body,
      sortOrder: i,
    })),
  });
  return res.count;
}
