import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as staffApi from '../../api/staff';
import type { StaffAvailability } from '../../api/types';
import { StaffPicker } from './StaffPicker';
import { StaffRow, type StaffPerson } from './StaffRow';

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
    const { container } = render(<StaffRow people={got} mode="view" />);
    expect(container.querySelector('.ct-tn')?.textContent).toBe('Linh Trần (chính), Hà');
  });
});
