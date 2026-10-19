import { api } from './client';
import { idSeg, orgPath, withQuery } from './org';
import type {
  AppointmentCreateInput,
  AppointmentDetail,
  AppointmentList,
  AppointmentListQuery,
  AppointmentStatusInput,
  AppointmentUpdateInput,
  Customer,
  CustomerCreateInput,
  CustomerListQuery,
  CustomerUpdateInput,
  Page,
} from './types';

// Khách hàng và lịch: apps/api/src/modules/schedule/*.

// ---- Khách hàng ----
export function listCustomers(orgId: string, query?: CustomerListQuery, signal?: AbortSignal) {
  return api.get<Page<Customer>>(withQuery(orgPath(orgId, '/customers'), query), signal);
}

export function getCustomer(orgId: string, customerId: string, signal?: AbortSignal) {
  return api.get<Customer>(orgPath(orgId, `/customers/${idSeg(customerId)}`), signal);
}

export function createCustomer(orgId: string, input: CustomerCreateInput, idempotencyKey: string) {
  return api.create<Customer>(orgPath(orgId, '/customers'), input, idempotencyKey);
}

export function updateCustomer(orgId: string, customerId: string, input: CustomerUpdateInput) {
  return api.patch<Customer>(orgPath(orgId, `/customers/${idSeg(customerId)}`), input);
}

// ---- Lịch ----
// Bắt buộc from/to (tối đa 62 ngày). Người chỉ có schedule.read_own nhận lịch của mình.
// Mỗi ca có occasion { id, name, color } | null (bản vẽ D 2.5): màu Lịch "Tô theo sự kiện" lấy từ đây.
export function listAppointments(orgId: string, query: AppointmentListQuery, signal?: AbortSignal) {
  return api.get<AppointmentList>(withQuery(orgPath(orgId, '/appointments'), query), signal);
}

export function getAppointment(orgId: string, appointmentId: string, signal?: AbortSignal) {
  return api.get<AppointmentDetail>(orgPath(orgId, `/appointments/${idSeg(appointmentId)}`), signal);
}

// Máy chủ bắt buộc Idempotency-Key. Trùng giờ thợ → 409, error.details = { conflicts: AppointmentConflict[] }.
export function createAppointment(orgId: string, input: AppointmentCreateInput, idempotencyKey: string) {
  return api.create<AppointmentDetail>(orgPath(orgId, '/appointments'), input, idempotencyKey);
}

export function updateAppointment(orgId: string, appointmentId: string, input: AppointmentUpdateInput) {
  return api.patch<AppointmentDetail>(orgPath(orgId, `/appointments/${idSeg(appointmentId)}`), input);
}

// Đổi trạng thái theo bảng chuyển; huỷ bắt buộc reason.
export function changeAppointmentStatus(orgId: string, appointmentId: string, input: AppointmentStatusInput) {
  return api.post<AppointmentDetail>(orgPath(orgId, `/appointments/${idSeg(appointmentId)}/status`), input);
}
