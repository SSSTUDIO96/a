// Logic thuần của màn Mẫu thiết kế (bản vẽ C3 mục 2.6): lọc mẫu theo loại hợp đồng, luật số ảnh, đổi ngày, dựng tham số
// cho tệp vẽ public/mau/<mã>.html, dựng thân tạo thẻ, đổi lỗi máy chủ về đúng ô. Không gọi API ở đây.
import {
  DESIGN_TEMPLATES,
  SLOT_SOURCES,
  slotsForContract,
  templateSupportsContract,
  type ContractKindKey,
  type DesignKind,
  type DesignSize,
  type DesignTemplate,
  type FontOverride,
  type Permission,
  type SlotKey,
} from '@makeup/shared';
import type { DesignCardCreateInput, DesignData } from '../../api/designs';
import { validationIssues } from '../../api/errors';

export type KindPath = 'the-chao' | 'feedback' | 'loi-chuc';
export type DesignsTab = KindPath | 'da-tao' | 'cau-chuc';

export const KIND_TABS: readonly { kind: DesignKind; path: KindPath; label: string }[] = [
  { kind: 'WELCOME', path: 'the-chao', label: 'Thẻ chào mừng' },
  { kind: 'FEEDBACK', path: 'feedback', label: 'Feedback' },
  { kind: 'GREETING', path: 'loi-chuc', label: 'Lời chúc' },
];

export const KIND_LABEL: Record<DesignKind, string> = { WELCOME: 'Chào mừng', FEEDBACK: 'Feedback', GREETING: 'Lời chúc', CERTIFICATE: 'Giấy chứng nhận' };
export const CONTRACT_KIND_LABEL: Record<ContractKindKey, string> = { COURSE: 'Khoá học', SERVICE: 'Dịch vụ makeup' };
const CONTRACT_KIND_WORD: Record<ContractKindKey, string> = { COURSE: 'khoá học', SERVICE: 'dịch vụ' };
const CONTRACT_KIND_ORDER: readonly ContractKindKey[] = ['COURSE', 'SERVICE'];

// Thẻ chào mừng chỉ có ở tổ chức bật đào tạo (ACADEMY) — C3 mục 2.6.
export function kindTabsFor(orgKind: string | undefined) {
  return KIND_TABS.filter((t) => t.kind !== 'WELCOME' || orgKind === 'ACADEMY');
}

// Loại hợp đồng dùng được cho loại thẻ: hợp của contractKinds các mẫu cùng loại (mẫu là dữ liệu, không viết cứng).
export function contractKindsForKind(kind: DesignKind, templates: readonly DesignTemplate[] = DESIGN_TEMPLATES): ContractKindKey[] {
  const set = new Set(templates.filter((t) => t.kind === kind).flatMap((t) => t.contractKinds));
  return CONTRACT_KIND_ORDER.filter((k) => set.has(k));
}

export function contractKindsText(kinds: readonly ContractKindKey[]): string {
  return kinds.map((k) => CONTRACT_KIND_WORD[k]).join(' hoặc ');
}

export interface TemplateChoice {
  template: DesignTemplate;
  enabled: boolean;
  // Lý do tắt (tooltip), ví dụ "Chỉ dùng cho hợp đồng dịch vụ".
  reason: string | null;
}

// Lưới mẫu: "fit" = chỉ mẫu hợp loại hợp đồng; "all" = mọi mẫu cùng loại thẻ, mẫu không hợp thì tắt kèm lý do.
export function templateChoices(
  kind: DesignKind,
  contractKind: ContractKindKey,
  scope: 'fit' | 'all',
  templates: readonly DesignTemplate[] = DESIGN_TEMPLATES,
): TemplateChoice[] {
  return templates
    .filter((t) => t.kind === kind)
    .map((t) => {
      const ok = templateSupportsContract(t, contractKind);
      return { template: t, enabled: ok, reason: ok ? null : `Chỉ dùng cho hợp đồng ${contractKindsText(t.contractKinds)}` };
    })
    .filter((c) => scope === 'all' || c.enabled);
}

