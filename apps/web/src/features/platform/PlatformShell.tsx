// Khung riêng của trang quản trị nền tảng (bản vẽ C2 mục 5.2): cùng token và cùng lớp CSS khung với app studio
// (src/layout/layout.css), khác menu — 3 mục Trang chủ · Tổ chức · Gói cước; điện thoại: thanh dưới 3 ô, không có "Thêm".
// KHÔNG dùng AppShell / nav.ts của tổ chức.
import { useContext, useLayoutEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ErrorNotice } from '../../app/ErrorNotice';
import { useSession } from '../../app/session';
import { OfflineBanner } from '../../layout/ErrorStates';
import { NavIcon } from '../../layout/navIcons';
import { ShellHeaderContext, type ShellHeader } from '../../layout/PageHeader';
import { TopBar } from '../../layout/TopBar';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { useLogout } from '../../layout/useLogout';
import { Avatar, Button, WithTooltip } from '../../ui';
import { PlatformIcon } from './icons';
import { activePlatformItem, PLATFORM_NAV, platformHref } from './PlatformNav';
import '../../layout/layout.css';
import './platform.css';

export function PlatformShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const location = useLocation();
  const bp = useBreakpoint();
  const iconOnly = bp === 'tablet';
  const active = activePlatformItem(location.pathname);
  const [header, setHeader] = useState<ShellHeader | null>(null);
  const { logout, pending, error } = useLogout();

  const label = (text: string, node: ReactElement) =>
    iconOnly ? (
      <WithTooltip text={text} className="sh-tipwrap">
        {node}
      </WithTooltip>
    ) : (
      node
    );

  // Điện thoại không có ngăn "Thêm": nút đăng xuất nằm bên phải thanh trên ở các màn gốc.
  const phoneLogout = (
    <Button variant="ghost" size="sm" icon={<NavIcon name="logout" />} aria-label="Đăng xuất" loading={pending} onClick={logout} />
  );

  return (
    <ShellHeaderContext.Provider value={setHeader}>
      <div className="sh pf-shell">
        <div className="sh-sidecol">
          <aside className="sh-side" aria-label="Thanh điều hướng">
            <div className="sh-brand">
              <NavIcon name="brand" />
              <span className="sh-hide-t">Quản trị nền tảng</span>
            </div>
            {user ? (
              <div className="sh-user">
                <Avatar name={user.fullName} colorKey={user.id} />
                <div className="sh-hide-t sh-user__txt">
                  <span className="sh-user__name">{user.fullName}</span>
                  <small>Quản trị nền tảng</small>
                </div>
              </div>
            ) : null}
            <nav className="sh-menu" aria-label="Mục chính">
              {PLATFORM_NAV.map((item) => {
                const on = active?.key === item.key;
                return (
                  <div key={item.key} className="sh-menu__grp">
                    {label(
                      item.label,
                      <Link
                        to={platformHref(item.path)}
                        className={on ? 'sh-menu__a on' : 'sh-menu__a'}
                        aria-current={on ? 'page' : undefined}
                        aria-label={iconOnly ? item.label : undefined}
                      >
                        <PlatformIcon name={item.icon} />
                        <span className="sh-hide-t">{item.label}</span>
                      </Link>,
                    )}
                  </div>
                );
              })}
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
        <div className="sh-body">
          <TopBar
            title={header?.title ?? active?.label ?? 'Quản trị nền tảng'}
            backTo={header?.backTo}
            action={header?.phoneAction ?? (header?.backTo ? undefined : phoneLogout)}
          />
          <OfflineBanner />
          <main className="sh-main">{children}</main>
        </div>
        <nav className="sh-bnav pf-bnav" aria-label="Mục chính (điện thoại)">
          {PLATFORM_NAV.map((item) => {
            const on = active?.key === item.key;
            return (
              <Link key={item.key} to={platformHref(item.path)} className={on ? 'sh-bnav__a on' : 'sh-bnav__a'} aria-current={on ? 'page' : undefined}>
                <PlatformIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </ShellHeaderContext.Provider>
  );
}

export interface PlatformHeaderProps {
  /** h1 trên máy tính / máy tính bảng. */
  title: ReactNode;
  /** Tiêu đề thanh trên điện thoại (mặc định = title). */
  phoneTitle?: ReactNode;
  /** Chữ phụ cạnh h1, ví dụ "số liệu lúc …". */
  sub?: ReactNode;
  actions?: ReactNode;
  /** Màn con trên điện thoại: đường quay lại. */
  backTo?: string;
  /** Một nút ở thanh trên điện thoại. */
  phoneAction?: ReactNode;
}

/** Tiêu đề trang: h1 (+ chữ phụ, nút bên phải); trên điện thoại đẩy tiêu đề và nút lên thanh trên. */
export function PlatformHeader({ title, phoneTitle, sub, actions, backTo, phoneAction }: PlatformHeaderProps) {
  const setHeader = useContext(ShellHeaderContext);
  const shown = phoneTitle ?? title;
  useLayoutEffect(() => {
    setHeader?.({ title: shown, backTo, phoneAction });
    return () => setHeader?.(null);
  }, [setHeader, shown, backTo, phoneAction]);
  return (
    <div className="sh-ph pf-ph">
      <h1>{title}</h1>
      {sub ? <span className="pf-ph__sub">{sub}</span> : null}
      <span className="sh-ph__sp" />
      {actions}
    </div>
  );
}
