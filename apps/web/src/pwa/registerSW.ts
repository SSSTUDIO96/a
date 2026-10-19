/// <reference types="vite/client" />
// Đăng ký service worker (public/sw.js). Chỉ ở bản build chạy thật: lúc dev (vite) service worker làm khó việc sửa mã.
// Lỗi đăng ký không được làm hỏng app: nuốt và ghi cảnh báo.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    // register() trả về Promise; một số môi trường còn ném lỗi đồng bộ, nên bọc cả hai.
    Promise.resolve(navigator.serviceWorker.register('/sw.js', { scope: '/' })).catch((err: unknown) => {
      console.warn('Không đăng ký được service worker:', err);
    });
  } catch (err) {
    console.warn('Không đăng ký được service worker:', err);
  }
}
