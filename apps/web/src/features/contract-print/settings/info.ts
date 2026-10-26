import type { BrandProfile, ContractInfoInput } from '../../../api/types';

// Thẻ "Thông tin trên hợp đồng" (bản vẽ G 3.3 đường 8, 4.5): người đại diện + tài khoản ngân hàng in trên mọi hợp đồng giao khách.
// Kiểm ở máy khách đúng như ContractInfoBody của máy chủ; máy chủ vẫn là nơi quyết định.

export type InfoField = keyof ContractInfoInput;
export const INFO_FIELDS: readonly InfoField[] = ['representativeName', 'representativeTitle', 'bankName', 'bankAccountNumber', 'bankAccountName'];

export const INFO_LABELS: Record<InfoField, string> = {
  representativeName: 'Người đại diện',
  representativeTitle: 'Chức vụ',
  bankName: 'Ngân hàng',
  bankAccountNumber: 'Số tài khoản',
  bankAccountName: 'Chủ tài khoản',
};

export const INFO_TIPS: Record<InfoField, string> = {
  representativeName: 'Tên người ký hợp đồng thay studio, in ở phần Bên A.',
  representativeTitle: 'Ví dụ "Chủ studio", "Giám đốc". Có chức vụ thì phải có tên người đại diện.',
  bankName: 'Điền đủ ba ô ngân hàng, hoặc để trống cả ba. Có đủ thì bản in mới hiện khối "Tài khoản chuyển khoản".',
  bankAccountNumber: 'Chỉ gồm chữ số hoặc chữ cái, 4 đến 30 ký tự. Khoảng trắng được bỏ khi lưu.',
  bankAccountName: 'Tên chủ tài khoản đúng như ngân hàng ghi.',
};

export const INFO_MAX: Record<InfoField, number> = {
  representativeName: 120,
  representativeTitle: 80,
  bankName: 120,
  bankAccountNumber: 60,
  bankAccountName: 120,
};

export type InfoDraft = Record<InfoField, string>;
export type InfoErrors = Partial<Record<InfoField, string>>;

export function infoDraftOf(p: BrandProfile | null): InfoDraft {
  return {
    representativeName: p?.representativeName ?? '',
    representativeTitle: p?.representativeTitle ?? '',
    bankName: p?.bankName ?? '',
    bankAccountNumber: p?.bankAccountNumber ?? '',
    bankAccountName: p?.bankAccountName ?? '',
  };
}

export const normalizeAccountNumber = (s: string) => s.replace(/\s+/g, '').toUpperCase();

const orNull = (s: string) => (s.trim() === '' ? null : s.trim());

export function infoInput(d: InfoDraft): ContractInfoInput {
  return {
    representativeName: orNull(d.representativeName),
    representativeTitle: orNull(d.representativeTitle),
    bankName: orNull(d.bankName),
    bankAccountNumber: d.bankAccountNumber.trim() === '' ? null : normalizeAccountNumber(d.bankAccountNumber),
    bankAccountName: orNull(d.bankAccountName),
  };
}

export const BANK_ALL_OR_NONE = 'Nhập đủ ngân hàng, số tài khoản, chủ tài khoản (hoặc để trống cả ba)';

export function validateInfo(d: InfoDraft): InfoErrors {
  const v = infoInput(d);
  const e: InfoErrors = {};
  for (const f of INFO_FIELDS) {
    if (d[f].trim().length > INFO_MAX[f]) e[f] = `Tối đa ${INFO_MAX[f]} ký tự`;
  }
  if (v.representativeTitle !== null && v.representativeName === null) e.representativeName = 'Nhập tên người đại diện khi có chức vụ';
  const bank = [v.bankName, v.bankAccountNumber, v.bankAccountName];
  const filled = bank.filter((x) => x !== null).length;
  if (filled > 0 && filled < 3) {
    if (v.bankName === null) e.bankName = BANK_ALL_OR_NONE;
    if (v.bankAccountNumber === null) e.bankAccountNumber = BANK_ALL_OR_NONE;
    if (v.bankAccountName === null) e.bankAccountName = BANK_ALL_OR_NONE;
  }
  if (v.bankName !== null && v.bankName.length < 2) e.bankName ??= 'Tên ngân hàng tối thiểu 2 ký tự';
  if (v.bankAccountNumber !== null && !/^[0-9A-Z]{4,30}$/.test(v.bankAccountNumber)) e.bankAccountNumber ??= 'Số tài khoản chỉ gồm chữ số / chữ cái, 4–30 ký tự';
  if (v.bankAccountName !== null && v.bankAccountName.length < 2) e.bankAccountName ??= 'Chủ tài khoản tối thiểu 2 ký tự';
  return e;
}

export const infoDirty = (a: InfoDraft, b: InfoDraft) => INFO_FIELDS.some((f) => JSON.stringify(infoInput(a)[f]) !== JSON.stringify(infoInput(b)[f]));
export const hasBank = (p: BrandProfile | null) => p !== null && p.bankName !== null && p.bankAccountNumber !== null && p.bankAccountName !== null;
