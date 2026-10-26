// DỮ LIỆU IN HỢP ĐỒNG (bản vẽ G mục 3.1 "Dữ liệu in", 3.4 "Dựng dữ liệu" + đính chính 25/10/2026 mục 5; gói G-M4).
// Máy chủ dựng ContractPrintData (packages/shared/src/print.ts), web CHỈ VẼ — không tính tiền, không đổi múi giờ.
// - Mọi câu truy vấn lọc organizationId. Hợp đồng không thuộc tổ chức → 404 đúng lời loadContractDetail (present.ts).
// - Tiền lấy THẲNG từ cột database (BIGINT → số nguyên đồng): subtotal / discount / total / depositRequired của hợp đồng,
//   unitPrice / lineDiscount / lineTotal của từng dòng. KHÔNG cộng lại, không tính lại phụ phí. (travelTotal: cộng các dòng
//   TRAVEL chưa huỷ — đúng cách loadContractDetail trả travelTotal; hợp đồng không có cột này.)
// - Dòng gốc chưa huỷ theo sort_order, created_at; dòng con chưa huỷ gom như present.ts group(): TRAVEL → travel,
//   SURCHARGE → surcharges (dòng tự thêm theo luật VÀ dòng đã sửa tay — không mang tên luật / ghi chú ghi đè), còn lại →
//   addons. Dòng có ngày giờ: date + startTime/endTime theo múi giờ tổ chức (web in "dd/mm · HH:MM–HH:MM" khi hợp đồng
//   nhiều ngày).
// - Thu tiền: paid = summarizePayments(...).paid, đợt = allocateToInstallments (giống loadProgress, payments/common.ts).
//   Trạng thái đợt chỉ PAID / PARTIAL / UNPAID (không "quá hạn") để dữ liệu — và mã băm — không đổi theo giờ.
// - Che theo quyền người xem (maskPrintData): chỉ CHE THÊM, không bao giờ mở. Áp cả cho bản chụp của lần in trước.
// - dataHash = sha256(stableJson(data)): khoá đối tượng sắp theo thứ tự chữ, đệ quy; mảng giữ thứ tự.
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  allocateToInstallments,
  minutesToTime,
  PRINT_DATA_VERSION,
  splitClauses,
  summarizePayments,
  vndFromBigInt,
  vndInWords,
  type ContractPrintData,
  type LocalDate,
  type LocalTime,
  type Permission,
  type PrintLine,
  type PrintPayments,
  type PrintSubLine,
  type PrintText,
  type PrintTravel,
  type Vnd,
} from '@makeup/shared';
import { AppError } from '../../lib/errors';
import { paymentMath } from '../payments/common';
import { dateToWire } from '../courses/present';
import { snapshotTexts } from '../contracts/texts';

type Tx = Prisma.TransactionClient;

export interface PrintViewer {
  permissions: ReadonlySet<Permission>;
}

export const CONTRACT_NOT_FOUND = 'Không tìm thấy hợp đồng';

// ---------- Mã băm ----------

// JSON với khoá đối tượng sắp theo thứ tự chữ (đệ quy); mảng giữ thứ tự. undefined / hàm / bigint / số không hữu hạn → ném
// lỗi (dữ liệu in chỉ gồm chuỗi, số nguyên/hữu hạn, boolean, null, mảng, đối tượng — không để lọt giá trị JSON.stringify
// tự bỏ hay tự đổi).
export function stableJson(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new Error(`stableJson: số không hữu hạn ${String(value)}`);
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
      const rec = value as Record<string, unknown>;
      const keys = Object.keys(rec).sort();
      return `{${keys
        .map((k) => {
          if (rec[k] === undefined) throw new Error(`stableJson: khoá "${k}" mang undefined`);
          return `${JSON.stringify(k)}:${stableJson(rec[k])}`;
        })
        .join(',')}}`;
    }
    default:
      throw new Error(`stableJson: không nhận kiểu ${typeof value}`);
  }
}

export function hashPrintData(data: ContractPrintData): string {
  return createHash('sha256').update(stableJson(data), 'utf8').digest('hex');
}

// ---------- Che theo quyền ----------

