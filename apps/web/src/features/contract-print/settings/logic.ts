import {
  ALWAYS_ON_BLOCKS,
  blockAppliesTo,
  checkTemplateText,
  DEFAULT_CLOSING_TEXT,
  DEFAULT_OPENING_TEXT,
  DEFAULT_PRINT_TITLE,
  LAYOUT_DEFAULT_OFF,
  PRINT_VARIABLES,
  TOGGLE_BLOCK_KEYS,
  type AlwaysOnBlockKey,
  type PrintBlockOverrides,
  type PrintLayout,
  type PrintTemplateLike,
  type PrintVariableName,
  type ToggleBlockKey,
} from '@makeup/shared';
import type { ContractKind, PrintTemplateCreateInput, PrintTemplateUpdateInput, PrintTemplateView } from '../../../api/types';

// Logic thuần của màn Cài đặt › Mẫu in hợp đồng (bản vẽ G mục 4.5): bản nháp của mẫu, so với bản đã lưu, thân PATCH CHỈ có
// trường đã đổi, nhận biết "đổi nội dung in" (phiên bản + 1) và kiểm biến ở máy khách trước khi gửi.

export const KIND_LABEL: Record<ContractKind, string> = { SERVICE: 'dịch vụ', COURSE: 'khoá học' };
export const KIND_GROUP_TITLE: Record<ContractKind, string> = { SERVICE: 'Hợp đồng dịch vụ', COURSE: 'Hợp đồng khoá học' };

// Khối luôn có: không có công tắc, chỉ liệt kê "luôn có" cuối thẻ (bản vẽ 3.1 ALWAYS_ON_BLOCKS).
export const ALWAYS_ON_LABELS: Record<AlwaysOnBlockKey, string> = {
  'tieu-de': 'Tiêu đề và số hợp đồng',
  'dich-vu': 'Bảng dịch vụ / khoá học',
  tien: 'Tổng tiền',
  'chu-ky': 'Chỗ ký hai bên',
};
export const ALWAYS_ON_KEYS: readonly AlwaysOnBlockKey[] = ALWAYS_ON_BLOCKS;

export type TextField = 'title' | 'openingText' | 'closingText';
export const TEXT_FIELDS: readonly TextField[] = ['title', 'openingText', 'closingText'];
export const TEXT_MAX: Record<TextField, number> = { title: 160, openingText: 2000, closingText: 2000 };
export const NAME_MAX = 120;

// Bản nháp: chữ rỗng = dùng chữ mặc định (máy chủ lưu null).
export interface TemplateDraft {
  name: string;
  layout: PrintLayout;
  appliesTo: ContractKind[];
  defaultFor: ContractKind[];
  blocks: PrintBlockOverrides;
  title: string;
  openingText: string;
  closingText: string;
  isActive: boolean;
}

export function draftOf(t: PrintTemplateView): TemplateDraft {
  return {
    name: t.name,
    layout: t.layout,
    appliesTo: [...t.appliesTo],
    defaultFor: [...t.defaultFor],
    blocks: { ...t.blocks },
    title: t.title ?? '',
    openingText: t.openingText ?? '',
    closingText: t.closingText ?? '',
    isActive: t.isActive,
  };
}

export function newDraft(layout: PrintLayout, kind: ContractKind, layoutName: string): TemplateDraft {
  return {
    name: `Mẫu ${layoutName}`,
    layout,
    appliesTo: [kind],
    defaultFor: [],
    blocks: {},
    title: '',
    openingText: '',
    closingText: '',
    isActive: true,
  };
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

// Bảng công tắc so theo cách máy chủ so (khoá sắp theo chữ, đủ giá trị) — không so theo kết quả cuối.
function sameBlocks(a: PrintBlockOverrides, b: PrintBlockOverrides): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k as ToggleBlockKey] === b[k as ToggleBlockKey]);
}

// Chữ rỗng hoặc chỉ khoảng trắng = null (dùng mặc định).
export const textToApi = (s: string): string | null => (s.trim() === '' ? null : s.trim());
const sameText = (a: string, b: string) => textToApi(a) === textToApi(b);

// Giá trị hiệu lực của một khối: công tắc đã lưu, không có thì theo mặc định của bố cục (R&D MAC_DINH_TAT).
export function effectiveBlock(draft: Pick<TemplateDraft, 'layout' | 'blocks'>, key: ToggleBlockKey): boolean {
  return draft.blocks[key] ?? !LAYOUT_DEFAULT_OFF[draft.layout].includes(key);
}

