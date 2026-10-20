// Phần nhỏ dùng chung của cổng: ảnh đại diện, hộp hỏi lại.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { initialOf } from './logic';

export function Avatar({ name, url, size, tone }: { name: string; url: string | null; size: number; tone?: 'brand' }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (url && !broken) {
    return <img className="pt-avatar" style={style} src={url} alt="" onError={() => setBroken(true)} />;
  }
  return (
    <span className={tone === 'brand' ? 'pt-avatar pt-avatar--brand' : 'pt-avatar'} style={style} aria-hidden="true">
      {initialOf(name)}
    </span>
  );
}

/** Hộp hỏi lại: Esc đóng, tiêu điểm vào nút đầu, Tab không chui ra ngoài hộp. */
export function ConfirmSheet({ title, children, actions, onClose }: { title: string; children: ReactNode; actions: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => prev?.focus?.();
  }, []);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled)');
    if (!items || items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return (
    <div
      className="pt-overlay pt-overlay--sheet"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} className="pt-sheet" role="alertdialog" aria-modal="true" aria-labelledby="pt-sheet-t" onKeyDown={onKey}>
        <h2 id="pt-sheet-t">{title}</h2>
        <div className="pt-sheet__body">{children}</div>
        <div className="pt-sheet__actions">{actions}</div>
      </div>
    </div>
  );
}
