import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { napKieu, soKieu } from './khop-kieu';

// Bộ so kiểu của bài "khớp hai đầu" phải bắt được lệch KIỂU, không chỉ lệch tên trường. Chạy không cần máy chủ:
// khuôn đọc từ types.ts thật, dữ liệu là một bản ghi đúng dạng máy chủ trả rồi làm hỏng từng chỗ.

const HERE = dirname(fileURLToPath(import.meta.url));
const S = napKieu(join(HERE, 'types.ts'), join(HERE, '..', '..', 'tsconfig.json'), {
  summary: 'ContractSummary',
  page: 'Page<ContractSummary>',
  quoteLine: 'GroupedContractLine<null>',
  profile: 'BrandProfileResult',
});

const goodSummary = {
  id: '3f1c0a52-0000-4000-8000-000000000001',
  code: 'HD-000001',
  kind: 'SERVICE',
  status: 'DRAFT',
  eventDate: null,
  subtotal: 1_500_000,
  discount: 0,
  total: 1_500_000,
  depositRequired: 500_000,
  confirmedAt: null,
  createdAt: '2026-10-18T10:00:00.000Z',
  customer: { id: 'c1', fullName: 'Lan', phone: null },
};

describe('khop-kieu: so kiểu theo khai báo trong types.ts', () => {
  it('bản ghi đúng dạng → không lỗi', () => {
    expect(soKieu(goodSummary, S.summary, 'summary')).toEqual([]);
    expect(soKieu({ items: [goodSummary], page: 1, pageSize: 20, total: 1 }, S.page, 'page')).toEqual([]);
    expect(soKieu({ hasProfile: false, profile: null }, S.profile, 'profile')).toEqual([]);
  });

  it('sai kiểu giá trị (string ↔ number, null, mảng, đối tượng) → lỗi nêu đúng đường dẫn', () => {
    expect(soKieu({ ...goodSummary, code: 1 }, S.summary, 's')).toEqual(['s.code: cần string, nhận number 1']);
    expect(soKieu({ ...goodSummary, total: '1500000' }, S.summary, 's')[0]).toMatch(/^s\.total: cần number/);
    expect(soKieu({ ...goodSummary, customer: null }, S.summary, 's')[0]).toMatch(/^s\.customer: cần object/);
    expect(soKieu({ ...goodSummary, customer: { id: 'c1', fullName: 'Lan', phone: 912 } }, S.summary, 's')[0]).toMatch(
      /^s\.customer\.phone: không khớp/,
    );
    expect(soKieu({ items: goodSummary, page: 1, pageSize: 20, total: 1 }, S.page, 'p')).toEqual(['p.items: cần array, nhận object']);
    expect(soKieu({ items: [{ ...goodSummary, discount: true }], page: 1, pageSize: 20, total: 1 }, S.page, 'p')[0]).toMatch(
      /^p\.items\[0\]\.discount: cần number/,
    );
  });

  it('thiếu hoặc thừa trường → lỗi', () => {
    const { code: _code, ...missing } = goodSummary;
    expect(soKieu(missing, S.summary, 's')).toEqual(['s: thiếu trường "code" (types.ts khai string)']);
    expect(soKieu({ ...goodSummary, travelTotal: 0 }, S.summary, 's')).toEqual(['s: thừa trường "travelTotal" (máy chủ trả number, types.ts không khai)']);
  });

  it('giá trị liệt kê, chuỗi ISO, số nguyên đồng', () => {
    expect(soKieu({ ...goodSummary, status: 'OPEN' }, S.summary, 's')[0]).toMatch(/^s\.status: giá trị "OPEN" không thuộc/);
    expect(soKieu({ ...goodSummary, createdAt: 'hôm qua' }, S.summary, 's')).toEqual(['s.createdAt: cần chuỗi ngày giờ ISO 8601, nhận "hôm qua"']);
    expect(soKieu({ ...goodSummary, total: 1.5 }, S.summary, 's')).toEqual(['s.total: cần số nguyên đồng, nhận 1.5']);
    expect(soKieu({ ...goodSummary, eventDate: 'x' }, S.summary, 's')[0]).toMatch(/^s\.eventDate: không khớp/);
  });

  it('kiểu tổng hợp: union theo nhánh, generic (id null ở bảng tính)', () => {
    expect(soKieu({ hasProfile: true, profile: null }, S.profile, 'r')[0]).toMatch(/^r: không khớp kiểu nào/);
    const line = S.quoteLine;
    if (line.k !== 'object') throw new Error('GroupedContractLine phải là object');
    expect(line.props.id?.kieu).toEqual({ k: 'null' });
    expect(Object.keys(line.props)).toEqual(expect.arrayContaining(['staff', 'staffWarnings', 'travelBreakdown', 'addons', 'travel']));
  });

  it('biểu thức sai tên kiểu → báo lỗi, không lặng lẽ coi là any', () => {
    expect(() => napKieu(join(HERE, 'types.ts'), join(HERE, '..', '..', 'tsconfig.json'), { x: 'KhongCoKieuNay' })).toThrow(/KhongCoKieuNay/);
  });
});

