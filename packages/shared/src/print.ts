import type { ContractStatus } from './contract';
import type { ContractKindKey } from './design-templates';
import { MAX_MONEY_VND, assertVnd, formatVnd, type Vnd } from './money';
import type { PaymentMethod } from './payments';

// Mẫu in hợp đồng (bản vẽ G mục 3.1 + đính chính 25/10/2026 mục 5) — danh mục dùng chung máy chủ + web.
// Danh mục là MÃ NGUỒN, không nằm trong database (giống design-templates.ts): máy chủ dùng để kiểm dữ liệu gửi lên,
// web dùng để vẽ. Thêm khối / bố cục = sửa Ở ĐÂY, không chép danh sách sang nơi khác.

// Bản vẽ ghi `ContractKind`; trong shared tên đó là ContractKindKey (design-templates.ts) — không xuất tên thứ hai.
type ContractKind = ContractKindKey;

// ---------- Lỗi có tên ----------

export class VndInWordsError extends RangeError {
  override name = 'VndInWordsError';
}

export class PrintCatalogError extends Error {
  override name = 'PrintCatalogError';
}

// ---------- Bố cục + khối ----------

export const PRINT_LAYOUTS = [1, 2, 3, 4, 5] as const;
export type PrintLayout = (typeof PRINT_LAYOUTS)[number];
export const PRINT_LAYOUT_NAMES: Record<PrintLayout, string> = {
  1: 'Cổ điển trang trọng',
  2: 'Hiện đại tối giản',
  3: 'Bảng kẻ đầy đủ',
  4: 'Gọn một trang',
  5: 'Sang trọng viền & logo lớn',
};

export function isPrintLayout(value: unknown): value is PrintLayout {
  return typeof value === 'number' && (PRINT_LAYOUTS as readonly number[]).includes(value);
}

// Khối LUÔN CÓ (không có công tắc): tiêu đề + số, bảng dịch vụ/khoá học, tổng tiền, chỗ ký.
export const ALWAYS_ON_BLOCKS = ['tieu-de', 'dich-vu', 'tien', 'chu-ky'] as const;
export type AlwaysOnBlockKey = (typeof ALWAYS_ON_BLOCKS)[number];

// Khối bật/tắt được — đúng khoá của R&D (docs/rnd/v9-mau-in/chung/ban-in.js:22-44). kinds: loại hợp đồng có khối này.
export const TOGGLE_BLOCKS = {
  'quoc-hieu': { label: 'Quốc hiệu – tiêu ngữ', hint: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM…', kinds: ['SERVICE', 'COURSE'] },
  'dau-trang': { label: 'Đầu trang', hint: 'Logo, tên, địa chỉ, SĐT — Hồ sơ thương hiệu', kinds: ['SERVICE', 'COURSE'] },
  'hai-ben': { label: 'Thông tin hai bên', hint: 'Bên A studio · Bên B khách', kinds: ['SERVICE', 'COURSE'] },
  'giay-to': { label: 'CCCD + địa chỉ khách', hint: 'Chưa có dữ liệu thì in dòng chấm để điền tay', kinds: ['SERVICE', 'COURSE'] },
  'chu-dau': { label: 'Chữ mở đầu', hint: '', kinds: ['SERVICE', 'COURSE'] },
  'chi-tiet': { label: 'Giờ, địa điểm / lịch học', hint: '05:00–07:30 · Tại nhà khách: …', kinds: ['SERVICE', 'COURSE'] },
  tho: { label: 'Tên thợ', hint: 'Thợ chính / thợ phụ', kinds: ['SERVICE'] },
  'bang-chu': { label: 'Số tiền bằng chữ', hint: '“Bảy triệu một trăm năm mươi hai nghìn đồng”', kinds: ['SERVICE', 'COURSE'] },
  'tien-do': { label: 'Tiến độ thanh toán', hint: 'Các đợt + hạn + đã thu', kinds: ['SERVICE', 'COURSE'] },
  'da-thu': { label: 'Phiếu thu đã nhận', hint: 'Mã phiếu, ngày, hình thức', kinds: ['SERVICE', 'COURSE'] },
  'chuyen-khoan': { label: 'Tài khoản chuyển khoản', hint: 'Nhập ở Thông tin trên hợp đồng', kinds: ['SERVICE', 'COURSE'] },
  'dieu-khoan': { label: 'Điều khoản', hint: 'Bản chụp lúc xác nhận', kinds: ['SERVICE', 'COURSE'] },
  'noi-quy': { label: 'Nội quy', hint: 'Bản chụp lúc xác nhận', kinds: ['COURSE'] },
  'ghi-chu': { label: 'Ghi chú hợp đồng', hint: '', kinds: ['SERVICE', 'COURSE'] },
  'chu-cuoi': { label: 'Chữ kết thúc', hint: '', kinds: ['SERVICE', 'COURSE'] },
  'ky-nhay': { label: 'Ô ký nháy cuối mỗi trang', hint: 'Ký nháy A ___ B ___ (Safari không in)', kinds: ['SERVICE', 'COURSE'] },
  'so-trang': { label: 'Số hợp đồng + số trang cuối trang', hint: 'HĐDV-000128 · Trang 1/2 (Safari không in)', kinds: ['SERVICE', 'COURSE'] },
} as const satisfies Record<string, { label: string; hint: string; kinds: readonly ContractKind[] }>;
export type ToggleBlockKey = keyof typeof TOGGLE_BLOCKS;
export type PrintBlockKey = ToggleBlockKey | AlwaysOnBlockKey;

export const TOGGLE_BLOCK_KEYS = Object.keys(TOGGLE_BLOCKS) as ToggleBlockKey[];
// Đủ 21 khoá (4 luôn có + 17 bật/tắt) — thứ tự: luôn có trước.
export const PRINT_BLOCK_KEYS: readonly PrintBlockKey[] = [...ALWAYS_ON_BLOCKS, ...TOGGLE_BLOCK_KEYS];

export function isToggleBlockKey(value: unknown): value is ToggleBlockKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TOGGLE_BLOCKS, value);
}

