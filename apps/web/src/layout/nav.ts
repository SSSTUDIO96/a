import type { Permission } from '@makeup/shared';
import type { OrgKind } from '../api/auth';

// Bảng điều hướng DUY NHẤT của khung (bản vẽ C mục 2, 6; C2 mục 1.1, 3.1, 4.1; C3 mục 1.0). Thanh trái, thanh dưới,
// ngăn "Thêm" và chặn đường theo quyền đều đọc bảng này.
// Mục chưa có màn (Tổng quan, Đào tạo, Mẫu thiết kế) CHƯA đưa vào — bày ra được thì phải dùng được. Có màn thì thêm
// MỘT dòng vào NAV_ITEMS (khoá đã đặt sẵn: 'dao-tao', 'mau-thiet-ke'); thanh dưới ACADEMY tự nhận ô "Khoá học".
//   { key: 'dao-tao', path: 'dao-tao', label: 'Đào tạo', shortLabel: 'Khoá học', icon: 'khoa-hoc', permission: 'courses.read', orgKinds: ['ACADEMY'] },
//   { key: 'mau-thiet-ke', path: 'mau-thiet-ke', label: 'Mẫu thiết kế', shortLabel: 'Mẫu', icon: 'mau', permission: 'designs.read' },

export type NavIconName = 'hom-nay' | 'lich' | 'hd' | 'thu-tien' | 'gia' | 'khach' | 'tho' | 'bao-cao' | 'khoa-hoc' | 'mau' | 'cai-dat';

export interface NavChild {
  key: string;
  // Đường con, tương đối với /:orgSlug. Mục con đang chọn = mục con có đường dài nhất là tiền tố của đường hiện tại.
  path: string;
  label: string;
  // Quyền riêng của mục con; thiếu → dùng quyền của mục cha.
  permission?: Permission;
  // Chữ trên dải 403 khi vào thẳng đường không có quyền (mặc định "Bạn không có quyền xem {label}.").
  forbidden?: string;
}

export interface NavItem {
  key: string;
  // Đường mặc định của mục, tương đối với /:orgSlug (cũng là đoạn đầu để biết mục đang chọn).
  path: string;
  label: string;
  // Chữ ngắn ở thanh dưới điện thoại.
  shortLabel: string;
  icon: NavIconName;
  // Quyền của mục. Mục hiện khi có quyền này HOẶC có ít nhất một mục con được thấy; thiếu → chỉ xét mục con.
  permission?: Permission;
  // Đoạn đầu đường khác cũng thuộc mục này (vd /thu-tien thuộc "Hợp đồng").
  sections?: readonly string[];
  // Chỉ hiện ở các loại tổ chức này; thiếu → mọi loại.
  orgKinds?: readonly OrgKind[];
  // Menu con — chỉ hiện dưới mục đang chọn (máy tính).
  children?: readonly NavChild[];
  // Mục đã vào bảng nhưng màn CHƯA có (gói khác đang làm): ẩn khỏi mọi thanh điều hướng — bày ra mà bấm vào 404 là nút chết.
  // Chặn đường theo quyền (navEntryAllowed) vẫn tính mục này, nên màn mới chỉ cần thêm đường. Có màn → xoá cờ (một dòng).
  pending?: true;
  // Không làm trang mở đầu của /:orgSlug (ký duyệt D câu 1: Lịch vẫn là trang mở đầu). Bỏ cờ này = Hôm nay thành trang
  // mở đầu (lùi bằng một dòng). Vẫn là mục đầu thanh bên và nằm trong ngăn "Thêm" ở điện thoại.
  notHome?: true;
}

