// Logic thuần của màn Bảng giá (bản vẽ C mục 4.2): chia nhóm, chữ hiển thị, dựng thân gửi máy chủ, ánh xạ lỗi về ô.
// Không gọi mạng ở đây — bài thử logic.test.ts kiểm từng hàm.
import { OCCASION_COLORS, type OccasionColor, type Permission } from '@makeup/shared';
import { ApiError, conflictFields, errorKind, fieldErrors, userMessage } from '../../api/errors';
import type {
  LocationType,
  MakeupSubject,
  NewPriceInput,
  OccasionCreateInput,
  OccasionUpdateInput,
  OccasionView,
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
  SurchargeRuleCreateInput,
  SurchargeRuleStatus,
  SurchargeRuleUpdateInput,
  SurchargeRuleView,
  TravelFeeMode,
  TravelFeePolicy,
  TravelFeePolicyInput,
  Vnd,
} from '../../api/types';
import { NAV_ITEMS } from '../../layout/nav';

// ======================= Nhóm (mục con) =======================

export type GroupKey = 'goi' | 'dich-vu' | 'di-chuyen' | 'nhan-vat' | 'su-kien' | 'luat-phu-phi';

export interface PricingGroup {
  key: GroupKey;
  // Tên đầy đủ — lấy từ nav.ts để thanh trái và tiêu đề trang luôn khớp.
  label: string;
  // Chữ ngắn trên nhóm nút chuyển ở điện thoại.
  short: string;
}

const SHORT: Record<GroupKey, string> = {
  goi: 'Gói',
  'dich-vu': 'Dịch vụ phụ',
  'di-chuyen': 'Di chuyển',
  'nhan-vat': 'Nhân vật',
  'su-kien': 'Sự kiện',
  'luat-phu-phi': 'Luật phí',
};

// Hai nhóm của bản vẽ D mục 3.0. Khi nav.ts đã có hai mục con này (children của 'bang-gia') thì nav.ts thắng; chưa có
// (còn nằm ở PENDING_BANG_GIA_CHILDREN) thì màn vẫn mở được bằng đường /bang-gia/su-kien, /bang-gia/luat-phu-phi.
const NEW_GROUPS: readonly { key: GroupKey; label: string }[] = [
  { key: 'su-kien', label: 'Loại sự kiện' },
  { key: 'luat-phu-phi', label: 'Luật phụ phí' },
];

