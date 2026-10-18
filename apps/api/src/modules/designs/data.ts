// Dữ liệu cho mẫu thiết kế: giá trị các ô lấy từ hợp đồng / hồ sơ thương hiệu (theo khoá SLOT_SOURCES), bản chụp
// snapshot của thẻ, kiểm mẫu và ảnh, trình bày thẻ kèm URL ký có hạn.
import type { DesignCard, DesignCardPhoto, FilePurpose, Prisma } from '@prisma/client';
import {
  classScheduleLabel,
  findDesignTemplate,
  PHOTO_SLOTS,
  slotsForContract,
  SLOT_SOURCES,
  templateSupportsContract,
  type ContractKindKey,
  type DesignKind,
  type DesignTemplate,
  type SlotKey,
} from '@makeup/shared';
import { AppError } from '../../lib/errors';
import { signedUrlOf } from '../files/service';

type Tx = Prisma.TransactionClient;

// ---------- Lỗi dữ liệu chỉ đúng trường (KY-DUYET-C3 điều chỉnh 1: 400 VALIDATION_FAILED, có details.issues) ----------

export interface FieldIssue {
  path: string;
  message: string;
}

// Gom lỗi theo trường rồi ném MỘT lần: web đặt lỗi đúng ô như lỗi zod (cùng dạng details.issues / fieldErrors).
export function throwIfIssues(issues: FieldIssue[]): void {
  if (issues.length === 0) return;
  const fieldErrors: Record<string, string[]> = {};
  for (const i of issues) {
    const top = i.path.split('.')[0] ?? i.path;
    (fieldErrors[top] ??= []).push(i.message);
  }
  throw new AppError('VALIDATION_FAILED', issues[0]?.message ?? 'Dữ liệu gửi lên không hợp lệ', { formErrors: [], fieldErrors, issues });
}

const KIND_LABEL: Record<DesignKind, string> = { WELCOME: 'chào mừng', FEEDBACK: 'feedback', GREETING: 'lời chúc' };
const CONTRACT_LABEL: Record<ContractKindKey, string> = { COURSE: 'khoá học', SERVICE: 'dịch vụ' };

// Mẫu có trong danh mục, đúng loại thẻ, hợp với loại hợp đồng. Mã lạ → lỗi ở templateCode (không lấy mẫu đầu tiên).
export function checkTemplate(code: string, kind: DesignKind, contractKind: ContractKindKey, issues: FieldIssue[]): DesignTemplate | null {
  const t = findDesignTemplate(code);
  if (!t) {
    issues.push({ path: 'templateCode', message: `Không có mẫu "${code}" trong danh mục mẫu` });
    return null;
  }
  if (t.kind !== kind) {
    issues.push({ path: 'templateCode', message: `Mẫu ${t.code} là mẫu ${KIND_LABEL[t.kind]}, không dùng cho thẻ ${KIND_LABEL[kind]}` });
    return null;
  }
  if (false && !templateSupportsContract(t, contractKind)) {
    const allowed = t.contractKinds.map((k) => CONTRACT_LABEL[k]).join(' hoặc ');
    issues.push({ path: 'templateCode', message: `Mẫu ${t.code} chỉ dùng cho hợp đồng ${allowed}` });
    return null;
  }
  return t;
}

export function checkPhotoCount(t: DesignTemplate, count: number, issues: FieldIssue[]): void {
  const { min, max } = t.photos;
  if (count < min || count > max) {
    const need = min === max ? `đúng ${min}` : `từ ${min} đến ${max}`;
    issues.push({ path: 'photoFileIds', message: `Mẫu ${t.code} cần ${need} ảnh tải lên (đang có ${count})` });
  }
}

