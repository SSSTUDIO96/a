import { useEffect, useRef, useState } from 'react';
import { addPackagePrice, createPackage, updatePackage } from '../../api/catalog';
import { getPackagePayRates, putPackagePayRates } from '../../api/staff';
import type { MakeupSubject, PayRateSheet, PayRatesInput, Service, ServicePackage } from '../../api/types';
import { useOnline } from '../../layout/ErrorStates';
import { Button, Dialog } from '../../ui';
import { AddonsGroup } from './groups/AddonsGroup';
import { IncludedGroup } from './groups/IncludedGroup';
import { InfoPriceGroup } from './groups/InfoPriceGroup';
import { LocationsGroup } from './groups/LocationsGroup';
import { PayRatesGroup } from './groups/PayRatesGroup';
import { useResource } from './hooks';
import {
  ALL_SUBJECTS_LABEL,
  buildPackageCreate,
  buildPackagePatch,
  buildPayRatesInput,
  buildPriceInput,
  emptyPackageForm,
  mapSaveError,
  packageToForm,
  payRatesToForm,
  validatePackageForm,
  type FormErrors,
  type PackageForm,
  type PricingPerms,
  type SaveStep,
} from './logic';
import { ErrorBanner } from './parts';
import { useFirstErrorFocus, useInputErrors, useStableKey } from './formHooks';

export type PackageTarget = { kind: 'edit'; pkg: ServicePackage } | { kind: 'create'; subjectId: string | null };

export interface PackageDialogProps {
  orgId: string;
  target: PackageTarget;
  subjects: readonly MakeupSubject[];
  // Dịch vụ đang bán (mọi loại) — nguồn cho "Thêm dịch vụ" và danh sách dịch vụ phụ cho tick.
  services: readonly Service[];
  perms: PricingPerms;
  onClose: () => void;
  // Đã lưu xong (sửa): trang tải lại danh sách và đóng hộp.
  onSaved: (pkg: ServicePackage) => void;
  // Đã tạo: trang chuyển hộp sang chế độ sửa gói mới (để đặt tiền công).
  onCreated: (pkg: ServicePackage) => void;
}

/**
 * Hộp chi tiết gói — bản vẽ C mục 4.2, đủ 5 nhóm: Thông tin & giá · Địa điểm cho phép · Đã gồm trong gói ·
 * Dịch vụ phụ cho tick · Tiền công thợ theo bậc. Máy tính 2 cột, máy tính bảng 1 cột, điện thoại toàn màn.
 * Lưu: PATCH gói → POST giá → PUT tiền công, chỉ gọi bước có thay đổi; bước lỗi thì giữ hộp, bước đã xong không gửi lại.
 */
