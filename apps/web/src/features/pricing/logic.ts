// Logic thuần của màn Bảng giá (bản vẽ C mục 4.2): chia nhóm, chữ hiển thị, dựng thân gửi máy chủ, ánh xạ lỗi về ô.
// Không gọi mạng ở đây — bài thử logic.test.ts kiểm từng hàm.
import type { Permission } from '@makeup/shared';
import { ApiError, conflictFields, errorKind, fieldErrors, userMessage } from '../../api/errors';
import type {
  LocationType,
  MakeupSubject,
  NewPriceInput,
  Page,
  PackageCreateInput,
  PackageItemInput,
  PackageUpdateInput,
  PayRateSheet,
  PayRatesInput,
  Service,
  ServiceCreateInput,
  ServiceKind,
  ServicePackage,
  ServiceUpdateInput,
  TravelFeeMode,
  TravelFeePolicy,
  TravelFeePolicyInput,
  Vnd,
} from '../../api/types';
import { NAV_ITEMS } from '../../layout/nav';

// ======================= Nhóm (mục con) =======================

export type GroupKey = 'goi' | 'dich-vu' | 'di-chuyen' | 'nhan-vat';

export interface PricingGroup {
  key: GroupKey;
  // Tên đầy đủ — lấy từ nav.ts để thanh trái và tiêu đề trang luôn khớp.
  label: string;
  // Chữ ngắn trên nhóm nút chuyển ở điện thoại.
  short: string;
}

const SHORT: Record<GroupKey, string> = { goi: 'Gói', 'dich-vu': 'Dịch vụ phụ', 'di-chuyen': 'Di chuyển', 'nhan-vat': 'Nhân vật' };

