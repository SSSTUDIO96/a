import type { ReactElement } from 'react';
import { Link } from 'react-router';
import type { Me, MyOrganization } from '../api/auth';
import { ErrorNotice } from '../app/ErrorNotice';
import { Avatar, Skeleton, WithTooltip } from '../ui';
import type { NavChild, NavItem, VisibleNavItem } from './nav';
import { NavIcon } from './navIcons';
import { useSelfStaffAvatar } from '../features/staff/useStaffNaming';
import { OrgSwitcher } from './OrgSwitcher';
import { useBreakpoint } from './useBreakpoint';
import { useLogout } from './useLogout';

export interface SidebarProps {
  user: Me;
  org: MyOrganization;
  organizations: MyOrganization[];
  items: VisibleNavItem[];
  active: NavItem | undefined;
  activeChild: NavChild | undefined;
  loading: boolean;
}

// Thanh trái — bản vẽ C mục 2.1. Máy tính 240px có chữ và menu con; máy tính bảng 68px chỉ biểu tượng, tên ở tooltip.
export function Sidebar({ user, org, organizations, items, active, activeChild, loading }: SidebarProps) {
  const bp = useBreakpoint();
  const iconOnly = bp === 'tablet';
  const base = `/${org.slug}`;
  const roleName = org.roles.map((r) => r.name).join(', ');
  const { logout, pending, error } = useLogout();
  // L2: ảnh của chính mình cùng màu + chữ tắt với dòng của mình ở Thợ makeup, Lịch (sổ thợ chung, ui/staffName.ts).
  const { naming, selfInitials } = useSelfStaffAvatar(org.membershipId);

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
          <Avatar name={user.fullName} initials={selfInitials} colorKey={naming.colorKey(org.membershipId)} />
          <div className="sh-hide-t sh-user__txt">
            <span className="sh-user__name">{user.fullName}</span>
            {roleName ? <small>{roleName}</small> : null}
          </div>
        </div>
        <OrgSwitcher org={org} organizations={organizations} sectionPath={activeChild?.path ?? active?.path ?? ''} />
        <nav className="sh-menu" aria-label="Mục chính">
          {loading ? (
            <div className="sh-menu__skel" role="status" aria-label="Đang tải mục">
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </div>
          ) : (
            // Mục đang chọn tính theo nav.ts (activeNavItem), không theo đường của liên kết: /thu-tien thuộc "Hợp đồng",
            // mục chỉ có mục con (Báo cáo) trỏ tới mục con đầu tiên được xem.
            items.map((item) => {
              const on = active?.key === item.key;
              return (
                <div key={item.key} className="sh-menu__grp">
                  {label(
                    item.label,
                    <Link to={`${base}/${item.href}`} className={on ? 'sh-menu__a on' : 'sh-menu__a'} aria-current={on ? 'page' : undefined} aria-label={iconOnly ? item.label : undefined}>
                      <NavIcon name={item.icon} />
                      <span className="sh-hide-t">{item.label}</span>
                    </Link>,
                  )}
                  {item.children.length > 0 && on && !iconOnly ? (
                    <div className="sh-kids">
                      {item.children.map((c) => {
                        const kidOn = activeChild?.key === c.key;
                        return (
                          <Link key={c.key} to={`${base}/${c.path}`} className={kidOn ? 'sh-kids__a on' : 'sh-kids__a'} aria-current={kidOn ? 'page' : undefined}>
                            {c.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })
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
