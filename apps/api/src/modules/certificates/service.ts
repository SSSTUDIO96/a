// Nghiệp vụ giấy chứng nhận (BAN-VE-F mục 4). Mọi tra cứu theo (id, tổ chức): mã của tổ chức khác trả đúng lỗi như mã bịa.
// Mọi thay đổi ghi nhật ký trong CÙNG transaction. Database là lưới cuối (CHECK, chỉ mục một phần, 3 trigger của
// migration 20261019210000): máy chủ kiểm TRƯỚC, dưới khoá dòng, để người dùng nhận lời tiếng Việt rõ ràng (409/400)
// chứ không phải lời chung của ràng buộc.
//
// Thứ tự khoá (mục 2.5, chống khoá chết): dòng lớp → dòng giấy chứng nhận → dòng bộ đếm org_counters.
import { Prisma } from '@prisma/client';
import {
  CERTIFICATE_TEMPLATES,
  CERTIFICATE_YEAR_MAX,
  CERTIFICATE_YEAR_MIN,
  DEFAULT_SIGNER_TITLE,
  certificateCode,
  certificateCounterKey,
  isCertificateTemplateCode,
  type Permission,
} from '@makeup/shared';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { fieldError, lockClass, type Actor } from '../courses/service';
import { dateFromWire, dateToWire, todayIn, type ClassRow } from '../courses/present';
import { throwIfIssues, type FieldIssue } from '../designs/data';
import {
  certificateSelect,
  imageOnly,
  presentCertificate,
  presentCertificates,
  signFiles,
  viDate,
  type CertificateRow,
  type CertificateView,
} from './present';
import type { IssueInput, RegisterInput, ReissueInput, RevokeInput } from './schemas';

type Tx = Prisma.TransactionClient;

export interface Viewer {
  permissions: ReadonlySet<Permission>;
}

// ---------- Lỗi ----------

export const NOT_IN_CLASS_MESSAGE = 'Không tìm thấy học viên này trong lớp';
export const RACE_MESSAGE = 'Vừa có người cấp cho học viên này — tải lại danh sách';

const notFoundCertificate = () => new AppError('NOT_FOUND', 'Không tìm thấy giấy chứng nhận');
const notFoundClass = () => new AppError('NOT_FOUND', 'Không tìm thấy lớp');

function classCancelled(): AppError {
  return new AppError('CONFLICT', 'Lớp đã huỷ', { reason: 'CLASS_CANCELLED' });
}

function revokedConflict(message: string, replacedById: string | null): AppError {
  return new AppError('CONFLICT', message, { reason: 'CERTIFICATE_REVOKED', replacedById });
}

// Lưới cuối (bình thường không xảy ra vì đã khoá dòng lớp): trùng chỉ mục một phần certificates_one_issued_per_enrollment /
// certificates_code_issued / certificates_number_key → 409 có lời rõ ràng.
export async function raceGuard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('CONFLICT', RACE_MESSAGE, { reason: 'CERTIFICATE_RACE' });
    }
    throw err;
  }
}

// Năm của ngày cấp phải nằm trong miền CHECK certificates_number (2000–2999); ngoài miền → 400 đúng trường.
function yearOf(wire: string, path: string): number {
  const year = Number(wire.slice(0, 4));
  if (!Number.isInteger(year) || year < CERTIFICATE_YEAR_MIN || year > CERTIFICATE_YEAR_MAX) {
    throw fieldError(path, `Năm ngày cấp phải từ ${CERTIFICATE_YEAR_MIN} đến ${CERTIFICATE_YEAR_MAX}`);
  }
  return year;
}

// ---------- Dữ liệu chụp lúc cấp ----------

interface Snapshot {
  brandName: string;
  logoFileId: string | null;
  signerName: string | null;
  signerTitle: string;
  instructorName: string | null;
  courseName: string;
  className: string;
}

