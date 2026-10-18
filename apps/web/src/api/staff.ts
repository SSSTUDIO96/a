import { api } from './client';
import { idSeg, orgPath, withQuery } from './org';
import type {
  Items,
  PayRateSheet,
  PayRatesInput,
  StaffListQuery,
  StaffMember,
  StaffTier,
  StaffTierCreateInput,
  StaffTierUpdateInput,
  StaffUpdateInput,
} from './types';

// Nhân sự, bậc lương, tiền công theo bậc: apps/api/src/modules/staff/*.

// ---- Bậc lương ----
export function listStaffTiers(orgId: string, signal?: AbortSignal) {
  return api.get<Items<StaffTier>>(orgPath(orgId, '/staff-tiers'), signal);
}

export function createStaffTier(orgId: string, input: StaffTierCreateInput, idempotencyKey: string) {
  return api.create<StaffTier>(orgPath(orgId, '/staff-tiers'), input, idempotencyKey);
}

export function updateStaffTier(orgId: string, tierId: string, input: StaffTierUpdateInput) {
  return api.patch<StaffTier>(orgPath(orgId, `/staff-tiers/${idSeg(tierId)}`), input);
}

// ---- Thợ ----
export function listStaff(orgId: string, query?: StaffListQuery, signal?: AbortSignal) {
  return api.get<Items<StaffMember>>(withQuery(orgPath(orgId, '/staff'), query), signal);
}

export function updateStaff(orgId: string, membershipId: string, input: StaffUpdateInput) {
  return api.patch<StaffMember>(orgPath(orgId, `/staff/${idSeg(membershipId)}`), input);
}

// ---- Tiền công theo bậc (quyền payroll.read / payroll.write) ----
export function getPackagePayRates(orgId: string, packageId: string, signal?: AbortSignal) {
  return api.get<PayRateSheet>(orgPath(orgId, `/packages/${idSeg(packageId)}/pay-rates`), signal);
}

export function putPackagePayRates(orgId: string, packageId: string, input: PayRatesInput) {
  return api.put<PayRateSheet>(orgPath(orgId, `/packages/${idSeg(packageId)}/pay-rates`), input);
}

export function getServicePayRates(orgId: string, serviceId: string, signal?: AbortSignal) {
  return api.get<PayRateSheet>(orgPath(orgId, `/services/${idSeg(serviceId)}/pay-rates`), signal);
}

export function putServicePayRates(orgId: string, serviceId: string, input: PayRatesInput) {
  return api.put<PayRateSheet>(orgPath(orgId, `/services/${idSeg(serviceId)}/pay-rates`), input);
}
