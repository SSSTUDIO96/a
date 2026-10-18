import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react';

// Tiêu đề trang. Máy tính / máy tính bảng: h1 + nút bên phải. Điện thoại: ẩn h1, tiêu đề và một nút lên thanh trên.

export interface ShellHeader {
  title: ReactNode;
  // Màn con: đường quay lại (nút ‹ trên thanh trên điện thoại).
  backTo?: string;
  // Một nút hành động hoặc nhãn trạng thái ở thanh trên điện thoại.
  phoneAction?: ReactNode;
}

export const ShellHeaderContext = createContext<((h: ShellHeader | null) => void) | null>(null);

export interface PageHeaderProps extends ShellHeader {
  // Nút bên phải tiêu đề (máy tính, máy tính bảng).
  actions?: ReactNode;
}

export function PageHeader({ title, actions, backTo, phoneAction }: PageHeaderProps) {
  const setHeader = useContext(ShellHeaderContext);
  useLayoutEffect(() => {
    setHeader?.({ title, backTo, phoneAction });
    return () => setHeader?.(null);
  }, [setHeader, title, backTo, phoneAction]);
  return (
    <div className="sh-ph">
      <h1>{title}</h1>
      <span className="sh-ph__sp" />
      {actions}
    </div>
  );
}