function instructorNameOf(k: Pick<ClassRow, 'instructor'>): string | null {
  if (!k.instructor) return null;
  // Đúng cách hiển thị ở courses/present.ts (displayName ?? fullName); chuỗi trắng → null (CHECK certificates_texts).
  const name = (k.instructor.staffProfile?.displayName ?? k.instructor.user.fullName).trim();
  return name === '' ? null : name;
}

// Tệp ảnh dùng được để chụp: đúng tổ chức, READY, chưa xoá. Trả tập mã dùng được.
async function usableFiles(tx: Tx, orgId: string, ids: (string | null)[]): Promise<Set<string>> {
  const wanted = [...new Set(ids.filter((x): x is string => x !== null))];
  if (wanted.length === 0) return new Set();
  const rows = await tx.storedFile.findMany({
    where: { id: { in: wanted }, organizationId: orgId, status: 'READY', deletedAt: null },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

async function brandOf(db: Tx, orgId: string) {
  const [org, profile] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true } }),
    db.organizationProfile.findUnique({
      where: { organizationId: orgId },
      select: { brandName: true, logoFileId: true, certSignerName: true, certSignerTitle: true },
    }),
  ]);
  const brandName = profile?.brandName.trim() ? profile.brandName.trim() : org.name.trim();
  return {
    brandName,
    logoFileId: profile?.logoFileId ?? null,
    signerName: profile?.certSignerName ?? null,
    signerTitle: profile?.certSignerTitle ?? DEFAULT_SIGNER_TITLE,
  };
}

async function snapshotOf(tx: Tx, orgId: string, k: ClassRow): Promise<Snapshot> {
  const brand = await brandOf(tx, orgId);
  const course = await tx.course.findFirst({ where: { id: k.courseId, organizationId: orgId }, select: { name: true } });
  if (!course) throw new Error(`Lớp ${k.id} trỏ khoá ${k.courseId} không thuộc tổ chức — dữ liệu lệch`);
  const logoOk = (await usableFiles(tx, orgId, [brand.logoFileId])).has(brand.logoFileId ?? '');
  return {
    brandName: brand.brandName,
    logoFileId: logoOk ? brand.logoFileId : null,
    signerName: brand.signerName,
    signerTitle: brand.signerTitle,
    instructorName: instructorNameOf(k),
    courseName: course.name,
    className: k.name,
  };
}

// ---------- Tiền đã thu / nợ (đúng luật listEnrollments ở courses/service.ts) ----------

async function paidByContract(db: Tx, orgId: string, contractIds: string[]): Promise<Map<string, bigint>> {
  const paid = new Map<string, bigint>();
  if (contractIds.length === 0) return paid;
  const sums = await db.payment.groupBy({
    by: ['contractId', 'kind'],
    where: { organizationId: orgId, contractId: { in: [...new Set(contractIds)] }, voidedAt: null },
    _sum: { amount: true },
  });
  for (const s of sums) {
    const amount = s._sum.amount ?? 0n;
    paid.set(s.contractId, (paid.get(s.contractId) ?? 0n) + (s.kind === 'RECEIPT' ? amount : -amount));
  }
  return paid;
}

const debtOf = (total: bigint, paid: bigint): bigint => (total > paid ? total - paid : 0n);

export function moneyVisible(v: Viewer): boolean {
  return v.permissions.has('contracts.read') || v.permissions.has('payments.read');
}

// ---------- Đọc bản theo mã ----------

async function readRows(db: Tx, orgId: string, ids: string[]): Promise<CertificateRow[]> {
  if (ids.length === 0) return [];
  const rows = await db.certificate.findMany({ where: { organizationId: orgId, id: { in: ids } }, select: certificateSelect });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => {
    const r = byId.get(id);
    if (!r) throw new Error(`Không đọc lại được giấy chứng nhận ${id} vừa ghi`);
    return r;
  });
}

export async function getCertificate(db: Tx, orgId: string, id: string): Promise<CertificateView> {
  const row = await db.certificate.findFirst({ where: { id, organizationId: orgId }, select: certificateSelect });
  if (!row) throw notFoundCertificate();
  return presentCertificate(row, await signFiles(db, orgId, [row.photoFileId, row.logoFileId, row.backgroundFileId]));
}