export function PackageDialog({ orgId, target, subjects, services, perms, onClose, onSaved, onCreated }: PackageDialogProps) {
  const mode = target.kind;
  const online = useOnline();
  const [base, setBase] = useState<ServicePackage | null>(target.kind === 'edit' ? target.pkg : null);
  const [form, setForm] = useState<PackageForm>(() =>
    target.kind === 'edit' ? packageToForm(target.pkg, null) : emptyPackageForm(target.subjectId),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputErrors = useInputErrors();
  const createKey = useStableKey();
  const priceKey = useStableKey();
  const bodyRef = useRef<HTMLDivElement>(null);
  useFirstErrorFocus(bodyRef, errors);

  // Bảng tiền công: chỉ khi sửa và có payroll.read.
  const packageId = target.kind === 'edit' ? target.pkg.id : null;
  const showPay = perms.payrollRead;
  const [sheetRes, reloadSheet] = useResource<PayRateSheet | null>(
    (signal) => (packageId && showPay ? getPackagePayRates(orgId, packageId, signal) : Promise.resolve(null)),
    [orgId, packageId, showPay],
  );
  const [sheet, setSheet] = useState<PayRateSheet | null>(null);
  useEffect(() => {
    if (sheetRes.status === 'ready' && sheetRes.data) {
      const loaded = sheetRes.data;
      setSheet(loaded);
      setForm((f) => ({ ...f, payRates: { ...payRatesToForm(loaded), ...f.payRates } }));
    }
  }, [sheetRes]);

  const set = (patch: Partial<PackageForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    // Sửa ô nào thì bỏ lỗi máy chủ của ô đó.
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) {
        delete next[k];
        for (const key of Object.keys(next)) if (key.startsWith(`${k}.`)) delete next[key];
      }
      return next;
    });
  };

  const canEditAny = mode === 'create' ? perms.canCreatePriced : perms.catalogWrite || perms.pricesWrite || perms.payrollWrite;
  const addons = services.filter((s) => s.kind === 'ADDON');
  const subjectName =
    (form.subjectId ? subjects.find((s) => s.id === form.subjectId)?.name ?? base?.subject?.name : null) ?? ALL_SUBJECTS_LABEL;

  function fail(err: unknown, step: SaveStep, sentRates: PayRatesInput | null = null) {
    const m = mapSaveError(err, step, { includedCount: form.included.length, sentRates });
    setErrors(m.fields);
    setBanner(m.banner);
  }

  async function save() {
    setBanner(null);
    const v = validatePackageForm(form, mode);
    setErrors(v);
    if (Object.keys(v).length > 0 || inputErrors.any()) return;
    setSaving(true);
    try {
      if (mode === 'create') {
        let created: ServicePackage;
        try {
          const body = buildPackageCreate(form);
          created = await createPackage(orgId, body, createKey.get(JSON.stringify(body)));
        } catch (err) {
          fail(err, 'create');
          return;
        }
        onCreated(created);
        return;
      }
      if (!base) throw new Error('Thiếu gói gốc khi sửa');
      let current = base;
      const patch = buildPackagePatch(current, form);
      if (patch && perms.catalogWrite) {
        try {
          current = await updatePackage(orgId, current.id, patch);
        } catch (err) {
          fail(err, 'package');
          return;
        }
        setBase(current);
      }
      const price = perms.pricesWrite ? buildPriceInput(current.currentPrice, form) : null;
      if (price) {
        try {
          const pv = await addPackagePrice(orgId, current.id, price, priceKey.get(JSON.stringify(price)));
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
          setSheet(await putPackagePayRates(orgId, current.id, rates));
        } catch (err) {
          fail(err, 'payRates', rates);
          return;
        }
      }
      onSaved(current);
    } finally {
      setSaving(false);
    }
  }

  const groupProps = { form, set, errors, perms, onInputError: inputErrors.report };
  const title = mode === 'create' ? 'Gói mới' : (base?.name ?? '');
  const eyebrow = mode === 'create' ? subjectName : `${subjectName} · ${base?.code ?? ''}`;

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      eyebrow={eyebrow}
      className="pr-dlg-pkg"
      footer={canEditAny ? undefined : <Button onClick={onClose}>Đóng</Button>}
      primaryLabel="Lưu"
      onPrimary={() => void save()}
      primaryLoading={saving}
      primaryDisabled={!online}
    >
      <div ref={bodyRef}>
        {banner && <ErrorBanner>{banner}</ErrorBanner>}
        <div className="pr-dlg-cols">
          <div>
            <InfoPriceGroup {...groupProps} mode={mode} subjects={subjects} />
            <LocationsGroup {...groupProps} />
          </div>
          <div>
            <IncludedGroup {...groupProps} services={services} />
            <AddonsGroup {...groupProps} addons={addons} />
            {showPay && (
              <PayRatesGroup
                sheet={mode === 'create' ? 'create' : sheetRes.status === 'ready' ? { status: 'ready', data: sheet ?? emptySheet(base) } : sheetRes}
                rates={form.payRates}
                onChange={(tierId, amount) => set({ payRates: { ...form.payRates, [tierId]: amount } })}
                errors={errors}
                canWrite={perms.payrollWrite}
                onInputError={inputErrors.report}
                retry={reloadSheet}
              />
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function emptySheet(pkg: ServicePackage | null): PayRateSheet {
  return { owner: { kind: 'package', id: pkg?.id ?? '', name: pkg?.name ?? '' }, items: [] };
}
