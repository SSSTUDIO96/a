import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, AvatarStack, initialsOf } from './Avatar';

// Luật chữ tắt phải GIỐNG HỆT máy chủ (apps/api/src/modules/staff/common.ts:5-11): chữ đầu tiếng đầu + chữ đầu tiếng cuối.
// Biên bản nghiệm thu cuối L2: web từng lấy 2 tiếng cuối → "KL" trên thẻ ca, "TL" ở đầu hàng cho cùng một người.
describe('initialsOf — cùng luật máy chủ', () => {
  it.each([
    ['Trần Khánh Linh', 'TL'],
    ['Lê Minh Tú', 'LT'],
    ['Phạm Thu Hà', 'PH'],
    ['Nguyễn Thị Hoa', 'NH'],
    ['Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', 'TT'],
    ['Thu Hà', 'TH'],
    ['  đỗ   ánh  ', 'ĐÁ'],
    ['Linh', 'L'],
    ['', '?'],
    ['   ', '?'],
  ])('%j → %s', (name, want) => {
    expect(initialsOf(name)).toBe(want);
  });
});

describe('Avatar', () => {
  it('API gửi initials → dùng nguyên chữ API; không gửi → tự tính cùng luật, ra cùng chữ', () => {
    render(
      <>
        <Avatar name="Trần Khánh Linh" initials="TL" colorKey="m-1" />
        <Avatar name="Trần Khánh Linh" colorKey="m-1" />
        <AvatarStack people={[{ membershipId: 'm-1', displayName: 'Trần Khánh Linh' }]} />
      </>,
    );
    expect(screen.getAllByRole('img', { name: 'Trần Khánh Linh' }).map((el) => el.textContent)).toEqual(['TL', 'TL', 'TL']);
  });
});