// Chỉ CHE THÊM: không có customers.read → SĐT + email = null, contactHidden; không có payments.read → payments = null,
// paymentsHidden. Bản đã che (contactHidden / paymentsHidden = true) giữ nguyên là che, kể cả khi người xem có quyền.
export function maskPrintData(data: ContractPrintData, viewer: PrintViewer): ContractPrintData {
  const hideContact = data.customer.contactHidden || !viewer.permissions.has('customers.read');
  const hidePayments = data.paymentsHidden || !viewer.permissions.has('payments.read');
  return {
    ...data,
    customer: hideContact ? { fullName: data.customer.fullName, phone: null, email: null, contactHidden: true } : data.customer,
    payments: hidePayments ? null : data.payments,
    paymentsHidden: hidePayments,
  };
}

// Bản chụp đọc lại từ contract_prints.data (jsonb): chỉ nhận phiên bản dữ liệu đang hiểu. Hình dạng do chính máy chủ ghi.
export function storedPrintData(raw: Prisma.JsonValue, dataVersion: number): ContractPrintData {
  if (dataVersion !== PRINT_DATA_VERSION) throw new Error(`Bản chụp dữ liệu in phiên bản ${dataVersion} — máy chủ chỉ đọc bản ${PRINT_DATA_VERSION}`);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('contract_prints.data không phải object — dữ liệu hỏng');
  const d = raw as unknown as ContractPrintData;
  if (d.version !== PRINT_DATA_VERSION || (d.kind !== 'SERVICE' && d.kind !== 'COURSE')) throw new Error('contract_prints.data sai phiên bản / loại');
  return d;
}

// ---------- Ngày giờ theo múi giờ tổ chức ----------

function zoned(d: Date, timeZone: string): { date: LocalDate; time: LocalTime } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => {
    const v = parts.find((p) => p.type === t)?.value;
    if (!v) throw new Error(`Không đổi được ${d.toISOString()} sang múi giờ ${timeZone} (thiếu ${t})`);
    return v;
  };
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

const localDate = (d: Date, tz: string): LocalDate => zoned(d, tz).date;

// ---------- Đọc database ----------

const staffSelect = {
  role: true,
  membership: { select: { user: { select: { fullName: true } }, staffProfile: { select: { displayName: true } } } },
} satisfies Prisma.ContractLineStaffSelect;

function lineSelect(orgId: string) {
  return {
    id: true,
    parentLineId: true,
    kind: true,
    name: true,
    subjectName: true,
    quantity: true,
    unitPrice: true,
    lineDiscount: true,
    lineTotal: true,
    scheduledStart: true,
    scheduledEnd: true,
    locationType: true,
    address: true,
    note: true,
    addedAfterConfirm: true,
    createdAt: true,
    voidedAt: true,
    travelMode: true,
    distanceKm: true,
    perKmAmount: true,
    includedKm: true,
    includedFrom: true,
    excessKm: true,
    chargedKm: true,
    roundTrip: true,
    tierFromKm: true,
    tierToKm: true,
    tierAmount: true,
    studioLocation: { select: { name: true, address: true } },
    plannedStaff: { where: { organizationId: orgId }, select: staffSelect, orderBy: { membershipId: 'asc' } },
    courseClass: {
      select: {
        name: true,
        startDate: true,
        endDate: true,
        weekdays: true,
        startMinute: true,
        endMinute: true,
        course: { select: { name: true, sessionCount: true } },
        instructor: { select: { user: { select: { fullName: true } }, staffProfile: { select: { displayName: true } } } },
        studioLocation: { select: { name: true, address: true } },
      },
    },
  } satisfies Prisma.ContractLineSelect;
}

type LineRow = Prisma.ContractLineGetPayload<{ select: ReturnType<typeof lineSelect> }>;

const num = (d: Prisma.Decimal | null) => (d === null ? null : d.toNumber());
const memberName = (m: { user: { fullName: string }; staffProfile: { displayName: string | null } | null }) =>
  m.staffProfile?.displayName ?? m.user.fullName;

function subLine(r: LineRow, tz: string): PrintSubLine {
  return {
    name: r.name,
    quantity: r.quantity,
    unitPrice: vndFromBigInt(r.unitPrice, 'đơn giá'),
    lineDiscount: vndFromBigInt(r.lineDiscount, 'giảm giá dòng'),
    lineTotal: vndFromBigInt(r.lineTotal, 'thành tiền dòng'),
    addedAfterConfirm: r.addedAfterConfirm,
    addedOn: r.addedAfterConfirm ? localDate(r.createdAt, tz) : null,
  };
}

