import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { userMessage } from '../../api/errors';
import { listCustomers } from '../../api/schedule';
import type { Customer } from '../../api/types';
import { Button, TextInput, Tooltip } from '../../ui';
import type { CustomerDraft } from './model';

// Khách hàng của hợp đồng (bản vẽ 4.3, thẻ đầu): thẻ khách, hoặc ô tìm (GET /customers?q=) + "Khách mới" (Họ tên, Số điện thoại).
export interface CustomerBlockProps {
  orgId: string;
  value: CustomerDraft | null;
  onChange: (v: CustomerDraft | null) => void;
  // Đã lưu hợp đồng (hoặc không được sửa): khối khách luôn là thẻ khách (không ô nhập).
  locked: boolean;
  // Hợp đồng NHÁP đã lưu và được sửa: nút "Đổi" mở ô tìm khách có sẵn; chọn xong gửi PATCH customerId NGAY.
  // Trả null khi đã đổi, hoặc lời báo khi máy chủ từ chối (409 CUSTOMER_IN_USE, 404…). Không truyền = không có nút "Đổi"
  // (hợp đồng đã xác nhận: máy chủ không cho đổi khách nên không bày nút).
  onChangeSaved?: (c: ExistingCustomer) => Promise<string | null>;
  // Trang hồ sơ khách (sửa tên, số điện thoại ở đó) — có khi hợp đồng đã lưu và người dùng xem được khách.
  customerHref?: string | null;
  canSearch: boolean;
  canCreate: boolean;
  errors: Record<string, string>;
}

type ExistingCustomer = Extract<CustomerDraft, { kind: 'existing' }>;

export const TIP_CHANGE_SAVED = 'Chọn khách có sẵn — đổi ngay. Khách mới: thêm ở màn Khách hàng trước.';

export function CustomerBlock({ orgId, value, onChange, locked, onChangeSaved, customerHref, canSearch, canCreate, errors }: CustomerBlockProps) {
  const [changing, setChanging] = useState(false);
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  // Vừa đổi xong: một dòng xác nhận ngay dưới thẻ khách (gần chỗ bấm), mất khi bấm "Đổi" lần nữa.
  const [changedTo, setChangedTo] = useState<string | null>(null);
  const canChangeSaved = locked && Boolean(onChangeSaved) && canSearch;

  if (changing && canChangeSaved && onChangeSaved) {
    const pick = async (c: CustomerDraft) => {
      if (c.kind !== 'existing') return;
      setChangeBusy(true);
      setChangeError(null);
      const message = await onChangeSaved(c);
      setChangeBusy(false);
      if (message === null) {
        setChanging(false);
        setChangedTo(c.fullName);
      } else setChangeError(message);
    };
    return (
      <div className="ct-cs" aria-busy={changeBusy || undefined}>
        <CustomerSearch orgId={orgId} onPick={(c) => void pick(c)} canSearch canCreate={false} disabled={changeBusy} tip={TIP_CHANGE_SAVED} />
        {changeError && (
          <div className="ct-err" role="alert">
            {changeError}
          </div>
        )}
        <div>
          <Button
            size="sm"
            variant="ghost"
            disabled={changeBusy}
            onClick={() => {
              setChanging(false);
              setChangeError(null);
            }}
          >
            Giữ khách hiện tại
          </Button>
        </div>
      </div>
    );
  }

  // N6: sau lần lưu đầu (hoặc khi không được sửa) khách mới cũng hiện thành thẻ — không còn ô nhập mà sửa xong bị bỏ im lặng.
  if (value?.kind === 'existing' || (value?.kind === 'new' && locked)) {
    const email = value.kind === 'existing' ? value.email : null;
    const sub = [value.phone, email].filter(Boolean).join(' · ');
    const card = (
      <div className="ct-kh">
        <div className="ct-kh__main">
          <div className="ct-kh__name">{value.fullName}</div>
          {sub && <div className="ct-fx">{sub}</div>}
        </div>
        {!locked && (
          <Button size="sm" aria-label="Đổi khách" onClick={() => onChange(null)}>
            Đổi
          </Button>
        )}
        {canChangeSaved && (
          <Button
            size="sm"
            aria-label="Đổi khách"
            onClick={() => {
              setChangedTo(null);
              setChanging(true);
            }}
          >
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
    if (!changedTo || !canChangeSaved) return card;
    return (
      <div className="ct-cs">
        {card}
        <div className="ct-ok" role="status">
          Đã đổi sang {changedTo} — đã lưu vào hợp đồng.
        </div>
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
  disabled,
  tip,
}: {
  orgId: string;
  onPick: (v: CustomerDraft) => void;
  canSearch: boolean;
  canCreate: boolean;
  error?: string;
  disabled?: boolean;
  tip?: string;
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
            autoFocus={tip !== undefined}
          />
        )}
        {tip && <Tooltip text={tip} />}
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
              disabled={disabled}
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