export const NAV_ITEMS: readonly NavItem[] = [
  // Bản vẽ D mục 3.0 + ký duyệt D câu 1: MỤC ĐẦU thanh bên máy tính; ở điện thoại nằm trong ngăn "Thêm" (BOTTOM_NAV không đổi).
  // pending: màn /hom-nay thuộc gói W1 (app/routes.tsx) — W1 xong thì xoá `pending: true`.
  { key: 'hom-nay', path: 'hom-nay', label: 'Hôm nay', shortLabel: 'Hôm nay', icon: 'hom-nay', permission: 'org.read', notHome: true },
  { key: 'lich', path: 'lich', label: 'Lịch makeup', shortLabel: 'Lịch', icon: 'lich', permission: 'schedule.read_own' },
  {
    key: 'hop-dong',
    path: 'hop-dong',
    label: 'Hợp đồng',
    shortLabel: 'Hợp đồng',
    icon: 'hd',
    permission: 'contracts.read',
    sections: ['thu-tien'],
    children: [
      { key: 'hop-dong-moi', path: 'hop-dong/moi', label: 'Lập hợp đồng', permission: 'contracts.write', forbidden: 'Bạn không có quyền lập hợp đồng.' },
      { key: 'hop-dong-ds', path: 'hop-dong', label: 'Danh sách hợp đồng', permission: 'contracts.read', forbidden: 'Bạn không có quyền xem hợp đồng.' },
      { key: 'thu-tien', path: 'thu-tien', label: 'Thu tiền', permission: 'payments.read' },
    ],
  },
  {
    key: 'bang-gia',
    path: 'bang-gia',
    label: 'Bảng giá',
    shortLabel: 'Bảng giá',
    icon: 'gia',
    permission: 'catalog.read',
    // Khoá nhóm cho đường /bang-gia/:nhom — gói W4 dùng đúng các khoá này.
    children: [
      { key: 'bang-gia-goi', path: 'bang-gia/goi', label: 'Gói theo nhân vật' },
      { key: 'bang-gia-dich-vu', path: 'bang-gia/dich-vu', label: 'Dịch vụ phụ & phụ phí' },
      { key: 'bang-gia-di-chuyen', path: 'bang-gia/di-chuyen', label: 'Phí di chuyển & studio' },
      { key: 'bang-gia-nhan-vat', path: 'bang-gia/nhan-vat', label: 'Nhân vật' },
    ],
  },
  { key: 'khach-hang', path: 'khach-hang', label: 'Khách hàng', shortLabel: 'Khách', icon: 'khach', permission: 'customers.read' },
  {
    key: 'nhan-su',
    path: 'nhan-su',
    label: 'Thợ makeup',
    shortLabel: 'Thợ',
    icon: 'tho',
    permission: 'staff.read',
    children: [
      { key: 'tho-bac', path: 'nhan-su', label: 'Thợ & bậc lương', permission: 'staff.read', forbidden: 'Bạn không có quyền xem thợ makeup.' },
      { key: 'tien-cong', path: 'nhan-su/tien-cong', label: 'Tiền công theo gói', permission: 'payroll.read' },
    ],
  },
  {
    key: 'bao-cao',
    path: 'bao-cao',
    label: 'Báo cáo',
    shortLabel: 'Báo cáo',
    icon: 'bao-cao',
    children: [
      { key: 'doanh-thu', path: 'bao-cao/doanh-thu', label: 'Doanh thu', permission: 'reports.read' },
      { key: 'so-thu', path: 'bao-cao/so-thu', label: 'Sổ thu', permission: 'payments.read' },
    ],
  },
  { key: 'dao-tao', path: 'dao-tao', label: 'Đào tạo', shortLabel: 'Khoá học', icon: 'khoa-hoc', permission: 'courses.read', orgKinds: ['ACADEMY'] },
  { key: 'mau-thiet-ke', path: 'mau-thiet-ke', label: 'Mẫu thiết kế', shortLabel: 'Mẫu', icon: 'mau', permission: 'designs.read' },
  {
    key: 'cai-dat',
    path: 'cai-dat',
    label: 'Cài đặt',
    shortLabel: 'Cài đặt',
    icon: 'cai-dat',
    permission: 'org.update',
    children: [{ key: 'thuong-hieu', path: 'cai-dat/thuong-hieu', label: 'Hồ sơ thương hiệu' }],
  },
];

// Hai mục con Bảng giá của bản vẽ D mục 3.0 (đặt cạnh "Nhân vật" và "Dịch vụ phụ & phụ phí": cùng loại dữ liệu, cùng quyền
// catalog.*). CHƯA nằm trong NAV_ITEMS: features/pricing/logic.ts (gói W2) dựng PRICING_GROUPS từ children của 'bang-gia' và
// NÉM LỖI khi gặp nhóm lạ — thêm vào đây trước khi W2 sửa logic.ts + index.tsx là làm sập cả ứng dụng. W2 xong thì chuyển
// hai dòng này vào children của 'bang-gia' (và xoá hằng này).
export const PENDING_BANG_GIA_CHILDREN: readonly NavChild[] = [
  { key: 'bang-gia-su-kien', path: 'bang-gia/su-kien', label: 'Loại sự kiện' },
  { key: 'bang-gia-luat-phu-phi', path: 'bang-gia/luat-phu-phi', label: 'Luật phụ phí' },
];