// ---------- Đường 1: danh sách cấp của lớp ----------

export async function classRoster(db: Tx, orgId: string, classId: string, viewer: Viewer, timezone: string, issuedOnQuery?: string) {
  const k = await db.courseClass.findFirst({
    where: { id: classId, organizationId: orgId },
    select: {
      id: true,
      courseId: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
      instructor: { select: { id: true, user: { select: { fullName: true } }, staffProfile: { select: { displayName: true } } } },
      course: { select: { id: true, name: true, mode: true } },
    },
  });
  if (!k) throw notFoundClass();
  const today = todayIn(timezone);
  const endDate = dateToWire(k.endDate);
  const ended = k.status !== 'CANCELLED' && endDate <= today;
  const defaultIssuedOn = ended ? endDate : null;

  const enrollments = await db.enrollment.findMany({
    where: { organizationId: orgId, courseClassId: classId, status: 'ACTIVE' },
    select: {
      id: true,
      enrolledAt: true,
      customer: { select: { id: true, fullName: true, avatarFileId: true } },
      contract: { select: { id: true, code: true, total: true } },
    },
    orderBy: [{ enrolledAt: 'asc' }, { id: 'asc' }],
  });
  const certRows = enrollments.length
    ? await db.certificate.findMany({
        where: { organizationId: orgId, courseClassId: classId, enrollmentId: { in: enrollments.map((e) => e.id) } },
        select: certificateSelect,
        orderBy: [{ createdAt: 'desc' }, { reissueNo: 'desc' }],
      })
    : [];
  const issued = new Map<string, CertificateRow>();
  const lastRevoked = new Map<string, CertificateRow>();
  for (const c of certRows) {
    if (c.status === 'ISSUED') issued.set(c.enrollmentId, c);
    else if (!lastRevoked.has(c.enrollmentId)) lastRevoked.set(c.enrollmentId, c);
  }

  const showMoney = moneyVisible(viewer);
  const paid = showMoney ? await paidByContract(db, orgId, enrollments.map((e) => e.contract.id)) : new Map<string, bigint>();
  const brand = await brandOf(db, orgId);
  const sign = await signFiles(db, orgId, [
    brand.logoFileId,
    ...enrollments.map((e) => e.customer.avatarFileId),
    ...[...issued.values()].flatMap((c) => [c.photoFileId, c.logoFileId, c.backgroundFileId]),
  ]);

  let nextNumber: { year: number; seq: number; code: string } | null = null;
  if (ended) {
    const basis = issuedOnQuery ?? endDate;
    const year = yearOf(basis, 'issuedOn');
    const counter = await db.orgCounter.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: certificateCounterKey(year) } },
      select: { value: true },
    });
    const seq = (counter?.value ?? 0) + 1;
    nextNumber = { year, seq, code: certificateCode(year, seq) };
  }

  return {
    class: {
      id: k.id,
      name: k.name,
      courseId: k.course.id,
      courseName: k.course.name,
      courseMode: k.course.mode,
      startDate: dateToWire(k.startDate),
      endDate,
      status: k.status,
      instructorName: instructorNameOf(k),
    },
    today,
    ended,
    defaultIssuedOn,
    brandName: brand.brandName,
    logo: imageOnly(sign(brand.logoFileId)),
    signer: { name: brand.signerName, title: brand.signerTitle },
    nextNumber,
    moneyVisible: showMoney,
    items: enrollments.map((e) => {
      const cert = issued.get(e.id) ?? null;
      const revoked = cert ? null : (lastRevoked.get(e.id) ?? null);
      const p = paid.get(e.contract.id) ?? 0n;
      return {
        enrollmentId: e.id,
        enrolledAt: e.enrolledAt.toISOString(),
        customer: { id: e.customer.id, fullName: e.customer.fullName, photo: sign(e.customer.avatarFileId) },
        contract: {
          id: e.contract.id,
          code: e.contract.code,
          total: showMoney ? Number(e.contract.total) : null,
          paid: showMoney ? Number(p) : null,
          debt: showMoney ? Number(debtOf(e.contract.total, p)) : null,
        },
        certificate: cert ? presentCertificate(cert, sign) : null,
        lastRevoked:
          revoked && revoked.revokedAt && revoked.revokeReason !== null
            ? { id: revoked.id, code: revoked.code, revokedAt: revoked.revokedAt.toISOString(), revokeReason: revoked.revokeReason }
            : null,
      };
    }),
  };
}

