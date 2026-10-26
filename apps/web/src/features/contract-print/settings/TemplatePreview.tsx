import { useDeferredValue, useMemo, useState } from 'react';
import { resolvePrintConfig, type ContractPrintData } from '@makeup/shared';
import type { BrandProfileResult, ContractKind } from '../../../api/types';
import { Segmented } from '../../../ui';
import { PaperPreview } from '../paper/PaperPreview';
import { PrintPaper } from '../paper/PrintPaper';
import { sampleFor } from '../paper/sampleData';
import { KIND_LABEL, templateLike, type TemplateDraft } from './logic';

// Studio trên bản xem trước = hồ sơ thật (GET /profile); chưa có hồ sơ thì chỉ có tên tổ chức (đúng như máy chủ dựng print-data).
export function studioOf(result: BrandProfileResult | null, orgName: string): ContractPrintData['studio'] {
  const p = result !== null && result.hasProfile ? result.profile : null;
  if (p === null) {
    return { name: orgName, tagline: null, address: null, phone: null, email: null, website: null, logoFileId: null, representative: null, bank: null };
  }
  return {
    name: p.brandName,
    tagline: p.tagline,
    address: p.address,
    phone: p.phone,
    email: p.email,
    website: p.website,
    logoFileId: p.logoFileId,
    representative: p.representativeName !== null ? { name: p.representativeName, title: p.representativeTitle } : null,
    bank:
      p.bankName !== null && p.bankAccountNumber !== null && p.bankAccountName !== null
        ? { bankName: p.bankName, accountNumber: p.bankAccountNumber, accountName: p.bankAccountName }
        : null,
  };
}

type Ban = 'long' | 'short';

// Xem trước trực tiếp: dữ liệu mẫu (sampleFor) + studio thật + cấu hình gộp từ bản nháp bằng resolvePrintConfig. Bản nháp đi
// qua useDeferredValue để gõ chữ không bị giật khi tờ giấy vẽ lại.
export function TemplatePreview({
  draft,
  templateId,
  version,
  studio,
  logoUrl,
}: {
  draft: TemplateDraft;
  templateId: string;
  version: number;
  studio: ContractPrintData['studio'];
  logoUrl: string | null;
}) {
  const shown = useDeferredValue(draft);
  const [pick, setPick] = useState<ContractKind>('SERVICE');
  const [ban, setBan] = useState<Ban>('long');
  const kind: ContractKind = shown.appliesTo.includes(pick) ? pick : (shown.appliesTo[0] ?? 'SERVICE');

  const data = useMemo<ContractPrintData>(() => ({ ...sampleFor(kind, ban), studio }), [kind, ban, studio]);
  const config = useMemo(() => resolvePrintConfig(templateLike(shown, templateId, version), kind), [shown, templateId, version, kind]);

  return (
    <section className="mi-prev" aria-label="Xem trước bản in">
      <div className="mi-prev__bar">
        {shown.appliesTo.length === 2 && (
          <Segmented
            size="sm"
            aria-label="Xem trước theo loại hợp đồng"
            value={kind}
            onChange={setPick}
            options={(['SERVICE', 'COURSE'] as const).map((k) => ({ value: k, label: `Hợp đồng ${KIND_LABEL[k]}` }))}
          />
        )}
        <Segmented
          size="sm"
          aria-label="Bản dài hoặc ngắn"
          value={ban}
          onChange={setBan}
          options={[
            { value: 'long', label: 'Bản dài' },
            { value: 'short', label: 'Bản ngắn' },
          ]}
        />
      </div>
      <div className="mi-prev__frame">
        <PaperPreview layout={config.layout}>
          <PrintPaper data={data} config={config} logoUrl={logoUrl} />
        </PaperPreview>
      </div>
      <p className="mi-prev__note">Dữ liệu mẫu: tên khách, ngày, tiền là giả. Logo, tên, địa chỉ lấy từ hồ sơ thương hiệu.</p>
    </section>
  );
}