export const PRICING_GROUPS: readonly PricingGroup[] = (NAV_ITEMS.find((i) => i.key === 'bang-gia')?.children ?? []).map((c) => {
  const key = c.path.replace(/^bang-gia\//, '') as GroupKey;
  if (!(key in SHORT)) throw new Error(`Mục con Bảng giá lạ trong nav.ts: ${c.path}`);
  return { key, label: c.label, short: SHORT[key] };
});

// Đường /bang-gia (không có nhóm) → null để trang chuyển sang nhóm đầu; nhóm lạ → 'unknown'.
export function resolveGroup(nhom: string | undefined): GroupKey | null | 'unknown' {
  if (nhom === undefined) return null;
  return PRICING_GROUPS.some((g) => g.key === nhom) ? (nhom as GroupKey) : 'unknown';
}

// ======================= Quyền =======================

export interface PricingPerms {
  catalogWrite: boolean;
  pricesWrite: boolean;
  payrollRead: boolean;
  payrollWrite: boolean;
  // Tạo gói / dịch vụ cần cả hai: thân tạo có giá đầu tiên (máy chủ assertCanSetPrice).
  canCreatePriced: boolean;
}

export function pricingPerms(has: (p: Permission) => boolean): PricingPerms {
  const catalogWrite = has('catalog.write');
  const pricesWrite = has('prices.write');
  // payroll.write không kèm payroll.read thì vẫn không đọc được bảng công → coi như không thấy nhóm.
  const payrollRead = has('payroll.read');
  return {
    catalogWrite,
    pricesWrite,
    payrollRead,
    payrollWrite: payrollRead && has('payroll.write'),
    canCreatePriced: catalogWrite && pricesWrite,
  };
}

// ======================= Chữ hiển thị =======================

export const LOCATION_ORDER: readonly LocationType[] = ['STUDIO', 'CUSTOMER_HOME', 'OTHER'];

const PLACE_SHORT: Record<LocationType, string> = { STUDIO: 'Studio', CUSTOMER_HOME: 'Tại nhà', OTHER: 'Nơi khác' };

export const PLACE_LABEL: Record<LocationType, string> = {
  STUDIO: 'Tại studio / cửa hàng',
  CUSTOMER_HOME: 'Tại nhà khách',
  OTHER: 'Địa điểm khác',
};

// Rỗng (máy chủ: không giới hạn) hoặc đủ 3 loại → "Mọi nơi"; còn lại "Studio · Tại nhà".
export function placeLabel(types: readonly LocationType[]): string {
  const set = new Set(types);
  if (set.size === 0 || LOCATION_ORDER.every((t) => set.has(t))) return 'Mọi nơi';
  return LOCATION_ORDER.filter((t) => set.has(t))
    .map((t) => PLACE_SHORT[t])
    .join(' · ');
}

// Ô tick địa điểm: máy chủ lưu rỗng = mọi nơi → hiện cả 3 ô đã tick.
export function locationsForForm(types: readonly LocationType[]): LocationType[] {
  return types.length === 0 ? [...LOCATION_ORDER] : LOCATION_ORDER.filter((t) => types.includes(t));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

// ======================= Lưới thẻ nhân vật =======================

export interface SubjectCard {
  // null = "Mọi nhân vật" (gói có subjectId = null).
  subjectId: string | null;
  name: string;
  packages: ServicePackage[];
}

export const ALL_SUBJECTS_LABEL = 'Mọi nhân vật';

/**
 * Mỗi nhân vật đang dùng một thẻ (kể cả chưa có gói, để nút "+" tạo gói cho nhân vật đó), theo sortOrder rồi tên.
 * Nhân vật đã tắt mà còn gói đang bán vẫn có thẻ để gói không biến mất. Cuối cùng là thẻ "Mọi nhân vật".
 */
export function subjectCards(subjects: readonly MakeupSubject[], packages: readonly ServicePackage[]): SubjectCard[] {
  const bySubject = new Map<string | null, ServicePackage[]>();
  for (const p of packages) {
    const list = bySubject.get(p.subjectId) ?? [];
    list.push(p);
    bySubject.set(p.subjectId, list);
  }
  const known = new Set(subjects.map((s) => s.id));
  const sorted = [...subjects].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi'));
  const cards: SubjectCard[] = sorted
    .filter((s) => s.isActive || bySubject.has(s.id))
    .map((s) => ({ subjectId: s.id, name: s.name, packages: bySubject.get(s.id) ?? [] }));
  // Gói trỏ tới nhân vật không có trong danh sách (dữ liệu lệch): dùng tên máy chủ gửi kèm gói, không bỏ rơi gói.
  for (const [id, list] of bySubject) {
    if (id !== null && !known.has(id)) cards.push({ subjectId: id, name: list[0]?.subject?.name ?? 'Nhân vật đã xoá', packages: list });
  }
  cards.push({ subjectId: null, name: ALL_SUBJECTS_LABEL, packages: bySubject.get(null) ?? [] });
  return cards;
}

export function packageCountBySubject(packages: readonly ServicePackage[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of packages) if (p.subjectId) m.set(p.subjectId, (m.get(p.subjectId) ?? 0) + 1);
  return m;
}

// ======================= Tải đủ mọi trang =======================

const MAX_PAGES = 50;

// Danh sách có phân trang (tối đa 100 dòng/trang ở máy chủ): gọi lần lượt tới khi đủ `total`. Không cắt cụt im lặng.
export async function fetchAllPages<T>(fetchPage: (page: number, pageSize: number) => Promise<Page<T>>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await fetchPage(page, 100);
    out.push(...res.items);
    if (res.items.length === 0 || out.length >= res.total) return out;
  }
  throw new Error(`Danh sách dài quá ${MAX_PAGES} trang, chưa tải hết được.`);
}

// ======================= Biểu mẫu gói =======================

export interface IncludedRow {
  serviceId: string;
  name: string;
  quantity: number | null;
}

export interface PackageForm {
  code: string;
  name: string;
  subjectId: string | null;
  durationMinutes: number | null;
  staffCount: number | null;
  listPrice: Vnd | null;
  salePrice: Vnd | null;
  depositAmount: Vnd | null;
  locationTypes: LocationType[];
  includedKm: number | null;
  included: IncludedRow[];
  // serviceId các dịch vụ phụ đang tick (isOptional = true).
  addons: string[];
  // tierId → tiền công (null = chưa đặt).
  payRates: Record<string, Vnd | null>;
}

export function emptyPackageForm(subjectId: string | null): PackageForm {
  return {
    code: '',
    name: '',
    subjectId,
    durationMinutes: null,
    staffCount: 1,
    listPrice: null,
    salePrice: null,
    depositAmount: null,
    locationTypes: [...LOCATION_ORDER],
    includedKm: null,
    included: [],
    addons: [],
    payRates: {},
  };
}

export function packageToForm(p: ServicePackage, sheet: PayRateSheet | null): PackageForm {
  return {
    code: p.code,
    name: p.name,
    subjectId: p.subjectId,
    durationMinutes: p.durationMinutes,
    staffCount: p.staffCount,
    listPrice: p.currentPrice?.listPrice ?? null,
    salePrice: p.currentPrice?.salePrice ?? null,
    depositAmount: p.depositAmount,
    locationTypes: locationsForForm(p.locationTypes),
    includedKm: p.includedKm,
    included: p.items.filter((i) => !i.isOptional).map((i) => ({ serviceId: i.serviceId, name: i.service.name, quantity: i.quantity })),
    addons: p.items.filter((i) => i.isOptional).map((i) => i.serviceId),
    payRates: sheet ? payRatesToForm(sheet) : {},
  };
}

export function payRatesToForm(sheet: PayRateSheet): Record<string, Vnd | null> {
  return Object.fromEntries(sheet.items.map((r) => [r.tier.id, r.amount]));
}

export type FormErrors = Record<string, string>;

const needsTravel = (types: readonly LocationType[]) => types.includes('CUSTOMER_HOME') || types.includes('OTHER');

// Kiểm ô trống trước khi gửi: không đoán thay người dùng.
export function validatePackageForm(f: PackageForm, mode: 'create' | 'edit'): FormErrors {
  const e: FormErrors = {};
  if (mode === 'create' && !f.code.trim()) e.code = 'Nhập mã gói.';
  if (!f.name.trim()) e.name = 'Nhập tên gói.';
  if (f.durationMinutes === null) e.durationMinutes = 'Nhập thời lượng.';
  else if (f.durationMinutes < 1 || f.durationMinutes > 1440) e.durationMinutes = 'Thời lượng từ 1 đến 1440 phút.';
  if (f.staffCount === null) e.staffCount = 'Nhập số thợ.';
  else if (f.staffCount < 1 || f.staffCount > 20) e.staffCount = 'Số thợ từ 1 đến 20.';
  if (f.listPrice === null) e.listPrice = 'Nhập giá niêm yết.';
  if (f.depositAmount === null) e.depositAmount = 'Nhập tiền cọc (không thu cọc thì nhập 0).';
  if (f.locationTypes.length === 0) e.locationTypes = 'Chọn ít nhất một địa điểm.';
  f.included.forEach((row, i) => {
    if (row.quantity === null) e[`included.${i}`] = 'Nhập số lần.';
    else if (row.quantity < 1 || row.quantity > 100) e[`included.${i}`] = 'Số lần từ 1 đến 100.';
  });
  return e;
}

function sameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  const sa = new Set(a);
  return sa.size === new Set(b).size && b.every((x) => sa.has(x));
}