// ---------- Đường 2: cấp hàng loạt ----------

async function nextSeq(tx: Tx, orgId: string, year: number): Promise<number> {
  const key = certificateCounterKey(year);
  // Khoá dòng bộ đếm: hai lệnh cấp đồng thời (kể cả hai lớp khác nhau) xếp hàng ở đây, không trùng số.
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO org_counters (organization_id, key, value) VALUES (${orgId}::uuid, ${key}, 1)
    ON CONFLICT (organization_id, key) DO UPDATE SET value = org_counters.value + 1
    RETURNING value`;
  const value = rows[0]?.value;
  if (value === undefined) throw new Error('Bộ đếm số giấy chứng nhận không trả giá trị');
  return value;
}

export async function issueCertificates(tx: Tx, actor: Actor, viewer: Viewer, classId: string, body: IssueInput, timezone: string) {
  const orgId = actor.orgId;
  // 1. Khoá dòng lớp trước: hai lệnh cấp cùng lớp xếp hàng, lệnh sau thấy bản lệnh trước đã cấp.
  const k = await lockClass(tx, orgId, classId);
  if (k.status === 'CANCELLED') throw classCancelled();
  const today = todayIn(timezone);
  const endDate = dateToWire(k.endDate);
  if (endDate > today) {
    throw new AppError('CONFLICT', `Lớp kết thúc ngày ${viDate(endDate)} — cấp được từ ngày đó`, { reason: 'CLASS_NOT_ENDED', endDate });
  }
  if (body.issuedOn < endDate) throw fieldError('issuedOn', `Ngày cấp phải từ ngày kết thúc lớp (${viDate(endDate)}) trở đi`);
  if (body.issuedOn > today) throw fieldError('issuedOn', 'Ngày cấp không được sau hôm nay');
  const year = yearOf(body.issuedOn, 'issuedOn');

  // 2. Ghi danh: CHỈ của lớp này trong tổ chức này. Không thấy (mã bịa, lớp khác, tổ chức khác) → cùng một lời.
  const found = await tx.enrollment.findMany({
    where: { id: { in: body.enrollmentIds }, organizationId: orgId, courseClassId: classId },
    select: {
      id: true,
      status: true,
      enrolledAt: true,
      customerId: true,
      customer: { select: { id: true, fullName: true, avatarFileId: true } },
      contract: { select: { id: true, code: true, total: true } },
    },
  });
  const byId = new Map(found.map((e) => [e.id, e]));
  const issues: FieldIssue[] = [];
  body.enrollmentIds.forEach((id, i) => {
    const e = byId.get(id);
    if (!e) issues.push({ path: `enrollmentIds.${i}`, message: NOT_IN_CLASS_MESSAGE });
    else if (e.status !== 'ACTIVE') issues.push({ path: `enrollmentIds.${i}`, message: `Học viên ${e.customer.fullName} đã huỷ ghi danh` });
  });
  throwIfIssues(issues);

  // 3. Thứ tự danh sách lớp (enrolledAt, id), KHÔNG theo thứ tự gửi lên — số tăng theo thứ tự ghi danh.
  const ordered = [...found].sort((a, b) => a.enrolledAt.getTime() - b.enrolledAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const existing = await tx.certificate.findMany({
    where: { organizationId: orgId, enrollmentId: { in: ordered.map((e) => e.id) }, status: 'ISSUED' },
    select: { id: true, enrollmentId: true },
  });
  const existingByEnrollment = new Map(existing.map((c) => [c.enrollmentId, c.id]));
  const fresh = ordered.filter((e) => !existingByEnrollment.has(e.id));

  const snap = fresh.length ? await snapshotOf(tx, orgId, k) : null;
  const photos = await usableFiles(tx, orgId, fresh.map((e) => e.customer.avatarFileId));
  const paid = await paidByContract(tx, orgId, fresh.map((e) => e.contract.id));
  const showMoney = moneyVisible(viewer);
  const templateCode = body.templateCode;
  const templateVersion = CERTIFICATE_TEMPLATES[templateCode].version;
  const issuedOn = dateFromWire(body.issuedOn);

  const idsInOrder: string[] = [];
  const debtWarnings: { enrollmentId: string; customerName: string; contractCode: string; debt: number | null }[] = [];
  let issuedCount = 0;
  for (const e of ordered) {
    const already = existingByEnrollment.get(e.id);
    if (already) {
      idsInOrder.push(already);
      continue;
    }
    if (!snap) throw new Error('Thiếu dữ liệu chụp lúc cấp');
    const seq = await nextSeq(tx, orgId, year);
    const code = certificateCode(year, seq);
    const avatar = e.customer.avatarFileId;
    const created = await tx.certificate.create({
      data: {
        organizationId: orgId,
        enrollmentId: e.id,
        courseClassId: classId,
        customerId: e.customerId,
        year,
        seq,
        reissueNo: 0,
        code,
        issuedOn,
        templateCode,
        templateVersion,
        fontOverride: body.fontOverride ?? null,
        // CHỜ BẢN VẼ NỀN: đợt này luôn null.
        backgroundStyle: null,
        backgroundFileId: null,
        frameStyle: null,
        studentName: e.customer.fullName,
        courseName: snap.courseName,
        className: snap.className,
        instructorName: snap.instructorName,
        signerName: snap.signerName,
        signerTitle: snap.signerTitle,
        brandName: snap.brandName,
        photoFileId: avatar && photos.has(avatar) ? avatar : null,
        logoFileId: snap.logoFileId,
        issuedById: actor.userId,
      },
      select: { id: true },
    });
    const debt = debtOf(e.contract.total, paid.get(e.contract.id) ?? 0n);
    await writeAudit(tx, {
      organizationId: orgId,
      actorUserId: actor.userId,
      action: 'certificate.issued',
      entityType: 'certificate',
      entityId: created.id,
      data: {
        code,
        enrollmentId: e.id,
        customerId: e.customerId,
        classId,
        templateCode,
        issuedOn: body.issuedOn,
        // Chỉ để lưu vết: nợ KHÔNG chặn cấp.
        debtAtIssue: Number(debt),
      },
      requestId: actor.requestId,
    });
    if (debt > 0n) {
      debtWarnings.push({ enrollmentId: e.id, customerName: e.customer.fullName, contractCode: e.contract.code, debt: showMoney ? Number(debt) : null });
    }
    issuedCount++;
    idsInOrder.push(created.id);
  }
  const items = await presentCertificates(tx, orgId, await readRows(tx, orgId, idsInOrder));
  return { items, issuedCount, existingCount: ordered.length - issuedCount, debtWarnings };
}

// ---------- Khoá một bản (cấp lại, thu hồi) ----------

// Tra bản theo (id, tổ chức), rồi khoá theo thứ tự: dòng lớp của bản đó → dòng bản đó.
async function lockCertificate(tx: Tx, orgId: string, id: string) {
  const head = await tx.certificate.findFirst({ where: { id, organizationId: orgId }, select: { courseClassId: true } });
  if (!head) throw notFoundCertificate();
  const k = await lockClass(tx, orgId, head.courseClassId);
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM certificates WHERE id = ${id}::uuid AND organization_id = ${orgId}::uuid FOR UPDATE`;
  if (locked.length === 0) throw notFoundCertificate();
  const row = await tx.certificate.findFirst({
    where: { id, organizationId: orgId },
    select: {
      ...certificateSelect,
      enrollment: { select: { status: true } },
      customer: { select: { id: true, fullName: true, avatarFileId: true } },
    },
  });
  if (!row) throw notFoundCertificate();
  return { k, row };
}

