import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from './Tooltip';
import { Segmented } from './Segmented';

describe('Tooltip "?"', () => {
  it('mở khi có tiêu điểm bàn phím, đóng khi rời', async () => {
    const user = userEvent.setup();
    render(
      <>
        <span>
          Số km miễn phí <Tooltip text="Trừ vào tổng số km trước khi nhân đơn giá." />
        </span>
        <button type="button">Sau</button>
      </>,
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
    await user.tab();
    const trigger = screen.getByRole('button', { name: 'Giải thích' });
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByRole('tooltip').textContent).toContain('Trừ vào tổng số km trước khi nhân đơn giá.');
    expect(document.getElementById(trigger.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Trừ vào tổng số km trước khi nhân đơn giá.');
    await user.tab();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('mở khi rê chuột, Esc đóng', async () => {
    const user = userEvent.setup();
    render(<Tooltip text="Gợi ý: 1.000.000 ₫" />);
    const trigger = screen.getByRole('button', { name: 'Giải thích' });
    await user.hover(trigger);
    expect(screen.getByRole('tooltip').textContent).toContain('Gợi ý: 1.000.000 ₫');
    await user.unhover(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => trigger.focus());
    expect(screen.getByRole('tooltip')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'STUDIO', label: 'Studio' },
    { value: 'CUSTOMER_HOME', label: 'Tại nhà' },
    { value: 'OTHER', label: 'Nơi khác', disabled: true, disabledReason: 'Gói này không làm nơi khác' },
  ] as const;

  it('mũi tên đi giữa các ô, Space chọn; ô khoá nói lý do bằng tooltip khi có tiêu điểm', async () => {
    const user = userEvent.setup();
    let picked = '';
    render(<Segmented aria-label="Làm ở đâu" options={options} value="STUDIO" onChange={(v) => (picked = v)} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Studio' }));
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Tại nhà' }));
    await user.keyboard(' ');
    expect(picked).toBe('CUSTOMER_HOME');
    await user.keyboard('{ArrowRight}');
    const locked = screen.getByRole('radio', { name: 'Nơi khác' });
    expect(document.activeElement).toBe(locked);
    expect(locked.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('tooltip').textContent).toContain('Gói này không làm nơi khác');
    await user.keyboard(' ');
    expect(picked).toBe('CUSTOMER_HOME');
  });
});
