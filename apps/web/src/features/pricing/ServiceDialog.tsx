import { useEffect, useId, useRef, useState } from 'react';
import { addServicePrice, createService, updateService } from '../../api/catalog';
import { getServicePayRates, putServicePayRates } from '../../api/staff';
import type { PayRateSheet, PayRatesInput, Service, ServiceKind } from '../../api/types';
import { useOnline } from '../../layout/ErrorStates';
import { Button, Dialog, MoneyInput, Select, SettingRow, Switch, TextInput, UnitInput, type SelectOption } from '../../ui';
import { useFirstErrorFocus, useInputErrors, useStableKey } from './formHooks';
import { TIP_ACTIVE, TIP_SALE } from './groups/InfoPriceGroup';
import { PayRatesGroup } from './groups/PayRatesGroup';
import { useResource } from './hooks';
import {
  buildPayRatesInput,
  buildPriceInput,
  buildServiceCreate,
  buildServicePatch,
  mapSaveError,
  payRatesToForm,
  serviceToForm,
  validateServiceForm,
  hasDuration,
  showDurationField,
  type FormErrors,
  type PricingPerms,
  type SaveStep,
  type ServiceForm,
} from './logic';
import { ErrorBanner, Group } from './parts';

export type ServiceTarget = { kind: 'edit'; service: Service } | { kind: 'create'; serviceKind: ServiceKind };

const KIND_LABEL: Record<ServiceKind, string> = { MAIN: 'Dịch vụ trong gói', ADDON: 'Dịch vụ phụ', SURCHARGE: 'Phụ phí' };
const KIND_OPTIONS: SelectOption[] = (['ADDON', 'SURCHARGE', 'MAIN'] as const).map((k) => ({ value: k, label: KIND_LABEL[k] }));
export const TIP_KIND = 'Phụ phí không cần thời lượng. Dịch vụ trong gói và dịch vụ phụ bắt buộc có thời lượng.';
export const TIP_SURCHARGE_DURATION = 'Phụ phí không cần thời lượng: xoá trống ô để bỏ.';

/**
 * Hộp dịch vụ (bản vẽ C mục 4.2b): Tên, Mã, Thời lượng, Giá niêm yết, Giá bán, Tiền công thợ theo bậc.
 * Lưu: PATCH /services/:id → POST /services/:id/prices → PUT /services/:id/pay-rates, chỉ bước có thay đổi.
 */
