// Danh mục mẫu thiết kế (thẻ chào mừng / feedback / lời chúc) — BAN-VE-C3-DAO-TAO mục 1.4.
// Mẫu là MÃ và TỆP VẼ, không phải dữ liệu của tổ chức, nên không nằm trong database.
// Máy chủ dùng danh mục để kiểm (mã mẫu, loại hợp đồng, số ảnh); web dùng để vẽ ô chọn mẫu và điền ô.
// Thêm mẫu = thêm 1 mục ở đây + 1 tệp vẽ; không sửa màn nào.

export type DesignKind = 'WELCOME' | 'FEEDBACK' | 'GREETING';
export type ContractKindKey = 'SERVICE' | 'COURSE';
export const CONTRACT_KIND_KEYS = ['SERVICE', 'COURSE'] as const satisfies readonly ContractKindKey[];

export interface SlotSource {
  label: string;
  from: string;
  // Ô chỉ có ở hợp đồng khoá học (COURSE), chỉ ở hợp đồng dịch vụ (SERVICE), hay cả hai (BOTH).
  contract: 'BOTH' | 'COURSE' | 'SERVICE';
  // true = người dùng nhập / tải lên (không lấy từ dữ liệu hợp đồng).
  input?: true;
}

// Khoá ô ↔ nguồn dữ liệu (một nơi duy nhất; DesignCard.snapshot lưu theo đúng các khoá này).
// Tệp vẽ mẫu (docs/rnd/v3-mau-*/…, mau.js) nhận đúng các khoá này qua tham số đường dẫn; riêng tên khách trên
// mẫu feedback / lời chúc tệp vẽ gọi là `kh` (= `ten`), dòng phụ `dv` ghép từ khoa · lop (khoá học) hoặc
// nv · goi · nsk (dịch vụ).
export const SLOT_SOURCES = {
  th: { label: 'Tên thương hiệu', from: 'OrganizationProfile.brandName', contract: 'BOTH' },
  logo: { label: 'Logo', from: 'OrganizationProfile.logoFileId', contract: 'BOTH' },
  diachi: { label: 'Địa chỉ', from: 'CourseClass.studioLocation.address ?? OrganizationProfile.address', contract: 'BOTH' },
  sdt: { label: 'Số điện thoại', from: 'OrganizationProfile.phone', contract: 'BOTH' },
  web: { label: 'Website + mã QR', from: 'OrganizationProfile.website', contract: 'BOTH' },
  ten: { label: 'Tên học viên/khách', from: 'Contract.customer.fullName', contract: 'BOTH' },
  anh: { label: 'Ảnh học viên/khách', from: 'Contract.customer.avatarFileId', contract: 'BOTH' },
  khoa: { label: 'Tên khoá', from: 'CourseClass.course.name', contract: 'COURSE' },
  lop: { label: 'Tên lớp', from: 'CourseClass.name', contract: 'COURSE' },
  ngay: { label: 'Ngày khai giảng', from: 'CourseClass.startDate', contract: 'COURSE' },
  nkt: { label: 'Ngày kết thúc', from: 'CourseClass.endDate', contract: 'COURSE' },
  lich: { label: 'Lịch học', from: 'CourseClass.weekdays + startMinute/endMinute', contract: 'COURSE' },
  gv: { label: 'Giảng viên', from: 'CourseClass.instructorMembershipId → tên', contract: 'COURSE' },
  nv: { label: 'Nhân vật makeup', from: 'ContractLine.subjectName (dòng gói đầu tiên)', contract: 'SERVICE' },
  goi: { label: 'Tên gói', from: 'ContractLine.name (dòng PACKAGE đầu tiên)', contract: 'SERVICE' },
  nsk: { label: 'Ngày sự kiện', from: 'Contract.eventDate', contract: 'SERVICE' },
  nd: { label: 'Lời khen', from: 'DesignCard.body (người dùng dán)', contract: 'BOTH', input: true },
  td: { label: 'Tiêu đề lời chúc', from: 'DesignCard.title (gợi ý GreetingPhrase.title)', contract: 'BOTH', input: true },
  cc: { label: 'Câu chúc', from: 'DesignCard.body (gợi ý GreetingPhrase.body)', contract: 'BOTH', input: true },
  nfb: { label: 'Ngày nhận lời khen', from: 'DesignCard.receivedAt', contract: 'BOTH', input: true },
  sao: { label: 'Số sao', from: 'DesignCard.rating', contract: 'BOTH', input: true },
  a1: { label: 'Ảnh 1', from: 'DesignCardPhoto[0]', contract: 'BOTH', input: true },
  a2: { label: 'Ảnh 2', from: 'DesignCardPhoto[1]', contract: 'BOTH', input: true },
  a3: { label: 'Ảnh 3', from: 'DesignCardPhoto[2]', contract: 'BOTH', input: true },
} as const satisfies Record<string, SlotSource>;

