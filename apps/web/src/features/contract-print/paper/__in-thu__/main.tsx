// Trang in thử bố cục — chỉ dùng cho paper/print.pdf.test.ts. Dựng PrintFrame + PrintPaper THẬT (cùng CSS như màn thật):
// hộp thoại gắn vào body qua portal, "màn ứng dụng" giả nằm ở #root và phải ẩn khi in.
import { createRoot } from 'react-dom/client';
import { isPrintLayout, type ContractPrintData, type PrintBlockOverrides, type ToggleBlockKey } from '@makeup/shared';
import '../../../../styles/base.css';
import { PrintFrame } from '../PrintFrame';
import { PrintPaper } from '../PrintPaper';
import { SAMPLE_LOGO, sampleConfig, sampleFor } from '../sampleData';

const root = document.getElementById('root');
if (!root) throw new Error('Thiếu phần tử #root');

const q = new URLSearchParams(location.search);
const layoutNo = Number(q.get('bo-cuc') ?? '1');
if (!isPrintLayout(layoutNo)) throw new Error(`?bo-cuc phải từ 1 đến 5, nhận "${q.get('bo-cuc')}"`);
const kind = q.get('loai') === 'COURSE' ? 'COURSE' : 'SERVICE';
const ban = q.get('ban') ?? 'long';
const list = (k: string) => (q.get(k) ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const overrides: PrintBlockOverrides = {};
for (const k of list('tat')) overrides[k as ToggleBlockKey] = false;
for (const k of list('bat')) overrides[k as ToggleBlockKey] = true;

let data: ContractPrintData = sampleFor(kind, ban);
if (q.has('nhap')) data = { ...data, contract: { ...data.contract, status: 'DRAFT' } };
if (q.has('an-tien')) data = { ...data, payments: null, paymentsHidden: true };
if (q.has('an-lien-he')) data = { ...data, customer: { ...data.customer, phone: null, email: null, contactHidden: true } };
if (q.get('ten')) data = { ...data, customer: { ...data.customer, fullName: q.get('ten')! } };
if (q.get('ma')) data = { ...data, contract: { ...data.contract, code: q.get('ma')! } };
const config = sampleConfig(layoutNo, kind, overrides);
const lan = Number(q.get('lan-in') ?? '0');
const lech = Number(q.get('lech') ?? '0');

createRoot(root).render(
  <>
    {/* Màn ứng dụng phía sau hộp thoại — khi in phải ẩn hết. */}
    <main className="in-thu-man" style={{ minHeight: '200vh' }}>
      <h1>Màn ứng dụng (phải ẩn khi in)</h1>
    </main>
    <PrintFrame
      open
      onClose={() => {}}
      title="In hợp đồng"
      eyebrow={`${data.contract.code} · bố cục ${layoutNo}`}
      layout={layoutNo}
      aside={<div className="in-thu-aside">Cột lựa chọn (phải ẩn khi in)</div>}
    >
      <div style={lech > 0 ? { paddingTop: `${lech}mm` } : undefined} className="in-thu-lech">
        <PrintPaper
          data={data}
          config={config}
          logoUrl={q.has('khong-logo') ? null : SAMPLE_LOGO}
          printMark={lan > 0 ? { printNo: lan, printedOn: '2026-10-25', source: 'TEMPLATE' } : undefined}
        />
      </div>
    </PrintFrame>
  </>,
);