export function blockAppliesTo(key: PrintBlockKey, kind: ContractKind): boolean {
  if ((ALWAYS_ON_BLOCKS as readonly string[]).includes(key)) return true;
  return (TOGGLE_BLOCKS[key as ToggleBlockKey].kinds as readonly ContractKind[]).includes(kind);
}

// Khối TẮT sẵn theo bố cục (R&D MAC_DINH_TAT, ban-in.js:46).
export const LAYOUT_DEFAULT_OFF: Record<PrintLayout, readonly ToggleBlockKey[]> = {
  1: [],
  2: ['quoc-hieu', 'ky-nhay'],
  3: ['quoc-hieu'],
  4: ['quoc-hieu', 'ky-nhay', 'giay-to'],
  5: ['quoc-hieu', 'ky-nhay'],
};

export const DEFAULT_PRINT_TITLE: Record<ContractKind, string> = {
  SERVICE: 'HỢP ĐỒNG DỊCH VỤ TRANG ĐIỂM',
  COURSE: 'HỢP ĐỒNG ĐÀO TẠO',
};
export const DEFAULT_OPENING_TEXT: Record<ContractKind, string> = {
  SERVICE: 'Hai bên thoả thuận ký hợp đồng dịch vụ trang điểm cho sự kiện ngày {Ngày sự kiện} với các nội dung sau:',
  COURSE: 'Hai bên thoả thuận ký hợp đồng đào tạo khoá {Tên khoá}, lớp {Tên lớp}, khai giảng ngày {Ngày khai giảng} với các nội dung sau:',
};
export const DEFAULT_CLOSING_TEXT = 'Hợp đồng có hiệu lực từ ngày ký, lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.';

// Biến chèn trong ba ô chữ. kinds: biến dùng được cho loại hợp đồng nào.
export const PRINT_VARIABLES = {
  'Tên studio': ['SERVICE', 'COURSE'],
  'Địa chỉ studio': ['SERVICE', 'COURSE'],
  'SĐT studio': ['SERVICE', 'COURSE'],
  'Người đại diện': ['SERVICE', 'COURSE'],
  'Tên khách': ['SERVICE', 'COURSE'],
  'SĐT khách': ['SERVICE', 'COURSE'],
  'Mã hợp đồng': ['SERVICE', 'COURSE'],
  'Ngày lập': ['SERVICE', 'COURSE'],
  'Tổng tiền': ['SERVICE', 'COURSE'],
  'Tổng tiền bằng chữ': ['SERVICE', 'COURSE'],
  'Tiền cọc': ['SERVICE', 'COURSE'],
  'Đã thu': ['SERVICE', 'COURSE'],
  'Còn lại': ['SERVICE', 'COURSE'],
  'Ngày sự kiện': ['SERVICE'],
  'Tên khoá': ['COURSE'],
  'Tên lớp': ['COURSE'],
  'Ngày khai giảng': ['COURSE'],
} as const satisfies Record<string, readonly ContractKind[]>;
export type PrintVariableName = keyof typeof PRINT_VARIABLES;

