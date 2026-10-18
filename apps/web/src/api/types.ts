// Kiểu dữ liệu gửi và nhận của các đường API thuộc tổ chức (/orgs/:orgId/...).
// Chép đúng từ mã máy chủ: schema zod (thân, query) và hàm present*/select (trả về) trong apps/api/src/modules/*.
// Bài thử src/api/khop-hop-dong.test.ts gọi máy chủ thật và so với các kiểu ở đây: đủ tên trường VÀ kiểu giá trị
// (string/number/boolean/null/mảng/đối tượng, giá trị liệt kê, chuỗi ISO, số nguyên đồng) — đọc thẳng khai báo
// trong tệp này bằng trình biên dịch TypeScript (khop-kieu.ts), nên sửa kiểu ở đây là bài thử so theo kiểu mới.
// Quy ước: tiền là số nguyên đồng (Vnd); thời điểm là chuỗi ISO 8601; toạ độ, km là số.

// ---- Giá trị liệt kê: lấy từ @makeup/shared khi shared có; còn lại khớp schema.prisma (types-shared.test.ts đối chiếu) ----
import type {
  ContractStatus,
  INITIAL_STATUSES,
  InstallmentStatus,
  PaymentKind,
  PaymentMethod,
  PaymentSummary,
  TravelFeeMode,
  Vnd,
  WorkStatus,
} from '@makeup/shared';

export type { ContractStatus, InstallmentStatus, PaymentKind, PaymentMethod, PaymentSummary, TravelFeeMode, Vnd, WorkStatus };
export type IsoDateTime = string;

export type ServiceKind = 'MAIN' | 'ADDON' | 'SURCHARGE';
export type LocationType = 'STUDIO' | 'CUSTOMER_HOME' | 'OTHER';
export type ContractLineKind = 'PACKAGE' | 'SERVICE' | 'ADDON' | 'SURCHARGE' | 'TRAVEL' | 'CUSTOM';
// Trạng thái được phép khi TẠO lịch (INITIAL_STATUSES).
export type InitialWorkStatus = (typeof INITIAL_STATUSES)[number];
export type EventKind = 'MAKEUP' | 'COURSE_SESSION' | 'INTERNAL' | 'PERSONAL_BLOCK' | 'OTHER';
export type StaffRole = 'PRIMARY' | 'ASSIST';
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
export type PriceStatus = 'CURRENT' | 'SCHEDULED' | 'PAST';

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface Items<T> {
  items: T[];
}

export interface PagingQuery {
  page?: number;
  pageSize?: number;
}

// ======================= Tổ chức =======================

// orgs/routes.ts — GET /orgs/:orgId: dòng tổ chức + vai trò và quyền của người đang xem.
export interface OrganizationDetail {
  id: string;
  slug: string;
  name: string;
  kind: 'INDIVIDUAL' | 'TEAM' | 'ACADEMY';
  timezone: string;
  currency: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  myRoles: string[];
  // Khoá quyền (packages/shared PERMISSIONS), đã sắp xếp.
  myPermissions: string[];
}

// ======================= Bảng giá (catalog) =======================

