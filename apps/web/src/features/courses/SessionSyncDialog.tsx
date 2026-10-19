import { useEffect, useState } from 'react';
import { syncClassSessions, type ClassView, type SessionSyncResult } from '../../api/courses';
import { userMessage } from '../../api/errors';
import { conflictsOf } from '../schedule/model';
import { dayKeyOf, ddmm, hhmm } from '../schedule/time';
import { Button, Dialog, ListRowSkeleton } from '../../ui';
import { fullDate, scheduleText, sessionSyncLines } from './logic';

// "Đưa buổi học lên Lịch" (việc tồn 6). Mở ra là XEM TRƯỚC (dryRun) — sẽ thêm / đổi / huỷ bao nhiêu buổi, trùng giờ với
// lịch nào của giảng viên — rồi mới ghi. Bấm lại bao nhiêu lần cũng không sinh trùng (máy chủ so với buổi đang có).

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; preview: SessionSyncResult }
  | { status: 'done'; result: SessionSyncResult };

export function SessionSyncDialog({
  orgId,
  cls,
  title,
  onClose,
  onDone,
}: {
  orgId: string;
  cls: ClassView;
  title: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    syncClassSessions(orgId, cls.id, true)
      .then((preview) => live && setState({ status: 'ready', preview }))
      .catch((err: unknown) => live && setState({ status: 'error', message: userMessage(err) }));
    return () => {
      live = false;
    };
  }, [orgId, cls.id, attempt]);

  async function apply() {
    setSaving(true);
    try {
      const result = await syncClassSessions(orgId, cls.id, false);
      setState({ status: 'done', result });
      onDone();
    } catch (err) {
      // Trùng giờ chen vào giữa lúc xem trước và lúc ghi: xem trước lại để hiện danh sách mới.
      if (conflictsOf(err)) setAttempt((n) => n + 1);
      else setState({ status: 'error', message: userMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  const preview = state.status === 'ready' ? state.preview : null;
  const conflicts = preview?.conflicts ?? [];
  const changes = preview ? preview.summary.create + preview.summary.update + preview.summary.cancel : 0;
  const canApply = preview !== null && conflicts.length === 0 && changes > 0;

  const footer =
    state.status === 'done' ? (
      <Button variant="primary" onClick={onClose}>
        Xong
      </Button>
    ) : (
      <>
        <Button onClick={onClose}>{canApply ? 'Huỷ' : 'Đóng'}</Button>
        {canApply && (
          <Button variant="primary" loading={saving} onClick={() => void apply()}>
            {cls.calendar.total === 0 ? 'Đưa lên Lịch' : 'Cập nhật Lịch'}
          </Button>
        )}
      </>
    );

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      width={560}
      className="kc-dlg"
      eyebrow={`${fullDate(cls.startDate)} → ${fullDate(cls.endDate)} · ${scheduleText(cls)}`}
      title={`Buổi học lớp ${title} trên Lịch`}
      footer={footer}
    >
      <div className="kc-sync" aria-live="polite">
        {state.status === 'loading' && <ListRowSkeleton rows={2} label="Đang xem trước buổi học" />}
        {state.status === 'error' && (
          <div className="kc-general" role="alert">
            {state.message}{' '}
            <Button size="sm" variant="ghost" onClick={() => setAttempt((n) => n + 1)}>
              Thử lại
            </Button>
          </div>
        )}
        {preview && (
          <>
            <ul className="kc-sync__list">
              {sessionSyncLines(preview.summary).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {conflicts.length > 0 ? (
              <div className="kc-sync__conf" role="alert">
                <b>Trùng giờ với lịch khác của giảng viên — chưa đưa buổi nào lên Lịch.</b>
                <ul>
                  {conflicts.map((c) => (
                    <li key={`${c.appointmentId}-${c.membershipId}`}>
                      <span className="num">{c.code}</span> · {c.staffName} · <span className="num">{conflictTime(c.startsAt, c.endsAt)}</span>
                    </li>
                  ))}
                </ul>
                <p>Đổi giờ / huỷ lịch trùng trên Lịch, hoặc đổi giảng viên / giờ học của lớp, rồi mở lại.</p>
              </div>
            ) : (
              <p className="kc-sync__note">
                Buổi học ở trạng thái Đã xác nhận và giữ giờ của giảng viên. Buổi đã diễn ra giữ nguyên. Sau này sửa lịch lớp
                hoặc huỷ lớp thì các buổi chưa diễn ra đổi theo.
              </p>
            )}
          </>
        )}
        {state.status === 'done' && (
          <p className="kc-sync__ok" role="status">
            Đã cập nhật Lịch: {state.result.class.calendar.upcoming} buổi sắp tới của lớp đang trên Lịch.
          </p>
        )}
      </div>
    </Dialog>
  );
}

// "02/03 18:00–20:00" theo giờ Việt Nam (hàm thời gian chung của màn Lịch).
function conflictTime(startsAt: string, endsAt: string): string {
  return `${ddmm(dayKeyOf(startsAt))} ${hhmm(startsAt)}–${hhmm(endsAt)}`;
}
