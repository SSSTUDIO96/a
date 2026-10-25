import {
  resolvePrintConfig,
  vndInWords,
  type ContractPrintData,
  type PrintBlockOverrides,
  type PrintLayout,
  type PrintLine,
  type PrintPayments,
  type PrintSubLine,
  type ResolvedPrintConfig,
  type Vnd,
} from '@makeup/shared';

// Dữ liệu giả ĐÚNG kiểu ContractPrintData cho bộ vẽ + trang in thử + bài thử (chuyển từ docs/rnd/v9-mau-in/chung/du-lieu.js).
// Tiền ở đây do HÀM DỰNG BÀI THỬ viết ra như máy chủ (G-M4) sẽ trả; bộ vẽ chỉ đọc, không cộng. Bài rows.test.ts kiểm
// fixture tự nhất quán: Σ lineTotal các dòng in (gồm dịch vụ phụ, phụ phí, phí di chuyển) = money.subtotal.
// Mọi tên người, số điện thoại, số tài khoản là GIẢ.

const SERVICE_TERMS: string[] = [
  'Bên B đặt cọc theo tiến độ thanh toán để Bên A giữ lịch và thợ. Tiền cọc không hoàn lại nếu Bên B huỷ dịch vụ trong vòng 30 ngày trước ngày sự kiện.',
  'Bên B được đổi ngày sự kiện một lần, báo trước ít nhất 15 ngày và còn lịch trống; tiền cọc được chuyển sang ngày mới.',
  'Bên A có mặt đúng giờ đã ghi trong hợp đồng. Bên B chuẩn bị chỗ ngồi đủ ánh sáng, có ổ điện và gương.',
  'Nếu Bên B chậm quá 30 phút so với giờ hẹn, thời gian trang điểm có thể rút ngắn tương ứng; Bên A không chịu trách nhiệm việc trễ lịch chụp hoặc lễ.',
  'Phí di chuyển tính theo quãng đường thực tế từ studio đến địa điểm (đã ghi trong bảng dịch vụ). Đổi địa điểm thì tính lại phí.',
  'Thêm người trang điểm, thêm dịch vụ hoặc làm ngoài giờ trong ngày sự kiện được tính theo bảng giá hiện hành và ghi vào phiếu phát sinh.',
  'Bên A dùng mỹ phẩm chính hãng, còn hạn sử dụng. Bên B báo trước tình trạng da, tiền sử dị ứng (nếu có).',
  'Bên A được dùng hình ảnh trang điểm của Bên B để giới thiệu dịch vụ khi Bên B đồng ý. Bên B có thể từ chối bằng cách báo cho Bên A.',
  'Bên B thanh toán phần còn lại trước khi bắt đầu trang điểm ngày sự kiện, bằng tiền mặt hoặc chuyển khoản vào tài khoản ghi trong hợp đồng.',
  'Thiên tai, dịch bệnh hoặc sự kiện bất khả kháng khiến một bên không thực hiện được hợp đồng thì hai bên thoả thuận dời lịch, không phạt cọc.',
  'Nếu Bên A không thực hiện được dịch vụ vì lý do của Bên A, Bên A hoàn lại toàn bộ tiền đã nhận và bồi thường bằng số tiền cọc.',
  'Mọi tranh chấp được hai bên thương lượng trên tinh thần hợp tác; không thương lượng được thì đưa ra toà án có thẩm quyền.',
];

