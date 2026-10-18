import { useId, type ReactNode } from 'react';
import { userMessage } from '../../api/errors';
import { Avatar, Select, SettingRow, type SelectOption } from '../../ui';
import { DateRange, TimeRange } from './DateRange';
import type { FormErrors, ScheduleFields } from './logic';
import type { Pickers } from './usePickers';
import { WeekdayChips } from './WeekdayChips';

// Các dòng lịch của một lớp — dùng chung cho Thêm / Sửa khoá (Một lớp, lớp đầu tiên của Nhiều lớp) và Mở / Sửa lớp.
// Mỗi dòng = nhãn + điều khiển; giải thích trong tooltip "?".
export function ScheduleRows({
  value,
  onChange,
  errors,
  onInputError,
  pickers,
  can,
  current,
  showLocation = true,
  datesTip = 'Ngày bắt đầu và ngày kết thúc của lớp.',
  afterTime,
}: {
  value: ScheduleFields;
  onChange: (patch: Partial<ScheduleFields>) => void;
  errors: FormErrors;
  onInputError: (key: string, message: string | null) => void;
  pickers: Pickers;
  can: { staff: boolean; locations: boolean };
  // Giảng viên / cơ sở đang gắn với lớp (giữ được cả khi không còn trong danh sách đang hoạt động).
  current?: { instructor: { membershipId: string; name: string } | null; location: { id: string; name: string } | null };
  showLocation?: boolean;
  datesTip?: string;
  // Dòng chen sau "Giờ học" (Số học viên tối đa) — đúng thứ tự bản mẫu.
  afterTime?: ReactNode;
}) {
  const wdLabel = useId();
  const staffOptions: SelectOption[] = [{ value: '', label: 'Chưa chọn' }];
  for (const m of pickers.staff ?? []) staffOptions.push({ value: m.membershipId, label: m.displayName || m.fullName });
  const ci = current?.instructor;
  if (ci && !staffOptions.some((o) => o.value === ci.membershipId)) staffOptions.push({ value: ci.membershipId, label: ci.name });
  const selectedStaff = staffOptions.find((o) => o.value === value.instructorId && o.value !== '');

  const locOptions: SelectOption[] = [{ value: '', label: 'Chưa chọn' }];
  for (const l of pickers.locations ?? []) locOptions.push({ value: l.id, label: l.name });
  const cl = current?.location;
  if (cl && !locOptions.some((o) => o.value === cl.id)) locOptions.push({ value: cl.id, label: cl.name });
  const locAddress = pickers.locations?.find((l) => l.id === value.locationId)?.address;

  return (
    <>
      <SettingRow label="Thời gian" required tip={datesTip} controlWidth={340} className="kc-row--phone-stack">
        <DateRange
          start={value.startDate}
          end={value.endDate}
          error={errors.dates}
          onChange={(startDate, endDate) => onChange({ startDate, endDate })}
          onInputError={(k, m) => onInputError(`date-${k}`, m)}
        />
      </SettingRow>
      <SettingRow label={<span id={wdLabel}>Lịch học</span>} required controlWidth={360} className="kc-row--phone-stack">
        <WeekdayChips value={value.weekdays} onChange={(weekdays) => onChange({ weekdays })} error={errors.weekdays} labelledBy={wdLabel} />
      </SettingRow>
      <SettingRow label="Giờ học" tip="Để trống nếu lớp chưa chốt giờ." controlWidth={260} className="kc-row--phone-stack">
        <TimeRange
          start={value.startTime}
          end={value.endTime}
          error={errors.time}
          onChange={(startTime, endTime) => onChange({ startTime, endTime })}
          onInputError={(k, m) => onInputError(`time-${k}`, m)}
        />
      </SettingRow>
      {afterTime}
      {can.staff && (
        <SettingRow label="Giảng viên" controlWidth={280} className="kc-row--phone-stack">
          <span className="kc-person">
            {selectedStaff && <Avatar name={selectedStaff.label} colorKey={selectedStaff.value} size="sm" />}
            <Select
              aria-label="Giảng viên"
              options={staffOptions}
              value={value.instructorId}
              disabled={pickers.staff === null && !pickers.staffError}
              error={pickers.staffError ? userMessage(pickers.staffError) : errors.instructor}
              onChange={(e) => onChange({ instructorId: e.target.value })}
            />
          </span>
        </SettingRow>
      )}
      {showLocation && can.locations && (
        <SettingRow label="Ở đâu" tip="Cơ sở học. Thêm cơ sở ở Bảng giá → Phí di chuyển & studio." controlWidth={300} className="kc-row--phone-stack">
          <Select
            aria-label="Ở đâu"
            options={locOptions}
            value={value.locationId}
            disabled={pickers.locations === null && !pickers.locationsError}
            error={pickers.locationsError ? userMessage(pickers.locationsError) : errors.location}
            hint={locAddress}
            onChange={(e) => onChange({ locationId: e.target.value })}
          />
        </SettingRow>
      )}
    </>
  );
}