// Dòng gửi PATCH {items}: đã gồm (isOptional false) trước, dịch vụ phụ cho tick sau. Giữ số lượng cũ của dòng tick.
export function itemsFromForm(f: PackageForm, original: ServicePackage | null): PackageItemInput[] {
  const oldQty = new Map(original?.items.filter((i) => i.isOptional).map((i) => [i.serviceId, i.quantity]) ?? []);
  return [
    ...f.included.map((r) => ({ serviceId: r.serviceId, quantity: r.quantity ?? 1, isOptional: false })),
    ...f.addons.map((id) => ({ serviceId: id, quantity: oldQty.get(id) ?? 1, isOptional: true })),
  ];
}

function itemsKey(items: readonly { serviceId: string; quantity?: number; isOptional?: boolean }[]): string {
  return items
    .map((i) => `${i.isOptional ? 1 : 0}:${i.serviceId}:${i.quantity ?? 1}`)
    .sort()
    .join('|');
}

// PATCH /packages/:id — chỉ những trường đã đổi; không đổi gì → null (không gọi).
export function buildPackagePatch(original: ServicePackage, f: PackageForm): PackageUpdateInput | null {
  const patch: PackageUpdateInput = {};
  if (f.name.trim() !== original.name) patch.name = f.name.trim();
  if (f.subjectId !== original.subjectId) patch.subjectId = f.subjectId;
  if (f.durationMinutes !== null && f.durationMinutes !== original.durationMinutes) patch.durationMinutes = f.durationMinutes;
  if (f.staffCount !== null && f.staffCount !== original.staffCount) patch.staffCount = f.staffCount;
  if (f.depositAmount !== null && f.depositAmount !== original.depositAmount) patch.depositAmount = f.depositAmount;
  if (!sameSet(f.locationTypes, locationsForForm(original.locationTypes))) patch.locationTypes = LOCATION_ORDER.filter((t) => f.locationTypes.includes(t));
  if (f.includedKm !== original.includedKm) patch.includedKm = f.includedKm;
  const items = itemsFromForm(f, original);
  if (itemsKey(items) !== itemsKey(original.items)) patch.items = items;
  return Object.keys(patch).length > 0 ? patch : null;
}

