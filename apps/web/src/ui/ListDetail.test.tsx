import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListDetail } from './ListDetail';
import { ListGroupHeader } from './ListGroupHeader';
import { ListRow, ListRowSkeleton } from './ListRow';
import { PersonChip, PersonChipList } from './PersonChip';
import { Avatar } from './Avatar';

describe('ListDetail', () => {
  it('bày hai vùng có tên, biến thể hẹp, điện thoại chọn màn qua data-mobile', () => {
    const { container, rerender } = render(
      <ListDetail list={<p>Trái</p>} detail={<p>Phải</p>} variant="narrow" listLabel="Danh sách khách" detailLabel="Hồ sơ khách" />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('ui-ld--narrow');
    expect(root.className).toContain('ui-ld--sticky');
    expect(root.dataset.mobile).toBe('list');
    expect(screen.getByRole('region', { name: 'Danh sách khách' }).textContent).toBe('Trái');
    expect(screen.getByRole('region', { name: 'Hồ sơ khách' }).textContent).toBe('Phải');
    rerender(<ListDetail list={<p>Trái</p>} detail={<p>Phải</p>} mobileView="detail" sticky={false} />);
    expect(root.dataset.mobile).toBe('detail');
    expect(root.className).not.toContain('ui-ld--narrow');
    expect(root.className).not.toContain('ui-ld--sticky');
  });
});

describe('ListGroupHeader', () => {
  it('là tiêu đề h3 kèm số bên phải; biến thể danger', () => {
    render(
      <>
        <ListGroupHeader aside={3}>Sự kiện 7 ngày tới</ListGroupHeader>
        <ListGroupHeader tone="danger" headingLevel={4}>
          Quá hạn
        </ListGroupHeader>
      </>,
    );
    const h = screen.getByRole('heading', { level: 3 });
    expect(h.textContent).toBe('Sự kiện 7 ngày tới3');
    expect(h.className).toBe('ui-lgh');
    expect(screen.getByRole('heading', { level: 4, name: 'Quá hạn' }).className).toContain('ui-lgh--danger');
  });
});

describe('ListRow', () => {
  it('có onClick → nút; Enter và Space đều mở; aria-current khi đang chọn', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <ListRow
        title="Tôn Nữ Hoàng Bảo Ngọc Phương Thảo"
        subtitle="HD-000142"
        amount="5.300.000 ₫"
        trailing="Sự kiện 24/10"
        selected
        onClick={onClick}
      />,
    );
    const row = screen.getByRole('button', { name: /Phương Thảo/ });
    expect(row.getAttribute('aria-current')).toBe('true');
    expect(row.className).toContain('ui-lrow--sel');
    expect(row.className).toContain('ui-lrow--noav');
    await user.tab();
    expect(document.activeElement).toBe(row);
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('khoá: không bấm được, bị bỏ qua khi Tab', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <>
        <ListRow title="Bậc đang ẩn" disabled onClick={onClick} />
        <button type="button">Sau</button>
      </>,
    );
    const row = screen.getByRole('button', { name: 'Bậc đang ẩn' });
    expect((row as HTMLButtonElement).disabled).toBe(true);
    await user.click(row);
    expect(onClick).not.toHaveBeenCalled();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sau' }));
  });

  it('href → liên kết; as + linkProps cho Link của router; dòng tĩnh không có vai trò bấm', () => {
    function FakeLink({ to, ...rest }: { to: string } & Record<string, unknown>) {
      return <a href={`#${to}`} {...rest} />;
    }
    render(
      <>
        <ListRow title="Phạm Thu Trang" href="/khach-hang/k1" leading={<Avatar name="Phạm Thu Trang" />} />
        <ListRow title="Nguyễn Thị Mai" as={FakeLink} linkProps={{ to: '/khach-hang/k2' }} selected />
        <ListRow title="Chỉ xem" subtitle="không bấm" />
      </>,
    );
    expect(screen.getByRole('link', { name: /Phạm Thu Trang/ }).getAttribute('href')).toBe('/khach-hang/k1');
    const l2 = screen.getByRole('link', { name: /Nguyễn Thị Mai/ });
    expect(l2.getAttribute('href')).toBe('#/khach-hang/k2');
    expect(l2.getAttribute('aria-current')).toBe('true');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Chỉ xem').closest('.ui-lrow')?.className).not.toContain('ui-lrow--action');
  });

  it('liên kết bị khoá: không điều hướng, rời khỏi thứ tự Tab', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ListRow title="Khoá" href="/x" disabled onClick={onClick} />);
    const el = screen.getByText('Khoá').closest('a')!;
    expect(el.hasAttribute('href')).toBe(false);
    expect(el.getAttribute('aria-disabled')).toBe('true');
    expect(el.getAttribute('tabindex')).toBe('-1');
    await user.click(el);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('lỗi thay dòng phụ và được đọc ngay; tone warn', () => {
    render(<ListRow title="Chưa gán bậc" subtitle="2 thợ" tone="warn" error="Không tải được" />);
    expect(screen.getByRole('alert').textContent).toBe('Không tải được');
    expect(screen.queryByText('2 thợ')).toBeNull();
    expect(screen.getByText('Chưa gán bậc').closest('.ui-lrow')?.className).toContain('ui-lrow--warn');
  });

  it('ListRowSkeleton: một vùng trạng thái đang tải, đúng số dòng', () => {
    const { container } = render(<ListRowSkeleton rows={4} avatar amount />);
    expect(screen.getByRole('status', { name: 'Đang tải danh sách' })).toBeTruthy();
    expect(container.querySelectorAll('.ui-lrow')).toHaveLength(4);
  });
});

describe('PersonChip', () => {
  it('Avatar 28 + tên, đọc tên một lần; khoá thì mờ', () => {
    render(
      <PersonChipList label="Thợ ở bậc Thợ chính">
        <PersonChip name="Nguyễn Thu Hà" colorKey="m1" />
        <PersonChip name="Lê Ngọc Trâm" colorKey="m2" disabled />
      </PersonChipList>,
    );
    expect(screen.getByRole('group', { name: 'Thợ ở bậc Thợ chính' })).toBeTruthy();
    const img = screen.getByRole('img', { name: 'Nguyễn Thu Hà' });
    expect(img.className).toContain('ui-av--sm');
    const off = screen.getByRole('img', { name: 'Lê Ngọc Trâm' }).closest('.ui-pchip')!;
    expect(off.getAttribute('aria-disabled')).toBe('true');
    expect(off.className).toContain('ui-pchip--disabled');
  });
});
