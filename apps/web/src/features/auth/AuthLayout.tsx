import { useId, type ReactNode } from 'react';
import { NavIcon } from '../../layout/navIcons';
import { Card } from '../../ui';
import './auth.css';

export interface AuthLayoutProps {
  /** Tiêu đề h1 của thẻ, ví dụ "Đăng nhập". */
  title: string;
  /** Một dòng ngay dưới tiêu đề (chỉ khi cần, ví dụ "Bạn chưa thuộc tổ chức nào…"). */
  lead?: ReactNode;
  /** Chân thẻ nền --soft: liên kết sang màn kia ("Chưa có tài khoản? Đăng ký"). */
  footer?: ReactNode;
  children: ReactNode;
}

// Khung chung của Đăng nhập / Đăng ký / Tạo tổ chức (biên bản cuối T4): nền --bg, logo "Makeup Pro" như thanh trái,
// một thẻ ui/Card giữa màn rộng tối đa 420px. Điện thoại: thẻ cách mép 16px, không tràn ngang.
export function AuthLayout({ title, lead, footer, children }: AuthLayoutProps) {
  const titleId = useId();
  return (
    <main className="au">
      <div className="au-col">
        <div className="au-brand">
          <span className="au-brand__mark" aria-hidden="true">
            <NavIcon name="brand" />
          </span>
          <span>Makeup Pro</span>
        </div>
        <Card className="au-card" aria-labelledby={titleId} footer={footer}>
          <h1 id={titleId} className="au-title">
            {title}
          </h1>
          {lead !== undefined && <p className="au-lead">{lead}</p>}
          {children}
        </Card>
      </div>
    </main>
  );
}
