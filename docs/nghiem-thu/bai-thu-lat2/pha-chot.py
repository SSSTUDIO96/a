#!/usr/bin/env python3
# Thợ chấm tự phá chốt: mỗi đột biến sửa ĐÚNG MỘT chỗ trong mã, chạy bài thử của THỢ, ghi đỏ/xanh, rồi trả mã về nguyên.
# Chạy: python3 pha-chot.py <thư mục bản chấm> [mã đột biến ...]
import json, os, re, shutil, subprocess, sys

W = sys.argv[1]
API = os.path.join(W, 'apps/api')
ONLY = set(sys.argv[2:])
ENV = dict(os.environ, TEST_DATABASE_URL='postgresql://makeup:makeup_local@localhost:5432/makeup_test_cham2')

S = 'src/'
M = [
  # ---------- MODULE TỆP (thợ B) ----------
  ('F1', 'tệp', 'raw.ts bỏ header CSP sandbox khi phát tệp', S+'modules/files/raw.ts',
   """    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");\n""", '', ['test/files.test.ts']),
  ('F2', 'tệp', 'bỏ chặn ảnh quá 20000 điểm ảnh mỗi cạnh', S+'modules/files/service.ts',
   'if (size.width > MAX_IMAGE_SIDE || size.height > MAX_IMAGE_SIDE) {', 'if (false) {', ['test/files.test.ts']),
  ('F3', 'tệp', 'xoá tệp không ghi nhật ký', S+'modules/files/routes.ts',
   "await writeAudit(tx, {\n          organizationId: o.id,\n          actorUserId: mustUser(userId),\n          action: 'file.deleted',",
   "void ({\n          organizationId: o.id,\n          actorUserId: mustUser(userId),\n          action: 'file.deleted',", ['test/files.test.ts']),
  ('F4', 'tệp', 'bỏ làm sạch tên tệp (giữ / \\ và ký tự điều khiển)', S+'modules/files/routes.ts',
   r""".transform((s) => s.replace(/[\u0000-\u001f\u007f/\\]/g, '_'));""", '.transform((s) => s);', ['test/files.test.ts']),
  ('F5', 'tệp', 'đường raw không kiểm Content-Type theo bản ghi (phát mọi tệp dạng text/html)', S+'modules/files/raw.ts',
   "res.setHeader('Content-Type', file.mimeType);", "res.setHeader('Content-Type', 'text/html');", ['test/files.test.ts']),
  ('F6', 'tệp', 'xem thông tin tệp tra theo id, quên lọc tổ chức', S+'modules/files/routes.ts',
   "where: { id: params.fileId, organizationId: o.id, status: { not: 'DELETED' } },\n      });\n      if (!file) throw new AppError('NOT_FOUND', 'Không tìm thấy tệp');\n      return { body: await presentFile(file) };",
   "where: { id: params.fileId, status: { not: 'DELETED' } },\n      });\n      if (!file) throw new AppError('NOT_FOUND', 'Không tìm thấy tệp');\n      return { body: await presentFile(file) };",
   ['test/files.test.ts', 'test/tenant-isolation.test.ts']),
  ('F0', 'tệp', '(đối chứng) phát cả tệp đã xoá', S+'modules/files/raw.ts',
   "if (!file || file.status !== 'READY')", 'if (!file)', ['test/files.test.ts']),

  # ---------- THU TIỀN (thợ G) ----------
  ('P1', 'thu tiền', 'bỏ khoá dòng hợp đồng (FOR UPDATE) khi ghi/huỷ phiếu', S+'modules/payments/common.ts',
   'AND organization_id = ${orgId}::uuid FOR UPDATE`;', 'AND organization_id = ${orgId}::uuid`;', ['test/payments.test.ts']),
  ('P2', 'thu tiền', 'báo cáo theo tháng cộng cả phiếu đã huỷ', S+'modules/payments/reports.ts',
   'WHERE organization_id = ${orgId}::uuid AND voided_at IS NULL\n      AND received_at', 'WHERE organization_id = ${orgId}::uuid\n      AND received_at', ['test/payments.test.ts']),
  ('P3', 'thu tiền', 'tháng báo cáo theo giờ UTC thay vì giờ VN', S+'modules/payments/reports.ts',
   "const VN_TZ = 'Asia/Ho_Chi_Minh';\nconst VN_OFFSET_MS = 7 * 60 * 60 * 1000;", "const VN_TZ = 'UTC';\nconst VN_OFFSET_MS = 0;", ['test/payments.test.ts']),
  ('P4', 'thu tiền', 'tổng sổ thu cộng cả phiếu đã huỷ', S+'modules/payments/routes.ts',
   "where: { ...where, voidedAt: null }", "where: { ...where }", ['test/payments.test.ts']),
  ('P5', 'thu tiền', 'cho thu vượt tổng 1 đồng không cần allowOverpay', S+'modules/payments/routes.ts',
   'if (overBy > 0 && !body.allowOverpay) {', 'if (overBy > 1 && !body.allowOverpay) {', ['test/payments.test.ts']),
  ('P6', 'thu tiền', 'nhật ký ghi phiếu mất trước → sau', S+'modules/payments/routes.ts',
   "            before: { paid: before.paid, remaining: before.remaining },\n            after: { paid: after.paid, remaining: after.remaining },\n          },\n          requestId,\n        });\n        return { ...presentPayment(p), contract",
   "          },\n          requestId,\n        });\n        return { ...presentPayment(p), contract", ['test/payments.test.ts']),
  ('P7', 'thu tiền', 'doanh số tính cả hợp đồng đã huỷ', S+'modules/payments/reports.ts',
   "WHERE c.organization_id = ${orgId}::uuid AND c.status IN ('CONFIRMED', 'COMPLETED')\n        AND c.confirmed_at >= ${from}::timestamptz AND c.confirmed_at < ${to}::timestamptz\n    ), paid AS",
   "WHERE c.organization_id = ${orgId}::uuid AND c.status IN ('CONFIRMED', 'COMPLETED', 'CANCELLED')\n        AND c.confirmed_at >= ${from}::timestamptz AND c.confirmed_at < ${to}::timestamptz\n    ), paid AS", ['test/payments.test.ts']),
  ('P8', 'thu tiền', 'tiến độ thu tiền tra hợp đồng theo id, quên lọc tổ chức', S+'modules/payments/common.ts',
   "const contract = await db.contract.findFirst({\n    where: { id: contractId, organizationId: orgId },",
   "const contract = await db.contract.findFirst({\n    where: { id: contractId },", ['test/payments.test.ts', 'test/tenant-isolation.test.ts']),
  ('P0', 'thu tiền', '(đối chứng) bỏ chặn ngày thu ở tương lai', S+'modules/payments/routes.ts',
   'if (receivedAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {', 'if (false) {', ['test/payments.test.ts']),

  # ---------- NỀN TẢNG + HẠN MỨC (thợ H) ----------
  ('Q1', 'nền tảng', 'đếm nhân sự gồm cả người đã rời tổ chức', S+'lib/quota.ts',
   "where: { organizationId: orgId, status: { in: ['ACTIVE', 'SUSPENDED'] } }", "where: { organizationId: orgId }", ['test/quota.test.ts', 'test/platform.test.ts']),
  ('Q2', 'nền tảng', 'đếm dung lượng gồm cả tệp đã xoá', S+'lib/quota.ts',
   "where: { organizationId: orgId, status: { not: 'DELETED' } },\n        _sum", "where: { organizationId: orgId },\n        _sum", ['test/quota.test.ts', 'test/platform.test.ts']),
  ('Q3', 'nền tảng', 'đầu tháng tính theo UTC thay vì múi giờ tổ chức', S+'lib/quota.ts',
   "date_trunc('month', ${now}::timestamptz AT TIME ZONE o.timezone) AT TIME ZONE o.timezone", "date_trunc('month', ${now}::timestamptz)", ['test/quota.test.ts', 'test/platform.test.ts']),
  ('Q4', 'nền tảng', 'tạm khoá/mở khoá tổ chức không ghi nhật ký', S+'modules/platform/routes.ts',
   "await writeAudit(tx, {\n          organizationId: before.id,", "void ({\n          organizationId: before.id,", ['test/platform.test.ts']),
  ('Q5', 'nền tảng', 'tìm kiếm không thoát ký tự đại diện % _', S+'modules/platform/routes.ts',
   "return `%${q.replace(/[\\\\%_]/g, (c) => `\\\\${c}`)}%`;", "return `%${q}%`;", ['test/platform.test.ts']),
  ('Q6', 'nền tảng', 'sửa gói không ghi giá trị cũ vào nhật ký', S+'modules/platform/routes.ts',
   "data: { before: presentPlan(before), after: body } as unknown as Prisma.InputJsonValue,", "data: { after: body } as unknown as Prisma.InputJsonValue,", ['test/platform.test.ts']),
  ('Q0', 'nền tảng', '(đối chứng) bỏ khoá tư vấn khi kiểm hạn mức', S+'lib/quota.ts',
   "  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`quota:${kind}:${orgId}`}))::text`;\n", '', ['test/quota.test.ts']),

  # ---------- HỒ SƠ THƯƠNG HIỆU (thợ A) ----------
  ('A1', 'hồ sơ', 'trang công khai vẫn ký URL cho ảnh đã xoá', S+'modules/profile/images.ts',
   "where: { id: { in: wanted }, organizationId, status: 'READY', deletedAt: null },", "where: { id: { in: wanted }, organizationId },", ['test/profile.test.ts']),
  ('A2', 'hồ sơ', 'gỡ trang không ghi nhật ký', S+'modules/profile/routes.ts',
   "await writeAudit(tx, {\n          organizationId: o.id,\n          actorUserId: mustUser(userId),\n          action: 'profile.unpublished',",
   "void ({\n          organizationId: o.id,\n          actorUserId: mustUser(userId),\n          action: 'profile.unpublished',", ['test/profile.test.ts']),
  ('A3', 'hồ sơ', 'nhật ký sửa hồ sơ mất giá trị cũ', S+'modules/profile/routes.ts',
   "data: { before: before ? auditValues(before) : null, after: auditValues(after) },", "data: { before: null, after: auditValues(after) },", ['test/profile.test.ts']),
  ('A4', 'hồ sơ', 'gói công khai hiện cả dịch vụ đã ngừng trong mục "gồm"', S+'modules/profile/public.ts',
   "              where: { service: { isActive: true } },\n", '', ['test/profile.test.ts']),
  ('A5', 'hồ sơ', 'ảnh hồ sơ kiểm tệp theo id, quên lọc tổ chức', S+'modules/profile/images.ts',
   "where: { id: fileId, organizationId },", "where: { id: fileId },", ['test/profile.test.ts', 'test/tenant-isolation.test.ts']),
  ('A6', 'hồ sơ', 'nhân vật (subject) đã ẩn vẫn hiện trên trang', S+'modules/profile/public.ts',
   "where: { organizationId: orgId, isActive: true },\n          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],\n          select: { id: true, name: true },",
   "where: { organizationId: orgId },\n          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],\n          select: { id: true, name: true },", ['test/profile.test.ts']),
  ('A0', 'hồ sơ', '(đối chứng) trang công khai lộ priceVersionId', S+'modules/profile/public.ts',
   "return v ? { listPrice: v.listPrice, salePrice: v.salePrice, unitPrice: v.unitPrice } : null;", "return v;", ['test/profile.test.ts']),
]

