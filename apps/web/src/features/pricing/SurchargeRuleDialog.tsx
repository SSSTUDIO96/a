import { useId, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { createSurchargeRule, updateSurchargeRule } from '../../api/catalog';
import type { MakeupSubject, OccasionView, Service, ServicePackage, SurchargeRuleView } from '../../api/types';
import { useOnline } from '../../layout/ErrorStates';
import { Button, Checkbox, Chip, DateInput, Dialog, formatVnd, Segmented, Select, SettingRow, Switch, TextInput, Textarea, TimeInput, Tooltip, type SelectOption } from '../../ui';
import { useFirstErrorFocus, useInputErrors, useStableKey } from './formHooks';
import {
  RULE_NAME_MAX,
  RULE_NOTE_MAX,
  WEEKDAY_OPTIONS,
  buildRuleCreate,
  buildRulePatch,
  holidayDates,
  mapRuleError,
  mergeDates,
  ruleToForm,
  validateRuleForm,
  viDate,
  type FormErrors,
  type RuleForm,
} from './logic';
import { ErrorBanner, Group, GroupError } from './parts';

export interface RuleDialogLookups {
  // Phụ phí (kind SURCHARGE) — gồm cả cái đang ngừng; hộp chỉ cho chọn cái đang bật (+ cái luật này đang dùng).
  services: readonly Service[];
  occasions: readonly OccasionView[];
  packages: readonly ServicePackage[];
  subjects: readonly MakeupSubject[];
}

export const TIP_RULE_NAME = 'Hiện trên hợp đồng: "tự thêm theo luật {tên}".';
export const TIP_CONDITIONS = 'Điền điều kiện nào thì điều kiện đó phải đúng. Cần ít nhất một điều kiện: giờ, ngày hoặc loại sự kiện.';
export const TIP_TIME =
  'Tính theo giờ BẮT ĐẦU của ca. "Đến" không tính: 00:00–06:00 áp cho ca bắt đầu 05:59, không áp cho 06:00. "Đến" nhỏ hơn "Từ" là qua nửa đêm; nửa đêm nhập 00:00.';
export const TIP_DAYS = 'Đúng thứ đã chọn HOẶC đúng một ngày trong danh sách. Tết âm lịch: thêm từng ngày.';
export const TIP_SCOPE = 'Để trống = mọi gói / mọi nhân vật.';
export const TIP_QTY = 'Ví dụ: Phù dâu × 2 thì phụ phí × 2 khi chọn "Theo số người của dòng".';

const serviceLabel = (s: Service) => `${s.name} · ${s.currentPrice ? formatVnd(s.currentPrice.unitPrice) : 'chưa có giá'}`;

function ChipPicker({
  items,
  selected,
  onToggle,
  label,
  disabled,
}: {
  items: readonly { id: string; name: string; hidden?: boolean }[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  label: string;
  disabled?: boolean;
}) {
  if (items.length === 0) return <p className="pr-muted">Chưa có mục nào.</p>;
  return (
    <div className="pr-chips" role="group" aria-label={label}>
      {items.map((it) => (
        <Chip key={it.id} selected={selected.includes(it.id)} onClick={() => onToggle(it.id)} disabled={disabled}>
          {it.name}
          {it.hidden ? ' (đang ẩn)' : ''}
        </Chip>
      ))}
    </div>
  );
}

const toggleIn = (list: readonly string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

// Thêm / sửa luật phụ phí (POST /surcharge-rules · PATCH /surcharge-rules/:id). Máy chủ là nơi duy nhất kiểm luật và tính tiền.
export function SurchargeRuleDialog({
  orgId,
  rule,
  lookups,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  orgId: string;
  // null = thêm mới.
  rule: SurchargeRuleView | null;
  lookups: RuleDialogLookups;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (r: SurchargeRuleView) => void;
}) {
  const id = useId();
  const { orgSlug } = useParams();
  const online = useOnline();
  const [form, setForm] = useState<RuleForm>(() => ruleToForm(rule));
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const inputErrors = useInputErrors();
  const key = useStableKey();
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusFirstError = useFirstErrorFocus(bodyRef);

  const set = (patch: Partial<RuleForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      // Sửa một điều kiện thì lời "chưa có điều kiện nào" cũ không còn đúng.
      delete next.conditions;
      if ('useTime' in patch || 'startTime' in patch || 'endTime' in patch) {
        delete next.startTime;
        delete next.endTime;
      }
      if ('weekdays' in patch || 'dates' in patch || 'useDays' in patch) delete next.days;
      return next;
    });
  };

  // Phụ phí chọn được: đang bật; cộng thêm cái luật này đang dùng (kể cả đã ngừng) để ô không trống.
  const serviceOptions: SelectOption[] = lookups.services
    .filter((s) => s.kind === 'SURCHARGE' && (s.isActive || s.id === form.serviceId))
    .map((s) => ({ value: s.id, label: s.isActive ? serviceLabel(s) : `${serviceLabel(s)} (đang ngừng)` }));
  if (form.serviceId !== '' && !serviceOptions.some((o) => o.value === form.serviceId) && rule) {
    serviceOptions.push({ value: rule.serviceId, label: `${rule.service.name} (không còn là phụ phí)` });
  }

  const year = new Date().getFullYear();

  async function save() {
    setBanner(null);
    const v = validateRuleForm(form);
    setErrors(v);
    if (Object.keys(v).length > 0 || inputErrors.any()) {
      focusFirstError();
      return;
    }
    setSaving(true);
    try {
      if (rule) {
        const patch = buildRulePatch(rule, form);
        if (!patch) {
          onClose();
          return;
        }
        onSaved(await updateSurchargeRule(orgId, rule.id, patch));
      } else {
        const body = buildRuleCreate(form, nextSortOrder);
        onSaved(await createSurchargeRule(orgId, body, key.get(JSON.stringify(body))));
      }
    } catch (err) {
      const m = mapRuleError(err, form);
      setErrors(m.fields);
      setBanner(m.banner);
      focusFirstError();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={rule ? 'Sửa luật phụ phí' : 'Thêm luật phụ phí'}
      className="pr-dlg-rule"
      primaryLabel="Lưu"
      onPrimary={() => void save()}
      primaryLoading={saving}
      primaryDisabled={!online}
    >
      <div ref={bodyRef}>
        {banner && <ErrorBanner>{banner}</ErrorBanner>}
        <Group title="Thông tin">
          <SettingRow label="Tên luật" htmlFor={`${id}-ten`} tip={TIP_RULE_NAME} required controlWidth={260}>
            <TextInput id={`${id}-ten`} value={form.name} maxLength={RULE_NAME_MAX} onChange={(e) => set({ name: e.target.value })} error={errors.name} />
          </SettingRow>
          <SettingRow label="Phụ phí thu" htmlFor={`${id}-pp`} required controlWidth={260}>
            {serviceOptions.length === 0 ? (
              <span className="pr-muted pr-nosvc">
                Chưa có phụ phí nào — thêm ở{' '}
                <Link to={`/${orgSlug ?? ''}/bang-gia/dich-vu`} onClick={onClose}>
                  Dịch vụ phụ & phụ phí
                </Link>
              </span>
            ) : (
              <Select
                id={`${id}-pp`}
                options={serviceOptions}
                placeholder="Chọn phụ phí"
                value={form.serviceId}
                onChange={(e) => set({ serviceId: e.target.value })}
                error={errors.serviceId}
              />
            )}
          </SettingRow>
          <SettingRow label="Số lượng" tip={TIP_QTY} stack>
            <Segmented
              aria-label="Số lượng phụ phí"
              options={[
                { value: 'each', label: 'Theo số người của dòng' },
                { value: 'one', label: 'Một lần mỗi dòng' },
              ]}
              value={form.perQuantity ? 'each' : 'one'}
              onChange={(v) => set({ perQuantity: v === 'each' })}
            />
          </SettingRow>
        </Group>

        <Group title="Khi nào áp" tip={TIP_CONDITIONS}>
          <div className="pr-cond">
            <Checkbox label="Theo giờ bắt đầu" tip={<Tooltip text={TIP_TIME} />} checked={form.useTime} onChange={(e) => set({ useTime: e.target.checked })} />
            {form.useTime && (
              <div className="pr-cond__body pr-time">
                <span className="pr-time__lbl">Từ</span>
                <TimeInput
                  aria-label="Giờ bắt đầu của khung, từ"
                  value={form.startTime}
                  onChange={(v) => set({ startTime: v })}
                  onInputError={(m) => inputErrors.report('startTime', m)}
                  error={errors.startTime}
                  placeholder="00:00"
                />
                <span className="pr-time__lbl">Đến</span>
                <TimeInput
                  aria-label="Giờ bắt đầu của khung, đến"
                  value={form.endTime}
                  onChange={(v) => set({ endTime: v })}
                  onInputError={(m) => inputErrors.report('endTime', m)}
                  error={errors.endTime}
                  placeholder="06:00"
                />
              </div>
            )}
          </div>

          <div className="pr-cond">
            <Checkbox label="Theo ngày" tip={<Tooltip text={TIP_DAYS} />} checked={form.useDays} onChange={(e) => set({ useDays: e.target.checked })} />
            {form.useDays && (
              <div className="pr-cond__body">
                <div className="pr-chips" role="group" aria-label="Thứ trong tuần">
                  {WEEKDAY_OPTIONS.map((w) => (
                    <Chip
                      key={w.value}
                      selected={form.weekdays.includes(w.value)}
                      title={w.long}
                      onClick={() => set({ weekdays: form.weekdays.includes(w.value) ? form.weekdays.filter((x) => x !== w.value) : [...form.weekdays, w.value].sort((a, b) => a - b) })}
                    >
                      {w.short}
                    </Chip>
                  ))}
                </div>
                <div className="pr-adddate">
                  <DateInput
                    aria-label="Ngày cụ thể"
                    value={pendingDate}
                    onChange={setPendingDate}
                    onInputError={(m) => inputErrors.report('pendingDate', m)}
                  />
                  <Button
                    size="sm"
                    disabled={pendingDate === null}
                    onClick={() => {
                      if (pendingDate === null) return;
                      set({ dates: mergeDates(form.dates, [pendingDate]) });
                      setPendingDate(null);
                    }}
                  >
                    Thêm ngày
                  </Button>
                </div>
                <div className="pr-chips">
                  {[year, year + 1].map((y) => (
                    <Button key={y} variant="ghost" size="sm" onClick={() => set({ dates: mergeDates(form.dates, holidayDates(y)) })}>
                      Thêm ngày lễ năm {y}: 1/1, 30/4, 1/5, 2/9
                    </Button>
                  ))}
                </div>
                {form.dates.length > 0 && (
                  <div className="pr-chips" role="list" aria-label="Ngày cụ thể đã thêm">
                    {form.dates.map((d) => (
                      <span key={d} role="listitem" className="pr-datechip">
                        {viDate(d)}
                        <button type="button" aria-label={`Bỏ ngày ${viDate(d)}`} onClick={() => set({ dates: form.dates.filter((x) => x !== d) })}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <GroupError message={errors.days} />
              </div>
            )}
          </div>

          <div className="pr-cond">
            <Checkbox label="Theo loại sự kiện" checked={form.useOccasions} onChange={(e) => set({ useOccasions: e.target.checked })} />
            {form.useOccasions && (
              <div className="pr-cond__body">
                <ChipPicker
                  label="Loại sự kiện"
                  items={lookups.occasions.map((o) => ({ id: o.id, name: o.name, hidden: !o.isActive }))}
                  selected={form.occasionIds}
                  onToggle={(oid) => set({ occasionIds: toggleIn(form.occasionIds, oid) })}
                />
                <GroupError message={errors.occasionIds} />
              </div>
            )}
          </div>
          <GroupError message={errors.conditions} />
        </Group>

        <Group title="Chỉ áp cho (tuỳ chọn)" tip={TIP_SCOPE}>
          <SettingRow label="Gói" stack>
            <ChipPicker
              label="Gói dịch vụ"
              items={lookups.packages.filter((p) => p.isActive || form.packageIds.includes(p.id)).map((p) => ({ id: p.id, name: p.name }))}
              selected={form.packageIds}
              onToggle={(pid) => set({ packageIds: toggleIn(form.packageIds, pid) })}
            />
          </SettingRow>
          <SettingRow label="Nhân vật" stack>
            <ChipPicker
              label="Nhân vật makeup"
              items={lookups.subjects.filter((s) => s.isActive || form.subjectIds.includes(s.id)).map((s) => ({ id: s.id, name: s.name }))}
              selected={form.subjectIds}
              onToggle={(sid) => set({ subjectIds: toggleIn(form.subjectIds, sid) })}
            />
          </SettingRow>
        </Group>

        <Group title="Khác">
          <SettingRow label="Ghi chú" htmlFor={`${id}-gc`} stack>
            <Textarea id={`${id}-gc`} value={form.note} maxLength={RULE_NOTE_MAX} onChange={(e) => set({ note: e.target.value })} error={errors.note} />
          </SettingRow>
          <SettingRow label="Bật luật" htmlFor={`${id}-bat`} tip="Luật tắt không sinh dòng phụ phí mới; hợp đồng đã lưu giữ nguyên." controlWidth={260}>
            <Switch id={`${id}-bat`} checked={form.isActive} onChange={(v) => set({ isActive: v })} />
          </SettingRow>
        </Group>
      </div>
    </Dialog>
  );
}
