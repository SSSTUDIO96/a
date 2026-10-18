// Hộp "Đổi gói / gia hạn" (bản vẽ C2 mục 5.5, bản mẫu #gia-han): thêm MỘT dòng thuê bao mới, dòng cũ giữ làm lịch sử.
// POST /platform/organizations/:id/subscriptions {planId, status, startsAt?, months | endsAt | endsAt:null, note?}
// — không bao giờ gửi cả months lẫn endsAt.
import { useEffect, useId, useMemo, useState } from 'react';
import { conflictFields, errorKind, fieldErrors, userMessage } from '../../api/errors';
import {
  addSubscription,
  listPlans,
  type OrgDetail,
  type OrgListItem,
  type PlanView,
  type SubscriptionInput,
  type SubscriptionStatus,
} from '../../api/platform';
import { DateInput, Dialog, formatVnd, IconClock, IconWarn, Segmented, Select, SettingRow, Textarea } from '../../ui';
import {
  addMonths,
  DEFAULT_PLAN_CODE,
  fmtDate,
  NEW_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_LABELS,
  vnDay,
  vnMidnightIso,
} from './labels';
import { useLoad } from './useLoad';

/** Tổ chức cần đổi gói / gia hạn — dựng từ dòng danh sách hoặc từ chi tiết. */
export interface RenewTarget {
  id: string;
  name: string;
  hasSubscription: boolean;
  /** Gói đang áp (kể cả gói mặc định khi chưa có thuê bao) — mặc định của ô Gói cước. */
  planId: string | null;
  planName: string | null;
  /** Hạn của thuê bao hiện hành. */
  endsAt: string | null;
  /** Mốc nối tiếp: hạn của dòng thuê bao mới nhất nếu dòng đó còn hiệu lực và chưa hết — mặc định của ô Bắt đầu. */
  renewFrom: string | null;
}

const LIVE: readonly SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'PAST_DUE'];

function stillRunning(status: SubscriptionStatus, endsAt: string | null, now: number): endsAt is string {
  return LIVE.includes(status) && endsAt !== null && new Date(endsAt).getTime() > now;
}

export function renewTargetFromItem(o: OrgListItem, now = Date.now()): RenewTarget {
  const s = o.subscription;
  return {
    id: o.id,
    name: o.name,
    hasSubscription: s !== null,
    planId: s?.plan.id ?? null,
    planName: s?.plan.name ?? null,
    endsAt: s?.endsAt ?? null,
    renewFrom: s && stillRunning(s.status, s.endsAt, now) ? s.endsAt : null,
  };
}

export function renewTargetFromDetail(d: OrgDetail, now = Date.now()): RenewTarget {
  // subscriptions[] xếp startsAt giảm dần: dòng đầu là dòng mới nhất (có thể là kỳ đã hẹn trong tương lai).
  const latest = d.subscriptions[0];
  return {
    id: d.id,
    name: d.name,
    hasSubscription: d.currentSubscription !== null,
    planId: d.effectivePlan?.plan.id ?? null,
    planName: d.effectivePlan?.plan.name ?? null,
    endsAt: d.currentSubscription?.endsAt ?? null,
    renewFrom: latest && stillRunning(latest.status, latest.endsAt, now) ? latest.endsAt : null,
  };
}

type Duration = '1' | '3' | '6' | '12' | 'den-ngay' | 'khong-han';
const DURATIONS: readonly { value: Duration; label: string }[] = [
  { value: '1', label: '1 tháng' },
  { value: '3', label: '3' },
  { value: '6', label: '6' },
  { value: '12', label: '12 tháng' },
  { value: 'den-ngay', label: 'Đến ngày…' },
  { value: 'khong-han', label: 'Không hạn' },
];

export interface SubscriptionForm {
  planId: string;
  status: SubscriptionStatus;
  /** YYYY-MM-DD (giờ Việt Nam). */
  startDay: string;
  duration: Duration;
  /** YYYY-MM-DD, chỉ khi duration = 'den-ngay'. */
  endDay: string | null;
  note: string;
}

/**
 * Thời điểm bắt đầu gửi lên:
 * - ngày = ngày của mốc nối tiếp → gửi ĐÚNG mốc đó (dòng mới nối liền dòng cũ, không hở, không chồng);
 * - ngày = hôm nay → không gửi (máy chủ lấy "bây giờ");
 * - ngày khác → 00:00 giờ Việt Nam của ngày đó.
 */
export function startInstant(startDay: string, renewFrom: string | null, now: Date): { send: string | undefined; at: Date } {
  if (renewFrom && vnDay(renewFrom) === startDay) return { send: renewFrom, at: new Date(renewFrom) };
  if (startDay === vnDay(now)) return { send: undefined, at: now };
  const iso = vnMidnightIso(startDay);
  return { send: iso, at: new Date(iso) };
}

