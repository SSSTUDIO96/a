import { useEffect, useState, type ReactNode } from 'react';
import { userMessage } from '../../api/errors';
import type { StaffAvailability } from '../../api/types';
import { Avatar, BottomSheet, Button, Dialog, Segmented, StatusTag, Tooltip } from '../../ui';
import { timeOf, type StaffAssignment, type WarnRange } from './model';
import type { StaffPerson } from './StaffRow';
import { groupByTier, pickableStaff, useStaffAvailability, type AvailabilityQueryArgs } from './useStaffAvailability';

// Ô chọn thợ phụ trách (bản vẽ 4.3, bổ sung 18/10/2026). Máy tính/máy tính bảng: Dialog rộng min(560px, 100%);
// điện thoại: BottomSheet. Thợ trùng giờ VẪN chọn được (chủ studio có thể đang định dời ca kia) — cảnh báo hiện ở thẻ dòng.

export interface StaffPickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (staff: StaffAssignment[], people: StaffPerson[]) => void;
  orgId: string;
  tz: string;
  query: AvailabilityQueryArgs | null;
  initial: StaffAssignment[];
  // "Mẹ cô dâu · 05:00 – 05:45 · Thứ Bảy 24/10"
  subtitle: string;
  // Thợ đang được gán cho dòng khác của CHÍNH hợp đồng này, chồng giờ với dòng đang chọn.
  localConflicts: Map<string, WarnRange[]>;
  phone: boolean;
}

export function toggleStaff(list: StaffAssignment[], membershipId: string): StaffAssignment[] {
  const found = list.find((s) => s.membershipId === membershipId);
  if (!found) {
    const role = list.some((s) => s.role === 'PRIMARY') ? 'ASSIST' : 'PRIMARY';
    return [...list, { membershipId, role }];
  }
  const rest = list.filter((s) => s.membershipId !== membershipId);
  // Bỏ thợ chính thì người đầu tiên còn lại lên làm thợ chính (mỗi dòng tối đa một thợ chính).
  if (found.role === 'PRIMARY' && rest.length > 0 && !rest.some((s) => s.role === 'PRIMARY')) {
    return rest.map((s, i) => (i === 0 ? { ...s, role: 'PRIMARY' } : s));
  }
  return rest;
}

export function setRole(list: StaffAssignment[], membershipId: string, role: StaffAssignment['role']): StaffAssignment[] {
  return list.map((s) => {
    if (s.membershipId === membershipId) return { ...s, role };
    return role === 'PRIMARY' ? { ...s, role: 'ASSIST' } : s;
  });
}

export function StaffPicker(props: StaffPickerProps) {
  const { open, onClose, phone } = props;
  const state = useStaffAvailability(props.orgId, open ? props.query : null);
  const [picked, setPicked] = useState<StaffAssignment[]>(props.initial);
  useEffect(() => {
    if (open) setPicked(props.initial);
    // Mở lại ô chọn thì bắt đầu từ thợ đang gán của dòng.
  }, [open]);

  const confirm = () => {
    const items = state.status === 'ready' ? state.items : [];
    const people: StaffPerson[] = picked.map((s) => {
      const a = items.find((x) => x.membershipId === s.membershipId);
      return { ...s, displayName: a?.displayName ?? '', fullName: a?.fullName, initials: a?.initials, avatarUrl: a?.avatarUrl ?? null };
    });
    props.onConfirm(picked, people);
  };

  const title: ReactNode = (
    <>
      Chọn thợ phụ trách
      <span className="ct-picker__sub">{props.subtitle}</span>
    </>
  );
  let body: ReactNode;
  if (state.status === 'loading' || state.status === 'idle') body = <div className="ct-picker__state">Đang tải danh sách thợ…</div>;
  else if (state.status === 'error') body = <div className="ct-picker__state ct-err">{userMessage(state.error)}</div>;
  else
    body = (
      <div>
        {groupByTier(pickableStaff(state.items, state.members, new Set(props.initial.map((s) => s.membershipId))), state.tiers).map((g) => (
          <div key={g.id ?? 'chua-xep-bac'} role="group" aria-label={g.name}>
            <div className="ct-lbl">{g.name}</div>
            {g.items.map((s) => (
              <PickerRow
                key={s.membershipId}
                s={s}
                tz={props.tz}
                local={props.localConflicts.get(s.membershipId) ?? []}
                assignment={picked.find((p) => p.membershipId === s.membershipId) ?? null}
                onToggle={() => setPicked((l) => toggleStaff(l, s.membershipId))}
                onRole={(role) => setPicked((l) => setRole(l, s.membershipId, role))}
              />
            ))}
          </div>
        ))}
      </div>
    );
  const footer = (
    <>
      <Button onClick={onClose}>Huỷ</Button>
      <Button variant="primary" onClick={confirm} disabled={state.status !== 'ready'}>
        Chọn
      </Button>
    </>
  );
  if (phone) {
    return (
      <BottomSheet open={open} onClose={onClose} title={title} footer={footer} className="ct-sheet">
        {body}
      </BottomSheet>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} title={title} footer={footer} className="ct-picker" closeOnOverlay>
      {body}
    </Dialog>
  );
}