// POST /packages/:id/prices — đổi giá = thêm phiên bản; giá không đổi → null.
export function buildPriceInput(current: { listPrice: Vnd; salePrice: Vnd | null } | null, f: { listPrice: Vnd | null; salePrice: Vnd | null }): NewPriceInput | null {
  if (f.listPrice === null) return null;
  if (current && current.listPrice === f.listPrice && current.salePrice === f.salePrice) return null;
  return { listPrice: f.listPrice, salePrice: f.salePrice };
}

// PUT /pay-rates — chỉ gửi bậc đã đổi (bậc không gửi giữ nguyên ở máy chủ).
export function buildPayRatesInput(sheet: PayRateSheet | null, rates: Record<string, Vnd | null>): PayRatesInput | null {
  if (!sheet) return null;
  const changed = sheet.items
    .filter((r) => r.tier.id in rates && (rates[r.tier.id] ?? null) !== r.amount)
    .map((r) => ({ tierId: r.tier.id, amount: rates[r.tier.id] ?? null }));
  return changed.length > 0 ? { rates: changed } : null;
}

export function buildPackageCreate(f: PackageForm): PackageCreateInput {
  if (f.durationMinutes === null || f.listPrice === null) throw new Error('Gọi validatePackageForm trước khi dựng thân tạo gói');
  return {
    code: f.code.trim(),
    name: f.name.trim(),
    subjectId: f.subjectId,
    durationMinutes: f.durationMinutes,
    staffCount: f.staffCount ?? undefined,
    depositAmount: f.depositAmount ?? undefined,
    locationTypes: LOCATION_ORDER.filter((t) => f.locationTypes.includes(t)),
    includedKm: needsTravel(f.locationTypes) ? f.includedKm : null,
    items: itemsFromForm(f, null),
    listPrice: f.listPrice,
    salePrice: f.salePrice,
  };
}

// ======================= Lỗi máy chủ → ô =======================

export type SaveStep = 'package' | 'price' | 'payRates' | 'create';

export interface MappedError {
  fields: FormErrors;
  // Lỗi không gắn được vào ô nào: hiện thành dải trên đầu thân hộp.
  banner: string | null;
}

/**
 * Bản vẽ mục 5: 400 → lỗi dưới ô; 403 → dải "Bạn không có quyền …"; 409 → lời máy chủ (trùng mã thì dưới ô Mã).
 * items.N.* → dòng thứ N của "Đã gồm trong gói" (hoặc nhóm dịch vụ phụ khi N vượt số dòng đã gồm).
 * rates.N.* → bậc thứ N trong danh sách đã gửi.
 */
export function mapSaveError(
  err: unknown,
  step: SaveStep,
  ctx: { includedCount?: number; sentRates?: PayRatesInput | null } = {},
): MappedError {
  const kind = errorKind(err);
  const message = userMessage(err);
  if (kind === 'validation') {
    const fields: FormErrors = {};
    for (const [path, msg] of Object.entries(fieldErrors(err))) {
      const key = fieldKeyOf(path, ctx);
      if (key && fields[key] === undefined) fields[key] = msg;
    }
    if (Object.keys(fields).length > 0) return { fields, banner: null };
    // Lỗi giá không có đường dẫn (giá bán > giá niêm yết): đặt dưới ô Giá bán.
    if (step === 'price') return { fields: { salePrice: message }, banner: null };
    return { fields: {}, banner: message };
  }
  if (kind === 'conflict') {
    const conflict = conflictFields(err);
    if (conflict.includes('code')) return { fields: { code: message }, banner: null };
    return { fields: {}, banner: message };
  }
  if (kind === 'forbidden') {
    return { fields: {}, banner: message.startsWith('Bạn không có quyền') ? message : `Bạn không có quyền lưu thay đổi này. ${message}` };
  }
  return { fields: {}, banner: message };
}

function fieldKeyOf(path: string, ctx: { includedCount?: number; sentRates?: PayRatesInput | null }): string | null {
  const m = /^items\.(\d+)/.exec(path);
  if (m) {
    const i = Number(m[1]);
    return i < (ctx.includedCount ?? 0) ? `included.${i}` : 'addons';
  }
  const r = /^rates\.(\d+)/.exec(path);
  if (r) {
    const tierId = ctx.sentRates?.rates[Number(r[1])]?.tierId;
    return tierId ? `payRates.${tierId}` : 'payRates';
  }
  if (path === 'items') return 'addons';
  const root = path.split('.')[0] ?? '';
  return root || null;
}