/** Dựng thân POST; trả lỗi theo ô nếu form chưa đủ. Chỉ một trong months / endsAt. */
export function buildSubscriptionInput(
  f: SubscriptionForm,
  renewFrom: string | null,
  now: Date = new Date(),
): { ok: true; input: SubscriptionInput; endsAt: Date | null } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!f.planId) errors.planId = 'Chọn gói cước.';
  const start = startInstant(f.startDay, renewFrom, now);
  const base = { planId: f.planId, status: f.status, ...(start.send ? { startsAt: start.send } : {}), ...(f.note.trim() ? { note: f.note.trim() } : {}) };
  let input: SubscriptionInput;
  let endsAt: Date | null;
  if (f.duration === 'khong-han') {
    input = { ...base, endsAt: null };
    endsAt = null;
  } else if (f.duration === 'den-ngay') {
    if (!f.endDay) {
      errors.endsAt = 'Chọn ngày hết hạn.';
      return { ok: false, errors };
    }
    const iso = vnMidnightIso(f.endDay);
    endsAt = new Date(iso);
    if (endsAt.getTime() <= start.at.getTime()) errors.endsAt = 'Ngày hết hạn phải sau ngày bắt đầu.';
    input = { ...base, endsAt: iso };
  } else {
    const months = Number(f.duration);
    input = { ...base, months };
    endsAt = addMonths(start.at, months);
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, input, endsAt };
}

export interface SubscriptionDialogProps {
  target: RenewTarget | null;
  onClose: () => void;
  /** Lưu xong: màn tải lại chi tiết / danh sách / số liệu. */
  onSaved: () => void;
}

export function SubscriptionDialog({ target, onClose, onSaved }: SubscriptionDialogProps) {
  if (!target) return null;
  return <SubscriptionDialogBody key={target.id} target={target} onClose={onClose} onSaved={onSaved} />;
}

