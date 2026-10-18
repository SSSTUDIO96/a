// "Lịch sử thuê bao" (bản vẽ C2 mục 5.4 thẻ 4): Gói (+ "Hiện hành") · Trạng thái · Thời hạn · Ghi chú (ẩn ở máy tính bảng).
// Dòng hiện hành tô --accent-soft. Điện thoại: mỗi dòng thành một khối nhãn–giá trị.
import type { OrgSubscriptionRow } from '../../api/platform';
import { Card, StatusTag } from '../../ui';
import { fmtDate, SUBSCRIPTION_LABELS } from './labels';

export function periodText(startsAt: string, endsAt: string | null): string {
  return `${fmtDate(startsAt)} → ${endsAt ? fmtDate(endsAt) : 'không thời hạn'}`;
}

export function SubscriptionHistory({ rows }: { rows: OrgSubscriptionRow[] }) {
  return (
    <Card title="Lịch sử thuê bao" flush>
      {rows.length === 0 ? (
        <p className="pf-muted pf-pad">Chưa có dòng thuê bao nào.</p>
      ) : (
        <table className="pf-tbl">
          <thead>
            <tr>
              <th>Gói</th>
              <th>Trạng thái</th>
              <th>Thời hạn</th>
              <th className="pf-t-hide">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.isCurrent ? 'is-current' : undefined}>
                <td>
                  <b>{r.plan.name}</b>{' '}
                  {r.isCurrent ? (
                    <StatusTag tone="accent">Hiện hành</StatusTag>
                  ) : new Date(r.startsAt).getTime() > Date.now() ? (
                    <StatusTag tone="neutral">Đã hẹn</StatusTag>
                  ) : null}
                </td>
                <td data-l="Trạng thái">{SUBSCRIPTION_LABELS[r.status]}</td>
                <td data-l="Thời hạn" className="num">
                  {periodText(r.startsAt, r.endsAt)}
                </td>
                <td data-l="Ghi chú" className={r.note ? 'pf-t-hide pf-note' : 'pf-t-hide pf-faint'}>
                  {r.note ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
