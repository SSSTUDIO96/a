import { useId, useRef, useState } from 'react';
import { getTravelFeePolicy, putTravelFeePolicy } from '../../api/catalog';
import type { TravelFeeMode, TravelFeePolicy } from '../../api/types';
import { useOnline } from '../../layout/ErrorStates';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { Button, Card, EmptyState, IconClose, IconPlus, MoneyInput, Segmented, SettingRow, Skeleton, Switch, UnitInput } from '../../ui';
import { useFirstErrorFocus, useInputErrors } from './formHooks';
import { useOrgId, usePricingPerms, useResource } from './hooks';
import {
  buildTravelInput,
  isApiStatus,
  mapTravelError,
  newTierKey,
  TRAVEL_MODE_OPTIONS,
  travelDirty,
  travelToForm,
  validateTravelForm,
  type FormErrors,
  type TravelForm,
} from './logic';
import { ErrorBanner, Group, GroupError, LoadError } from './parts';
import { PricingHeader } from './PricingHeader';
import { StudioLocations } from './StudioLocations';

export const TIP_MODE = 'Khi lập hợp đồng vẫn đổi được cách tính cho từng dòng.';
export const TIP_FREE_KM =
  'Khoảng cách một chiều trong bán kính này không tính phí (trừ nhập tay). Gói có bán kính riêng thì dùng của gói.';
export const TIP_MIN = 'Theo km tính ra thấp hơn mức này thì lấy mức này.';
export const TIP_TIERS = 'Vượt bán kính miễn phí thì lấy phí của bậc chứa khoảng cách một chiều. Bậc cuối để trống ô "đến".';

// (c) Phí di chuyển & studio — hai thẻ cạnh nhau (điện thoại: chồng dọc).
export function TravelPage() {
  const orgId = useOrgId();
  const perms = usePricingPerms();
  return (
    <>
      <PricingHeader group="di-chuyen" />
      <div className="pr-dc">
        <TravelPolicyCard orgId={orgId} canWrite={perms.pricesWrite} />
        <StudioLocations orgId={orgId} canWrite={perms.catalogWrite} />
      </div>
    </>
  );
}

function TravelPolicyCard({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  // 404 "chưa có cấu hình" → null: người có quyền nhập từ đầu, không tự điền số.
  const [res, reload] = useResource<TravelFeePolicy | null>(
    (signal) => getTravelFeePolicy(orgId, signal).catch((err: unknown) => (isApiStatus(err, 404) ? null : Promise.reject(err))),
    [orgId],
  );
  if (res.status === 'loading') {
    return (
      <Card className="pr-setcard">
        <div role="status" aria-label="Đang tải phí di chuyển" className="pr-skel-rows">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ui-row">
              <Skeleton width={140} height={14} />
              <Skeleton height={36} />
            </div>
          ))}
        </div>
      </Card>
    );
  }
  if (res.status === 'error') {
    return (
      <Card className="pr-setcard">
        <LoadError error={res.error} retry={reload} />
      </Card>
    );
  }
  if (res.data === null && !canWrite) {
    return (
      <Card className="pr-setcard">
        <EmptyState message="Tổ chức chưa cài phí di chuyển." />
      </Card>
    );
  }
  return <TravelPolicyForm key={res.data?.updatedAt ?? 'moi'} orgId={orgId} policy={res.data} canWrite={canWrite} onSaved={reload} />;
}