function travelLine(r: LineRow, tz: string): PrintTravel {
  return {
    ...subLine(r, tz),
    mode: r.travelMode,
    distanceKm: num(r.distanceKm),
    perKmAmount: r.perKmAmount === null ? null : vndFromBigInt(r.perKmAmount, 'đơn giá km'),
    // Số liệu đã CHỤP lúc lưu (present.ts savedBreakdown); dòng lưu trước khi có số liệu chụp → null.
    breakdown:
      r.roundTrip === null
        ? null
        : {
            includedKm: num(r.includedKm),
            includedFrom: r.includedFrom === 'PACKAGE' || r.includedFrom === 'ORGANIZATION' ? r.includedFrom : null,
            excessKm: num(r.excessKm),
            chargedKm: num(r.chargedKm),
            roundTrip: r.roundTrip,
            tier:
              r.tierFromKm === null || r.tierAmount === null
                ? null
                : { fromKm: r.tierFromKm.toNumber(), toKm: num(r.tierToKm), amount: vndFromBigInt(r.tierAmount, 'phí theo bậc') },
          },
  };
}

function rootLine(r: LineRow, children: LineRow[], tz: string): PrintLine {
  if (r.kind === 'ADDON' || r.kind === 'TRAVEL') throw new Error(`Dòng ${r.id} loại ${r.kind} không thể là dòng gốc`);
  const start = r.scheduledStart ? zoned(r.scheduledStart, tz) : null;
  const end = r.scheduledEnd ? zoned(r.scheduledEnd, tz) : null;
  const travels = children.filter((c) => c.kind === 'TRAVEL');
  if (travels.length > 1) throw new Error(`Dòng ${r.id} có hơn một dòng phí di chuyển chưa huỷ`);
  const cls = r.courseClass;
  return {
    kind: r.kind,
    name: r.name,
    subjectName: r.subjectName,
    quantity: r.quantity,
    unitPrice: vndFromBigInt(r.unitPrice, 'đơn giá'),
    lineDiscount: vndFromBigInt(r.lineDiscount, 'giảm giá dòng'),
    lineTotal: vndFromBigInt(r.lineTotal, 'thành tiền dòng'),
    date: start?.date ?? null,
    startTime: start?.time ?? null,
    endTime: end?.time ?? null,
    location:
      r.locationType === null
        ? null
        : {
            type: r.locationType,
            text:
              r.locationType === 'STUDIO'
                ? r.studioLocation
                  ? `${r.studioLocation.name} — ${r.studioLocation.address}`
                  : null
                : r.address,
          },
    note: r.note,
    staff: {
      primary: r.plannedStaff.filter((s) => s.role === 'PRIMARY').map((s) => memberName(s.membership)),
      assist: r.plannedStaff.filter((s) => s.role === 'ASSIST').map((s) => memberName(s.membership)),
    },
    addedAfterConfirm: r.addedAfterConfirm,
    addedOn: r.addedAfterConfirm ? localDate(r.createdAt, tz) : null,
    addons: children.filter((c) => c.kind !== 'TRAVEL' && c.kind !== 'SURCHARGE').map((c) => subLine(c, tz)),
    surcharges: children.filter((c) => c.kind === 'SURCHARGE').map((c) => subLine(c, tz)),
    travel: travels[0] ? travelLine(travels[0], tz) : null,
    course:
      r.kind === 'COURSE' && cls
        ? {
            courseName: cls.course.name,
            className: cls.name,
            startDate: dateToWire(cls.startDate),
            endDate: dateToWire(cls.endDate),
            weekdays: [...cls.weekdays].sort((a, b) => a - b),
            startTime: cls.startMinute === null ? null : minutesToTime(cls.startMinute),
            endTime: cls.endMinute === null ? null : minutesToTime(cls.endMinute),
            sessionCount: cls.course.sessionCount,
            instructorName: cls.instructor ? memberName(cls.instructor) : null,
            location: cls.studioLocation ? { name: cls.studioLocation.name, address: cls.studioLocation.address } : null,
          }
        : null,
  };
}