// Thanh dưới điện thoại theo loại tổ chức (C3 mục 1.0; nhật ký quyết định 19:42). Mỗi ô trỏ tới khoá của một mục
// hoặc một mục con; ô trỏ tới mục chưa có trong NAV_ITEMS (chưa có màn) hoặc người xem không được thấy thì không hiện.
// Ô cuối luôn là "Thêm" (mục còn lại, đổi tổ chức, đăng xuất).
export interface BottomSlot {
  key: string;
  shortLabel: string;
  icon: NavIconName;
}

export const BOTTOM_NAV: Record<'ACADEMY' | 'DEFAULT', readonly BottomSlot[]> = {
  ACADEMY: [
    { key: 'lich', shortLabel: 'Lịch', icon: 'lich' },
    { key: 'hop-dong', shortLabel: 'Hợp đồng', icon: 'hd' },
    { key: 'thu-tien', shortLabel: 'Thu tiền', icon: 'thu-tien' },
    { key: 'dao-tao', shortLabel: 'Khoá học', icon: 'khoa-hoc' },
  ],
  // INDIVIDUAL, TEAM — bản vẽ C mục 2.3.
  DEFAULT: [
    { key: 'lich', shortLabel: 'Lịch', icon: 'lich' },
    { key: 'hop-dong', shortLabel: 'Hợp đồng', icon: 'hd' },
    { key: 'bang-gia', shortLabel: 'Bảng giá', icon: 'gia' },
    { key: 'khach-hang', shortLabel: 'Khách', icon: 'khach' },
  ],
};

type Has = (p: Permission) => boolean;

// Bảng điều hướng sau khi đã (hoặc chưa) tính các mục chờ màn. includePending chỉ dành cho bài thử / kiểm tra "sau khi
// các gói web xong": thêm mục `pending` và hai mục con Bảng giá chờ.
function navSource(includePending: boolean): readonly NavItem[] {
  if (!includePending) return NAV_ITEMS.filter((i) => i.pending !== true);
  return NAV_ITEMS.map((i) => (i.key === 'bang-gia' ? { ...i, children: [...(i.children ?? []), ...PENDING_BANG_GIA_CHILDREN] } : i));
}

// Mục đã lọc theo quyền: chỉ còn mục con được thấy; href = đường mặc định (mục con đầu tiên được thấy nếu thiếu quyền mục).
export interface VisibleNavItem extends NavItem {
  href: string;
  children: readonly NavChild[];
}

export function childAllowed(item: NavItem, child: NavChild, has: Has): boolean {
  const p = child.permission ?? item.permission;
  return p !== undefined && has(p);
}

function kindAllowed(item: NavItem, kind: OrgKind | undefined): boolean {
  return item.orgKinds === undefined || (kind !== undefined && item.orgKinds.includes(kind));
}

export function visibleNav(has: Has, kind?: OrgKind, opts: { includePending?: boolean } = {}): VisibleNavItem[] {
  const out: VisibleNavItem[] = [];
  for (const item of navSource(opts.includePending === true)) {
    if (!kindAllowed(item, kind)) continue;
    const children = (item.children ?? []).filter((c) => childAllowed(item, c, has));
    const own = item.permission !== undefined && has(item.permission);
    if (!own && children.length === 0) continue;
    out.push({ ...item, children, href: own ? item.path : (children[0]?.path ?? item.path) });
  }
  return out;
}

function firstSegment(path: string): string {
  return path.replace(/^\/+/, '').split('/')[0] ?? '';
}

function underPath(pathAfterOrg: string, path: string): boolean {
  const p = pathAfterOrg.replace(/^\/+|\/+$/g, '');
  return p === path || p.startsWith(`${path}/`);
}

// Mục ứng với đường hiện tại (đoạn đầu sau /:orgSlug, gồm cả `sections`).
export function activeNavItem(pathAfterOrg: string): NavItem | undefined {
  const first = firstSegment(pathAfterOrg);
  return NAV_ITEMS.find((i) => i.path === first || (i.sections ?? []).includes(first));
}