const fromNav: PricingGroup[] = (NAV_ITEMS.find((i) => i.key === 'bang-gia')?.children ?? []).map((c) => {
  const key = c.path.replace(/^bang-gia\//, '') as GroupKey;
  if (!(key in SHORT)) throw new Error(`Mục con Bảng giá lạ trong nav.ts: ${c.path}`);
  return { key, label: c.label, short: SHORT[key] };
});

export const PRICING_GROUPS: readonly PricingGroup[] = [
  ...fromNav,
  ...NEW_GROUPS.filter((g) => !fromNav.some((f) => f.key === g.key)).map((g) => ({ key: g.key, label: g.label, short: SHORT[g.key] })),
];

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

// null = không áp dụng (phụ phí bỏ trống thời lượng) → chuỗi rỗng, KHÔNG phải "0 phút".
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return '';
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

/**
 * Nhân vật có gói → thẻ (giữ thứ tự); nhân vật chưa có gói → gom thành MỘT dòng gọn ở cuối (mỗi tên mở hộp tạo gói).
 * Tránh nửa màn điện thoại toàn thẻ "Chưa có gói" (anh Chiến chê "Rối quá" kiểu bày ô thừa).
 */
export function splitCards(cards: readonly SubjectCard[]): { filled: SubjectCard[]; empty: SubjectCard[] } {
  return { filled: cards.filter((c) => c.packages.length > 0), empty: cards.filter((c) => c.packages.length === 0) };
}

// Danh sách mặc định ẩn món ngừng bán; chip "Cả ngừng bán" hiện lại.
export function filterActive<T extends { isActive: boolean }>(items: readonly T[], showInactive: boolean): T[] {
  return showInactive ? [...items] : items.filter((i) => i.isActive);
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
  // Đang bán (isActive). Ngừng bán không xoá gói; hợp đồng cũ giữ nguyên.
  isActive: boolean;
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
    isActive: true,
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
    isActive: p.isActive,
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
  if (f.isActive !== original.isActive) patch.isActive = f.isActive;
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
    isActive: f.isActive,
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
export function sortOrderPatches(list: readonly { id: string; sortOrder: number }[]): { id: string; sortOrder: number }[] {
  return list.flatMap((s, i) => (s.sortOrder === i ? [] : [{ id: s.id, sortOrder: i }]));
}

// ======================= Dịch vụ phụ & phụ phí =======================

export interface ServiceForm {
  // Loại SAU khi sửa: đổi loại ngay trong hộp (PATCH kind). Quyết định ô thời lượng có bắt buộc hay không.
  kind: ServiceKind;
  code: string;
  name: string;
  isActive: boolean;
  // null = để trống: chỉ phụ phí được để trống (máy chủ lưu null = "không áp dụng").
  durationMinutes: number | null;
  listPrice: Vnd | null;
  salePrice: Vnd | null;
  payRates: Record<string, Vnd | null>;
}

export function serviceToForm(s: Service | null, kind: ServiceKind = 'MAIN'): ServiceForm {
  return {
    kind: s?.kind ?? kind,
    code: s?.code ?? '',
    name: s?.name ?? '',
    isActive: s?.isActive ?? true,
    durationMinutes: s?.durationMinutes ?? null,
    listPrice: s?.currentPrice?.listPrice ?? null,
    salePrice: s?.currentPrice?.salePrice ?? null,
    payRates: {},
  };
}

// Dịch vụ trong gói (MAIN) và dịch vụ phụ (ADDON) chiếm giờ thợ → bắt buộc thời lượng. Phụ phí (ngày lễ, ngoài giờ…)
// không có thời lượng: máy chủ nhận bỏ trống và trả durationMinutes: null (catalog/services.ts durationAllowed).
export function hasDuration(kind: ServiceKind): boolean {
  return kind !== 'SURCHARGE';
}

/**
 * Hộp dịch vụ có hiện ô Thời lượng không. MAIN/ADDON: luôn hiện (bắt buộc). Phụ phí: chỉ hiện khi bản đang lưu còn số phút
 * (phụ phí cũ mang số phút giả từ thời máy chủ bắt buộc) — để người dùng TỰ xoá trống; màn không tự đổi. Có lỗi ở ô
 * (vd 400 của máy chủ) thì luôn hiện để lời lỗi nằm đúng ô.
 */
export function showDurationField(kind: ServiceKind, stored: number | null, error?: string): boolean {
  return hasDuration(kind) || stored !== null || error !== undefined;
}

export function validateServiceForm(f: ServiceForm): FormErrors {
  const e: FormErrors = {};
  if (!f.code.trim()) e.code = 'Nhập mã.';
  if (!f.name.trim()) e.name = 'Nhập tên.';
  if (f.durationMinutes === null) {
    if (hasDuration(f.kind)) e.durationMinutes = 'Nhập thời lượng.';
  } else if (f.durationMinutes < 1 || f.durationMinutes > 1440) e.durationMinutes = 'Thời lượng từ 1 đến 1440 phút.';
  if (f.listPrice === null) e.listPrice = 'Nhập giá niêm yết.';
  return e;
}

// PATCH /services/:id — chỉ trường đã đổi. Mã máy chủ tự đổi sang chữ hoa nên so ở dạng chữ hoa.
// Thời lượng để trống → gửi null chỉ khi loại (sau khi sửa) là phụ phí; MAIN/ADDON thì validateServiceForm đã chặn.
// Phụ phí cũ còn số phút giả mà người dùng không đụng tới ô → không gửi gì (không tự đổi dữ liệu cũ).
export function buildServicePatch(original: Service, f: ServiceForm): ServiceUpdateInput | null {
  const patch: ServiceUpdateInput = {};
  if (f.kind !== original.kind) patch.kind = f.kind;
  if (f.name.trim() !== original.name) patch.name = f.name.trim();
  if (f.code.trim().toUpperCase() !== original.code) patch.code = f.code.trim();
  if (f.isActive !== original.isActive) patch.isActive = f.isActive;
  if (f.durationMinutes !== original.durationMinutes) {
    if (f.durationMinutes !== null) patch.durationMinutes = f.durationMinutes;
    else if (!hasDuration(f.kind)) patch.durationMinutes = null;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

// POST /services — phụ phí KHÔNG gửi trường durationMinutes (hộp tạo phụ phí không có ô này; máy chủ lưu null).
export function buildServiceCreate(f: ServiceForm): ServiceCreateInput {
  const durationMinutes = hasDuration(f.kind) ? f.durationMinutes : null;
  if (f.listPrice === null || (hasDuration(f.kind) && durationMinutes === null)) {
    throw new Error('Gọi validateServiceForm trước khi dựng thân tạo dịch vụ');
  }
  return {
    kind: f.kind,
    code: f.code.trim(),
    name: f.name.trim(),
    isActive: f.isActive,
    ...(durationMinutes !== null ? { durationMinutes } : {}),
    listPrice: f.listPrice,
    salePrice: f.salePrice,
  };
}

// ======================= Loại sự kiện (bản vẽ D mục 3.2) =======================

// Tên tiếng Việt của 12 màu (tooltip mỗi ô màu) — đúng thứ tự OCCASION_COLORS.
export const OCCASION_COLOR_LABEL: Record<OccasionColor, string> = {
  rose: 'Hồng',
  violet: 'Tím',
  amber: 'Hổ phách',
  green: 'Xanh lá',
  blue: 'Xanh dương',
  taupe: 'Nâu xám',
  brick: 'Đỏ gạch',
  petrol: 'Xanh dầu',
  olive: 'Ô liu',
  plum: 'Mận',
  forest: 'Xanh rừng',
  brown: 'Nâu',
};

export const OCCASION_COLOR_LIST: readonly OccasionColor[] = OCCASION_COLORS;
export const OCCASION_NAME_MAX = 60;

export const occasionSubtitle = (count: number) => `${count} loại · màu dùng chung 12 màu của Lịch`;

// Số dòng hợp đồng CHƯA HUỶ đang dùng loại (lineCount do máy chủ đếm).
export const occasionUsage = (lineCount: number) => (lineCount === 0 ? 'Chưa có dòng hợp đồng nào dùng' : `${lineCount} dòng hợp đồng đang dùng`);

export function sortOccasions(list: readonly OccasionView[]): OccasionView[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi') || a.id.localeCompare(b.id));
}

export interface OccasionForm {
  name: string;
  // null = chưa chọn: không có màu mặc định im lặng.
  color: OccasionColor | null;
}

export function occasionToForm(o: OccasionView | null): OccasionForm {
  return { name: o?.name ?? '', color: o?.color ?? null };
}

export function validateOccasionForm(f: OccasionForm): FormErrors {
  const e: FormErrors = {};
  const name = f.name.trim();
  if (!name) e.name = 'Nhập tên loại sự kiện.';
  else if (name.length > OCCASION_NAME_MAX) e.name = `Tên tối đa ${OCCASION_NAME_MAX} ký tự.`;
  if (f.color === null) e.color = 'Chọn một màu.';
  return e;
}

// POST /occasions — gọi sau validateOccasionForm không lỗi. sortOrder: xếp cuối danh sách.
export function buildOccasionCreate(f: OccasionForm, sortOrder: number): OccasionCreateInput {
  if (f.color === null) throw new Error('Gọi validateOccasionForm trước khi dựng thân tạo loại sự kiện');
  return { name: f.name.trim(), color: f.color, sortOrder, isActive: true };
}

// PATCH /occasions/:id — chỉ trường đã đổi; không đổi gì → null (không gọi, máy chủ sẽ báo "Không có gì để sửa").
export function buildOccasionPatch(original: OccasionView, f: OccasionForm): OccasionUpdateInput | null {
  const patch: OccasionUpdateInput = {};
  if (f.name.trim() !== original.name) patch.name = f.name.trim();
  if (f.color !== null && f.color !== original.color) patch.color = f.color;
  return Object.keys(patch).length > 0 ? patch : null;
}

// 409 trùng tên → dưới ô Tên; 409 "Tối đa 50 loại sự kiện" và mọi lỗi khác → dải đầu hộp. Lời luôn là lời máy chủ.
export function mapOccasionError(err: unknown): MappedError {
  const m = mapSaveError(err, 'create');
  if (errorKind(err) === 'conflict' && m.banner !== null && /^Tên /.test(m.banner)) return { fields: { name: m.banner }, banner: null };
  return m;
}

// ======================= Luật phụ phí (bản vẽ D mục 3.3) =======================

export const RULE_NAME_MAX = 120;
export const RULE_NOTE_MAX = 500;

// 1 = Thứ Hai … 7 = Chủ nhật (khớp máy chủ).
export const WEEKDAY_OPTIONS: readonly { value: number; short: string; long: string }[] = [
  { value: 1, short: 'T2', long: 'Thứ Hai' },
  { value: 2, short: 'T3', long: 'Thứ Ba' },
  { value: 3, short: 'T4', long: 'Thứ Tư' },
  { value: 4, short: 'T5', long: 'Thứ Năm' },
  { value: 5, short: 'T6', long: 'Thứ Sáu' },
  { value: 6, short: 'T7', long: 'Thứ Bảy' },
  { value: 7, short: 'CN', long: 'Chủ nhật' },
];

export const RULE_STATUS_TEXT: Record<Exclude<SurchargeRuleStatus, 'OK'>, string> = {
  SERVICE_INACTIVE: 'Phụ phí đang ngừng — luật không chạy',
  SERVICE_NOT_SURCHARGE: 'Dịch vụ không còn là phụ phí — luật không chạy',
  NO_PRICE: 'Phụ phí chưa có giá — luật không chạy',
};

// Ngày lễ cố định theo dương lịch: 1/1, 30/4, 1/5, 2/9. Tết âm lịch thì thêm từng ngày (tooltip ở hộp).
export function holidayDates(year: number): string[] {
  if (!Number.isInteger(year) || year < 1900 || year > 2999) throw new Error(`Năm không hợp lệ: ${year}`);
  return [`${year}-01-01`, `${year}-04-30`, `${year}-05-01`, `${year}-09-02`];
}

// Gộp ngày, bỏ trùng, tăng dần ("YYYY-MM-DD" so chuỗi là so ngày).
export function mergeDates(existing: readonly string[], added: readonly string[]): string[] {
  return [...new Set([...existing, ...added])].sort();
}

export const viDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

export interface RuleLookups {
  occasions: readonly { id: string; name: string }[];
  packages: readonly { id: string; name: string }[];
  subjects: readonly { id: string; name: string }[];
}

const namesOf = (ids: readonly string[], list: readonly { id: string; name: string }[], missing: string) => {
  const byId = new Map(list.map((x) => [x.id, x.name]));
  return ids.map((id) => byId.get(id) ?? missing).join(', ');
};

/**
 * Tóm tắt điều kiện bằng chữ, ví dụ "Giờ bắt đầu 00:00–06:00 · Lễ cưới, Lễ vu quy · Gói Cô dâu cao cấp".
 * Các phần ghép bằng " · " (mọi phần đã có phải cùng đúng); trong phần ngày, thứ HOẶC ngày cụ thể.
 */
export function summarizeRule(rule: SurchargeRuleView, lk: RuleLookups): string {
  const parts: string[] = [];
  if (rule.startTime !== null && rule.endTime !== null) parts.push(`Giờ bắt đầu ${rule.startTime}–${rule.endTime}`);
  const days: string[] = [];
  if (rule.weekdays.length > 0) {
    // 1..6 = Thứ 2..Thứ 7 ("Thứ 6, 7"), 7 = Chủ nhật.
    const sorted = [...rule.weekdays].sort((a, b) => a - b);
    const nums = sorted.filter((d) => d <= 6).map((d) => String(d + 1));
    days.push([...(nums.length > 0 ? [`Thứ ${nums.join(', ')}`] : []), ...(sorted.includes(7) ? ['Chủ nhật'] : [])].join(', '));
  }
  if (rule.dates.length > 0) days.push(rule.dates.length <= 3 ? `ngày ${rule.dates.map(viDate).join(', ')}` : `${rule.dates.length} ngày cụ thể`);
  if (days.length > 0) parts.push(days.join(' hoặc '));
  if (rule.occasionIds.length > 0) parts.push(namesOf(rule.occasionIds, lk.occasions, 'Loại sự kiện không rõ'));
  if (rule.packageIds.length > 0) parts.push(`Gói ${namesOf(rule.packageIds, lk.packages, 'không rõ')}`);
  if (rule.subjectIds.length > 0) parts.push(`Nhân vật ${namesOf(rule.subjectIds, lk.subjects, 'không rõ')}`);
  return parts.join(' · ');
}

export interface RuleForm {
  name: string;
  // '' = chưa chọn phụ phí.
  serviceId: string;
  useTime: boolean;
  startTime: string | null;
  // Ô "Đến": nửa đêm gõ 00:00 (ô giờ không nhận 24:00); máy chủ nhận 24:00 — xem wireEnd / ruleToForm.
  endTime: string | null;
  useDays: boolean;
  weekdays: number[];
  dates: string[];
  useOccasions: boolean;
  occasionIds: string[];
  packageIds: string[];
  subjectIds: string[];
  perQuantity: boolean;
  note: string;
  isActive: boolean;
}

export function emptyRuleForm(): RuleForm {
  return {
    name: '',
    serviceId: '',
    useTime: false,
    startTime: null,
    endTime: null,
    useDays: false,
    weekdays: [],
    dates: [],
    useOccasions: false,
    occasionIds: [],
    packageIds: [],
    subjectIds: [],
    perQuantity: true,
    note: '',
    isActive: true,
  };
}

export function ruleToForm(r: SurchargeRuleView | null): RuleForm {
  if (!r) return emptyRuleForm();
  return {
    name: r.name,
    serviceId: r.serviceId,
    useTime: r.startTime !== null,
    startTime: r.startTime,
    endTime: r.endTime === '24:00' ? '00:00' : r.endTime,
    useDays: r.weekdays.length > 0 || r.dates.length > 0,
    weekdays: [...r.weekdays],
    dates: [...r.dates],
    useOccasions: r.occasionIds.length > 0,
    occasionIds: [...r.occasionIds],
    packageIds: [...r.packageIds],
    subjectIds: [...r.subjectIds],
    perQuantity: r.perQuantity,
    note: r.note ?? '',
    isActive: r.isActive,
  };
}

// Giờ "Đến" gửi máy chủ: nửa đêm = 24:00 (máy chủ không nhận 00:00 ở ô kết thúc). 00:00 → 00:00 vẫn là lỗi "phải khác nhau".
export function wireEnd(start: string | null, end: string | null): string | null {
  return end === '00:00' && start !== null && start !== '00:00' ? '24:00' : end;
}

export function validateRuleForm(f: RuleForm): FormErrors {
  const e: FormErrors = {};
  if (!f.name.trim()) e.name = 'Nhập tên luật.';
  else if (f.name.trim().length > RULE_NAME_MAX) e.name = `Tên luật tối đa ${RULE_NAME_MAX} ký tự.`;
  if (f.serviceId === '') e.serviceId = 'Chọn phụ phí thu.';
  if (f.useTime) {
    if (f.startTime === null) e.startTime = 'Nhập giờ bắt đầu.';
    if (f.endTime === null) e.endTime = 'Nhập giờ kết thúc.';
    if (f.startTime !== null && f.endTime !== null && f.startTime === f.endTime) e.endTime = 'Giờ bắt đầu và kết thúc phải khác nhau.';
  }
  if (f.useDays && f.weekdays.length === 0 && f.dates.length === 0) e.days = 'Chọn ít nhất một thứ hoặc một ngày.';
  if (f.useOccasions && f.occasionIds.length === 0) e.occasionIds = 'Chọn ít nhất một loại sự kiện.';
  if (f.note.trim().length > RULE_NOTE_MAX) e.note = `Ghi chú tối đa ${RULE_NOTE_MAX} ký tự.`;
  return e;
}

// Điều kiện thật sự gửi đi: nhóm bỏ tick thì coi như rỗng (dù trong ô còn dữ liệu cũ).
function effective(f: RuleForm) {
  return {
    startTime: f.useTime ? f.startTime : null,
    endTime: f.useTime ? wireEnd(f.startTime, f.endTime) : null,
    weekdays: f.useDays ? [...f.weekdays].sort((a, b) => a - b) : [],
    dates: f.useDays ? [...f.dates].sort() : [],
    occasionIds: f.useOccasions ? [...f.occasionIds] : [],
    packageIds: [...f.packageIds],
    subjectIds: [...f.subjectIds],
  };
}

// POST /surcharge-rules — gọi sau validateRuleForm không lỗi. Chỉ gửi nhóm có dữ liệu; luật chưa có điều kiện nào thì máy chủ trả 400.
export function buildRuleCreate(f: RuleForm, sortOrder: number): SurchargeRuleCreateInput {
  if (f.serviceId === '') throw new Error('Gọi validateRuleForm trước khi dựng thân tạo luật');
  const x = effective(f);
  const note = f.note.trim();
  return {
    name: f.name.trim(),
    serviceId: f.serviceId,
    ...(x.startTime !== null && x.endTime !== null ? { startTime: x.startTime, endTime: x.endTime } : {}),
    ...(x.weekdays.length > 0 ? { weekdays: x.weekdays } : {}),
    ...(x.dates.length > 0 ? { dates: x.dates } : {}),
    ...(x.occasionIds.length > 0 ? { occasionIds: x.occasionIds } : {}),
    ...(x.packageIds.length > 0 ? { packageIds: x.packageIds } : {}),
    ...(x.subjectIds.length > 0 ? { subjectIds: x.subjectIds } : {}),
    perQuantity: f.perQuantity,
    ...(note ? { note } : {}),
    sortOrder,
    isActive: f.isActive,
  };
}

// PATCH /surcharge-rules/:id — chỉ nhóm đã đổi; mảng gửi lên thay toàn bộ mảng cũ; bỏ khung giờ = startTime/endTime null.
export function buildRulePatch(original: SurchargeRuleView, f: RuleForm): SurchargeRuleUpdateInput | null {
  const x = effective(f);
  const patch: SurchargeRuleUpdateInput = {};
  if (f.name.trim() !== original.name) patch.name = f.name.trim();
  if (f.serviceId !== '' && f.serviceId !== original.serviceId) patch.serviceId = f.serviceId;
  if (x.startTime !== original.startTime || x.endTime !== original.endTime) {
    patch.startTime = x.startTime;
    patch.endTime = x.endTime;
  }
  if (!sameSet(x.weekdays, original.weekdays)) patch.weekdays = x.weekdays;
  if (!sameSet(x.dates, original.dates)) patch.dates = x.dates;
  if (!sameSet(x.occasionIds, original.occasionIds)) patch.occasionIds = x.occasionIds;
  if (!sameSet(x.packageIds, original.packageIds)) patch.packageIds = x.packageIds;
  if (!sameSet(x.subjectIds, original.subjectIds)) patch.subjectIds = x.subjectIds;
  if (f.perQuantity !== original.perQuantity) patch.perQuantity = f.perQuantity;
  const note = f.note.trim() === '' ? null : f.note.trim();
  if (note !== original.note) patch.note = note;
  if (f.isActive !== original.isActive) patch.isActive = f.isActive;
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * Lỗi lưu luật → ô. 400 theo details.issues[].path; lời "chưa có điều kiện nào" của máy chủ nằm ở startTime/endTime, mà ô giờ
 * đang ẩn (chưa tick) thì đặt dưới nhóm "Khi nào áp" (khoá `conditions`). weekdays/dates → khoá `days`. 409 trùng tên →
 * dưới ô Tên; 409 "Tối đa 50 luật đang bật", 404, 403 → dải đầu hộp. Lời luôn là lời máy chủ.
 */
export function mapRuleError(err: unknown, form: RuleForm): MappedError {
  const m = mapSaveError(err, 'create');
  if (errorKind(err) === 'conflict' && m.banner !== null && /^Tên /.test(m.banner)) return { fields: { name: m.banner }, banner: null };
  const fields: FormErrors = {};
  for (const [k, v] of Object.entries(m.fields)) {
    if ((k === 'startTime' || k === 'endTime') && !form.useTime) fields.conditions ??= v;
    else if (k === 'weekdays' || k === 'dates') fields.days ??= v;
    else fields[k] ??= v;
  }
  // Lỗi 400 không có đường dẫn nhưng có details.fields (vd phụ phí đã ngừng): đặt đúng ô nếu biết.
  if (m.banner !== null && errorKind(err) === 'validation' && err instanceof ApiError) {
    const named = (err.details as { fields?: unknown } | undefined)?.fields;
    if (Array.isArray(named) && named.includes('serviceId')) return { fields: { ...fields, serviceId: m.banner }, banner: null };
  }
  return { fields, banner: m.banner };
}