// Ảnh nhỏ cho lưới: R&D vẽ sẵn bản khoá học / dịch vụ cho mẫu dùng cả hai loại.
export function thumbnailUrl(t: DesignTemplate, contractKind: ContractKindKey): string {
  const variant = t.contractKinds.length > 1 ? (contractKind === 'SERVICE' ? '-dv' : '-khoa') : '';
  return `/mau/anh-nho/${t.code}${variant}.jpg`;
}

// Mẫu có chữ viết tay (phông "MP Viết tay N" hoặc mẫu đặt sẵn chữ ký "MP Chữ ký N", ví dụ shd-11) → hiện ô chọn chữ ký.
export function templateUsesHandwriting(t: DesignTemplate): boolean {
  return t.fonts.some((f) => f.startsWith('MP Viết tay') || f.startsWith('MP Chữ ký'));
}

// Số ảnh người dùng tải lên theo mẫu (photos.min..max ở danh mục).
export interface PhotoRule {
  min: number;
  max: number;
  text: string;
}

export function photoRule(t: DesignTemplate): PhotoRule {
  const { min, max } = t.photos;
  const text =
    max === 0 ? 'Mẫu này không có ô ảnh tải lên' : min === max ? `Mẫu này cần đúng ${max} ảnh` : `Mẫu này cần ${min}–${max} ảnh`;
  return { min, max, text };
}

// Ô ảnh học viên (`anh`, lấy từ hồ sơ khách — không phải ảnh tải lên). Mẫu nào cũng có ảnh (anh Chiến 19/10/2026), nên
// mẫu có ô này mà khách chưa có ảnh thì chặn xuất, báo cùng câu với ảnh tải lên: "Mẫu này cần đúng N ảnh".
export function avatarError(t: DesignTemplate, hasAvatar: boolean): string | null {
  if (!t.slots.includes('anh') || hasAvatar) return null;
  return `Mẫu này cần đúng ${t.photoFrames} ảnh (đang có ${t.photoFrames - 1}). Thêm ảnh học viên.`;
}

export function photoCountError(t: DesignTemplate, count: number): string | null {
  const r = photoRule(t);
  if (count >= r.min && count <= r.max) return null;
  return `${r.text} (đang có ${count}).`;
}

// Máy chủ trả ngày dạng YYYY-MM-DD; tệp vẽ (mau.js) đọc dd/mm/yyyy. Chuỗi sai dạng → null (không đoán).
export function ymdToVn(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)) return null;
  return `${d}/${mo}/${y}`;
}

const DATE_SLOTS: ReadonlySet<SlotKey> = new Set<SlotKey>(['ngay', 'nkt', 'nsk']);
const DATA_TEXT: readonly SlotKey[] = ['th', 'diachi', 'sdt', 'web', 'ten', 'khoa', 'lop', 'ngay', 'nkt', 'lich', 'gv', 'nv', 'goi', 'nsk'];

// Giá trị hiển thị của một ô lấy từ dữ liệu (ngày đã đổi dd/mm/yyyy). null = hợp đồng chưa có.
export function dataSlotText(data: DesignData, slot: SlotKey): string | null {
  if (!DATA_TEXT.includes(slot)) return null;
  const raw = data[slot as keyof DesignData] as string | null;
  if (raw == null || raw === '') return null;
  return DATE_SLOTS.has(slot) ? ymdToVn(raw) : raw;
}

// Hộp xám "tự lấy từ hợp đồng" (C3 2.6): Dịch vụ: Khách · Nhân vật · Gói · Ngày sự kiện; Khoá học: Học viên · Khoá · Lớp
// (+ Khai giảng ở thẻ chào mừng).
export function autoFields(contractKind: ContractKindKey, kind: DesignKind): { slot: SlotKey; label: string }[] {
  if (contractKind === 'SERVICE') {
    return [
      { slot: 'ten', label: 'Khách' },
      { slot: 'nv', label: 'Nhân vật' },
      { slot: 'goi', label: 'Gói' },
      { slot: 'nsk', label: 'Ngày sự kiện' },
    ];
  }
  const out: { slot: SlotKey; label: string }[] = [
    { slot: 'ten', label: 'Học viên' },
    { slot: 'khoa', label: 'Khoá' },
    { slot: 'lop', label: 'Lớp' },
  ];
  if (kind === 'WELCOME') out.push({ slot: 'ngay', label: 'Khai giảng' });
  return out;
}

