import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatGrid, StatTile } from './StatTile';

describe('StatTile', () => {
  it('nhãn, số, dòng nhỏ; Tooltip "?" mở khi Tab tới', async () => {
    const user = userEvent.setup();
    render(
      <StatGrid label="Số liệu tháng 10">
        <StatTile label="Doanh số" value="5.300.000 ₫" note="12 hợp đồng" tip="Tổng giá trị hợp đồng có ngày sự kiện trong kỳ." />
        <StatTile label="Còn lại" value="4.300.000 ₫" variant="highlight" />
        <StatTile label="Cọc phải thu" value="1.000.000 ₫" note="còn thiếu 200.000 ₫" noteTone="warn" />
        <StatTile label="Quá hạn" value="2" variant="danger" />
      </StatGrid>,
    );
    const grid = screen.getByRole('group', { name: 'Số liệu tháng 10' });
    expect(grid.style.getPropertyValue('--stat-cols')).toBe('4');
    expect(screen.getByText('5.300.000 ₫').className).toBe('ui-stat__value');
    expect(screen.getByText('12 hợp đồng')).toBeTruthy();
    expect(screen.getByText('còn thiếu 200.000 ₫').className).toContain('ui-stat__note--warn');
    expect(screen.getByText('4.300.000 ₫').closest('.ui-stat')?.className).toContain('ui-stat--highlight');
    expect(screen.getByText('2').closest('.ui-stat')?.className).toContain('ui-stat--danger');
    await user.tab();
    const tip = screen.getByRole('button', { name: 'Giải thích' });
    expect(document.activeElement).toBe(tip);
    expect(tip.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByText('Tổng giá trị hợp đồng có ngày sự kiện trong kỳ.').length).toBeGreaterThan(0);
    await user.keyboard('{Escape}');
    expect(tip.getAttribute('aria-expanded')).toBe('false');
  });

  it('đang tải: aria-busy, không hiện số; lỗi: "—" và lý do role alert', () => {
    render(
      <StatGrid columns={3}>
        <StatTile label="Tổng thu" value="9.000.000 ₫" note="3 phiếu" loading />
        <StatTile label="Tổng hoàn" value="1 ₫" error="Không tải được số liệu" />
      </StatGrid>,
    );
    expect(screen.queryByText('9.000.000 ₫')).toBeNull();
    expect(screen.queryByText('3 phiếu')).toBeNull();
    expect(screen.getByText('Đang tải').closest('.ui-stat')!.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByText('1 ₫')).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Không tải được số liệu');
  });
});