const COURSE_TERMS: string[] = [
  'Học phí ghi trong hợp đồng là học phí trọn khoá, đã gồm giáo trình điện tử và buổi thi cuối khoá.',
  'Học viên đóng tiền cọc để giữ chỗ; lớp chỉ giữ chỗ khi hợp đồng đã được trung tâm xác nhận.',
  'Học viên đóng các đợt còn lại đúng hạn ghi trong tiến độ thanh toán; quá hạn 7 ngày trung tâm được tạm ngừng xếp buổi học.',
  'Trung tâm xuất phiếu thu cho mỗi lần học viên đóng tiền; học viên giữ phiếu thu để đối chiếu.',
  'Học phí đã đóng không chuyển nhượng cho người khác, trừ khi trung tâm đồng ý bằng văn bản.',
  'Ưu đãi giảm giá chỉ áp dụng cho khoá ghi trong hợp đồng, không quy đổi thành tiền mặt.',
  'Học viên đóng tiền bằng chuyển khoản ghi rõ mã hợp đồng trong nội dung chuyển khoản.',
  'Trung tâm không thu thêm khoản nào ngoài hợp đồng, trừ dụng cụ học viên tự chọn mua thêm.',
  'Lịch học theo lớp ghi trong hợp đồng; trung tâm thông báo trước ít nhất 48 giờ nếu đổi giờ học.',
  'Học viên có mặt trước giờ học 10 phút để chuẩn bị dụng cụ và mẫu.',
  'Học viên nghỉ học phải báo giảng viên trước 24 giờ qua Zalo hoặc điện thoại của trung tâm.',
  'Nghỉ không báo trước quá ba buổi thì trung tâm được xếp học bù vào lớp sau, không hoàn học phí phần đã nghỉ.',
  'Mỗi học viên được học bù tối đa bốn buổi trong thời gian khoá học.',
  'Buổi học bù xếp theo lớp đang mở có cùng nội dung, tuỳ chỗ trống.',
  'Đi muộn quá 30 phút tính là vắng nửa buổi khi xét điều kiện thi cuối khoá.',
  'Học viên vắng quá 20% số buổi không đủ điều kiện thi cuối khoá, được học lại một phần ở lớp sau.',
  'Học viên được bảo lưu khoá học một lần, tối đa 6 tháng, báo trước ít nhất 7 ngày.',
  'Thời gian bảo lưu tính từ buổi học tiếp theo sau ngày báo bảo lưu.',
  'Hết hạn bảo lưu mà học viên không quay lại học thì phần học phí còn lại không được hoàn.',
  'Học viên được chuyển sang lớp khác cùng khoá một lần, nếu lớp mới còn chỗ.',
  'Chuyển sang khoá có học phí cao hơn thì học viên đóng thêm phần chênh lệch.',
  'Chuyển sang khoá có học phí thấp hơn thì trung tâm không hoàn phần chênh lệch.',
  'Trung tâm được gộp lớp hoặc dời ngày khai giảng tối đa 14 ngày nếu lớp chưa đủ học viên.',
  'Trung tâm chuẩn bị mỹ phẩm dùng chung trong buổi học; học viên tự chuẩn bị bộ cọ cá nhân hoặc mua bộ cọ của trung tâm.',
  'Học viên giữ gìn dụng cụ chung; làm hỏng hoặc mất thì bồi thường theo giá mua.',
  'Học viên tự mời mẫu cho các buổi thực hành có ghi "mẫu ngoài"; buổi khác trung tâm bố trí mẫu.',
  'Học viên không tự ý mang mỹ phẩm của trung tâm ra khỏi lớp.',
  'Học viên báo cho giảng viên nếu mẫu có tiền sử dị ứng mỹ phẩm trước khi thực hành.',
  'Trung tâm không chịu trách nhiệm tài sản cá nhân học viên để quên tại lớp.',
  'Giáo trình, video bài giảng là tài sản của trung tâm; học viên không sao chép, chia sẻ cho người khác.',
  'Học viên không quay phim toàn bộ buổi học; được chụp ảnh, quay đoạn ngắn để ôn bài.',
  'Ảnh thực hành của học viên có thể được trung tâm đăng giới thiệu khoá học khi học viên đồng ý.',
  'Học viên được dùng ảnh sản phẩm của chính mình để làm hồ sơ cá nhân, ghi tên trung tâm đào tạo.',
  'Học viên không dùng tên, logo trung tâm để quảng cáo dịch vụ riêng khi chưa được trung tâm đồng ý.',
  'Học viên đủ điều kiện và đạt bài thi cuối khoá được cấp chứng nhận tốt nghiệp của trung tâm.',
  'Học viên chưa đạt được thi lại một lần miễn phí trong vòng 30 ngày.',
  'Chứng nhận ghi họ tên theo hợp đồng; sai thông tin do học viên cung cấp thì học viên chịu phí in lại.',
  'Chứng nhận tốt nghiệp không thay thế văn bằng, chứng chỉ do cơ quan nhà nước cấp.',
  'Học viên huỷ hợp đồng trước ngày khai giảng 7 ngày được hoàn 70% số tiền đã đóng ngoài tiền cọc.',
  'Học viên huỷ hợp đồng sau ngày khai giảng không được hoàn học phí.',
  'Trung tâm huỷ lớp thì hoàn toàn bộ học phí đã đóng trong vòng 7 ngày làm việc.',
  'Học viên vi phạm nội quy nhiều lần, đã nhắc nhở bằng văn bản, trung tâm được chấm dứt hợp đồng và không hoàn học phí.',
  'Hoàn tiền thực hiện bằng chuyển khoản vào tài khoản đứng tên học viên.',
  'Hai bên cam kết thực hiện đúng các điều khoản; sửa đổi, bổ sung phải lập phụ lục có chữ ký hai bên.',
  'Mọi tranh chấp được giải quyết bằng thương lượng; không thương lượng được thì đưa ra toà án có thẩm quyền tại Hà Nội.',
];