export function isApiStatus(err: unknown, status: number): boolean {
  return err instanceof ApiError && err.status === status;
}

// ======================= Phí di chuyển =======================

export const TRAVEL_MODE_OPTIONS: readonly { value: TravelFeeMode; label: string }[] = [
  { value: 'FIXED', label: 'Cố định' },
  { value: 'PER_KM', label: 'Theo km' },
  { value: 'TIERED', label: 'Theo bậc' },
  { value: 'MANUAL', label: 'Nhập tay' },
];

export interface TierRow {
  // Khoá dòng phía máy (thêm/xoá dòng giữa chừng không lẫn ô).
  key: string;
  fromKm: number | null;
  // null = "trở lên" (bậc cuối).
  toKm: number | null;
  amount: Vnd | null;
}

export interface TravelForm {
  defaultMode: TravelFeeMode | null;
  fixedAmount: Vnd | null;
  perKmAmount: Vnd | null;
  freeKm: number | null;
  minimumAmount: Vnd | null;
  roundTrip: boolean;
  tiers: TierRow[];
}

let tierSeq = 0;
export function newTierKey(): string {
  tierSeq += 1;
  return `bac-${tierSeq}`;
}

export function travelToForm(p: TravelFeePolicy | null): TravelForm {
  if (!p) {
    // Chưa có cấu hình: để trống hết, bắt người dùng nhập — không tự điền số.
    return { defaultMode: null, fixedAmount: null, perKmAmount: null, freeKm: null, minimumAmount: null, roundTrip: false, tiers: [] };
  }
  return {
    defaultMode: p.defaultMode,
    fixedAmount: p.fixedAmount,
    perKmAmount: p.perKmAmount,
    freeKm: p.freeKm,
    minimumAmount: p.minimumAmount,
    roundTrip: p.roundTrip,
    tiers: p.tiers.map((t) => ({ key: newTierKey(), fromKm: t.fromKm, toKm: t.toKm, amount: t.amount })),
  };
}

export function validateTravelForm(f: TravelForm): FormErrors {
  const e: FormErrors = {};
  if (f.defaultMode === null) e.defaultMode = 'Chọn cách tính mặc định.';
  const money = 'Nhập số tiền (không dùng thì nhập 0).';
  if (f.fixedAmount === null) e.fixedAmount = money;
  if (f.perKmAmount === null) e.perKmAmount = money;
  if (f.minimumAmount === null) e.minimumAmount = money;
  if (f.freeKm === null) e.freeKm = 'Nhập bán kính (không miễn phí thì nhập 0).';
  if (f.defaultMode === 'FIXED' && f.fixedAmount === 0) e.fixedAmount = 'Cách tính mặc định là cố định thì mức cố định phải lớn hơn 0.';
  if (f.defaultMode === 'PER_KM' && f.perKmAmount === 0) e.perKmAmount = 'Cách tính mặc định là theo km thì đơn giá phải lớn hơn 0.';
  if (f.defaultMode === 'TIERED' && f.tiers.length === 0) e.tiers = 'Tính theo bậc thì cần ít nhất một bậc.';
  f.tiers.forEach((t, i) => {
    if (t.fromKm === null) e[`tiers.${i}.fromKm`] = 'Nhập km bắt đầu.';
    if (t.amount === null) e[`tiers.${i}.amount`] = 'Nhập số tiền.';
    if (t.fromKm !== null && t.toKm !== null && t.toKm <= t.fromKm) e[`tiers.${i}.toKm`] = 'Km kết thúc phải lớn hơn km bắt đầu.';
  });
  return e;
}

// PUT /travel-fee-policy gửi đủ mọi trường (kể cả tiers). Gọi sau validateTravelForm không lỗi.
export function buildTravelInput(f: TravelForm): TravelFeePolicyInput {
  if (f.defaultMode === null || f.fixedAmount === null || f.perKmAmount === null || f.freeKm === null || f.minimumAmount === null) {
    throw new Error('Gọi validateTravelForm trước khi dựng thân phí di chuyển');
  }
  return {
    defaultMode: f.defaultMode,
    fixedAmount: f.fixedAmount,
    perKmAmount: f.perKmAmount,
    freeKm: f.freeKm,
    minimumAmount: f.minimumAmount,
    roundTrip: f.roundTrip,
    tiers: f.tiers.map((t) => {
      if (t.fromKm === null || t.amount === null) throw new Error('Gọi validateTravelForm trước khi dựng thân phí di chuyển');
      return { fromKm: t.fromKm, toKm: t.toKm, amount: t.amount };
    }),
  };
}

