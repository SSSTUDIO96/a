import { useState, type CSSProperties } from 'react';
import { cx } from './cx';
import './ui.css';

export type AvatarSize = 'md' | 'sm' | 'xs';

/** Băm chuỗi (kiểu 31·h + mã ký tự, số nguyên 32 bit không dấu), lấy dư 6 → chỉ số màu --av-0…--av-5. */
export function avatarColorIndex(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  return h % 6;
}

/** Chữ viết tắt khi API không gửi: hai chữ đầu của hai tiếng cuối ("Nguyễn Thu Hà" → "TH"). */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toLocaleUpperCase('vi');
  return words
    .slice(-2)
    .map((w) => w[0] ?? '')
    .join('')
    .toLocaleUpperCase('vi');
}

export interface AvatarProps {
  /** Tên đầy đủ: dùng cho chữ thay thế và tooltip gốc. */
  name: string;
  initials?: string;
  avatarUrl?: string | null;
  /** Khoá chọn màu — membershipId. Thiếu thì dùng tên. */
  colorKey?: string;
  /** md 32 · sm 28 · xs 22. */
  size?: AvatarSize;
  className?: string;
  style?: CSSProperties;
}

/** Ảnh đại diện tròn — có avatarUrl thì hiện ảnh, không có (hoặc ảnh lỗi) thì hiện chữ viết tắt trắng. */
export function Avatar({ name, initials, avatarUrl, colorKey, size = 'md', className, style }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(avatarUrl) && !broken;
  const bg = `var(--av-${avatarColorIndex(colorKey ?? name)})`;
  return (
    <span
      className={cx('ui-av', size !== 'md' && `ui-av--${size}`, className)}
      style={{ background: showImg ? undefined : bg, ...style }}
      role="img"
      aria-label={name}
      title={name}
    >
      {showImg ? (
        <img src={avatarUrl ?? undefined} alt="" onError={() => setBroken(true)} />
      ) : (
        <span aria-hidden="true">{initials ?? initialsOf(name)}</span>
      )}
    </span>
  );
}

export interface AvatarPerson {
  membershipId: string;
  displayName: string;
  avatarUrl?: string | null;
  initials?: string;
}

export interface AvatarStackProps {
  people: readonly AvatarPerson[];
  /** Hiện tối đa bao nhiêu ảnh trước "+n". Mặc định 3. */
  max?: number;
  size?: AvatarSize;
  className?: string;
}

/** Chồng ảnh đại diện — viền trắng 2px, chồng −8px, tối đa 3 rồi "+n". */
export function AvatarStack({ people, max = 3, size = 'sm', className }: AvatarStackProps) {
  const shown = people.length > max ? people.slice(0, max) : people;
  const rest = people.length - shown.length;
  return (
    <span className={cx('ui-avs', className)} role="group" aria-label={people.map((p) => p.displayName).join(', ')}>
      {shown.map((p) => (
        <Avatar
          key={p.membershipId}
          name={p.displayName}
          initials={p.initials}
          avatarUrl={p.avatarUrl}
          colorKey={p.membershipId}
          size={size}
        />
      ))}
      {rest > 0 && (
        <span className={cx('ui-av', size !== 'md' && `ui-av--${size}`, 'ui-avs__more')} aria-hidden="true">
          +{rest}
        </span>
      )}
    </span>
  );
}
