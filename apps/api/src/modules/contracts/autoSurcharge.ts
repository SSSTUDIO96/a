// PHỤ PHÍ TỰ ĐỘNG (bản vẽ D mục 2.4): máy chủ là nơi DUY NHẤT tính. Gọi từ planPlaced (sheet.ts) cho MỖI dòng đặt chỗ,
// sau dòng chính, dịch vụ phụ, phí di chuyển. Luật khớp → một dòng SURCHARGE con của dòng đặt chỗ.
// Hàm thuần (khớp luật, chọn luật, số lượng, thành tiền) ở @makeup/shared/surcharges — không viết lại ở đây.
// Mọi tra luật / loại sự kiện / giá đều lọc theo organizationId. Tiền là số nguyên đồng (BigInt trong database).
import type { Prisma, ServiceKind } from '@prisma/client';
import {
  computeAutoSurcharge,
  ContractMathError,
  localDateAndMinute,
  pickSurchargeRules,
  vndFromBigInt,
  type LineFacts,
  type RuleLike,
  type Vnd,
} from '@makeup/shared';
import { AppError } from '../../lib/errors';
import { resolveCurrentPrice } from '../catalog/prices';
import { dateToWire } from '../courses/present';
import type { PlacedLineInput, SurchargeOverrideInput } from './schemas';

type Tx = Prisma.TransactionClient;

// ---------- Báo cáo (chỉ POST /contracts/quote trả) ----------

export interface AutoSurchargeApplied {
  line: number;
  ruleId: string;
  ruleName: string;
  serviceName: string;
  quantity: number;
  lineTotal: Vnd;
  overridden: boolean;
}
export interface AutoSurchargeRemoved {
  line: number;
  ruleId: string;
  ruleName: string;
  reason: 'NO_LONGER_MATCHES' | 'RULE_INACTIVE' | 'SAME_SERVICE';
}
export interface AutoSurchargeSkipped {
  line: number;
  ruleId: string;
  ruleName: string;
  reason: 'SERVICE_UNAVAILABLE' | 'MANUAL_LINE_EXISTS' | 'NO_PRICE' | 'SAME_SERVICE';
  by?: string;
}
export interface AutoSurchargeReport {
  applied: AutoSurchargeApplied[];
  removed: AutoSurchargeRemoved[];
  skipped: AutoSurchargeSkipped[];
}

export function emptyReport(): AutoSurchargeReport {
  return { applied: [], removed: [], skipped: [] };
}

// ---------- Nạp luật ----------

export interface LoadedRule extends RuleLike {
  service: { id: string; name: string; kind: ServiceKind; isActive: boolean };
}

// Luật ĐANG BẬT của tổ chức, kèm điều kiện. Một câu mỗi bảng tính (sheet.ts nạp lười, giống policy phí di chuyển).
// Thứ tự trả về không quan trọng: pickSurchargeRules tự sắp (sortOrder, tên, id).
export async function loadActiveRules(tx: Tx, orgId: string): Promise<LoadedRule[]> {
  if (!orgId) throw new Error('loadActiveRules: thiếu organizationId');
  const rows = await tx.surchargeRule.findMany({
    where: { organizationId: orgId, isActive: true },
    include: {
      service: { select: { id: true, name: true, kind: true, isActive: true } },
      targets: { where: { organizationId: orgId }, select: { occasionId: true, packageId: true, subjectId: true } },
      dates: { where: { organizationId: orgId }, select: { day: true } },
    },
  });
  const ids = (xs: (string | null)[]) => xs.filter((x): x is string => x !== null);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    serviceId: r.serviceId,
    sortOrder: r.sortOrder,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
    weekdays: r.weekdays,
    dates: r.dates.map((d) => dateToWire(d.day)),
    occasionIds: ids(r.targets.map((t) => t.occasionId)),
    packageIds: ids(r.targets.map((t) => t.packageId)),
    subjectIds: ids(r.targets.map((t) => t.subjectId)),
    perQuantity: r.perQuantity,
    service: r.service,
  }));
}

// Múi giờ tổ chức — đọc MỘT lần mỗi yêu cầu, truyền vào bảng tính (ngày của dòng theo múi giờ này).
export async function orgTimezone(db: Tx, orgId: string): Promise<string> {
  if (!orgId) throw new Error('orgTimezone: thiếu organizationId');
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId }, select: { timezone: true } });
  return org.timezone;
}

// ---------- Kiểm mã người dùng gửi ở dòng đặt chỗ ----------

