import { useState } from 'react';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentKind, type PaymentMethod, type Vnd } from '@makeup/shared';
import { createPayment } from '../../api/payments';
import { errorKind, fieldErrors, userMessage } from '../../api/errors';
import type { PaymentCreateInput, PaymentResult } from '../../api/types';
import { useOnline } from '../../layout/ErrorStates';
import { Button, Card, DateInput, IconWarn, MoneyInput, Segmented, SettingRow, TextInput } from '../../ui';
import { buildPaymentInput, overpayDetails, type PaymentFormErrors } from './model';
import { OverpayDialog, type OverpayInfo } from './OverpayDialog';
import { useRetainedKey } from './useRetainedKey';
import { todayVn } from './vnTime';

export interface PaymentFormProps {
  orgId: string;
  contractId: string;
  /** Số tiền điền sẵn (prefillAmount). */
  initialAmount: Vnd | null;
  /** Cách trả vừa dùng ở phiếu trước (giữ lại sau khi lưu). */
  initialMethod: PaymentMethod | null;
  /** Có quyền payments.void: hiện dòng "Loại phiếu" (Thu · Hoàn tiền). */
  canRefund: boolean;
  onSaved: (result: PaymentResult, method: PaymentMethod) => void;
}

type Banner = { tone: 'danger' | 'warn'; text: string } | null;

