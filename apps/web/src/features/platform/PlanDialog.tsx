// Hộp Tạo / Sửa gói cước (bản vẽ C2 mục 5.5, bản mẫu #goi-sua) — Dialog 640.
// Tạo → POST /platform/plans (đủ trường). Sửa → PATCH /platform/plans/:planId CHỈ các trường đã đổi
// (trước đây máy chủ xoá các trường không gửi — lỗi S1; web vẫn chỉ gửi phần đổi để không phụ thuộc chuyện đó).
import { useId, useState, type KeyboardEvent } from 'react';
import { conflictFields, errorKind, fieldErrors, userMessage } from '../../api/errors';
import { createPlan, updatePlan, type PlanInput, type PlanPatch, type PlanView } from '../../api/platform';
import { Button, Dialog, IconClose, IconPlus, IconWarn, MoneyInput, SettingRow, Switch, TextInput, Tooltip, type Vnd } from '../../ui';
import { UNLIMITED } from './labels';

const LIMIT_KEYS = ['maxStaff', 'maxAppointmentsPerMonth', 'maxStorageMb', 'maxStudents', 'maxCourses'] as const;
type LimitKey = (typeof LIMIT_KEYS)[number];

const LIMIT_LABELS: Record<LimitKey, string> = {
  maxStaff: 'Thành viên',
  maxAppointmentsPerMonth: 'Lịch mỗi tháng',
  maxStorageMb: 'Dung lượng (MB)',
  maxStudents: 'Học viên',
  maxCourses: 'Khoá học',
};

export const PLAN_CODE_RULE = /^[a-z][a-z0-9_]{1,31}$/;
const MAX_LIMIT = 1_000_000_000;
const MAX_FEATURES = 50;

export interface PlanForm {
  code: string;
  name: string;
  priceMonthly: Vnd | null;
  maxStaff: string;
  maxAppointmentsPerMonth: string;
  maxStorageMb: string;
  maxStudents: string;
  maxCourses: string;
  customDomain: boolean;
  features: string[];
  isActive: boolean;
  sortOrder: string;
}

const limitText = (v: number | null) => (v === null ? '' : String(v));

export function formFromPlan(p: PlanView | null): PlanForm {
  return {
    code: p?.code ?? '',
    name: p?.name ?? '',
    priceMonthly: p ? p.priceMonthly : null,
    maxStaff: limitText(p?.maxStaff ?? null),
    maxAppointmentsPerMonth: limitText(p?.maxAppointmentsPerMonth ?? null),
    maxStorageMb: limitText(p?.maxStorageMb ?? null),
    maxStudents: limitText(p?.maxStudents ?? null),
    maxCourses: limitText(p?.maxCourses ?? null),
    customDomain: p?.customDomain ?? false,
    features: p?.features ?? [],
    isActive: p?.isActive ?? true,
    sortOrder: String(p?.sortOrder ?? 0),
  };
}

/** Ô giới hạn: trống = không giới hạn (null); chỉ nhận số nguyên không âm. */
export function parseLimit(text: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const t = text.replace(/[\s.]/g, '');
  if (t === '') return { ok: true, value: null };
  if (!/^\d+$/.test(t)) return { ok: false, error: 'Nhập số nguyên không âm; để trống = không giới hạn.' };
  const n = Number(t);
  if (n > MAX_LIMIT) return { ok: false, error: 'Số quá lớn.' };
  return { ok: true, value: n };
}

/** Đọc form thành thân đầy đủ của gói; lỗi theo ô (tên trường máy chủ). */
export function parsePlanForm(
  f: PlanForm,
  mode: 'create' | 'edit',
): { ok: true; value: PlanInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const code = f.code.trim().toLowerCase();
  if (mode === 'create' && !PLAN_CODE_RULE.test(code)) errors.code = 'Mã gói: chữ thường không dấu, số, gạch dưới; 2–32 ký tự';
  const name = f.name.trim();
  if (!name) errors.name = 'Nhập tên gói';
  else if (name.length > 60) errors.name = 'Tên gói tối đa 60 ký tự';
  if (f.priceMonthly === null) errors.priceMonthly = 'Nhập giá mỗi tháng (gói miễn phí nhập 0).';
  const limits = {} as Record<LimitKey, number | null>;
  for (const k of LIMIT_KEYS) {
    const r = parseLimit(f[k]);
    if (r.ok) limits[k] = r.value;
    else errors[k] = r.error;
  }
  const so = f.sortOrder.trim();
  if (!/^\d+$/.test(so) || Number(so) > 1_000_000) errors.sortOrder = 'Nhập số nguyên từ 0 đến 1.000.000.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      code,
      name,
      priceMonthly: f.priceMonthly ?? 0,
      ...limits,
      customDomain: f.customDomain,
      features: f.features,
      isActive: f.isActive,
      sortOrder: Number(so),
    },
  };
}