export function isPrintVariable(name: string): name is PrintVariableName {
  return Object.prototype.hasOwnProperty.call(PRINT_VARIABLES, name);
}

// Giá trị bị che hoặc không có trên bản in.
export const PRINT_BLANK = '……';

// ---------- Cấu hình đã gộp ----------

export interface ResolvedPrintConfig {
  templateId: string;
  templateName: string;
  templateVersion: number;
  layout: PrintLayout;
  blocks: Record<PrintBlockKey, boolean>; // đủ 21 khoá, tường minh
  title: string;
  openingText: string;
  closingText: string;
}

// Phần của PrintTemplate (database) mà resolvePrintConfig cần. blocks là JSON thô: chỉ khoá bật/tắt, giá trị boolean.
export interface PrintTemplateLike {
  id: string;
  name: string;
  version: number;
  layout: number;
  blocks: unknown;
  title: string | null;
  openingText: string | null;
  closingText: string | null;
}

export type PrintBlockOverrides = Partial<Record<ToggleBlockKey, boolean>>;

function checkBlockMap(raw: unknown, where: string): PrintBlockOverrides {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PrintCatalogError(`${where}: phải là đối tượng { khoá khối: true|false }`);
  }
  const out: PrintBlockOverrides = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isToggleBlockKey(k)) throw new PrintCatalogError(`${where}: khoá khối lạ hoặc không tắt được "${k}"`);
    if (typeof v !== 'boolean') throw new PrintCatalogError(`${where}: khối "${k}" phải là true/false, nhận ${String(v)}`);
    out[k] = v;
  }
  return out;
}

// Gộp: mặc định bố cục → blocks của mẫu → overrides (công tắc nhanh trong hộp In).
// Khối luôn có = true. Khối không thuộc loại hợp đồng = false. Chữ NULL thay bằng mặc định theo loại.
// Bố cục lạ, khoá khối lạ, giá trị không phải boolean → ném PrintCatalogError (không lặng lẽ bỏ qua).
export function resolvePrintConfig(t: PrintTemplateLike, kind: ContractKind, overrides?: PrintBlockOverrides): ResolvedPrintConfig {
  if (kind !== 'SERVICE' && kind !== 'COURSE') throw new PrintCatalogError(`Loại hợp đồng lạ: ${String(kind)}`);
  if (!isPrintLayout(t.layout)) throw new PrintCatalogError(`Bố cục lạ: ${String(t.layout)} (chỉ nhận 1–5)`);
  const layout = t.layout;
  const stored = checkBlockMap(t.blocks, 'blocks của mẫu');
  const quick = overrides === undefined ? {} : checkBlockMap(overrides, 'công tắc nhanh');
  const off = LAYOUT_DEFAULT_OFF[layout];
  const blocks = {} as Record<PrintBlockKey, boolean>;
  for (const k of ALWAYS_ON_BLOCKS) blocks[k] = true;
  for (const k of TOGGLE_BLOCK_KEYS) {
    if (!blockAppliesTo(k, kind)) {
      blocks[k] = false;
      continue;
    }
    blocks[k] = quick[k] ?? stored[k] ?? !off.includes(k);
  }
  return {
    templateId: t.id,
    templateName: t.name,
    templateVersion: t.version,
    layout,
    blocks,
    title: t.title ?? DEFAULT_PRINT_TITLE[kind],
    openingText: t.openingText ?? DEFAULT_OPENING_TEXT[kind],
    closingText: t.closingText ?? DEFAULT_CLOSING_TEXT,
  };
}

// ---------- Dữ liệu in, phiên bản 1 (máy chủ dựng, web chỉ vẽ) ----------

export const PRINT_DATA_VERSION = 1 as const;
export type LocalDate = string; // 'YYYY-MM-DD' theo múi giờ tổ chức
export type LocalTime = string; // 'HH:mm'