function TravelPolicyForm({ orgId, policy, canWrite, onSaved }: { orgId: string; policy: TravelFeePolicy | null; canWrite: boolean; onSaved: () => void }) {
  const id = useId();
  const online = useOnline();
  const stackMode = useBreakpoint() !== 'desktop';
  const [form, setForm] = useState<TravelForm>(() => travelToForm(policy));
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputErrors = useInputErrors();
  const ref = useRef<HTMLDivElement>(null);
  const focusFirstError = useFirstErrorFocus(ref);
  // Ô đang gõ sai (chưa thành giá trị) cũng tính là đang sửa → có nút Huỷ để bỏ chữ sai.
  const dirty = policy === null || travelDirty(policy, form) || inputErrors.count > 0;
  // Đổi mỗi lần bấm Huỷ (đặt lại đúng giá cũ) → ô tiền/km bỏ chữ lỗi dù số không đổi (N-J1).
  const [resetKey, setResetKey] = useState(0);
  const cancel = () => {
    if (!policy) return;
    setForm(travelToForm(policy));
    setErrors({});
    setBanner(null);
    setResetKey((k) => k + 1);
  };

  const set = (patch: Partial<TravelForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) {
        delete next[k];
        for (const key of Object.keys(next)) if (key.startsWith(`${k}.`)) delete next[key];
      }
      return next;
    });
  };
  const setTier = (i: number, patch: Partial<TravelForm['tiers'][number]>) =>
    set({ tiers: form.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  async function save() {
    setBanner(null);
    const v = validateTravelForm(form);
    setErrors(v);
    if (Object.keys(v).length > 0 || inputErrors.any()) {
      focusFirstError();
      return;
    }
    setSaving(true);
    try {
      await putTravelFeePolicy(orgId, buildTravelInput(form));
      onSaved();
    } catch (err) {
      const m = mapTravelError(err);
      setErrors(m.fields);
      setBanner(m.banner);
      focusFirstError();
    } finally {
      setSaving(false);
    }
  }

  const money = (key: 'fixedAmount' | 'perKmAmount' | 'minimumAmount', label: string, tip?: string) => (
    <SettingRow label={label} htmlFor={`${id}-${key}`} tip={tip}>
      <MoneyInput
        id={`${id}-${key}`}
        value={form[key]}
        onChange={(v) => set({ [key]: v })}
        onInputError={(m) => inputErrors.report(key, m)}
        resetKey={resetKey}
        error={errors[key]}
        disabled={!canWrite}
      />
    </SettingRow>
  );

  return (
    <Card
      className="pr-setcard"
      footer={
        canWrite && dirty ? (
          <>
            <span />
            <span className="pr-actions">
              {policy && (
                <Button onClick={cancel} disabled={saving}>
                  Huỷ
                </Button>
              )}
              <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!online}>
                Lưu
              </Button>
            </span>
          </>
        ) : undefined
      }
    >
      <div ref={ref}>
        {banner && <ErrorBanner>{banner}</ErrorBanner>}
        <Group title="Cách tính phí di chuyển">
          <SettingRow label="Cách tính mặc định" tip={TIP_MODE} stack={stackMode} controlWidth={320}>
            <div>
              <Segmented<TravelFeeMode>
                size="sm"
                aria-label="Cách tính mặc định"
                options={TRAVEL_MODE_OPTIONS}
                value={form.defaultMode}
                onChange={(v) => set({ defaultMode: v })}
                disabled={!canWrite}
              />
              <GroupError message={errors.defaultMode} />
            </div>
          </SettingRow>
          {money('fixedAmount', 'Mức cố định mỗi lần đi')}
          {money('perKmAmount', 'Đơn giá mỗi km')}
          <SettingRow label="Bán kính miễn phí" htmlFor={`${id}-free`} tip={TIP_FREE_KM}>
            <UnitInput
              id={`${id}-free`}
              unit="km"
              value={form.freeKm}
              onChange={(v) => set({ freeKm: v })}
              onInputError={(m) => inputErrors.report('freeKm', m)}
              resetKey={resetKey}
              error={errors.freeKm}
              disabled={!canWrite}
            />
          </SettingRow>
          {money('minimumAmount', 'Phí tối thiểu', TIP_MIN)}
          <SettingRow label="Tính cả chiều về" htmlFor={`${id}-ve`}>
            <Switch id={`${id}-ve`} checked={form.roundTrip} onChange={(v) => set({ roundTrip: v })} disabled={!canWrite} />
          </SettingRow>
        </Group>
        <Group title="Bậc khoảng cách" tip={TIP_TIERS}>
          {form.tiers.length > 0 && (
            <div className="pr-trow pr-trow--head" aria-hidden="true">
              <span>Từ</span>
              <span />
              <span>Đến</span>
              <span>Phí</span>
            </div>
          )}
          {form.tiers.map((t, i) => (
            <div key={t.key} className="pr-trow">
              <UnitInput
                className="pr-trow__from"
                unit="km"
                aria-label={`Bậc ${i + 1}: từ km`}
                value={t.fromKm}
                onChange={(v) => setTier(i, { fromKm: v })}
                onInputError={(m) => inputErrors.report(`tiers.${i}.fromKm`, m)}
                resetKey={resetKey}
                error={errors[`tiers.${i}.fromKm`]}
                disabled={!canWrite}
              />
              <span className="pr-trow__dash" aria-hidden="true">
                –
              </span>
              <UnitInput
                className="pr-trow__to"
                unit="km"
                aria-label={`Bậc ${i + 1}: đến km`}
                placeholder="trở lên"
                value={t.toKm}
                onChange={(v) => setTier(i, { toKm: v })}
                onInputError={(m) => inputErrors.report(`tiers.${i}.toKm`, m)}
                resetKey={resetKey}
                error={errors[`tiers.${i}.toKm`]}
                disabled={!canWrite}
              />
              <MoneyInput
                className="pr-trow__amt"
                aria-label={`Bậc ${i + 1}: phí`}
                value={t.amount}
                onChange={(v) => setTier(i, { amount: v })}
                onInputError={(m) => inputErrors.report(`tiers.${i}.amount`, m)}
                resetKey={resetKey}
                error={errors[`tiers.${i}.amount`]}
                disabled={!canWrite}
              />
              {canWrite && (
                <Button
                  className="pr-trow__del"
                  variant="ghost"
                  size="sm"
                  icon={<IconClose />}
                  aria-label={`Bỏ bậc ${i + 1}`}
                  onClick={() => set({ tiers: form.tiers.filter((_, j) => j !== i) })}
                />
              )}
            </div>
          ))}
          {form.tiers.length === 0 && !canWrite && <p className="pr-muted">Chưa có bậc nào.</p>}
          <GroupError message={errors.tiers} />
          {canWrite && (
            <Button
              variant="ghost"
              size="sm"
              className="pr-add-link"
              icon={<IconPlus />}
              onClick={() => {
                const last = form.tiers[form.tiers.length - 1];
                // Bậc mới bắt đầu ở km kết thúc của bậc trước (nếu có); không thì để trống cho người dùng nhập.
                set({ tiers: [...form.tiers, { key: newTierKey(), fromKm: last?.toKm ?? (form.tiers.length === 0 ? 0 : null), toKm: null, amount: null }] });
              }}
            >
              Thêm bậc
            </Button>
          )}
        </Group>
      </div>
    </Card>
  );
}
