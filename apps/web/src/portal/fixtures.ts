// Dữ liệu mẫu PortalMe cho bài thử (không đi vào bản build của cổng: chỉ bài thử nhập tệp này).
import type { PortalMe } from '@makeup/shared';

export function makeMe(over: Partial<PortalMe> = {}): PortalMe {
  return {
    center: { name: 'Chiến Makeup Academy', logoUrl: null, phone: '0281234567', zalo: '0909000111', address: '25 Hoàng Quốc Việt, Cầu Giấy, Hà Nội' },
    bank: { bankName: 'Vietcombank', accountNo: '0123456789', accountName: 'CONG TY MAKEUP' },
    student: { fullName: 'Tôn Nữ Phương Thảo', callName: 'Thảo', avatarUrl: null },
    device: { label: 'iPhone · Safari', openedAt: '2026-11-01T03:00:00.000Z' },
    timezone: 'Asia/Ho_Chi_Minh',
    serverTime: '2026-11-10T10:00:00.000Z', // 17:00 ngày 10/11 giờ Việt Nam
    enrollments: [
      {
        courseName: 'Makeup chuyên nghiệp',
        className: 'Lớp K12',
        classStatus: 'OPEN',
        startDate: '2026-11-03',
        endDate: '2026-12-20',
        weekdays: [2, 4],
        startTime: '18:00',
        endTime: '22:00',
        sessionCount: 12,
        instructor: { name: 'Nguyễn Thu Hà', avatarUrl: null },
        location: { name: 'Cơ sở Cầu Giấy', address: '25 Hoàng Quốc Việt, Cầu Giấy, Hà Nội', latitude: 21.046, longitude: 105.797 },
        contractCode: 'HĐKH-000042',
        sessions: [
          { date: '2026-11-03', startsAt: '2026-11-03T11:00:00.000Z', endsAt: '2026-11-03T15:00:00.000Z', status: 'DONE' },
          { date: '2026-11-05', startsAt: '2026-11-05T11:00:00.000Z', endsAt: '2026-11-05T15:00:00.000Z', status: 'CANCELLED' },
          { date: '2026-11-10', startsAt: '2026-11-10T11:00:00.000Z', endsAt: '2026-11-10T15:00:00.000Z', status: 'SCHEDULED' },
          { date: '2026-11-12', startsAt: '2026-11-12T11:00:00.000Z', endsAt: '2026-11-12T15:00:00.000Z', status: 'SCHEDULED' },
        ],
      },
    ],
    contracts: [
      {
        code: 'HĐKH-000042',
        status: 'CONFIRMED',
        confirmedAt: '2026-10-20T03:00:00.000Z',
        lines: [{ name: 'Makeup chuyên nghiệp · Lớp K12', quantity: 1, unitPrice: 15_000_000, lineTotal: 15_000_000 }],
        subtotal: 15_000_000,
        discount: 1_000_000,
        total: 14_000_000,
        paid: 8_000_000,
        remaining: 6_000_000,
        installments: [
          { name: 'Đặt cọc', dueDate: '2026-10-19T17:00:00.000Z', amount: 3_000_000, isDeposit: true, paidAmount: 3_000_000, status: 'PAID' },
          { name: 'Đợt 1', dueDate: '2026-11-02T17:00:00.000Z', amount: 6_000_000, isDeposit: false, paidAmount: 5_000_000, status: 'OVERDUE' },
          { name: 'Đợt 2', dueDate: '2026-11-16T17:00:00.000Z', amount: 5_000_000, isDeposit: false, paidAmount: 0, status: 'DUE' },
        ],
        receipts: [
          { code: 'PT-000101', kind: 'RECEIPT', method: 'BANK_TRANSFER', amount: 3_000_000, receivedAt: '2026-10-20T03:00:00.000Z' },
          { code: 'PT-000107', kind: 'RECEIPT', method: 'CASH', amount: 5_000_000, receivedAt: '2026-11-04T03:00:00.000Z' },
        ],
        terms: 'Học viên đóng học phí đúng hạn.\nTrung tâm không hoàn học phí sau buổi thứ 3.',
        rules: 'Đi học đúng giờ.\nKhông dùng điện thoại trong lớp.',
        transferNote: 'HDKH-000042 Phuong Thao',
      },
    ],
    cards: [
      { kind: 'WELCOME', createdAt: '2026-10-21T03:00:00.000Z', className: 'Lớp K12', url: '/api/v1/files/raw/abc', urlExpiresAt: '2026-11-10T10:10:00.000Z', width: 1080, height: 1350 },
      { kind: 'FEEDBACK', createdAt: '2026-11-05T03:00:00.000Z', className: null, url: '/api/v1/files/raw/def', urlExpiresAt: '2026-11-10T10:10:00.000Z', width: null, height: null },
    ],
    ...over,
  };
}
