// Biểu tượng riêng của màn hợp đồng mà src/ui/icons.tsx chưa có (cảnh báo, đồng hồ) — cùng nét 1.8, đầu tròn như bản mẫu C.
import type { SVGProps } from 'react';

function Svg({ children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico" {...rest}>
      {children}
    </svg>
  );
}

export function IconWarn() {
  return (
    <Svg>
      <path d="M12 4 2.8 19.5h18.4L12 4z" />
      <path d="M12 10v4.5M12 17.2v.1" />
    </Svg>
  );
}

export function IconClock() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}