// Bật/tắt một khối. Công tắc quay về đúng giá trị mặc định mà bản đã lưu không có khoá → bỏ khoá (không để lại khoá thừa làm
// máy chủ tưởng nội dung đã đổi và tăng phiên bản).
export function setBlock(draft: TemplateDraft, saved: TemplateDraft | null, key: ToggleBlockKey, value: boolean): TemplateDraft {
  const blocks: PrintBlockOverrides = { ...draft.blocks };
  const isLayoutDefault = value === !LAYOUT_DEFAULT_OFF[draft.layout].includes(key);
  if (isLayoutDefault && (saved === null || saved.blocks[key] === undefined)) delete blocks[key];
  else blocks[key] = value;
  return { ...draft, blocks };
}

// Khối có công tắc cho các loại đang chọn: có ở ít nhất một loại. Giữ đúng thứ tự TOGGLE_BLOCKS.
export function visibleBlocks(kinds: readonly ContractKind[]): ToggleBlockKey[] {
  return TOGGLE_BLOCK_KEYS.filter((k) => kinds.some((kind) => blockAppliesTo(k, kind)));
}

// Biến chèn được: dùng được cho MỌI loại đang chọn.
export function usableVariables(kinds: readonly ContractKind[]): PrintVariableName[] {
  return (Object.keys(PRINT_VARIABLES) as PrintVariableName[]).filter((v) => kinds.every((k) => (PRINT_VARIABLES[v] as readonly string[]).includes(k)));
}

// Chữ mặc định (ô chờ) theo loại. Hai loại → null: mặc định khác nhau theo loại hợp đồng.
export function defaultText(field: TextField, kinds: readonly ContractKind[]): string | null {
  if (kinds.length !== 1) return null;
  const k = kinds[0]!;
  if (field === 'title') return DEFAULT_PRINT_TITLE[k];
  if (field === 'openingText') return DEFAULT_OPENING_TEXT[k];
  return DEFAULT_CLOSING_TEXT;
}

// Lời kiểm biến — đúng chữ với máy chủ (print/templates.ts assertTexts) để người dùng thấy cùng một lời ở hai đầu.
export function textError(text: string, kinds: readonly ContractKind[]): string | null {
  const t = text.trim();
  if (t === '') return null;
  const r = checkTemplateText(t, kinds);
  if (r.unknown.length > 0) {
    const list = usableVariables(kinds).map((v) => `{${v}}`).join(', ');
    return `Không có biến ${r.unknown.map((v) => `{${v}}`).join(', ')}. Biến dùng được: ${list}`;
  }
  const w = r.wrongKind[0];
  if (w) {
    const only = w.onlyFor.map((k) => KIND_LABEL[k]).join(', ');
    const missing = kinds.filter((k) => !w.onlyFor.includes(k)).map((k) => KIND_LABEL[k]).join(', ');
    return `Biến {${w.name}} chỉ dùng cho hợp đồng ${only} — mẫu này dùng cho cả hợp đồng ${missing}`;
  }
  return null;
}

export type DraftErrors = Partial<Record<'name' | TextField, string>>;

export function validateDraft(d: TemplateDraft): DraftErrors {
  const e: DraftErrors = {};
  if (d.name.trim() === '') e.name = 'Tên mẫu không được để trống';
  else if (d.name.trim().length > NAME_MAX) e.name = `Tên mẫu tối đa ${NAME_MAX} ký tự`;
  if (d.appliesTo.length === 0) return e; // không có loại thì không kiểm biến (màn không cho tình huống này)
  for (const f of TEXT_FIELDS) {
    const m = textError(d[f], d.appliesTo);
    if (m) e[f] = m;
    else if (d[f].trim().length > TEXT_MAX[f]) e[f] = `Tối đa ${TEXT_MAX[f]} ký tự`;
  }
  return e;
}

// Nội dung in = những thứ làm phiên bản + 1 (bản vẽ 3.4): bố cục, khối, tiêu đề, chữ mở đầu, chữ kết thúc.
export function changesPrintContent(d: TemplateDraft, saved: TemplateDraft): boolean {
  return d.layout !== saved.layout || !sameBlocks(d.blocks, saved.blocks) || !sameText(d.title, saved.title) || !sameText(d.openingText, saved.openingText) || !sameText(d.closingText, saved.closingText);
}