async function revokeRow(tx: Tx, actor: Actor, id: string, reason: string) {
  await tx.certificate.update({
    where: { id_organizationId: { id, organizationId: actor.orgId } },
    data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: reason, revokedById: actor.userId },
    select: { id: true },
  });
}

// ---------- Đường 5: cấp lại (giữ số) ----------

export async function reissueCertificate(tx: Tx, actor: Actor, id: string, body: ReissueInput, timezone: string): Promise<CertificateView> {
  const orgId = actor.orgId;
  const { k, row: old } = await lockCertificate(tx, orgId, id);
  if (old.status !== 'ISSUED') {
    throw revokedConflict('Bản này đã thu hồi — cấp lại từ bản đang hiệu lực', old.replacedBy[0]?.id ?? null);
  }
  // Trigger certificates_insert_guard đòi ghi danh ACTIVE và lớp chưa huỷ CẢ với bản cấp lại (việc tồn 69): kiểm trước,
  // trả lời rõ ràng thay vì lời chung của ràng buộc.
  if (old.enrollment.status !== 'ACTIVE') {
    throw new AppError('CONFLICT', 'Học viên đã huỷ ghi danh — không cấp lại được', { reason: 'ENROLLMENT_CANCELLED' });
  }
  if (k.status === 'CANCELLED') {
    throw new AppError('CONFLICT', 'Lớp đã huỷ — không cấp lại được', { reason: 'CLASS_CANCELLED' });
  }
  const issuedOn = dateToWire(old.issuedOn);
  const endDate = dateToWire(k.endDate);
  // Trigger cũng đòi ngày cấp (giữ nguyên khi cấp lại) ≥ ngày kết thúc HIỆN HÀNH của lớp: lớp bị dời ngày kết thúc
  // sau ngày cấp thì không cấp lại giữ số được.
  if (issuedOn < endDate) {
    throw new AppError(
      'CONFLICT',
      `Lớp đã dời ngày kết thúc sang ${viDate(endDate)}, sau ngày cấp ${viDate(issuedOn)} — không cấp lại được`,
      { reason: 'CLASS_END_AFTER_ISSUE', endDate, issuedOn },
    );
  }
  const today = todayIn(timezone);
  if (today < issuedOn) {
    throw new AppError('CONFLICT', `Hôm nay (${viDate(today)}) còn trước ngày cấp ${viDate(issuedOn)} — chưa cấp lại được`, { reason: 'REISSUE_BEFORE_ISSUE' });
  }

  let templateCode: string;
  if (body.templateCode !== undefined) templateCode = body.templateCode;
  else if (isCertificateTemplateCode(old.templateCode)) templateCode = old.templateCode;
  else throw fieldError('templateCode', 'Mẫu cũ không còn trong danh mục — chọn mẫu khác');
  if (!isCertificateTemplateCode(templateCode)) throw fieldError('templateCode', 'Không có mẫu giấy chứng nhận này');
  const fontOverride = body.fontOverride !== undefined ? body.fontOverride : old.fontOverride;
  const studentName = body.studentName ?? old.customer.fullName;
  const snap = await snapshotOf(tx, orgId, k);
  const avatar = old.customer.avatarFileId;
  const photoOk = (await usableFiles(tx, orgId, [avatar])).has(avatar ?? '');

  await revokeRow(tx, actor, old.id, body.reason);
  await writeAudit(tx, {
    organizationId: orgId,
    actorUserId: actor.userId,
    action: 'certificate.revoked',
    entityType: 'certificate',
    entityId: old.id,
    data: { code: old.code, reissueNo: old.reissueNo, reason: body.reason, via: 'reissue' },
    requestId: actor.requestId,
  });
  const created = await tx.certificate.create({
    data: {
      organizationId: orgId,
      enrollmentId: old.enrollmentId,
      courseClassId: old.courseClassId,
      customerId: old.customerId,
      // GIỮ SỐ: cùng năm, cùng seq, cùng mã, cùng ngày cấp.
      year: old.year,
      seq: old.seq,
      code: old.code,
      issuedOn: old.issuedOn,
      reissueNo: old.reissueNo + 1,
      reissuedOn: dateFromWire(today),
      replacesId: old.id,
      templateCode,
      templateVersion: CERTIFICATE_TEMPLATES[templateCode].version,
      fontOverride,
      backgroundStyle: null,
      backgroundFileId: null,
      frameStyle: null,
      studentName,
      courseName: snap.courseName,
      className: snap.className,
      instructorName: snap.instructorName,
      signerName: snap.signerName,
      signerTitle: snap.signerTitle,
      brandName: snap.brandName,
      photoFileId: photoOk ? avatar : null,
      logoFileId: snap.logoFileId,
      issuedById: actor.userId,
    },
    select: { id: true },
  });
  await writeAudit(tx, {
    organizationId: orgId,
    actorUserId: actor.userId,
    action: 'certificate.reissued',
    entityType: 'certificate',
    entityId: created.id,
    data: {
      code: old.code,
      replacesId: old.id,
      reissueNo: old.reissueNo + 1,
      reason: body.reason,
      studentNameBefore: old.studentName,
      studentNameAfter: studentName,
      templateBefore: old.templateCode,
      templateAfter: templateCode,
    },
    requestId: actor.requestId,
  });
  const [view] = await presentCertificates(tx, orgId, await readRows(tx, orgId, [created.id]));
  if (!view) throw new Error('Không đọc lại được bản cấp lại');
  return view;
}