const COURSE_RULES: string[] = [
  'Đến lớp đúng giờ, ký tên vào sổ điểm danh.',
  'Mặc trang phục gọn gàng, buộc tóc khi thực hành.',
  'Tắt chuông điện thoại trong giờ học.',
  'Giữ vệ sinh bàn trang điểm, rửa cọ chung sau mỗi buổi.',
  'Không ăn uống tại bàn trang điểm.',
  'Không quay phim khi chưa được giảng viên cho phép.',
  'Báo nghỉ trước 24 giờ.',
  'Tôn trọng giảng viên, mẫu và các học viên khác.',
];

// Logo giả (giả lập logo studio tải ở Hồ sơ thương hiệu) — nhúng thẳng để trang in thử không cần tệp.
export const SAMPLE_LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="none" stroke="#A63D62" stroke-width="3"/>' +
      '<circle cx="60" cy="60" r="49" fill="none" stroke="#A63D62" stroke-width="1"/>' +
      '<path d="M33 80 V44 L60 70 L87 44 V80" fill="none" stroke="#A63D62" stroke-width="6.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path d="M50 30 C56 22 64 22 70 30" fill="none" stroke="#A63D62" stroke-width="2.5" stroke-linecap="round"/><circle cx="60" cy="92" r="2.6" fill="#A63D62"/></svg>',
  );

const STUDIO: ContractPrintData['studio'] = {
  name: 'Chiến Makeup Studio',
  tagline: 'Trang điểm cô dâu · Đào tạo makeup chuyên nghiệp',
  address: '25 Thái Hà, phường Trung Liệt, Đống Đa, Hà Nội',
  phone: '0988 123 456',
  email: 'lienhe@chienmakeup.vn',
  website: 'chienmakeup.vn',
  logoFileId: '00000000-0000-4000-8000-000000000001',
  representative: { name: 'Nguyễn Trọng Chiến', title: 'Chủ studio' },
  bank: { bankName: 'Vietcombank — CN Thành Công', accountNumber: '001100456789', accountName: 'NGUYEN TRONG CHIEN' },
};

