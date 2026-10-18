// Tạm khoá (lý do bắt buộc) / mở khoá (lý do tuỳ chọn) — bản vẽ C2 mục 5.5, bản mẫu #khoa.
// PATCH /platform/organizations/:id {status: 'SUSPENDED', reason} · {status: 'ACTIVE', reason?}
import { userMessage } from '../../api/errors';
import { setOrganizationStatus, type OrgStatus } from '../../api/platform';
import { ConfirmDialog } from '../../ui';

export interface SuspendTarget {
  id: string;
  name: string;
  status: OrgStatus;
}

/** Thân PATCH: khoá phải có lý do (đã cắt khoảng trắng); mở khoá chỉ gửi lý do khi có. */
export function statusInput(next: OrgStatus, reason: string): { status: OrgStatus; reason?: string } {
  const r = reason.trim();
  if (next === 'SUSPENDED' && r === '') throw new Error('Nhập lý do tạm khoá');
  return r ? { status: next, reason: r } : { status: next };
}

export function SuspendDialog({ target, onClose, onDone }: { target: SuspendTarget | null; onClose: () => void; onDone: () => void }) {
  const suspending = target?.status !== 'SUSPENDED';
  return (
    <ConfirmDialog
      open={target !== null}
      onClose={onClose}
      width={460}
      title={suspending ? `Tạm khoá ${target?.name ?? ''}?` : `Mở khoá ${target?.name ?? ''}?`}
      message={
        suspending
          ? 'Mọi thành viên không vào được tổ chức; trang giới thiệu công khai tắt. Dữ liệu giữ nguyên, mở khoá lúc nào cũng được.'
          : 'Thành viên vào lại được tổ chức như trước khi khoá.'
      }
      confirmLabel={suspending ? 'Tạm khoá' : 'Mở khoá'}
      danger={suspending}
      requireReason={suspending}
      askReason={!suspending}
      reasonMaxLength={500}
      reasonPlaceholder={suspending ? 'Ví dụ: quá hạn 30 ngày, đã gọi 3 lần không nghe' : undefined}
      errorMessage={userMessage}
      onConfirm={async (reason) => {
        if (!target) return;
        await setOrganizationStatus(target.id, statusInput(suspending ? 'SUSPENDED' : 'ACTIVE', reason));
        onDone();
        onClose();
      }}
    />
  );
}
