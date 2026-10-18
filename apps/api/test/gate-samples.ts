// Mẫu dữ liệu cho cửa gác cách ly (dùng chung cho tenant-isolation.test.ts và gate-mutants.test.ts).
import { randomUUID } from 'node:crypto';
import type { GateOrg, RefSamples, Samples } from './gate';

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
  'PATCH /orgs/:orgId/contracts/:contractId': () => ({ notes: 'Sửa thử' }),
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
  'POST /orgs/:orgId/contracts/quote': [(o) => ({ customerId: o.ids.customerId, lines: [packageLine(o), serviceLine(o)] })],
  'POST /orgs/:orgId/contracts': [(o) => ({ customerId: o.ids.customerId, lines: [packageLine(o), serviceLine(o)] })],
  'GET /orgs/:orgId/contracts': [(o) => ({ customerId: o.ids.customerId })],
  'PATCH /orgs/:orgId/contracts/:contractId': [(o) => ({ lines: [packageLine(o), serviceLine(o)] })],
  'POST /orgs/:orgId/contracts/:contractId/lines': [packageLine, serviceLine],
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
};
