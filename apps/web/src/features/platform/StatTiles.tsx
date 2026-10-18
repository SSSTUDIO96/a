// 4 ô số trang chủ (bản vẽ C2 mục 5.3). "Doanh thu thuê bao dự kiến/tháng" luôn kèm "không phải tiền đã thu";
// tooltip là nguyên văn projectedMonthlyRevenueNote của máy chủ.
import type { PlatformStats } from '../../api/platform';
import { formatVnd, StatGrid, StatTile } from '../../ui';
import { fmtInt } from './labels';

export function StatTiles({ stats }: { stats: PlatformStats }) {
  const o = stats.organizations;
  return (
    <StatGrid label="Số liệu nền tảng">
      <StatTile label="Tổ chức" value={fmtInt(o.total)} note={`${fmtInt(o.byStatus.SUSPENDED)} đang khoá`} />
      <StatTile
        label="Đang dùng trả phí"
        value={fmtInt(o.bySubscriptionStatus.ACTIVE)}
        note={`${fmtInt(o.bySubscriptionStatus.TRIAL)} đang dùng thử`}
      />
      <StatTile
        label="Sắp hết hạn 30 ngày"
        variant="danger"
        value={fmtInt(stats.expiringIn30Days)}
        note={`${fmtInt(o.bySubscriptionStatus.EXPIRED)} đã hết hạn · ${fmtInt(o.bySubscriptionStatus.PAST_DUE)} chậm thanh toán`}
      />
      <StatTile
        label="Doanh thu thuê bao dự kiến/tháng"
        variant="highlight"
        tip={stats.projectedMonthlyRevenueNote}
        value={formatVnd(stats.projectedMonthlyRevenue)}
        note="không phải tiền đã thu"
      />
    </StatGrid>
  );
}
