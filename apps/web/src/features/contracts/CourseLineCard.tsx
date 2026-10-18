import type { ClassListItem } from '../../api/courses';
import type { ContractEnrollment, ContractLineView } from '../../api/types';
import { Button, IconClose, StatusTag, Tooltip, formatVnd } from '../../ui';
import { fullDate, scheduleText } from '../courses/logic';
import { SeatTag } from '../courses/SeatTag';
import { classChoice, type CourseLineDraft } from './courseModel';

// Thẻ một dòng khoá học (bản vẽ C3 mục 2.3): nhãn "Khoá học" + tên khoá, danh sách CHỌN LỚP dạng radio (ngày → ngày,
// lịch, giảng viên, cơ sở, x/y, nhãn chỗ — lớp hết chỗ / ngừng nhận tắt, không chọn được), chân thẻ Học phí (số máy chủ).
export interface CourseLineCardProps {
  index: number;
  line: CourseLineDraft;
  // Lớp của khoá này (đã lọc), theo thứ tự ngày bắt đầu.
  classes: ClassListItem[];
  // Dòng tương ứng trong quote (nháp) hoặc hợp đồng đã lưu; null = đang chờ máy chủ tính.
  view: ContractLineView<string | null> | null;
  pending: boolean;
  locked: boolean;
  error: string | null;
  enrollment?: ContractEnrollment | null;
  onPickClass: (classId: string) => void;
  onRemove: (() => void) | null;
  onVoid: (() => void) | null;
}

function classTitle(c: ClassListItem): string {
  const prefix = c.course.mode === 'SINGLE_CLASS' ? 'Lớp' : /^lớp\s/i.test(c.name) ? '' : 'Lớp ';
  const name = c.course.mode === 'SINGLE_CLASS' ? '' : `${prefix}${c.name}`;
  return `${name ? `${name} · ` : ''}${fullDate(c.startDate)} → ${fullDate(c.endDate)}`;
}

export function CourseLineCard({ index, line, classes, view, pending, locked, error, enrollment, onPickClass, onRemove, onVoid }: CourseLineCardProps) {
  const voided = Boolean(view?.voidedAt);
  const shown = locked ? classes.filter((c) => c.id === line.classId) : classes.filter((c) => c.status !== 'CANCELLED' || c.id === line.classId);
  const group = `hd-lop-${line.key}`;
  return (
    <section className={`ct-ln ct-cl${voided ? ' ct-ln--void' : ''}`} aria-label={`Khoá ${line.courseName}`} aria-busy={pending || undefined}>
      <div className="ct-ln__hd ct-cl__hd">
        <StatusTag tone="accent">Khoá học</StatusTag>
        <span className="ct-ln__n">{line.courseName}</span>
        <span className="ct-ln__sp" />
        {enrollment && (
          <StatusTag tone={enrollment.status === 'ACTIVE' ? 'ok' : 'danger'}>
            {enrollment.status === 'ACTIVE' ? 'Đã ghi danh' : `Đã huỷ ghi danh${enrollment.cancelReason ? `: ${enrollment.cancelReason}` : ''}`}
          </StatusTag>
        )}
        {voided && view?.voidReason && <StatusTag tone="danger">Đã huỷ: {view.voidReason}</StatusTag>}
        {onVoid && !voided && (
          <Button variant="ghost" size="sm" onClick={onVoid}>
            Huỷ dòng
          </Button>
        )}
        {onRemove && (
          <Button variant="ghost" size="sm" icon={<IconClose />} aria-label={`Bỏ khoá ${line.courseName}`} onClick={onRemove} />
        )}
      </div>
      <div className="ct-cl__pick" role="radiogroup" aria-label={`Chọn lớp — ${line.courseName}`} aria-invalid={error ? true : undefined}>
        {!locked && (
          <div className="ct-cl__lbl">
            Chọn lớp
            <Tooltip text="Lớp đã đủ số tối đa hoặc ngừng nhận ghi danh không chọn được. Chỗ chỉ bị trừ khi xác nhận hợp đồng." />
          </div>
        )}
        {shown.length === 0 && <div className="ct-cat__empty">{locked ? 'Không tìm thấy lớp của dòng này.' : 'Khoá chưa mở lớp nào.'}</div>}
        {shown.map((c) => {
          const choice = classChoice(c);
          const on = c.id === line.classId;
          const off = !locked && choice.disabled && !on;
          return (
            <label key={c.id} className={`ct-cl__r${on ? ' is-on' : ''}${choice.disabled ? ' is-off' : ''}`} title={choice.reason ?? undefined}>
              {!locked && (
                <input
                  type="radio"
                  name={group}
                  value={c.id}
                  checked={on}
                  disabled={off}
                  aria-describedby={choice.reason ? `${group}-${c.id}-ly-do` : undefined}
                  onChange={() => onPickClass(c.id)}
                />
              )}
              <span className="ct-cl__m">
                <b>{classTitle(c)}</b>
                <span className="ct-fx">
                  {scheduleText(c)}
                  {c.instructor ? ` · ${c.instructor.name}` : ''}
                  {c.location ? ` · ${c.location.name}` : ''}
                </span>
                {choice.reason && (
                  <span className="ct-fx ct-cl__why" id={`${group}-${c.id}-ly-do`}>
                    {choice.reason}
                  </span>
                )}
              </span>
              <span className="ct-cl__seat">
                <span className="ct-fx ct-num">
                  {c.enrolledCount}/{c.capacity}
                </span>
                {c.status === 'CANCELLED' ? (
                  <StatusTag tone="danger">Đã huỷ</StatusTag>
                ) : c.status === 'CLOSED' ? (
                  <StatusTag tone="neutral">Ngừng nhận</StatusTag>
                ) : (
                  <SeatTag enrolledCount={c.enrolledCount} capacity={c.capacity} />
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <div className="ct-ln__err ct-err" role="alert" data-o={`loi-dong-${index}`}>
          {error}
        </div>
      )}
      <div className="ct-ln__ft">
        <span>Học phí</span>
        <b className={`ct-num ct-pend${voided ? ' ct-strike' : ''}`} data-o={`hoc-phi-${index}`}>
          {view ? formatVnd(view.lineTotal) : '—'}
        </b>
      </div>
    </section>
  );
}