function SubscriptionDialogBody({ target, onClose, onSaved }: { target: RenewTarget; onClose: () => void; onSaved: () => void }) {
  const ids = useId();
  const plans = useLoad('plans', (signal) => listPlans(signal));
  const [now] = useState(() => new Date());
  const [form, setForm] = useState<SubscriptionForm>(() => ({
    planId: '',
    status: 'ACTIVE',
    startDay: vnDay(target.renewFrom ?? now),
    duration: '12',
    endDay: null,
    note: '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [inputErr, setInputErr] = useState<Record<string, string | null>>({});

  const options = useMemo(
    () => (plans.data?.items ?? []).filter((p: PlanView) => p.isActive || p.code === DEFAULT_PLAN_CODE),
    [plans.data],
  );
  // Mặc định = gói hiện tại, nếu gói đó còn chọn được.
  useEffect(() => {
    if (form.planId || options.length === 0) return;
    if (target.planId && options.some((p) => p.id === target.planId)) setForm((f) => ({ ...f, planId: target.planId ?? '' }));
  }, [options, target.planId, form.planId]);
  const currentPlanHidden =
    plans.data !== null && target.planId !== null && !options.some((p) => p.id === target.planId) ? target.planName : null;

  const preview = buildSubscriptionInput({ ...form, planId: form.planId || 'x' }, target.renewFrom, now);
  const shownEnd =
    form.duration === 'khong-han'
      ? 'Không hạn'
      : preview.ok && preview.endsAt
        ? fmtDate(preview.endsAt.toISOString())
        : '—';

  const set = <K extends keyof SubscriptionForm>(k: K, v: SubscriptionForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      const { [k]: _drop, ...rest } = e;
      return k === 'duration' || k === 'endDay' || k === 'startDay' ? { ...rest, endsAt: '' } : rest;
    });
  };

  async function save() {
    if (saving) return;
    setBanner(null);
    if (Object.values(inputErr).some(Boolean)) return;
    const built = buildSubscriptionInput(form, target.renewFrom, new Date());
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setSaving(true);
    try {
      await addSubscription(target.id, built.input);
      onSaved();
      onClose();
    } catch (err) {
      const kind = errorKind(err);
      if (kind === 'validation') {
        const fe = fieldErrors(err);
        const mapped: Record<string, string> = {};
        if (fe.endsAt) mapped.endsAt = fe.endsAt;
        if (fe.startsAt) mapped.startsAt = fe.startsAt;
        if (fe.months) mapped.endsAt = fe.months;
        if (fe.planId) mapped.planId = fe.planId;
        if (fe.note) mapped.note = fe.note;
        if (Object.keys(mapped).length > 0) setErrors(mapped);
        else setBanner(userMessage(err));
      } else if (kind === 'conflict') {
        // 409: dải đỏ trong hộp, chữ máy chủ (ngày bắt đầu lùi, gói ngừng bán, chồng thời gian).
        setBanner(userMessage(err));
        if (conflictFields(err).includes('planId')) setErrors({ planId: userMessage(err) });
      } else {
        setBanner(userMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const eyebrow = target.hasSubscription
    ? `${target.name} · đang dùng ${target.planName ?? '—'} ${target.endsAt ? `đến ${fmtDate(target.endsAt)}` : 'không thời hạn'}`
    : `${target.name} · chưa có thuê bao${target.planName ? ` (đang áp gói mặc định ${target.planName})` : ''}`;

  return (
    <Dialog
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      eyebrow={eyebrow}
      title="Đổi gói / gia hạn"
      size="sm"
      width={600}
      className="pf-dlg"
      primaryLabel="Lưu thuê bao"
      onPrimary={() => void save()}
      primaryLoading={saving}
      primaryDisabled={plans.data === null}
    >
      <SettingRow label="Gói cước" htmlFor={`${ids}-goi`} controlWidth={260}>
        <Select
          id={`${ids}-goi`}
          value={form.planId}
          placeholder={plans.loading ? 'Đang tải gói…' : 'Chọn gói'}
          options={options.map((p) => ({ value: p.id, label: `${p.name} · ${formatVnd(p.priceMonthly)}/tháng` }))}
          onChange={(e) => set('planId', e.target.value)}
          error={errors.planId || (plans.error ? `Không tải được danh sách gói. ${userMessage(plans.error)}` : null)}
          hint={currentPlanHidden ? `Gói hiện tại (${currentPlanHidden}) đã ngừng bán.` : undefined}
        />
      </SettingRow>
      <SettingRow label="Trạng thái" className="pf-row-wide">
        <Segmented
          size="sm"
          aria-label="Trạng thái"
          options={NEW_SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: SUBSCRIPTION_LABELS[s] }))}
          value={form.status}
          onChange={(v) => set('status', v)}
        />
      </SettingRow>
      <SettingRow
        label="Bắt đầu"
        htmlFor={`${ids}-bd`}
        tip="Không được trước ngày bắt đầu của thuê bao mới nhất. Mặc định nối tiếp ngay sau hạn của kỳ đang chạy; hết hạn rồi thì bắt đầu hôm nay."
        controlWidth={200}
      >
        <DateInput
          id={`${ids}-bd`}
          value={form.startDay}
          onChange={(v) => v && set('startDay', v)}
          onInputError={(m) => setInputErr((e) => ({ ...e, startDay: m }))}
          error={errors.startsAt || null}
        />
      </SettingRow>
      <SettingRow label="Thời hạn" className="pf-row-wide">
        <Segmented size="sm" aria-label="Thời hạn" options={DURATIONS} value={form.duration} onChange={(v) => set('duration', v)} />
      </SettingRow>
      {form.duration === 'den-ngay' ? (
        <SettingRow label="Đến ngày" htmlFor={`${ids}-kt`} controlWidth={200}>
          <DateInput
            id={`${ids}-kt`}
            value={form.endDay}
            onChange={(v) => set('endDay', v)}
            onInputError={(m) => setInputErr((e) => ({ ...e, endDay: m }))}
            error={errors.endsAt || null}
          />
        </SettingRow>
      ) : null}
      <SettingRow label="Hết hạn" className="pf-row-wide">
        <b className="num" data-testid="het-han">
          {shownEnd}
        </b>
      </SettingRow>
      {form.duration !== 'den-ngay' && errors.endsAt ? (
        <div className="ui-field__error" role="alert">
          {errors.endsAt}
        </div>
      ) : null}
      <SettingRow label="Ghi chú" htmlFor={`${ids}-gc`} stack>
        <Textarea
          id={`${ids}-gc`}
          rows={2}
          maxLength={500}
          value={form.note}
          placeholder="Ví dụ: đã nhận chuyển khoản 3.588.000 ₫ ngày 18/10"
          onChange={(e) => set('note', e.target.value)}
          error={errors.note || null}
        />
      </SettingRow>
      <div className="pf-band pf-band--grey">
        <IconClock />
        <span>Thêm một dòng thuê bao mới; dòng cũ giữ làm lịch sử.</span>
      </div>
      {banner ? (
        <div className="pf-band pf-band--red" role="alert">
          <IconWarn />
          <span>{banner}</span>
        </div>
      ) : null}
    </Dialog>
  );
}
