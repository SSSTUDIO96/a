import { lazy, Suspense, useState } from 'react';
import type { ContractStatus } from '@makeup/shared';
import { Button } from '../../../ui';
import './dialog.css';

// Nút "In hợp đồng" dùng chung cho CẢ HAI loại hợp đồng (bản vẽ G mục 4.2). Gói G-W5 gắn vào màn dịch vụ và màn khoá học.
// Hộp In (PrintDialog) tải theo nhu cầu: màn hợp đồng không phải mang theo 5 bố cục + phông khi chưa bấm in.
const PrintDialog = lazy(() => import('./PrintDialog').then((m) => ({ default: m.PrintDialog })));

export interface PrintButtonProps {
  orgId: string;
  /** Múi giờ của tổ chức. */
  tz: string;
  /** null = hợp đồng mới chưa lưu. */
  contractId: string | null;
  status: ContractStatus | null;
  /** Chưa lưu, hoặc nháp có thay đổi chưa lưu. */
  needsSave: boolean;
  /** Lưu nháp; trả id hợp đồng, null = lưu hỏng (màn tự báo lỗi). */
  ensureSaved: () => Promise<string | null>;
  /** has('contracts.texts') → liên kết "Sửa mẫu in" trong hộp. */
  canManageTemplates: boolean;
  phone: boolean;
  size: 'sm' | 'md';
}

export function printButtonLabel(phone: boolean, needsSave: boolean): string {
  if (phone) return needsSave ? 'Lưu & in' : 'In';
  return needsSave ? 'Lưu nháp & in' : 'In hợp đồng';
}

export function PrintButton({ orgId, tz, contractId, status, needsSave, ensureSaved, canManageTemplates, phone, size }: PrintButtonProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const cancelled = status === 'CANCELLED';

  const onClick = async () => {
    if (cancelled || saving) return;
    if (!needsSave && contractId !== null) {
      setOpenId(contractId);
      return;
    }
    setSaving(true);
    try {
      const id = await ensureSaved();
      if (id !== null) setOpenId(id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <span className="hdin-btn-wrap">
        <Button size={size} onClick={() => void onClick()} disabled={cancelled} loading={saving} title={cancelled ? 'Hợp đồng đã huỷ — không in' : undefined}>
          {printButtonLabel(phone, needsSave)}
        </Button>
        {cancelled && <span className="hdin-btn-note">Hợp đồng đã huỷ — không in</span>}
      </span>
      {openId !== null && (
        <Suspense fallback={null}>
          <PrintDialog open onClose={() => setOpenId(null)} orgId={orgId} tz={tz} contractId={openId} canManageTemplates={canManageTemplates} phone={phone} />
        </Suspense>
      )}
    </>
  );
}