// Luật trường theo loại thẻ (khớp CHECK của design_cards; báo sớm bằng lời rõ thay vì để database chặn).
export function checkKindFields(
  kind: DesignKind,
  f: { body: string | null; rating: number | null; receivedAt: string | null },
  issues: FieldIssue[],
): void {
  if (kind === 'FEEDBACK' && !f.body) issues.push({ path: 'body', message: 'Thẻ feedback cần lời khen' });
  if (kind === 'GREETING' && !f.body) issues.push({ path: 'body', message: 'Thẻ lời chúc cần câu chúc' });
  if (kind !== 'FEEDBACK' && f.rating !== null) issues.push({ path: 'rating', message: 'Số sao chỉ dùng cho thẻ feedback' });
  if (kind !== 'FEEDBACK' && f.receivedAt !== null) {
    issues.push({ path: 'receivedAt', message: 'Ngày nhận lời khen chỉ dùng cho thẻ feedback' });
  }
}

export function checkSize(t: DesignTemplate, size: string, issues: FieldIssue[]): void {
  if (!(t.sizes as string[]).includes(size)) issues.push({ path: 'size', message: `Mẫu ${t.code} không có khổ ${size}` });
}

// Tệp ảnh dùng được: cùng tổ chức, đúng mục đích, đã tải xong, chưa xoá.
// Tệp không có và tệp của tổ chức khác trả CÙNG một lời (không lộ tổ chức khác có tệp đó) — sổ lỗi 12.
export async function checkFiles(
  tx: Tx,
  organizationId: string,
  purpose: FilePurpose,
  fileIds: { path: string; id: string }[],
  issues: FieldIssue[],
): Promise<void> {
  if (fileIds.length === 0) return;
  const rows = await tx.storedFile.findMany({
    where: { id: { in: [...new Set(fileIds.map((f) => f.id))] }, organizationId },
    select: { id: true, purpose: true, status: true, deletedAt: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const { path, id } of fileIds) {
    const f = byId.get(id);
    if (!f) issues.push({ path, message: 'Không tìm thấy ảnh trong tổ chức' });
    else if (f.purpose !== purpose) issues.push({ path, message: `Ảnh phải tải lên với mục đích ${purpose}` });
    else if (f.status !== 'READY' || f.deletedAt) issues.push({ path, message: 'Ảnh chưa tải xong hoặc đã xoá' });
  }
}

// ---------- Hợp đồng nguồn ----------

export interface SourceContract {
  id: string;
  code: string;
  kind: ContractKindKey;
  customerId: string;
  // Lớp của các dòng khoá học chưa huỷ, theo thứ tự dòng.
  classIds: string[];
}

export async function loadContract(tx: Tx, organizationId: string, contractId: string): Promise<SourceContract> {
  const c = await tx.contract.findFirst({
    where: { id: contractId, organizationId },
    select: {
      id: true,
      code: true,
      kind: true,
      customerId: true,
      lines: {
        where: { kind: 'COURSE', voidedAt: null, courseClassId: { not: null } },
        select: { courseClassId: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });
  if (!c) throw new AppError('NOT_FOUND', 'Không tìm thấy hợp đồng');
  const classIds = [...new Set(c.lines.map((l) => l.courseClassId).filter((x): x is string => x !== null))];
  return { id: c.id, code: c.code, kind: c.kind, customerId: c.customerId, classIds };
}

// Lớp của thẻ: chỉ hợp đồng khoá học có lớp; lớp phải là lớp của chính hợp đồng (dòng khoá học chưa huỷ).
// Bỏ trống ở hợp đồng khoá học = lớp của dòng đầu tiên. Mã lớp bịa và mã lớp của tổ chức khác trả cùng một lời.
export function resolveClass(c: SourceContract, requested: string | null | undefined, issues: FieldIssue[]): string | null {
  if (c.kind === 'SERVICE') {
    if (requested) issues.push({ path: 'courseClassId', message: 'Hợp đồng dịch vụ không có lớp học' });
    return null;
  }
  if (requested == null) return c.classIds[0] ?? null;
  if (!c.classIds.includes(requested)) {
    issues.push({ path: 'courseClassId', message: 'Lớp này không thuộc hợp đồng' });
    return null;
  }
  return requested;
}

// ---------- Giá trị ô lấy từ dữ liệu (GET /contracts/:id/design-data) ----------

// Các ô chữ lấy từ dữ liệu; ô nào hợp đồng không có thì null.
export const DATA_TEXT_SLOTS = ['th', 'diachi', 'sdt', 'web', 'ten', 'khoa', 'lop', 'ngay', 'nkt', 'lich', 'gv', 'nv', 'goi', 'nsk'] as const;
export type DataTextSlot = (typeof DATA_TEXT_SLOTS)[number];
// Ô phụ thuộc lớp học: đổi lớp của thẻ thì lấy lại.
const CLASS_SLOTS: readonly SlotKey[] = ['diachi', 'khoa', 'lop', 'ngay', 'nkt', 'lich', 'gv'];

export interface DesignData {
  contractKind: ContractKindKey;
  courseClassId: string | null;
  text: Record<DataTextSlot, string | null>;
  // Mã tệp của ô ảnh lấy từ dữ liệu (snapshot lưu MÃ TỆP, không lưu URL ký vì URL hết hạn sau 10 phút).
  logoFileId: string | null;
  anhFileId: string | null;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// Ngày (YYYY-MM-DD) của một thời điểm theo múi giờ tổ chức.
function ymdInZone(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export async function loadDesignData(tx: Tx, organizationId: string, c: SourceContract, courseClassId: string | null): Promise<DesignData> {
  const [org, profile, customer, cls, lines, eventRow] = await Promise.all([
    tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true, timezone: true } }),
    tx.organizationProfile.findUnique({
      where: { organizationId },
      select: { brandName: true, logoFileId: true, address: true, phone: true, website: true },
    }),
    tx.customer.findFirstOrThrow({ where: { id: c.customerId, organizationId }, select: { fullName: true, avatarFileId: true } }),
    courseClassId
      ? tx.courseClass.findFirst({
          where: { id: courseClassId, organizationId },
          select: {
            name: true,
            startDate: true,
            endDate: true,
            weekdays: true,
            startMinute: true,
            endMinute: true,
            course: { select: { name: true } },
            studioLocation: { select: { address: true } },
            instructor: { select: { staffProfile: { select: { displayName: true } }, user: { select: { fullName: true } } } },
          },
        })
      : null,
    c.kind === 'SERVICE'
      ? tx.contractLine.findMany({
          where: { contractId: c.id, organizationId, voidedAt: null },
          select: { kind: true, name: true, subjectName: true, scheduledStart: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        })
      : [],
    tx.contract.findUniqueOrThrow({ where: { id: c.id }, select: { eventDate: true } }),
  ]);

  const text: Record<DataTextSlot, string | null> = {
    th: profile?.brandName.trim() ? profile.brandName : org.name,
    diachi: profile?.address ?? null,
    sdt: profile?.phone ?? null,
    web: profile?.website ?? null,
    ten: customer.fullName,
    khoa: null,
    lop: null,
    ngay: null,
    nkt: null,
    lich: null,
    gv: null,
    nv: null,
    goi: null,
    nsk: null,
  };
  if (c.kind === 'COURSE' && cls) {
    text.khoa = cls.course.name;
    text.lop = cls.name;
    text.ngay = ymd(cls.startDate);
    text.nkt = ymd(cls.endDate);
    text.lich = classScheduleLabel(cls.weekdays, cls.startMinute, cls.endMinute);
    text.gv = cls.instructor ? (cls.instructor.staffProfile?.displayName ?? cls.instructor.user.fullName) : null;
    text.diachi = cls.studioLocation?.address ?? text.diachi;
  }
  if (c.kind === 'SERVICE') {
    const pkg = lines.find((l) => l.kind === 'PACKAGE');
    text.goi = pkg?.name ?? null;
    text.nv = pkg?.subjectName ?? lines.find((l) => l.subjectName)?.subjectName ?? null;
    // Ngày sự kiện: Contract.eventDate; hợp đồng chưa ghi ngày thì lấy giờ hẹn sớm nhất của các dòng.
    const firstStart = lines
      .map((l) => l.scheduledStart)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const when = eventRow.eventDate ?? firstStart ?? null;
    text.nsk = when ? ymdInZone(when, org.timezone) : null;
  }
  return {
    contractKind: c.kind,
    courseClassId: c.kind === 'COURSE' ? courseClassId : null,
    text,
    logoFileId: profile?.logoFileId ?? null,
    anhFileId: customer.avatarFileId,
  };
}

// URL ký có hạn cho nhiều tệp, một câu truy vấn. Tệp chưa sẵn sàng / đã xoá / khác tổ chức → không có trong bảng.
export async function signFiles(db: Tx, organizationId: string, ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  const files = wanted.length
    ? await db.storedFile.findMany({
        where: { id: { in: wanted }, organizationId, status: 'READY', deletedAt: null },
        select: { id: true, storageKey: true },
      })
    : [];
  const out = new Map<string, { url: string; expiresAt: string }>();
  for (const f of files) {
    const s = await signedUrlOf(f);
    out.set(f.id, { url: s.signedUrl, expiresAt: s.signedUrlExpiresAt });
  }
  return (id: string | null | undefined) => (id ? (out.get(id) ?? null) : null);
}

export async function presentDesignData(db: Tx, organizationId: string, d: DesignData) {
  const sign = await signFiles(db, organizationId, [d.logoFileId, d.anhFileId]);
  const logo = sign(d.logoFileId);
  const anh = sign(d.anhFileId);
  return {
    contractKind: d.contractKind,
    courseClassId: d.courseClassId,
    ...d.text,
    logoUrl: logo?.url ?? null,
    anhUrl: anh?.url ?? null,
    // Hạn của URL ký (logoUrl, anhUrl) — 10 phút.
    signedUrlExpiresAt: logo?.expiresAt ?? anh?.expiresAt ?? null,
  };
}

// ---------- Snapshot: giá trị đã điền của thẻ (theo khoá SLOT_SOURCES, chỉ các ô của mẫu) ----------

export type SnapshotValue = string | number | null;
export type Snapshot = Partial<Record<SlotKey, SnapshotValue>>;

const DATA_TEXT_SET: ReadonlySet<string> = new Set(DATA_TEXT_SLOTS);

// Ghi đè của người dùng chỉ nhận ô CHỮ lấy từ dữ liệu, thuộc mẫu đã chọn.
export function checkOverrides(t: DesignTemplate, contractKind: ContractKindKey, overrides: Record<string, string | null> | undefined, issues: FieldIssue[]): void {
  if (!overrides) return;
  const slots = new Set<string>(slotsForContract(t, contractKind));
  for (const k of Object.keys(overrides)) {
    if (!(k in SLOT_SOURCES)) issues.push({ path: `snapshot.${k}`, message: `Không có ô "${k}"` });
    else if (!slots.has(k)) issues.push({ path: `snapshot.${k}`, message: `Mẫu ${t.code} không có ô "${k}" ở hợp đồng ${CONTRACT_LABEL[contractKind]}` });
    else if (!DATA_TEXT_SET.has(k)) {
      issues.push({ path: `snapshot.${k}`, message: `Ô "${k}" lấy từ trường riêng của thẻ (ảnh, lời khen, câu chúc, số sao…), không ghi đè ở snapshot` });
    }
  }
}

export interface CardFields {
  title: string | null;
  body: string | null;
  rating: number | null;
  receivedAt: string | null;
  photoFileIds: string[];
}

// Dựng snapshot: giữ giá trị cũ của ô dữ liệu (base), ô thiếu thì lấy từ dữ liệu hiện tại (data), ghi đè của người dùng
// (overrides), còn ô nhập/ảnh luôn tính lại từ trường của thẻ. Ô không thuộc mẫu bị bỏ.
export function buildSnapshot(args: {
  template: DesignTemplate;
  contractKind: ContractKindKey;
  base: Snapshot;
  data: DesignData | null;
  refresh: ReadonlySet<SlotKey>;
  overrides: Record<string, string | null> | undefined;
  fields: CardFields;
}): Snapshot {
  const { template, contractKind, base, data, refresh, overrides, fields } = args;
  const out: Snapshot = {};
  for (const s of slotsForContract(template, contractKind)) {
    if (DATA_TEXT_SET.has(s)) {
      const k = s as DataTextSlot;
      if (overrides && k in overrides) out[s] = overrides[k] ?? null;
      else if (s in base && !refresh.has(s)) out[s] = base[s] ?? null;
      else out[s] = data ? data.text[k] : null;
    } else if (s === 'logo' || s === 'anh') {
      if (s in base && !refresh.has(s)) out[s] = base[s] ?? null;
      else out[s] = data ? (s === 'logo' ? data.logoFileId : data.anhFileId) : null;
    } else if (s === 'nd' || s === 'cc') {
      out[s] = fields.body;
    } else if (s === 'td') {
      out[s] = fields.title;
    } else if (s === 'nfb') {
      out[s] = fields.receivedAt;
    } else if (s === 'sao') {
      out[s] = fields.rating;
    } else {
      const i = (PHOTO_SLOTS as readonly SlotKey[]).indexOf(s);
      out[s] = i >= 0 ? (fields.photoFileIds[i] ?? null) : null;
    }
  }
  return out;
}

// Ô cần lấy lại từ dữ liệu khi sửa thẻ: ô của mẫu mới chưa có trong snapshot; đổi lớp thì cả các ô theo lớp.
export function slotsToRefresh(t: DesignTemplate, contractKind: ContractKindKey, base: Snapshot, classChanged: boolean): Set<SlotKey> {
  const out = new Set<SlotKey>();
  for (const s of slotsForContract(t, contractKind)) {
    const fromData = DATA_TEXT_SET.has(s) || s === 'logo' || s === 'anh';
    if (!fromData) continue;
    if (!(s in base) || (classChanged && CLASS_SLOTS.includes(s))) out.add(s);
  }
  return out;
}

// ---------- Trình bày thẻ ----------

export type CardRow = DesignCard & {
  photos: DesignCardPhoto[];
  contract: { code: string; kind: ContractKindKey };
  customer: { fullName: string };
};

export const cardInclude = {
  photos: { orderBy: { sortOrder: 'asc' } },
  contract: { select: { code: true, kind: true } },
  customer: { select: { fullName: true } },
} satisfies Prisma.DesignCardInclude;

export async function presentCards(db: Tx, organizationId: string, rows: CardRow[]) {
  const sign = await signFiles(db, organizationId, [...rows.flatMap((r) => r.photos.map((p) => p.fileId)), ...rows.map((r) => r.outputFileId)]);
  return rows.map((r) => {
    const out = sign(r.outputFileId);
    return {
      id: r.id,
      kind: r.kind,
      templateCode: r.templateCode,
      templateVersion: r.templateVersion,
      contractId: r.contractId,
      contract: { id: r.contractId, code: r.contract.code, kind: r.contract.kind },
      customerId: r.customerId,
      customer: { id: r.customerId, fullName: r.customer.fullName },
      courseClassId: r.courseClassId,
      title: r.title,
      body: r.body,
      rating: r.rating,
      receivedAt: r.receivedAt ? ymd(r.receivedAt) : null,
      fontOverride: r.fontOverride,
      size: r.size,
      snapshot: r.snapshot,
      photos: r.photos.map((p) => {
        const s = sign(p.fileId);
        return { sortOrder: p.sortOrder, fileId: p.fileId, signedUrl: s?.url ?? null, signedUrlExpiresAt: s?.expiresAt ?? null };
      }),
      outputFileId: r.outputFileId,
      outputUrl: out?.url ?? null,
      outputUrlExpiresAt: out?.expiresAt ?? null,
      createdById: r.createdById,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

// Giá trị ghi nhật ký (không có URL ký).
export function auditCard(r: DesignCard & { photos: { fileId: string; sortOrder: number }[] }) {
  return {
    kind: r.kind,
    templateCode: r.templateCode,
    templateVersion: r.templateVersion,
    contractId: r.contractId,
    customerId: r.customerId,
    courseClassId: r.courseClassId,
    title: r.title,
    body: r.body,
    rating: r.rating,
    receivedAt: r.receivedAt ? ymd(r.receivedAt) : null,
    fontOverride: r.fontOverride,
    size: r.size,
    snapshot: r.snapshot as Prisma.InputJsonValue,
    photoFileIds: [...r.photos].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => p.fileId),
    outputFileId: r.outputFileId,
    deletedAt: r.deletedAt?.toISOString() ?? null,
  };
}
