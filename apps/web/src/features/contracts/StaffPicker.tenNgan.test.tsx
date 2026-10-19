import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as staffApi from '../../api/staff';
import type { StaffAvailability } from '../../api/types';
import { StaffPicker } from './StaffPicker';
import { StaffRow, type StaffPerson } from './StaffRow';
import { staffNaming } from '../../ui/staffName';
import { avatarColorIndex } from '../../ui/avatarColor';

// M3: ô chọn thợ nhận họ tên từ máy chủ (staff/availability.ts StaffAvailability.fullName) và chuyển tiếp cho hàng thợ,
// để tên ngắn ra đúng như mọi chỗ khác: "Linh Trần" giữ nguyên, "Nguyễn Thu Hà" (chưa đặt tên hiển thị) → "Hà".
vi.mock('../../api/staff', () => ({
  getStaffAvailability: vi.fn(),
  listStaffTiers: vi.fn(async () => ({ items: [] })),
  listStaff: vi.fn(async () => {
    throw new Error('không có quyền staff.read');
  }),
}));

function avail(membershipId: string, displayName: string, fullName: string): StaffAvailability {
  return { membershipId, displayName, fullName, avatarUrl: null, initials: 'XX', tier: null, isBookable: true, level: 'FREE', overlaps: [], sameDay: [], draftHolds: [] };
}

describe('M3: ô chọn thợ → hàng thợ mang họ tên', () => {
  it('BẮT: chọn "Linh Trần" (họ tên Trần Khánh Linh) và "Nguyễn Thu Hà" → people có fullName; hàng thợ "Linh Trần (chính), Hà"', async () => {
    vi.mocked(staffApi.getStaffAvailability).mockResolvedValue({
      startsAt: '',
      endsAt: '',
      dayStart: '',
      dayEnd: '',
      timezone: 'Asia/Ho_Chi_Minh',
      items: [avail('m-linh', 'Linh Trần', 'Trần Khánh Linh'), avail('m-ha', 'Nguyễn Thu Hà', 'Nguyễn Thu Hà')],
    } as never);
    let got: StaffPerson[] = [];
    render(
      <StaffPicker
        open
        onClose={() => {}}
        onConfirm={(_s, people) => {
          got = people;
        }}
        orgId="org-1"
        tz="Asia/Ho_Chi_Minh"
        query={{ startsAt: '2026-10-23T22:00:00.000Z', endsAt: '2026-10-23T22:45:00.000Z' }}
        initial={[]}
        subtitle="Mẹ cô dâu"
        localConflicts={new Map()}
        phone={false}
        naming={staffNaming([])}
      />,
    );
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Linh Trần' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Nguyễn Thu Hà' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chọn' }));
    await waitFor(() => expect(got.length).toBe(2));
    expect(got.map((p) => [p.membershipId, p.displayName, p.fullName])).toEqual([
      ['m-linh', 'Linh Trần', 'Trần Khánh Linh'],
      ['m-ha', 'Nguyễn Thu Hà', 'Nguyễn Thu Hà'],
    ]);
    const { container } = render(<StaffRow people={got} mode="view" naming={staffNaming(got)} />);
    expect(container.querySelector('.ct-tn')?.textContent).toBe('Linh Trần (chính), Hà');
  });
});

// D8 (biên bản nghiệm thu lần 4 — đột biến lọt): màu ảnh trong Ô CHỌN THỢ phải lấy từ sổ thợ (naming.colorKey), như hàng
// thợ ngay bên dưới và Lịch. Trước đây bài đọc mã chỉ soi thẻ <Avatar>, còn ô chọn thợ truyền màu qua PickerRow colorKey={…}
// nên đổi thành băm thẳng mã thành viên vẫn xanh. Bài này đo màu thật trên ảnh.
describe('D8: màu ảnh trong ô chọn thợ theo sổ thợ', () => {
  it('BẮT: "Linh Trần" và "Lê Minh Tú" (cùng chữ tắt LT, cùng màu băm gốc) → hai màu KHÁC nhau, đúng màu của sổ thợ', async () => {
    const a = 'm-linh';
    let b = '';
    for (let n = 0; n < 1000 && !b; n += 1) if (avatarColorIndex(`m-tu-${n}`) === avatarColorIndex(a)) b = `m-tu-${n}`;
    const LINH = { ...avail(a, 'Linh Trần', 'Trần Khánh Linh'), initials: 'LT' };
    const TU = { ...avail(b, 'Lê Minh Tú', 'Lê Minh Tú'), initials: 'LT' };
    vi.mocked(staffApi.getStaffAvailability).mockResolvedValue({ startsAt: '', endsAt: '', dayStart: '', dayEnd: '', timezone: 'Asia/Ho_Chi_Minh', items: [LINH, TU] } as never);
    const naming = staffNaming([LINH, TU]);
    render(
      <StaffPicker
        open
        onClose={() => {}}
        onConfirm={() => {}}
        orgId="org-1"
        tz="Asia/Ho_Chi_Minh"
        query={{ startsAt: '2026-10-23T22:00:00.000Z', endsAt: '2026-10-23T22:45:00.000Z' }}
        initial={[]}
        subtitle="Cô dâu"
        localConflicts={new Map()}
        phone={false}
        naming={naming}
      />,
    );
    await screen.findByRole('checkbox', { name: 'Linh Trần' });
    const tone = (name: string) => (document.querySelector(`[data-tho="${name}"] .ui-av`) as HTMLElement).style.background;
    const got = [tone('Linh Trần'), tone('Lê Minh Tú')];
    console.log(`[D8] màu ô chọn thợ: ${got.join(' / ')}`);
    expect(got).toEqual([`var(--av-${avatarColorIndex(naming.colorKey(a))})`, `var(--av-${avatarColorIndex(naming.colorKey(b))})`]);
    expect(got[0]).not.toBe(got[1]);
  });
});
