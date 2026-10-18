import { GroupTitle, TextRow, type GroupProps } from './common';

// Nhóm "Chính sách": 3 ô nhiều dòng, nhãn trên.
export function PoliciesGroup(props: GroupProps) {
  return (
    <div className="br-group" data-group="chinh-sach">
      <GroupTitle>Chính sách</GroupTitle>
      <TextRow {...props} field="bookingPolicy" label="Đặt lịch" multiline />
      <TextRow {...props} field="depositPolicy" label="Đặt cọc" multiline />
      <TextRow {...props} field="cancellationPolicy" label="Huỷ lịch" multiline />
    </div>
  );
}
