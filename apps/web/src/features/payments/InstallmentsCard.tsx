import { INSTALLMENT_STATUS_LABELS, type InstallmentStatus } from '@makeup/shared';
import type { ContractPayments } from '../../api/types';
import { Button, Card, EmptyState, IconWarn, StatusTag, type TagTone } from '../../ui';
import { money } from './money';
import { fmtDate } from './vnTime';

const STATUS_TONE: Record<InstallmentStatus, TagTone> = {
  PAID: 'ok',
  PARTIAL: 'warn',
  DUE: 'neutral',
  OVERDUE: 'danger',
};

export interface InstallmentsCardProps {
  data: ContractPayments;
  canWrite: boolean;
  onEdit: () => void;
}

// Thẻ "Tiến độ thanh toán": trạng thái từng đợt do máy chủ tính (tiền đổ vào đợt có hạn sớm nhất trước).
export function InstallmentsCard({ data, canWrite, onEdit }: InstallmentsCardProps) {
  const { installments, scheduleDifference } = data;
  const empty = installments.length === 0;
  return (
    <Card
      title="Tiến độ thanh toán"
      flush
      className="pm-card"
      actions={
        canWrite && !empty ? (
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Sửa tiến độ
          </Button>
        ) : undefined
      }
    >
      {scheduleDifference !== null && scheduleDifference !== 0 && (
        <div className="pm-band-wrap">
          <div className="pm-band pm-band--warn" role="status">
            <IconWarn />
            <span>
              Tổng hợp đồng đã đổi sau khi lập tiến độ: các đợt đang{' '}
              <b>
                {scheduleDifference > 0 ? 'thiếu' : 'thừa'} {money(Math.abs(scheduleDifference))}
              </b>
              .{' '}
              {canWrite && (
                <button type="button" className="pm-linkbtn" onClick={onEdit}>
                  Sửa tiến độ
                </button>
              )}
            </span>
          </div>
        </div>
      )}
      {empty ? (
        <EmptyState
          className="pm-empty"
          message="Chưa lập tiến độ thanh toán. Hợp đồng vẫn ghi phiếu thu được."
          action={
            canWrite ? (
              <Button variant="primary" size="sm" onClick={onEdit}>
                Lập tiến độ
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="pm-items" aria-label="Các đợt thanh toán">
          {installments.map((it) => (
            <li key={it.id} className={`pm-item pm-dot--${it.status.toLowerCase()}`}>
              <span className="pm-dot" aria-hidden="true" />
              <span className="pm-item__main">
                <b className="pm-item__title">{it.name}</b>
                <span className="pm-fx">Hạn {fmtDate(it.dueDate)}</span>
                {it.paidAmount > 0 && it.outstanding > 0 && <span className="pm-fx">đã thu {money(it.paidAmount)}</span>}
              </span>
              <span className="pm-item__right">
                <b className="pm-num">{money(it.amount)}</b>
                <StatusTag tone={STATUS_TONE[it.status]}>{INSTALLMENT_STATUS_LABELS[it.status]}</StatusTag>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
