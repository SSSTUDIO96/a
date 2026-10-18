// Biểu tượng riêng của màn Lịch (nét 18px như src/ui/icons.tsx). Bộ dùng chung chưa có mũi tên phải, cảnh báo, phễu lọc.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className ? `ui-ico ${className}` : 'ui-ico'} {...rest}>
      {children}
    </svg>
  );
}

export function IconPrev(props: IconProps) {
  return <Svg {...props}><path d="M15 18l-6-6 6-6" /></Svg>;
}

export function IconNext(props: IconProps) {
  return <Svg {...props}><path d="M9 18l6-6-6-6" /></Svg>;
}

export function IconWarn(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18h.01" />
    </Svg>
  );
}

export function IconFilter(props: IconProps) {
  return <Svg {...props}><path d="M3 5h18l-7 8v6l-4-2v-4z" /></Svg>;
}

export function IconPerson(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" />
    </Svg>
  );
}
