import type { ContractPrintData, ContractStatus, ResolvedPrintConfig } from '@makeup/shared';
import type { ContractPrintResult, PrintDataResult, PrintRecordView, PrintTemplateView } from '../../../api/types';
import { SAMPLE, sampleConfig } from '../paper/sampleData';

// Dữ liệu giả cho bài thử hộp In. Tiền và mã băm là GIẢ (máy chủ thật dựng ở G-M4); web chỉ gửi mã băm lại.

export const HASH_NOW = 'a'.repeat(64);
export const HASH_SNAP = 'b'.repeat(64);

export function tpl(id: string, name: string, layout: 1 | 2 | 3 | 4 | 5, version = 1, over: Partial<PrintTemplateView> = {}): PrintTemplateView {
  return {
    id,
    name,
    layout,
    appliesTo: ['SERVICE'],
    defaultFor: [],
    blocks: {},
    title: null,
    openingText: null,
    closingText: null,
    version,
    isActive: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    updatedBy: null,
    usage: { printedContracts: 0, lastPrintedAt: null },
    ...over,
  };
}

export const T_MODERN = tpl('t-modern', 'Hiện đại', 2, 1, { defaultFor: ['SERVICE'] });
export const T_TABLE = tpl('t-table', 'Bảng kẻ đầy đủ', 3, 4);

export function withStatus(data: ContractPrintData, status: ContractStatus): ContractPrintData {
  return { ...data, contract: { ...data.contract, status } };
}

export function printData(over: Partial<PrintDataResult> = {}, status: ContractStatus = 'DRAFT', data: ContractPrintData = SAMPLE.SERVICE.long): PrintDataResult {
  const d = withStatus(data, status);
  return {
    contract: { id: 'hd-1', code: d.contract.code, kind: d.kind, status, updatedAt: '2026-10-25T03:00:00.000Z' },
    data: d,
    dataHash: HASH_NOW,
    logoUrl: null,
    logoUrlExpiresAt: null,
    templates: [T_MODERN, T_TABLE],
    defaultTemplateId: T_MODERN.id,
    lastPrint: null,
    printCount: 0,
    warnings: [],
    ...over,
  };
}

export function record(over: Partial<PrintRecordView> = {}): PrintRecordView {
  return {
    id: 'pr-1',
    printNo: 1,
    source: 'TEMPLATE',
    basedOnPrintId: null,
    printedAt: '2026-10-20T07:30:00.000Z',
    printedBy: { id: 'u-1', fullName: 'Nguyễn Trọng Chiến' },
    templateId: T_MODERN.id,
    templateName: 'Hiện đại',
    templateVersion: 1,
    layout: 2,
    contractStatus: 'CONFIRMED',
    ...over,
  };
}

export function snapshot(over: Partial<ContractPrintResult> = {}, cfg: ResolvedPrintConfig = sampleConfig(2, 'SERVICE'), data: ContractPrintData = withStatus(SAMPLE.SERVICE.long, 'CONFIRMED')): ContractPrintResult {
  return { print: record(), config: cfg, data, dataHash: HASH_SNAP, logoUrl: null, warnings: [], ...over };
}