export interface UserRuleRef {
  id: string;
  name: string;
  isActive: boolean;
}

const RULE_NOT_FOUND = 'Không tìm thấy luật phụ phí';

// Mọi surchargeOverrides[].ruleId và dismissedRuleIds[] phải là luật của tổ chức (bật hay tắt đều được). Mảng
// dismissed không có khoá ngoại → đây là chốt DUY NHẤT: mã bịa và mã của tổ chức khác trả CÙNG một lời 404.
export async function checkLineRuleRefs(tx: Tx, orgId: string, input: PlacedLineInput, line: number): Promise<Map<string, UserRuleRef>> {
  const overrides = input.surchargeOverrides ?? [];
  const dismissed = input.dismissedRuleIds ?? [];
  const ids = [...new Set([...overrides.map((o) => o.ruleId), ...dismissed])];
  if (ids.length === 0) return new Map();
  const found = await tx.surchargeRule.findMany({
    where: { organizationId: orgId, id: { in: ids } },
    select: { id: true, name: true, isActive: true },
  });
  if (found.length !== ids.length) throw new AppError('NOT_FOUND', RULE_NOT_FOUND, { line });
  const byId = new Map(found.map((r) => [r.id, r]));
  const dismissedSet = new Set(dismissed);
  for (const o of overrides) {
    if (dismissedSet.has(o.ruleId)) {
      throw new AppError('VALIDATION_FAILED', `Luật "${byId.get(o.ruleId)?.name ?? o.ruleId}" vừa bị bỏ vừa được sửa ở cùng một dòng`, {
        line,
      });
    }
  }
  const seen = new Set<string>();
  for (const o of overrides) {
    if (seen.has(o.ruleId)) {
      throw new AppError('VALIDATION_FAILED', `Luật "${byId.get(o.ruleId)?.name ?? o.ruleId}" được sửa hai lần ở cùng một dòng`, { line });
    }
    seen.add(o.ruleId);
  }
  return byId;
}

// Loại sự kiện của dòng: thuộc tổ chức (mã của tổ chức khác = mã bịa), không đang ẩn. Trả mã + tên để CHỤP vào dòng.
export async function loadOccasion(tx: Tx, orgId: string, occasionId: string, line: number) {
  const o = await tx.occasion.findFirst({
    where: { id: occasionId, organizationId: orgId },
    select: { id: true, name: true, isActive: true },
  });
  if (!o) throw new AppError('NOT_FOUND', 'Không tìm thấy loại sự kiện', { line });
  if (!o.isActive) throw new AppError('VALIDATION_FAILED', `Loại sự kiện "${o.name}" đang ẩn`, { line });
  return o;
}

// ---------- Sự thật của dòng ----------

// Ngày + phút bắt đầu theo múi giờ tổ chức. Dòng chưa có giờ: ngày = ngày địa phương của ngày sự kiện (nếu có), phút null.
export function lineFacts(
  main: { scheduledStart: Date | null; occasionId: string | null; packageId: string | null; subjectId: string | null },
  timezone: string,
  eventDate: Date | null,
): LineFacts {
  if (!timezone) throw new Error('lineFacts: thiếu múi giờ tổ chức');
  let localDate: string | null = null;
  let startMinute: number | null = null;
  if (main.scheduledStart) {
    const l = localDateAndMinute(main.scheduledStart, 'UTC');
    localDate = l.date;
    startMinute = l.minute;
  } else if (eventDate) {
    localDate = localDateAndMinute(eventDate, timezone).date;
  }
  return { localDate, startMinute, occasionId: main.occasionId, packageId: main.packageId, subjectId: main.subjectId };
}

// ---------- Chạy luật cho một dòng đặt chỗ ----------

// Một dòng tự thêm đã tính, chưa thành PlannedLine (sheet.ts lắp vào khuôn dòng chung).
export interface AutoLine {
  serviceId: string;
  priceVersionId: string | null;
  name: string;
  quantity: number;
  unitPrice: Vnd;
  lineTotal: Vnd;
  note: string | null;
  surchargeRuleId: string;
  surchargeRuleName: string;
}

export interface AutoSurchargeArgs {
  tx: Tx;
  orgId: string;
  at: Date;
  line: number;
  rules: LoadedRule[];
  facts: LineFacts;
  mainQuantity: number;
  input: PlacedLineInput;
  userRules: Map<string, UserRuleRef>;
  // Dịch vụ của các dòng phụ phí NHẬP TAY (gốc, không luật, chưa huỷ) trong yêu cầu / hợp đồng → bỏ qua luật cùng dịch vụ.
  manualSurchargeServiceIds: ReadonlySet<string>;
  report: AutoSurchargeReport;
}