// ---------- Đường 6: thu hồi ----------

export async function revokeCertificate(tx: Tx, actor: Actor, id: string, body: RevokeInput): Promise<CertificateView> {
  const orgId = actor.orgId;
  const { row: old } = await lockCertificate(tx, orgId, id);
  if (old.status !== 'ISSUED') throw revokedConflict('Bản này đã thu hồi', old.replacedBy[0]?.id ?? null);
  await revokeRow(tx, actor, old.id, body.reason);
  await writeAudit(tx, {
    organizationId: orgId,
    actorUserId: actor.userId,
    action: 'certificate.revoked',
    entityType: 'certificate',
    entityId: old.id,
    data: { code: old.code, reissueNo: old.reissueNo, reason: body.reason, enrollmentId: old.enrollmentId },
    requestId: actor.requestId,
  });
  const [view] = await presentCertificates(tx, orgId, await readRows(tx, orgId, [old.id]));
  if (!view) throw new Error('Không đọc lại được bản vừa thu hồi');
  return view;
}

// ---------- Đường 3: sổ ----------

export async function listRegister(db: Tx, orgId: string, q: RegisterInput) {
  if (!orgId) throw new Error('listRegister: thiếu organizationId');
  const search = q.q?.trim();
  const where: Prisma.CertificateWhereInput = {
    organizationId: orgId,
    ...(q.year !== undefined ? { year: q.year } : {}),
    ...(q.status ? { status: q.status } : {}),
    // Mã lớp / học viên của tổ chức khác: điều kiện tổ chức ở trên làm danh sách RỖNG — giống mã bịa.
    ...(q.classId ? { courseClassId: q.classId } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.ids ? { id: { in: q.ids } } : {}),
    ...(search
      ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { studentName: { contains: search, mode: 'insensitive' } }] }
      : {}),
  };
  const [total, rows, years] = await Promise.all([
    db.certificate.count({ where }),
    db.certificate.findMany({
      where,
      select: certificateSelect,
      orderBy: [{ year: 'desc' }, { seq: 'desc' }, { reissueNo: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    db.certificate.findMany({ where: { organizationId: orgId }, distinct: ['year'], select: { year: true }, orderBy: { year: 'desc' } }),
  ]);
  return {
    items: await presentCertificates(db, orgId, rows),
    page: q.page,
    pageSize: q.pageSize,
    total,
    years: years.map((y) => y.year),
  };
}
