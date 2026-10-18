import { useEffect, useState } from 'react';

// Điểm gãy bản vẽ C mục 1.4: điện thoại ≤ 640, máy tính bảng 641–1180, máy tính ≥ 1181. CSS dùng cùng các mốc này.
export type Breakpoint = 'phone' | 'tablet' | 'desktop';

const PHONE = '(max-width: 640px)';
const TABLET = '(min-width: 641px) and (max-width: 1180px)';

function read(): Breakpoint {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop';
  if (window.matchMedia(PHONE).matches) return 'phone';
  if (window.matchMedia(TABLET).matches) return 'tablet';
  return 'desktop';
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const lists = [window.matchMedia(PHONE), window.matchMedia(TABLET)];
    const onChange = () => setBp(read());
    for (const l of lists) l.addEventListener('change', onChange);
    return () => {
      for (const l of lists) l.removeEventListener('change', onChange);
    };
  }, []);
  return bp;
}