export function ServiceDialog({
  orgId,
  target,
  perms,
  onClose,
  onSaved,
  onCreated,
}: {
  orgId: string;
  target: ServiceTarget;
  perms: PricingPerms;
  onClose: () => void;
  onSaved: () => void;
  onCreated: (s: Service) => void;
}) {
  const id = useId();
  const online = useOnline();
  const mode = target.kind;
  const [base, setBase] = useState<Service | null>(target.kind === 'edit' ? target.service : null);
  const [form, setForm] = useState<ServiceForm>(() => (target.kind === 'edit' ? serviceToForm(target.service) : serviceToForm(null, target.serviceKind)));
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputErrors = useInputErrors();
  const createKey = useStableKey();
  const priceKey = useStableKey();
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusFirstError = useFirstErrorFocus(bodyRef);

  const serviceId = target.kind === 'edit' ? target.service.id : null;
  const showPay = perms.payrollRead;
  const [sheetRes, reloadSheet] = useResource<PayRateSheet | null>(
    (signal) => (serviceId && showPay ? getServicePayRates(orgId, serviceId, signal) : Promise.resolve(null)),
    [orgId, serviceId, showPay],
  );
  const [sheet, setSheet] = useState<PayRateSheet | null>(null);
  useEffect(() => {
    if (sheetRes.status === 'ready' && sheetRes.data) {
      const loaded = sheetRes.data;
      setSheet(loaded);
      setForm((f) => ({ ...f, payRates: { ...payRatesToForm(loaded), ...f.payRates } }));
    }
  }, [sheetRes]);

  const set = (patch: Partial<ServiceForm>) => {
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

  // Loại đang lưu (tiêu đề hộp) và loại đang chọn trong hộp (quyết định ô thời lượng).
  const savedKind = target.kind === 'edit' ? (base?.kind ?? target.service.kind) : target.serviceKind;
  const kind = form.kind;
  const storedDuration = base?.durationMinutes ?? null;
  const showDuration = showDurationField(kind, storedDuration, errors.durationMinutes);
  const changeKind = (k: ServiceKind) =>
    // Ô thời lượng bị ẩn (tạo phụ phí) thì bỏ số đã gõ — không gửi số người dùng không thấy.
    set(showDurationField(k, storedDuration) ? { kind: k } : { kind: k, durationMinutes: null });
  const canInfo = mode === 'create' ? perms.canCreatePriced : perms.catalogWrite;
  const canPrice = perms.pricesWrite;
  const canEditAny = mode === 'create' ? perms.canCreatePriced : perms.catalogWrite || perms.pricesWrite || perms.payrollWrite;

  function fail(err: unknown, step: SaveStep, sentRates: PayRatesInput | null = null) {
    const m = mapSaveError(err, step, { sentRates });
    setErrors(m.fields);
    setBanner(m.banner);
    focusFirstError();
  }

  async function save() {
    setBanner(null);
    const v = validateServiceForm(form);
    setErrors(v);
    if (Object.keys(v).length > 0 || inputErrors.any()) {
      focusFirstError();
      return;
    }
    setSaving(true);
    try {
      if (mode === 'create') {
        try {
          const body = buildServiceCreate(form);
          onCreated(await createService(orgId, body, createKey.get(JSON.stringify(body))));
        } catch (err) {
          fail(err, 'create');
        }
        return;
      }
      if (!base) throw new Error('Thiếu dịch vụ gốc khi sửa');
      let current = base;
      const patch = perms.catalogWrite ? buildServicePatch(current, form) : null;
      if (patch) {
        try {
          current = await updateService(orgId, current.id, patch);
        } catch (err) {
          fail(err, 'package');
          return;
        }
        setBase(current);
      }
      const price = canPrice ? buildPriceInput(current.currentPrice, form) : null;
      if (price) {
        try {
          const pv = await addServicePrice(orgId, current.id, price, priceKey.get(JSON.stringify(price)));
          if (pv.status === 'CURRENT') {
            current = {
              ...current,
              currentPrice: { priceVersionId: pv.id, listPrice: pv.listPrice, salePrice: pv.salePrice, unitPrice: pv.unitPrice, effectiveFrom: pv.effectiveFrom },
            };
          }
        } catch (err) {
          fail(err, 'price');
          return;
        }
        setBase(current);
      }
      const rates = perms.payrollWrite ? buildPayRatesInput(sheet, form.payRates) : null;
      if (rates) {
        try {
          setSheet(await putServicePayRates(orgId, current.id, rates));
        } catch (err) {
          fail(err, 'payRates', rates);
          return;
        }
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === 'create' ? `${KIND_LABEL[savedKind]} mới` : (base?.name ?? '')}
      eyebrow={mode === 'create' ? KIND_LABEL[savedKind] : `${KIND_LABEL[savedKind]} · ${base?.code ?? ''}`}
      className="pr-dlg-md"
      footer={canEditAny ? undefined : <Button onClick={onClose}>Đóng</Button>}
      primaryLabel="Lưu"
      onPrimary={() => void save()}
      primaryLoading={saving}
      primaryDisabled={!online}
    >
      <div ref={bodyRef}>
        {banner && <ErrorBanner>{banner}</ErrorBanner>}
        <Group title="Thông tin & giá">
          <SettingRow label="Tên" htmlFor={`${id}-ten`} controlWidth={180}>
            <TextInput id={`${id}-ten`} value={form.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} error={errors.name} disabled={!canInfo} />
          </SettingRow>
          <SettingRow label="Mã" htmlFor={`${id}-ma`} controlWidth={180}>
            <TextInput id={`${id}-ma`} value={form.code} maxLength={32} onChange={(e) => set({ code: e.target.value })} error={errors.code} disabled={!canInfo} />
          </SettingRow>
          <SettingRow label="Loại" htmlFor={`${id}-loai`} tip={TIP_KIND} controlWidth={180}>
            <Select id={`${id}-loai`} options={KIND_OPTIONS} value={kind} onChange={(e) => changeKind(e.target.value as ServiceKind)} error={errors.kind} disabled={!canInfo} />
          </SettingRow>
          {showDuration && (
            <SettingRow label="Thời lượng" htmlFor={`${id}-tl`} tip={hasDuration(kind) ? undefined : TIP_SURCHARGE_DURATION} controlWidth={180}>
              <UnitInput
                id={`${id}-tl`}
                unit="phút"
                min={1}
                max={1440}
                placeholder={hasDuration(kind) ? undefined : 'Không áp dụng'}
                value={form.durationMinutes}
                onChange={(v) => set({ durationMinutes: v })}
                onInputError={(m) => inputErrors.report('durationMinutes', m)}
                error={errors.durationMinutes}
                disabled={!canInfo}
              />
            </SettingRow>
          )}
          <SettingRow label="Giá niêm yết" htmlFor={`${id}-gny`} controlWidth={180}>
            <MoneyInput
              id={`${id}-gny`}
              value={form.listPrice}
              onChange={(v) => set({ listPrice: v })}
              onInputError={(m) => inputErrors.report('listPrice', m)}
              error={errors.listPrice}
              disabled={!canPrice}
            />
          </SettingRow>
          <SettingRow label="Giá bán" htmlFor={`${id}-gb`} tip={TIP_SALE} controlWidth={180}>
            <MoneyInput
              id={`${id}-gb`}
              value={form.salePrice}
              placeholder="Không giảm"
              onChange={(v) => set({ salePrice: v })}
              onInputError={(m) => inputErrors.report('salePrice', m)}
              error={errors.salePrice}
              disabled={!canPrice}
            />
          </SettingRow>
          <SettingRow label="Đang bán" htmlFor={`${id}-ban`} tip={TIP_ACTIVE} controlWidth={180}>
            <Switch id={`${id}-ban`} checked={form.isActive} onChange={(v) => set({ isActive: v })} disabled={!canInfo} />
          </SettingRow>
        </Group>
        {showPay && (
          <PayRatesGroup
            sheet={mode === 'create' ? 'create' : sheetRes.status === 'ready' ? { status: 'ready', data: sheet ?? { owner: { kind: 'service', id: '', name: '' }, items: [] } } : sheetRes}
            rates={form.payRates}
            onChange={(tierId, amount) => set({ payRates: { ...form.payRates, [tierId]: amount } })}
            errors={errors}
            canWrite={perms.payrollWrite}
            onInputError={inputErrors.report}
            retry={reloadSheet}
          />
        )}
      </div>
    </Dialog>
  );
}
