import { Card, MoneyInput, Textarea, Tooltip, formatVnd, type Vnd } from '../../ui';

// Thẻ tổng (bản vẽ 4.3): Tạm tính · Giảm giá · Tổng · Cọc cần thu · Ghi chú. Tạm tính/Tổng lấy nguyên từ máy chủ.
export interface TotalsCardProps {
  subtotal: Vnd | null;
  total: Vnd | null;
  suggestedDeposit: Vnd | null;
  discount: Vnd;
  // Cọc đang hiện: số người dùng đặt, không thì số máy chủ trả.
  deposit: Vnd | null;
  notes: string;
  moneyLocked: boolean;
  notesLocked: boolean;
  pending: boolean;
  errors: Record<string, string>;
  // Màn tự đặt lại giá trị (nạp lại, tải bản mới) → ô tiền bỏ chữ lỗi cũ dù số không đổi.
  resetKey?: number;
  onDiscount: (v: Vnd) => void;
  onDeposit: (v: Vnd | null) => void;
  onNotes: (v: string) => void;
  onNotesBlur?: () => void;
}

export function TotalsCard(p: TotalsCardProps) {
  const dash = (v: Vnd | null) => (v === null ? '—' : formatVnd(v));
  return (
    <Card aria-label="Tổng hợp đồng">
      <div className="ct-tot" aria-busy={p.pending || undefined}>
        <div className="ct-trow">
          <span className="ct-trow__l">Tạm tính</span>
          <span className="ct-trow__r ct-num ct-pend" data-o="tam-tinh">
            {dash(p.subtotal)}
          </span>
        </div>
        <div className="ct-trow">
          <span className="ct-trow__l">
            Giảm giá
            <Tooltip text="Giảm trên tổng hợp đồng. Tổng = tạm tính − giảm giá." />
          </span>
          <MoneyInput
            id="hd-giam-gia"
            aria-label="Giảm giá"
            value={p.discount === 0 ? null : p.discount}
            placeholder="0 ₫"
            onChange={(v) => p.onDiscount(v ?? 0)}
            resetKey={p.resetKey}
            disabled={p.moneyLocked}
            error={p.errors.discount}
          />
        </div>
        <div className="ct-trow">
          <span className="ct-trow__l ct-big">Tổng</span>
          <span className="ct-trow__r ct-num ct-big ct-pend" data-o="tong">
            {dash(p.total)}
          </span>
        </div>
        <div className="ct-trow">
          <span className="ct-trow__l">
            Cọc cần thu
            <Tooltip
              text={`Gợi ý bằng tổng tiền cọc mặc định của các gói trong hợp đồng. Sửa được.${p.suggestedDeposit !== null ? ` Gợi ý: ${formatVnd(p.suggestedDeposit)}.` : ''}`}
            />
          </span>
          <MoneyInput
            id="hd-coc"
            aria-label="Cọc cần thu"
            value={p.deposit}
            placeholder={p.suggestedDeposit !== null ? `Gợi ý ${formatVnd(p.suggestedDeposit)}` : undefined}
            onChange={p.onDeposit}
            resetKey={p.resetKey}
            disabled={p.moneyLocked}
            error={p.errors.depositRequired}
          />
        </div>
        <div className="ct-trow ct-trow--note">
          <label className="ct-trow__l" htmlFor="hd-ghi-chu">
            Ghi chú hợp đồng
          </label>
          <Textarea
            id="hd-ghi-chu"
            rows={2}
            value={p.notes}
            disabled={p.notesLocked}
            onChange={(e) => p.onNotes(e.target.value)}
            onBlur={p.onNotesBlur}
            error={p.errors.notes}
          />
        </div>
      </div>
    </Card>
  );
}
