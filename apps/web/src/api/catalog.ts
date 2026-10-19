import { api } from './client';
import { idSeg, orgPath, withQuery } from './org';
import type {
  ActiveFilterQuery,
  Items,
  MakeupSubject,
  NamedCreateInput,
  NamedUpdateInput,
  NewPriceInput,
  OccasionCreateInput,
  OccasionOrderInput,
  OccasionUpdateInput,
  OccasionView,
  Page,
  PackageCreateInput,
  PackageListQuery,
  PackageUpdateInput,
  PagingQuery,
  PriceVersion,
  Service,
  ServiceCategory,
  ServiceCategoryListItem,
  ServiceCreateInput,
  ServiceListQuery,
  ServicePackage,
  ServiceUpdateInput,
  StudioLocation,
  StudioLocationCreateInput,
  StudioLocationUpdateInput,
  SurchargeRuleCreateInput,
  SurchargeRuleUpdateInput,
  SurchargeRuleView,
  TravelFeePolicy,
  TravelFeePolicyInput,
} from './types';

// Bảng giá: apps/api/src/modules/catalog/*. POST tạo dữ liệu nhận idempotencyKey do nơi bấm nút sinh (newIdempotencyKey).

// ---- Danh mục dịch vụ ----
export function listServiceCategories(orgId: string, query?: ActiveFilterQuery, signal?: AbortSignal) {
  return api.get<Items<ServiceCategoryListItem>>(withQuery(orgPath(orgId, '/service-categories'), query), signal);
}

export function createServiceCategory(orgId: string, input: NamedCreateInput, idempotencyKey: string) {
  return api.create<ServiceCategory>(orgPath(orgId, '/service-categories'), input, idempotencyKey);
}

export function updateServiceCategory(orgId: string, categoryId: string, input: NamedUpdateInput) {
  return api.patch<ServiceCategory>(orgPath(orgId, `/service-categories/${idSeg(categoryId)}`), input);
}

// ---- Nhân vật makeup ----
export function listMakeupSubjects(orgId: string, query?: ActiveFilterQuery, signal?: AbortSignal) {
  return api.get<Items<MakeupSubject>>(withQuery(orgPath(orgId, '/makeup-subjects'), query), signal);
}

export function createMakeupSubject(orgId: string, input: NamedCreateInput, idempotencyKey: string) {
  return api.create<MakeupSubject>(orgPath(orgId, '/makeup-subjects'), input, idempotencyKey);
}

export function updateMakeupSubject(orgId: string, subjectId: string, input: NamedUpdateInput) {
  return api.patch<MakeupSubject>(orgPath(orgId, `/makeup-subjects/${idSeg(subjectId)}`), input);
}

// ---- Studio / cửa hàng ----
export function listStudioLocations(orgId: string, query?: ActiveFilterQuery, signal?: AbortSignal) {
  return api.get<Items<StudioLocation>>(withQuery(orgPath(orgId, '/studio-locations'), query), signal);
}

export function createStudioLocation(orgId: string, input: StudioLocationCreateInput, idempotencyKey: string) {
  return api.create<StudioLocation>(orgPath(orgId, '/studio-locations'), input, idempotencyKey);
}

export function updateStudioLocation(orgId: string, locationId: string, input: StudioLocationUpdateInput) {
  return api.patch<StudioLocation>(orgPath(orgId, `/studio-locations/${idSeg(locationId)}`), input);
}

// ---- Phí di chuyển ----
export function getTravelFeePolicy(orgId: string, signal?: AbortSignal) {
  return api.get<TravelFeePolicy>(orgPath(orgId, '/travel-fee-policy'), signal);
}

// Ghi đè toàn bộ — gửi đủ 6 trường. Quyền prices.write.
export function putTravelFeePolicy(orgId: string, input: TravelFeePolicyInput) {
  return api.put<TravelFeePolicy>(orgPath(orgId, '/travel-fee-policy'), input);
}

// ---- Dịch vụ ----
export function listServices(orgId: string, query?: ServiceListQuery, signal?: AbortSignal) {
  return api.get<Page<Service>>(withQuery(orgPath(orgId, '/services'), query), signal);
}

export function getService(orgId: string, serviceId: string, signal?: AbortSignal) {
  return api.get<Service>(orgPath(orgId, `/services/${idSeg(serviceId)}`), signal);
}

export function createService(orgId: string, input: ServiceCreateInput, idempotencyKey: string) {
  return api.create<Service>(orgPath(orgId, '/services'), input, idempotencyKey);
}

