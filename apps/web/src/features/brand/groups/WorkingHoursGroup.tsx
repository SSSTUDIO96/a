import { Button, IconClose, IconPlus, Switch, TimeInput } from '../../../ui';
import { WEEKDAY_LABELS } from '../../public-site/format';
import { hoursKey, MAX_SHIFTS_PER_DAY, type DayDraft, type ShiftDraft } from '../model';
import { GroupTitle, type GroupProps } from './common';

// Nhóm "Giờ làm việc": 7 hàng Thứ Hai → Chủ nhật; mỗi thứ tối đa 2 ca. Lỗi (ca chồng, đóng trước mở) dưới đúng hàng.
export function WorkingHoursGroup({ draft, setDraft, errors, disabled }: GroupProps) {
  function updateDay(i: number, f: (d: DayDraft) => DayDraft) {
    setDraft((d) => ({ ...d, days: d.days.map((day, k) => (k === i ? f(day) : day)) }));
  }
  function updateShift(i: number, k: number, patch: Partial<ShiftDraft>) {
    updateDay(i, (day) => ({ ...day, shifts: day.shifts.map((s, n) => (n === k ? { ...s, ...patch } : s)) }));
  }

  return (
    <div className="br-group" data-group="gio-lam-viec">
      <GroupTitle tip="Mỗi ngày tối đa 2 ca, không chồng nhau. Giờ này chỉ để khách xem, không chặn lịch.">Giờ làm việc</GroupTitle>
      {errors.workingHours && (
        <p className="br-err" role="alert" data-field="workingHours">
          {errors.workingHours}
        </p>
      )}
      {draft.days.map((day, i) => {
        const name = WEEKDAY_LABELS[i] ?? '';
        const err = errors[hoursKey(i + 1)];
        return (
          <div key={name} className="br-wh" data-field={hoursKey(i + 1)}>
            <span className="br-wh__day">{name}</span>
            <Switch
              checked={day.open}
              disabled={disabled}
              aria-label={`${name} mở cửa`}
              onChange={(open) =>
                updateDay(i, (d) => ({ open, shifts: open && d.shifts.length === 0 ? [{ open: null, close: null }] : d.shifts }))
              }
            />
            <span className="br-wh__shifts">
              {day.open ? (
                <>
                  {day.shifts.map((s, k) => (
                    <span key={k} className="br-wh__shift">
                      <TimeInput
                        size="sm"
                        className="br-wh__time"
                        value={s.open}
                        disabled={disabled}
                        aria-label={`${name} ca ${k + 1} giờ mở`}
                        aria-invalid={err ? true : undefined}
                        onChange={(v) => updateShift(i, k, { open: v })}
                      />
                      <span className="br-wh__dash" aria-hidden="true">
                        –
                      </span>
                      <TimeInput
                        size="sm"
                        className="br-wh__time"
                        value={s.close}
                        disabled={disabled}
                        aria-label={`${name} ca ${k + 1} giờ đóng`}
                        aria-invalid={err ? true : undefined}
                        onChange={(v) => updateShift(i, k, { close: v })}
                      />
                      {k > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<IconClose />}
                          aria-label={`Bỏ ca ${k + 1} ${name}`}
                          disabled={disabled}
                          onClick={() => updateDay(i, (d) => ({ ...d, shifts: d.shifts.filter((_, n) => n !== k) }))}
                        />
                      )}
                    </span>
                  ))}
                  {day.shifts.length < MAX_SHIFTS_PER_DAY && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<IconPlus />}
                      disabled={disabled}
                      aria-label={`Thêm ca 2 ${name}`}
                      onClick={() => updateDay(i, (d) => ({ ...d, shifts: [...d.shifts, { open: null, close: null }] }))}
                    >
                      Ca 2
                    </Button>
                  )}
                </>
              ) : (
                <span className="br-wh__off">Nghỉ</span>
              )}
            </span>
            {err && (
              <span className="br-err br-wh__err" role="alert">
                {err}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
