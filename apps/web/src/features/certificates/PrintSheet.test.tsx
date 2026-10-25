import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeView, JPEG_1X1 } from './fixtures';
import { PrintSheet, type PrintMetrics } from './PrintSheet';
import type { RenderDeps } from './render';

// Bản in: tiến độ, lỗi một người không mất cả lô, "Thử lại người này", khác biệt điện thoại / máy tính, chia sẻ ngay trong lượt bấm.

let created = 0;
beforeEach(() => {
  created = 0;
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => `blob:test/${(created += 1)}`, revokeObjectURL: () => undefined }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true });
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true, writable: true });
});

const png = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
const okDeps = (over: Partial<RenderDeps> = {}): Partial<RenderDeps> => ({ renderPng: async () => png(), toJpeg: async () => JPEG_1X1, ...over });
const views = [fakeView(1, { studentName: 'Lê Thị Mai' }), fakeView(2, { studentName: 'Trần Văn Nam' }), fakeView(3, { studentName: 'Đỗ Thu Hà' })];

function setup(over: Partial<React.ComponentProps<typeof PrintSheet>> = {}) {
  return render(<PrintSheet orgId="org-1" items={views} baseName="Giay-chung-nhan-K12-2026-12-20" pdfTitle="Giấy chứng nhận — K12" renderDeps={okDeps()} breakpoint="desktop" {...over} />);
}

