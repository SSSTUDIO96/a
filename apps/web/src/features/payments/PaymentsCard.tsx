import { PAYMENT_METHOD_LABELS } from '@makeup/shared';
import type { Payment } from '../../api/types';
import { Button, Card, EmptyState, StatusTag } from '../../ui';
import { paymentAmount } from './money';
import { fmtDate } from './vnTime';

export interface PaymentsCardProps {
  payments: Payment[];
  canVoid: boolean;
  onVoid: (p: Payment) => void;
}

// Thẻ "Phiếu đã ghi": xếp như máy chủ trả (ngày thu mới nhất trước), có cả phiếu đã huỷ để đối soát.
export function PaymentsCard({ payments, canVoid, onVoid }: PaymentsCardProps) {
  return (
    <Card title="Phiếu đã ghi" subtitle={payments.length > 0 ? `${payments.length} phiếu` : undefined} flush className="pm-card">
      {payments.length === 0 ? (
        <EmptyState className="pm-empty" message="Chưa có phiếu nào." />
      ) : (
        <ul className="pm-items" aria-label="Phiếu thu và phiếu hoàn">
          {payments.map((p) => {
            const voided = p.voidedAt !== null;
            return (
              <li key={p.id} className={`pm-item ${voided ? 'pm-dot--void' : 'pm-dot--paid'}`} data-phieu={p.code}>
                <span className="pm-dot" aria-hidden="true" />
                <span className="pm-item__main">
                  <b className={voided ? 'pm-item__title pm-strike' : 'pm-item__title'}>
                    {p.code} · {fmtDate(p.receivedAt)} · {PAYMENT_METHOD_LABELS[p.method]}
                  </b>
                  <span className="pm-fx">
                    Ghi bởi {p.createdBy.fullName}
                    {p.note ? ` · ${p.note}` : ''}
                  </span>
                  {voided && (
                    <span>
                      <StatusTag tone="danger" className="pm-tag-wrap">
                        Đã huỷ: {p.voidReason}
                      </StatusTag>
                    </span>
                  )}
                </span>
                <span className="pm-item__right">
                  <b className={voided ? 'pm-num pm-strike' : 'pm-num'}>{paymentAmount(p.kind, p.amount)}</b>
                  {p.kind === 'REFUND' && <StatusTag tone="warn">Hoàn</StatusTag>}
                  {canVoid && !voided && (
                    <Button variant="ghost" size="sm" onClick={() => onVoid(p)} aria-label={`Huỷ phiếu ${p.code}`}>
                      Huỷ phiếu
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
