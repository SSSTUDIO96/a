import { useRef, useState } from 'react';
import { createCourse, updateClass, updateCourse, type ClassView, type Course, type CourseGroup, type CourseMode } from '../../api/courses';
import { errorKind, userMessage } from '../../api/errors';
import { useOnline } from '../../layout/ErrorStates';
import {
  Button,
  Dialog,
  IconWarn,
  MoneyInput,
  Segmented,
  Select,
  SettingRow,
  TextInput,
  Textarea,
  UnitInput,
  type SelectOption,
} from '../../ui';
import { useFirstErrorFocus, useInputErrors, useStableKey } from './formHooks';
import {
  buildClassUpdate,
  buildCourseUpdate,
  buildCreateBody,
  courseToForm,
  emptyCourseForm,
  fullDate,
  hasErrors,
  liveClasses,
  mapServerErrors,
  validateCourseForm,
  withCourseCapacity,
  withCourseName,
  type CourseForm,
  type FieldKey,
  type FormErrors,
} from './logic';
import { ScheduleRows } from './ScheduleRows';
import type { Pickers } from './usePickers';

// Thêm / sửa khoá (bản vẽ C3 mục 2.2 — #khoa-moi, #khoa-moi-nhieu, #khoa-hoc-mo). Hộp 680px; điện thoại toàn màn.
// Bốn ô bắt buộc (ý anh Chiến): Tên khoá, Thời gian, Học phí, Số học viên tối đa — kèm lựa chọn Một lớp / Nhiều lớp.

export type CourseDialogTarget =
  | { kind: 'create' }
  // mode: mở sẵn kiểu khác (nút "Chuyển sang nhiều lớp").
  | { kind: 'edit'; course: Course; classes: ClassView[]; mode?: CourseMode };

export interface CourseDialogProps {
  orgId: string;
  target: CourseDialogTarget;
  groups: CourseGroup[];
  pickers: Pickers;
  can: { staff: boolean; locations: boolean };
  onClose: () => void;
  // Lưu xong: id khoá (thêm mới hoặc đã sửa).
  onSaved: (courseId: string, created: boolean) => void;
  // Bấm "Lưu trữ khoá" (màn mở hộp hỏi lý do).
  onArchive?: () => void;
}

const MODE_OPTIONS_TIP =
  'Một lớp: khoá chính là lớp, nhập luôn thời gian và số tối đa. Nhiều lớp: khoá giữ tên và học phí, mỗi đợt khai giảng mở một lớp riêng (ví dụ Nâng cao K1, K2). Đổi từ Một lớp sang Nhiều lớp lúc nào cũng được, lớp hiện tại giữ nguyên.';