// Chưa huỷ: dòng gốc theo thứ tự sort_order, created_at (câu truy vấn đã sắp); dòng con theo cùng thứ tự dưới dòng cha.
function groupLines(rows: LineRow[], tz: string): PrintLine[] {
  const active = rows.filter((r) => r.voidedAt === null);
  const roots = active.filter((r) => r.parentLineId === null);
  const rootIds = new Set(roots.map((r) => r.id));
  const children = new Map<string, LineRow[]>();
  for (const r of active) {
    if (r.parentLineId === null) continue;
    // Dòng con chưa huỷ của dòng gốc ĐÃ huỷ không in (dòng gốc huỷ thì cả cụm không còn trên bản in).
    if (!rootIds.has(r.parentLineId) && !rows.some((x) => x.id === r.parentLineId)) {
      throw new Error(`Dòng ${r.id} trỏ tới dòng cha ${r.parentLineId} không thuộc hợp đồng`);
    }
    const list = children.get(r.parentLineId) ?? [];
    list.push(r);
    children.set(r.parentLineId, list);
  }
  return roots.map((r) => rootLine(r, children.get(r.id) ?? [], tz));
}

function words(v: Vnd): string {
  return vndInWords(v);
}

async function loadPayments(tx: Tx, orgId: string, contractId: string, total: Vnd, deposit: Vnd, tz: string): Promise<PrintPayments> {
  const [installments, payments] = await Promise.all([
    tx.paymentInstallment.findMany({
      where: { contractId, organizationId: orgId },
      select: { id: true, name: true, dueDate: true, amount: true, isDeposit: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }, { id: 'asc' }],
    }),
    tx.payment.findMany({
      where: { contractId, organizationId: orgId },
      select: { code: true, kind: true, method: true, amount: true, receivedAt: true, voidedAt: true },
      orderBy: [{ receivedAt: 'asc' }, { code: 'asc' }],
    }),
  ]);
  const summary = paymentMath(() =>
    summarizePayments(
      total,
      deposit,
      payments.map((p) => ({ kind: p.kind, amount: vndFromBigInt(p.amount, 'số tiền phiếu'), voided: p.voidedAt !== null })),
    ),
  );
  // `now` chỉ ảnh hưởng trạng thái OVERDUE của hàm dùng chung — bản in không dùng trạng thái đó (tự suy từ số đã đổ vào).
  const allocated = paymentMath(() =>
    allocateToInstallments(
      installments.map((i) => ({ ...i, amount: vndFromBigInt(i.amount, 'số tiền đợt') })),
      summary.paid,
      new Date(0),
    ),
  );
  const installmentsTotal = allocated.reduce((s, i) => s + i.amount, 0);
  const remaining = summary.remaining;
  return {
    installments: allocated.map((i) => ({
      name: i.name,
      dueDate: localDate(i.dueDate, tz),
      amount: i.amount,
      isDeposit: i.isDeposit,
      paid: i.paidAmount,
      state: i.paidAmount === i.amount ? 'PAID' : i.paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
    })),
    receipts: payments
      .filter((p) => p.voidedAt === null)
      .map((p) => ({ code: p.code, kind: p.kind, method: p.method, amount: vndFromBigInt(p.amount, 'số tiền phiếu'), receivedOn: localDate(p.receivedAt, tz) })),
    paid: summary.paid,
    remaining,
    // Khách trả thừa (remaining < 0): đọc phần thừa, ghi rõ là thừa — vndInWords không nhận số âm.
    remainingInWords: remaining >= 0 ? words(remaining) : `Trả thừa ${words(-remaining).toLowerCase()}`,
    scheduleDifference: allocated.length === 0 ? null : summary.total - installmentsTotal,
  };
}

const TEXT_TITLE = { TERMS: 'Điều khoản', RULES: 'Nội quy' } as const;

async function textName(tx: Tx, orgId: string, id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const t = await tx.contractText.findFirst({ where: { id, organizationId: orgId }, select: { name: true } });
  return t?.name ?? null;
}

function printText(kind: 'TERMS' | 'RULES', body: string | null | undefined, source: { name: string; version: number } | null, snapshot: boolean): PrintText | null {
  const items = splitClauses(body ?? null);
  if (items.length === 0) return null;
  return { title: TEXT_TITLE[kind], items, source, snapshot };
}

export interface BuiltPrintData {
  data: ContractPrintData;
  contract: { id: string; code: string; kind: 'SERVICE' | 'COURSE'; status: ContractPrintData['contract']['status']; updatedAt: Date };
  hasProfile: boolean;
}

