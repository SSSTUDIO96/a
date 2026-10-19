// Biểu tượng nét của màn Hôm nay (cùng kiểu ui/icons.tsx: viền 1.8, đầu tròn, aria-hidden).
import type { SVGProps } from 'react';

function Svg({ children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico" {...rest}>
      {children}
    </svg>
  );
}

export function IconCash() {
  return (
    <Svg>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  );
}

export function IconDoc() {
  return (
    <Svg>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </Svg>
  );
}

export function IconCap() {
  return (
    <Svg>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" />
    </Svg>
  );
}

export function IconSeat() {
  return (
    <Svg>
      <path d="M7 4h10v8H7zM5 12h14v4H5zM8 16v4M16 16v4" />
    </Svg>
  );
}

export function IconRefresh() {
  return (
    <Svg>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </Svg>
  );
}
