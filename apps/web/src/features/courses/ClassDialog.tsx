import { useRef, useState } from 'react';
import { createClass, updateClass, type ClassView, type Course } from '../../api/courses';
import { errorKind, userMessage } from '../../api/errors';
import { useOnline } from '../../layout/ErrorStates';
import { Button, Dialog, IconWarn, SettingRow, Switch, TextInput, UnitInput } from '../../ui';
import { clearKeys } from './CourseDialog';
import { useFirstErrorFocus, useInputErrors, useStableKey } from './formHooks';
import {
  buildClassCreate,
  buildClassUpdate,
  classToSchedule,
  conflictReason,
  hasErrors,
  mapServerErrors,
  nextClassName,
  validateSchedule,
  type FieldKey,
  type FormErrors,
  type ScheduleFields,
} from './logic';
import { ScheduleRows } from './ScheduleRows';
import type { Pickers } from './usePickers';

// Mở lớp / sửa lớp của khoá Nhiều lớp (bản vẽ C3 mục 2.2 — #lop-moi). Tên gợi ý số K tiếp theo; số tối đa lấy sẵn từ khoá.

export type ClassDialogTarget = { kind: 'create' } | { kind: 'edit'; cls: ClassView };

export interface ClassDialogProps {
  orgId: string;
  course: Course;
  classes: ClassView[];
  target: ClassDialogTarget;
  pickers: Pickers;
  can: { staff: boolean; locations: boolean };
  onClose: () => void;
  onSaved: () => void;
  // 409 SINGLE_CLASS: khoá đã thành Một lớp (người khác vừa đổi) — màn tải lại khoá.
  onStale: () => void;
  // Bấm "Huỷ lớp" (màn mở hộp hỏi lý do).
  onCancelClass?: () => void;
}

interface ClassForm extends ScheduleFields {
  name: string;
  capacity: number | null;
  open: boolean;
}

export function ClassDialog({ orgId, course, classes, target, pickers, can, onClose, onSaved, onStale, onCancelClass }: ClassDialogProps) {
  const editing = target.kind === 'edit' ? target.cls : null;
  const [form, setForm] = useState<ClassForm>(() =>
    editing
      ? { ...classToSchedule(editing), name: editing.name, capacity: editing.capacity, open: editing.status === 'OPEN' }
      : {
          name: nextClassName(course.name, classes),
          capacity: course.defaultCapacity,
          open: true,
          startDate: null,
          endDate: null,
          weekdays: [],
          startTime: null,
          endTime: null,
          instructorId: '',
          locationId: '',
        },
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const inputErrs = useInputErrors();
  const stableKey = useStableKey();
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusFirstError = useFirstErrorFocus(bodyRef);
  const online = useOnline();

  const set = (patch: Partial<ClassForm>, clear: (FieldKey | 'general')[]) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => clearKeys(e, [...clear, 'general']));
  };

  async function save() {
    if (saving) return;
    const v: FormErrors = validateSchedule(form);
    if (!form.name.trim()) v.className = 'Nhập tên lớp, ví dụ "Nâng cao K1"';
    if (form.capacity === null) v.classCapacity = 'Nhập số học viên tối đa';
    else if (form.capacity < 1) v.classCapacity = 'Số học viên tối đa ít nhất 1';
    else if (form.capacity > 500) v.classCapacity = 'Số học viên tối đa không quá 500';
    if (inputErrs.count > 0) v.general = 'Sửa các ô đang báo lỗi trước khi lưu.';
    setErrors(v);
    if (hasErrors(v)) {
      focusFirstError();
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const body = buildClassUpdate(editing, { ...form, status: form.open ? 'OPEN' : 'CLOSED' });
        if (Object.keys(body).length > 0) await updateClass(orgId, editing.id, body);
      } else {
        const body = buildClassCreate(form);
        await createClass(orgId, course.id, body, stableKey(JSON.stringify(body)));
      }
      onSaved();
    } catch (err) {
      const mapped = mapServerErrors(err, 'class');
      if (['network', 'server', 'forbidden'].includes(errorKind(err))) mapped.general = userMessage(err);
      if (conflictReason(err) === 'SINGLE_CLASS') onStale();
      setErrors(mapped);
      focusFirstError();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      width={680}
      className="kc-dlg"
      eyebrow={`${course.name} · ${course.code}`}
      title={editing ? `Sửa lớp ${editing.name}` : 'Mở lớp mới'}
      footer={
        <>
          {editing && onCancelClass && (
            <Button variant="ghost" className="kc-foot-left kc-danger-text" onClick={onCancelClass} disabled={saving}>
              Huỷ lớp
            </Button>
          )}
          <Button onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!online}>
            {editing ? 'Lưu' : 'Mở lớp'}
          </Button>
        </>
      }
    >
      <div ref={bodyRef} className="kc-form">
        {errors.general && (
          <div className="kc-general" role="alert">
            <IconWarn />
            <span>{errors.general}</span>
          </div>
        )}
        <SettingRow label="Tên lớp" required htmlFor="kc-cl-name" tip="Gợi ý: tên khoá + K và số thứ tự." controlWidth={240} className="kc-row--phone-stack">
          <TextInput
            id="kc-cl-name"
            value={form.name}
            maxLength={200}
            error={errors.className}
            onChange={(e) => set({ name: e.target.value }, ['className'])}
          />
        </SettingRow>
        <ScheduleRows
          value={form}
          onChange={(patch) => set(patch, ['dates', 'weekdays', 'time', 'instructor', 'location'])}
          errors={errors}
          onInputError={inputErrs.report}
          pickers={pickers}
          can={can}
          current={editing ? { instructor: editing.instructor, location: editing.location } : undefined}
          afterTime={
            <SettingRow
              label="Số học viên tối đa"
              required
              htmlFor="kc-cl-cap"
              tip={
                editing
                  ? `Không đặt thấp hơn số đã ghi danh (${editing.enrolledCount}).`
                  : `Lấy sẵn từ khoá (${course.defaultCapacity}). Sửa riêng cho lớp này được.`
              }
              controlWidth={200}
            >
              <UnitInput
                id="kc-cl-cap"
                unit="học viên"
                className="kc-unit-wide"
                value={form.capacity}
                error={errors.classCapacity}
                onInputError={(m) => inputErrs.report('capacity', m)}
                onChange={(v) => set({ capacity: v }, ['classCapacity'])}
              />
            </SettingRow>
          }
        />
        {editing && (
          <SettingRow label="Nhận ghi danh" htmlFor="kc-cl-open" tip="Tắt: lớp ngừng nhận ghi danh dù còn chỗ. Học viên đã ghi danh giữ nguyên.">
            <Switch id="kc-cl-open" checked={form.open} aria-label="Nhận ghi danh" onChange={(open) => set({ open }, ['status'])} />
          </SettingRow>
        )}
        {errors.status && (
          <div className="ui-field__error" role="alert">
            {errors.status}
          </div>
        )}
      </div>
    </Dialog>
  );
}
