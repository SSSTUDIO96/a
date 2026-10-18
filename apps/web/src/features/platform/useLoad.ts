import { useCallback, useEffect, useRef, useState } from 'react';

// Tải dữ liệu theo khoá: đổi khoá → huỷ yêu cầu cũ, tải lại. reload() tải lại mà giữ dữ liệu cũ trên màn trong lúc chờ.
export interface Loaded<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

export function useLoad<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(key !== null);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (key === null) {
      setData(null);
      setLoading(false);
      return undefined;
    }
    const ctl = new AbortController();
    // Khoá mới: bỏ dữ liệu của khoá cũ (không hiện chi tiết tổ chức A khi đang mở B).
    if (lastKey.current !== key) setData(null);
    lastKey.current = key;
    setLoading(true);
    setError(null);
    loadRef.current(ctl.signal).then(
      (d) => {
        setData(d);
        setLoading(false);
      },
      (err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err);
        setLoading(false);
      },
    );
    return () => ctl.abort();
  }, [key, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}