// ---- Khuôn của các kiểu MỚI ở bản vẽ D (W0): mỗi bản ghi mẫu dựng đúng hình dạng JSON ghi ở bản vẽ D mục 2.2–2.6.
// Bài này khoá types.ts theo bản vẽ (không cần máy chủ). Bài so với máy chủ THẬT là khop-hop-dong.test.ts (cần
// KHOP_HOP_DONG_DATABASE_URL) và đang CHỜ máy chủ M3 (loại sự kiện, luật phụ phí), M4 (dòng hợp đồng, quote), M5 (lịch),
// M6 (hôm nay) làm xong; khi đó thêm các lời gọi mới vào đó (xem phiếu vướng của W0).
const D = napKieu(join(HERE, 'types.ts'), join(HERE, '..', '..', 'tsconfig.json'), {
  occasions: 'Items<OccasionView>',
  rules: 'Items<SurchargeRuleView>',
  today: 'TodayView',
  quote: 'ContractQuote',
  line: 'GroupedContractLine',
  appointment: 'Appointment',
  todayAppt: 'TodayAppointment',
});

const T0 = '2026-10-19T03:00:00.000Z';
const goodOccasion = { id: 'o1', name: 'Lễ cưới', color: 'rose', sortOrder: 2, isActive: true, lineCount: 3, createdAt: T0, updatedAt: T0 };
const goodRule = {
  id: 'r1',
  name: 'Trước 6 giờ sáng',
  serviceId: 'sv9',
  service: { id: 'sv9', name: 'Phụ phí ca sớm', kind: 'SURCHARGE', isActive: true, currentPrice: 200_000 },
  startTime: '00:00',
  endTime: '06:00',
  weekdays: [6, 7],
  dates: ['2026-12-25'],
  occasionIds: [],
  packageIds: [],
  subjectIds: ['s1'],
  perQuantity: true,
  note: null,
  sortOrder: 0,
  isActive: true,
  status: 'OK',
  usedLineCount: 4,
  createdAt: T0,
  updatedAt: T0,
};
const goodTodayAppt = {
  id: 'a1',
  code: 'LH-000001',
  kind: 'MAKEUP',
  status: 'CONFIRMED',
  title: null,
  startsAt: T0,
  endsAt: T0,
  travelBeforeMin: 0,
  customer: { id: 'c1', fullName: 'Lan' },
  subjectName: 'Cô dâu',
  quantity: 1,
  occasion: { id: 'o1', name: 'Lễ cưới', color: 'rose' },
  locationType: 'STUDIO',
  address: null,
  contract: { id: 'h1', code: 'HD-000001' },
  courseClass: null,
  staff: [{ membershipId: 'm1', displayName: 'Thu Hà', role: 'PRIMARY' }],
};
const goodInstallment = {
  installmentId: 'i1',
  name: 'Đợt 2',
  dueDate: T0,
  amount: 5_000_000,
  outstanding: 3_000_000,
  status: 'OVERDUE',
  overdueDays: 4,
  isDeposit: false,
  contract: { id: 'h1', code: 'HD-000001', eventDate: null },
  customer: { id: 'c1', fullName: 'Lan', phone: null, phoneHidden: true },
  owner: { membershipId: 'm1', displayName: 'Thu Hà' },
};
const goodToday = {
  generatedAt: T0,
  timezone: 'Asia/Ho_Chi_Minh',
  today: '2026-10-19',
  tomorrow: '2026-10-20',
  scheduleScope: 'ALL',
  counts: { appointmentsToday: 1, appointmentsTomorrow: 0, unassignedSoon: 2, overdue: { count: 1, amount: 3_000_000 }, dueSoon: null },
  appointments: { today: [goodTodayAppt], tomorrow: [], later: [], truncated: false },
  unassigned: [],
  installments: { overdue: [goodInstallment], dueSoon: [], truncated: false },
  newContracts: [{ id: 'h1', code: 'HD-000001', kind: 'SERVICE', customerName: 'Lan', total: 9_000_000, eventDate: null, confirmedAt: T0, confirmedBy: { userId: 'u1', fullName: 'Hoa' } }],
  newEnrollments: null,
  almostFullClasses: [{ id: 'l1', name: 'Lớp 1', course: { id: 'k1', name: 'Makeup cơ bản' }, startDate: '2026-11-01', enrolledCount: 9, capacity: 10, seatsLeft: 1 }],
};
const goodLine = {
  id: 'ln1', kind: 'SURCHARGE', name: 'Phụ phí ca sớm', serviceId: 'sv9', packageId: null, priceVersionId: 'pv1', subjectId: null, subjectName: null,
  locationType: null, studioLocationId: null, address: null, latitude: null, longitude: null, scheduledStart: null, scheduledEnd: null,
  quantity: 2, unitPrice: 200_000, lineDiscount: 0, lineTotal: 400_000, travelMode: null, distanceKm: null, perKmAmount: null, note: null,
  courseClassId: null, occasionId: null, occasionName: null, surchargeRuleId: 'r1', surchargeRuleName: 'Trước 6 giờ sáng', dismissedRuleIds: [],
  addedAfterConfirm: false, createdAt: T0, voidedAt: null, voidReason: null, staff: [], staffWarnings: [], travelBreakdown: null,
  addons: [], travel: null, surcharges: [],
};