// Thân PATCH: CHỈ trường đã đổi so với bản đã lưu. Rỗng = không có gì để gửi.
export function patchOf(d: TemplateDraft, saved: TemplateDraft): PrintTemplateUpdateInput {
  const p: PrintTemplateUpdateInput = {};
  if (d.name.trim() !== saved.name.trim()) p.name = d.name.trim();
  if (d.layout !== saved.layout) p.layout = d.layout;
  if (!sameSet(d.appliesTo, saved.appliesTo)) p.appliesTo = [...d.appliesTo];
  if (!sameBlocks(d.blocks, saved.blocks)) p.blocks = { ...d.blocks };
  if (!sameText(d.title, saved.title)) p.title = textToApi(d.title);
  if (!sameText(d.openingText, saved.openingText)) p.openingText = textToApi(d.openingText);
  if (!sameText(d.closingText, saved.closingText)) p.closingText = textToApi(d.closingText);
  if (!sameSet(d.defaultFor, saved.defaultFor)) p.defaultFor = [...d.defaultFor];
  if (d.isActive !== saved.isActive) p.isActive = d.isActive;
  return p;
}

export const isDirty = (d: TemplateDraft, saved: TemplateDraft) => Object.keys(patchOf(d, saved)).length > 0;

// Thân POST. Chữ rỗng, bảng khối rỗng, không mặc định thì không gửi trường đó.
export function createOf(d: TemplateDraft): PrintTemplateCreateInput {
  const body: PrintTemplateCreateInput = { name: d.name.trim(), layout: d.layout, appliesTo: [...d.appliesTo] };
  if (Object.keys(d.blocks).length > 0) body.blocks = { ...d.blocks };
  const title = textToApi(d.title);
  const opening = textToApi(d.openingText);
  const closing = textToApi(d.closingText);
  if (title !== null) body.title = title;
  if (opening !== null) body.openingText = opening;
  if (closing !== null) body.closingText = closing;
  if (d.defaultFor.length > 0) body.defaultFor = [...d.defaultFor];
  return body;
}

// Mẫu để vẽ xem trước / gộp cấu hình bằng resolvePrintConfig (đúng đường máy chủ dùng).
export function templateLike(d: TemplateDraft, id: string, version: number): PrintTemplateLike {
  return {
    id,
    name: d.name.trim() === '' ? 'Mẫu in' : d.name.trim(),
    version,
    layout: d.layout,
    blocks: d.blocks,
    title: textToApi(d.title),
    openingText: textToApi(d.openingText),
    closingText: textToApi(d.closingText),
  };
}

// "Dùng cho": giá trị Segmented ↔ danh sách loại.
export type AppliesChoice = 'SERVICE' | 'COURSE' | 'BOTH';
export const choiceOf = (kinds: readonly ContractKind[]): AppliesChoice => (kinds.length === 2 ? 'BOTH' : kinds[0] === 'COURSE' ? 'COURSE' : 'SERVICE');
export const kindsOfChoice = (c: AppliesChoice): ContractKind[] => (c === 'BOTH' ? ['SERVICE', 'COURSE'] : [c]);

// Chữ trên nút lưu: chạm nội dung in và mẫu đã có → "Lưu thành bản v{n+1}".
export function saveLabel(d: TemplateDraft, saved: TemplateDraft | null, version: number | null): string {
  if (saved === null || version === null) return 'Tạo mẫu';
  return changesPrintContent(d, saved) ? `Lưu thành bản v${version + 1}` : 'Lưu';
}

// Số hợp đồng đã in bằng bản cũ — dải vàng "Lưu là tạo bản v{n+1}…".
export function printedWarning(version: number, printed: number): string | null {
  if (printed <= 0) return null;
  return `Lưu là tạo bản v${version + 1}. ${printed} hợp đồng đã in bằng bản cũ vẫn in lại đúng như cũ; hợp đồng in sau dùng bản mới.`;
}

export type ConflictField = 'isActive' | 'appliesTo' | 'defaultFor';

// 409 DEFAULT_REQUIRED hiện dưới công tắc nào: theo thứ máy chủ vừa nhận.
export function defaultRequiredField(sent: PrintTemplateUpdateInput): ConflictField {
  if (sent.isActive === false) return 'isActive';
  if (sent.appliesTo !== undefined) return 'appliesTo';
  return 'defaultFor';
}

// Loại hợp đồng mà mẫu đang là mặc định không bỏ khỏi "Dùng cho" được (máy chủ 409 DEFAULT_REQUIRED).
export function lockedKinds(saved: TemplateDraft | null): ContractKind[] {
  return saved === null ? [] : [...saved.defaultFor];
}
