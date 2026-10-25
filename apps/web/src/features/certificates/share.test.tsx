import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canShareFile, makePdfFile, shareFile, SHARE_FAILED_MESSAGE } from './share';

const file = makePdfFile(new Uint8Array([37, 80, 68, 70]), 'a.pdf');

function setNavigator(share: unknown, canShare: unknown) {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true });
}

afterEach(() => {
  setNavigator(undefined, undefined);
});

describe('share.ts: Chia sẻ PDF', () => {
  it('máy không có canShare / share thì không chia sẻ được tệp (chỉ còn Tải PDF)', async () => {
    setNavigator(undefined, undefined);
    expect(canShareFile(file)).toBe(false);
    expect(await shareFile(file, 'Giấy chứng nhận')).toEqual({ kind: 'unsupported' });
    setNavigator(vi.fn(), () => false);
    expect(canShareFile(file)).toBe(false);
  });

  it('chia sẻ xong → shared; người dùng tự đóng (AbortError) → cancelled, im lặng', async () => {
    setNavigator(vi.fn().mockResolvedValue(undefined), () => true);
    expect(await shareFile(file, 'Giấy chứng nhận')).toEqual({ kind: 'shared' });
    setNavigator(vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')), () => true);
    expect(await shareFile(file, 'Giấy chứng nhận')).toEqual({ kind: 'cancelled' });
  });

  it('NotAllowedError hay lỗi khác → lời báo "Không mở được bảng Chia sẻ — bấm Tải PDF"', async () => {
    setNavigator(vi.fn().mockRejectedValue(new DOMException('x', 'NotAllowedError')), () => true);
    expect(await shareFile(file, 'Giấy chứng nhận')).toEqual({ kind: 'failed', message: SHARE_FAILED_MESSAGE });
    expect(SHARE_FAILED_MESSAGE).toBe('Không mở được bảng Chia sẻ — bấm Tải PDF');
    setNavigator(vi.fn().mockRejectedValue(new Error('lạ')), () => true);
    expect(await shareFile(file, 'Giấy chứng nhận')).toEqual({ kind: 'failed', message: SHARE_FAILED_MESSAGE });
  });

  it('navigator.share được gọi ĐỒNG BỘ trong lượt bấm (không await nào đứng trước)', () => {
    // Cờ "đang trong lượt bấm": bật ở pha bắt của document, tắt ở window sau khi React xử lý xong cú bấm.
    let inClick = false;
    const on = () => {
      inClick = true;
    };
    const off = () => {
      inClick = false;
    };
    document.addEventListener('click', on, true);
    window.addEventListener('click', off);
    let calledInsideClick: boolean | null = null;
    setNavigator(
      vi.fn(() => {
        calledInsideClick = inClick;
        return Promise.resolve();
      }),
      () => true,
    );
    render(<button onClick={() => void shareFile(file, 'Giấy chứng nhận')}>Chia sẻ</button>);
    fireEvent.click(screen.getByText('Chia sẻ'));
    // Không chờ gì cả: nếu có await trước navigator.share thì lúc này chưa gọi, hoặc gọi sau khi lượt bấm đã tắt.
    document.removeEventListener('click', on, true);
    window.removeEventListener('click', off);
    expect(calledInsideClick).toBe(true);
  });
});
