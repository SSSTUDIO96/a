import { Link } from 'react-router';
import type { TodayView } from '../../api/types';
import { StatGrid, StatTile } from '../../ui';
import { money } from '../payments/money';
import { hhmm, leadStaffName, nextAppointment } from './model';

// 4 ô số đầu trang (chỉ giao diện ALL). Số lấy nguyên từ `counts` máy chủ trả — web không cộng.
// Bấm ô → cuộn tới thẻ tương ứng (con trỏ chuột; bàn phím đi thẳng tới thẻ bằng Tab — ô có dấu "?" nên không bọc nút). Ô "Ca hôm nay" mở Lịch hôm nay.
// Ô tiền chỉ vẽ khi máy chủ trả counts.overdue / counts.dueSoon (không có quyền xem tiền → null → ô ẩn, không "0 ₫").
export function TodayTiles({ view, orgSlug, onJump }: { view: TodayView; orgSlug: string; onJump: (cardId: string) => void }) {
  const { counts } = view;
  const next = nextAppointment(view);
  const nextNote = next ? `${hhmm(next.startsAt, view.timezone)} ${leadStaffName(next) ?? 'chưa có thợ'}` : counts.appointmentsToday === 0 ? 'Không có ca' : 'Đã qua giờ bắt đầu hết các ca';
  // Không có quyền xem lịch: máy chủ trả số ca = null → không vẽ hai ô ca (không hiện 0).
  const { appointmentsToday, appointmentsTomorrow } = counts;
  const unassigned = counts.unassignedSoon;
  const tiles = [
    appointmentsToday === null ? null : (
    <Link key="today" to={`/${orgSlug}/lich?ngay=${view.today}`} className="td-tile" data-tile="today" aria-label={`Ca hôm nay: ${appointmentsToday}. Mở Lịch`}>
      <StatTile label="Ca hôm nay" value={appointmentsToday} note={nextNote} />
    </Link>
    ),
    appointmentsTomorrow === null ? null : (
    <div key="tomorrow" className="td-tile" data-tile="tomorrow" onClick={() => onJump('td-tomorrow')}>
      <StatTile
        label="Ca ngày mai"
        value={appointmentsTomorrow}
        variant={unassigned !== null && unassigned > 0 ? 'highlight' : 'default'}
        note={unassigned === null ? undefined : unassigned > 0 ? `${unassigned} ca chưa có thợ (7 ngày tới)` : 'Mọi ca 7 ngày tới đã có thợ.'}
        noteTone={unassigned !== null && unassigned > 0 ? 'warn' : 'default'}
      />
    </div>
    ),
    counts.overdue ? (
      <div key="overdue" className="td-tile" data-tile="overdue" onClick={() => onJump('td-needs')}>
        <StatTile
          label="Đợt thu quá hạn"
          value={counts.overdue.count}
          variant="danger"
          note={counts.overdue.count === 0 ? 'Không có đợt nào quá hạn.' : money(counts.overdue.amount)}
          noteTone={counts.overdue.count === 0 ? 'default' : 'danger'}
          tip="Tính theo tiền đã thu đến lúc mở trang."
        />
      </div>
    ) : null,
    counts.dueSoon ? (
      <div key="due" className="td-tile" data-tile="due" onClick={() => onJump('td-due')}>
        <StatTile label="Đến hạn 7 ngày tới" value={counts.dueSoon.count} note={money(counts.dueSoon.amount)} tip="Tính theo tiền đã thu đến lúc mở trang." />
      </div>
    ) : null,
  ].filter((t) => t !== null);
  if (tiles.length === 0) return null;
  const columns = Math.min(4, Math.max(2, tiles.length)) as 2 | 3 | 4;
  return (
    <StatGrid label="Số liệu hôm nay" columns={columns} className="td-tiles">
      {tiles}
    </StatGrid>
  );
}
