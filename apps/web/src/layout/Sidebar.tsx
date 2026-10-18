import type { ReactElement } from 'react';
import { NavLink } from 'react-router';
import type { Me, MyOrganization } from '../api/auth';
import { ErrorNotice } from '../app/ErrorNotice';
import { Avatar, Skeleton, WithTooltip } from '../ui';
import type { NavItem } from './nav';
import { NavIcon } from './navIcons';
import { OrgSwitcher } from './OrgSwitcher';
import { useBreakpoint } from './useBreakpoint';
import { useLogout } from './useLogout';

export interface SidebarProps {
  user: Me;
  org: MyOrganization;
  organizations: MyOrganization[];
  items: NavItem[];
  active: NavItem | undefined;
  loading: boolean;
}

// Thanh trái — bản vẽ C mục 2.1. Máy tính 240px có chữ và menu con; máy tính bảng 68px chỉ biểu tượng, tên ở tooltip.
export function Sidebar({ user, org, organizations, items, active, loading }: SidebarProps) {
  const bp = useBreakpoint();
  const iconOnly = bp === 'tablet';
  const base = `/${org.slug}`;
  const roleName = org.roles.map((r) => r.name).join(', ');
  const { logout, pending, error } = useLogout();

  const label = (text: string, node: ReactElement) =>
    iconOnly ? (
      <WithTooltip text={text} className="sh-tipwrap">
        {node}
      </WithTooltip>
    ) : (
      node
    );

  return (
    <div className="sh-sidecol">
      <aside className="sh-side" aria-label="Thanh điều hướng">
        <div className="sh-brand">
          <NavIcon name="brand" />
          <span className="sh-hide-t">Makeup Pro</span>
        </div>
        <div className="sh-user">
          <Avatar name={user.fullName} colorKey={org.membershipId} />
          <div className="sh-hide-t sh-user__txt">
            <span className="sh-user__name">{user.fullName}</span>
            {roleName ? <small>{roleName}</small> : null}
          </div>
        </div>
        <OrgSwitcher org={org} organizations={organizations} sectionPath={active?.path ?? ''} />
        <nav className="sh-menu" aria-label="Mục chính">
          {loading ? (
            <div className="sh-menu__skel" role="status" aria-label="Đang tải mục">
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </div>
          ) : (
            items.map((item) => (
              <div key={item.key} className="sh-menu__grp">
                {label(
                  item.label,
                  <NavLink to={`${base}/${item.path}`} className={({ isActive }) => (isActive ? 'sh-menu__a on' : 'sh-menu__a')} aria-label={iconOnly ? item.label : undefined}>
                    <NavIcon name={item.icon} />
                    <span className="sh-hide-t">{item.label}</span>
                  </NavLink>,
                )}
                {item.children && active?.key === item.key && !iconOnly ? (
                  <div className="sh-kids">
                    {item.children.map((c) => (
                      <NavLink key={c.path} to={`${base}/${c.path}`} className={({ isActive }) => (isActive ? 'sh-kids__a on' : 'sh-kids__a')}>
                        {c.label}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </nav>
        <div className="sh-foot">
          {label(
            'Đăng xuất',
            <button type="button" className="sh-menu__a sh-logout" onClick={logout} disabled={pending} aria-label={iconOnly ? 'Đăng xuất' : undefined}>
              <NavIcon name="logout" />
              <span className="sh-hide-t">{pending ? 'Đang đăng xuất…' : 'Đăng xuất'}</span>
            </button>,
          )}
          {error ? (
            <div className="sh-foot__err">
              <ErrorNotice error={error} />
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