// Ô của mẫu lấy từ dữ liệu mà hợp đồng / hồ sơ chưa có → trên ảnh sẽ trống. Báo ra, không tự điền.
export function missingDataSlots(t: DesignTemplate, contractKind: ContractKindKey, data: DesignData): { slot: SlotKey; label: string }[] {
  const out: { slot: SlotKey; label: string }[] = [];
  for (const s of slotsForContract(t, contractKind)) {
    const src = SLOT_SOURCES[s];
    if ('input' in src && src.input) continue;
    const has = s === 'logo' ? !!data.logoUrl : s === 'anh' ? !!data.anhUrl : dataSlotText(data, s) !== null;
    if (!has) out.push({ slot: s, label: src.label });
  }
  return out;
}

export interface FrameInput {
  title: string;
  body: string;
  rating: number | null;
  // YYYY-MM-DD
  receivedAt: string | null;
}

export interface FrameImages {
  logo: string | null;
  anh: string | null;
  // Ảnh tải lên theo thứ tự a1, a2, a3.
  photos: readonly (string | null)[];
}

export function sizeIsSquare(size: DesignSize): boolean {
  return size === '1080x1080';
}

export function sizePixels(size: DesignSize): { width: number; height: number } {
  const [w, h] = size.split('x').map(Number);
  return { width: w ?? 1080, height: h ?? 1350 };
}

// Tham số đường dẫn cho tệp vẽ: that=1 (dữ liệu thật — ô thiếu để trống, không lấy chữ mẫu), loai, kho, ky và giá trị
// từng ô của mẫu (chỉ ô của mẫu, chỉ ô có giá trị).
export function frameQuery(args: {
  template: DesignTemplate;
  contractKind: ContractKindKey;
  data: DesignData | null;
  images: FrameImages;
  input: FrameInput;
  size: DesignSize;
  font: FontOverride | null;
}): string {
  const { template, contractKind, data, images, input, size, font } = args;
  const p = new URLSearchParams();
  p.set('that', '1');
  p.set('loai', contractKind === 'SERVICE' ? 'dv' : 'khoa');
  if (sizeIsSquare(size)) p.set('kho', 'vuong');
  if (font) p.set('ky', font.replace('ky-', ''));
  const put = (k: string, v: string | number | null | undefined) => {
    if (v === null || v === undefined) return;
    const s = String(v).trim();
    if (s) p.set(k, s);
  };
  for (const s of slotsForContract(template, contractKind)) {
    if (s === 'logo') put('logo', images.logo);
    else if (s === 'anh') put('anh', images.anh);
    else if (s === 'a1' || s === 'a2' || s === 'a3') put(s, images.photos[Number(s.slice(1)) - 1] ?? null);
    else if (s === 'nd' || s === 'cc') put(s, input.body);
    else if (s === 'td') put('td', input.title);
    else if (s === 'nfb') put('nfb', ymdToVn(input.receivedAt));
    else if (s === 'sao') put('sao', input.rating);
    else if (data) {
      put(s, dataSlotText(data, s));
      // Tệp vẽ feedback / lời chúc gọi tên khách là `kh`.
      if (s === 'ten') put('kh', dataSlotText(data, s));
    }
  }
  return p.toString();
}

export interface CardDraft extends FrameInput {
  photoFileIds: string[];
}

// Thân POST /design-cards: chỉ gửi trường hợp với loại thẻ (máy chủ chặn số sao / ngày nhận ở thẻ không phải feedback).
export function cardCreateInput(args: {
  kind: DesignKind;
  template: DesignTemplate;
  contractId: string;
  courseClassId: string | null;
  draft: CardDraft;
  size: DesignSize;
  font: FontOverride | null;
}): DesignCardCreateInput {
  const { kind, template, contractId, courseClassId, draft, size, font } = args;
  const out: DesignCardCreateInput = {
    kind,
    templateCode: template.code,
    contractId,
    photoFileIds: draft.photoFileIds,
    fontOverride: font,
    size,
  };
  if (courseClassId) out.courseClassId = courseClassId;
  if (kind === 'FEEDBACK') {
    out.body = draft.body.trim();
    out.rating = draft.rating;
    out.receivedAt = draft.receivedAt;
  }
  if (kind === 'GREETING') {
    out.title = draft.title.trim() || null;
    out.body = draft.body.trim();
  }
  return out;
}