describe('PrintSheet', () => {
  it('máy tính: vẽ xong hiện dải xanh, In ngay, Tải PDF (3 trang), Tải ảnh từng người; KHÔNG có Chia sẻ khi máy không chia sẻ được tệp', async () => {
    let metrics: PrintMetrics | null = null;
    setup({ issuedNote: 'Đã cấp 3 giấy chứng nhận (CC-2026-0001 → 0003).', onFinished: (m) => (metrics = m) });
    await screen.findByRole('button', { name: 'In ngay' });
    expect(screen.getByText(/Đã cấp 3 giấy chứng nhận \(CC-2026-0001 → 0003\)\./)).toBeTruthy();
    expect(screen.getByText(/Tệp PDF: 3 trang A4 ngang, mỗi học viên một trang/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tải PDF (3 trang)' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Tải ảnh' })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Chia sẻ PDF/ })).toBeNull();
    expect(screen.getByText(/Chọn khổ A4, hướng Ngang, lề Không/)).toBeTruthy();
    expect(metrics).toMatchObject({ count: 3, failed: 0, pdfPages: 3 });
    expect((metrics as PrintMetrics | null)?.pdfBytes).toBeGreaterThan(500);
  });

  it('điện thoại: không có "In ngay"; không chia sẻ tệp được thì "Tải PDF" là nút chính; "Lưu ảnh" từng người', async () => {
    setup({ breakpoint: 'phone' });
    await screen.findByRole('button', { name: 'Tải PDF' });
    expect(screen.queryByRole('button', { name: 'In ngay' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Chia sẻ PDF/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Lưu ảnh' })).toHaveLength(3);
  });

  it('điện thoại có chia sẻ tệp: nút chính "Chia sẻ PDF (In / Zalo / Lưu)"; navigator.share chạy ĐỒNG BỘ trong lượt bấm với đúng tệp PDF', async () => {
    let inClick = false;
    const on = () => (inClick = true);
    const off = () => (inClick = false);
    document.addEventListener('click', on, true);
    window.addEventListener('click', off);
    const calls: { inside: boolean; data: ShareData }[] = [];
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true, writable: true });
    Object.defineProperty(navigator, 'share', {
      value: (data: ShareData) => {
        calls.push({ inside: inClick, data });
        return Promise.resolve();
      },
      configurable: true,
      writable: true,
    });
    setup({ breakpoint: 'phone' });
    const btn = await screen.findByRole('button', { name: 'Chia sẻ PDF (In / Zalo / Lưu)' });
    fireEvent.click(btn);
    // Không chờ: lượt bấm vừa xong.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.inside).toBe(true);
    const f = calls[0]?.data.files?.[0];
    expect(f?.name).toBe('Giay-chung-nhan-K12-2026-12-20.pdf');
    expect(f?.type).toBe('application/pdf');
    document.removeEventListener('click', on, true);
    window.removeEventListener('click', off);
    await act(async () => undefined);
  });

  it('chia sẻ bị NotAllowedError: hiện "Không mở được bảng Chia sẻ — bấm Tải PDF"', async () => {
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true, writable: true });
    Object.defineProperty(navigator, 'share', { value: () => Promise.reject(new DOMException('x', 'NotAllowedError')), configurable: true, writable: true });
    setup({ breakpoint: 'phone' });
    fireEvent.click(await screen.findByRole('button', { name: 'Chia sẻ PDF (In / Zalo / Lưu)' }));
    expect(await screen.findByText('Không mở được bảng Chia sẻ — bấm Tải PDF')).toBeTruthy();
  });

  it('lỗi vẽ MỘT người: dòng đỏ nêu tên, PDF vẫn có 2 trang, "Thử lại người này" vẽ riêng người đó rồi PDF thành 3 trang', async () => {
    let fail = true;
    const deps = okDeps({
      renderPng: async (src) => {
        if (fail && new URLSearchParams(src.split('?')[1]).get('ten') === 'Trần Văn Nam') throw new Error('Vẽ ảnh quá lâu');
        return png();
      },
    });
    setup({ renderDeps: deps });
    await screen.findByRole('button', { name: 'Tải PDF (2 trang)' });
    expect(screen.getByText('Không vẽ được giấy của Trần Văn Nam: Vẽ ảnh quá lâu')).toBeTruthy();
    expect(screen.getByText(/Tệp PDF chưa có giấy của: Trần Văn Nam/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Tải ảnh' })).toHaveLength(2);
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại người này' }));
    await screen.findByRole('button', { name: 'Tải PDF (3 trang)' });
    expect(screen.queryByText(/Không vẽ được giấy của/)).toBeNull();
  });

  it('đang vẽ: hiện "Đang vẽ 1/3 · Lê Thị Mai…" với thanh tiến độ và nút Dừng; Dừng thì bỏ phần đã vẽ', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    setup({ renderDeps: okDeps({ renderPng: async () => { await gate; return png(); } }) });
    expect(await screen.findByText('Đang vẽ 1/3 · Lê Thị Mai…')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dừng' }));
    await act(async () => release());
    await screen.findByText(/Đã dừng vẽ/);
    expect(screen.queryByRole('button', { name: /Tải PDF/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Vẽ lại' })).toBeTruthy();
  });

  it('lô trên 60 người: dải vàng "Tệp lớn (~… MB)"', async () => {
    const many = Array.from({ length: 61 }, (_, i) => fakeView(i + 1));
    setup({ items: many });
    expect(await screen.findByText(/Tệp lớn \(~27 MB\), vẽ có thể mất vài phút/)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tải PDF (61 trang)' })).toBeTruthy(), { timeout: 20_000 });
  }, 30_000);

  it('bản cấp lại ghi rõ ở danh sách; ảnh nhỏ báo mờ', async () => {
    const list = [fakeView(1, { reissueNo: 1, photo: { url: 'https://f/p', expiresAt: '2027-01-01T00:00:00.000Z', width: 120, height: 120 } })];
    setup({ items: list, renderDeps: okDeps({ fetchBlob: async () => new Blob([new Uint8Array([9])]) }) });
    const ul = await screen.findByRole('list', { name: 'Từng học viên' });
    expect(within(ul).getByText('CC-2026-0001 · bản cấp lại')).toBeTruthy();
    expect(screen.getByText(/Ảnh nhỏ, in có thể mờ: Học viên 1 \(120×120\)/)).toBeTruthy();
  });
});
