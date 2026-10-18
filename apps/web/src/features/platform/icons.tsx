// Biểu tượng riêng của khung quản trị nền tảng — nét vẽ chép từ bản mẫu v4 (docs/rnd/v4-chung/v4.js: tong-quan, org, goi),
// cùng lớp ui-ico với src/ui/icons.tsx. Bộ biểu tượng chung chưa có ba hình này.
import type { ReactNode, SVGProps } from 'react';

const PATHS = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />,
  org: <path d="M4 21V5a1 1 0 011-1h9a1 1 0 011 1v16M15 9h4a1 1 0 011 1v11M8 8h3M8 12h3M8 16h3M2 21h20" />,
  plan: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type PlatformIconName = keyof typeof PATHS;

export function PlatformIcon({ name, ...rest }: SVGProps<SVGSVGElement> & { name: PlatformIconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico" {...rest}>
      {PATHS[name]}
    </svg>
  );
}
