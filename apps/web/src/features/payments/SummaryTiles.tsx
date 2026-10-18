import type { PaymentSummary } from '../../api/types';
import { StatGrid, StatTile } from '../../ui';
import { money } from './money';

// 4 ô số đầu màn Thu tiền — đọc nguyên `summary` máy chủ trả (summarizePayments ở @makeup/shared), không tự cộng.
export function SummaryTiles({ summary }: { summary: PaymentSummary }) {
  const overpaid = summary.overpaid > 0;
  return (
    <StatGrid label="Tóm tắt tiền hợp đồng" className="pm-tiles">
      <StatTile label="Tổng" value={<span data-so="total">{money(summary.total)}</span>} />
      <StatTile
        label="Cọc phải thu"
        value={<span data-so="depositRequired">{money(summary.depositRequired)}</span>}
        note={summary.depositOutstanding > 0 ? `còn thiếu ${money(summary.depositOutstanding)}` : undefined}
        noteTone="warn"
      />
      <StatTile
        label="Đã thu thực tế"
        tip="Phiếu thu trừ phiếu hoàn, không tính phiếu đã huỷ."
        value={<span data-so="paid">{money(summary.paid)}</span>}
      />
      <StatTile
        label="Còn lại"
        variant="highlight"
        // Khách trả thừa: máy chủ trả remaining âm và overpaid > 0 → ô hiện 0 ₫, số thừa ghi riêng bên dưới.
        value={<span data-so="remaining">{money(overpaid ? 0 : summary.remaining)}</span>}
        note={overpaid ? `Khách trả thừa ${money(summary.overpaid)}` : undefined}
      />
    </StatGrid>
  );
}

export function SummaryTilesSkeleton() {
  return (
    <StatGrid label="Đang tải tóm tắt tiền" className="pm-tiles">
      {['Tổng', 'Cọc phải thu', 'Đã thu thực tế', 'Còn lại'].map((l) => (
        <StatTile key={l} label={l} value="" loading />
      ))}
    </StatGrid>
  );
}
