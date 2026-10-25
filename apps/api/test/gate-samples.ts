// Mẫu dữ liệu cho cửa gác cách ly (dùng chung cho tenant-isolation.test.ts và gate-mutants.test.ts).
import { randomUUID } from 'node:crypto';
import type { GateOrg, RefSamples, RefVariants, Samples } from './gate';
import type { PartialSamples } from './gate-partial';

// Thân yêu cầu hợp lệ cho các đường POST/PATCH có tham số id (khoá: "METHOD /đường").
export const SAMPLES: Samples = {
  'GET /orgs/:orgId/appointments': () => ({ from: '2026-11-25T00:00:00.000Z', to: '2026-12-10T00:00:00.000Z' }),
  'GET /orgs/:orgId/staff/availability': () => ({ startsAt: '2027-03-01T01:00:00.000Z', endsAt: '2027-03-01T03:00:00.000Z' }),
  'PATCH /orgs/:orgId/members/:membershipId': () => ({ status: 'SUSPENDED' }),
  'PATCH /orgs/:orgId/roles/:roleId': () => ({ name: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/service-categories/:categoryId': () => ({ name: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/makeup-subjects/:subjectId': () => ({ name: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/studio-locations/:locationId': () => ({ name: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/services/:serviceId': () => ({ name: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/packages/:packageId': () => ({ name: 'Đổi tên thử' }),
  'POST /orgs/:orgId/services/:serviceId/prices': () => ({ listPrice: 1000 }),
  'POST /orgs/:orgId/packages/:packageId/prices': () => ({ listPrice: 1000 }),
  'PATCH /orgs/:orgId/customers/:customerId': () => ({ fullName: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/appointments/:appointmentId': () => ({ notes: 'Sửa thử' }),
  'POST /orgs/:orgId/appointments/:appointmentId/status': () => ({ to: 'CANCELLED', reason: 'Thử cửa gác' }),
  // expectedUpdatedAt BẮT BUỘC: mẫu bất đồng bộ đọc updatedAt hiện hành của hợp đồng TRONG ĐƯỜNG DẪN ngay trước khi gửi
  // (phép id chéo: hợp đồng của A, đọc bằng chủ A) — để chỉ còn điều kiện tổ chức chặn lệnh, không phải lệch phiên bản.
  'PATCH /orgs/:orgId/contracts/:contractId': async (_o, req) => ({ expectedUpdatedAt: await req.currentVersion(), notes: 'Sửa thử' }),
  'POST /orgs/:orgId/contracts/:contractId/lines': () => ({
    kind: 'CUSTOM',
    name: 'Phát sinh thử',
    unitPrice: 1000,
    quantity: 1,
  }),
  'POST /orgs/:orgId/contracts/:contractId/lines/:lineId/void': () => ({ reason: 'Thử cửa gác' }),
  'POST /orgs/:orgId/contracts/:contractId/status': () => ({ to: 'CANCELLED', reason: 'Thử cửa gác' }),
  'PATCH /orgs/:orgId/staff-tiers/:tierId': () => ({ name: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/staff/:membershipId': () => ({ displayName: 'Tên thử' }),
  // Bậc lấy từ CHÍNH tổ chức đang gọi — để chỉ id gói/dịch vụ là của tổ chức khác.
  'PUT /orgs/:orgId/packages/:packageId/pay-rates': (o) => ({ rates: [{ tierId: o.ids.tierId, amount: 100000 }] }),
  'PUT /orgs/:orgId/services/:serviceId/pay-rates': (o) => ({ rates: [{ tierId: o.ids.tierId, amount: 100000 }] }),
  // Thu tiền (thợ G)
  'GET /orgs/:orgId/payments': () => ({ from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T00:00:00.000Z' }),
  'GET /orgs/:orgId/reports/revenue': () => ({ from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T00:00:00.000Z' }),
  'PUT /orgs/:orgId/contracts/:contractId/installments': () => ({
    installments: [{ name: 'Đặt cọc', dueDate: '2026-12-01T00:00:00.000Z', amount: 100000, isDeposit: true }],
  }),
  'POST /orgs/:orgId/contracts/:contractId/payments': () => ({ method: 'CASH', amount: 1000 }),
  'POST /orgs/:orgId/payments/:paymentId/void': () => ({ reason: 'Thử cửa gác' }),
  // Mẫu điều khoản / nội quy (thợ S3)
  'PATCH /orgs/:orgId/contract-texts/:textId': () => ({ name: 'Đổi tên thử' }),
  // Khoá & lớp (thợ S2)
  'PATCH /orgs/:orgId/course-groups/:groupId': () => ({ name: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/courses/:courseId': () => ({ name: 'Đổi tên thử' }),
  'POST /orgs/:orgId/courses/:courseId/archive': () => ({ reason: 'Thử cửa gác' }),
  'POST /orgs/:orgId/courses/:courseId/classes': () => ({ name: 'Lớp thử', startDate: '2027-07-01', endDate: '2027-08-01', weekdays: [1] }),
  'PATCH /orgs/:orgId/classes/:classId': () => ({ note: 'Sửa thử' }),
  'POST /orgs/:orgId/classes/:classId/cancel': () => ({ reason: 'Thử cửa gác' }),
  // Buổi học lên Lịch (thợ K2): ghi thật — đường dẫn mang mã lớp của tổ chức khác phải 404 trước khi sinh buổi nào.
  'POST /orgs/:orgId/classes/:classId/sessions/sync': () => ({ dryRun: false }),
  // Mẫu thiết kế + thẻ (thợ S4)
  'PATCH /orgs/:orgId/greeting-phrases/:phraseId': () => ({ title: 'Đổi tiêu đề thử' }),
  'PATCH /orgs/:orgId/design-cards/:cardId': () => ({ title: 'Đổi tiêu đề thử' }),
  'PUT /orgs/:orgId/design-cards/:cardId/output': (o) => ({ fileId: o.ids.designCardFileId }),
  // Loại sự kiện, luật phụ phí (bản vẽ D, gói M7)
  'PATCH /orgs/:orgId/occasions/:occasionId': () => ({ name: 'Đổi tên thử' }),
  'PATCH /orgs/:orgId/surcharge-rules/:surchargeRuleId': () => ({ note: 'Sửa thử' }),
  // Giấy chứng nhận (bản vẽ F, gói S1b). Đường dẫn mang mã lớp / mã giấy của tổ chức khác → 404 trước mọi ghi.
  'POST /orgs/:orgId/classes/:classId/certificates': (o) => ({ enrollmentIds: [o.ids.enrollment2Id], templateCode: 'cc-01', issuedOn: '2026-03-30' }),
  'POST /orgs/:orgId/certificates/:certificateId/reissue': () => ({ reason: 'Thử cửa gác' }),
  'POST /orgs/:orgId/certificates/:certificateId/revoke': () => ({ reason: 'Thử cửa gác' }),
  'PUT /orgs/:orgId/profile/certificate': () => ({ signerName: 'Tên thử', signerTitle: null }),
  // Cổng học viên phía trung tâm (bản vẽ E 6.3, gói E5). Đường dẫn mang mã khách / mã máy của tổ chức khác → 404 trước mọi ghi.
  // Phép giữ gửi thân rỗng → 400 ở cả ba (zod chạy trước handler).
  'POST /orgs/:orgId/customers/:customerId/portal/links': () => ({ phoneConfirmed: true }),
  'POST /orgs/:orgId/customers/:customerId/portal/revoke': () => ({ reason: 'Thử cửa gác' }),
  'POST /orgs/:orgId/portal-devices/:deviceId/block': () => ({ reason: 'Thử cửa gác' }),
  // Mẫu in hợp đồng (bản vẽ G, gói G-M3). Đường dẫn mang mã mẫu của tổ chức khác → 404 trước mọi ghi.
  'PATCH /orgs/:orgId/print-templates/:templateId': () => ({ name: 'Đổi tên thử' }),
};

// Mẫu HỢP LỆ dùng toàn mã của chính tổ chức — cửa gác tự thay TỪNG trường mã bằng mã của tổ chức khác.
// Đường có trường "…Id" mới mà chưa có mẫu ở đây → cửa gác đỏ ("chưa có mẫu tham chiếu chéo").
const code = () => `M${randomUUID().slice(0, 6).toUpperCase()}`;
const packageLine = (o: GateOrg) => ({
  kind: 'PACKAGE',
  packageId: o.ids.packageId,
  subjectId: o.ids.subjectId,
  quantity: 1,
  locationType: 'STUDIO',
  studioLocationId: o.ids.locationId,
  addons: [{ serviceId: o.ids.addonId, quantity: 1 }],
  scheduledStart: '2027-04-01T01:00:00.000Z',
  scheduledEnd: '2027-04-01T03:00:00.000Z',
  staff: [{ membershipId: o.ids.membershipId, role: 'PRIMARY' }],
});
const serviceLine = (o: GateOrg) => ({ kind: 'SERVICE', serviceId: o.ids.serviceId, quantity: 1 });
const customLine = { kind: 'CUSTOM', name: 'Giáo trình', unitPrice: 100_000, quantity: 1 };
// Dòng đặt chỗ có loại sự kiện + sửa phụ phí của luật 1 + bỏ luật 2 (bản vẽ D 4.2): đo lines[].occasionId,
// lines[].surchargeOverrides[].ruleId, lines[].dismissedRuleIds[] (mảng không có khoá ngoại — chốt duy nhất là checkLineRuleRefs).
const placedWithRules = (o: GateOrg) => ({
  ...packageLine(o),
  occasionId: o.ids.occasionId,
  surchargeOverrides: [{ ruleId: o.ids.surchargeRuleId, quantity: 1 }],
  dismissedRuleIds: [o.ids.surchargeRule2Id],
});
// Mọi loại sự kiện của tổ chức (loại cài sẵn đọc từ GET /occasions lúc dựng fixture + loại fixture tạo) — PUT …/order
// phải gửi đủ. Thiếu loại cài sẵn thì buildGateFixture đã ném lỗi, không tự bù.
const allOccasionIds = (o: GateOrg) => {
  const seeds = Object.keys(o.ids)
    .filter((k) => /^occasionSeed\d+$/.test(k))
    .sort((x, y) => Number(x.slice(12)) - Number(y.slice(12)))
    .map((k) => o.ids[k]!);
  if (seeds.length === 0 || !o.ids.occasionId) throw new Error('Mẫu PUT /occasions/order: fixture chưa có loại sự kiện');
  return [...seeds, o.ids.occasionId];
};
export const REF_SAMPLES: RefSamples = {
  'GET /orgs/:orgId/services': [(o) => ({ categoryId: o.ids.categoryId })],
  'POST /orgs/:orgId/services': [
    (o) => ({ code: code(), name: 'Mẫu', durationMinutes: 30, listPrice: 1000, categoryId: o.ids.categoryId }),
  ],
  'PATCH /orgs/:orgId/services/:serviceId': [(o) => ({ categoryId: o.ids.categoryId })],
  'GET /orgs/:orgId/packages': [(o) => ({ subjectId: o.ids.subjectId })],
  'POST /orgs/:orgId/packages': [
    (o) => ({
      code: code(),
      name: 'Gói mẫu',
      durationMinutes: 60,
      listPrice: 1000,
      subjectId: o.ids.subjectId,
      items: [{ serviceId: o.ids.serviceId, quantity: 1, isOptional: false }],
    }),
  ],
  'PATCH /orgs/:orgId/packages/:packageId': [
    (o) => ({ subjectId: o.ids.subjectId, items: [{ serviceId: o.ids.serviceId, quantity: 1, isOptional: false }] }),
  ],
  'GET /orgs/:orgId/appointments': [
    (o) => ({ from: '2026-11-25T00:00:00.000Z', to: '2026-12-10T00:00:00.000Z', membershipId: o.ids.membershipId, contractId: o.ids.contractId }),
  ],
  'POST /orgs/:orgId/appointments': [
    (o) => ({
      customerId: o.ids.customerId,
      contractId: o.ids.contract2Id,
      contractLineId: o.ids.line2Id,
      startsAt: '2027-03-01T01:00:00.000Z',
      endsAt: '2027-03-01T02:00:00.000Z',
      status: 'DRAFT',
      staff: [{ membershipId: o.ids.membershipId, role: 'PRIMARY' }],
    }),
  ],
  'PATCH /orgs/:orgId/appointments/:appointmentId': [
    (o) => ({ staff: [{ membershipId: o.ids.membershipId, role: 'PRIMARY' }] }),
  ],
  // Mẫu [0] giữ nguyên dạng cũ (bài thử của thợ S3 dựng thêm trường trên mẫu [0]); mẫu sau: trường mới + hợp đồng khoá học.
  'POST /orgs/:orgId/contracts/quote': [
    (o) => ({ customerId: o.ids.customerId, lines: [packageLine(o), serviceLine(o)] }),
    (o) => ({
      customerId: o.ids.customerId,
      ownerMembershipId: o.ids.membershipId,
      termsTemplateId: o.ids.textId,
      excludeContractId: o.ids.contract2Id,
      lines: [packageLine(o), serviceLine(o)],
    }),
    (o) => ({
      kind: 'COURSE',
      customerId: o.ids.customerId,
      ownerMembershipId: o.ids.membershipId,
      termsTemplateId: o.ids.textId,
      rulesTemplateId: o.ids.rulesTextId,
      excludeContractId: o.ids.courseContractId,
      lines: [{ kind: 'COURSE', courseClassId: o.ids.classId }, customLine],
    }),
    (o) => ({ customerId: o.ids.customerId, lines: [placedWithRules(o)] }),
  ],
  'POST /orgs/:orgId/contracts': [
    (o) => ({ customerId: o.ids.customerId, lines: [packageLine(o), serviceLine(o)] }),
    (o) => ({ customerId: o.ids.customerId, ownerMembershipId: o.ids.membershipId, termsTemplateId: o.ids.textId, lines: [serviceLine(o)] }),
    (o) => ({
      kind: 'COURSE',
      customerId: o.ids.customerId,
      ownerMembershipId: o.ids.membershipId,
      termsTemplateId: o.ids.textId,
      rulesTemplateId: o.ids.rulesTextId,
      lines: [{ kind: 'COURSE', courseClassId: o.ids.classId }, customLine],
    }),
    (o) => ({ customerId: o.ids.customerId, lines: [placedWithRules(o)] }),
  ],
  'GET /orgs/:orgId/contracts': [(o) => ({ customerId: o.ids.customerId })],
  // Hợp đồng DỊCH VỤ của fixture; trường chỉ hợp lệ với hợp đồng khoá học (lines[].courseClassId, rulesTemplateId) đo ở
  // REF_VARIANTS (đường dẫn trỏ hợp đồng khoá học).
  'PATCH /orgs/:orgId/contracts/:contractId': [
    async (o, req) => ({ expectedUpdatedAt: await req.currentVersion(), lines: [packageLine(o), serviceLine(o)] }),
    async (o, req) => ({ expectedUpdatedAt: await req.currentVersion(), termsTemplateId: o.ids.textId }),
    // Đổi khách của hợp đồng nháp (thợ U): mẫu gốc gửi lại đúng khách hiện tại; khách của A / mã bịa → 404 giống hệt.
    async (o, req) => ({ expectedUpdatedAt: await req.currentVersion(), customerId: o.ids.customerId }),
    async (o, req) => ({ expectedUpdatedAt: await req.currentVersion(), lines: [placedWithRules(o)] }),
  ],
  'POST /orgs/:orgId/contracts/:contractId/lines': [packageLine, serviceLine, placedWithRules],
  'GET /orgs/:orgId/staff': [(o) => ({ tierId: o.ids.tierId })],
  'GET /orgs/:orgId/staff/availability': [
    (o) => ({
      startsAt: '2027-03-01T01:00:00.000Z',
      endsAt: '2027-03-01T03:00:00.000Z',
      membershipIds: o.ids.membershipId,
      excludeAppointmentIds: o.ids.appointmentId,
      excludeContractId: o.ids.contractId,
    }),
  ],
  'PATCH /orgs/:orgId/staff/:membershipId': [(o) => ({ tierId: o.ids.tierId }), (o) => ({ avatarFileId: o.ids.avatarFileId })],
  'GET /orgs/:orgId/payments': [
    (o) => ({ from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T00:00:00.000Z', contractId: o.ids.contractId }),
  ],
  'PUT /orgs/:orgId/profile': [
    (o) => ({ brandName: 'Mẫu', logoFileId: o.ids.logoFileId, avatarFileId: o.ids.avatarFileId, coverFileId: o.ids.coverFileId }),
  ],
  'PUT /orgs/:orgId/packages/:packageId/pay-rates': [(o) => ({ rates: [{ tierId: o.ids.tierId, amount: 100000 }] })],
  'PUT /orgs/:orgId/services/:serviceId/pay-rates': [(o) => ({ rates: [{ tierId: o.ids.tierId, amount: 100000 }] })],
  // Ảnh khách (thợ Q)
  'PATCH /orgs/:orgId/customers/:customerId': [(o) => ({ avatarFileId: o.ids.customerAvatarFileId })],
  // Khoá & lớp (thợ S2)
  'GET /orgs/:orgId/courses': [(o) => ({ groupId: o.ids.groupId })],
  'POST /orgs/:orgId/courses': [
    (o) => ({
      name: `Khoá ${code()}`,
      groupId: o.ids.groupId,
      mode: 'MULTI_CLASS',
      tuitionFee: 1_000_000,
      defaultCapacity: 10,
      firstClass: {
        name: 'Lớp mẫu',
        startDate: '2027-09-01',
        endDate: '2027-10-01',
        weekdays: [1, 3],
        instructorMembershipId: o.ids.membershipId,
        studioLocationId: o.ids.locationId,
      },
    }),
  ],
  'PATCH /orgs/:orgId/courses/:courseId': [(o) => ({ groupId: o.ids.groupId })],
  'POST /orgs/:orgId/courses/:courseId/classes': [
    (o) => ({
      name: `Lớp ${code()}`,
      startDate: '2027-09-01',
      endDate: '2027-10-01',
      weekdays: [2],
      instructorMembershipId: o.ids.membershipId,
      studioLocationId: o.ids.locationId,
    }),
  ],
  'GET /orgs/:orgId/classes': [(o) => ({ courseId: o.ids.courseId, instructorId: o.ids.membershipId })],
  'PATCH /orgs/:orgId/classes/:classId': [(o) => ({ instructorMembershipId: o.ids.membershipId, studioLocationId: o.ids.locationId })],
  // Mẫu thiết kế + thẻ (thợ S4)
  'GET /orgs/:orgId/design-cards': [(o) => ({ contractId: o.ids.contractId, customerId: o.ids.customerId })],
  'POST /orgs/:orgId/design-cards': [
    (o) => ({ kind: 'WELCOME', templateCode: 'shd-01', contractId: o.ids.courseContractId, courseClassId: o.ids.classId, size: '1080x1350' }),
    (o) => ({
      kind: 'FEEDBACK',
      templateCode: 'fb-01',
      contractId: o.ids.contractId,
      body: 'Lời khen mẫu',
      photoFileIds: [o.ids.designPhotoId],
      size: '1080x1350',
    }),
  ],
  'PATCH /orgs/:orgId/design-cards/:cardId': [(o) => ({ courseClassId: o.ids.classId }), (o) => ({ photoFileIds: [o.ids.designPhotoId] })],
  'PUT /orgs/:orgId/design-cards/:cardId/output': [(o) => ({ fileId: o.ids.designCardFileId })],
  // Loại sự kiện, luật phụ phí (bản vẽ D, gói M7). Luật tạo ở trạng thái TẮT: cửa gác chạy nhiều lần không chạm trần 50 luật bật.
  'POST /orgs/:orgId/surcharge-rules': [
    (o) => ({
      name: `Luật ${code()}`,
      serviceId: o.ids.surchargeServiceId,
      startTime: '04:00',
      endTime: '06:00',
      occasionIds: [o.ids.occasionId],
      packageIds: [o.ids.packageId],
      subjectIds: [o.ids.subjectId],
      isActive: false,
    }),
  ],
  'PATCH /orgs/:orgId/surcharge-rules/:surchargeRuleId': [
    (o) => ({
      serviceId: o.ids.surchargeServiceId,
      occasionIds: [o.ids.occasionId],
      packageIds: [o.ids.packageId],
      subjectIds: [o.ids.subjectId],
    }),
  ],
  'PUT /orgs/:orgId/occasions/order': [(o) => ({ occasionIds: allOccasionIds(o) })],
  // Giấy chứng nhận (bản vẽ F, gói S1b): lọc sổ theo lớp / học viên — MỖI trường một mẫu riêng. Gộp classId + customerId
  // trong một mẫu (như bản vẽ 9.2) thì thay customerId bằng mã của A vẫn kèm classId của B → rỗng, cửa gác MÙ với đột
  // biến 17 (đã đo: 0/3 vi phạm). Mẫu ids không có trường "…Id" — chỉ chạy mẫu gốc.
  'GET /orgs/:orgId/certificates': [
    (o) => ({ customerId: o.ids.customerId }),
    (o) => ({ classId: o.ids.endedClassId }),
    (o) => ({ classId: o.ids.endedClassId, customerId: o.ids.customerId }),
    (o) => ({ ids: o.ids.certificateId }),
  ],
};

// Mẫu tham chiếu chéo trên HỢP ĐỒNG KHOÁ HỌC nháp của fixture (:contractId = courseContractId).
const onCourseContract = (o: GateOrg) => ({ contractId: o.ids.courseContractId ?? '' });
export const REF_VARIANTS: RefVariants = {
  'PATCH /orgs/:orgId/contracts/:contractId': [
    {
      pathIds: onCourseContract,
      samples: [
        async (o, req) => ({
          expectedUpdatedAt: await req.currentVersion(),
          termsTemplateId: o.ids.textId,
          rulesTemplateId: o.ids.rulesTextId,
          lines: [{ kind: 'COURSE', courseClassId: o.ids.classId }, customLine],
        }),
      ],
    },
  ],
  'POST /orgs/:orgId/contracts/:contractId/lines': [{ pathIds: onCourseContract, samples: [(o) => ({ kind: 'COURSE', courseClassId: o.ids.class2Id })] }],
  'GET /orgs/:orgId/contracts/:contractId/design-data': [{ pathIds: onCourseContract, samples: [(o) => ({ courseClassId: o.ids.classId })] }],
  // Cấp giấy chứng nhận chỉ chạy trên lớp ĐÃ KẾT THÚC (lớp mẫu classId năm 2027 → 409 CLASS_NOT_ENDED).
  'POST /orgs/:orgId/classes/:classId/certificates': [
    {
      pathIds: (o) => ({ classId: o.ids.endedClassId ?? '' }),
      samples: [(o) => ({ enrollmentIds: [o.ids.enrollment2Id], templateCode: 'cc-01', issuedOn: '2026-03-30' })],
    },
  ],
};

// MẪU "SỬA MỘT PHẦN" cho cửa gác test/gate-partial.ts: mọi đường PATCH phải có mẫu ở đây.
// full: MỌI trường của thân, giá trị KHÁC mặc định lúc tạo — để bệnh "trường vắng mặt bị đặt về mặc định" lộ ra.
// one: đúng MỘT trường, giá trị khác full.
export const PARTIAL_SAMPLES: PartialSamples = {
  'PATCH /orgs/:orgId': {
    full: () => ({ name: 'Tổ chức đủ trường', timezone: 'Asia/Bangkok' }),
    one: () => ({ name: 'Tổ chức đổi tên' }),
  },
  'PATCH /orgs/:orgId/members/:membershipId': {
    full: () => ({ roleKeys: ['rong', 'artist'], status: 'ACTIVE' }),
    one: () => ({ status: 'SUSPENDED' }),
  },
  'PATCH /orgs/:orgId/roles/:roleId': {
    full: () => ({ name: 'Vai trò đủ', permissions: ['org.read', 'catalog.read'] }),
    one: () => ({ name: 'Vai trò đổi tên' }),
  },
  'PATCH /orgs/:orgId/service-categories/:categoryId': {
    full: () => ({ name: 'Nhóm đủ', sortOrder: 7, isActive: false }),
    one: () => ({ name: 'Nhóm đổi tên' }),
  },
  'PATCH /orgs/:orgId/makeup-subjects/:subjectId': {
    full: () => ({ name: 'Nhân vật đủ', sortOrder: 7, isActive: false }),
    one: () => ({ name: 'Nhân vật đổi tên' }),
  },
  'PATCH /orgs/:orgId/studio-locations/:locationId': {
    full: () => ({ name: 'Studio đủ', address: 'Số 9 Phố Huế, Hà Nội', latitude: 21.0123, longitude: 105.8456, isDefault: true, isActive: true }),
    one: () => ({ name: 'Studio đổi tên' }),
  },
  'PATCH /orgs/:orgId/services/:serviceId': {
    full: (c) => ({
      kind: 'MAIN',
      code: `DVD${randomUUID().slice(0, 4).toUpperCase()}`,
      name: 'Dịch vụ đủ',
      description: 'Mô tả đủ',
      durationMinutes: 45,
      categoryId: c.o.ids.categoryId,
      isActive: true,
      isPublic: false,
      sortOrder: 9,
    }),
    one: () => ({ name: 'Dịch vụ đổi tên' }),
  },
  'PATCH /orgs/:orgId/packages/:packageId': {
    full: (c) => ({
      code: `GOID${randomUUID().slice(0, 4).toUpperCase()}`,
      name: 'Gói đủ',
      description: 'Mô tả gói',
      durationMinutes: 150,
      staffCount: 2,
      depositAmount: 300000,
      subjectId: c.o.ids.subjectId,
      locationTypes: ['STUDIO', 'CUSTOMER_HOME'],
      includedKm: 5,
      terms: 'Điều khoản gói',
      isActive: true,
      isPublic: false,
      sortOrder: 9,
      items: [{ serviceId: c.o.ids.addonId, quantity: 2, isOptional: true }],
    }),
    one: () => ({ name: 'Gói đổi tên' }),
  },
  'PATCH /orgs/:orgId/customers/:customerId': {
    full: (c) => ({
      fullName: 'Khách đủ',
      phone: '0912345678',
      email: 'khach-du@thu.local',
      note: 'Ghi chú khách',
      avatarFileId: c.o.ids.customerAvatarFileId,
    }),
    one: () => ({ fullName: 'Khách đổi tên' }),
  },
  'PATCH /orgs/:orgId/appointments/:appointmentId': {
    full: (c) => ({
      startsAt: '2026-12-01T02:00:00.000Z',
      endsAt: '2026-12-01T04:00:00.000Z',
      travelBeforeMin: 15,
      travelAfterMin: 20,
      locationType: 'OTHER',
      address: 'Số 1 Tràng Tiền',
      latitude: 21.02,
      longitude: 105.85,
      notes: 'Ghi chú đủ',
      title: 'Tiêu đề đủ',
      staff: [{ membershipId: c.o.ids.membershipId, role: 'ASSIST' }],
    }),
    one: () => ({ notes: 'Ghi chú đổi' }),
  },
  // Chạy trên hợp đồng KHOÁ HỌC nháp (nhận cả termsTemplateId lẫn rulesTemplateId — nội quy chỉ cho hợp đồng khoá học).
  'PATCH /orgs/:orgId/contracts/:contractId': {
    full: async (c, req) => ({
      expectedUpdatedAt: await req.currentVersion(),
      // Khách hiện tại của hợp đồng (fixture chỉ có một khách mỗi tổ chức; hợp đồng khoá học mẫu có thẻ thiết kế nên đổi
      // sang khách khác bị 409 CUSTOMER_IN_USE) — vẫn đo được "gửi customerId không làm đổi trường khác".
      customerId: c.o.ids.customerId,
      discount: 1000,
      depositRequired: 20000,
      eventDate: '2027-01-15T02:00:00.000Z',
      notes: 'Ghi chú hợp đồng',
      termsTemplateId: c.o.ids.textId,
      rulesTemplateId: c.o.ids.rulesTextId,
    }),
    one: async (_c, req) => ({ expectedUpdatedAt: await req.currentVersion(), notes: 'Ghi chú đổi' }),
    ids: (c) => ({ contractId: c.o.ids.courseContractId ?? '' }),
    skip: {
      lines: 'gửi lines là THAY toàn bộ dòng (mã dòng mới) — không phải sửa một phần; cửa gác cách ly đã đo lines',
      terms: 'loại trừ với termsTemplateId (gửi cả hai → 400); chọn mẫu thì máy chủ bỏ điều khoản tự nhập',
    },
    derived: { termsTemplateVersion: 'phiên bản đi kèm mẫu đã chọn', rulesTemplateVersion: 'phiên bản đi kèm mẫu đã chọn' },
  },
  'PATCH /orgs/:orgId/contract-texts/:textId': {
    full: () => ({ name: 'Mẫu đủ', body: 'Nội dung đủ', appliesTo: ['SERVICE', 'COURSE'], isDefault: true, isActive: true }),
    one: () => ({ name: 'Mẫu đổi tên' }),
  },
  'PATCH /orgs/:orgId/course-groups/:groupId': {
    full: () => ({ name: 'Nhóm khoá đủ', sortOrder: 7, isActive: false }),
    one: () => ({ name: 'Nhóm khoá đổi tên' }),
  },
  'PATCH /orgs/:orgId/courses/:courseId': {
    full: (c) => ({
      name: 'Khoá đủ',
      groupId: c.o.ids.groupId,
      code: `KHD-${randomUUID().slice(0, 4).toUpperCase()}`,
      tuitionFee: 7_000_000,
      depositAmount: 1_500_000,
      defaultCapacity: 25,
      sessionCount: 12,
      sessionMinutes: 150,
      description: 'Mô tả khoá đủ',
      sortOrder: 9,
      mode: 'MULTI_CLASS',
    }),
    one: () => ({ name: 'Khoá đổi tên' }),
    skip: { firstClassName: 'chỉ hợp lệ khi chuyển Một lớp → Nhiều lớp; khoá mẫu đã là Nhiều lớp (gửi → 400)' },
    pick: (body) => (body as { course?: unknown }).course,
  },
  'PATCH /orgs/:orgId/classes/:classId': {
    full: (c) => ({
      name: 'Lớp đủ',
      startDate: '2027-02-08',
      endDate: '2027-04-20',
      weekdays: [1, 3, 5],
      startTime: '08:30',
      endTime: '11:00',
      capacity: 25,
      instructorMembershipId: c.o.ids.membershipId,
      studioLocationId: c.o.ids.locationId,
      status: 'CLOSED',
      note: 'Ghi chú lớp',
    }),
    one: () => ({ name: 'Lớp đổi tên' }),
  },
  'PATCH /orgs/:orgId/greeting-phrases/:phraseId': {
    full: () => ({ name: 'Câu đủ', appliesTo: ['COURSE'], title: 'Tiêu đề đủ', body: 'Câu chúc đủ', sortOrder: 7, isActive: false }),
    one: () => ({ name: 'Câu đổi tên' }),
  },
  'PATCH /orgs/:orgId/design-cards/:cardId': {
    full: (c) => ({
      templateCode: 'fb-03',
      courseClassId: c.o.ids.classId,
      title: 'Tiêu đề đủ',
      body: 'Lời khen đủ',
      rating: 4,
      receivedAt: '2026-11-05',
      photoFileIds: [c.o.ids.designPhotoId],
      fontOverride: 'ky-2',
      size: '1080x1080',
      snapshot: { ten: 'Tên sửa tay' },
    }),
    one: () => ({ fontOverride: 'ky-3' }),
    derived: { outputUrl: 'URL ký đổi mỗi lần đọc', outputUrlExpiresAt: 'hạn URL ký đổi mỗi lần đọc' },
  },
  'PATCH /orgs/:orgId/staff-tiers/:tierId': {
    full: () => ({ name: 'Bậc đủ', sortOrder: 5, isActive: false }),
    one: () => ({ name: 'Bậc đổi tên' }),
  },
  'PATCH /orgs/:orgId/staff/:membershipId': {
    full: (c) => ({ displayName: 'Thợ đủ', avatarFileId: c.o.ids.avatarFileId, phone: '0987654321', tierId: c.o.ids.tierId, isBookable: false }),
    one: () => ({ displayName: 'Thợ đổi tên' }),
    derived: { initials: 'chữ viết tắt suy ra từ tên hiển thị' },
    skip: { avatarUrl: 'trường chỉ để báo lỗi "không nhận avatarUrl" — không bao giờ hợp lệ' },
  },
  // Loại sự kiện, luật phụ phí (bản vẽ D, gói M7)
  'PATCH /orgs/:orgId/occasions/:occasionId': {
    full: () => ({ name: 'Sự kiện đủ', color: 'plum', sortOrder: 7, isActive: false }),
    one: () => ({ name: 'Sự kiện đổi tên' }),
  },
  'PATCH /orgs/:orgId/surcharge-rules/:surchargeRuleId': {
    full: (c) => ({
      name: 'Luật đủ',
      serviceId: c.o.ids.surchargeServiceId,
      startTime: '22:00',
      endTime: '04:00',
      weekdays: [6, 7],
      dates: ['2027-01-01'],
      occasionIds: [c.o.ids.occasionId],
      packageIds: [c.o.ids.packageId],
      subjectIds: [c.o.ids.subjectId],
      perQuantity: false,
      note: 'Ghi chú đủ',
      sortOrder: 9,
      isActive: false,
    }),
    one: () => ({ note: 'Ghi chú đổi' }),
  },
  // Mẫu in hợp đồng (bản vẽ G, gói G-M3) — chạy trên mẫu dịch vụ MẶC ĐỊNH của tổ chức (giữ defaultFor ['SERVICE']: không
  // bỏ mặc định được). Tổ chức thử là ACADEMY nên appliesTo nhận cả khoá học.
  'PATCH /orgs/:orgId/print-templates/:templateId': {
    full: () => ({
      name: 'Mẫu đủ',
      layout: 4,
      appliesTo: ['SERVICE', 'COURSE'],
      blocks: { 'ky-nhay': true, 'giay-to': true },
      title: 'TIÊU ĐỀ ĐỦ',
      openingText: 'Mở đầu {Tên khách}',
      closingText: 'Kết thúc',
      defaultFor: ['SERVICE'],
      isActive: true,
    }),
    one: () => ({ name: 'Mẫu đổi tên' }),
    derived: { version: 'tăng khi đổi nội dung in', usage: 'đếm từ nhật ký in', updatedBy: 'người sửa' },
  },
  'PATCH /platform/organizations/:organizationId': {
    full: () => ({ status: 'ACTIVE', reason: 'Mở lại' }),
    one: () => ({ status: 'SUSPENDED', reason: 'Thử cửa gác' }),
    as: 'admin',
  },
  'PATCH /platform/plans/:planId': {
    full: () => ({
      name: 'Gói đủ',
      priceMonthly: 199_000,
      maxStaff: 2,
      maxAppointmentsPerMonth: 30,
      maxStorageMb: 500,
      maxStudents: 0,
      maxCourses: 0,
      customDomain: true,
      features: ['web'],
      isActive: false,
      sortOrder: 7,
    }),
    one: () => ({ priceMonthly: 129_000 }),
    as: 'admin',
  },
};
