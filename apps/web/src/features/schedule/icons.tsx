// Biểu tượng riêng của màn Lịch (nét 18px như src/ui/icons.tsx). Mũi tên, cảnh báo, phễu lọc đã chuyển sang src/ui/icons.tsx.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className ? `ui-ico ${className}` : 'ui-ico'} {...rest}>
      {children}
    </svg>
  );
}





export function IconPerson(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" />
    </Svg>
  );
}
