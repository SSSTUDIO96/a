import { useEffect } from 'react';
import { Link, Navigate, NavLink, Outlet, useParams } from 'react-router';
import { LogoutButton } from '../components/LogoutButton';
import { useSession } from '../lib/session';

export const SECTIONS = [
  { path: 'lich', label: 'Lịch' },
  { path: 'bang-gia', label: 'Bảng giá' },
  { path: 'hop-dong', label: 'Hợp đồng' },
  { path: 'khach-hang', label: 'Khách hàng' },
  { path: 'nhan-su', label: 'Nhân sự' },
  { path: 'cai-dat', label: 'Cài đặt' },
] as const;

// Khung đã đăng nhập của một tổ chức. Chưa định kiểu — chờ bản vẽ thông số.
export function OrgShell() {
  const { orgSlug } = useParams();
  const { user, organizations, currentOrg, selectOrg } = useSession();
  const org = organizations.find((o) => o.slug === orgSlug);

  useEffect(() => {
    if (org && currentOrg?.id !== org.id) selectOrg(org.id);
  }, [org, currentOrg, selectOrg]);

  if (organizations.length === 0) return <Navigate to="/tao-to-chuc" replace />;
  if (!org) {
    return (
      <main>
        <p>Không tìm thấy tổ chức này, hoặc bạn không còn là thành viên.</p>
        <p>
          <Link to="/">Về tổ chức của bạn</Link>
        </p>
      </main>
    );
  }

  const others = organizations.filter((o) => o.id !== org.id);
  return (
    <div>
      <header>
        <p>
          {org.name} · {user?.fullName}
        </p>
        <nav aria-label="Mục chính">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.path}>
                <NavLink to={`/${org.slug}/${s.path}`}>{s.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {others.length > 0 ? (
          <nav aria-label="Tổ chức khác">
            <ul>
              {others.map((o) => (
                <li key={o.id}>
                  <Link to={`/${o.slug}/lich`}>{o.name}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <p>
          <Link to="/tao-to-chuc">Tạo tổ chức khác</Link>
        </p>
        <LogoutButton />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export function Placeholder() {
  return <p>Đang dựng</p>;
}

export function NotFound() {
  return (
    <main>
      <p>Không có trang này.</p>
      <p>
        <Link to="/">Về trang chính</Link>
      </p>
    </main>
  );
}