// Không đổi giá ở đây — đổi giá dùng addServicePrice.
export function updateService(orgId: string, serviceId: string, input: ServiceUpdateInput) {
  return api.patch<Service>(orgPath(orgId, `/services/${idSeg(serviceId)}`), input);
}

export function listServicePrices(orgId: string, serviceId: string, query?: PagingQuery, signal?: AbortSignal) {
  return api.get<Page<PriceVersion>>(withQuery(orgPath(orgId, `/services/${idSeg(serviceId)}/prices`), query), signal);
}

export function addServicePrice(orgId: string, serviceId: string, input: NewPriceInput, idempotencyKey: string) {
  return api.create<PriceVersion>(orgPath(orgId, `/services/${idSeg(serviceId)}/prices`), input, idempotencyKey);
}

// ---- Gói dịch vụ ----
export function listPackages(orgId: string, query?: PackageListQuery, signal?: AbortSignal) {
  return api.get<Page<ServicePackage>>(withQuery(orgPath(orgId, '/packages'), query), signal);
}

export function getPackage(orgId: string, packageId: string, signal?: AbortSignal) {
  return api.get<ServicePackage>(orgPath(orgId, `/packages/${idSeg(packageId)}`), signal);
}

export function createPackage(orgId: string, input: PackageCreateInput, idempotencyKey: string) {
  return api.create<ServicePackage>(orgPath(orgId, '/packages'), input, idempotencyKey);
}

// Gửi items là thay toàn bộ danh sách dịch vụ trong gói. Không đổi giá ở đây.
export function updatePackage(orgId: string, packageId: string, input: PackageUpdateInput) {
  return api.patch<ServicePackage>(orgPath(orgId, `/packages/${idSeg(packageId)}`), input);
}

export function listPackagePrices(orgId: string, packageId: string, query?: PagingQuery, signal?: AbortSignal) {
  return api.get<Page<PriceVersion>>(withQuery(orgPath(orgId, `/packages/${idSeg(packageId)}/prices`), query), signal);
}

export function addPackagePrice(orgId: string, packageId: string, input: NewPriceInput, idempotencyKey: string) {
  return api.create<PriceVersion>(orgPath(orgId, `/packages/${idSeg(packageId)}/prices`), input, idempotencyKey);
}

// ---- Loại sự kiện (bản vẽ D 2.2; catalog/occasions.ts) ----
// Đọc: catalog.read. Thêm / sửa / ẩn / đổi thứ tự: catalog.write. Không có đường xoá — ẩn bằng isActive: false.
export function listOccasions(orgId: string, query?: ActiveFilterQuery, signal?: AbortSignal) {
  return api.get<Items<OccasionView>>(withQuery(orgPath(orgId, '/occasions'), query), signal);
}

export function createOccasion(orgId: string, input: OccasionCreateInput, idempotencyKey: string) {
  return api.create<OccasionView>(orgPath(orgId, '/occasions'), input, idempotencyKey);
}

export function updateOccasion(orgId: string, occasionId: string, input: OccasionUpdateInput) {
  return api.patch<OccasionView>(orgPath(orgId, `/occasions/${idSeg(occasionId)}`), input);
}

// Gửi ĐỦ mọi loại sự kiện của tổ chức, mỗi loại một lần; thiếu / trùng / mã lạ → 400 cùng một lời.
export function reorderOccasions(orgId: string, input: OccasionOrderInput) {
  return api.put<Items<OccasionView>>(orgPath(orgId, '/occasions/order'), input);
}

// ---- Luật phụ phí tự động (bản vẽ D 2.3; catalog/surcharge-rules.ts) ----
// Đọc: catalog.read. Thêm / sửa / tắt: prices.write (luật sinh tiền trên hợp đồng). Không có đường xoá — tắt bằng isActive: false.
export function listSurchargeRules(orgId: string, query?: ActiveFilterQuery, signal?: AbortSignal) {
  return api.get<Items<SurchargeRuleView>>(withQuery(orgPath(orgId, '/surcharge-rules'), query), signal);
}

export function createSurchargeRule(orgId: string, input: SurchargeRuleCreateInput, idempotencyKey: string) {
  return api.create<SurchargeRuleView>(orgPath(orgId, '/surcharge-rules'), input, idempotencyKey);
}

// Sửa / tắt luật không đổi hợp đồng đã lưu. Mảng gửi lên thay toàn bộ mảng cũ.
export function updateSurchargeRule(orgId: string, ruleId: string, input: SurchargeRuleUpdateInput) {
  return api.patch<SurchargeRuleView>(orgPath(orgId, `/surcharge-rules/${idSeg(ruleId)}`), input);
}