// Dựng dữ liệu in của một hợp đồng cho một người xem (đã che theo quyền). Gọi trong transaction của nơi gọi.
export async function buildPrintData(tx: Tx, orgId: string, contractId: string, viewer: PrintViewer): Promise<BuiltPrintData> {
  if (!orgId) throw new Error('buildPrintData: thiếu organizationId');
  const c = await tx.contract.findFirst({
    where: { id: contractId, organizationId: orgId },
    select: {
      id: true,
      code: true,
      kind: true,
      status: true,
      eventDate: true,
      subtotal: true,
      discount: true,
      total: true,
      depositRequired: true,
      notes: true,
      terms: true,
      rules: true,
      termsTemplateId: true,
      termsTemplateVersion: true,
      rulesTemplateId: true,
      rulesTemplateVersion: true,
      confirmedAt: true,
      createdAt: true,
      updatedAt: true,
      customer: { select: { fullName: true, phone: true, email: true } },
      lines: { where: { organizationId: orgId }, select: lineSelect(orgId), orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!c) throw new AppError('NOT_FOUND', CONTRACT_NOT_FOUND);
  const [org, profile] = await Promise.all([
    tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true, timezone: true } }),
    tx.organizationProfile.findUnique({
      where: { organizationId: orgId },
      select: {
        brandName: true,
        tagline: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        logoFileId: true,
        representativeName: true,
        representativeTitle: true,
        bankName: true,
        bankAccountNumber: true,
        bankAccountName: true,
      },
    }),
  ]);
  const tz = org.timezone;
  if (!tz) throw new Error(`Tổ chức ${orgId} chưa có múi giờ`);

  const subtotal = vndFromBigInt(c.subtotal, 'tạm tính');
  const discount = vndFromBigInt(c.discount, 'giảm giá');
  const total = vndFromBigInt(c.total, 'tổng');
  const depositRequired = vndFromBigInt(c.depositRequired, 'tiền cọc');
  const travelTotal = c.lines
    .filter((l) => l.kind === 'TRAVEL' && l.voidedAt === null)
    .reduce((s, l) => s + vndFromBigInt(l.lineTotal, 'phí di chuyển'), 0);

  // Điều khoản / nội quy. Nháp (chưa xác nhận): ĐÚNG luật chụp lúc xác nhận (contracts/texts.ts snapshotTexts — mẫu đang
  // chọn bản mới nhất → điều khoản tự nhập → mẫu mặc định), snapshot: false. Đã xác nhận: bản chụp trên hợp đồng.
  let terms: PrintText | null;
  let rules: PrintText | null = null;
  if (c.confirmedAt === null) {
    const snap = await snapshotTexts(tx, orgId, { kind: c.kind, terms: c.terms, termsTemplateId: c.termsTemplateId, rulesTemplateId: c.rulesTemplateId });
    const termsName = await textName(tx, orgId, snap.termsTemplateId);
    terms = printText(
      'TERMS',
      snap.terms ?? c.terms,
      snap.termsTemplateId && termsName !== null && snap.termsTemplateVersion !== undefined ? { name: termsName, version: snap.termsTemplateVersion } : null,
      false,
    );
    if (c.kind === 'COURSE') {
      const rulesName = await textName(tx, orgId, snap.rulesTemplateId);
      rules = printText(
        'RULES',
        snap.rules ?? c.rules,
        snap.rulesTemplateId && rulesName !== null && snap.rulesTemplateVersion !== undefined ? { name: rulesName, version: snap.rulesTemplateVersion } : null,
        false,
      );
    }
  } else {
    const termsName = await textName(tx, orgId, c.termsTemplateId);
    terms = printText('TERMS', c.terms, termsName !== null && c.termsTemplateVersion !== null ? { name: termsName, version: c.termsTemplateVersion } : null, true);
    if (c.kind === 'COURSE') {
      const rulesName = await textName(tx, orgId, c.rulesTemplateId);
      rules = printText('RULES', c.rules, rulesName !== null && c.rulesTemplateVersion !== null ? { name: rulesName, version: c.rulesTemplateVersion } : null, true);
    }
  }

  const payments = viewer.permissions.has('payments.read') ? await loadPayments(tx, orgId, c.id, total, depositRequired, tz) : null;
  const data: ContractPrintData = {
    version: PRINT_DATA_VERSION,
    kind: c.kind,
    contract: {
      code: c.code,
      status: c.status,
      issuedOn: localDate(c.confirmedAt ?? c.createdAt, tz),
      eventDate: c.eventDate ? localDate(c.eventDate, tz) : null,
      notes: c.notes,
    },
    studio: {
      name: profile && profile.brandName.trim() ? profile.brandName : org.name,
      tagline: profile?.tagline ?? null,
      address: profile?.address ?? null,
      phone: profile?.phone ?? null,
      email: profile?.email ?? null,
      website: profile?.website ?? null,
      logoFileId: profile?.logoFileId ?? null,
      representative: profile?.representativeName ? { name: profile.representativeName, title: profile.representativeTitle } : null,
      bank:
        profile?.bankName && profile.bankAccountNumber && profile.bankAccountName
          ? { bankName: profile.bankName, accountNumber: profile.bankAccountNumber, accountName: profile.bankAccountName }
          : null,
    },
    customer: { fullName: c.customer.fullName, phone: c.customer.phone, email: c.customer.email, contactHidden: false },
    lines: groupLines(c.lines, tz),
    money: {
      subtotal,
      discount,
      total,
      totalInWords: words(total),
      depositRequired,
      depositInWords: words(depositRequired),
      travelTotal,
    },
    payments,
    paymentsHidden: payments === null,
    terms,
    rules,
  };
  return {
    data: maskPrintData(data, viewer),
    contract: { id: c.id, code: c.code, kind: c.kind, status: c.status, updatedAt: c.updatedAt },
    hasProfile: profile !== null,
  };
}