// Mục con ứng với đường hiện tại: đường dài nhất là tiền tố (vd /hop-dong/moi → Lập hợp đồng; /hop-dong/:id → Danh sách).
export function activeNavChild(item: NavItem | undefined, pathAfterOrg: string): NavChild | undefined {
  let best: NavChild | undefined;
  for (const c of item?.children ?? []) {
    if (underPath(pathAfterOrg, c.path) && (!best || c.path.length > best.path.length)) best = c;
  }
  return best;
}

// Mục hoặc mục con theo khoá (cho chặn đường theo quyền).
export function findNavEntry(key: string): { item: NavItem; child?: NavChild } | undefined {
  for (const item of NAV_ITEMS) {
    if (item.key === key) return { item };
    const child = item.children?.find((c) => c.key === key);
    if (child) return { item, child };
  }
  return undefined;
}

// Người xem có được vào mục/mục con này không (mục: có quyền mục hoặc có mục con được thấy).
// Chặn đường chỉ xét QUYỀN: mục chờ màn (pending) vẫn được tính để màn mới vào là chạy, không cần sửa lại chỗ này.
export function navEntryAllowed(key: string, has: Has, kind?: OrgKind): boolean {
  const e = findNavEntry(key);
  if (!e || !kindAllowed(e.item, kind)) return false;
  if (e.child) return childAllowed(e.item, e.child, has);
  return visibleNav(has, kind, { includePending: true }).some((i) => i.key === e.item.key);
}

export interface BottomNavEntry {
  key: string;
  shortLabel: string;
  icon: NavIconName;
  href: string;
  // Khoá mục (thanh trái) của ô — để biết mục nào còn lại cho ngăn "Thêm".
  itemKey: string;
  // Ô trỏ tới một mục con (vd Thu tiền) thì key là khoá mục con.
  childKey?: string;
}

export function bottomNav(visible: readonly VisibleNavItem[], kind: OrgKind | undefined): { main: BottomNavEntry[]; rest: VisibleNavItem[] } {
  const slots = BOTTOM_NAV[kind === 'ACADEMY' ? 'ACADEMY' : 'DEFAULT'];
  const main: BottomNavEntry[] = [];
  for (const s of slots) {
    for (const item of visible) {
      if (item.key === s.key) {
        main.push({ key: s.key, shortLabel: s.shortLabel, icon: s.icon, href: item.href, itemKey: item.key });
        break;
      }
      const child = item.children.find((c) => c.key === s.key);
      if (child) {
        main.push({ key: s.key, shortLabel: s.shortLabel, icon: s.icon, href: child.path, itemKey: item.key, childKey: child.key });
        break;
      }
    }
  }
  // Mục chỉ được thấy nhờ một mục con đã có ô riêng (vd chỉ có payments.read) → bỏ ô mục, tránh hai ô cùng một đường.
  const childHrefs = new Set(main.filter((m) => m.childKey !== undefined).map((m) => m.href));
  for (let i = main.length - 1; i >= 0; i--) {
    const m = main[i];
    if (m && m.childKey === undefined && childHrefs.has(m.href)) main.splice(i, 1);
  }
  // Mục nào đã có ô (ô trỏ thẳng tới mục) thì không lặp lại trong "Thêm".
  const taken = new Set(main.filter((m) => m.childKey === undefined).map((m) => m.itemKey));
  return { main, rest: visible.filter((i) => !taken.has(i.key)) };
}

// Ô đang chọn ở thanh dưới: ô trỏ tới mục con đang chọn thắng ô trỏ tới mục cha (ACADEMY: /thu-tien → "Thu tiền").
export function activeBottomKey(main: readonly BottomNavEntry[], active: NavItem | undefined, activeChild: NavChild | undefined): string | undefined {
  if (!active) return undefined;
  if (activeChild) {
    const byChild = main.find((m) => m.childKey === activeChild.key);
    if (byChild) return byChild.key;
  }
  return main.find((m) => m.childKey === undefined && m.itemKey === active.key)?.key;
}

// Mục mặc định khi vào /:orgSlug: mục đầu tiên người dùng được xem, trừ mục `notHome` (Hôm nay — Lịch vẫn là trang mở
// đầu, ký duyệt D câu 1). Chỉ còn mục `notHome` thì dùng nó (người chỉ có org.read vẫn vào được Hôm nay).
export function homeNavItem(has: Has, kind?: OrgKind, opts: { includePending?: boolean } = {}): VisibleNavItem | undefined {
  const items = visibleNav(has, kind, opts);
  return items.find((i) => i.notHome !== true) ?? items[0];
}
