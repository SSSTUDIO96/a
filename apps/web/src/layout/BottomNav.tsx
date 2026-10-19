import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import type { Me, MyOrganization } from '../api/auth';
import { ErrorNotice } from '../app/ErrorNotice';
import { Avatar, BottomSheet, Button } from '../ui';
import { activeBottomKey, bottomNav, type NavChild, type NavItem, type VisibleNavItem } from './nav';
import { NavIcon } from './navIcons';
import { useSelfStaffAvatar } from '../features/staff/useStaffNaming';
import { useLogout } from './useLogout';

export interface BottomNavProps {
  user: Me;
  org: MyOrganization;
  organizations: MyOrganization[];
  items: VisibleNavItem[];
  active: NavItem | undefined;
  activeChild: NavChild | undefined;
}

// Thanh dưới điện thoại — bản vẽ C mục 2.3, C3 mục 1.0: các ô theo loại tổ chức (nav.ts BOTTOM_NAV) và quyền + "Thêm"
// (mục còn lại, đổi tổ chức, đăng xuất).
export function BottomNav({ user, org, organizations, items, active, activeChild }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const { logout, pending, error } = useLogout();
  // L2: ảnh của chính mình cùng màu + chữ tắt với dòng của mình ở Thợ makeup, Lịch (sổ thợ chung, ui/staffName.ts).
  const { naming, selfInitials } = useSelfStaffAvatar(org.membershipId);
  const base = `/${org.slug}`;
  const { main, rest } = bottomNav(items, org.kind);
  const onKey = activeBottomKey(main, active, activeChild);
  const moreActive = active !== undefined && onKey === undefined;

  useEffect(() => setMoreOpen(false), [location.pathname]);

  return (
    <>
      <nav className="sh-bnav" aria-label="Mục chính (điện thoại)" style={{ gridTemplateColumns: `repeat(${main.length + 1}, 1fr)` }}>
        {main.map((i) => (
          <Link key={i.key} to={`${base}/${i.href}`} className={onKey === i.key ? 'sh-bnav__a on' : 'sh-bnav__a'} aria-current={onKey === i.key ? 'page' : undefined}>
            <NavIcon name={i.icon} />
            {i.shortLabel}
          </Link>
        ))}
        <button type="button" className={moreActive ? 'sh-bnav__a on' : 'sh-bnav__a'} aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
          <NavIcon name="more" />
          Thêm
        </button>
      </nav>
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Thêm">
        <div className="sh-more">
          {rest.length > 0 ? (
            <ul className="sh-more__list">
              {rest.map((i) => (
                <li key={i.key}>
                  <Link to={`${base}/${i.href}`} className={active?.key === i.key ? 'sh-more__a on' : 'sh-more__a'} aria-current={active?.key === i.key ? 'page' : undefined}>
                    <NavIcon name={i.icon} />
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="sh-more__cap">Tổ chức</p>
          <ul className="sh-more__list">
            {organizations.map((o) => (
              <li key={o.id}>
                <Link to={`/${o.slug}/${activeChild?.path ?? active?.path ?? ''}`} className={o.id === org.id ? 'sh-more__a on' : 'sh-more__a'} aria-current={o.id === org.id ? 'true' : undefined}>
                  <NavIcon name="swap" />
                  {o.name}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/tao-to-chuc" className="sh-more__a">
                <NavIcon name="swap" />+ Tạo tổ chức khác
              </Link>
            </li>
          </ul>
          <div className="sh-more__user">
            <Avatar name={user.fullName} initials={selfInitials} colorKey={naming.colorKey(org.membershipId)} size="sm" />
            <span className="sh-more__name">{user.fullName}</span>
            <Button size="sm" icon={<NavIcon name="logout" />} loading={pending} onClick={logout}>
              Đăng xuất
            </Button>
          </div>
          <ErrorNotice error={error} />
        </div>
      </BottomSheet>
    </>
  );
}
