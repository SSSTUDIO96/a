import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useParams } from 'react-router';
import { useSession } from '../../app/session';
import { usePermissions } from '../../layout/usePermissions';
import { moveItem, pricingPerms, type PricingPerms } from './logic';

// id tổ chức theo đường /:orgSlug (AppShell đã chặn đường của tổ chức không có trong phiên).
export function useOrgId(): string {
  const { orgSlug } = useParams();
  const { organizations } = useSession();
  const org = organizations.find((o) => o.slug === orgSlug);
  if (!org) throw new Error(`Không có tổ chức "${orgSlug ?? ''}" trong phiên — màn Bảng giá phải nằm trong AppShell`);
  return org.id;
}

export function usePricingPerms(): PricingPerms {
  const has = usePermissions();
  return useMemo(() => pricingPerms(has), [has]);
}

export type Resource<T> = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

/**
 * Tải dữ liệu một lần theo `deps`, huỷ yêu cầu cũ khi deps đổi hoặc rời màn. reload() tải lại, giữ dữ liệu cũ trên màn
 * trong lúc chờ (không nháy khối chờ sau lần tải đầu).
 */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[]): [Resource<T>, () => void] {
  const [state, setState] = useState<Resource<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const controller = new AbortController();
    loadRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', error });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return [state, reload];
}

/**
 * Đổi thứ tự dòng bằng kéo tay nắm (con trỏ) hoặc mũi tên ↑ ↓ trên tay nắm (bàn phím). Danh sách `items` do màn giữ;
 * mỗi lần đổi xong (thả chuột / bấm phím / `move`) gọi onCommit(danh sách mới) — màn gửi lên máy chủ.
 * Cùng cách làm với màn Nhân vật (SubjectsPage), tách thành hook cho màn Loại sự kiện và Luật phụ phí.
 */
export function useRowReorder<T extends { id: string }>({
  items,
  setItems,
  enabled,
  onCommit,
}: {
  items: readonly T[];
  setItems: (next: T[]) => void;
  enabled: boolean;
  onCommit: (next: T[]) => void;
}) {
  const [drag, setDrag] = useState<{ id: string } | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const rowRef = useCallback(
    (id: string) => (el: HTMLLIElement | null) => {
      if (el) rowRefs.current.set(id, el);
      else rowRefs.current.delete(id);
    },
    [],
  );

  const move = useCallback(
    (index: number, to: number) => {
      if (to < 0 || to >= items.length || to === index) return;
      const next = moveItem(items, index, to);
      setItems(next);
      onCommit(next);
    },
    [items, setItems, onCommit],
  );

  const gripProps = (item: T, index: number) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (!enabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ id: item.id });
    },
    onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
      if (!drag) return;
      const from = items.findIndex((x) => x.id === drag.id);
      // Vị trí mới = số dòng (trừ dòng đang kéo) có điểm giữa nằm trên con trỏ.
      let to = 0;
      for (const x of items) {
        if (x.id === drag.id) continue;
        const r = rowRefs.current.get(x.id)?.getBoundingClientRect();
        if (r && e.clientY > r.top + r.height / 2) to += 1;
      }
      if (from >= 0 && to !== from) setItems(moveItem(items, from, to));
    },
    onPointerUp: () => {
      if (!drag) return;
      setDrag(null);
      onCommit([...items]);
    },
    onPointerCancel: () => {
      if (!drag) return;
      setDrag(null);
      onCommit([...items]);
    },
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!enabled) return;
      const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : -1;
      if (to < 0 || to >= items.length) return;
      e.preventDefault();
      move(index, to);
      requestAnimationFrame(() => rowRefs.current.get(item.id)?.querySelector<HTMLButtonElement>('.pr-grip')?.focus());
    },
  });

  return { drag, rowRef, gripProps, move };
}
