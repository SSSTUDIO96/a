// Một dòng việc cần làm ở trang chủ: tên (mở chi tiết) · dòng phụ · bên phải chữ hạn + nút "Gia hạn".
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../../ui';
import { platformHref } from './PlatformNav';

export function TaskRow({
  id,
  name,
  sub,
  right,
  onRenew,
}: {
  id: string;
  name: string;
  sub: ReactNode;
  right: ReactNode;
  onRenew?: () => void;
}) {
  return (
    <div className="pf-task">
      <div className="pf-task__t">
        <Link className="pf-task__name" to={platformHref(`to-chuc/${encodeURIComponent(id)}`)}>
          {name}
        </Link>
        <div className="pf-task__sub">{sub}</div>
      </div>
      <div className="pf-task__r">
        <span className="pf-task__when">{right}</span>
        {onRenew ? (
          <Button size="sm" onClick={onRenew} aria-label={`Gia hạn ${name}`}>
            Gia hạn
          </Button>
        ) : null}
      </div>
    </div>
  );
}