// ---------- Cảnh báo ----------

export type PrintWarningCode =
  | 'NO_PROFILE'
  | 'NO_REPRESENTATIVE'
  | 'NO_BANK'
  | 'CONTACT_HIDDEN'
  | 'PAYMENTS_HIDDEN'
  | 'NO_TERMS'
  | 'NO_INSTALLMENTS'
  | 'SCHEDULE_DIFFERENCE'
  | 'DRAFT'
  | 'LOGO_GONE';

export interface PrintWarning {
  code: PrintWarningCode;
  message: string;
}

export const WARNING_MESSAGES: Record<PrintWarningCode, string> = {
  NO_PROFILE: 'Chưa có hồ sơ thương hiệu — tên lấy theo tên tổ chức, không có logo và địa chỉ',
  NO_REPRESENTATIVE: 'Chưa có người đại diện — nhập ở Thông tin trên hợp đồng',
  NO_BANK: 'Chưa có tài khoản ngân hàng — nhập ở Thông tin trên hợp đồng',
  CONTACT_HIDDEN: 'Bạn không có quyền xem SĐT và email khách, nên chỗ đó in "……"',
  PAYMENTS_HIDDEN: 'Bạn không có quyền xem thu tiền, nên không in tiến độ và phiếu thu',
  NO_TERMS: 'Hợp đồng chưa có điều khoản',
  NO_INSTALLMENTS: 'Hợp đồng chưa lập tiến độ thanh toán',
  SCHEDULE_DIFFERENCE: 'Tổng các đợt khác tổng hợp đồng — lập lại tiến độ thanh toán',
  DRAFT: 'Hợp đồng nháp — bản in ghi "BẢN NHÁP"',
  LOGO_GONE: 'Logo của lần in này đã bị xoá — bản in lại không có logo',
};

const warn = (code: PrintWarningCode): PrintWarning => ({ code, message: WARNING_MESSAGES[code] });

// Cảnh báo suy ra từ dữ liệu in (dùng cho cả dữ liệu hiện tại và bản chụp). NO_PROFILE / LOGO_GONE do nơi gọi thêm.
export function dataWarnings(d: ContractPrintData): PrintWarning[] {
  const out: PrintWarning[] = [];
  if (d.studio.representative === null) out.push(warn('NO_REPRESENTATIVE'));
  if (d.studio.bank === null) out.push(warn('NO_BANK'));
  if (d.customer.contactHidden) out.push(warn('CONTACT_HIDDEN'));
  if (d.paymentsHidden) out.push(warn('PAYMENTS_HIDDEN'));
  if (d.terms === null) out.push(warn('NO_TERMS'));
  if (d.payments && d.payments.installments.length === 0) out.push(warn('NO_INSTALLMENTS'));
  if (d.payments && d.payments.scheduleDifference !== null && d.payments.scheduleDifference !== 0) out.push(warn('SCHEDULE_DIFFERENCE'));
  if (d.contract.status === 'DRAFT') out.push(warn('DRAFT'));
  return out;
}

export function noProfileWarning(): PrintWarning {
  return warn('NO_PROFILE');
}

export function logoGoneWarning(): PrintWarning {
  return warn('LOGO_GONE');
}