export interface ContractPrintData {
  version: 1;
  kind: ContractKind;
  contract: { code: string; status: ContractStatus; issuedOn: LocalDate /* confirmedAt ?? createdAt */; eventDate: LocalDate | null; notes: string | null };
  studio: {
    name: string; // brandName của hồ sơ; chưa có hồ sơ → Organization.name
    tagline: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    logoFileId: string | null; // URL ký KHÔNG nằm trong bản chụp (hết hạn) — trả riêng ở logoUrl
    representative: { name: string; title: string | null } | null;
    bank: { bankName: string; accountNumber: string; accountName: string } | null;
  };
  customer: { fullName: string; phone: string | null; email: string | null; contactHidden: boolean };
  lines: PrintLine[]; // dòng GỐC chưa huỷ, theo sort_order, created_at
  money: { subtotal: Vnd; discount: Vnd; total: Vnd; totalInWords: string; depositRequired: Vnd; depositInWords: string; travelTotal: Vnd };
  payments: PrintPayments | null; // null ⇔ paymentsHidden
  paymentsHidden: boolean;
  terms: PrintText | null;
  rules: PrintText | null; // chỉ COURSE
}

export interface PrintLine {
  kind: 'PACKAGE' | 'SERVICE' | 'SURCHARGE' | 'CUSTOM' | 'COURSE';
  name: string;
  subjectName: string | null;
  quantity: number;
  unitPrice: Vnd;
  lineDiscount: Vnd;
  lineTotal: Vnd;
  // Hợp đồng có nhiều hơn một `date` khác nhau: bản in hiện "dd/mm · HH:MM–HH:MM" (đính chính 5); một ngày giữ như cũ.
  date: LocalDate | null;
  startTime: LocalTime | null;
  endTime: LocalTime | null;
  location: { type: 'STUDIO' | 'CUSTOMER_HOME' | 'OTHER'; text: string | null } | null; // STUDIO: "tên cơ sở — địa chỉ"
  note: string | null;
  staff: { primary: string[]; assist: string[] };
  addedAfterConfirm: boolean;
  addedOn: LocalDate | null; // "phát sinh dd/mm" trên bản in
  addons: PrintSubLine[]; // ADDON chưa huỷ
  // Đính chính 25/10/2026 mục 5 (bản vẽ D mục 3.4): dòng con SURCHARGE chưa huỷ của dòng gốc — dòng tự thêm theo luật
  // VÀ dòng nhập tay gắn vào dòng gốc. Chỉ in tên + số lượng + tiền (lineTotal máy chủ); KHÔNG mang tên luật,
  // chữ "tự thêm theo luật" hay ghi chú ghi đè giá (PrintSubLine không có các trường đó).
  surcharges: PrintSubLine[];
  travel: PrintTravel | null; // TRAVEL chưa huỷ
  course: PrintCourse | null; // chỉ dòng COURSE
}

export interface PrintSubLine {
  name: string;
  quantity: number;
  unitPrice: Vnd;
  lineDiscount: Vnd;
  lineTotal: Vnd;
  addedAfterConfirm: boolean;
  addedOn: LocalDate | null;
}

export interface PrintTravel extends PrintSubLine {
  mode: string | null;
  distanceKm: number | null;
  perKmAmount: Vnd | null;
  breakdown: {
    includedKm: number | null;
    includedFrom: 'PACKAGE' | 'ORGANIZATION' | null;
    excessKm: number | null;
    chargedKm: number | null;
    roundTrip: boolean;
    tier: { fromKm: number; toKm: number | null; amount: Vnd } | null;
  } | null;
}

export interface PrintCourse {
  courseName: string;
  className: string;
  startDate: LocalDate;
  endDate: LocalDate;
  weekdays: number[];
  startTime: LocalTime | null;
  endTime: LocalTime | null;
  sessionCount: number | null;
  instructorName: string | null;
  location: { name: string; address: string } | null;
}

export interface PrintPayments {
  installments: { name: string; dueDate: LocalDate; amount: Vnd; isDeposit: boolean; paid: Vnd; state: 'PAID' | 'PARTIAL' | 'UNPAID' }[];
  receipts: { code: string; kind: 'RECEIPT' | 'REFUND'; method: PaymentMethod; amount: Vnd; receivedOn: LocalDate }[]; // chưa huỷ
  paid: Vnd;
  remaining: Vnd;
  remainingInWords: string;
  scheduleDifference: Vnd | null; // Σ đợt − tổng (giống loadProgress); ≠ 0 → cảnh báo
}

