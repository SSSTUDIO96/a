// Ba mục của khung quản trị nền tảng (bản vẽ C2 mục 5.2). KHÔNG dùng nav.ts của tổ chức.
import type { PlatformIconName } from './icons';

export const PLATFORM_BASE = '/quan-tri';

export interface PlatformNavItem {
  key: 'home' | 'orgs' | 'plans';
  label: string;
  // Đường tương đối sau /quan-tri ('' = trang chủ).
  path: string;
  icon: PlatformIconName;
}

export const PLATFORM_NAV: readonly PlatformNavItem[] = [
  { key: 'home', label: 'Trang chủ', path: '', icon: 'home' },
  { key: 'orgs', label: 'Tổ chức', path: 'to-chuc', icon: 'org' },
  { key: 'plans', label: 'Gói cước', path: 'goi-cuoc', icon: 'plan' },
];

export function platformHref(path: string): string {
  return path ? `${PLATFORM_BASE}/${path}` : PLATFORM_BASE;
}

/** Mục đang đứng theo đường dẫn (phần sau /quan-tri). */
export function activePlatformItem(pathname: string): PlatformNavItem | undefined {
  const rest = pathname.replace(/^\/quan-tri\/?/, '').replace(/\/+$/, '');
  const first = rest.split('/')[0] ?? '';
  return PLATFORM_NAV.find((i) => i.path === first);
}