export type SlotKey = keyof typeof SLOT_SOURCES;
export const SLOT_KEYS = Object.keys(SLOT_SOURCES) as SlotKey[];
// Ô ảnh người dùng tải lên, theo thứ tự sort_order 0..2 của DesignCardPhoto.
export const PHOTO_SLOTS = ['a1', 'a2', 'a3'] as const satisfies readonly SlotKey[];

export const DESIGN_SIZES = ['1080x1350', '1080x1080'] as const;
export type DesignSize = (typeof DESIGN_SIZES)[number];
// DesignCard.fontOverride: thay mọi phông viết tay của mẫu bằng chữ ký N (tham số ?ky=N của tệp vẽ).
export const FONT_OVERRIDES = ['ky-1', 'ky-2', 'ky-3', 'ky-4'] as const;
export type FontOverride = (typeof FONT_OVERRIDES)[number];
export const MAX_DESIGN_PHOTOS = 3;
export const FRAME_SHAPES = ['circle', 'pill'] as const;
export type FrameShape = (typeof FRAME_SHAPES)[number];
// Ô có khung ảnh trên mẫu: ảnh học viên (dữ liệu) + ảnh tải lên.
export const FRAME_SLOTS = ['anh', 'a1', 'a2', 'a3'] as const satisfies readonly SlotKey[];

export interface DesignTemplate {
  code: string; // 'shd-01'
  version: number; // tăng khi đổi bố cục
  kind: DesignKind;
  name: string; // 'Thư mời kem'
  contractKinds: ContractKindKey[]; // ['COURSE'] | ['SERVICE'] | ['COURSE','SERVICE']
  slots: SlotKey[];
  photos: { min: number; max: number }; // 0..3
  fonts: string[]; // 'MP Viết tay 1', 'MP Chữ có chân'…
  sizes: DesignSize[];
  // Số khung ảnh trên mẫu = ô ảnh học viên `anh` (lấy từ hồ sơ khách) + ô ảnh tải lên a1..a3. Mẫu nào cũng ≥ 1
  // (anh Chiến 19/10/2026: "Mẫu nào cũng phải có ảnh nhé").
  photoFrames: number;
  // Hình khung ảnh: mặc định tròn; đúng một mẫu dạng viên thuốc (shd-11) — "khung ảnh mặc định để hình tròn và có 1 mẫu
  // để dạng viên thuốc" (anh Chiến 19/10/2026).
  frameShape: FrameShape;
  origin: 'HOC_TU_ANH' | 'TU_SANG_TAC'; // ghi nguồn
}

const BOTH_SIZES: DesignSize[] = ['1080x1350', '1080x1080'];
const COURSE: ContractKindKey[] = ['COURSE'];
const SERVICE: ContractKindKey[] = ['SERVICE'];
const BOTH_KINDS: ContractKindKey[] = ['COURSE', 'SERVICE'];
// Dòng phụ "Khoá · Lớp" (khoá học) ↔ "Nhân vật · Gói · Ngày sự kiện" (dịch vụ) của mẫu dùng cho cả hai loại.
const SUB_LINE: SlotKey[] = ['khoa', 'lop', 'nv', 'goi', 'nsk'];