/** Thân PATCH: CHỈ những trường khác bản gốc (không bao giờ có "code"). */
export function planPatch(original: PlanView, next: PlanInput): PlanPatch {
  const out: PlanPatch = {};
  if (next.name !== original.name) out.name = next.name;
  if (next.priceMonthly !== original.priceMonthly) out.priceMonthly = next.priceMonthly;
  for (const k of LIMIT_KEYS) if (next[k] !== original[k]) out[k] = next[k];
  if (next.customDomain !== original.customDomain) out.customDomain = next.customDomain;
  if (next.features.length !== original.features.length || next.features.some((x, i) => x !== original.features[i])) {
    out.features = next.features;
  }
  if (next.isActive !== original.isActive) out.isActive = next.isActive;
  if (next.sortOrder !== original.sortOrder) out.sortOrder = next.sortOrder;
  return out;
}

export interface PlanDialogProps {
  /** null = đóng; { plan: null } = tạo gói mới; { plan } = sửa. */
  state: { plan: PlanView | null } | null;
  onClose: () => void;
  onSaved: (p: PlanView, priceChanged: boolean) => void;
}

export function PlanDialog({ state, onClose, onSaved }: PlanDialogProps) {
  if (!state) return null;
  return <PlanDialogBody key={state.plan?.id ?? 'moi'} plan={state.plan} onClose={onClose} onSaved={onSaved} />;
}