type LineInit = Partial<PrintLine> & Pick<PrintLine, 'kind' | 'name' | 'quantity' | 'unitPrice' | 'lineTotal'>;
function line(p: LineInit): PrintLine {
  return {
    subjectName: null,
    lineDiscount: 0,
    date: null,
    startTime: null,
    endTime: null,
    location: null,
    note: null,
    staff: { primary: [], assist: [] },
    addedAfterConfirm: false,
    addedOn: null,
    addons: [],
    surcharges: [],
    travel: null,
    course: null,
    ...p,
  };
}
type SubInit = Partial<PrintSubLine> & Pick<PrintSubLine, 'name' | 'quantity' | 'unitPrice' | 'lineTotal'>;
function sub(p: SubInit): PrintSubLine {
  return { lineDiscount: 0, addedAfterConfirm: false, addedOn: null, ...p };
}

const HOME = { type: 'CUSTOMER_HOME', text: 'Số 8 ngõ 102 Trường Chinh, Đống Đa, Hà Nội' } as const;

interface Build {
  kind: 'SERVICE' | 'COURSE';
  code: string;
  status: ContractPrintData['contract']['status'];
  issuedOn: string;
  eventDate: string | null;
  notes: string | null;
  customer: ContractPrintData['customer'];
  lines: PrintLine[];
  subtotal: Vnd;
  discount: Vnd;
  total: Vnd;
  deposit: Vnd;
  installments: { name: string; dueDate: string; amount: Vnd; isDeposit: boolean; paid: Vnd; state: 'PAID' | 'PARTIAL' | 'UNPAID' }[];
  receipts: PrintPayments['receipts'];
  paid: Vnd;
  terms: { title: string; items: string[]; name: string; version: number };
  rules?: { title: string; items: string[]; name: string; version: number };
}

function build(b: Build): ContractPrintData {
  const remaining = b.total - b.paid; // fixture: do máy chủ tính; chỉ dùng trong dữ liệu giả
  return {
    version: 1,
    kind: b.kind,
    contract: { code: b.code, status: b.status, issuedOn: b.issuedOn, eventDate: b.eventDate, notes: b.notes },
    studio: STUDIO,
    customer: b.customer,
    lines: b.lines,
    money: {
      subtotal: b.subtotal,
      discount: b.discount,
      total: b.total,
      totalInWords: vndInWords(b.total),
      depositRequired: b.deposit,
      depositInWords: vndInWords(b.deposit),
      travelTotal: b.lines.reduce((s, l) => s + (l.travel?.lineTotal ?? 0), 0),
    },
    payments: {
      installments: b.installments,
      receipts: b.receipts,
      paid: b.paid,
      remaining,
      remainingInWords: vndInWords(remaining),
      scheduleDifference: 0,
    },
    paymentsHidden: false,
    terms: { title: b.terms.title, items: b.terms.items, source: { name: b.terms.name, version: b.terms.version }, snapshot: b.status !== 'DRAFT' },
    rules: b.rules ? { title: b.rules.title, items: b.rules.items, source: { name: b.rules.name, version: b.rules.version }, snapshot: b.status !== 'DRAFT' } : null,
  };
}

const HANOI_STUDIO = { type: 'STUDIO', text: 'Cơ sở Thái Hà — 25 Thái Hà, Đống Đa, Hà Nội' } as const;