function mathToAppError<T>(work: () => T, line: number): T {
  try {
    return work();
  } catch (err) {
    if (err instanceof ContractMathError) throw new AppError('VALIDATION_FAILED', err.message, { line });
    throw err;
  }
}

export async function planAutoSurcharges(a: AutoSurchargeArgs): Promise<AutoLine[]> {
  const dismissed = new Set(a.input.dismissedRuleIds ?? []);
  const overrides = new Map<string, SurchargeOverrideInput>((a.input.surchargeOverrides ?? []).map((o) => [o.ruleId, o]));
  const { kept, shadowed } = pickSurchargeRules(a.rules, a.facts, dismissed);
  const out: AutoLine[] = [];
  for (const rule of kept) {
    const skip = (reason: AutoSurchargeSkipped['reason']) => a.report.skipped.push({ line: a.line, ruleId: rule.id, ruleName: rule.name, reason });
    if (rule.service.kind !== 'SURCHARGE' || !rule.service.isActive) {
      skip('SERVICE_UNAVAILABLE');
      continue;
    }
    if (a.manualSurchargeServiceIds.has(rule.serviceId)) {
      skip('MANUAL_LINE_EXISTS');
      continue;
    }
    const override = overrides.get(rule.id);
    let priceVersionId: string | null = null;
    let listPrice: Vnd | null = null;
    if (override?.unitPrice === undefined) {
      const p = await resolveCurrentPrice(a.tx, a.orgId, { serviceId: rule.serviceId }, a.at);
      if (p) {
        priceVersionId = p.priceVersionId;
        listPrice = vndFromBigInt(p.unitPrice, `giá phụ phí "${rule.service.name}"`);
      }
    }
    const amount = mathToAppError(
      () =>
        computeAutoSurcharge({
          perQuantity: rule.perQuantity,
          lineQuantity: a.mainQuantity,
          listPrice,
          override: override ? { quantity: override.quantity, unitPrice: override.unitPrice } : undefined,
        }),
      a.line,
    );
    if (!amount.ok) {
      skip('NO_PRICE');
      continue;
    }
    out.push({
      serviceId: rule.serviceId,
      // Ghi đè giá thì không trỏ về phiên bản giá (giống dòng phụ phí nhập tay, schemas.ts); lý do nằm ở ghi chú.
      priceVersionId: amount.priceOverridden ? null : priceVersionId,
      name: rule.service.name,
      quantity: amount.quantity,
      unitPrice: amount.unitPrice,
      lineTotal: amount.lineTotal,
      note: override?.note ?? null,
      surchargeRuleId: rule.id,
      surchargeRuleName: rule.name,
    });
    a.report.applied.push({
      line: a.line,
      ruleId: rule.id,
      ruleName: rule.name,
      serviceName: rule.service.name,
      quantity: amount.quantity,
      lineTotal: amount.lineTotal,
      overridden: amount.overridden,
    });
  }
  const shadowedBy = new Map(shadowed.map((s) => [s.rule.id, s.by]));
  for (const s of shadowed) {
    a.report.skipped.push({ line: a.line, ruleId: s.rule.id, ruleName: s.rule.name, reason: 'SAME_SERVICE', by: s.by.name });
  }
  // Phần sửa của luật không còn được áp → bỏ phần sửa, báo lý do (web hiện "phụ phí X không còn áp").
  const keptIds = new Set(kept.map((r) => r.id));
  for (const o of a.input.surchargeOverrides ?? []) {
    if (keptIds.has(o.ruleId)) continue;
    const ref = a.userRules.get(o.ruleId);
    if (!ref) throw new Error(`Luật ${o.ruleId} chưa qua checkLineRuleRefs — lỗi lắp ráp`);
    const reason: AutoSurchargeRemoved['reason'] = !ref.isActive ? 'RULE_INACTIVE' : shadowedBy.has(o.ruleId) ? 'SAME_SERVICE' : 'NO_LONGER_MATCHES';
    a.report.removed.push({ line: a.line, ruleId: o.ruleId, ruleName: ref.name, reason });
  }
  return out;
}

// Luật đã bỏ, khử trùng, giữ thứ tự gửi lên (giữ cả luật hiện không khớp: đổi giờ đi rồi đổi lại vẫn không tự thêm lại).
export function dismissedToStore(input: PlacedLineInput): string[] {
  return [...new Set(input.dismissedRuleIds ?? [])];
}
