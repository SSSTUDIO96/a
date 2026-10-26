// Trang in thử hộp In — chỉ dùng cho dialog/PrintDialog.real.test.ts. Màn hợp đồng giả + nút In thật + máy chủ thật.
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import '../../../../styles/base.css';
import { setAccessToken } from '../../../../api/client';
import type { ContractStatus } from '@makeup/shared';
import { PrintButton } from '../PrintButton';

const root = document.getElementById('root');
if (!root) throw new Error('Thiếu phần tử #root');
const q = new URLSearchParams(location.search);
const orgId = q.get('org');
const contractId = q.get('hd');
if (!orgId || !contractId) throw new Error('Thiếu ?org= hoặc ?hd=');
const token = (window as unknown as { __HDIN__?: { token?: string } }).__HDIN__?.token;
if (!token) throw new Error('Thiếu window.__HDIN__.token');
setAccessToken(token);
const status = (q.get('trang-thai') ?? 'DRAFT') as ContractStatus;
const phone = q.has('dien-thoai');

function Screen() {
  const { id } = useParams();
  return (
    <main className="in-thu-man" style={{ minHeight: '200vh', padding: 16 }}>
      <h1>Màn hợp đồng giả (phải ẩn khi in)</h1>
      <PrintButton
        orgId={orgId!}
        tz="Asia/Ho_Chi_Minh"
        contractId={id ?? null}
        status={status}
        needsSave={false}
        ensureSaved={async () => id ?? null}
        canManageTemplates={q.has('quyen-mau')}
        phone={phone}
        size={phone ? 'sm' : 'md'}
      />
    </main>
  );
}

createRoot(root).render(
  <MemoryRouter initialEntries={[`/chien/hop-dong/${contractId}`]}>
    <Routes>
      <Route path="/:orgSlug/hop-dong/:id" element={<Screen />} />
    </Routes>
  </MemoryRouter>,
);