// Số ảnh tải lên = số ô a1..a3 của mẫu. Tệp vẽ có đủ khung cho từng ô ảnh (thiếu ảnh thì khung hiện ảnh mẫu),
// nên tối thiểu = tối đa.
function photosOf(slots: readonly SlotKey[]): { min: number; max: number } {
  const n = slots.filter((s) => (PHOTO_SLOTS as readonly SlotKey[]).includes(s)).length;
  return { min: n, max: n };
}

function tpl(
  code: string,
  kind: DesignKind,
  name: string,
  contractKinds: ContractKindKey[],
  slots: SlotKey[],
  fonts: string[],
  origin: DesignTemplate['origin'],
  frameShape: FrameShape = 'circle',
): DesignTemplate {
  const photoFrames = slots.filter((s) => (FRAME_SLOTS as readonly SlotKey[]).includes(s)).length;
  return { code, version: 1, kind, name, contractKinds, slots, photos: photosOf(slots), fonts, sizes: BOTH_SIZES, origin, photoFrames, frameShape };
}

const VT = (n: number) => `MP Viết tay ${n}`;
// Nhóm phông chữ ký nét mảnh đều (phong.css 'MP Chữ ký N'); mẫu dùng chữ ký làm phông viết tay mặc định.
const KY = (n: number) => `MP Chữ ký ${n}`;
const CHAN = 'MP Chữ có chân';
const CHAN_DAM = 'MP Chữ đậm có chân';
const SANS = 'MP Chữ không chân';