export function CourseDialog({ orgId, target, groups, pickers, can, onClose, onSaved, onArchive }: CourseDialogProps) {
  const editing = target.kind === 'edit';
  const course = editing ? target.course : null;
  const wasSingle = course?.mode === 'SINGLE_CLASS';
  const live = editing ? liveClasses(target.classes) : [];
  const [singleClass, setSingleClass] = useState<ClassView | undefined>(wasSingle ? live[0] : undefined);
  const [form, setForm] = useState<CourseForm>(() => {
    if (target.kind === 'create') return emptyCourseForm();
    const f = courseToForm(target.course, target.classes);
    return target.mode ? { ...f, mode: target.mode } : f;
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const inputErrs = useInputErrors();
  const stableKey = useStableKey();
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusFirstError = useFirstErrorFocus(bodyRef);
  const online = useOnline();

  const set = (patch: Partial<CourseForm>, clear: FieldKey[] = []) => {
    setForm((f) => ({ ...f, ...patch }));
    if (clear.length) setErrors((e) => clearKeys(e, [...clear, 'general']));
  };

  const multi = form.mode === 'MULTI_CLASS';
  // Phần lịch: thêm khoá (lớp đầu tiên / lớp duy nhất) hoặc sửa khoá đang Một lớp (lịch của lớp duy nhất).
  const showSchedule = !editing || (wasSingle && singleClass !== undefined);
  // Số học viên tối đa nằm ở "Thông tin khoá" khi là số mặc định của khoá (Nhiều lớp); còn lại là số tối đa của lớp duy nhất.
  const capacityInInfo = editing ? !(wasSingle && singleClass !== undefined) : multi;
  const enrolled = singleClass?.enrolledCount ?? 0;

  const groupOptions: SelectOption[] = [{ value: '', label: 'Chưa xếp nhóm' }];
  for (const g of groups) {
    if (g.isActive || g.id === form.groupId) groupOptions.push({ value: g.id, label: g.isActive ? g.name : `${g.name} (đang ẩn)` });
  }

  const singleDisabledReason =
    editing && !wasSingle && live.length !== 1
      ? live.length === 0
        ? 'Khoá chưa có lớp nào — chỉ chuyển về Một lớp khi còn đúng 1 lớp'
        : `Khoá đang có ${live.length} lớp — chỉ chuyển về Một lớp khi còn 1 lớp`
      : undefined;

  async function save() {
    if (saving) return;
    const ctx = { editing, wasSingle: wasSingle && singleClass !== undefined };
    const v = validateCourseForm(form, ctx);
    if (inputErrs.count > 0) v.general = v.general ?? 'Sửa các ô đang báo lỗi trước khi lưu.';
    setErrors(v);
    if (hasErrors(v)) {
      focusFirstError();
      return;
    }
    setSaving(true);
    try {
      if (!course) {
        const body = buildCreateBody(form);
        const created = await createCourse(orgId, body, stableKey(JSON.stringify(body)));
        onSaved(created.course.id, true);
        return;
      }
      // Sửa khoá Một lớp: lưu lịch của lớp trước (lỗi số tối đa hiện ngay dưới ô), rồi lưu khoá.
      if (wasSingle && singleClass) {
        const classBody = buildClassUpdate(singleClass, { ...form, capacity: form.capacity });
        if (Object.keys(classBody).length > 0) {
          try {
            setSingleClass(await updateClass(orgId, singleClass.id, classBody));
          } catch (err) {
            throw Object.assign(new Error('class'), { cause: err, where: 'class' as const });
          }
        }
      }
      const courseBody = buildCourseUpdate(course, form);
      if (Object.keys(courseBody).length > 0) await updateCourse(orgId, course.id, courseBody);
      onSaved(course.id, false);
    } catch (e) {
      const where = (e as { where?: 'class' }).where === 'class' ? 'class' : 'course';
      const err = where === 'class' ? (e as { cause: unknown }).cause : e;
      const mapped = mapServerErrors(err, where, where === 'class' || !multi);
      if (errorKind(err) === 'network' || errorKind(err) === 'server' || errorKind(err) === 'forbidden') mapped.general = userMessage(err);
      setErrors(mapped);
      focusFirstError();
    } finally {
      setSaving(false);
    }
  }

  const title = editing ? 'Sửa khoá' : 'Thêm khoá';
  const eyebrow = course ? [groups.find((g) => g.id === course.groupId)?.name, course.code].filter(Boolean).join(' · ') : 'Khoá & lớp';

  const capacityRow = (
    <SettingRow
      label="Số học viên tối đa"
      required
      htmlFor="kc-cap"
      tip={
        capacityInInfo
          ? 'Số mặc định cho mỗi lớp mở sau này; từng lớp sửa riêng được.'
          : editing && wasSingle
            ? `Không đặt thấp hơn số đã ghi danh (${enrolled}).`
            : undefined
      }
      controlWidth={200}
    >
      <UnitInput
        id="kc-cap"
        unit="học viên"
        className="kc-unit-wide"
        value={form.capacity}
        error={errors.capacity}
        onInputError={(m) => inputErrs.report('capacity', m)}
        onChange={(v) => {
          setForm((f) => withCourseCapacity(f, v));
          setErrors((e) => clearKeys(e, ['capacity', 'classCapacity', 'general']));
        }}
      />
    </SettingRow>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      width={680}
      className="kc-dlg"
      eyebrow={eyebrow}
      title={title}
      footer={
        <>
          {editing && onArchive && (
            <Button variant="ghost" className="kc-foot-left" onClick={onArchive} disabled={saving}>
              Lưu trữ khoá
            </Button>
          )}
          <Button onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!online}>
            Lưu
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
        <SettingRow label="Kiểu khoá" tip={MODE_OPTIONS_TIP} controlWidth={280} className="kc-row--phone-stack">
          <div className="ui-field">
            <Segmented<CourseMode>
              aria-label="Kiểu khoá"
              block
              value={form.mode}
              options={[
                { value: 'SINGLE_CLASS', label: 'Một lớp', disabled: Boolean(singleDisabledReason), disabledReason: singleDisabledReason },
                { value: 'MULTI_CLASS', label: 'Nhiều lớp' },
              ]}
              onChange={(mode) => set({ mode }, ['mode'])}
            />
            {errors.mode && (
              <div className="ui-field__error" role="alert">
                {errors.mode}
              </div>
            )}
          </div>
        </SettingRow>
        {editing && wasSingle && singleClass && (
          <div className="kc-note" role="note">
            <IconWarn />
            <span>
              Bấm “Nhiều lớp”: khoá giữ tên, học phí; lớp hiện tại ({fullDate(singleClass.startDate)} → {fullDate(singleClass.endDate)},{' '}
              {singleClass.enrolledCount}/{singleClass.capacity} học viên) thành lớp đầu tiên, đặt tên được. Không mất học viên hay hợp đồng.
            </span>
          </div>
        )}

        <h3 className="kc-grp">Thông tin khoá</h3>
        <SettingRow label="Tên khoá" required htmlFor="kc-name" controlWidth={320} className="kc-row--phone-stack">
          <TextInput
            id="kc-name"
            value={form.name}
            maxLength={200}
            placeholder="Ví dụ: Makeup cá nhân đi tiệc"
            error={errors.name}
            onChange={(e) => {
              const name = e.target.value;
              setForm((f) => withCourseName(f, name));
              setErrors((x) => clearKeys(x, ['name', 'className', 'general']));
            }}
          />
        </SettingRow>
        <SettingRow label="Nhóm khoá" htmlFor="kc-group" tip="Nhóm do trung tâm tự đặt tên ở Cài đặt nhóm." controlWidth={240}>
          <Select id="kc-group" options={groupOptions} value={form.groupId} error={errors.groupId} onChange={(e) => set({ groupId: e.target.value }, ['groupId'])} />
        </SettingRow>
        <SettingRow label="Học phí" required htmlFor="kc-fee" controlWidth={200}>
          <MoneyInput
            id="kc-fee"
            value={form.tuitionFee}
            error={errors.tuitionFee}
            onInputError={(m) => inputErrs.report('fee', m)}
            onChange={(v) => set({ tuitionFee: v }, ['tuitionFee', 'depositAmount'])}
          />
        </SettingRow>
        <SettingRow label="Cọc mặc định" htmlFor="kc-dep" tip="Gợi ý khi lập hợp đồng; sửa được ở từng hợp đồng." controlWidth={200}>
          <MoneyInput
            id="kc-dep"
            value={form.depositAmount}
            error={errors.depositAmount}
            onInputError={(m) => inputErrs.report('deposit', m)}
            onChange={(v) => set({ depositAmount: v }, ['depositAmount'])}
          />
        </SettingRow>
        {capacityInInfo && capacityRow}
        <SettingRow label="Số buổi" tip="Không bắt buộc. Hiện ở trang khoá, ví dụ 8 buổi × 4 giờ." controlWidth={260}>
          <div className="ui-field kc-range-field">
            <div className="kc-range">
              <UnitInput
                aria-label="Số buổi"
                unit="buổi"
                value={form.sessionCount}
                onInputError={(m) => inputErrs.report('sessions', m)}
                onChange={(v) => set({ sessionCount: v }, ['session'])}
              />
              <span className="kc-range__sep" aria-hidden="true">
                ×
              </span>
              <UnitInput
                aria-label="Số phút mỗi buổi"
                unit="phút"
                value={form.sessionMinutes}
                onInputError={(m) => inputErrs.report('minutes', m)}
                onChange={(v) => set({ sessionMinutes: v }, ['session'])}
              />
            </div>
            {errors.session && (
              <div className="ui-field__error" role="alert">
                {errors.session}
              </div>
            )}
          </div>
        </SettingRow>
        <SettingRow label="Mô tả" htmlFor="kc-desc" stack>
          <Textarea
            id="kc-desc"
            value={form.description}
            maxLength={2000}
            placeholder="Ví dụ: Kỹ thuật nền mỏng, tạo khối, makeup ảnh cưới ngoại cảnh."
            error={errors.description}
            onChange={(e) => set({ description: e.target.value }, ['description'])}
          />
        </SettingRow>

        {showSchedule && (
          <>
            {multi && !editing ? (
              <h3 className="kc-grp kc-grp--split">
                Lớp đầu tiên <span className="kc-grp__aside">mở thêm lớp sau ở trang khoá</span>
              </h3>
            ) : (
              <h3 className="kc-grp">Thời gian & học viên</h3>
            )}
            {multi && (
              <SettingRow
                label="Tên lớp"
                required
                htmlFor="kc-class-name"
                tip={editing ? 'Lớp hiện tại thành lớp đầu tiên của khoá — đặt tên, ví dụ Nâng cao K1.' : 'Gợi ý: tên khoá + K và số thứ tự.'}
                controlWidth={240}
              >
                <TextInput
                  id="kc-class-name"
                  value={form.className}
                  maxLength={200}
                  error={errors.className}
                  onChange={(e) => set({ className: e.target.value, classNameTouched: true }, ['className'])}
                />
              </SettingRow>
            )}
            <ScheduleRows
              value={form}
              onChange={(patch) => set(patch, ['dates', 'weekdays', 'time', 'instructor', 'location'].filter((k) => keyTouched(k, patch)) as FieldKey[])}
              errors={errors}
              onInputError={inputErrs.report}
              pickers={pickers}
              can={can}
              current={singleClass ? { instructor: singleClass.instructor, location: singleClass.location } : undefined}
              afterTime={
                multi && !editing ? (
                  <SettingRow label="Số tối đa của lớp" required htmlFor="kc-class-cap" tip="Lấy sẵn từ số tối đa của khoá." controlWidth={200}>
                    <UnitInput
                      id="kc-class-cap"
                      unit="học viên"
                      className="kc-unit-wide"
                      value={form.classCapacity}
                      error={errors.classCapacity}
                      onInputError={(m) => inputErrs.report('classCapacity', m)}
                      onChange={(v) => set({ classCapacity: v, classCapacityTouched: true }, ['classCapacity'])}
                    />
                  </SettingRow>
                ) : (
                  !capacityInInfo && capacityRow
                )
              }
            />
          </>
        )}
      </div>
    </Dialog>
  );
}

function keyTouched(k: string, patch: object): boolean {
  const keys = Object.keys(patch);
  if (k === 'dates') return keys.includes('startDate') || keys.includes('endDate');
  if (k === 'time') return keys.includes('startTime') || keys.includes('endTime');
  if (k === 'instructor') return keys.includes('instructorId');
  if (k === 'location') return keys.includes('locationId');
  return keys.includes(k);
}

export function clearKeys(e: FormErrors, keys: readonly (FieldKey | 'general')[]): FormErrors {
  if (!keys.some((k) => e[k] !== undefined)) return e;
  const next = { ...e };
  for (const k of keys) delete next[k];
  return next;
}
