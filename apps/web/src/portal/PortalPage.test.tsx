import './matchers';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { formatVnd, type PortalMe } from '@makeup/shared';
import { PortalPage } from './PortalPage';
import { makeMe } from './fixtures';

function show(me: PortalMe) {
  // Đồng hồ máy học viên lệch hẳn: trang phải dùng giờ máy chủ (serverTime) qua clockOffsetMs.
  const offset = Date.parse(me.serverTime) - Date.now();
  return render(<PortalPage me={me} clockOffsetMs={offset} onSessionLost={vi.fn()} onSignedOut={vi.fn()} />);
}

const section = (name: string) => screen.getByRole('region', { name });

describe('PortalPage: dữ liệu mẫu đủ mục', () => {
  it('đầu trang, chào, chip neo, các thẻ theo thứ tự bản vẽ', () => {
    show(makeMe());
    expect(screen.getByText('Chiến Makeup Academy')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chào Thảo' })).toBeInTheDocument();
    expect(screen.getByText('Đang học')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Các mục của trang' });
    for (const l of ['Lịch học', 'Học phí', 'Nội quy', 'Ảnh', 'Hợp đồng']) expect(within(nav).getByRole('button', { name: l })).toBeInTheDocument();
    const order = ['Buổi học tới', 'Học phí', 'Tiến độ đóng tiền', 'Đã đóng', 'Cách đóng tiền', 'Lịch học', 'Nội quy', 'Ảnh của tôi', 'Hợp đồng', 'Liên hệ trung tâm', 'Cài lên màn hình chính'];
    const heads = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(heads).toEqual(order);
  });

  it('buổi học tới: theo giờ máy chủ, "Hôm nay" + thứ + giờ, Buổi 2/12 (không đếm buổi huỷ), giảng viên, địa điểm, Chỉ đường có toạ độ', () => {
    show(makeMe());
    const s = section('Buổi học tới');
    expect(within(s).getByText('Hôm nay, Thứ Ba 10/11')).toBeInTheDocument();
    expect(within(s).getByText('18:00–22:00')).toBeInTheDocument();
    expect(within(s).getByText('Buổi 2/12')).toBeInTheDocument();
    expect(within(s).getByText('Nguyễn Thu Hà')).toBeInTheDocument();
    expect(within(s).getByText('Cơ sở Cầu Giấy')).toBeInTheDocument();
    expect(within(s).getByRole('link', { name: /Chỉ đường/ })).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=21.046,105.797');
  });

  it('không toạ độ thì không có nút Chỉ đường', () => {
    const me = makeMe();
    me.enrollments[0]!.location = { name: 'Cơ sở A', address: null, latitude: null, longitude: null };
    show(me);
    expect(screen.queryByRole('link', { name: /Chỉ đường/ })).toBeNull();
  });

  it('tiền: đúng formatVnd của shared, Tổng / Đã đóng / Còn lại lấy nguyên từ máy chủ', () => {
    const me = makeMe();
    show(me);
    const s = section('Học phí');
    const c = me.contracts[0]!;
    expect(within(s).getByText(formatVnd(c.total))).toBeInTheDocument();
    expect(within(s).getByText(formatVnd(c.paid))).toBeInTheDocument();
    expect(within(s).getByText(formatVnd(c.remaining))).toBeInTheDocument();
    expect(within(s).getByText('14.000.000 ₫')).toBeInTheDocument();
    expect(within(s).getByText('HĐKH-000042')).toBeInTheDocument();
  });

  it('thanh tiến độ và đợt quá hạn: dải vàng nêu đợt còn thiếu, hạn, số ngày quá hạn và đợt kế tiếp', () => {
    show(makeMe());
    const s = section('Học phí');
    expect(within(s).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '57');
    const note = within(s).getByRole('note');
    expect(note).toHaveTextContent('Đợt 1 còn thiếu 1.000.000 ₫ — hạn 03/11, đã qua 7 ngày.');
    expect(note).toHaveTextContent('Đợt 2: 5.000.000 ₫, hạn 17/11.');
  });

  it('không có đợt quá hạn: không có dải vàng', () => {
    const me = makeMe();
    for (const i of me.contracts[0]!.installments) {
      i.status = 'PAID';
      i.paidAmount = i.amount;
    }
    show(me);
    expect(within(section('Học phí')).queryByRole('note')).toBeNull();
  });

  it('tiến độ đóng tiền và phiếu đã đóng', () => {
    show(makeMe());
    const p = section('Tiến độ đóng tiền');
    expect(within(p).getByText(/Đặt cọc/)).toBeInTheDocument();
    expect(within(p).getByText(/quá hạn 7 ngày/)).toBeInTheDocument();
    expect(p.textContent).toContain('còn thiếu 1.000.000 ₫');
    const r = section('Đã đóng');
    expect(within(r).getByText('PT-000101')).toBeInTheDocument();
    expect(within(r).getByText(formatVnd(5_000_000))).toBeInTheDocument();
  });

  it('cách đóng tiền khi có bank: ngân hàng, số tài khoản, chủ tài khoản, nội dung, nút Chép, dòng nhắc', () => {
    show(makeMe());
    const b = section('Cách đóng tiền');
    expect(within(b).getByText('Vietcombank')).toBeInTheDocument();
    expect(within(b).getByText('0123456789')).toBeInTheDocument();
    expect(within(b).getByText('CONG TY MAKEUP')).toBeInTheDocument();
    expect(within(b).getByText('HDKH-000042 Phuong Thao')).toBeInTheDocument();
    expect(within(b).getByRole('button', { name: 'Chép số tài khoản' })).toBeInTheDocument();
    expect(within(b).getByRole('button', { name: 'Chép nội dung chuyển khoản' })).toBeInTheDocument();
    expect(within(b).getByText(/Chuyển xong trung tâm sẽ ghi phiếu thu/)).toBeInTheDocument();
  });

  it('bank: null thì KHÔNG có thẻ "Cách đóng tiền"', () => {
    show(makeMe({ bank: null }));
    expect(screen.queryByRole('heading', { name: 'Cách đóng tiền' })).toBeNull();
  });

  it('lịch học có buổi: liệt kê từng buổi kèm nhãn Đã qua / Hôm nay / Huỷ', () => {
    show(makeMe());
    const s = section('Lịch học');
    expect(within(s).getByText('Thứ Ba, Thứ Năm', { exact: false })).toBeInTheDocument();
    const list = within(s).getByRole('list', { name: 'Từng buổi học' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(within(list).getByText('Huỷ')).toBeInTheDocument();
    // Nhãn thứ của ô ngày: 03/11/2026 là Thứ Ba → T3, 12/11 là Thứ Năm → T5.
    expect(list.textContent).toContain('T3 · th11');
    expect(list.textContent).toContain('T5 · th11');
    expect(within(list).getByText('Hôm nay')).toBeInTheDocument();
    expect(within(list).getByText('Đã qua')).toBeInTheDocument();
  });

  it('sessions: [] thì KHÔNG có danh sách buổi, không có "Buổi học tới", vẫn có lịch theo thứ và giờ', () => {
    const me = makeMe();
    me.enrollments[0]!.sessions = [];
    show(me);
    expect(screen.queryByRole('list', { name: 'Từng buổi học' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Buổi học tới' })).toBeNull();
    const s = section('Lịch học');
    expect(within(s).getByText(/Thứ Ba, Thứ Năm/)).toBeInTheDocument();
    expect(within(s).getByText(/18:00–22:00/)).toBeInTheDocument();
    expect(within(s).getByText('Nguyễn Thu Hà')).toBeInTheDocument();
  });

  it('nội quy giữ xuống dòng; hợp đồng: ngày ký, dòng, giảm, phải đóng, điều khoản', () => {
    show(makeMe());
    const rules = section('Nội quy');
    expect(rules.querySelector('.pt-pre')?.textContent).toBe('Đi học đúng giờ.\nKhông dùng điện thoại trong lớp.');
    const c = section('Hợp đồng');
    expect(within(c).getByText('Ký ngày 20/10/2026')).toBeInTheDocument();
    expect(within(c).getByText('−1.000.000 ₫')).toBeInTheDocument();
    expect(within(c).getByText('Điều khoản hợp đồng')).toBeInTheDocument();
  });

  it('không nội quy thì không có thẻ và không có chip Nội quy', () => {
    const me = makeMe();
    me.contracts[0]!.rules = null;
    show(me);
    expect(screen.queryByRole('heading', { name: 'Nội quy' })).toBeNull();
    expect(within(screen.getByRole('navigation')).queryByRole('button', { name: 'Nội quy' })).toBeNull();
  });

  it('ảnh: lưới 2 thẻ; không có ảnh thì không có thẻ và không có chip Ảnh', () => {
    const { unmount } = show(makeMe());
    const a = section('Ảnh của tôi');
    expect(within(a).getAllByRole('img')).toHaveLength(2);
    expect(within(a).getByText('Thẻ chào mừng')).toBeInTheDocument();
    expect(within(a).getByText('Ảnh Feedback')).toBeInTheDocument();
    unmount();
    show(makeMe({ cards: [] }));
    expect(screen.queryByRole('heading', { name: 'Ảnh của tôi' })).toBeNull();
    expect(within(screen.getByRole('navigation')).queryByRole('button', { name: 'Ảnh' })).toBeNull();
  });

  it('liên hệ: gọi tel:, nhắn zalo.me', () => {
    show(makeMe());
    const c = section('Liên hệ trung tâm');
    expect(within(c).getByRole('link', { name: /Gọi 0281234567/ })).toHaveAttribute('href', 'tel:0281234567');
    expect(within(c).getByRole('link', { name: /Nhắn Zalo/ })).toHaveAttribute('href', 'https://zalo.me/0909000111');
  });

  it('chưa có hợp đồng: lời báo, không có thẻ học phí', () => {
    show(makeMe({ contracts: [], enrollments: [] }));
    expect(screen.getByText('Trung tâm chưa có hợp đồng khoá học nào cho em.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Học phí' })).toBeNull();
  });

  it('nhiều hợp đồng: mỗi hợp đồng một khối Học phí, chip theo tên khoá', () => {
    const me = makeMe();
    const second = structuredClone(me.contracts[0]!);
    second.code = 'HĐKH-000043';
    me.contracts.push(second);
    const e2 = structuredClone(me.enrollments[0]!);
    e2.courseName = 'Nối mi';
    e2.className = 'Lớp M1';
    e2.contractCode = 'HĐKH-000043';
    me.enrollments.push(e2);
    show(me);
    expect(screen.getAllByRole('heading', { name: /^Học phí/ })).toHaveLength(2);
    const nav = within(screen.getByRole('navigation'));
    expect(nav.getByRole('button', { name: 'Nối mi' })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: 'Makeup chuyên nghiệp' })).toBeInTheDocument();
  });

  it('thẻ cài app: có hướng dẫn cài (InstallGuide, variant portal) với nút "Lấy mã chuyển sang app"', () => {
    show(makeMe());
    const g = section('Cài lên màn hình chính');
    expect(within(g).getByTestId('install-guide')).toBeInTheDocument();
    expect(within(g).getByRole('button', { name: 'Lấy mã chuyển sang app' })).toBeInTheDocument();
  });

  it('chữ trên màn không lộ UUID và không có số tiền thô (mọi số tiền có dấu chấm ngăn nghìn + ₫)', () => {
    const { container } = show(makeMe());
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i);
    expect(text).not.toMatch(/\d{7,}\s*₫/); // 14000000 ₫ (không ngăn nghìn) là sai
  });
});
