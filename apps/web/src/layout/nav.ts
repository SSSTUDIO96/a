import type { Permission } from '@makeup/shared';

// Bảng điều hướng DUY NHẤT của khung (bản vẽ C mục 2 và mục 6). Thanh trái, thanh dưới, ngăn "Thêm" và chặn đường
// theo quyền đều đọc bảng này. Mục chưa có màn (Tổng quan, Báo cáo) chưa đưa vào — có màn thì thêm một dòng.

export type NavIconName = 'lich' | 'hd' | 'gia' | 'khach' | 'tho' | 'cai-dat';

export interface NavChild {
  // Đường con, tương đối với /:orgSlug.
  path: string;
  label: string;
}

export interface NavItem {
  key: string;
  // Đường tương đối với /:orgSlug (cũng là đoạn đầu để biết mục đang chọn).
  path: string;
  label: string;
  // Chữ ngắn ở thanh dưới điện thoại.
  shortLabel: string;
  icon: NavIconName;
  permission: Permission;
  // Có ô riêng ở thanh dưới điện thoại; còn lại nằm trong ngăn "Thêm".
  inBottomNav: boolean;
  // Menu con — chỉ hiện dưới mục đang chọn (máy tính).
  children?: NavChild[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'lich', path: 'lich', label: 'Lịch makeup', shortLabel: 'Lịch', icon: 'lich', permission: 'schedule.read_own', inBottomNav: true },
  { key: 'hop-dong', path: 'hop-dong', label: 'Hợp đồng', shortLabel: 'Hợp đồng', icon: 'hd', permission: 'contracts.read', inBottomNav: true },
  {
    key: 'bang-gia',
    path: 'bang-gia',
    label: 'Bảng giá',
    shortLabel: 'Bảng giá',
    icon: 'gia',
    permission: 'catalog.read',
    inBottomNav: true,
    // Khoá nhóm cho đường /bang-gia/:nhom — gói W4 dùng đúng các khoá này.
    children: [
      { path: 'bang-gia/goi', label: 'Gói theo nhân vật' },
      { path: 'bang-gia/dich-vu', label: 'Dịch vụ phụ & phụ phí' },
      { path: 'bang-gia/di-chuyen', label: 'Phí di chuyển & studio' },
      { path: 'bang-gia/nhan-vat', label: 'Nhân vật' },
    ],
  },
  { key: 'khach-hang', path: 'khach-hang', label: 'Khách hàng', shortLabel: 'Khách', icon: 'khach', permission: 'customers.read', inBottomNav: true },
  { key: 'nhan-su', path: 'nhan-su', label: 'Thợ makeup', shortLabel: 'Thợ', icon: 'tho', permission: 'staff.read', inBottomNav: false },
  { key: 'cai-dat', path: 'cai-dat', label: 'Cài đặt', shortLabel: 'Cài đặt', icon: 'cai-dat', permission: 'org.update', inBottomNav: false },
];

export function visibleNav(has: (p: Permission) => boolean): NavItem[] {
  return NAV_ITEMS.filter((i) => has(i.permission));
}

// Mục ứng với đường hiện tại (đoạn đầu sau /:orgSlug).
export function activeNavItem(pathAfterOrg: string): NavItem | undefined {
  const first = pathAfterOrg.replace(/^\/+/, '').split('/')[0] ?? '';
  return NAV_ITEMS.find((i) => i.path === first);
}

// Mục mặc định khi vào /:orgSlug: mục đầu tiên người dùng được xem.
export function homeNavItem(has: (p: Permission) => boolean): NavItem | undefined {
  return visibleNav(has)[0];
}
