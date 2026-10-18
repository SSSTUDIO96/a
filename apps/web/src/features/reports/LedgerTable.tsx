import { Link } from 'react-router';
import { PAYMENT_METHOD_LABELS } from '@makeup/shared';
import type { PaymentLedgerEntry } from '../../api/types';
import { Button, EmptyState, StatusTag } from '../../ui';
import { paymentAmount } from '../payments/money';
import { fmtDate } from '../payments/vnTime';

export interface LedgerTableProps {
  orgSlug: string;
  items: PaymentLedgerEntry[];
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

// Bảng sổ thu: phiếu đã huỷ vẫn hiện (cả dòng mờ, mã và số gạch ngang) để đối soát. 50 dòng/trang.
export function LedgerTable({ orgSlug, items, page, pageSize, total, onPage }: LedgerTableProps) {
  if (items.length === 0) return <EmptyState className="rp-empty" message="Không có phiếu nào trong kỳ này." />;
  const first = (page - 1) * pageSize + 1;
  const last = first + items.length - 1;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <>
      <div className="rp-wrapx">
        <table className="rp-tbl rp-cards rp-ledger">
          <thead>
            <tr>
              <th>Ngày thu</th>
              <th>Phiếu</th>
              <th>Hợp đồng · khách</th>
              <th className="rp-t-hide">Cách trả</th>
              <th className="rp-r">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const voided = p.voidedAt !== null;
              return (
                <tr key={p.id} className={voided ? 'rp-muted' : undefined} data-phieu={p.code}>
                  <td data-l="Ngày thu">{fmtDate(p.receivedAt)}</td>
                  <td className="rp-cell-main">
                    <span className={voided ? 'rp-strike' : undefined}>{p.code}</span>{' '}
                    {p.kind === 'REFUND' && <StatusTag tone="warn">Hoàn</StatusTag>}{' '}
                    {voided && (
                      <StatusTag tone="danger" title={p.voidReason ?? undefined}>
                        Đã huỷ
                      </StatusTag>
                    )}
                    <span className="rp-fx">{p.createdBy.fullName}</span>
                  </td>
                  <td data-l="Hợp đồng">
                    <Link to={`/${orgSlug}/thu-tien/${p.contract.id}`}>{p.contract.code}</Link> · {p.contract.customer.fullName}
                  </td>
                  <td className="rp-t-hide" data-l="Cách trả">
                    {PAYMENT_METHOD_LABELS[p.method]}
                  </td>
                  <td className={voided ? 'rp-r rp-num rp-strike' : 'rp-r rp-num'} data-l="Số tiền">
                    {paymentAmount(p.kind, p.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="rp-pager">
        <span>
          {first}–{last} / {total} phiếu
        </span>
        {pages > 1 && (
          <span className="rp-pager__btns">
            <Button size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
              Trang trước
            </Button>
            <span>
              Trang {page}/{pages}
            </span>
            <Button size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
              Trang sau
            </Button>
          </span>
        )}
      </div>
    </>
  );
}
