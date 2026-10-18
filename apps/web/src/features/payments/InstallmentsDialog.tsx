import { useEffect, useMemo, useState } from 'react';
import { MAX_INSTALLMENTS, PaymentMathError, checkInstallmentPlan, suggestInstallments, type Vnd } from '@makeup/shared';
import { putInstallments } from '../../api/payments';
import { errorKind, fieldErrors, userMessage } from '../../api/errors';
import type { ContractPayments } from '../../api/types';
import { Button, DateInput, Dialog, IconClose, IconPlus, IconWarn, MoneyInput, TextInput } from '../../ui';
import { money } from './money';
import { anchorNote, suggestDates } from './suggestPlan';
import { useSuggestAnchor } from './useSuggestAnchor';
import { daysBetween, dueDateIso, todayVn, vnDate } from './vnTime';

interface Row {
  key: number;
  name: string;
  /** "YYYY-MM-DD" */
  due: string | null;
  amount: Vnd | null;
  isDeposit: boolean;
}

let seq = 0;
const nextKey = () => ++seq;

export interface InstallmentsDialogProps {
  open: boolean;
  orgId: string;
  data: ContractPayments;
  onClose: () => void;
  onSaved: (data: ContractPayments) => void;
}

// "Sửa tiến độ" — PUT /contracts/:id/installments (thay toàn bộ). Kiểm trước bằng checkInstallmentPlan của @makeup/shared:
// lệch tổng → dải đỏ đúng câu của hàm và khoá nút Lưu. Máy chủ vẫn kiểm lại.
export function InstallmentsDialog({ open, orgId, data, onClose, onSaved }: InstallmentsDialogProps) {
  const { contract, summary } = data;
  const [rows, setRows] = useState<Row[]>([]);
  const [typing, setTyping] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [suggestError, setSuggestError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(
      data.installments.map((i) => ({ key: nextKey(), name: i.name, due: vnDate(i.dueDate), amount: i.amount, isDeposit: i.isDeposit })),
    );
    setTyping({});
    setServerError(null);
    setCellErrors({});
    setSuggestError(null);
    // Chỉ nạp lại khi mở hộp.
  }, [open]);

  const today = todayVn();
  // Mốc chia đợt (T1): ngày sự kiện, hoặc ngày kết thúc lớp muộn nhất của hợp đồng khoá học (máy chủ trả sẵn).
  const anchor = useSuggestAnchor(contract);
  const hasDeposit = summary.depositRequired > 0;
  const plans = [1, 2, 3].map((n) => suggestDates(today, anchor, n, hasDeposit));
  const canSuggestEvent = anchor?.kind === 'event' && daysBetween(today, anchor.date) >= 1;
  const planNote = anchorNote(today, anchor) ?? plans.map((p) => (p.ok ? p.note : null)).find(Boolean) ?? null;
  // Chỉ ghi lý do của số đợt nhỏ nhất bị tắt (không đủ chỗ cho 2 đợt thì hiển nhiên không đủ cho 3).
  const firstBlocked = plans.find((p) => !p.ok);
  const blockedNotes = firstBlocked && !firstBlocked.ok ? [firstBlocked.reason] : [];

  function suggest(count: number) {
    const dates = plans[count - 1];
    if (!dates || !dates.ok) return;
    try {
      // Tiền từng đợt: suggestInstallments (@makeup/shared) chia như cũ; ngày hạn: suggestDates (chia đều tới mốc).
      const out = suggestInstallments(summary.total, summary.depositRequired, count, new Date(`${today}T12:00:00+07:00`), 1);
      setRows(out.map((s, i) => ({ key: nextKey(), name: s.name, due: dates.days[i] ?? vnDate(s.dueDate), amount: s.amount, isDeposit: s.isDeposit })));
      setSuggestError(null);
      setServerError(null);
      setCellErrors({});
    } catch (err) {
      setSuggestError(err instanceof PaymentMathError ? err.message : 'Không chia gợi ý được.');
    }
  }

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const incomplete = rows.some((r) => r.name.trim() === '' || r.due === null || r.amount === null);
  const hasTyping = Object.values(typing).some(Boolean);
  // Tổng các số đang gõ trong bảng (chỉ để hiện) — luật tiền thật nằm ở checkInstallmentPlan và máy chủ.
  const rowsTotal = rows.reduce((s, r) => s + (r.amount ?? 0), 0);

  const planError = useMemo(() => {
    if (rows.length === 0 || incomplete) return null;
    try {
      checkInstallmentPlan(
        summary.total,
        rows.map((r) => ({ amount: r.amount as Vnd, isDeposit: r.isDeposit })),
      );
      return null;
    } catch (err) {
      return err instanceof PaymentMathError ? err.message : 'Tiến độ chưa hợp lệ.';
    }
  }, [rows, incomplete, summary.total]);

  const blocked = incomplete || hasTyping || planError !== null;

  async function save() {
    if (blocked || busy) return;
    setBusy(true);
    setServerError(null);
    setCellErrors({});
    try {
      const result = await putInstallments(orgId, contract.id, {
        installments: rows.map((r) => ({
          name: r.name.trim(),
          dueDate: dueDateIso(r.due as string),
          amount: r.amount as Vnd,
          isDeposit: r.isDeposit,
        })),
      });
      onSaved(result);
    } catch (err) {
      if (errorKind(err) === 'validation') setCellErrors(fieldErrors(err));
      setServerError(userMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const cellError = (i: number, f: string) => cellErrors[`installments.${i}.${f}`] ?? null;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      eyebrow={`${contract.code} · Tổng ${money(summary.total)} · Cọc phải thu ${money(summary.depositRequired)}`}
      title="Tiến độ thanh toán"
      size="sm"
      width={720}
      className="pm-plan-dlg"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button variant="primary" loading={busy} disabled={blocked} onClick={() => void save()}>
            Lưu tiến độ
          </Button>
        </>
      }
    >
      <div className="pm-plan-suggest">
        <span className="pm-fx">Chia gợi ý:</span>
        {canSuggestEvent && (
          <Button size="sm" onClick={() => suggest(1)}>
            Cọc + còn lại vào ngày sự kiện
          </Button>
        )}
        {/* Không có ngày sự kiện (khoá học) hoặc ngày sự kiện đã qua: Cọc + 1 đợt (bản vẽ C3 mục 2.3: Cọc + 1/2/3). */}
        {!canSuggestEvent && (
          <Button size="sm" disabled={!plans[0]?.ok} onClick={() => suggest(1)}>
            Cọc + 1 đợt
          </Button>
        )}
        <Button size="sm" disabled={!plans[1]?.ok} onClick={() => suggest(2)}>
          Cọc + 2 đợt
        </Button>
        <Button size="sm" disabled={!plans[2]?.ok} onClick={() => suggest(3)}>
          Cọc + 3 đợt
        </Button>
      </div>
      {(planNote || blockedNotes.length > 0) && (
        <div className="pm-plan-note" data-o="moc-chia-dot">
          {planNote && <p>{planNote}</p>}
          {blockedNotes.map((m) => (
            <p key={m} className="is-warn">
              {m}
            </p>
          ))}
        </div>
      )}
      {suggestError && (
        <div className="pm-band pm-band--danger" role="alert">
          <IconWarn />
          <span>{suggestError}</span>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="pm-plan-empty">Chưa có đợt nào. Lưu khi không có đợt nào nghĩa là bỏ tiến độ thanh toán.</p>
      ) : (
        <table className="pm-plan">
          <thead>
            <tr>
              <th>Tên đợt</th>
              <th>Hạn</th>
              <th className="pm-r">Số tiền</th>
              <th className="pm-c">Đợt cọc</th>
              <th>
                <span className="sr-only">Xoá</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td data-l="Tên đợt">
                  <TextInput
                    size="sm"
                    aria-label={`Tên đợt ${i + 1}`}
                    value={r.name}
                    maxLength={120}
                    error={r.name.trim() === '' ? 'Nhập tên đợt.' : cellError(i, 'name')}
                    onChange={(e) => update(r.key, { name: e.target.value })}
                  />
                </td>
                <td data-l="Hạn">
                  <DateInput
                    size="sm"
                    aria-label={`Hạn đợt ${i + 1}`}
                    value={r.due}
                    onChange={(v) => update(r.key, { due: v })}
                    onInputError={(m) => setTyping((t) => ({ ...t, [`d${r.key}`]: m }))}
                    error={r.due === null && !typing[`d${r.key}`] ? 'Chọn hạn.' : cellError(i, 'dueDate')}
                  />
                </td>
                <td data-l="Số tiền">
                  <MoneyInput
                    size="sm"
                    aria-label={`Số tiền đợt ${i + 1}`}
                    value={r.amount}
                    onChange={(v) => update(r.key, { amount: v })}
                    onInputError={(m) => setTyping((t) => ({ ...t, [`a${r.key}`]: m }))}
                    error={r.amount === null && !typing[`a${r.key}`] ? 'Nhập số tiền.' : cellError(i, 'amount')}
                    placeholder="0 ₫"
                  />
                </td>
                <td data-l="Đợt cọc" className="pm-c">
                  <input
                    type="radio"
                    name="pm-plan-coc"
                    className="pm-radio"
                    aria-label={`Đợt ${i + 1} là đợt cọc`}
                    checked={r.isDeposit}
                    onChange={() => setRows((rs) => rs.map((x) => ({ ...x, isDeposit: x.key === r.key })))}
                    // Bấm lại vào đợt đang là cọc → bỏ chọn (tiến độ được phép không có đợt cọc).
                    onClick={() => {
                      if (r.isDeposit) update(r.key, { isDeposit: false });
                    }}
                  />
                </td>
                <td className="pm-c">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<IconClose />}
                    aria-label={`Xoá đợt ${i + 1}`}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="pm-plan-foot">
        <Button
          variant="dashed"
          size="sm"
          icon={<IconPlus />}
          disabled={rows.length >= MAX_INSTALLMENTS}
          onClick={() => setRows((rs) => [...rs, { key: nextKey(), name: '', due: null, amount: null, isDeposit: false }])}
        >
          Thêm đợt
        </Button>
        <span className="pm-plan-sum">
          Tổng các đợt <b className="pm-num">{money(rowsTotal)}</b>
        </span>
      </div>
      {planError && (
        <div className="pm-band pm-band--danger" role="alert" data-loi="tien-do">
          <IconWarn />
          <span>{planError}</span>
        </div>
      )}
      {serverError && (
        <div className="pm-band pm-band--danger" role="alert">
          <IconWarn />
          <span>{serverError}</span>
        </div>
      )}
    </Dialog>
  );
}