export interface PrintText {
  title: string;
  items: string[];
  source: { name: string; version: number } | null;
  snapshot: boolean;
}

// ---------- Tiền bằng chữ ----------

// Ký duyệt G mục 8: "linh" (mặc định). Muốn "lẻ" thì đổi ĐÚNG dòng này.
const ZERO_TENS_WORD = 'linh';
const DIGIT_WORDS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'] as const;
const GROUP_UNITS = ['', 'nghìn', 'triệu', 'tỷ'] as const;

// Đọc một nhóm ba chữ số (0 < x < 1000). full = nhóm KHÔNG đứng đầu ⇒ đọc đủ "không trăm", "linh".
function readTriple(x: number, full: boolean): string[] {
  const h = Math.floor(x / 100);
  const t = Math.floor((x % 100) / 10);
  const u = x % 10;
  const out: string[] = [];
  if (full || h > 0) out.push(DIGIT_WORDS[h]!, 'trăm');
  if (t === 0 && u > 0 && (full || h > 0)) out.push(ZERO_TENS_WORD);
  if (t === 1) out.push('mười');
  else if (t > 1) out.push(DIGIT_WORDS[t]!, 'mươi');
  if (u > 0) {
    if (u === 1 && t > 1) out.push('mốt');
    else if (u === 5 && t > 0) out.push('lăm');
    else if (u === 4 && t > 1) out.push('tư');
    else out.push(DIGIT_WORDS[u]!);
  }
  return out;
}

// Đọc số tiền thành chữ: viết hoa chữ đầu, "đồng" ở cuối. Thuật toán như bangChu của R&D (ban-in.js:66-91), làm trên
// số nguyên. Nhận Vnd (số nguyên đồng) hoặc bigint (cột BIGINT của database).
// Số âm, không nguyên, không phải số, > MAX_MONEY_VND → ném VndInWordsError (không trả chuỗi rỗng).
export function vndInWords(n: Vnd | bigint): string {
  let value: number;
  if (typeof n === 'bigint') {
    if (n < 0n || n > BigInt(MAX_MONEY_VND)) throw new VndInWordsError(`Số tiền ngoài khoảng 0–${MAX_MONEY_VND}: ${n.toString()}`);
    value = Number(n);
  } else {
    try {
      value = assertVnd(n);
    } catch (e) {
      throw new VndInWordsError(`Số tiền phải là số nguyên đồng, nhận: ${String(n)}`, { cause: e });
    }
    if (value < 0) throw new VndInWordsError(`Số tiền không được âm: ${value}`);
    if (value > MAX_MONEY_VND) throw new VndInWordsError(`Số tiền vượt trần ${MAX_MONEY_VND}: ${value}`);
  }
  if (value === 0) return 'Không đồng';
  const groups: number[] = [];
  for (let x = value; x > 0; x = Math.floor(x / 1000)) groups.push(x % 1000);
  if (groups.length > GROUP_UNITS.length) throw new VndInWordsError(`Chưa đọc được số từ nghìn tỷ trở lên: ${value}`);
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]!;
    if (g === 0) continue;
    words.push(...readTriple(g, i < groups.length - 1));
    if (GROUP_UNITS[i]) words.push(GROUP_UNITS[i]!);
  }
  const s = `${words.join(' ')} đồng`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- Điều khoản, biến chèn ----------

