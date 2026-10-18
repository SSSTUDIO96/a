import { useEffect, useState } from 'react';
import { listEnrollments, type ClassView, type Enrollment } from '../../api/courses';
import { userMessage } from '../../api/errors';
import { Button, ContractStatusTag, Dialog, EmptyState, formatVnd, ListGroupHeader, ListRowSkeleton, StatusTag } from '../../ui';
import { fullDate } from './logic';

// Danh sách học viên của một lớp (GET /classes/:id/enrollments). Số điện thoại cần quyền xem khách; tiền hợp đồng cần
// quyền xem hợp đồng / thu tiền — máy chủ trả null khi thiếu quyền, màn ghi "Ẩn" chứ không đoán.

type State = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; items: Enrollment[] };

export function EnrollmentsDialog({ orgId, cls, title, onClose }: { orgId: string; cls: ClassView; title: string; onClose: () => void }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setState({ status: 'loading' });
    listEnrollments(orgId, cls.id, c.signal)
      .then((r) => !c.signal.aborted && setState({ status: 'ready', items: r.items }))
      .catch((error: unknown) => !c.signal.aborted && setState({ status: 'error', error }));
    return () => c.abort();
  }, [orgId, cls.id, attempt]);

  const active = state.status === 'ready' ? state.items.filter((e) => e.status === 'ACTIVE') : [];
  const gone = state.status === 'ready' ? state.items.filter((e) => e.status !== 'ACTIVE') : [];

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      width={560}
      className="kc-dlg"
      eyebrow={`${fullDate(cls.startDate)} → ${fullDate(cls.endDate)} · ${cls.enrolledCount}/${cls.capacity} học viên`}
      title={`Học viên lớp ${title}`}
      footer={<Button onClick={onClose}>Đóng</Button>}
    >
      <div className="kc-enr">
        {state.status === 'loading' && <ListRowSkeleton rows={3} amount label="Đang tải học viên" />}
        {state.status === 'error' && (
          <div className="kc-general" role="alert">
            <span>{userMessage(state.error)}</span>
            <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
              Thử lại
            </Button>
          </div>
        )}
        {state.status === 'ready' && state.items.length === 0 && <EmptyState message="Chưa có học viên ghi danh lớp này." />}
        {active.length > 0 && (
          <>
            <ListGroupHeader aside={`${active.length} học viên`}>Đang học</ListGroupHeader>
            {active.map((e) => (
              <EnrollmentRow key={e.id} e={e} />
            ))}
          </>
        )}
        {gone.length > 0 && (
          <>
            <ListGroupHeader aside={String(gone.length)}>Đã huỷ ghi danh</ListGroupHeader>
            {gone.map((e) => (
              <EnrollmentRow key={e.id} e={e} />
            ))}
          </>
        )}
      </div>
    </Dialog>
  );
}

function EnrollmentRow({ e }: { e: Enrollment }) {
  const money = e.contract.total !== null && e.contract.paid !== null;
  return (
    <div className="kc-enr__row">
      <div className="kc-enr__who">
        <b>{e.customer.fullName}</b>
        <span className="kc-enr__sub">
          {e.customer.phoneHidden ? 'Số điện thoại: cần quyền xem khách' : (e.customer.phone ?? 'Chưa có số điện thoại')} · {e.contract.code}
          {e.status === 'CANCELLED' && e.cancelReason ? ` · ${e.cancelReason}` : ''}
        </span>
      </div>
      <div className="kc-enr__right">
        {money ? (
          <span className="kc-enr__money num">
            Đã thu {formatVnd(e.contract.paid ?? 0)} / {formatVnd(e.contract.total ?? 0)}
          </span>
        ) : (
          <span className="kc-enr__sub">Tiền: cần quyền xem hợp đồng</span>
        )}
        {e.status === 'CANCELLED' ? <StatusTag tone="danger">Huỷ ghi danh</StatusTag> : <ContractStatusTag status={e.contract.status} />}
      </div>
    </div>
  );
}
