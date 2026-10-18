import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import type { MyOrganization } from '../api/auth';
import { NavIcon } from './navIcons';

// Tên tổ chức đang mở + danh sách đổi tổ chức (thanh trái). Đổi tổ chức giữ nguyên mục đang xem nếu có.
export function OrgSwitcher({ org, organizations, sectionPath }: { org: MyOrganization; organizations: MyOrganization[]; sectionPath: string }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="sh-org" ref={boxRef}>
      <button
        type="button"
        className="sh-org__btn"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Tổ chức: ${org.name}. Đổi tổ chức`}
        title={org.name}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sh-org__badge" aria-hidden="true">
          {org.name.trim().charAt(0).toLocaleUpperCase('vi')}
        </span>
        <span className="sh-org__name sh-hide-t">{org.name}</span>
        <NavIcon name="down" className="ui-ico sh-hide-t" />
      </button>
      {open ? (
        <div className="sh-org__list" id={listId}>
          <p className="sh-org__cap">Tổ chức của bạn</p>
          <ul>
            {organizations.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/${o.slug}/${sectionPath}`}
                  className={o.id === org.id ? 'sh-org__item on' : 'sh-org__item'}
                  aria-current={o.id === org.id ? 'true' : undefined}
                >
                  {o.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/tao-to-chuc" className="sh-org__item sh-org__new">
            + Tạo tổ chức khác
          </Link>
        </div>
      ) : null}
    </div>
  );
}