// Tách theo dòng, bỏ dòng trống, bỏ số đầu dòng "12." / "12)" (giống ContractPrint.tsx:113). Số giữa câu giữ nguyên.
export function splitClauses(body: string | null): string[] {
  if (!body) return [];
  return body
    .split(/\r?\n/)
    .map((s) => s.trim().replace(/^\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}

const VARIABLE_RE = /\{([^{}]+)\}/g;

// Tên các biến dạng {…} (không lồng nhau), theo thứ tự xuất hiện, không lặp.
export function variablesIn(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(VARIABLE_RE)) seen.add(m[1]!);
  return [...seen];
}

// Biến lạ, hoặc biến không dùng được cho MỌI loại trong kinds. kinds rỗng → ném lỗi (phạm vi trống).
export function checkTemplateText(
  text: string,
  kinds: readonly ContractKind[],
): { unknown: string[]; wrongKind: { name: string; onlyFor: ContractKind[] }[] } {
  if (kinds.length === 0) throw new PrintCatalogError('checkTemplateText: phải có ít nhất một loại hợp đồng');
  const unknown: string[] = [];
  const wrongKind: { name: string; onlyFor: ContractKind[] }[] = [];
  for (const name of variablesIn(text)) {
    if (!isPrintVariable(name)) {
      unknown.push(name);
      continue;
    }
    const allowed = PRINT_VARIABLES[name] as readonly ContractKind[];
    if (!kinds.every((k) => allowed.includes(k))) wrongKind.push({ name, onlyFor: [...allowed] });
  }
  return { unknown, wrongKind };
}

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseLocalDate(iso: LocalDate): { y: number; m: number; d: number } {
  const match = typeof iso === 'string' ? LOCAL_DATE_RE.exec(iso) : null;
  if (!match) throw new PrintCatalogError(`Ngày không đúng dạng YYYY-MM-DD: "${String(iso)}"`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    throw new PrintCatalogError(`Ngày không có thật: "${iso}"`);
  }
  return { y, m, d };
}

// "2026-10-19" → "19/10/2026".
export function formatLocalDate(iso: LocalDate): string {
  const { y, m, d } = parseLocalDate(iso);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

// "2026-10-19" → "ngày 19 tháng 10 năm 2026". Theo thể thức văn bản (NĐ 30/2020): ngày < 10 và tháng 1, 2 thêm số 0
// ("ngày 05 tháng 02 năm 2026"); tháng 3–12 không thêm ("ngày 05 tháng 3 năm 2026").
export function longLocalDate(iso: LocalDate): string {
  const { y, m, d } = parseLocalDate(iso);
  const month = m <= 2 ? String(m).padStart(2, '0') : String(m);
  return `ngày ${String(d).padStart(2, '0')} tháng ${month} năm ${y}`;
}

// Giá trị từng biến, đã định dạng. Bị che hoặc không có → PRINT_BLANK. Biến không thuộc loại hợp đồng → PRINT_BLANK.
export function variableValues(d: ContractPrintData): Record<PrintVariableName, string> {
  const or = (v: string | null | undefined) => (v === null || v === undefined || v === '' ? PRINT_BLANK : v);
  const course = d.kind === 'COURSE' ? (d.lines.find((l) => l.course !== null)?.course ?? null) : null;
  return {
    'Tên studio': or(d.studio.name),
    'Địa chỉ studio': or(d.studio.address),
    'SĐT studio': or(d.studio.phone),
    'Người đại diện': or(d.studio.representative?.name),
    'Tên khách': or(d.customer.fullName),
    'SĐT khách': d.customer.contactHidden ? PRINT_BLANK : or(d.customer.phone),
    'Mã hợp đồng': or(d.contract.code),
    'Ngày lập': formatLocalDate(d.contract.issuedOn),
    'Tổng tiền': formatVnd(d.money.total),
    'Tổng tiền bằng chữ': or(d.money.totalInWords),
    'Tiền cọc': formatVnd(d.money.depositRequired),
    'Đã thu': d.payments && !d.paymentsHidden ? formatVnd(d.payments.paid) : PRINT_BLANK,
    'Còn lại': d.payments && !d.paymentsHidden ? formatVnd(d.payments.remaining) : PRINT_BLANK,
    'Ngày sự kiện': d.kind === 'SERVICE' && d.contract.eventDate ? formatLocalDate(d.contract.eventDate) : PRINT_BLANK,
    'Tên khoá': or(course?.courseName),
    'Tên lớp': or(course?.className),
    'Ngày khai giảng': course ? formatLocalDate(course.startDate) : PRINT_BLANK,
  };
}

export type PrintSegment = { text: string } | { variable: string; value: string };

// Tách chữ thành các đoạn để web vẽ thành CHỮ THƯỜNG (không qua HTML). Biến lạ giữ nguyên chữ "{…}".
export function fillVariables(text: string, values: Readonly<Record<string, string>>): PrintSegment[] {
  const out: PrintSegment[] = [];
  let buf = '';
  let last = 0;
  for (const m of text.matchAll(VARIABLE_RE)) {
    const name = m[1]!;
    buf += text.slice(last, m.index);
    last = m.index + m[0].length;
    if (Object.prototype.hasOwnProperty.call(values, name)) {
      if (buf) out.push({ text: buf });
      buf = '';
      out.push({ variable: name, value: values[name]! });
    } else {
      buf += m[0];
    }
  }
  buf += text.slice(last);
  if (buf) out.push({ text: buf });
  return out;
}