export type FormField = 'contract' | 'template' | 'photos' | 'avatar' | 'body' | 'title' | 'rating' | 'receivedAt' | 'size';
export type FormErrors = Partial<Record<FormField, string>>;

export const BODY_MAX = 2000;
export const TITLE_MAX = 120;

// Kiểm trước khi gửi (máy chủ vẫn là chốt).
export function checkDraft(args: { kind: DesignKind; template: DesignTemplate | null; contractId: string | null; draft: CardDraft; hasAvatar?: boolean }): FormErrors {
  const { kind, template, contractId, draft, hasAvatar = false } = args;
  const e: FormErrors = {};
  if (!contractId) e.contract = 'Chọn hợp đồng nguồn.';
  if (!template) e.template = 'Chọn một mẫu.';
  else {
    const pe = photoCountError(template, draft.photoFileIds.length);
    if (pe) e.photos = pe;
    // Chỉ chặn khi đã chọn hợp đồng (chưa chọn thì lỗi "Chọn hợp đồng nguồn" đã đủ).
    const ae = contractId ? avatarError(template, hasAvatar) : null;
    if (ae) e.avatar = ae;
  }
  // Ô nhập mà mẫu có thì phải điền — không để ô trống trên ảnh.
  if (kind === 'FEEDBACK' && template?.slots.includes('sao') && draft.rating === null) e.rating = 'Chọn số sao.';
  if (kind === 'FEEDBACK' && template?.slots.includes('nfb') && !draft.receivedAt) e.receivedAt = 'Nhập ngày nhận lời khen.';
  if (kind === 'FEEDBACK' && !draft.body.trim()) e.body = 'Dán nội dung lời khen.';
  if (kind === 'GREETING' && template?.slots.includes('td') && !draft.title.trim()) e.title = 'Nhập tiêu đề.';
  if (kind === 'GREETING' && !draft.body.trim()) e.body = 'Nhập lời chúc.';
  if (draft.body.length > BODY_MAX) e.body = `Tối đa ${BODY_MAX} ký tự.`;
  if (kind === 'GREETING' && draft.title.length > TITLE_MAX) e.title = `Tối đa ${TITLE_MAX} ký tự.`;
  return e;
}

// Lỗi 400 của máy chủ → đúng ô của form. Lỗi không thuộc ô nào → `rest` (dải đỏ).
export function serverFormErrors(err: unknown): { fields: FormErrors; rest: string[] } {
  const fields: FormErrors = {};
  const rest: string[] = [];
  for (const i of validationIssues(err)) {
    const top = i.path.split('.')[0] ?? '';
    const f: FormField | null =
      top === 'templateCode' || top === 'snapshot'
        ? 'template'
        : top === 'photoFileIds'
          ? 'photos'
          : top === 'contractId' || top === 'courseClassId'
            ? 'contract'
            : top === 'body' || top === 'title' || top === 'rating' || top === 'receivedAt' || top === 'size'
              ? top
              : null;
    if (f) fields[f] ??= i.message;
    else rest.push(i.message);
  }
  return { fields, rest };
}

export interface DesignPerms {
  read: boolean;
  write: boolean;
  // Thêm ảnh (files.write); không có thì ẩn nút thêm ảnh.
  files: boolean;
  // Chọn hợp đồng nguồn cần xem được danh sách hợp đồng.
  contracts: boolean;
  // Đổi ảnh học viên (Customer.avatarFileId).
  customers: boolean;
}

export function designPerms(has: (p: Permission) => boolean): DesignPerms {
  const write = has('designs.write');
  return {
    read: has('designs.read'),
    write,
    files: write && has('files.write'),
    contracts: has('contracts.read'),
    customers: has('customers.write') && has('files.write'),
  };
}

// Tên tệp tải về: bỏ dấu, chỉ chữ số và gạch nối (an toàn mọi hệ điều hành).
export function downloadName(code: string, customerName: string | null | undefined, size: DesignSize): string {
  const base = (customerName ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${code}${base ? `-${base}` : ''}-${size}.png`;
}

// dd/mm/yyyy của một thời điểm ISO theo múi giờ tổ chức (danh sách thẻ).
export function isoToVnDate(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')}`;
}
