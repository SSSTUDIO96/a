// Trang in thử giấy chứng nhận — chỉ dùng cho bài PrintSheet.pdf.test.ts.
// Dùng ĐÚNG mã thật: render.ts (tệp mẫu thật /mau/cc-NN.html qua renderTemplatePng) + pdf.ts (pdf-lib) + PrintArea.tsx (+ certificates.css).
//   window.gcn.lam(views)       vẽ + ghép PDF, trả { pdfBase64, pageCount, renderMs, pdfMs, pdfBytes, errors, warnings, jpegBytes[] }
//   window.gcn.hienVungIn()     dựng vùng in (PrintPages) từ PNG của lần lam gần nhất — bài gọi page.pdf() để đếm trang
//   window.gcn.gan(views)       gắn <PrintSheet> thật (bản in đủ nút) để bài bấm thử
import { createRoot } from 'react-dom/client';
import '../../../styles/base.css';
import type { CertificateView } from '../../../api/certificates';
import { PrintPages } from '../PrintArea';
import { PrintSheet } from '../PrintSheet';
import { buildCertificatePdf } from '../pdf';
import { renderCertificates, type RenderOutcome } from '../render';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Thiếu phần tử #root');
const root = createRoot(rootEl);

let last: RenderOutcome[] = [];

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const api = {
  async lam(views: CertificateView[]) {
    const t0 = performance.now();
    last = await renderCertificates(views);
    const renderMs = performance.now() - t0;
    const ok = last.flatMap((o) => (o.page ? [o.page] : []));
    const t1 = performance.now();
    const pdf = ok.length ? await buildCertificatePdf(ok.map((p) => p.jpeg), 'Giấy chứng nhận — in thử') : null;
    const pdfMs = performance.now() - t1;
    return {
      pdfBase64: pdf ? toBase64(pdf.bytes) : '',
      pageCount: pdf?.pageCount ?? 0,
      renderMs,
      pdfMs,
      pdfBytes: pdf?.bytes.byteLength ?? 0,
      errors: last.flatMap((o) => (o.error ? [o.error] : [])),
      warnings: ok.flatMap((p) => p.warnings),
      jpegBytes: ok.map((p) => p.jpeg.byteLength),
      pngBytes: ok.map((p) => p.png.size),
    };
  },
  hienVungIn() {
    const images = last.flatMap((o) => (o.page ? [{ key: o.view.id, url: URL.createObjectURL(o.page.png), alt: o.view.studentName }] : []));
    root.render(
      <>
        {/* Màn ứng dụng phía sau — khi in phải ẩn hết. */}
        <main style={{ minHeight: '200vh' }}>
          <h1>Màn ứng dụng (phải ẩn khi in)</h1>
        </main>
        <PrintPages images={images} />
      </>,
    );
    return images.length;
  },
  gan(views: CertificateView[]) {
    root.render(
      <main style={{ padding: 16, maxWidth: 720 }}>
        <PrintSheet orgId="org-in-thu" items={views} baseName="Giay-chung-nhan-in-thu" pdfTitle="Giấy chứng nhận — in thử" breakpoint="desktop" />
      </main>,
    );
  },
};

(window as unknown as { gcn: typeof api }).gcn = api;
document.body.dataset.ready = '1';
