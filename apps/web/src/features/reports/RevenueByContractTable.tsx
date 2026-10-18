import { Link } from 'react-router';
import type { RevenueContractRow } from '../../api/types';
import { Card, EmptyState, StatusTag } from '../../ui';
import { money } from '../payments/money';
import { fmtDayMonth } from '../payments/vnTime';

export interface RevenueByContractTableProps {
  orgSlug: string;
  rows: RevenueContractRow[];
}

// Bảng "Theo hợp đồng" (groupBy=contract). Số nào cũng lấy nguyên từ máy chủ; hợp đồng đã huỷ: Còn lại = null → "—".
// Máy tính bảng ẩn cột Xác nhận, Cọc; điện thoại thành thẻ.
export function RevenueByContractTable({ orgSlug, rows }: RevenueByContractTableProps) {
  return (
    <Card title="Theo hợp đồng" subtitle={`${rows.length} hợp đồng`} flush className="rp-table-card">
      {rows.length === 0 ? (
        <EmptyState className="rp-empty" message="Không có hợp đồng nào được tính hoặc có tiền thu trong kỳ này." />
      ) : (
        <div className="rp-wrapx">
          <table className="rp-tbl rp-cards">
            <thead>
              <tr>
                <th>Hợp đồng</th>
                <th className="rp-t-hide">Xác nhận</th>
                <th className="rp-r">Tổng</th>
                <th className="rp-r rp-t-hide">Cọc</th>
                <th className="rp-r">Đã thu</th>
                <th className="rp-r">Thu trong kỳ</th>
                <th className="rp-r">Còn lại</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.contractId} className={r.bookedInPeriod ? undefined : 'rp-muted'} data-hop-dong={r.code}>
                  <td className="rp-cell-main">
                    <Link className="rp-code" to={`/${orgSlug}/hop-dong/${r.contractId}`}>
                      {r.code}
                    </Link>{' '}
                    {!r.bookedInPeriod && r.status !== 'CANCELLED' && (
                      <StatusTag tone="neutral" title="Chỉ có tiền thu/hoàn trong kỳ, doanh số tính ở kỳ khác">
                        Kỳ khác
                      </StatusTag>
                    )}
                    {r.status === 'CANCELLED' && <StatusTag tone="danger">Đã huỷ</StatusTag>}
                    <span className="rp-fx">{r.customer.fullName}</span>
                  </td>
                  <td className="rp-t-hide" data-l="Xác nhận">
                    {r.confirmedAt ? fmtDayMonth(r.confirmedAt) : '—'}
                  </td>
                  <td className="rp-r rp-num" data-l="Tổng">
                    {money(r.total)}
                  </td>
                  <td className="rp-r rp-num rp-t-hide" data-l="Cọc">
                    {money(r.depositRequired)}
                  </td>
                  <td className="rp-r rp-num" data-l="Đã thu">
                    {money(r.paid)}
                  </td>
                  <td className="rp-r rp-num" data-l="Thu trong kỳ">
                    {money(r.paidInPeriod)}
                  </td>
                  <td className="rp-r rp-num rp-b" data-l="Còn lại">
                    {money(r.remaining)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
