import { Card, IconLock } from '../../ui';
import { EmptyLine } from './parts';

// Người xem thiếu cả schedule.read_all lẫn schedule.read_own: máy chủ trả ca = null (không phải 0). Báo rõ, không bịa số ca.
export function NoScheduleCard() {
  return (
    <Card id="td-noschedule" className="td-card" title="Lịch" flush>
      <EmptyLine>
        <IconLock />
        Bạn không có quyền xem lịch nên Hôm nay không hiện ca nào.
      </EmptyLine>
    </Card>
  );
}