// ===== Hợp đồng dịch vụ — bản dài: Cô dâu + Phù dâu × 2 + phụ phí × 2 + phí di chuyển + giảm giá + đã thu cọc =====
const SERVICE_LONG = build({
  kind: 'SERVICE',
  code: 'HĐDV-000128',
  status: 'CONFIRMED',
  issuedOn: '2026-10-20',
  eventDate: '2026-12-12',
  notes: 'Cô dâu muốn tông trang điểm Hàn Quốc nhẹ; chụp ngoại cảnh lúc 9:00 sau lễ gia tiên.',
  customer: { fullName: 'Nguyễn Thu Trang', phone: '0903 456 789', email: 'thutrang.ng@gmail.com', contactHidden: false },
  lines: [
    line({
      kind: 'PACKAGE',
      name: 'Gói makeup cô dâu cao cấp',
      subjectName: 'Cô dâu',
      quantity: 1,
      unitPrice: 4_500_000,
      lineTotal: 4_500_000,
      date: '2026-12-12',
      startTime: '05:00',
      endTime: '07:30',
      location: HOME,
      note: 'Gồm makeup, làm tóc, 1 lần dặm lại trước lễ',
      staff: { primary: ['Chiến'], assist: ['Lan'] },
      addons: [sub({ name: 'Nối mi tơ', quantity: 1, unitPrice: 200_000, lineTotal: 200_000 })],
      surcharges: [sub({ name: 'Phụ phí ca sớm (bắt đầu trước 5:30)', quantity: 1, unitPrice: 300_000, lineTotal: 300_000 })],
      travel: {
        ...sub({ name: 'Phí di chuyển', quantity: 1, unitPrice: 252_000, lineTotal: 252_000 }),
        mode: 'PER_KM',
        distanceKm: 18.4,
        perKmAmount: 15_000,
        breakdown: { includedKm: 10, includedFrom: 'PACKAGE', excessKm: 8.4, chargedKm: 16.8, roundTrip: true, tier: null },
      },
    }),
    line({
      kind: 'SERVICE',
      name: 'Makeup tiệc',
      subjectName: 'Phù dâu',
      quantity: 2,
      unitPrice: 1_200_000,
      lineTotal: 2_400_000,
      date: '2026-12-12',
      startTime: '06:00',
      endTime: '07:30',
      location: HOME,
      staff: { primary: ['Hà'], assist: [] },
      surcharges: [sub({ name: 'Phụ phí ca sớm — phù dâu', quantity: 2, unitPrice: 50_000, lineTotal: 100_000 })],
    }),
  ],
  subtotal: 7_752_000,
  discount: 600_000,
  total: 7_152_000,
  deposit: 2_000_000,
  installments: [
    { name: 'Đặt cọc giữ lịch', dueDate: '2026-10-20', amount: 2_000_000, isDeposit: true, paid: 2_000_000, state: 'PAID' },
    { name: 'Thanh toán phần còn lại', dueDate: '2026-12-12', amount: 5_152_000, isDeposit: false, paid: 0, state: 'UNPAID' },
  ],
  receipts: [{ code: 'PT-000341', kind: 'RECEIPT', method: 'BANK_TRANSFER', amount: 2_000_000, receivedOn: '2026-10-20' }],
  paid: 2_000_000,
  terms: { title: 'Điều khoản', items: SERVICE_TERMS, name: 'Điều khoản dịch vụ trang điểm', version: 4 },
});

// ===== Hợp đồng dịch vụ — bản ngắn (phải ra đúng 1 trang ở mọi bố cục) =====
const SERVICE_SHORT = build({
  kind: 'SERVICE',
  code: 'HĐDV-000129',
  status: 'CONFIRMED',
  issuedOn: '2026-10-19',
  eventDate: '2026-11-18',
  notes: null,
  customer: { fullName: 'Phạm Hải Yến', phone: '0977 210 456', email: null, contactHidden: false },
  lines: [
    line({
      kind: 'PACKAGE',
      name: 'Makeup chụp ảnh cưới',
      subjectName: 'Cô dâu',
      quantity: 1,
      unitPrice: 2_500_000,
      lineTotal: 2_500_000,
      date: '2026-11-18',
      startTime: '08:00',
      endTime: '10:00',
      location: HANOI_STUDIO,
      staff: { primary: ['Chiến'], assist: [] },
    }),
  ],
  subtotal: 2_500_000,
  discount: 0,
  total: 2_500_000,
  deposit: 1_000_000,
  installments: [
    { name: 'Đặt cọc giữ lịch', dueDate: '2026-10-19', amount: 1_000_000, isDeposit: true, paid: 0, state: 'UNPAID' },
    { name: 'Thanh toán phần còn lại', dueDate: '2026-11-18', amount: 1_500_000, isDeposit: false, paid: 0, state: 'UNPAID' },
  ],
  receipts: [],
  paid: 0,
  terms: { title: 'Điều khoản', items: SERVICE_TERMS.slice(0, 4), name: 'Điều khoản dịch vụ trang điểm', version: 4 },
});

