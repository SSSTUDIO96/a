// Trang in thử hợp đồng khoá học — chỉ dùng cho bài ContractPrint.pdf.test.ts (biên bản nghiệm thu lại N1).
// Dựng đúng ContractPrintDialog + contracts.css như màn thật (hộp thoại gắn vào body qua portal, màn ứng dụng nằm ở #root).
// ?mau=ngan: hợp đồng ngắn (1 trang). ?mau=dai: 45 điều khoản + nội quy (nhiều trang).
import { createRoot } from 'react-dom/client';
import '../../../styles/base.css';
import '../contracts.css';
import { ContractPrintDialog, type PrintText } from '../ContractPrint';

const root = document.getElementById('root');
if (!root) throw new Error('Thiếu phần tử #root');

const long = new URLSearchParams(location.search).get('mau') === 'dai';

const clause = (n: number) =>
  `${n}. Học viên tham gia đầy đủ các buổi học theo lịch của lớp; nghỉ quá ba buổi không báo trước thì trung tâm được xếp học bù vào lớp sau, không hoàn học phí phần đã nghỉ (điều ${n}).`;

const texts: PrintText[] = long
  ? [
      { title: 'Điều khoản khoá học', source: 'Điều khoản khoá học · bản v3', body: Array.from({ length: 45 }, (_, i) => clause(i + 1)).join('\n') },
      {
        title: 'Nội quy lớp học',
        source: null,
        body: ['Đến lớp đúng giờ.', 'Giữ gìn dụng cụ chung.', 'Không quay phim khi chưa được phép.', 'Báo nghỉ trước 24 giờ.'].join('\n'),
      },
    ]
  : [
      { title: 'Điều khoản khoá học', source: null, body: [clause(1), clause(2), clause(3)].join('\n') },
      { title: 'Nội quy lớp học', source: null, body: 'Đến lớp đúng giờ.\nGiữ gìn dụng cụ chung.' },
    ];

createRoot(root).render(
  <>
    {/* Màn ứng dụng phía sau hộp thoại — khi in phải ẩn hết. */}
    <main className="in-thu-man" style={{ minHeight: '200vh' }}>
      <h1>Màn ứng dụng (phải ẩn khi in)</h1>
    </main>
    <ContractPrintDialog
      open
      onClose={() => {}}
      eyebrow={long ? 'HĐKH-000002 · nháp' : 'HĐKH-000001 · nháp'}
      orgName="Học viện Chiến Makeup"
      title="HỢP ĐỒNG ĐÀO TẠO"
      code={long ? 'HĐKH-000002' : 'HĐKH-000001'}
      dateText="Ngày 19/10/2026"
      customer={{ fullName: 'Vũ Thị Hồng Nhung', phone: '0912345678' }}
      lines={[
        { key: 'k1', name: 'Khoá makeup cá nhân — Lớp K1', detail: 'Khai giảng 02/11/2026 · Thứ 3, 5 · 18:00–21:00', amount: 15_000_000 },
        { key: 'k2', name: 'Bộ cọ học viên', amount: 1_200_000 },
      ]}
      subtotal={16_200_000}
      discount={1_000_000}
      total={15_200_000}
      deposit={5_000_000}
      installments={[
        { id: 'i1', name: 'Đợt cọc', dueDate: '2026-10-25', amount: 5_000_000, isDeposit: true },
        { id: 'i2', name: 'Đợt 2', dueDate: '2026-11-15', amount: 10_200_000, isDeposit: false },
      ]}
      texts={texts}
      notes={null}
      fmtDate={(iso) => iso.split('-').reverse().join('/')}
    />
  </>,
);
