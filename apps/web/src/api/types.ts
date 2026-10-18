// Kiểu dữ liệu gửi và nhận của các đường API thuộc tổ chức (/orgs/:orgId/...).
// Chép đúng từ mã máy chủ: schema zod (thân, query) và hàm present*/select (trả về) trong apps/api/src/modules/*.
// Bài thử src/api/khop-hop-dong.test.ts gọi máy chủ thật và so với các kiểu ở đây: đủ tên trường VÀ kiểu giá trị
// (string/number/boolean/null/mảng/đối tượng, giá trị liệt kê, chuỗi ISO, số nguyên đồng) — đọc thẳng khai báo
// trong tệp này bằng trình biên dịch TypeScript (khop-kieu.ts), nên sửa kiểu ở đây là bài thử so theo kiểu mới.
// Quy ước: tiền là số nguyên đồng (Vnd); thời điểm là chuỗi ISO 8601; toạ độ, km là số.

// ---- Giá trị liệt kê: lấy từ @makeup/shared khi shared có; còn lại khớp schema.prisma (types-shared.test.ts đối chiếu) ----
import type {
  ContractKindKey,
  ContractStatus,
  INITIAL_STATUSES,
  InstallmentStatus,
  PaymentKind,
  PaymentMethod,
  PaymentSummary,
  SeatState,
  TravelFeeMode,
  Vnd,
  WorkStatus,
} from '@makeup/shared';

export type { ContractStatus, InstallmentStatus, PaymentKind, PaymentMethod, PaymentSummary, TravelFeeMode, Vnd, WorkStatus };
export type IsoDateTime = string;
// Loại hợp đồng (BAN-VE-C3 mục 1.1): dịch vụ makeup hoặc khoá học. Đặt lúc tạo, không đổi được sau đó.
export type ContractKind = ContractKindKey;
// Mẫu điều khoản / nội quy (contracts/texts.ts).
export type ContractTextKind = 'TERMS' | 'RULES';

export type ServiceKind = 'MAIN' | 'ADDON' | 'SURCHARGE';
export type LocationType = 'STUDIO' | 'CUSTOMER_HOME' | 'OTHER';
export type ContractLineKind = 'PACKAGE' | 'SERVICE' | 'ADDON' | 'SURCHARGE' | 'TRAVEL' | 'CUSTOM' | 'COURSE';
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
  // null = không áp dụng — chỉ phụ phí (SURCHARGE) được bỏ trống; MAIN/ADDON luôn có số phút (catalog/services.ts).
  durationMinutes: number | null;
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
  // null = bỏ trống thời lượng — chỉ hợp lệ khi loại (sau khi sửa) là SURCHARGE, còn lại máy chủ trả 400 ở ô durationMinutes.
  durationMinutes?: number | null;
  categoryId?: string | null;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
}