// ===== Hợp đồng dịch vụ NHIỀU NGÀY: ăn hỏi (11/12) + cưới (12/12) + lại mặt (13/12), phụ phí × 2 =====
const SERVICE_MULTI_DAY = build({
  kind: 'SERVICE',
  code: 'HĐDV-000131',
  status: 'CONFIRMED',
  issuedOn: '2026-10-21',
  eventDate: '2026-12-12',
  notes: null,
  customer: { fullName: 'Lê Phương Thảo', phone: '0968 222 314', email: null, contactHidden: false },
  lines: [
    line({
      kind: 'PACKAGE',
      name: 'Makeup lễ ăn hỏi',
      subjectName: 'Cô dâu',
      quantity: 1,
      unitPrice: 3_000_000,
      lineTotal: 3_000_000,
      date: '2026-12-11',
      startTime: '06:30',
      endTime: '08:30',
      location: HOME,
      staff: { primary: ['Chiến'], assist: [] },
      surcharges: [sub({ name: 'Phụ phí ca sớm (bắt đầu trước 7:00)', quantity: 1, unitPrice: 200_000, lineTotal: 200_000 })],
    }),
    line({
      kind: 'PACKAGE',
      name: 'Makeup lễ cưới',
      subjectName: 'Cô dâu',
      quantity: 1,
      unitPrice: 4_500_000,
      lineTotal: 4_500_000,
      date: '2026-12-12',
      startTime: '04:30',
      endTime: '07:30',
      location: HOME,
      staff: { primary: ['Chiến'], assist: ['Lan'] },
      surcharges: [sub({ name: 'Phụ phí ca sớm (bắt đầu trước 5:30)', quantity: 1, unitPrice: 300_000, lineTotal: 300_000 })],
    }),
    line({
      kind: 'SERVICE',
      name: 'Makeup lại mặt',
      subjectName: 'Cô dâu',
      quantity: 1,
      unitPrice: 1_800_000,
      lineTotal: 1_800_000,
      date: '2026-12-13',
      startTime: '08:00',
      endTime: '09:30',
      location: HOME,
      staff: { primary: ['Hà'], assist: [] },
      addedAfterConfirm: true,
      addedOn: '2026-10-28',
    }),
  ],
  subtotal: 9_800_000,
  discount: 0,
  total: 9_800_000,
  deposit: 3_000_000,
  installments: [
    { name: 'Đặt cọc giữ lịch', dueDate: '2026-10-21', amount: 3_000_000, isDeposit: true, paid: 3_000_000, state: 'PAID' },
    { name: 'Thanh toán phần còn lại', dueDate: '2026-12-11', amount: 6_800_000, isDeposit: false, paid: 0, state: 'UNPAID' },
  ],
  receipts: [{ code: 'PT-000360', kind: 'RECEIPT', method: 'CASH', amount: 3_000_000, receivedOn: '2026-10-21' }],
  paid: 3_000_000,
  terms: { title: 'Điều khoản', items: SERVICE_TERMS, name: 'Điều khoản dịch vụ trang điểm', version: 4 },
});

