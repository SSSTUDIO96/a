// Điểm vào trang xem thử component. Chỉ gắn trang khi chạy vite dev (import có điều kiện);
// bản build chỉ có index.html nên tệp này không vào dist. Không đụng src/app/routes.tsx.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../styles/base.css';

const root = document.getElementById('root');
if (!root) throw new Error('Thiếu phần tử #root trong xem-thu.html');

if (import.meta.env.DEV) {
  void import('./UiGallery').then(({ UiGallery }) => {
    createRoot(root).render(
      <StrictMode>
        <UiGallery />
      </StrictMode>,
    );
  });
} else {
  root.textContent = 'Trang xem thử chỉ có khi chạy vite dev.';
}
