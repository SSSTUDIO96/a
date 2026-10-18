// Biểu tượng điều hướng 18px — nét vẽ chép từ bản mẫu C (docs/rnd/v2-phuong-an-C.html, bảng ICON), cùng lớp ui-ico với src/ui/icons.tsx.
// Bộ biểu tượng chung của W2 chưa có các hình này; nếu W2 nhận vào src/ui/icons.tsx thì xoá tệp này và import từ đó.
import type { ReactNode, SVGProps } from 'react';
import type { NavIconName } from './nav';

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico" {...rest}>
      {children}
    </svg>
  );
}

const PATHS: Record<NavIconName | 'brand' | 'more' | 'logout' | 'swap' | 'down', ReactNode> = {
  lich: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  hd: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M10 13h6M10 17h6" />
    </>
  ),
  gia: (
    <>
      <path d="M20 12l-8 8-9-9V4h7z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  khach: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c1.8.7 3 2.5 3.5 5.2" />
    </>
  ),
  tho: (
    <>
      <path d="M14 3l7 7-9 9H5v-7z" />
      <path d="M11 6l7 7" />
    </>
  ),
  brand: (
    <>
      <path d="M14 3l7 7-9 9H5v-7z" />
      <path d="M11 6l7 7" />
    </>
  ),
  'cai-dat': (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="19" cy="12" r="1.3" />
    </>
  ),
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  swap: <path d="M7 7h12l-3-3M17 17H5l3 3" />,
  down: <path d="M6 9l6 6 6-6" />,
};

export function NavIcon({ name, ...rest }: IconProps & { name: keyof typeof PATHS }) {
  return <Svg {...rest}>{PATHS[name]}</Svg>;
}