function PickerRow({
  s,
  tz,
  local,
  assignment,
  onToggle,
  onRole,
}: {
  s: StaffAvailability;
  tz: string;
  local: WarnRange[];
  assignment: StaffAssignment | null;
  onToggle: () => void;
  onRole: (r: StaffAssignment['role']) => void;
}) {
  const on = assignment !== null;
  const off = !s.isBookable;
  const overlaps: WarnRange[] = [
    ...s.overlaps.map((o) => ({ start: timeOf(o.startsAt, tz), end: timeOf(o.endsAt, tz), label: [o.code, o.title, o.customerName].filter(Boolean).join(' · ') })),
    ...local,
  ];
  const sameDay = s.sameDay;
  return (
    <label className={`ct-pr${on ? ' ct-pr--on' : ''}${off ? ' ct-pr--off' : ''}`} data-tho={s.displayName}>
      <input type="checkbox" checked={on} disabled={off && !on} onChange={onToggle} aria-label={s.displayName} />
      <Avatar size="sm" name={s.displayName} initials={s.initials} avatarUrl={s.avatarUrl} colorKey={s.membershipId} />
      <span className="ct-pr__tt">
        <b>{s.displayName}</b>
        <span className="ct-pr__nh">
          {off && <StatusTag>Tắt nhận lịch</StatusTag>}
          {!off && overlaps.length > 0 && (
            <>
              <StatusTag tone="danger">Trùng giờ {overlaps.map((o) => `${o.start}–${o.end}`).join(', ')}</StatusTag>
              <Tooltip label={`Chi tiết trùng giờ của ${s.displayName}`} text={overlaps.map((o) => `${o.start}–${o.end} ${o.label}`).join('; ')} />
            </>
          )}
          {!off && overlaps.length === 0 && sameDay.length > 0 && (
            <details className="ct-sd">
              <summary>
                <StatusTag tone="warn">Có lịch trong ngày · {sameDay.length} ca</StatusTag>
              </summary>
              <div className="ct-fx">
                {sameDay.map((c) => (
                  <div key={c.appointmentId}>
                    {timeOf(c.startsAt, tz)}–{timeOf(c.endsAt, tz)} · {[c.code, c.title, c.customerName].filter(Boolean).join(' · ')}
                  </div>
                ))}
              </div>
            </details>
          )}
          {s.draftHolds.length > 0 && (
            <>
              <StatusTag>Giữ chỗ nháp</StatusTag>
              <Tooltip
                label={`Giữ chỗ nháp của ${s.displayName}`}
                text={`Đang nằm trong một hợp đồng nháp khác cùng giờ. Chưa chặn lịch. ${s.draftHolds
                  .map((h) => `${h.code} · ${h.lineName}${h.scheduledStart && h.scheduledEnd ? ` ${timeOf(h.scheduledStart, tz)}–${timeOf(h.scheduledEnd, tz)}` : ''}`)
                  .join('; ')}`}
              />
            </>
          )}
        </span>
      </span>
      {on && (
        <Segmented
          size="sm"
          className="ct-pr__role"
          aria-label={`Vai trò của ${s.displayName}`}
          value={assignment.role}
          onChange={onRole}
          options={[
            { value: 'PRIMARY', label: 'Chính' },
            { value: 'ASSIST', label: 'Phụ' },
          ]}
        />
      )}
    </label>
  );
}