// ===== Bảng 40 dòng: thử đầu bảng lặp, dòng tổng KHÔNG lặp (L4, mẫu 3) =====
const TABLE_LINES: PrintLine[] = Array.from({ length: 40 }, (_, i) =>
  line({
    kind: 'SERVICE',
    name: 'Makeup dự tiệc',
    subjectName: `Khách mời ${String(i + 1).padStart(2, '0')}`,
    quantity: 1,
    unitPrice: 800_000,
    lineTotal: 800_000,
    date: '2026-12-20',
    startTime: '15:00',
    endTime: '16:00',
    location: HANOI_STUDIO,
    note: `Mã ghế ${String(i + 1).padStart(2, '0')}`,
    staff: { primary: ['Chiến', 'Hà'], assist: [] },
  }),
);
const SERVICE_LONG_TABLE = build({
  kind: 'SERVICE',
  code: 'HĐDV-000132',
  status: 'CONFIRMED',
  issuedOn: '2026-10-22',
  eventDate: '2026-12-20',
  notes: null,
  customer: { fullName: 'Công ty TNHH Sao Mai', phone: '0243 765 4321', email: 'hanhchinh@saomai.vn', contactHidden: false },
  lines: TABLE_LINES,
  subtotal: 32_000_000,
  discount: 2_000_000,
  total: 30_000_000,
  deposit: 10_000_000,
  installments: [
    { name: 'Đặt cọc giữ lịch', dueDate: '2026-10-22', amount: 10_000_000, isDeposit: true, paid: 10_000_000, state: 'PAID' },
    { name: 'Thanh toán phần còn lại', dueDate: '2026-12-20', amount: 20_000_000, isDeposit: false, paid: 0, state: 'UNPAID' },
  ],
  receipts: [{ code: 'PT-000361', kind: 'RECEIPT', method: 'BANK_TRANSFER', amount: 10_000_000, receivedOn: '2026-10-22' }],
  paid: 10_000_000,
  terms: { title: 'Điều khoản', items: SERVICE_TERMS, name: 'Điều khoản dịch vụ trang điểm', version: 4 },
});

const K12 = {
  courseName: 'Khoá makeup cá nhân chuyên nghiệp',
  className: 'K12',
  startDate: '2026-11-03',
  endDate: '2026-12-26',
  weekdays: [2, 4, 6],
  startTime: '18:00',
  endTime: '21:00',
  sessionCount: 24,
  instructorName: 'Nguyễn Trọng Chiến',
  location: { name: 'Cơ sở Thái Hà', address: '25 Thái Hà, Đống Đa, Hà Nội' },
};

// ===== Hợp đồng khoá học — bản dài (45 điều khoản + 8 nội quy) =====
const COURSE_LONG = build({
  kind: 'COURSE',
  code: 'HĐKH-000046',
  status: 'CONFIRMED',
  issuedOn: '2026-10-25',
  eventDate: null,
  notes: null,
  customer: { fullName: 'Vũ Thị Hồng Nhung', phone: '0912 345 678', email: 'hongnhung.vu@gmail.com', contactHidden: false },
  lines: [
    line({ kind: 'COURSE', name: 'Khoá makeup cá nhân chuyên nghiệp', quantity: 1, unitPrice: 15_000_000, lineTotal: 15_000_000, course: K12 }),
    line({ kind: 'CUSTOM', name: 'Bộ cọ & dụng cụ học viên (12 món)', quantity: 1, unitPrice: 1_200_000, lineTotal: 1_200_000 }),
  ],
  subtotal: 16_200_000,
  discount: 1_000_000,
  total: 15_200_000,
  deposit: 5_000_000,
  installments: [
    { name: 'Đặt cọc giữ chỗ', dueDate: '2026-10-25', amount: 5_000_000, isDeposit: true, paid: 5_000_000, state: 'PAID' },
    { name: 'Đợt 2', dueDate: '2026-11-15', amount: 5_100_000, isDeposit: false, paid: 0, state: 'UNPAID' },
    { name: 'Đợt 3', dueDate: '2026-12-06', amount: 5_100_000, isDeposit: false, paid: 0, state: 'UNPAID' },
  ],
  receipts: [{ code: 'PT-000355', kind: 'RECEIPT', method: 'CASH', amount: 5_000_000, receivedOn: '2026-10-25' }],
  paid: 5_000_000,
  terms: { title: 'Điều khoản', items: COURSE_TERMS, name: 'Điều khoản khoá học', version: 3 },
  rules: { title: 'Nội quy', items: COURSE_RULES, name: 'Nội quy lớp học', version: 2 },
});

