import type { ContractStatus } from '@makeup/shared';
import type { PrintSource, PrintTemplateView } from '../../../api/types';

// Lựa chọn chọn sẵn của hộp In (bản vẽ G mục 4.4). Hàm thuần.
//   đã xác nhận / hoàn thành, có lần in, dữ liệu không đổi → REPRINT lần in gần nhất
//   đã xác nhận / hoàn thành, có lần in, dữ liệu đã đổi    → PRIOR_CONFIG lần in gần nhất
//   nháp có lần in                                         → TEMPLATE, mẫu của lần in trước (nếu còn dùng được), không thì mẫu mặc định
//   chưa in lần nào                                        → TEMPLATE mẫu mặc định
//   không có mẫu nào (và không có gì để giữ)               → NONE

export interface ChoiceInput {
  status: ContractStatus;
  // Lần in gần nhất ĐÃ tải được bản chụp (không tải được thì truyền null: coi như chưa có gì để giữ).
  lastPrint: { templateId: string; sameData: boolean } | null;
  templates: readonly Pick<PrintTemplateView, 'id'>[];
  defaultTemplateId: string | null;
}

export type DefaultChoice =
  | { source: Extract<PrintSource, 'REPRINT' | 'PRIOR_CONFIG'> }
  | { source: 'TEMPLATE'; templateId: string }
  | { source: 'NONE' };

export function defaultChoice(i: ChoiceInput): DefaultChoice {
  if (i.status === 'CANCELLED') return { source: 'NONE' };
  const keep = i.status === 'CONFIRMED' || i.status === 'COMPLETED';
  if (keep && i.lastPrint) return { source: i.lastPrint.sameData ? 'REPRINT' : 'PRIOR_CONFIG' };
  return templateChoice(i);
}

// Mẫu để chọn khi in theo mẫu: mẫu của lần in trước (nháp) → mẫu mặc định → mẫu đứng đầu danh sách (máy chủ xếp mặc định đứng đầu).
export function templateChoice(i: Pick<ChoiceInput, 'lastPrint' | 'templates' | 'defaultTemplateId'>): DefaultChoice {
  const ids = new Set(i.templates.map((t) => t.id));
  if (i.lastPrint && ids.has(i.lastPrint.templateId)) return { source: 'TEMPLATE', templateId: i.lastPrint.templateId };
  if (i.defaultTemplateId !== null && ids.has(i.defaultTemplateId)) return { source: 'TEMPLATE', templateId: i.defaultTemplateId };
  const first = i.templates[0];
  return first ? { source: 'TEMPLATE', templateId: first.id } : { source: 'NONE' };
}
