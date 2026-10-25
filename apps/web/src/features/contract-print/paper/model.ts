import {
  PAYMENT_METHOD_LABELS,
  formatLocalDate,
  formatVnd,
  isPrintLayout,
  longLocalDate,
  PRINT_BLANK,
  PRINT_DATA_VERSION,
  variableValues,
  type ContractPrintData,
  type PrintBlockKey,
  type PrintCourse,
  type PrintLayout,
  type PrintPayments,
  type PrintText,
  type ResolvedPrintConfig,
} from '@makeup/shared';
import { buildRows, type PrintRow } from './rows';

// Mô hình của MỘT tờ in: mọi giá trị đã chuẩn hoá cho 5 bố cục dùng chung. Web chỉ định dạng / chọn hiển thị,
// KHÔNG cộng trừ tiền: tổng, giảm, cọc, đã thu, còn lại đều lấy nguyên từ PrintData.

export interface TotalRow {
  label: string;
  value: string;
  strong?: boolean;
}

export interface PaperModel {
  data: ContractPrintData;
  config: ResolvedPrintConfig;
  logoUrl: string | null;
  layout: PrintLayout;
  sv: boolean;
  draft: boolean;
  on: (k: PrintBlockKey) => boolean;
  vars: Record<string, string>;
  rows: PrintRow[];
  brand: string;
  issuedLong: string;
  issuedShort: string;
  course: PrintCourse | null;
  /** Bằng chữ: chỉ khi khối `bang-chu` bật. */
  words: string | null;
  totals: TotalRow[];
  deposit: string;
  /** null khi không có quyền xem thu tiền, hoặc khối bị tắt. */
  payments: PrintPayments | null;
  installments: PrintPayments['installments'];
  receipts: PrintPayments['receipts'];
  bank: { bankName: string; accountNumber: string; accountName: string; note: string } | null;
  terms: PrintText | null;
  rules: PrintText | null;
  notes: string | null;
  labelA: string;
  labelB: string;
  signA: string;
  signB: string;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function installmentState(i: { state: 'PAID' | 'PARTIAL' | 'UNPAID'; paid: number }): string {
  if (i.state === 'PAID') return 'Đã thu';
  if (i.state === 'PARTIAL') return `Đã thu ${formatVnd(i.paid)}`;
  return 'Chưa thu';
}

export function methodLabel(r: PrintPayments['receipts'][number]): string {
  const m = PAYMENT_METHOD_LABELS[r.method];
  return r.kind === 'REFUND' ? `Hoàn tiền · ${m}` : m;
}

export function receiptAmount(r: PrintPayments['receipts'][number]): string {
  return r.kind === 'REFUND' ? `− ${formatVnd(r.amount)}` : formatVnd(r.amount);
}

function textOrNull(t: PrintText | null, show: boolean): PrintText | null {
  return show && t !== null && t.items.length > 0 ? t : null;
}

export function buildPaperModel(data: ContractPrintData, config: ResolvedPrintConfig, logoUrl: string | null): PaperModel {
  if (data.version !== PRINT_DATA_VERSION) throw new RangeError(`Bộ vẽ chưa đọc được dữ liệu in phiên bản ${String(data.version)}`);
  if (!isPrintLayout(config.layout)) throw new RangeError(`Bố cục không có thật: ${String(config.layout)}`);
  const on = (k: PrintBlockKey): boolean => config.blocks[k] === true;
  const sv = data.kind === 'SERVICE';
  const m = data.money;
  const payments = data.paymentsHidden ? null : data.payments;
  const showSchedule = on('tien-do') && payments !== null;
  const showReceipts = on('da-thu') && payments !== null;
  const totals: TotalRow[] = [];
  if (m.discount > 0) {
    totals.push({ label: 'Tạm tính', value: formatVnd(m.subtotal) });
    totals.push({ label: 'Giảm giá', value: `− ${formatVnd(m.discount)}` });
  }
  totals.push({ label: 'Tổng cộng', value: formatVnd(m.total), strong: true });
  const bank = on('chuyen-khoan') ? data.studio.bank : null;
  const rep = data.studio.representative;
  return {
    data,
    config,
    logoUrl,
    layout: config.layout,
    sv,
    draft: data.contract.status === 'DRAFT',
    on,
    vars: variableValues(data),
    rows: buildRows(data, { detail: on('chi-tiet'), staff: on('tho') }),
    brand: data.studio.name,
    issuedLong: longLocalDate(data.contract.issuedOn),
    issuedShort: formatLocalDate(data.contract.issuedOn),
    course: data.kind === 'COURSE' ? (data.lines.find((l) => l.course !== null)?.course ?? null) : null,
    words: on('bang-chu') ? m.totalInWords : null,
    totals,
    deposit: formatVnd(m.depositRequired),
    payments,
    installments: showSchedule ? payments.installments : [],
    receipts: showReceipts ? payments.receipts : [],
    bank: bank ? { ...bank, note: `${data.contract.code} ${data.customer.fullName}` } : null,
    terms: textOrNull(data.terms, on('dieu-khoan')),
    rules: textOrNull(data.rules, on('noi-quy')),
    notes: on('ghi-chu') && data.contract.notes ? data.contract.notes : null,
    labelA: sv ? 'BÊN A — STUDIO' : 'BÊN A — TRUNG TÂM',
    labelB: sv ? 'BÊN B — KHÁCH HÀNG' : 'BÊN B — HỌC VIÊN',
    signA: rep?.name ?? '',
    signB: data.customer.fullName,
  };
}

export { PRINT_BLANK };