// Thẻ "Ghi phiếu thu" — luôn mở dưới cùng (khuôn Thu tiền đào tạo C). Màn đặt key mới sau mỗi lần lưu để xoá form.
export function PaymentForm({ orgId, contractId, initialAmount, initialMethod, canRefund, onSaved }: PaymentFormProps) {
  const today = todayVn();
  const [kind, setKind] = useState<PaymentKind>('RECEIPT');
  const [amount, setAmount] = useState<Vnd | null>(initialAmount);
  const [amountTyping, setAmountTyping] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(initialMethod);
  const [date, setDate] = useState<string | null>(today);
  const [dateTyping, setDateTyping] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<PaymentFormErrors>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState(false);
  const [overpay, setOverpay] = useState<OverpayInfo | null>(null);
  const [overpayError, setOverpayError] = useState<string | null>(null);
  const amountId = `${contractId}-so-tien`;
  // MoneyInput không nhận ref: tìm ô theo id để đưa tiêu điểm về.
  const focusAmount = () => document.getElementById(amountId)?.focus();
  const online = useOnline();
  const idem = useRetainedKey();
  const refund = kind === 'REFUND';

  async function send(input: PaymentCreateInput, fromOverpay: boolean) {
    setBusy(true);
    setBanner(null);
    if (fromOverpay) setOverpayError(null);
    try {
      const result = await createPayment(orgId, contractId, input, idem.keyFor(input));
      idem.reset();
      setOverpay(null);
      onSaved(result, input.method);
    } catch (err) {
      const over = overpayDetails(err);
      if (over && !input.allowOverpay) {
        setOverpay(over);
        return;
      }
      const kindOfErr = errorKind(err);
      if (kindOfErr === 'validation') {
        const fe = fieldErrors(err);
        const mine: PaymentFormErrors = {};
        for (const k of ['amount', 'method', 'receivedAt', 'note'] as const) if (fe[k]) mine[k] = fe[k];
        setErrors(mine);
        if (Object.keys(mine).length === 0 || fromOverpay) {
          if (fromOverpay) setOverpayError(userMessage(err));
          else setBanner({ tone: 'danger', text: userMessage(err) });
        } else if (fromOverpay) {
          setOverpay(null);
        }
        return;
      }
      if (kindOfErr === 'network') {
        // Bấm lại dùng CÙNG khoá (thân không đổi) — máy chủ không ghi phiếu đôi.
        const text = 'Mất kết nối khi lưu phiếu. Bấm lưu lại khi có mạng: phiếu không bị ghi đôi.';
        if (fromOverpay) setOverpayError(text);
        else setBanner({ tone: 'warn', text });
        return;
      }
      if (fromOverpay) setOverpayError(userMessage(err));
      else setBanner({ tone: 'danger', text: userMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    if (busy) return;
    if (amountTyping || dateTyping) {
      setErrors({ ...(amountTyping ? { amount: amountTyping } : {}), ...(dateTyping ? { receivedAt: dateTyping } : {}) });
      return;
    }
    const built = buildPaymentInput({ kind, amount, method, date, note }, todayVn());
    if (!built.ok) {
      setErrors(built.errors);
      if (built.errors.amount) focusAmount();
      return;
    }
    setErrors({});
    void send(built.input, false);
  }

  return (
    <Card
      title={refund ? 'Ghi phiếu hoàn tiền' : 'Ghi phiếu thu'}
      className="pm-card pm-form"
      footer={
        <>
          <span />
          <Button variant="primary" loading={busy} disabled={!online} onClick={submit}>
            {refund ? 'Lưu phiếu hoàn' : 'Lưu phiếu thu'}
          </Button>
        </>
      }
    >
      {banner && (
        <div className={`pm-band pm-band--${banner.tone} pm-band--form`} role="alert">
          <IconWarn />
          <span>{banner.text}</span>
        </div>
      )}
      {canRefund && (
        <SettingRow
          label="Loại phiếu"
          tip='Phiếu hoàn tiền cần quyền "Huỷ phiếu thu, ghi phiếu hoàn tiền". Không có quyền thì dòng này ẩn.'
          controlWidth={240}
        >
          <Segmented<PaymentKind>
            aria-label="Loại phiếu"
            options={[
              { value: 'RECEIPT', label: 'Thu' },
              { value: 'REFUND', label: 'Hoàn tiền' },
            ]}
            value={kind}
            onChange={(k) => {
              setKind(k);
              setBanner(null);
              setErrors((e) => ({ ...e, note: undefined }));
            }}
          />
        </SettingRow>
      )}
      <SettingRow
        label="Số tiền"
        htmlFor={amountId}
        required
        tip={
          refund
            ? 'Số tiền trả lại khách. Không vượt số đã thu thực tế của hợp đồng.'
            : 'Điền sẵn số còn thiếu của đợt chưa thu đủ gần nhất. Tiền tự đổ vào đợt có hạn sớm nhất.'
        }
        controlWidth={240}
      >
        <MoneyInput
          id={amountId}
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setErrors((e) => ({ ...e, amount: undefined }));
          }}
          onInputError={setAmountTyping}
          error={errors.amount}
          placeholder="Nhập số tiền"
        />
      </SettingRow>
      <SettingRow label="Cách trả" required className="pm-row-wide" controlWidth={420}>
        <div className="pm-method">
          <Segmented<PaymentMethod>
            aria-label="Cách trả"
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
            value={method}
            onChange={(m) => {
              setMethod(m);
              setErrors((e) => ({ ...e, method: undefined }));
            }}
          />
          {errors.method && (
            <div className="ui-field__error" role="alert">
              {errors.method}
            </div>
          )}
        </div>
      </SettingRow>
      <SettingRow label="Ngày thu" htmlFor={`${contractId}-ngay-thu`} tip="Mặc định hôm nay. Không chọn được ngày ở tương lai." controlWidth={240}>
        <DateInput
          id={`${contractId}-ngay-thu`}
          value={date}
          onChange={(v) => {
            setDate(v);
            setErrors((e) => ({ ...e, receivedAt: undefined }));
          }}
          onInputError={setDateTyping}
          error={errors.receivedAt}
        />
      </SettingRow>
      <SettingRow label="Ghi chú" htmlFor={`${contractId}-ghi-chu`} required={refund} controlWidth={240}>
        <TextInput
          id={`${contractId}-ghi-chu`}
          value={note}
          maxLength={1000}
          placeholder={refund ? 'Lý do hoàn, ví dụ: bớt 1 phù dâu' : 'Ví dụ: nội dung chuyển khoản'}
          error={errors.note}
          onChange={(e) => {
            setNote(e.target.value);
            setErrors((x) => ({ ...x, note: undefined }));
          }}
        />
      </SettingRow>
      <OverpayDialog
        info={overpay}
        initialNote={note}
        busy={busy}
        error={overpayError}
        onFixAmount={() => {
          setOverpay(null);
          setOverpayError(null);
          // Hộp đóng xong mới trả tiêu điểm về ô số tiền.
          setTimeout(focusAmount, 0);
        }}
        onConfirm={(reason) => {
          const built = buildPaymentInput({ kind, amount, method, date, note: reason }, todayVn());
          if (!built.ok) return;
          void send({ ...built.input, allowOverpay: true, note: reason }, true);
        }}
      />
    </Card>
  );
}
