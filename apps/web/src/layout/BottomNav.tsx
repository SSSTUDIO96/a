import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import type { Me, MyOrganization } from '../api/auth';
import { ErrorNotice } from '../app/ErrorNotice';
import { Avatar, BottomSheet, Button } from '../ui';
import type { NavItem } from './nav';
import { NavIcon } from './navIcons';
import { useLogout } from './useLogout';

export interface BottomNavProps {
  user: Me;
  org: MyOrganization;
  organizations: MyOrganization[];
  items: NavItem[];
  active: NavItem | undefined;
}

// Thanh dưới điện thoại — bản vẽ C mục 2.3: các mục chính theo quyền + "Thêm" (mục còn lại, đổi tổ chức, đăng xuất).
export function BottomNav({ user, org, organizations, items, active }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const { logout, pending, error } = useLogout();
  const base = `/${org.slug}`;
  const main = items.filter((i) => i.inBottomNav);
  const rest = items.filter((i) => !i.inBottomNav);
  const moreActive = active !== undefined && !active.inBottomNav;

  useEffect(() => setMoreOpen(false), [location.pathname]);

  return (
    <>
      <nav className="sh-bnav" aria-label="Mục chính (điện thoại)" style={{ gridTemplateColumns: `repeat(${main.length + 1}, 1fr)` }}>
        {main.map((i) => (
          <NavLink key={i.key} to={`${base}/${i.path}`} className={({ isActive }) => (isActive ? 'sh-bnav__a on' : 'sh-bnav__a')}>
            <NavIcon name={i.icon} />
            {i.shortLabel}
          </NavLink>
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
                  <NavLink to={`${base}/${i.path}`} className={({ isActive }) => (isActive ? 'sh-more__a on' : 'sh-more__a')}>
                    <NavIcon name={i.icon} />
                    {i.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="sh-more__cap">Tổ chức</p>
          <ul className="sh-more__list">
            {organizations.map((o) => (
              <li key={o.id}>
                <Link to={`/${o.slug}/${active?.path ?? ''}`} className={o.id === org.id ? 'sh-more__a on' : 'sh-more__a'} aria-current={o.id === org.id ? 'true' : undefined}>
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
            <Avatar name={user.fullName} colorKey={org.membershipId} size="sm" />
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
