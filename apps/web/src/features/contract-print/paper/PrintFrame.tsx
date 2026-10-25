import type { ReactNode } from 'react';
import type { PrintLayout } from '@makeup/shared';
import { Dialog } from '../../../ui';
import { PaperPreview } from './PaperPreview';

export interface PrintFrameProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  layout: PrintLayout;
  /** Cột lựa chọn bên cạnh (hộp In). Ẩn khi in. */
  aside?: ReactNode;
  footer?: ReactNode | null;
  onPages?: (n: number) => void;
  /** Thường là <PrintPaper …/>. */
  children: ReactNode;
}

/**
 * Khung hộp thoại để in. LUÔN dùng Dialog ở mọi khổ (không BottomSheet): luật in L1 dựa vào `.ui-overlay > .ui-dialog.hdin-dlg`
 * — khi in, mọi thứ khác trong body bị `display: none`, lớp phủ + hộp thoại về dòng chảy thường nên tờ giấy chảy qua nhiều trang.
 */
export function PrintFrame({ open, onClose, title, eyebrow, layout, aside, footer, onPages, children }: PrintFrameProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} eyebrow={eyebrow} footer={footer} className="hdin-dlg">
      <div className="hdin-frame">
        <div className="hdin-frame__paper">
          <PaperPreview layout={layout} onPages={onPages}>
            {children}
          </PaperPreview>
        </div>
        {aside !== undefined && <aside className="hdin-aside">{aside}</aside>}
      </div>
    </Dialog>
  );
}