def run(files):
  files = os.environ['TESTS'].split(',') if os.environ.get('TESTS') else files
  p = subprocess.run(['npx', 'vitest', 'run', *files], cwd=API, env=ENV, capture_output=True, text=True, timeout=900)
  out = p.stdout + p.stderr
  m = re.search(r'Tests\s+(?:(\d+) failed \| )?(\d+) passed', out)
  failed = int(m.group(1) or 0) if m else -1
  passed = int(m.group(2)) if m else -1
  names = re.findall(r'FAIL\s+(test\S*/\S+ > .+)', out)
  gate = re.findall(r'\[cửa gác\] (\w+): (\d+)/(\d+)', out)
  gate_red = [f'{k} {a}/{b}' for k, a, b in gate if a != b]
  return failed, passed, sorted(set(names)), gate_red, out

results = []
for (mid, mod, desc, rel, old, new, files) in M:
  if ONLY and mid not in ONLY:
    continue
  path = os.path.join(API, rel)
  src = open(path, encoding='utf8').read()
  n = src.count(old)
  if n != 1:
    results.append({'id': mid, 'module': mod, 'desc': desc, 'error': f'mẫu xuất hiện {n} lần'}); print(mid, 'LỖI MẪU', n, flush=True); continue
  shutil.copy(path, path + '.goc')
  try:
    open(path, 'w', encoding='utf8').write(src.replace(old, new))
    failed, passed, names, gate_red, out = run(files)
  finally:
    shutil.move(path + '.goc', path)
  r = {'id': mid, 'module': mod, 'desc': desc, 'file': rel, 'tests': files, 'failed': failed, 'passed': passed, 'red': failed > 0, 'failNames': names[:6], 'gateRed': gate_red}
  if failed < 0:
    r['tail'] = out[-1500:]
  results.append(r)
  print(json.dumps(r, ensure_ascii=False), flush=True)

json.dump(results, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'log', os.environ.get('OUT', 'pha-chot.json')), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