const goodAppointment = {
  id: 'a1', code: 'LH-000001', kind: 'MAKEUP', title: null, status: 'CONFIRMED',
  customer: { id: 'c1', fullName: 'Lan', phone: null }, contract: { id: 'h1', code: 'HD-000001', status: 'CONFIRMED' }, contractLineId: 'ln1',
  subjectName: 'Cô dâu', quantity: 1, occasion: { id: 'o1', name: 'Lễ cưới', color: 'rose' }, courseClass: null, sessionDate: null,
  startsAt: T0, endsAt: T0, travelBeforeMin: 0, travelAfterMin: 0, locationType: null, address: null, latitude: null, longitude: null,
  notes: null, cancelReason: null, staff: [], createdAt: T0, updatedAt: T0,
};
const goodQuote = {
  kind: 'SERVICE',
  lines: [],
  travelTotal: 0,
  subtotal: 400_000,
  discount: 0,
  total: 400_000,
  depositRequired: 0,
  suggestedDeposit: 0,
  classes: [],
  autoSurcharge: {
    applied: [{ line: 0, ruleId: 'r1', ruleName: 'Trước 6 giờ sáng', serviceName: 'Phụ phí ca sớm', quantity: 2, lineTotal: 400_000, overridden: false }],
    removed: [{ line: 1, ruleId: 'r2', ruleName: 'Lễ cưới', reason: 'NO_LONGER_MATCHES' }],
    skipped: [{ line: 0, ruleId: 'r3', ruleName: 'Cuối tuần', reason: 'SAME_SERVICE', by: 'Trước 6 giờ sáng' }, { line: 2, ruleId: 'r4', ruleName: 'Lễ', reason: 'NO_PRICE' }],
  },
};