// catalog/categories.ts — dòng database trả nguyên.
export interface ServiceCategory {
  id: string;
  organizationId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// GET /service-categories thêm số dịch vụ trong danh mục.
export interface ServiceCategoryListItem extends ServiceCategory {
  serviceCount: number;
}

export interface MakeupSubject {
  id: string;
  organizationId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// Thân tạo danh mục / nhân vật makeup (NamedFields).
export interface NamedCreateInput {
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}

export type NamedUpdateInput = Partial<NamedCreateInput>;

export interface ActiveFilterQuery {
  isActive?: boolean;
}

// catalog/locations.ts — presentLocation.
export interface StudioLocation {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface StudioLocationCreateInput {
  name: string;
  address: string;
  // Vĩ độ và kinh độ đi theo cặp (cùng nhập hoặc cùng để trống).
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
  isActive?: boolean;
}

export type StudioLocationUpdateInput = Partial<StudioLocationCreateInput>;

// Bậc phí di chuyển theo km MỘT CHIỀU: khoảng [fromKm, toKm); toKm null = bậc cuối.
export interface TravelFeeTier {
  fromKm: number;
  toKm: number | null;
  amount: Vnd;
}

// catalog/locations.ts — presentPolicy.
export interface TravelFeePolicy {
  defaultMode: TravelFeeMode;
  fixedAmount: Vnd;
  perKmAmount: Vnd;
  freeKm: number;
  minimumAmount: Vnd;
  roundTrip: boolean;
  // Xếp theo fromKm. TIERED bắt buộc ít nhất một bậc.
  tiers: TravelFeeTier[];
  updatedAt: IsoDateTime;
}

// PUT ghi đè toàn bộ: gửi đủ mọi trường, kể cả tiers (mảng rỗng được khi không dùng TIERED).
export type TravelFeePolicyInput = Omit<TravelFeePolicy, 'updatedAt'>;

// catalog/prices.ts — presentPrice: giá hiện hành (null = chưa có giá hiệu lực).
export interface CurrentPrice {
  priceVersionId: string;
  listPrice: Vnd;
  salePrice: Vnd | null;
  // Giá áp dụng = giá khuyến mại nếu có, không thì giá niêm yết.
  unitPrice: Vnd;
  effectiveFrom: IsoDateTime;
}

// catalog/common.ts — presentVersion: một dòng lịch sử giá.
export interface PriceVersion {
  id: string;
  listPrice: Vnd;
  salePrice: Vnd | null;
  unitPrice: Vnd;
  effectiveFrom: IsoDateTime;
  note: string | null;
  status: PriceStatus;
  createdBy: { id: string; fullName: string | null };
  createdAt: IsoDateTime;
}

// Đổi giá = thêm phiên bản giá (NewPriceBody). effectiveFrom bỏ trống = áp dụng ngay.
export interface NewPriceInput {
  listPrice: Vnd;
  salePrice?: Vnd | null;
  effectiveFrom?: IsoDateTime;
  note?: string;
}

// catalog/services.ts — serviceSelect + currentPrice.
export interface Service {
  id: string;
  kind: ServiceKind;
  code: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  categoryId: string | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  category: { id: string; name: string } | null;
  currentPrice: CurrentPrice | null;
}

export interface ServiceListQuery extends PagingQuery {
  categoryId?: string;
  kind?: ServiceKind;
  isActive?: boolean;
  q?: string;
}

export interface ServiceUpdateInput {
  kind?: ServiceKind;
  // Máy chủ đổi sang chữ hoa; chỉ chữ không dấu, số, -, _; tối đa 32 ký tự.
  code?: string;
  name?: string;
  description?: string | null;
  durationMinutes?: number;
  categoryId?: string | null;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
}

// Tạo dịch vụ kèm giá đầu tiên (cần thêm quyền prices.write).
export interface ServiceCreateInput extends ServiceUpdateInput {
  code: string;
  name: string;
  durationMinutes: number;
  listPrice: Vnd;
  salePrice?: Vnd | null;
}

// catalog/packages.ts — packageSelect + presentPackages.
export interface PackageItem {
  serviceId: string;
  quantity: number;
  // true = dịch vụ phụ cho tick thêm; false = đã gồm trong giá gói.
  isOptional: boolean;
  service: { id: string; code: string; name: string; kind: ServiceKind; isActive: boolean };
  currentPrice: CurrentPrice | null;
}

export interface ServicePackage {
  id: string;
  code: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  staffCount: number;
  depositAmount: Vnd;
  // null = mọi nhân vật.
  subjectId: string | null;
  // Rỗng = không giới hạn địa điểm.
  locationTypes: LocationType[];
  // Bán kính miễn phí khi làm tại nhà / nơi khác (km một chiều); null = theo freeKm của tổ chức.
  includedKm: number | null;
  terms: string | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  subject: { id: string; name: string; isActive: boolean } | null;
  items: PackageItem[];
  currentPrice: CurrentPrice | null;
}

export interface PackageListQuery extends PagingQuery {
  isActive?: boolean;
  subjectId?: string;
  locationType?: LocationType;
  q?: string;
}

export interface PackageItemInput {
  serviceId: string;
  quantity?: number;
  isOptional?: boolean;
}

export interface PackageUpdateInput {
  code?: string;
  name?: string;
  description?: string | null;
  durationMinutes?: number;
  staffCount?: number;
  depositAmount?: Vnd;
  subjectId?: string | null;
  locationTypes?: LocationType[];
  includedKm?: number | null;
  terms?: string | null;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
  // Gửi items là THAY TOÀN BỘ danh sách dịch vụ trong gói.
  items?: PackageItemInput[];
}

export interface PackageCreateInput extends PackageUpdateInput {
  code: string;
  name: string;
  durationMinutes: number;
  listPrice: Vnd;
  salePrice?: Vnd | null;
}

// ======================= Khách hàng, lịch (schedule) =======================

// schedule/customers.ts — customerSelect.
export interface Customer {
  id: string;
  fullName: string;
  // Đã chuẩn hoá về 0xxxxxxxxx.
  phone: string | null;
  email: string | null;
  note: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CustomerListQuery extends PagingQuery {
  // Tìm theo tên hoặc số điện thoại.
  q?: string;
}

export interface CustomerCreateInput {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
}

export type CustomerUpdateInput = Partial<CustomerCreateInput>;

// schedule/service.ts — presentAppointment.
export interface AppointmentStaff {
  membershipId: string;
  fullName: string;
  role: StaffRole;
  blockStart: IsoDateTime;
  blockEnd: IsoDateTime;
  isBlocking: boolean;
}

export interface Appointment {
  id: string;
  code: string;
  kind: EventKind;
  title: string | null;
  status: WorkStatus;
  customer: { id: string; fullName: string; phone: string | null } | null;
  contract: { id: string; code: string; status: ContractStatus } | null;
  contractLineId: string | null;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
  travelBeforeMin: number;
  travelAfterMin: number;
  locationType: LocationType | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  cancelReason: string | null;
  staff: AppointmentStaff[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface AppointmentStatusChange {
  fromStatus: WorkStatus | null;
  toStatus: WorkStatus;
  reason: string | null;
  changedById: string;
  changedAt: IsoDateTime;
}

// Xem một lịch, tạo, sửa, đổi trạng thái: có thêm lịch sử trạng thái. Danh sách thì không.
export interface AppointmentDetail extends Appointment {
  statusHistory: AppointmentStatusChange[];
}

export interface AppointmentList {
  items: Appointment[];
  from: IsoDateTime;
  to: IsoDateTime;
}

export interface AppointmentListQuery {
  // Bắt buộc; to sau from, khoảng tối đa 62 ngày.
  from: IsoDateTime;
  to: IsoDateTime;
  membershipId?: string;
  contractId?: string;
  status?: WorkStatus;
}

export interface StaffAssignmentInput {
  membershipId: string;
  role?: StaffRole;
}

interface AppointmentPlaceInput {
  locationType?: LocationType | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  title?: string | null;
}

// Chỉ chọn khách có sẵn HOẶC khách mới, không gửi cả hai.
export interface AppointmentCreateInput extends AppointmentPlaceInput {
  kind?: EventKind;
  customerId?: string;
  newCustomer?: { fullName: string; phone?: string | null };
  contractId?: string;
  contractLineId?: string;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
  travelBeforeMin?: number;
  travelAfterMin?: number;
  // Tối đa một thợ chính; mỗi thợ một lần.
  staff?: StaffAssignmentInput[];
  status?: InitialWorkStatus;
}

export interface AppointmentUpdateInput extends AppointmentPlaceInput {
  startsAt?: IsoDateTime;
  endsAt?: IsoDateTime;
  travelBeforeMin?: number;
  travelAfterMin?: number;
  // Gửi staff là thay toàn bộ danh sách thợ.
  staff?: StaffAssignmentInput[];
}

export interface AppointmentStatusInput {
  to: WorkStatus;
  // Bắt buộc khi huỷ.
  reason?: string;
}

// Lỗi 409 "Trùng lịch": error.details = { conflicts: AppointmentConflict[] } (schedule/service.ts assertNoOverlap).
export interface AppointmentConflict {
  appointmentId: string;
  code: string;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
  blockStart: IsoDateTime;
  blockEnd: IsoDateTime;
  membershipId: string;
  staffName: string;
}

// ======================= Hợp đồng (contracts) =======================

// contracts/schemas.ts — thân gửi.
export interface TravelInput {
  mode: TravelFeeMode;
  // Theo km: số km một chiều, tối đa 2 chữ số thập phân.
  distanceKm?: number;
  // Nhập tay: bắt buộc (miễn phí = 0). Cố định và Theo km không gửi.
  amount?: Vnd;
  note?: string;
}

export interface AddonInput {
  serviceId: string;
  quantity: number;
}

interface PlacedLineFields {
  subjectId?: string;
  quantity: number;
  locationType?: LocationType;
  studioLocationId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  scheduledStart?: IsoDateTime;
  scheduledEnd?: IsoDateTime;
  lineDiscount?: Vnd;
  note?: string;
  addons?: AddonInput[];
  // Bắt buộc khi locationType là CUSTOMER_HOME hoặc OTHER.
  travel?: TravelInput;
  // Thợ phụ trách dự kiến (role mặc định PRIMARY, tối đa 20). Xác nhận hợp đồng → máy chủ tạo lịch cho đúng thợ, đúng giờ
  // (dòng có thợ phải có scheduledStart/scheduledEnd).
  staff?: StaffAssignmentInput[];
}

export interface PackageLineInput extends PlacedLineFields {
  kind: 'PACKAGE';
  packageId: string;
}

export interface ServiceLineInput extends PlacedLineFields {
  kind: 'SERVICE';
  serviceId: string;
}

export interface SurchargeLineInput {
  kind: 'SURCHARGE';
  serviceId: string;
  quantity: number;
  // Ghi đè giá phụ phí thì bắt buộc note.
  unitPrice?: Vnd;
  note?: string;
}

export interface CustomLineInput {
  kind: 'CUSTOM';
  name: string;
  unitPrice: Vnd;
  quantity: number;
  note?: string;
}

export type ContractLineInput = PackageLineInput | ServiceLineInput | SurchargeLineInput | CustomLineInput;

export interface NewCustomerInput {
  fullName: string;
  phone?: string;
}

interface ContractBodyFields {
  eventDate?: IsoDateTime;
  notes?: string;
  terms?: string;
  discount?: Vnd;
  // Bỏ trống = lấy cọc gợi ý.
  depositRequired?: Vnd;
  lines: ContractLineInput[];
}

// Đúng một trong hai: khách có sẵn (customerId) hoặc khách mới (newCustomer). Dùng cho cả quote và tạo.
export type ContractBody =
  | (ContractBodyFields & { customerId: string; newCustomer?: never })
  | (ContractBodyFields & { newCustomer: NewCustomerInput; customerId?: never });

// Nháp: sửa mọi thứ (lines = thay toàn bộ). Đã xác nhận: chỉ sửa notes.
export interface ContractUpdateInput {
  lines?: ContractLineInput[];
  discount?: Vnd;
  depositRequired?: Vnd;
  eventDate?: IsoDateTime | null;
  notes?: string | null;
  terms?: string | null;
}

export interface ContractListQuery extends PagingQuery {
  status?: ContractStatus;
  customerId?: string;
  // Tìm theo mã, tên hoặc số điện thoại khách.
  q?: string;
  eventFrom?: IsoDateTime;
  eventTo?: IsoDateTime;
}

export interface VoidLineInput {
  reason: string;
}

export interface ContractStatusInput {
  to: ContractStatus;
  // Bắt buộc khi huỷ.
  reason?: string;
}

// contracts/present.ts — LineView. Trong quote chưa ghi nên id = null.
export interface ContractLineView<Id extends string | null = string> {
  id: Id;
  kind: ContractLineKind;
  name: string;
  serviceId: string | null;
  packageId: string | null;
  priceVersionId: string | null;
  subjectId: string | null;
  subjectName: string | null;
  locationType: LocationType | null;
  studioLocationId: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  scheduledStart: IsoDateTime | null;
  scheduledEnd: IsoDateTime | null;
  quantity: number;
  unitPrice: Vnd;
  lineDiscount: Vnd;
  lineTotal: Vnd;
  travelMode: TravelFeeMode | null;
  distanceKm: number | null;
  perKmAmount: Vnd | null;
  note: string | null;
  addedAfterConfirm: boolean;
  voidedAt: IsoDateTime | null;
  voidReason: string | null;
  // Thợ phụ trách dự kiến, thợ chính đứng trước. Dòng không có thợ (dịch vụ phụ, phụ phí, phí di chuyển...) → [].
  staff: ContractLineStaff[];
  // Cảnh báo lúc tư vấn (không chặn lưu nháp); thợ rảnh thì không có mục nào.
  staffWarnings: StaffWarning[];
  // Chỉ dòng TRAVEL của bảng tính xem trước (quote) có; dòng đã lưu luôn null (database chưa lưu bán kính/bậc đã dùng).
  travelBreakdown: TravelBreakdown | null;
}

// contracts/present.ts — StaffView: thợ dự kiến của một dòng.
export interface ContractLineStaff {
  membershipId: string;
  role: StaffRole;
  displayName: string;
  // URL hiển thị được (URL ký có hạn của tệp ảnh, hoặc ảnh https cũ); null = hiện chữ viết tắt.
  avatarUrl: string | null;
  initials: string;
  tier: { id: string; name: string } | null;
}

// contracts/present.ts — StaffWarning: thợ trùng giờ (OVERLAP) hoặc có lịch khác trong ngày (SAME_DAY),
// kể cả khi chỉ đang được giữ chỗ ở hợp đồng nháp khác. Ca và giữ chỗ của chính hợp đồng này không tính.
export interface StaffWarning {
  membershipId: string;
  level: Exclude<AvailabilityLevel, 'FREE'>;
  overlaps: AvailabilityShift[];
  sameDay: AvailabilityShift[];
  draftHolds: DraftHold[];
}

// contracts/sheet.ts — TravelBreakdown: số liệu để in dòng công thức phí di chuyển.
export interface TravelBreakdown {
  // Bán kính miễn phí đã áp (km một chiều); null với nhập tay.
  includedKm: number | null;
  // Bán kính lấy từ gói (includedKm của gói) hay mức chung của tổ chức (freeKm).
  includedFrom: 'PACKAGE' | 'ORGANIZATION' | null;
  // Km vượt bán kính, một chiều.
  excessKm: number | null;
  // Km tính tiền của PER_KM = km vượt × (khứ hồi ? 2 : 1).
  chargedKm: number | null;
  roundTrip: boolean;
  // Bậc đã áp (chỉ TIERED, khi vượt bán kính).
  tier: TravelFeeTier | null;
}

// Dịch vụ phụ và phí di chuyển gom dưới dòng cha.
export interface GroupedContractLine<Id extends string | null = string> extends ContractLineView<Id> {
  addons: ContractLineView<Id>[];
  travel: ContractLineView<Id> | null;
}

// contracts/present.ts — presentSheet: bảng tính xem trước (POST /contracts/quote).
export interface ContractQuote {
  lines: GroupedContractLine<null>[];
  travelTotal: Vnd;
  subtotal: Vnd;
  discount: Vnd;
  total: Vnd;
  depositRequired: Vnd;
  suggestedDeposit: Vnd;
}

// contracts/present.ts — presentSummary (danh sách).
export interface ContractSummary {
  id: string;
  code: string;
  status: ContractStatus;
  eventDate: IsoDateTime | null;
  subtotal: Vnd;
  discount: Vnd;
  total: Vnd;
  depositRequired: Vnd;
  confirmedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  customer: { id: string; fullName: string; phone: string | null };
}

// contracts/present.ts — loadContractDetail.
export interface ContractDetail {
  id: string;
  code: string;
  status: ContractStatus;
  eventDate: IsoDateTime | null;
  subtotal: Vnd;
  discount: Vnd;
  total: Vnd;
  depositRequired: Vnd;
  travelTotal: Vnd;
  notes: string | null;
  terms: string | null;
  cancelReason: string | null;
  confirmedAt: IsoDateTime | null;
  createdById: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  customer: { id: string; fullName: string; phone: string | null; email: string | null };
  lines: GroupedContractLine[];
  appointments: { id: string; code: string; startsAt: IsoDateTime; status: WorkStatus; contractLineId: string | null }[];
}

// Huỷ dòng làm tổng giảm: máy chủ tự hạ giảm giá / cọc nếu vượt tổng mới và báo lại ở đây.
export interface ContractAdjustment {
  field: 'discount' | 'depositRequired';
  from: Vnd;
  to: Vnd;
}

export interface ContractVoidResult extends ContractDetail {
  adjustments: ContractAdjustment[];
}

// Thêm dòng: hợp đồng đã xác nhận mà dòng mới có thợ dự kiến → máy chủ tạo lịch ngay và liệt kê ở createdAppointments
// (nháp thì mảng rỗng).
export interface ContractAddLineResult extends ContractDetail {
  createdAppointments: ContractDetail['appointments'];
}

// Đổi trạng thái: huỷ hợp đồng thì máy chủ huỷ luôn các lịch đã gắn và liệt kê ở cancelledAppointments
// (đổi sang trạng thái khác thì mảng rỗng). Còn lịch đang làm → 409, error.details = { appointments: [{id, code, status}] }.
// Xác nhận hợp đồng: mỗi dòng có thợ dự kiến thành một lịch đã xác nhận, liệt kê ở createdAppointments.
export interface ContractStatusResult extends ContractDetail {
  cancelledAppointments: ContractDetail['appointments'];
  createdAppointments: ContractDetail['appointments'];
}

// ======================= Nhân sự, tiền công (staff) =======================

// staff/tiers.ts — presentTier.
export interface StaffTier {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  // Số thợ đang hoạt động thuộc bậc.
  staffCount: number;
}

export interface StaffTierCreateInput {
  name: string;
  // Bỏ trống = xếp cuối.
  sortOrder?: number;
}

export interface StaffTierUpdateInput {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}

// staff/common.ts — presentStaff.
export interface StaffMember {
  membershipId: string;
  userId: string;
  fullName: string;
  displayName: string;
  // Chữ viết tắt thay ảnh khi chưa có ảnh ("Nguyễn Thị Hoa" → "NH").
  initials: string;
  avatarUrl: string | null;
  // Chỉ trả cho người có quyền staff.write; người khác nhận null.
  phone: string | null;
  tier: { id: string; name: string; isActive: boolean } | null;
  isBookable: boolean;
  hasProfile: boolean;
  status: MembershipStatus;
  roleKeys: string[];
}

export interface StaffListQuery {
  tierId?: string;
  q?: string;
}

export interface StaffUpdateInput {
  displayName?: string | null;
  // Ảnh đại diện = mã tệp STAFF_AVATAR đã tải lên (files.ts uploadFile). null = bỏ ảnh.
  // Máy chủ KHÔNG còn nhận avatarUrl nhập tay (gửi lên là 400).
  avatarFileId?: string | null;
  phone?: string | null;
  // null = bỏ bậc.
  tierId?: string | null;
  isBookable?: boolean;
}

// staff/payRates.ts — buildSheet.
export interface PayRateStaff {
  membershipId: string;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
}

export interface PayRateRow {
  tier: { id: string; name: string; sortOrder: number };
  // null = chưa đặt.
  amount: Vnd | null;
  updatedAt: IsoDateTime | null;
  staff: PayRateStaff[];
}

export interface PayRateSheet {
  owner: { kind: 'package' | 'service'; id: string; name: string };
  items: PayRateRow[];
}

// staff/availability.ts — mức rảnh của thợ cho một khung giờ (chọn thợ khi xếp lịch / lập hợp đồng).
export type AvailabilityLevel = 'OVERLAP' | 'SAME_DAY' | 'FREE';

export interface AvailabilityShift {
  appointmentId: string;
  code: string;
  status: WorkStatus;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
  // Khoảng bận đã gồm thời gian di chuyển.
  blockStart: IsoDateTime;
  blockEnd: IsoDateTime;
  title: string | null;
  customerName: string | null;
}

// Thợ đang được giữ chỗ ở dòng của một hợp đồng nháp khác.
export interface DraftHold {
  contractId: string;
  code: string;
  lineId: string;
  lineName: string;
  scheduledStart: IsoDateTime | null;
  scheduledEnd: IsoDateTime | null;
  overlaps: boolean;
}

export interface StaffAvailability {
  membershipId: string;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  tier: { id: string; name: string } | null;
  isBookable: boolean;
  // OVERLAP = trùng giờ; SAME_DAY = có lịch khác cùng ngày (theo múi giờ tổ chức); FREE = rảnh.
  level: AvailabilityLevel;
  overlaps: AvailabilityShift[];
  sameDay: AvailabilityShift[];
  draftHolds: DraftHold[];
}

export interface StaffAvailabilityQuery {
  startsAt: IsoDateTime;
  // Sau startsAt, khung tối đa 24 giờ.
  endsAt: IsoDateTime;
  membershipIds?: string[];
  excludeAppointmentIds?: string[];
  // Đang sửa hợp đồng nháp nào thì bỏ giữ chỗ của chính nó.
  excludeContractId?: string;
}

export interface StaffAvailabilityResult {
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
  // Ranh giới "ngày" theo múi giờ của tổ chức.
  dayStart: IsoDateTime;
  dayEnd: IsoDateTime;
  timezone: string;
  items: StaffAvailability[];
}

export interface PayRatesInput {
  // amount null = xoá mức công của bậc; bậc không gửi giữ nguyên.
  rates: { tierId: string; amount: Vnd | null }[];
}