export function travelDirty(policy: TravelFeePolicy | null, f: TravelForm): boolean {
  const base = travelToForm(policy);
  const strip = (x: TravelForm) => JSON.stringify({ ...x, tiers: x.tiers.map(({ fromKm, toKm, amount }) => ({ fromKm, toKm, amount })) });
  return strip(base) !== strip(f);
}

// Lỗi PUT phí di chuyển: chồng bậc / km kết thúc ≤ km bắt đầu (details.tier|tiers) → dưới nhóm "Bậc khoảng cách".
export function mapTravelError(err: unknown): MappedError {
  if (errorKind(err) === 'validation') {
    const fe = fieldErrors(err);
    const fields: FormErrors = {};
    for (const [path, msg] of Object.entries(fe)) if (fields[path] === undefined) fields[path] = msg;
    if (Object.keys(fields).length > 0) return { fields, banner: null };
    const details = err instanceof ApiError ? (err.details as Record<string, unknown> | undefined) : undefined;
    if (details && ('tier' in details || 'tiers' in details)) return { fields: { tiers: userMessage(err) }, banner: null };
  }
  return mapSaveError(err, 'package');
}

// ======================= Nhân vật: đổi thứ tự =======================

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  const [x] = out.splice(from, 1);
  if (x === undefined) return out;
  out.splice(Math.max(0, Math.min(to, out.length)), 0, x);
  return out;
}

// sortOrder mới = vị trí trong danh sách; chỉ trả nhân vật có sortOrder đổi.
export function sortOrderPatches(list: readonly MakeupSubject[]): { id: string; sortOrder: number }[] {
  return list.flatMap((s, i) => (s.sortOrder === i ? [] : [{ id: s.id, sortOrder: i }]));
}

// ======================= Dịch vụ phụ & phụ phí =======================

export interface ServiceForm {
  code: string;
  name: string;
  durationMinutes: number | null;
  listPrice: Vnd | null;
  salePrice: Vnd | null;
  payRates: Record<string, Vnd | null>;
}

export function serviceToForm(s: Service | null): ServiceForm {
  return {
    code: s?.code ?? '',
    name: s?.name ?? '',
    durationMinutes: s?.durationMinutes ?? null,
    listPrice: s?.currentPrice?.listPrice ?? null,
    salePrice: s?.currentPrice?.salePrice ?? null,
    payRates: {},
  };
}

export function validateServiceForm(f: ServiceForm): FormErrors {
  const e: FormErrors = {};
  if (!f.code.trim()) e.code = 'Nhập mã.';
  if (!f.name.trim()) e.name = 'Nhập tên.';
  if (f.durationMinutes === null) e.durationMinutes = 'Nhập thời lượng.';
  else if (f.durationMinutes < 1 || f.durationMinutes > 1440) e.durationMinutes = 'Thời lượng từ 1 đến 1440 phút.';
  if (f.listPrice === null) e.listPrice = 'Nhập giá niêm yết.';
  return e;
}

// PATCH /services/:id — chỉ trường đã đổi. Mã máy chủ tự đổi sang chữ hoa nên so ở dạng chữ hoa.
export function buildServicePatch(original: Service, f: ServiceForm): ServiceUpdateInput | null {
  const patch: ServiceUpdateInput = {};
  if (f.name.trim() !== original.name) patch.name = f.name.trim();
  if (f.code.trim().toUpperCase() !== original.code) patch.code = f.code.trim();
  if (f.durationMinutes !== null && f.durationMinutes !== original.durationMinutes) patch.durationMinutes = f.durationMinutes;
  return Object.keys(patch).length > 0 ? patch : null;
}

export function buildServiceCreate(kind: ServiceKind, f: ServiceForm): ServiceCreateInput {
  if (f.durationMinutes === null || f.listPrice === null) throw new Error('Gọi validateServiceForm trước khi dựng thân tạo dịch vụ');
  return { kind, code: f.code.trim(), name: f.name.trim(), durationMinutes: f.durationMinutes, listPrice: f.listPrice, salePrice: f.salePrice };
}
