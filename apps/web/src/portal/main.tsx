// Trang vào của cổng học viên (/hv) — bản TẠM của gói W1, gói W2 thay bằng màn thật (bản vẽ E mục 5.1).
// Cổng KHÔNG được kéo mã app nhân viên: cấm nhập src/api/client.ts, src/app, src/layout, src/features (scripts/check-portal-bundle.mjs chặn khi build).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import { registerServiceWorker } from '../pwa/registerSW';

const root = document.getElementById('root');
if (!root) throw new Error('Thiếu phần tử #root trong hv.html');

createRoot(root).render(
  <StrictMode>
    <main style={{ padding: 24, fontFamily: 'var(--font)', color: 'var(--text)' }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>Trang học viên</h1>
      <p style={{ color: 'var(--muted)' }}>Đang dựng.</p>
    </main>
  </StrictMode>,
);

registerServiceWorker();