describe('khop-kieu: kiểu mới của bản vẽ D khớp hình dạng JSON ghi ở bản vẽ', () => {
  it('bản ghi đúng dạng → không lỗi (OccasionView, SurchargeRuleView, TodayView, TodayAppointment, Appointment.occasion, dòng hợp đồng, quote)', () => {
    expect(soKieu({ items: [goodOccasion] }, D.occasions, 'occasions')).toEqual([]);
    expect(soKieu({ items: [goodRule] }, D.rules, 'rules')).toEqual([]);
    expect(soKieu(goodToday, D.today, 'today')).toEqual([]);
    expect(soKieu(goodTodayAppt, D.todayAppt, 'appt')).toEqual([]);
    expect(soKieu(goodAppointment, D.appointment, 'appointment')).toEqual([]);
    expect(soKieu(goodLine, D.line, 'line')).toEqual([]);
    expect(soKieu(goodQuote, D.quote, 'quote')).toEqual([]);
    // Thẻ thiếu quyền là null; ca không sự kiện là null.
    expect(soKieu({ ...goodToday, installments: null, unassigned: null, newContracts: null, almostFullClasses: null, counts: { ...goodToday.counts, overdue: null, unassignedSoon: null } }, D.today, 'today')).toEqual([]);
    expect(soKieu({ ...goodAppointment, occasion: null }, D.appointment, 'appointment')).toEqual([]);
  });

  it('lệch hình dạng bản vẽ bị bắt: màu ngoài 12 màu, trạng thái luật lạ, tiền lẻ, thiếu / thừa trường', () => {
    expect(soKieu({ items: [{ ...goodOccasion, color: 'pink' }] }, D.occasions, 'o')[0]).toMatch(/^o\.items\[0\]\.color: giá trị "pink" không thuộc/);
    expect(soKieu({ items: [{ ...goodRule, status: 'BROKEN' }] }, D.rules, 'r')[0]).toMatch(/^r\.items\[0\]\.status: giá trị "BROKEN" không thuộc/);
    expect(soKieu({ items: [{ ...goodRule, service: { ...goodRule.service, currentPrice: 1.5 } }] }, D.rules, 'r')[0]).toMatch(/currentPrice/);
    expect(soKieu({ ...goodToday, counts: { ...goodToday.counts, overdue: { count: 1, amount: 2.5 } } }, D.today, 't').join('\n')).toMatch(/^t\.counts\.overdue: không khớp kiểu nào/);
    const { occasion: _o, ...noOccasion } = goodAppointment;
    expect(soKieu(noOccasion, D.appointment, 'a')[0]).toMatch(/^a: thiếu trường "occasion"/);
    const { surcharges: _s, ...noSurcharges } = goodLine;
    expect(soKieu(noSurcharges, D.line, 'l')[0]).toMatch(/thiếu trường "surcharges"/);
    expect(soKieu({ ...goodLine, extraField: 1 }, D.line, 'l')[0]).toMatch(/thừa trường "extraField"/);
    expect(soKieu({ ...goodQuote, autoSurcharge: { ...goodQuote.autoSurcharge, removed: [{ line: 1, ruleId: 'r', ruleName: 'x', reason: 'SERVICE_UNAVAILABLE' }] } }, D.quote, 'q')[0]).toMatch(/reason: giá trị "SERVICE_UNAVAILABLE" không thuộc/);
  });
});
