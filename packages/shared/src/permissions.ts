// Danh mục quyền là nguồn sự thật duy nhất. Database chỉ lưu khoá quyền;
// máy chủ từ chối mọi khoá không có trong danh mục này.
export const PERMISSIONS = {
  'org.read': 'Xem thông tin tổ chức',
  'org.update': 'Sửa thông tin tổ chức',
  'members.read': 'Xem danh sách nhân sự',
  'members.invite': 'Thêm nhân sự',
  'members.update': 'Đổi vai trò, trạng thái nhân sự',
  'members.remove': 'Cho nhân sự rời tổ chức',
  'roles.read': 'Xem vai trò',
  'roles.manage': 'Tạo, sửa vai trò tuỳ chỉnh',
  'audit.read': 'Xem nhật ký thay đổi',
  'catalog.read': 'Xem dịch vụ, gói, bảng giá',
  'catalog.write': 'Thêm, sửa dịch vụ và gói',
  'prices.write': 'Đổi giá',
  'customers.read': 'Xem khách hàng',
  'customers.write': 'Thêm, sửa khách hàng',
  'schedule.read_own': 'Xem lịch mình được phân',
  'schedule.read_all': 'Xem lịch cả tổ chức',
  'schedule.write': 'Tạo, sửa, đổi trạng thái lịch',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

export type SystemRoleKey =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'artist'
  | 'assistant'
  | 'receptionist'
  | 'accountant'
  | 'instructor'
  | 'teaching_assistant';

// Vai trò mẫu được chép vào mỗi tổ chức lúc tạo. Sau đó tổ chức tự quản.
export const SYSTEM_ROLES: Record<SystemRoleKey, { name: string; permissions: Permission[] }> = {
  owner: { name: 'Chủ tài khoản', permissions: ALL_PERMISSIONS },
  admin: { name: 'Quản trị', permissions: ALL_PERMISSIONS },
  manager: {
    name: 'Quản lý',
    permissions: [
      'org.read', 'members.read', 'members.invite', 'members.update', 'roles.read',
      'catalog.read', 'catalog.write', 'prices.write', 'customers.read', 'customers.write',
      'schedule.read_own', 'schedule.read_all', 'schedule.write',
    ],
  },
  artist: { name: 'Thợ makeup', permissions: ['org.read', 'members.read', 'catalog.read', 'schedule.read_own'] },
  assistant: { name: 'Thợ phụ', permissions: ['org.read', 'members.read', 'catalog.read', 'schedule.read_own'] },
  receptionist: {
    name: 'Lễ tân',
    permissions: [
      'org.read', 'members.read', 'catalog.read', 'customers.read', 'customers.write',
      'schedule.read_own', 'schedule.read_all', 'schedule.write',
    ],
  },
  accountant: {
    name: 'Kế toán',
    permissions: ['org.read', 'members.read', 'audit.read', 'catalog.read', 'customers.read', 'schedule.read_own', 'schedule.read_all'],
  },
  instructor: { name: 'Giảng viên', permissions: ['org.read', 'members.read', 'catalog.read', 'schedule.read_own'] },
  teaching_assistant: { name: 'Trợ giảng', permissions: ['org.read', 'schedule.read_own'] },
};

export const SYSTEM_ROLE_KEYS = Object.keys(SYSTEM_ROLES) as SystemRoleKey[];
