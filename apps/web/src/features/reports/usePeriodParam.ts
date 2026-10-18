import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { currentMonth, monthPeriod, parsePeriod, type Period } from './period';

// Kỳ đang xem nằm trên đường dẫn (?ky=2026-10) để gửi link cho người khác xem đúng kỳ. Không có / sai dạng → tháng này.
export function usePeriodParam(): [Period, (p: Period) => void, URLSearchParams, (next: URLSearchParams) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('ky');
  const period = useMemo(() => {
    const parsed = parsePeriod(raw);
    if (parsed) return parsed;
    const { y, m } = currentMonth();
    return monthPeriod(y, m);
  }, [raw]);
  const setPeriod = useCallback(
    (p: Period) => {
      const next = new URLSearchParams(params);
      next.set('ky', p.key);
      next.delete('trang');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );
  const set = useCallback((next: URLSearchParams) => setParams(next, { replace: true }), [setParams]);
  return [period, setPeriod, params, set];
}