// Tạo dịch vụ kèm giá đầu tiên (cần thêm quyền prices.write).
export interface ServiceCreateInput extends ServiceUpdateInput {
  code: string;
  name: string;
  // Phụ phí: bỏ trống (vắng mặt hoặc null) → máy chủ lưu null. MAIN/ADDON bắt buộc (kind vắng mặt = MAIN).
  durationMinutes?: number | null;
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
  // Ảnh đại diện khách (tệp CUSTOMER_AVATAR); avatarUrl = URL ký có hạn để hiện, null = hiện chữ viết tắt.
  avatarFileId: string | null;
  avatarUrl: string | null;
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
  // Tên hiển thị hồ sơ thợ (không có hồ sơ thì là họ tên).
  displayName: string;
  // URL ảnh ký hạn 10 phút — tải lại lịch để lấy URL mới, không giữ lâu.
  avatarUrl: string | null;
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
  // Nhân vật trên dòng hợp đồng gắn với ca; ca không gắn dòng hoặc dòng không có nhân vật → null.
  subjectName: string | null;
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

// Dòng khoá học (chỉ hợp đồng COURSE): tên = khoá · lớp, đơn giá = học phí lúc thêm, số lượng 1 — máy chủ chép.
// Lớp hết chỗ / ngừng nhận → 409 khi tạo, sửa, thêm dòng (xem trước thì không chặn, báo ở ContractQuote.classes).
export interface CourseLineInput {
  kind: 'COURSE';
  courseClassId: string;
  note?: string;
}

// Luật trộn dòng (máy chủ kiểm): hợp đồng khoá học chỉ nhận COURSE + CUSTOM; hợp đồng dịch vụ không nhận COURSE.
export type ContractLineInput = PackageLineInput | ServiceLineInput | SurchargeLineInput | CustomLineInput | CourseLineInput;

export interface NewCustomerInput {
  fullName: string;
  phone?: string;
}

interface ContractBodyFields {
  // Mặc định SERVICE. COURSE chỉ ở tổ chức ACADEMY (khác → 403 "Tổ chức chưa bật đào tạo").
  kind?: ContractKind;
  // Người phụ trách (tư vấn, nhắc đóng tiền) — thành viên đang hoạt động.
  ownerMembershipId?: string;
  eventDate?: IsoDateTime;
  notes?: string;
  // Tự nhập điều khoản HOẶC chọn mẫu (termsTemplateId) — không gửi cả hai.
  terms?: string;
  // Mẫu điều khoản / nội quy (nội quy chỉ hợp đồng khoá học). Nội dung được CHỤP vào hợp đồng lúc xác nhận;
  // không chọn → lúc xác nhận lấy mẫu mặc định.
  termsTemplateId?: string;
  rulesTemplateId?: string;
  discount?: Vnd;
  // Bỏ trống = lấy cọc gợi ý.
  depositRequired?: Vnd;
  lines: ContractLineInput[];
}

// Đúng một trong hai: khách có sẵn (customerId) hoặc khách mới (newCustomer). Dùng cho cả quote và tạo.
export type ContractBody =
  | (ContractBodyFields & { customerId: string; newCustomer?: never })
  | (ContractBodyFields & { newCustomer: NewCustomerInput; customerId?: never });

// Xem trước (quote): thân như tạo, thêm excludeContractId = hợp đồng đang sửa — máy chủ bỏ giữ chỗ nháp và lịch của
// CHÍNH hợp đồng đó khỏi cảnh báo thợ (contracts/schemas.ts QuoteBodySchema).
export type ContractQuoteBody = ContractBody & { excludeContractId?: string };

// Nháp: sửa mọi thứ (lines = thay toàn bộ). Đã xác nhận: chỉ sửa notes.
// expectedUpdatedAt BẮT BUỘC = updatedAt của bản đang sửa; lệch bản hiện hành → 409 CONFLICT,
// details { reason: 'STALE_VERSION', currentUpdatedAt, expectedUpdatedAt } (biên bản web 2, T2).
// Sửa nháp hạ tổng dưới số đã thu → 409, details { reason: 'TOTAL_BELOW_PAID', paid, newTotal, total }.
export interface ContractUpdateInput {
  expectedUpdatedAt: IsoDateTime;
  // Đổi khách — chỉ hợp đồng NHÁP. 404 khách không thuộc tổ chức; 409 reason CUSTOMER_IN_USE (kèm số lịch / thẻ thiết kế
  // đang mang tên khách cũ) hoặc 409 khi hợp đồng đã xác nhận (contracts/routes.ts checkCustomerChange).
  customerId?: string;
  lines?: ContractLineInput[];
  discount?: Vnd;
  depositRequired?: Vnd;
  eventDate?: IsoDateTime | null;
  notes?: string | null;
  terms?: string | null;
  // null = bỏ mẫu đã chọn.
  termsTemplateId?: string | null;
  rulesTemplateId?: string | null;
}

export interface ContractListQuery extends PagingQuery {
  status?: ContractStatus;
  customerId?: string;
  // Tìm theo mã, tên hoặc số điện thoại khách.
  q?: string;
  eventFrom?: IsoDateTime;
  eventTo?: IsoDateTime;
  kind?: ContractKind;
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
  // Lớp của dòng khoá học (chỉ dòng COURSE; dòng khác null).
  courseClassId: string | null;
  addedAfterConfirm: boolean;
  // Lúc thêm dòng (dòng đã lưu); bảng tính xem trước (quote) chưa ghi nên null.
  createdAt: IsoDateTime | null;
  voidedAt: IsoDateTime | null;
  voidReason: string | null;
  // Thợ phụ trách dự kiến, thợ chính đứng trước. Dòng không có thợ (dịch vụ phụ, phụ phí, phí di chuyển...) → [].
  staff: ContractLineStaff[];
  // Cảnh báo lúc tư vấn (không chặn lưu nháp); thợ rảnh thì không có mục nào.
  staffWarnings: StaffWarning[];
  // Dòng TRAVEL: bảng tính xem trước có; dòng đã lưu dựng lại từ số liệu đã chụp (dòng lưu trước khi có ảnh chụp → null).
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

// contracts/present.ts — StaffWarning: OVERLAP (đỏ, chặn xác nhận) = trùng lịch đã chiếm giờ thật hoặc trùng dòng khác
// của chính hợp đồng (sameContract); SAME_DAY (vàng) = có lịch khác trong ngày; DRAFT_HOLD (xám, KHÔNG chặn) = chỉ đang
// được giữ chỗ ở hợp đồng NHÁP khác (draftHolds[].overlaps cho biết trùng giờ hay chỉ cùng ngày). Quyết định 15:14.
// Ca và giữ chỗ của chính hợp đồng đang sửa (excludeContractId) không tính.
export interface StaffWarning {
  membershipId: string;
  level: Exclude<AvailabilityLevel, 'FREE'> | 'DRAFT_HOLD';
  overlaps: AvailabilityShift[];
  sameDay: AvailabilityShift[];
  draftHolds: DraftHold[];
  // Trùng giờ với dòng KHÁC của CHÍNH hợp đồng này (một thợ ở hai dòng chồng giờ) — luôn mức OVERLAP.
  sameContract: SameContractHit[];
}

// contracts/present.ts — SameContractHit.
export interface SameContractHit {
  // id dòng đã lưu; null ở bảng tính xem trước.
  lineId: string | null;
  // Vị trí dòng gốc trong mảng `lines` của phản hồi (từ 0).
  lineIndex: number;
  lineName: string;
  scheduledStart: IsoDateTime;
  scheduledEnd: IsoDateTime;
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
  kind: ContractKind;
  lines: GroupedContractLine<null>[];
  travelTotal: Vnd;
  subtotal: Vnd;
  discount: Vnd;
  total: Vnd;
  depositRequired: Vnd;
  suggestedDeposit: Vnd;
  // Tình trạng chỗ của các lớp trong dòng khoá học (xem trước không chặn lớp đầy — web báo; chốt ở bước xác nhận).
  classes: ContractClassSeats[];
}

// contracts/enroll.ts — ClassSeats. seatState theo seatState() của @makeup/shared.
export interface ContractClassSeats {
  classId: string;
  name: string;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  capacity: number;
  enrolledCount: number;
  seatsLeft: number;
  seatState: SeatState;
}

// Ghi danh sinh khi hợp đồng khoá học xác nhận (một dòng COURSE = một ghi danh); huỷ hợp đồng / huỷ dòng → CANCELLED.
export interface ContractEnrollment {
  id: string;
  contractLineId: string;
  courseClassId: string;
  status: 'ACTIVE' | 'CANCELLED';
  enrolledAt: IsoDateTime;
  cancelledAt: IsoDateTime | null;
  cancelReason: string | null;
}

// contracts/present.ts — presentSummary (danh sách).
export interface ContractSummary {
  id: string;
  code: string;
  kind: ContractKind;
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
  kind: ContractKind;
  status: ContractStatus;
  ownerMembershipId: string | null;
  eventDate: IsoDateTime | null;
  subtotal: Vnd;
  discount: Vnd;
  total: Vnd;
  depositRequired: Vnd;
  travelTotal: Vnd;
  notes: string | null;
  terms: string | null;
  // Nội quy (chỉ hợp đồng khoá học) và mẫu đã chọn (nháp) / đã chụp (sau xác nhận: bản chụp, không đổi theo mẫu).
  rules: string | null;
  termsTemplateId: string | null;
  termsTemplateVersion: number | null;
  rulesTemplateId: string | null;
  rulesTemplateVersion: number | null;
  cancelReason: string | null;
  confirmedAt: IsoDateTime | null;
  createdById: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  customer: { id: string; fullName: string; phone: string | null; email: string | null };
  lines: GroupedContractLine[];
  appointments: { id: string; code: string; startsAt: IsoDateTime; status: WorkStatus; contractLineId: string | null }[];
  enrollments: ContractEnrollment[];
}

// contracts/texts.ts — mẫu điều khoản / nội quy. Sửa body → version + 1; mỗi (tổ chức, loại) tối đa một mẫu mặc định.
export interface ContractText {
  id: string;
  kind: ContractTextKind;
  // Rỗng = dùng cho cả hai loại hợp đồng.
  appliesTo: ContractKind[];
  name: string;
  body: string;
  version: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  updatedBy: { id: string; fullName: string };
}

export interface ContractTextListQuery {
  kind?: ContractTextKind;
  // Mẫu dùng được cho loại hợp đồng này (gồm cả mẫu áp dụng cho cả hai loại).
  appliesTo?: ContractKind;
  includeInactive?: boolean;
}

export interface ContractTextCreateInput {
  kind: ContractTextKind;
  appliesTo: ContractKind[];
  name: string;
  // ≤ 20000 ký tự.
  body: string;
  isDefault?: boolean;
}

// Trường không gửi giữ nguyên. Mẫu mặc định phải đang dùng.
export interface ContractTextUpdateInput {
  name?: string;
  body?: string;
  appliesTo?: ContractKind[];
  isDefault?: boolean;
  isActive?: boolean;
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

// ======================= Tệp (files) =======================

// Giá trị liệt kê khớp schema.prisma (FilePurpose, FileStatus).
export type FilePurpose =
  | 'STAFF_AVATAR'
  | 'CUSTOMER_AVATAR'
  | 'ORG_LOGO'
  | 'ALBUM_IMAGE'
  | 'COURSE_RESOURCE'
  | 'SUBMISSION'
  | 'WELCOME_CARD'
  | 'OTHER'
  // Ảnh người dùng tải lên cho thẻ (chào mừng / feedback / lời chúc).
  | 'DESIGN_PHOTO'
  // Ảnh PNG thẻ đã xuất.
  | 'DESIGN_CARD';
export type FileStatus = 'UPLOADING' | 'READY' | 'DELETED';

// files/service.ts — presentFile.
export interface StoredFileView {
  id: string;
  purpose: FilePurpose;
  status: FileStatus;
  // Tên tệp chỉ để hiển thị (máy chủ đã thay ký tự điều khiển và dấu gạch đường dẫn bằng "_").
  originalName: string;
  // Máy chủ nhận diện bằng chữ ký đầu tệp: image/jpeg, image/png, image/webp hoặc application/pdf.
  mimeType: string;
  sizeBytes: number;
  sha256: string | null;
  // Chỉ ảnh có kích thước; PDF → null.
  width: number | null;
  height: number | null;
  createdAt: IsoDateTime;
  // URL đọc có hạn 10 phút (chỉ tệp READY). Hết hạn thì gọi lại getFile để lấy URL mới.
  signedUrl: string | null;
  signedUrlExpiresAt: IsoDateTime | null;
}

// POST /files: thân là NỘI DUNG NHỊ PHÂN của tệp (không multipart). Dung lượng tối đa theo mục đích
// (ảnh đại diện 5 MB, logo 2 MB, album 15 MB, tài liệu 25 MB...); chỉ JPEG, PNG, WebP (và PDF cho tài liệu).
export interface FileUploadInput {
  purpose: FilePurpose;
  // Tên hiển thị, 1–200 ký tự.
  name: string;
  data: Blob | ArrayBuffer;
}

// ======================= Thu tiền (payments) =======================

// payments/common.ts — presentPayment: phiếu thu / phiếu hoàn. Chỉ ghi thêm: ghi sai thì huỷ có lý do.
export interface Payment {
  id: string;
  // PT-000001 theo tổ chức.
  code: string;
  contractId: string;
  kind: PaymentKind;
  method: PaymentMethod;
  amount: Vnd;
  receivedAt: IsoDateTime;
  note: string | null;
  voidedAt: IsoDateTime | null;
  voidReason: string | null;
  createdAt: IsoDateTime;
  createdBy: { id: string; fullName: string };
}

// Một đợt của tiến độ thanh toán kèm phần đã thu (tiền đổ vào đợt có hạn sớm nhất trước).
export interface PaymentInstallment {
  id: string;
  name: string;
  dueDate: IsoDateTime;
  amount: Vnd;
  isDeposit: boolean;
  sortOrder: number;
  paidAmount: Vnd;
  outstanding: Vnd;
  status: InstallmentStatus;
}

// payments/common.ts — loadProgress: GET /contracts/:id/payments và PUT /contracts/:id/installments.
export interface ContractPayments {
  contract: {
    id: string;
    code: string;
    status: ContractStatus;
    eventDate: IsoDateTime | null;
    confirmedAt: IsoDateTime | null;
    // Không có quyền customers.read: phone = null, phoneHidden = true.
    customer: { id: string; fullName: string; phone: string | null; phoneHidden: boolean };
  };
  summary: PaymentSummary;
  installments: PaymentInstallment[];
  installmentsTotal: Vnd;
  // null = chưa lập tiến độ. Khác 0 khi tổng hợp đồng đổi sau khi lập tiến độ — nhắc lập lại tiến độ.
  scheduleDifference: Vnd | null;
  // Mới nhất trước, kể cả phiếu đã huỷ.
  payments: Payment[];
}

export interface InstallmentInput {
  name: string;
  dueDate: IsoDateTime;
  amount: Vnd;
  isDeposit?: boolean;
}

// PUT thay toàn bộ tiến độ: tổng các đợt phải bằng ĐÚNG tổng hợp đồng, tối đa 1 đợt cọc, tối đa 24 đợt. [] = xoá tiến độ.
export interface InstallmentsInput {
  installments: InstallmentInput[];
}

export interface PaymentCreateInput {
  // Mặc định RECEIPT. REFUND cần quyền payments.void và không vượt số đã thu.
  kind?: PaymentKind;
  method: PaymentMethod;
  amount: Vnd;
  // Bỏ trống = bây giờ; không được ở tương lai.
  receivedAt?: IsoDateTime;
  note?: string;
  // Cho thu vượt tổng hợp đồng (khách trả thừa) — bắt buộc kèm note. Không gửi mà vượt → 409.
  allowOverpay?: boolean;
}

export interface VoidPaymentInput {
  reason: string;
}

// Ghi phiếu / huỷ phiếu: phiếu kèm hợp đồng và tóm tắt tiền SAU thao tác.
export interface PaymentResult extends Payment {
  contract: { id: string; code: string; status: ContractStatus };
  summary: PaymentSummary;
}

// Sổ thu theo kỳ [from, to), tối đa 366 ngày.
export interface PaymentLedgerQuery extends PagingQuery {
  from: IsoDateTime;
  to: IsoDateTime;
  method?: PaymentMethod;
  kind?: PaymentKind;
  contractId?: string;
}

export interface PaymentLedgerEntry extends Payment {
  contract: { id: string; code: string; customer: { id: string; fullName: string } };
}

export interface PaymentLedger extends Page<PaymentLedgerEntry> {
  // Trả nguyên chuỗi from/to đã gửi.
  from: IsoDateTime;
  to: IsoDateTime;
  // Tổng chỉ tính phiếu còn hiệu lực; danh sách vẫn có phiếu đã huỷ (voidedAt) để đối soát.
  // null = tổng vượt ngưỡng số nguyên an toàn (totalsOverflow = true) — giao diện hiện "—".
  totals: { received: Vnd | null; receiptCount: number; refunded: Vnd | null; refundCount: number; net: Vnd | null };
  // true = có tổng vượt ngưỡng số nguyên an toàn → ô đó null, giao diện hiện "—".
  totalsOverflow: boolean;
}

// payments/reports.ts — báo cáo doanh số theo kỳ [from, to).
// kind: theo loại hợp đồng; courseGroup / course: theo nhóm khoá / khoá (mỗi đồng của hợp đồng thuộc đúng một dòng).
export type RevenueGroupBy = 'month' | 'contract' | 'kind' | 'courseGroup' | 'course';

export interface RevenueQuery {
  from: IsoDateTime;
  to: IsoDateTime;
  // Lọc theo loại hợp đồng; bỏ trống = cả hai.
  kind?: ContractKind;
  // Mặc định month.
  groupBy?: RevenueGroupBy;
}

// Ô tiền null = vượt ngưỡng số nguyên an toàn (payments/reports.ts presentBucket → vndOrNull); totalsOverflow = true.
export interface RevenueBucket {
  contractCount: number;
  sales: Vnd | null;
  depositRequired: Vnd | null;
  depositOutstanding: Vnd | null;
  outstanding: Vnd | null;
  received: Vnd | null;
  refunded: Vnd | null;
  collected: Vnd | null;
}

// Lời giải thích cách tính từng chỉ số (máy chủ soạn, giao diện hiện nguyên văn).
export interface RevenueBasis {
  sales: string;
  depositRequired: string;
  collected: string;
  outstanding: string;
}

export interface RevenueMonthRow extends RevenueBucket {
  // YYYY-MM theo giờ Việt Nam.
  period: string;
}

export interface RevenueContractRow {
  contractId: string;
  code: string;
  kind: ContractKind;
  status: ContractStatus;
  customer: { id: string; fullName: string };
  // Khoá của các dòng khoá học còn hiệu lực (hợp đồng dịch vụ: []).
  courses: { id: string; code: string; name: string; groupId: string | null }[];
  confirmedAt: IsoDateTime | null;
  eventDate: IsoDateTime | null;
  // true = tính vào doanh số của kỳ; false = chỉ có tiền thu/hoàn trong kỳ.
  bookedInPeriod: boolean;
  // null = vượt ngưỡng số nguyên an toàn (totalsOverflow = true).
  total: Vnd | null;
  depositRequired: Vnd | null;
  paid: Vnd | null;
  paidInPeriod: Vnd | null;
  // Hợp đồng đã huỷ, hoặc một trong total/depositRequired/paid tràn → null.
  remaining: Vnd | null;
  depositOutstanding: Vnd | null;
}

// Dòng theo loại hợp đồng (groupBy=kind).
export interface RevenueKindRow extends RevenueBucket {
  kind: ContractKind;
}

// COURSE = phần của một khoá / nhóm khoá; COURSE_UNASSIGNED = hợp đồng khoá học không còn dòng khoá học nào;
// SERVICE = hợp đồng dịch vụ.
export type RevenueSegment = 'COURSE' | 'COURSE_UNASSIGNED' | 'SERVICE';

// Dòng theo nhóm khoá (groupBy=courseGroup). group = null: khoá chưa xếp nhóm, hoặc dòng không phải khoá học.
export interface RevenueCourseGroupRow extends RevenueBucket {
  segment: RevenueSegment;
  group: { id: string; name: string } | null;
}

// Dòng theo khoá (groupBy=course).
export interface RevenueCourseRow extends RevenueCourseGroupRow {
  course: { id: string; code: string; name: string } | null;
}

interface RevenueReportBase {
  from: IsoDateTime;
  to: IsoDateTime;
  // Bộ lọc loại hợp đồng đã áp (null = cả hai).
  kind: ContractKind | null;
  basis: RevenueBasis;
  totals: RevenueBucket;
  // true = có tổng vượt ngưỡng số nguyên an toàn → ô đó null, giao diện hiện "—".
  totalsOverflow: boolean;
}

export type RevenueReport =
  | (RevenueReportBase & { groupBy: 'month'; rows: RevenueMonthRow[] })
  | (RevenueReportBase & { groupBy: 'contract'; rows: RevenueContractRow[] })
  | (RevenueReportBase & { groupBy: 'kind'; rows: RevenueKindRow[] })
  // allocation: lời giải thích cách chia tiền một hợp đồng cho nhiều khoá (máy chủ soạn, hiện nguyên văn).
  | (RevenueReportBase & { groupBy: 'courseGroup'; allocation: string; rows: RevenueCourseGroupRow[] })
  | (RevenueReportBase & { groupBy: 'course'; allocation: string; rows: RevenueCourseRow[] });

// ======================= Hồ sơ thương hiệu (profile) =======================

// Một ca làm việc: weekday 1 (thứ Hai) … 7 (Chủ nhật); giờ HH:mm. Mỗi thứ tối đa 2 ca, không chồng nhau.
export interface WorkingShift {
  weekday: number;
  open: string;
  close: string;
}

// profile/images.ts — URL ảnh ký có hạn (10 phút).
export interface SignedImage {
  url: string;
  expiresAt: IsoDateTime;
}

// profile/routes.ts — presentProfile.
export interface BrandProfile {
  brandName: string;
  tagline: string | null;
  bio: string | null;
  experience: string | null;
  styles: string[];
  serviceArea: string | null;
  address: string | null;
  // Đã chuẩn hoá về 0xxxxxxxxx.
  phone: string | null;
  email: string | null;
  // Số điện thoại (đã chuẩn hoá) hoặc liên kết https://zalo.me/…
  zalo: string | null;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  website: string | null;
  logoFileId: string | null;
  avatarFileId: string | null;
  coverFileId: string | null;
  // Đã xếp theo thứ, giờ mở.
  workingHours: WorkingShift[];
  bookingPolicy: string | null;
  cancellationPolicy: string | null;
  depositPolicy: string | null;
  isPublished: boolean;
  publishedAt: IsoDateTime | null;
  updatedAt: IsoDateTime;
  // Tệp chưa sẵn sàng / đã xoá → null.
  logo: SignedImage | null;
  avatar: SignedImage | null;
  cover: SignedImage | null;
}

export type BrandProfileResult = { hasProfile: false; profile: null } | { hasProfile: true; profile: BrandProfile };

// PUT ghi TOÀN BỘ hồ sơ: trường không gửi = để trống. Liên kết mạng xã hội/website chỉ nhận https://.
// Xuất bản/gỡ dùng publishBrandProfile/unpublishBrandProfile (gửi isPublished ở đây là 400).
export interface BrandProfileInput {
  brandName: string;
  tagline?: string | null;
  bio?: string | null;
  experience?: string | null;
  styles?: string[];
  serviceArea?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  zalo?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  website?: string | null;
  // Tệp ảnh đã tải lên của tổ chức: logo = ORG_LOGO; avatar = ORG_LOGO/STAFF_AVATAR/ALBUM_IMAGE; cover = ORG_LOGO/ALBUM_IMAGE.
  logoFileId?: string | null;
  avatarFileId?: string | null;
  coverFileId?: string | null;
  workingHours?: WorkingShift[];
  bookingPolicy?: string | null;
  cancellationPolicy?: string | null;
  depositPolicy?: string | null;
}

// profile/public.ts — GET /public/sites/:slug (không cần đăng nhập): trang giới thiệu đã xuất bản.
export type PublicProfile = Omit<BrandProfile, 'logoFileId' | 'avatarFileId' | 'coverFileId' | 'isPublished' | 'updatedAt'>;

// Giá công khai: chỉ số tiền, không có mã phiên bản giá.
export interface PublicPrice {
  listPrice: Vnd;
  salePrice: Vnd | null;
  unitPrice: Vnd;
}

export interface PublicService {
  id: string;
  kind: ServiceKind;
  name: string;
  description: string | null;
  // null = phụ phí không có thời lượng.
  durationMinutes: number | null;
  // Tên danh mục.
  category: string | null;
  price: PublicPrice | null;
}

export interface PublicPackage {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  staffCount: number;
  subject: { id: string; name: string } | null;
  locationTypes: LocationType[];
  // Km miễn phí: riêng của gói, không có thì theo tổ chức; null = tổ chức chưa đặt chính sách phí di chuyển.
  includedKm: number | null;
  terms: string | null;
  price: PublicPrice | null;
  included: { name: string; quantity: number }[];
  addons: { serviceId: string; name: string; durationMinutes: number | null; quantity: number; price: PublicPrice | null }[];
}

export interface PublicSite {
  site: { name: string; slug: string; timezone: string };
  profile: PublicProfile;
  services: PublicService[];
  packages: PublicPackage[];
  subjects: { id: string; name: string }[];
  travel: { freeKm: number | null };
}