function PlanDialogBody({ plan, onClose, onSaved }: { plan: PlanView | null; onClose: () => void; onSaved: PlanDialogProps['onSaved'] }) {
  const ids = useId();
  const mode = plan ? 'edit' : 'create';
  const [form, setForm] = useState<PlanForm>(() => formFromPlan(plan));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [priceInputError, setPriceInputError] = useState<string | null>(null);
  const [newFeature, setNewFeature] = useState('');
  const [adding, setAdding] = useState(false);

  const set = <K extends keyof PlanForm>(k: K, v: PlanForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => {
      if (!(k in e)) return e;
      const { [k]: _drop, ...rest } = e;
      return rest;
    });
    setBanner(null);
  };

  function addFeature() {
    const t = newFeature.trim();
    if (!t) {
      setAdding(false);
      return;
    }
    if (t.length > 64) {
      setErrors((e) => ({ ...e, features: 'Mỗi tính năng tối đa 64 ký tự.' }));
      return;
    }
    if (form.features.includes(t)) {
      setErrors((e) => ({ ...e, features: 'Tính năng này đã có.' }));
      return;
    }
    if (form.features.length >= MAX_FEATURES) {
      setErrors((e) => ({ ...e, features: `Tối đa ${MAX_FEATURES} tính năng.` }));
      return;
    }
    set('features', [...form.features, t]);
    setNewFeature('');
  }

  async function save() {
    if (saving || priceInputError) return;
    setBanner(null);
    const parsed = parsePlanForm(form, mode);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    let body: PlanInput | PlanPatch = parsed.value;
    if (plan) {
      body = planPatch(plan, parsed.value);
      if (Object.keys(body).length === 0) {
        setBanner('Chưa có thay đổi nào để lưu.');
        return;
      }
    }
    setSaving(true);
    try {
      const saved = plan ? await updatePlan(plan.id, body) : await createPlan(body as PlanInput);
      onSaved(saved, plan ? 'priceMonthly' in body : false);
      onClose();
    } catch (err) {
      const kind = errorKind(err);
      if (kind === 'validation') {
        const fe = fieldErrors(err);
        if (Object.keys(fe).length > 0) setErrors(fe);
        else setBanner(userMessage(err));
      } else {
        if (kind === 'conflict' && conflictFields(err).includes('code')) setErrors({ code: userMessage(err) });
        setBanner(userMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const priceChanged = plan !== null && form.priceMonthly !== plan.priceMonthly;

  const limitRow = (k: LimitKey) => (
    <SettingRow key={k} label={LIMIT_LABELS[k]} htmlFor={`${ids}-${k}`} controlWidth={130}>
      <TextInput
        id={`${ids}-${k}`}
        inputMode="numeric"
        align="right"
        value={form[k]}
        placeholder={UNLIMITED}
        onChange={(e) => set(k, e.target.value)}
        error={errors[k] ?? null}
      />
    </SettingRow>
  );

  return (
    <Dialog
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      eyebrow={plan ? `Mã gói: ${plan.code} (không đổi được)` : undefined}
      title={plan ? `Sửa gói "${plan.name}"` : 'Gói mới'}
      size="sm"
      width={640}
      className="pf-dlg"
      primaryLabel={plan ? 'Lưu gói' : 'Tạo gói'}
      onPrimary={() => void save()}
      primaryLoading={saving}
    >
      {!plan ? (
        <SettingRow label="Mã gói" htmlFor={`${ids}-code`} required tip="Chữ thường không dấu, số, gạch dưới; 2–32 ký tự. Không đổi được sau khi tạo." controlWidth={240}>
          <TextInput id={`${ids}-code`} value={form.code} maxLength={32} placeholder="vi_du: doi_nho" onChange={(e) => set('code', e.target.value)} error={errors.code ?? null} />
        </SettingRow>
      ) : null}
      <SettingRow label="Tên gói" htmlFor={`${ids}-name`} required controlWidth={240}>
        <TextInput id={`${ids}-name`} value={form.name} maxLength={60} onChange={(e) => set('name', e.target.value)} error={errors.name ?? null} />
      </SettingRow>
      <SettingRow label="Giá mỗi tháng" htmlFor={`${ids}-price`} required controlWidth={240}>
        <MoneyInput
          id={`${ids}-price`}
          value={form.priceMonthly}
          onChange={(v) => set('priceMonthly', v)}
          onInputError={setPriceInputError}
          error={errors.priceMonthly ?? null}
        />
      </SettingRow>
      {priceChanged ? (
        <div className="pf-band pf-band--yellow" role="status">
          <IconWarn />
          <span>
            Đổi giá áp cho <b>mọi thuê bao đang dùng gói này</b>.
          </span>
        </div>
      ) : null}

      <div className="pf-grp">
        Giới hạn <Tooltip text="Để trống = không giới hạn." />
      </div>
      <div className="pf-lim">
        {LIMIT_KEYS.map(limitRow)}
        <SettingRow label="Tên miền riêng" controlWidth={130}>
          <Switch checked={form.customDomain} onChange={(v) => set('customDomain', v)} aria-label="Tên miền riêng" />
        </SettingRow>
      </div>

      <div className="pf-grp">Bày bán</div>
      <SettingRow label="Tính năng ghi trên gói" className="pf-row-wide" tip={`Chữ hiện trên thẻ gói, tối đa ${MAX_FEATURES} dòng.`}>
        <div className="pf-feats">
          {form.features.map((x) => (
            <span key={x} className="pf-feat">
              {x}
              <button type="button" aria-label={`Bỏ "${x}"`} onClick={() => set('features', form.features.filter((y) => y !== x))}>
                <IconClose />
              </button>
            </span>
          ))}
          {adding ? (
            <span className="pf-feat-add">
              <TextInput
                size="sm"
                autoFocus
                aria-label="Tính năng mới"
                value={newFeature}
                maxLength={64}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addFeature();
                  }
                }}
              />
              <Button size="sm" onClick={addFeature}>
                Thêm
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="dashed" icon={<IconPlus />} onClick={() => setAdding(true)} disabled={form.features.length >= MAX_FEATURES}>
              Thêm
            </Button>
          )}
          {errors.features ? (
            <div className="ui-field__error" role="alert">
              {errors.features}
            </div>
          ) : null}
        </div>
      </SettingRow>
      <SettingRow label="Đang bán" tip="Tắt = ngừng bán: không chọn được khi đổi gói (trừ gói mặc định trial). Thuê bao đang dùng giữ nguyên.">
        <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} aria-label="Đang bán" />
      </SettingRow>
      <SettingRow label="Thứ tự" htmlFor={`${ids}-so`} tip="Số nhỏ đứng trước trong danh sách gói." controlWidth={130}>
        <TextInput id={`${ids}-so`} inputMode="numeric" align="right" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} error={errors.sortOrder ?? null} />
      </SettingRow>
      {banner ? (
        <div className="pf-band pf-band--red" role="alert">
          <IconWarn />
          <span>{banner}</span>
        </div>
      ) : null}
    </Dialog>
  );
}
