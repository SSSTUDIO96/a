import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { ApiError, errorKind, fieldErrors, userMessage } from '../../api/errors';
import { newIdempotencyKey } from '../../api/idempotency';
import { createStaffTier, updateStaffTier } from '../../api/staff';
import type { StaffTier } from '../../api/types';
import { Button, IconPlus, Switch, TextInput } from '../../ui';
import { moveItem, sortTiers, tierPatches, type TierDraft } from './logic';
import { FormDialog, IconGrip, Strip } from './parts';

// Hộp "Bậc lương" (C2 1.2): mỗi bậc một hàng — tay kéo (thứ tự) · tên · "n thợ" · công tắc Đang dùng.
// Hàng cuối: tên bậc mới + "+ Thêm" (POST ngay). Lưu: mỗi bậc đã đổi một PATCH; lỗi bậc nào hiện dưới hàng đó.
export interface TierManagerDialogProps {
  orgId: string;
  open: boolean;
  phone: boolean;
  tiers: StaffTier[];
  // Mở từ "+ Thêm bậc lương": tiêu điểm vào ô tên bậc mới.
  focusNew: boolean;
  onClose: () => void;
  // Có thay đổi trên máy chủ (thêm / lưu) → màn tải lại bậc và thợ.
  onChanged: () => void;
}

interface RowError {
  name?: string;
  row?: string;
}

