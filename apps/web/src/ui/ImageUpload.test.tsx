import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUpload, checkImageFile, type ImageUploadContext } from './ImageUpload';

const MB = 1024 * 1024;
function img(name = 'anh.png', type = 'image/png', size = 1000): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}
function fileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

beforeEach(() => {
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:xem-truoc-${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe('checkImageFile', () => {
  it('chỉ nhận JPEG/PNG/WebP và đúng giới hạn dung lượng', () => {
    expect(checkImageFile(img())).toBeNull();
    expect(checkImageFile(img('a.gif', 'image/gif'))).toBe('Chỉ nhận ảnh JPG, PNG hoặc WebP.');
    expect(checkImageFile(img('a.jpg', 'image/jpeg', 3 * MB), undefined, 2 * MB)).toBe(
      'Ảnh 3 MB — vượt quá 2 MB. Chọn ảnh nhỏ hơn.',
    );
    expect(checkImageFile(img('a.jpg', 'image/jpeg', 2 * MB), undefined, 2 * MB)).toBeNull();
  });
});

describe('ImageUpload', () => {
  it('ô trống là nút chọn tệp: Enter/Space mở hộp chọn tệp', async () => {
    const user = userEvent.setup();
    const { container } = render(<ImageUpload value={null} label="Ảnh đại diện" onUpload={vi.fn()} />);
    const input = fileInput(container);
    const click = vi.spyOn(input, 'click');
    expect(screen.getByRole('group', { name: 'Ảnh đại diện' })).toBeTruthy();
    const box = screen.getByRole('button', { name: 'Tải ảnh: Ảnh đại diện' });
    await user.tab();
    expect(document.activeElement).toBe(box);
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(click).toHaveBeenCalledTimes(2);
    // Ô chọn tệp ẩn không nằm trong thứ tự Tab: Tab tiếp tới nút "Tải ảnh".
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tải ảnh — Ảnh đại diện' }));
  });

  it('sai loại tệp: báo lỗi ngay, không gọi onUpload', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onUpload = vi.fn();
    const { container } = render(<ImageUpload value={null} label="Logo" maxBytes={2 * MB} onUpload={onUpload} />);
    await user.upload(fileInput(container), img('a.pdf', 'application/pdf'));
    expect(screen.getByRole('alert').textContent).toBe('Chỉ nhận ảnh JPG, PNG hoặc WebP.');
    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Tải ảnh: Logo' }).getAttribute('aria-describedby')).toBe(
      screen.getByRole('alert').id,
    );
  });

  it('quá dung lượng: báo lỗi, không gọi onUpload', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const { container } = render(<ImageUpload value={null} label="Logo" maxBytes={2 * MB} onUpload={onUpload} />);
    await user.upload(fileInput(container), img('to.jpg', 'image/jpeg', 5 * MB));
    expect(screen.getByRole('alert').textContent).toMatch(/vượt quá 2 MB/);
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('đang tải: xem trước, vòng xoay + tiến độ, nút khoá; xong và value mới thì hiện ảnh mới', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    let ctx!: ImageUploadContext;
    function Harness() {
      const [url, setUrl] = useState<string | null>(null);
      return (
        <ImageUpload
          value={url}
          label="Ảnh đại diện"
          shape="round"
          onRemove={() => setUrl(null)}
          onUpload={(file, c) => {
            ctx = c;
            return new Promise<void>((r) => {
              resolve = () => {
                setUrl(`https://cdn/anh/${file.name}`);
                r();
              };
            });
          }}
        />
      );
    }
    const { container } = render(<Harness />);
    await user.upload(fileInput(container), img('moi.png'));
    expect((screen.getByRole('img', { name: 'Ảnh đại diện' }) as HTMLImageElement).src).toBe('blob:xem-truoc-1');
    expect(screen.getByRole('status').textContent).toMatch(/Đang tải ảnh lên/);
    expect((screen.getByRole('button', { name: 'Đổi ảnh — Ảnh đại diện' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Bỏ ảnh — Ảnh đại diện' }) as HTMLButtonElement).disabled).toBe(true);
    act(() => ctx.onProgress(0.42));
    expect(screen.getByText('42%')).toBeTruthy();
    await act(async () => resolve());
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect((screen.getByRole('img', { name: 'Ảnh đại diện' }) as HTMLImageElement).src).toBe('https://cdn/anh/moi.png');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:xem-truoc-1');
    expect((screen.getByRole('button', { name: 'Đổi ảnh — Ảnh đại diện' }) as HTMLButtonElement).disabled).toBe(false);
    // Bỏ ảnh → về ô trống
    await user.click(screen.getByRole('button', { name: 'Bỏ ảnh — Ảnh đại diện' }));
    expect(screen.getByRole('button', { name: 'Tải ảnh: Ảnh đại diện' })).toBeTruthy();
  });

  it('tải lỗi (máy chủ 400): bỏ ảnh xem trước, hiện lỗi qua errorMessage', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ImageUpload
        value="https://cdn/cu.png"
        label="Logo"
        onUpload={() => Promise.reject(new Error('400'))}
        errorMessage={() => 'Tệp không phải ảnh hợp lệ.'}
      />,
    );
    await user.upload(fileInput(container), img());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Tệp không phải ảnh hợp lệ.'));
    expect((screen.getByRole('img', { name: 'Logo' }) as HTMLImageElement).src).toBe('https://cdn/cu.png');
    expect(container.querySelector('.ui-img__box--error')).toBeTruthy();
  });

  it('bỏ ảnh trả Promise: nút quay; lỗi bỏ ảnh hiện dưới ô', async () => {
    const user = userEvent.setup();
    let reject!: (e: Error) => void;
    render(
      <ImageUpload
        value="https://cdn/cu.png"
        label="Ảnh bìa"
        shape="wide"
        onUpload={vi.fn()}
        onRemove={() => new Promise((_, r) => (reject = r))}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Bỏ ảnh — Ảnh bìa' }));
    expect(screen.getByRole('button', { name: 'Bỏ ảnh — Ảnh bìa' }).getAttribute('aria-busy')).toBe('true');
    await act(async () => reject(new Error('Không bỏ được ảnh.')));
    expect(screen.getByRole('alert').textContent).toBe('Không bỏ được ảnh.');
  });

  it('khoá: ô và nút đều tắt; lỗi từ màn hiện; gợi ý ẩn khi có lỗi', () => {
    const { rerender } = render(
      <ImageUpload value={null} label="Logo" disabled hint="Tối đa 2 MB" onUpload={vi.fn()} />,
    );
    expect((screen.getByRole('button', { name: 'Tải ảnh: Logo' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Tải ảnh — Logo' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Tối đa 2 MB')).toBeTruthy();
    rerender(<ImageUpload value={null} label="Logo" hint="Tối đa 2 MB" error="Ảnh quá 2 MB." onUpload={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toBe('Ảnh quá 2 MB.');
    expect(screen.queryByText('Tối đa 2 MB')).toBeNull();
  });

  it('gỡ khỏi trang giữa lúc tải: huỷ qua signal', async () => {
    const user = userEvent.setup();
    let signal!: AbortSignal;
    const { container, unmount } = render(
      <ImageUpload
        value={null}
        onUpload={(_, c) => {
          signal = c.signal;
          return new Promise(() => {});
        }}
      />,
    );
    await user.upload(fileInput(container), img());
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('kiểu inline: nội dung bên cạnh, nút có biểu tượng', () => {
    render(
      <ImageUpload value="https://cdn/a.png" layout="inline" shape="round" size={72} onUpload={vi.fn()} onRemove={vi.fn()}>
        <b>Nguyễn Thu Hà</b>
      </ImageUpload>,
    );
    expect(screen.getByText('Nguyễn Thu Hà').closest('.ui-img--inline')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đổi ảnh' }).querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bỏ ảnh' })).toBeTruthy();
  });
});
