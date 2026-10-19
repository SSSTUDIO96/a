// Service worker TỐI THIỂU của Makeup Pro (app nhân viên "/" và cổng học viên "/hv"). Bản vẽ E mục 5.3.
//
// MỤC ĐÍCH: (1) đủ điều kiện "cài lên màn hình chính" (Chromium cần một service worker có xử lý fetch),
//           (2) khi mất mạng thì mở trang "Đang ngoại tuyến" thay vì trang lỗi của trình duyệt.
//
// CHIẾN LƯỢC ĐỆM (đủ ba dòng, đổi một dòng là phải đổi bài thử src/pwa/sw.test.ts):
//   1. /api/**            KHÔNG BAO GIỜ chạm: không respondWith, không đệm. Dữ liệu khách, tiền, phiên đăng nhập, ảnh có chữ ký
//                         là dữ liệu riêng tư và có thể nằm trên máy dùng chung — không được nằm lại trên máy sau khi đăng xuất.
//   2. Điều hướng (HTML)  mạng trước; mất mạng mới trả /offline.html. KHÔNG đệm trang HTML (trang chứa tên trung tâm, tên người dùng).
//   3. /assets/**         tệp mã (JS/CSS) có mã băm trong tên, nội dung không đổi → đệm "cache-first". Không chứa dữ liệu người dùng.
//   Mọi thứ khác (POST, khác nguồn, /mau/, ảnh, phông...) → bỏ qua, trình duyệt tự xử lý như chưa có service worker.
//
// THÔNG BÁO ĐẨY: GIAI ĐOẠN SAU (bản vẽ E mục 5.4). Không thêm listener 'push' / 'notificationclick' ở bản này.
const VERSION = 'mp-sw-1'; // đổi khi sửa tệp này
const ASSETS = `assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(ASSETS).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== ASSETS).map((name) => caches.delete(name)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // KHÔNG BAO GIỜ chạm dữ liệu (riêng tư, máy dùng chung).
  if (url.pathname.startsWith('/api/')) return;
  // Không đệm HTML: mạng trước, mất mạng thì trang ngoại tuyến.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  // Tệp có mã băm: không đổi nên đệm trước được.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSETS).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            }),
        ),
      ),
    );
  }
});
