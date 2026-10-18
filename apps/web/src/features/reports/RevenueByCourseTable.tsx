import type { RevenueBucket, RevenueCourseGroupRow, RevenueCourseRow, RevenueSegment } from '../../api/types';
import { Card, EmptyState, Tooltip } from '../../ui';
import { money } from '../payments/money';

// Bảng "Theo nhóm khoá" / "Theo khoá" (groupBy=courseGroup | course, kind=COURSE — bản vẽ C3 mục 1.5, 2.5).
// Mọi số lấy nguyên từ máy chủ; hợp đồng nhiều khoá được chia theo luật máy chủ (allocation — hiện nguyên văn ở tooltip),
// nên cộng các dòng bằng đúng dòng Tổng (= 4 ô số).
export interface RevenueByCourseTableProps {
  level: 'courseGroup' | 'course';
  rows: (RevenueCourseGroupRow | RevenueCourseRow)[];
  totals: RevenueBucket;
  allocation: string;
}

const SEGMENT_LABEL: Record<RevenueSegment, string> = {
  COURSE: 'Khoá học',
  COURSE_UNASSIGNED: 'Hợp đồng khoá học không còn dòng khoá nào',
  SERVICE: 'Dịch vụ makeup',
};

function rowLabel(r: RevenueCourseGroupRow | RevenueCourseRow, level: 'courseGroup' | 'course'): { main: string; sub: string | null } {
  if (r.segment !== 'COURSE') return { main: SEGMENT_LABEL[r.segment], sub: null };
  if (level === 'course' && 'course' in r && r.course) return { main: r.course.name, sub: `${r.course.code} · ${r.group?.name ?? 'Chưa xếp nhóm'}` };
  return { main: r.group?.name ?? 'Chưa xếp nhóm', sub: null };
}

export function RevenueByCourseTable({ level, rows, totals, allocation }: RevenueByCourseTableProps) {
  const title = level === 'course' ? 'Theo khoá' : 'Theo nhóm khoá';
  return (
    <Card
      title={
        <>
          {title} <Tooltip text={allocation} />
        </>
      }
      subtitle={`${rows.length} dòng · hợp đồng khoá học`}
      flush
      className="rp-table-card"
      aria-label={title}
    >
      {rows.length === 0 ? (
        <EmptyState className="rp-empty" message="Không có hợp đồng khoá học nào được tính hoặc có tiền thu trong kỳ này." />
      ) : (
        <div className="rp-wrapx">
          <table className="rp-tbl rp-cards" data-bang={level}>
            <thead>
              <tr>
                <th>{level === 'course' ? 'Khoá' : 'Nhóm khoá'}</th>
                <th className="rp-r">Hợp đồng</th>
                <th className="rp-r">Doanh số</th>
                <th className="rp-r">Cọc phải thu</th>
                <th className="rp-r">Đã thu thực tế</th>
                <th className="rp-r">Còn lại</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const l = rowLabel(r, level);
                return (
                  <tr key={`${r.segment}:${'course' in r && r.course ? r.course.id : (r.group?.id ?? '-')}:${i}`}>
                    <td className="rp-cell-main">
                      <b>{l.main}</b>
                      {l.sub && <span className="rp-fx">{l.sub}</span>}
                    </td>
                    <td className="rp-r rp-num" data-l="Hợp đồng">
                      {r.contractCount}
                    </td>
                    <td className="rp-r rp-num" data-l="Doanh số">
                      {money(r.sales)}
                    </td>
                    <td className="rp-r rp-num" data-l="Cọc phải thu">
                      {money(r.depositRequired)}
                    </td>
                    <td className="rp-r rp-num" data-l="Đã thu thực tế">
                      {money(r.collected)}
                    </td>
                    <td className="rp-r rp-num rp-b" data-l="Còn lại">
                      {money(r.outstanding)}
                    </td>
                  </tr>
                );
              })}
              <tr className="rp-total-row">
                <td className="rp-cell-main">
                  <b>Tổng</b>
                </td>
                <td className="rp-r rp-num rp-b" data-l="Hợp đồng">
                  {totals.contractCount}
                </td>
                <td className="rp-r rp-num rp-b" data-l="Doanh số">
                  {money(totals.sales)}
                </td>
                <td className="rp-r rp-num rp-b" data-l="Cọc phải thu">
                  {money(totals.depositRequired)}
                </td>
                <td className="rp-r rp-num rp-b" data-l="Đã thu thực tế">
                  {money(totals.collected)}
                </td>
                <td className="rp-r rp-num rp-b" data-l="Còn lại">
                  {money(totals.outstanding)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
