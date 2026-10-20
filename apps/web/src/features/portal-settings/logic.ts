import type { PortalSettings, PortalSettingsInput } from '../../api/portal';

// Logic thuần của Cài đặt → Cổng học viên (bản vẽ E 4.4, 5.2): ba ô ngân hàng, đủ cả ba hoặc trống cả ba.
// Cách chuẩn hoá bám đúng máy chủ (modules/portal/settings.ts) để khung xem trước giống cái cổng sẽ hiện.

export interface BankDraft {
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
}

export type BankField = keyof BankDraft;
export type BankErrors = Partial<Record<BankField, string>>;

export const BANK_FIELDS: readonly BankField[] = ['bankName', 'bankAccountNo', 'bankAccountName'];

export const EMPTY_DRAFT: BankDraft = { bankName: '', bankAccountNo: '', bankAccountName: '' };

export function draftOf(s: PortalSettings | null): BankDraft {
  return { bankName: s?.bankName ?? '', bankAccountNo: s?.bankAccountNo ?? '', bankAccountName: s?.bankAccountName ?? '' };
}

// Số tài khoản: bỏ khoảng trắng, dấu chấm, gạch.
export function normalizeAccountNo(s: string): string {
  return s.replace(/[\s.-]/g, '');
}

// Chủ tài khoản: chữ hoa, bỏ dấu, gộp khoảng trắng (như ngân hàng in tên).
export function normalizeAccountName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const filled = (s: string) => s.trim() !== '';

// Trống cả ba → {}; đủ ba thì kiểm từng ô; lệch → ô trống báo "Điền ô này, hoặc để trống cả ba ô."
export function validateDraft(d: BankDraft): BankErrors {
  const out: BankErrors = {};
  const any = BANK_FIELDS.some((f) => filled(d[f]));
  if (!any) return out;
  for (const f of BANK_FIELDS) if (!filled(d[f])) out[f] = 'Điền ô này, hoặc để trống cả ba ô.';
  const name = d.bankName.trim();
  if (filled(d.bankName) && (name.length < 2 || name.length > 80)) out.bankName = 'Tên ngân hàng từ 2 đến 80 ký tự';
  if (filled(d.bankAccountNo) && !/^\d{6,20}$/.test(normalizeAccountNo(d.bankAccountNo))) out.bankAccountNo = 'Số tài khoản chỉ gồm 6 đến 20 chữ số';
  const holder = normalizeAccountName(d.bankAccountName);
  if (filled(d.bankAccountName) && (holder.length < 2 || holder.length > 80)) out.bankAccountName = 'Tên chủ tài khoản từ 2 đến 80 ký tự';
  return out;
}

// Thân gửi máy chủ: đủ 3 khoá; trống cả ba → null cả ba. Ném lỗi khi lệch (nơi gọi phải validateDraft trước).
export function toInput(d: BankDraft): PortalSettingsInput {
  const any = BANK_FIELDS.some((f) => filled(d[f]));
  if (!any) return { bankName: null, bankAccountNo: null, bankAccountName: null };
  if (Object.keys(validateDraft(d)).length > 0) throw new Error('toInput: bản nháp chưa hợp lệ');
  return { bankName: d.bankName.trim(), bankAccountNo: normalizeAccountNo(d.bankAccountNo), bankAccountName: normalizeAccountName(d.bankAccountName) };
}

export function isDirty(d: BankDraft, saved: BankDraft): boolean {
  return BANK_FIELDS.some((f) => d[f] !== saved[f]);
}

// Số tài khoản hiện theo nhóm 4 chữ số cho dễ đọc ("0123 4567 89"); chỉ để hiển thị.
export function groupAccountNo(no: string): string {
  return normalizeAccountNo(no).replace(/(\d{4})(?=\d)/g, '$1 ');
}