// ===== Hợp đồng khoá học — bản ngắn, NHÁP =====
const COURSE_SHORT = build({
  kind: 'COURSE',
  code: 'HĐKH-000047',
  status: 'DRAFT',
  issuedOn: '2026-10-19',
  eventDate: null,
  notes: null,
  customer: { fullName: 'Trần Mai Anh', phone: '0936 777 120', email: null, contactHidden: false },
  lines: [
    line({
      kind: 'COURSE',
      name: 'Khoá makeup cá nhân cơ bản',
      quantity: 1,
      unitPrice: 6_000_000,
      lineTotal: 6_000_000,
      course: {
        courseName: 'Khoá makeup cá nhân cơ bản',
        className: 'CB05',
        startDate: '2026-11-09',
        endDate: '2026-11-27',
        weekdays: [1, 3, 5],
        startTime: '09:00',
        endTime: '11:30',
        sessionCount: 9,
        instructorName: 'Nguyễn Thu Hà',
        location: { name: 'Cơ sở Thái Hà', address: '25 Thái Hà, Đống Đa, Hà Nội' },
      },
    }),
  ],
  subtotal: 6_000_000,
  discount: 0,
  total: 6_000_000,
  deposit: 2_000_000,
  installments: [
    { name: 'Đặt cọc giữ chỗ', dueDate: '2026-10-22', amount: 2_000_000, isDeposit: true, paid: 0, state: 'UNPAID' },
    { name: 'Đợt 2', dueDate: '2026-11-09', amount: 4_000_000, isDeposit: false, paid: 0, state: 'UNPAID' },
  ],
  receipts: [],
  paid: 0,
  terms: { title: 'Điều khoản', items: COURSE_TERMS.slice(0, 4), name: 'Điều khoản khoá học', version: 3 },
  rules: { title: 'Nội quy', items: COURSE_RULES.slice(0, 3), name: 'Nội quy lớp học', version: 2 },
});

export const SAMPLE = {
  SERVICE: { long: SERVICE_LONG, short: SERVICE_SHORT, multiDay: SERVICE_MULTI_DAY, longTable: SERVICE_LONG_TABLE },
  COURSE: { long: COURSE_LONG, short: COURSE_SHORT },
} as const;

export type SampleKey = 'long' | 'short' | 'multiDay' | 'longTable';

/** Tra mẫu; khoá lạ → ném lỗi (không trả mặc định im lặng). */
export function sampleFor(kind: 'SERVICE' | 'COURSE', ban: string): ContractPrintData {
  const set = SAMPLE[kind] as Record<string, ContractPrintData>;
  const d = Object.prototype.hasOwnProperty.call(set, ban) ? set[ban] : undefined;
  if (!d) throw new RangeError(`Không có dữ liệu mẫu ${kind}/${ban}`);
  return d;
}

/** Cấu hình đã gộp cho bản mẫu: mặc định của bố cục + bật/tắt tuỳ ý (đúng đường resolvePrintConfig của máy chủ). */
export function sampleConfig(layout: PrintLayout, kind: 'SERVICE' | 'COURSE', overrides?: PrintBlockOverrides): ResolvedPrintConfig {
  return resolvePrintConfig(
    { id: 'mau-thu', name: 'Mẫu thử', version: 1, layout, blocks: {}, title: null, openingText: null, closingText: null },
    kind,
    overrides,
  );
}

export { SAMPLE_LOGO as sampleLogoUrl };