// Ô của từng mẫu khai theo ĐÚNG ô tệp vẽ dùng (data-f, data-chat → nd, data-sao → sao, data-qr → web; các khoá
// suy ra như ngayCham → ngay, gio → lich, nskCham → nsk, nktCham → nkt, kh → ten, dv → SUB_LINE), đối chiếu với
// trang bày docs/rnd/v3-bay-mau.html. Phông theo dòng "Phông:" của trang bày.
export const DESIGN_TEMPLATES: readonly DesignTemplate[] = [
  // ---------- Chào mừng (hợp đồng khoá học; ảnh học viên lấy từ `anh`, không tải lên) ----------
  // shd-01 thêm ảnh học viên khung tròn 19/10/2026 (trước đây là mẫu duy nhất không có ảnh).
  tpl('shd-01', 'WELCOME', 'Thư mời kem', COURSE,
    ['logo', 'th', 'anh', 'khoa', 'lop', 'ngay', 'ten', 'diachi'], [VT(1), CHAN, SANS], 'HOC_TU_ANH'),
  tpl('shd-02', 'WELCOME', 'Đen vàng khung tròn', COURSE,
    ['logo', 'th', 'anh', 'ten', 'khoa', 'lop', 'ngay'], [VT(1), CHAN, SANS], 'TU_SANG_TAC'),
  tpl('shd-03', 'WELCOME', 'Ngày khai giảng lớn', COURSE,
    ['logo', 'th', 'ngay', 'anh', 'ten', 'khoa', 'lop', 'diachi', 'web'], [VT(3), CHAN_DAM, SANS], 'HOC_TU_ANH'),
  tpl('shd-04', 'WELCOME', 'Ruy băng tên', COURSE,
    ['th', 'logo', 'anh', 'ten', 'khoa', 'lop', 'diachi', 'sdt'], [CHAN_DAM, CHAN, SANS], 'HOC_TU_ANH'),
  tpl('shd-05', 'WELCOME', 'Tạp chí tối giản', COURSE,
    ['anh', 'logo', 'th', 'ten', 'khoa', 'lop', 'ngay', 'gv'], [VT(2), CHAN, SANS], 'TU_SANG_TAC'),
  tpl('shd-06', 'WELCOME', 'Xanh rêu khung lệch', COURSE,
    ['logo', 'th', 'anh', 'ten', 'khoa', 'lop', 'ngay', 'lich'], [VT(1), CHAN, SANS], 'TU_SANG_TAC'),
  tpl('shd-07', 'WELCOME', 'Vé vào lớp', COURSE,
    ['logo', 'th', 'anh', 'ten', 'khoa', 'lop', 'ngay', 'lich'], [VT(4), CHAN, SANS], 'TU_SANG_TAC'),
  tpl('shd-08', 'WELCOME', 'Chữ ký trên nền trắng', COURSE,
    ['anh', 'ten', 'khoa', 'lop', 'ngay', 'logo', 'th'], [VT(2), CHAN, SANS], 'TU_SANG_TAC'),
  tpl('shd-09', 'WELCOME', 'Thiệp vàng hồng khung tròn', COURSE,
    ['logo', 'th', 'anh', 'ten', 'khoa', 'lop', 'ngay', 'gv'], [VT(3), CHAN, SANS], 'TU_SANG_TAC'),
  tpl('shd-10', 'WELCOME', 'Thư tay của giảng viên', COURSE,
    ['logo', 'th', 'anh', 'ten', 'khoa', 'lop', 'ngay', 'lich', 'diachi', 'gv'], [VT(1), VT(3), CHAN, SANS], 'TU_SANG_TAC'),
  // Mẫu thứ 20 (9 mẫu đợt 1 của R&D + shd-01..10 + mẫu này; việc tồn 7): tên học viên viết CHỮ KÝ nét mảnh đều
  // (docs/SO-Y-MUON.md 18/10/2026) trên dòng ký tên; dòng thông tin trống tự ẩn; không có logo thì ẩn ô logo (L6).
  // Mẫu DUY NHẤT khung ảnh viên thuốc: bố cục hai cột dựng quanh ảnh đứng cao, và là mẫu mới nên không đổi mẫu người
  // dùng đã quen.
  tpl('shd-11', 'WELCOME', 'Chữ ký mảnh nền đá', COURSE,
    ['logo', 'th', 'anh', 'ten', 'khoa', 'lop', 'ngay', 'lich', 'gv', 'diachi'], [KY(1), CHAN, SANS], 'TU_SANG_TAC', 'pill'),

  // ---------- Feedback (fb-09 chỉ dịch vụ; còn lại cả hai loại hợp đồng) ----------
  tpl('fb-01', 'FEEDBACK', 'Tin nhắn và ảnh polaroid', BOTH_KINDS,
    ['logo', 'th', 'nd', 'a1', 'ten', ...SUB_LINE], [VT(3), SANS], 'HOC_TU_ANH'),
  tpl('fb-02', 'FEEDBACK', 'Thẻ trắng nổi có sao', BOTH_KINDS,
    ['nd', 'sao', 'a1', 'ten', ...SUB_LINE, 'logo', 'th', 'web'], [CHAN_DAM, SANS], 'HOC_TU_ANH'),
  tpl('fb-03', 'FEEDBACK', 'Ảnh trên, lời khen dưới', BOTH_KINDS,
    ['a1', 'sao', 'nd', 'ten', ...SUB_LINE, 'logo', 'th'], [CHAN, SANS], 'HOC_TU_ANH'),
  tpl('fb-04', 'FEEDBACK', 'Thư cảm ơn nền kem', BOTH_KINDS,
    ['nd', 'ten', ...SUB_LINE, 'nfb', 'a1', 'a2', 'a3', 'logo', 'th'], [VT(1), VT(3), CHAN, SANS], 'TU_SANG_TAC'),
  tpl('fb-05', 'FEEDBACK', 'Đen vàng hai ảnh tròn', BOTH_KINDS,
    ['a1', 'a2', 'nd', 'ten', ...SUB_LINE, 'logo', 'th'], [CHAN, CHAN_DAM, SANS], 'TU_SANG_TAC'),
  tpl('fb-06', 'FEEDBACK', 'Ba ảnh tròn', BOTH_KINDS,
    ['a1', 'a2', 'a3', 'nd', 'ten', ...SUB_LINE, 'logo', 'th'], [CHAN, SANS], 'TU_SANG_TAC'),
  tpl('fb-07', 'FEEDBACK', 'Khung điện thoại tin nhắn', BOTH_KINDS,
    ['a1', 'ten', 'nd', 'nfb', ...SUB_LINE, 'logo', 'th'], [VT(1), SANS], 'HOC_TU_ANH'),
  tpl('fb-08', 'FEEDBACK', 'Ảnh tròn lớn, thẻ tối', BOTH_KINDS,
    ['a1', 'logo', 'th', 'nd', 'ten', ...SUB_LINE], [CHAN, SANS], 'TU_SANG_TAC'),
  tpl('fb-09', 'FEEDBACK', 'Trước – sau', SERVICE,
    ['a1', 'a2', 'nd', 'ten', 'nv', 'goi', 'nsk', 'logo', 'th'], [CHAN_DAM, SANS], 'TU_SANG_TAC'),
  tpl('fb-10', 'FEEDBACK', 'Câu nổi bật viết tay', BOTH_KINDS,
    ['nd', 'a1', 'ten', ...SUB_LINE, 'logo', 'th'], [VT(4), SANS], 'TU_SANG_TAC'),

  // ---------- Lời chúc ----------
  tpl('lc-01', 'GREETING', 'Thiệp kem chúc mừng ngày cưới', SERVICE,
    ['logo', 'th', 'a1', 'nv', 'ten', 'td', 'cc', 'nsk'], [VT(1), CHAN, SANS], 'TU_SANG_TAC'),
  tpl('lc-02', 'GREETING', 'Đen vàng cảm ơn đã tin chọn', BOTH_KINDS,
    ['logo', 'th', 'a1', 'td', 'ten', 'cc', ...SUB_LINE], [VT(1), CHAN, SANS], 'TU_SANG_TAC'),
  tpl('lc-03', 'GREETING', 'Ảnh lớn, khung trắng', SERVICE,
    ['a1', 'logo', 'th', 'td', 'ten', 'cc', 'nv', 'goi', 'nsk'], [VT(3), CHAN, SANS], 'TU_SANG_TAC'),
  // Trang bày ghi 8 ô (không có `goi`), nhưng tệp vẽ lc-04.html có hiện "Tên gói · Ngày sự kiện" ở chân: khai theo tệp vẽ.
  tpl('lc-04', 'GREETING', 'Hai ảnh tròn, xanh rêu', SERVICE,
    ['a1', 'a2', 'td', 'ten', 'cc', 'goi', 'nsk', 'logo', 'th'], [VT(1), CHAN, SANS], 'TU_SANG_TAC'),
  tpl('lc-05', 'GREETING', 'Chúc mừng hoàn thành khoá học', COURSE,
    ['logo', 'th', 'anh', 'td', 'ten', 'cc', 'khoa', 'lop', 'nkt', 'gv'], [VT(1), VT(3), CHAN, SANS], 'TU_SANG_TAC'),
  tpl('lc-06', 'GREETING', 'Thiệp hoa lá gửi mẹ cô dâu', SERVICE,
    ['logo', 'th', 'a1', 'td', 'ten', 'cc', 'nv', 'nsk'], [VT(3), CHAN, SANS], 'TU_SANG_TAC'),
];

