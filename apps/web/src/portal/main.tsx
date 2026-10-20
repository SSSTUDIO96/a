// Trang vào của cổng học viên (/hv) — bản vẽ E mục 5.1. KHÔNG được kéo mã app nhân viên: cấm nhập src/api/client.ts,
// src/app, src/layout, src/features (scripts/check-portal-bundle.mjs chặn khi build).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import './portal.css';
import { registerServiceWorker } from '../pwa/registerSW';
import { PortalApp } from './PortalApp';

const root = document.getElementById('root');
if (!root) throw new Error('Thiếu phần tử #root trong hv.html');

createRoot(root).render(
  <StrictMode>
    <PortalApp />
  </StrictMode>,
);

registerServiceWorker();