export function TierManagerDialog(p: TierManagerDialogProps) {
  const [draft, setDraft] = useState<TierDraft[]>([]);
  const [base, setBase] = useState<StaffTier[]>([]);
  const [errors, setErrors] = useState<Record<string, RowError>>({});
  const [newName, setNewName] = useState('');
  const [newError, setNewError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const newRef = useRef<HTMLInputElement>(null);
  // Khoá chống gửi trùng: giữ nguyên khi bấm lại sau lỗi mạng, đổi khi tên đổi hoặc đã thêm xong.
  const addKey = useRef<string>(newIdempotencyKey());

  useEffect(() => {
    if (!p.open) return;
    const sorted = sortTiers(p.tiers);
    setBase(sorted);
    setDraft(sorted.map((t) => ({ id: t.id, name: t.name, isActive: t.isActive })));
    setErrors({});
    setNewName('');
    setNewError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open]);

  useEffect(() => {
    if (p.open && p.focusNew) {
      const t = setTimeout(() => newRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [p.open, p.focusNew]);

  if (!p.open) return null;
  const byId = new Map(base.map((t) => [t.id, t]));
  const patches = tierPatches(base, draft);

  function update(id: string, change: Partial<TierDraft>) {
    setDraft((d) => d.map((x) => (x.id === id ? { ...x, ...change } : x)));
    setErrors((e) => (e[id] ? { ...e, [id]: {} } : e));
  }

  function move(from: number, to: number) {
    setDraft((d) => moveItem(d, from, to));
  }

  async function add() {
    const name = newName.trim();
    if (!name) {
      setNewError('Nhập tên bậc trước khi thêm.');
      newRef.current?.focus();
      return;
    }
    setAdding(true);
    setNewError(null);
    try {
      const created = await createStaffTier(p.orgId, { name }, addKey.current);
      addKey.current = newIdempotencyKey();
      setBase((b) => [...b, created]);
      setDraft((d) => [...d, { id: created.id, name: created.name, isActive: created.isActive }]);
      setNewName('');
      p.onChanged();
      newRef.current?.focus();
    } catch (err) {
      setNewError(fieldErrors(err).name ?? userMessage(err));
    } finally {
      setAdding(false);
    }
  }

  async function save() {
    if (patches.length === 0) {
      p.onClose();
      return;
    }
    setSaving(true);
    const nextErrors: Record<string, RowError> = {};
    const results = await Promise.allSettled(patches.map((x) => updateStaffTier(p.orgId, x.tierId, x.input)));
    const saved: StaffTier[] = [];
    results.forEach((r, i) => {
      const x = patches[i];
      if (!x) return;
      if (r.status === 'fulfilled') {
        saved.push(r.value);
        return;
      }
      const err = r.reason;
      const fe = fieldErrors(err);
      const isConflict = err instanceof ApiError && errorKind(err) === 'conflict';
      // 409 trùng tên → dưới ô tên; 409 ẩn bậc còn thợ → dải đỏ dưới hàng + công tắc quay về bật.
      if (fe.name) nextErrors[x.tierId] = { name: fe.name };
      else if (isConflict && x.input.isActive === false && /thợ/.test(err.message)) {
        nextErrors[x.tierId] = { row: err.message };
        update(x.tierId, { isActive: true });
      } else if (isConflict && x.input.name !== undefined) nextErrors[x.tierId] = { name: err.message };
      else nextErrors[x.tierId] = { row: userMessage(err) };
    });
    // Bậc đã lưu được thành nền mới (lần Lưu sau không gửi lại).
    if (saved.length > 0) {
      const savedById = new Map(saved.map((t) => [t.id, t]));
      setBase((b) => b.map((t) => savedById.get(t.id) ?? t));
      p.onChanged();
    }
    setSaving(false);
    if (Object.keys(nextErrors).length === 0) p.onClose();
    else setErrors(nextErrors);
  }

  function onHandleKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key === 'ArrowUp' && i > 0) {
      e.preventDefault();
      move(i, i - 1);
    } else if (e.key === 'ArrowDown' && i < draft.length - 1) {
      e.preventDefault();
      move(i, i + 1);
    }
  }

  const footer = (
    <>
      <Button onClick={p.onClose} disabled={saving}>
        Đóng
      </Button>
      <Button variant="primary" onClick={() => void save()} loading={saving} disabled={patches.length === 0}>
        Lưu
      </Button>
    </>
  );

  return (
    <FormDialog open phone={p.phone} onClose={() => !saving && p.onClose()} title="Bậc lương" sub="Kéo để đổi thứ tự. Thứ tự này là thứ tự hàng trên màn tiền công." footer={footer}>
      <ol className="st-tiers-edit" aria-label="Danh sách bậc lương">
        {draft.map((d, i) => {
          const t = byId.get(d.id);
          const err = errors[d.id] ?? {};
          return (
            <li
              key={d.id}
              className={dragFrom === i ? 'st-tedit st-tedit--drag' : 'st-tedit'}
              onDragOver={(e: DragEvent) => {
                if (dragFrom !== null) e.preventDefault();
              }}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                if (dragFrom !== null) move(dragFrom, i);
                setDragFrom(null);
              }}
            >
              <div className="st-tedit__main">
                <button
                  type="button"
                  className="st-tedit__grip"
                  draggable
                  aria-label={`Kéo để đổi thứ tự bậc ${d.name} (mũi tên lên/xuống)`}
                  onDragStart={(e) => {
                    setDragFrom(i);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', d.id);
                  }}
                  onDragEnd={() => setDragFrom(null)}
                  onKeyDown={(e) => onHandleKey(e, i)}
                  disabled={saving}
                >
                  <IconGrip />
                </button>
                <TextInput
                  className="st-tedit__name"
                  aria-label={`Tên bậc ${i + 1}`}
                  value={d.name}
                  maxLength={60}
                  disabled={saving}
                  error={err.name ?? null}
                  onChange={(e) => update(d.id, { name: e.target.value })}
                />
                <span className="st-tedit__count">{`${t?.staffCount ?? 0} thợ`}</span>
                <Switch checked={d.isActive} disabled={saving} aria-label={`Đang dùng: ${d.name}`} title="Đang dùng" onChange={(v) => update(d.id, { isActive: v })} />
              </div>
              {err.row && (
                <Strip tone="danger" icon="warn">
                  {err.row}
                </Strip>
              )}
            </li>
          );
        })}
      </ol>
      <div className="st-tedit st-tedit--new">
        <div className="st-tedit__main">
          <TextInput
            ref={newRef}
            className="st-tedit__name"
            aria-label="Tên bậc mới"
            placeholder="Tên bậc mới, ví dụ: Thợ chính bậc 2"
            value={newName}
            maxLength={60}
            disabled={adding}
            error={newError}
            onChange={(e) => {
              setNewName(e.target.value);
              addKey.current = newIdempotencyKey();
              if (newError) setNewError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void add();
              }
            }}
          />
          <Button icon={<IconPlus />} onClick={() => void add()} loading={adding}>
            Thêm
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
