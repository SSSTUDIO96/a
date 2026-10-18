import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { userMessage } from '../../api/errors';
import { listCustomers } from '../../api/schedule';
import type { Customer } from '../../api/types';
import { Button, TextInput } from '../../ui';
import type { CustomerDraft } from './model';

// Khách hàng của hợp đồng (bản vẽ 4.3, thẻ đầu): thẻ khách, hoặc ô tìm (GET /customers?q=) + "Khách mới" (Họ tên, Số điện thoại).
export interface CustomerBlockProps {
  orgId: string;
  value: CustomerDraft | null;
  onChange: (v: CustomerDraft | null) => void;
  // Đã lưu hợp đồng: máy chủ không cho đổi khách → không có nút "Đổi"; khối khách luôn là thẻ khách (không ô nhập).
  locked: boolean;
  // Trang hồ sơ khách (sửa tên, số điện thoại ở đó) — có khi hợp đồng đã lưu và người dùng xem được khách.
  customerHref?: string | null;
  canSearch: boolean;
  canCreate: boolean;
  errors: Record<string, string>;
}

export function CustomerBlock({ orgId, value, onChange, locked, customerHref, canSearch, canCreate, errors }: CustomerBlockProps) {
  // N6: sau lần lưu đầu (hoặc khi không được sửa) khách mới cũng hiện thành thẻ — không còn ô nhập mà sửa xong bị bỏ im lặng.
  if (value?.kind === 'existing' || (value?.kind === 'new' && locked)) {
    const email = value.kind === 'existing' ? value.email : null;
    const sub = [value.phone, email].filter(Boolean).join(' · ');
    return (
      <div className="ct-kh">
        <div className="ct-kh__main">
          <div className="ct-kh__name">{value.fullName}</div>
          {sub && <div className="ct-fx">{sub}</div>}
        </div>
        {!locked && (
          <Button size="sm" onClick={() => onChange(null)}>
            Đổi
          </Button>
        )}
        {locked && customerHref && (
          <Link className="ct-lnk" to={customerHref} title="Tên, số điện thoại của khách sửa ở hồ sơ khách">
            Sửa ở hồ sơ khách
          </Link>
        )}
      </div>
    );
  }
  if (value?.kind === 'new') {
    return (
      <div className="ct-cs">
        <div className="ct-cs__new">
          <TextInput
            aria-label="Họ tên khách"
            placeholder="Họ tên"
            value={value.fullName}
            onChange={(e) => onChange({ ...value, fullName: e.target.value })}
            error={errors['newCustomer.fullName']}
            autoFocus
          />
          <TextInput
            aria-label="Số điện thoại khách"
            placeholder="Số điện thoại"
            inputMode="tel"
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            error={errors['newCustomer.phone']}
          />
        </div>
        <div>
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            Chọn khách có sẵn
          </Button>
        </div>
      </div>
    );
  }
  return <CustomerSearch orgId={orgId} onPick={onChange} canSearch={canSearch} canCreate={canCreate} error={errors.customerId} />;
}

function CustomerSearch({
  orgId,
  onPick,
  canSearch,
  canCreate,
  error,
}: {
  orgId: string;
  onPick: (v: CustomerDraft) => void;
  canSearch: boolean;
  canCreate: boolean;
  error?: string;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Customer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    const term = q.trim();
    if (!canSearch || term.length < 2) {
      setItems(null);
      return undefined;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      listCustomers(orgId, { q: term, pageSize: 8 }, controller.signal)
        .then((r) => {
          setItems(r.items);
          setLoadError(null);
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setLoadError(userMessage(err));
        });
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [orgId, q, canSearch]);

  return (
    <div className="ct-cs">
      <div className="ct-cs__row">
        {canSearch && (
          <TextInput
            aria-label="Tìm khách theo tên hoặc số điện thoại"
            placeholder="Tìm theo tên hoặc số điện thoại"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            error={loadError ?? error}
          />
        )}
        {canCreate && <Button onClick={() => onPick({ kind: 'new', fullName: q.trim() && !/\d/.test(q) ? q.trim() : '', phone: /\d/.test(q) ? q.trim() : '' })}>Khách mới</Button>}
      </div>
      {!canSearch && error && <div className="ct-err">{error}</div>}
      {items && (
        <div className="ct-cs__res" role="listbox" aria-label="Khách tìm được">
          {items.length === 0 && <div className="ct-cs__opt ct-fx">Không tìm thấy khách.</div>}
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={false}
              className="ct-cs__opt"
              onClick={() => onPick({ kind: 'existing', id: c.id, fullName: c.fullName, phone: c.phone, email: c.email })}
            >
              <div className="ct-kh__name">{c.fullName}</div>
              <div className="ct-fx">{[c.phone, c.email].filter(Boolean).join(' · ')}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