const BY_CODE: ReadonlyMap<string, DesignTemplate> = new Map(DESIGN_TEMPLATES.map((t) => [t.code, t]));

// Tra mẫu theo mã. Mã lạ trả undefined (KHÔNG trả mẫu đầu tiên) — máy chủ đổi thành lỗi 400.
export function findDesignTemplate(code: string): DesignTemplate | undefined {
  return BY_CODE.get(code);
}

export function templateSupportsContract(t: DesignTemplate, contractKind: ContractKindKey): boolean {
  return t.contractKinds.includes(contractKind);
}

// Danh mục đã lọc theo loại thẻ và loại hợp đồng (GET /design-templates).
export function listDesignTemplates(filter: { kind?: DesignKind; contractKind?: ContractKindKey } = {}): DesignTemplate[] {
  return DESIGN_TEMPLATES.filter(
    (t) =>
      (filter.kind === undefined || t.kind === filter.kind) &&
      (filter.contractKind === undefined || templateSupportsContract(t, filter.contractKind)),
  );
}

// Ô nào của mẫu dùng được với loại hợp đồng này (bỏ ô chỉ của loại kia — ví dụ ô dịch vụ trên bản khoá học).
export function slotsForContract(t: DesignTemplate, contractKind: ContractKindKey): SlotKey[] {
  return t.slots.filter((s) => {
    const c = SLOT_SOURCES[s].contract;
    return c === 'BOTH' || c === contractKind;
  });
}
