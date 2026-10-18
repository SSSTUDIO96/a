// Biểu tượng nét 18px theo bản mẫu C (stroke 1.8, đầu tròn). aria-hidden: nghĩa nằm ở chữ hoặc aria-label của nút.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className ? `ui-ico ${className}` : 'ui-ico'} {...rest}>
      {children}
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return <Svg {...props}><path d="M12 5v14M5 12h14" /></Svg>;
}

export function IconClose(props: IconProps) {
  return <Svg {...props}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
}

export function IconCheck(props: IconProps) {
  return <Svg {...props}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function IconBack(props: IconProps) {
  return <Svg {...props}><path d="M15 5l-7 7 7 7" /></Svg>;
}

export function IconNext(props: IconProps) {
  return <Svg {...props}><path d="M9 5l7 7-7 7" /></Svg>;
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

export function IconCalendar(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function IconUpload(props: IconProps) {
  return <Svg {...props}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></Svg>;
}
