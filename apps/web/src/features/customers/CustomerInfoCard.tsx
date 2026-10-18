import type { Customer } from '../../api/types';
import { Avatar, Button } from '../../ui';
import { formatDateIn, formatPhone } from './logic';

// Thẻ "Thông tin khách" (C2 2.2): ảnh 32 · họ tên 20/700 · "Sửa"; bảng nhãn – giá trị. Trống hiện "—".
export function CustomerInfoCard({ c, timezone, canWrite, onEdit }: { c: Customer; timezone: string; canWrite: boolean; onEdit: () => void }) {
  return (
    <section className="ui-card kh-info" aria-label="Thông tin khách">
      <header className="kh-info__head">
        <Avatar name={c.fullName} colorKey={c.id} />
        <h2 className="kh-info__name">{c.fullName}</h2>
        {canWrite && (
          <Button size="sm" onClick={onEdit}>
            Sửa
          </Button>
        )}
      </header>
      <dl className="kh-kv">
        <div className="kh-kv__row">
          <dt>Số điện thoại</dt>
          <dd>{c.phone ? <a href={`tel:${c.phone}`}>{formatPhone(c.phone)}</a> : '—'}</dd>
        </div>
        <div className="kh-kv__row">
          <dt>Email</dt>
          <dd>{c.email ?? '—'}</dd>
        </div>
        <div className="kh-kv__row">
          <dt>Ghi chú</dt>
          <dd className="kh-kv__note">{c.note ?? '—'}</dd>
        </div>
        <div className="kh-kv__row">
          <dt>Khách từ</dt>
          <dd>{formatDateIn(c.createdAt, timezone) || '—'}</dd>
        </div>
      </dl>
    </section>
  );
}
