import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstallGuide } from './InstallGuide';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPHONE_ZALO = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo/24.04.1';

function env(userAgent: string, standalone = false) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints: 0, standalone });
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: standalone && q.includes('standalone'), addEventListener() {}, removeEventListener() {} }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InstallGuide', () => {
  it('iPhone Safari, variant staff: 4 bước, không có bước chuyển phiên', () => {
    env(IPHONE_SAFARI);
    render(<InstallGuide variant="staff" />);
    expect(screen.getByText('Mở trang bằng Safari')).toBeTruthy();
    expect(screen.getByText(/Bấm nút Chia sẻ/)).toBeTruthy();
    expect(screen.getByText('Chọn “Thêm vào MH chính”')).toBeTruthy();
    expect(screen.getByText('Mở bằng biểu tượng mới')).toBeTruthy();
    expect(screen.queryByText(/Tôi có mã chuyển sang app/)).toBeNull();
    expect(document.querySelectorAll('ol > li')).toHaveLength(4);
  });

  it('variant portal: thêm bước nhập mã và nút "Lấy mã chuyển sang app" gọi onGetHandoffCode', () => {
    env(IPHONE_SAFARI);
    const onGet = vi.fn();
    render(<InstallGuide variant="portal" onGetHandoffCode={onGet} />);
    expect(document.querySelectorAll('ol > li')).toHaveLength(5);
    expect(screen.getByText(/Tôi có mã chuyển sang app/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lấy mã chuyển sang app' }));
    expect(onGet).toHaveBeenCalledTimes(1);
  });

  it('variant portal không truyền onGetHandoffCode → không có nút', () => {
    env(IPHONE_SAFARI);
    render(<InstallGuide variant="portal" />);
    expect(screen.queryByRole('button', { name: 'Lấy mã chuyển sang app' })).toBeNull();
  });

  it('trong Zalo: chỉ dải "Mở bằng trình duyệt", không có các bước', () => {
    env(IPHONE_ZALO);
    render(<InstallGuide variant="staff" />);
    expect(screen.getByText('Mở bằng trình duyệt', { selector: 'strong' })).toBeTruthy();
    expect(document.querySelector('ol')).toBeNull();
  });

  it('đã standalone: không hiện gì', () => {
    env(IPHONE_SAFARI, true);
    const { container } = render(<InstallGuide variant="staff" />);
    expect(container.innerHTML).toBe('');
  });

  it('Chromium bắn beforeinstallprompt: hiện nút "Cài app"; bấm gọi prompt() của trình duyệt', async () => {
    env('Mozilla/5.0 (Linux; Android 14) Chrome/124.0 Mobile Safari/537.36');
    render(<InstallGuide variant="staff" />);
    expect(screen.queryByRole('button', { name: 'Cài app' })).toBeNull();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const ev = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }) });
    await act(async () => {
      window.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cài app' }));
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Cài app' })).toBeNull(); // mỗi sự kiện dùng một lần
  });
});
