import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaperReady } from './usePaperReady';

// L9: chỉ cho bấm In khi phông và logo đã sẵn sàng (phông font-display: block — in sớm ra chữ trống).
// jsdom không có document.fonts và Image.decode: dựng giả để điều khiển thời điểm xong.

interface FakeFonts {
  ready: Promise<unknown>;
  [Symbol.iterator]: () => Iterator<{ family: string; status: string }>;
}
let resolveFonts: () => void;
let faces: { family: string; status: string }[];
let decodeResult: 'ok' | 'fail';
let resolveDecode: (() => void) | null;

beforeEach(() => {
  faces = [];
  decodeResult = 'ok';
  resolveDecode = null;
  const ready = new Promise<void>((res) => {
    resolveFonts = res;
  });
  const fonts: FakeFonts = { ready, [Symbol.iterator]: () => faces[Symbol.iterator]() };
  Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      decode() {
        return new Promise<void>((res, rej) => {
          const fin = () => (decodeResult === 'ok' ? res() : rej(new Error('hỏng')));
          resolveDecode = fin;
        });
      }
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'fonts');
});

describe('usePaperReady (L9)', () => {
  it('chưa sẵn sàng cho tới khi document.fonts.ready xong', async () => {
    const { result } = renderHook(() => usePaperReady(null));
    expect(result.current.ready).toBe(false);
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.ready).toBe(false);
    await act(async () => {
      resolveFonts();
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.logoOk).toBe(true);
    expect(result.current.fontsFailed).toEqual([]);
  });

  it('có logo: chờ cả img.decode(); xong cả hai mới sẵn sàng', async () => {
    const { result } = renderHook(() => usePaperReady('https://anh/logo.png'));
    await act(async () => {
      resolveFonts();
    });
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(resolveDecode).not.toBeNull());
    await act(async () => {
      resolveDecode!();
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.logoOk).toBe(true);
  });

  it('logo hỏng: vẫn sẵn sàng nhưng logoOk = false (ẩn logo)', async () => {
    decodeResult = 'fail';
    const { result } = renderHook(() => usePaperReady('https://anh/hong.png'));
    await act(async () => {
      resolveFonts();
    });
    await waitFor(() => expect(resolveDecode).not.toBeNull());
    await act(async () => {
      resolveDecode!();
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.logoOk).toBe(false);
  });

  it('phông lỗi: sẵn sàng kèm danh sách họ phông lỗi', async () => {
    faces = [{ family: 'SSA Lora', status: 'error' }, { family: 'Be Vietnam Pro', status: 'loaded' }];
    const { result } = renderHook(() => usePaperReady(null));
    await act(async () => {
      resolveFonts();
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.fontsFailed).toEqual(['SSA Lora']);
  });

  it('đổi logo → chưa sẵn sàng cho tới khi giải mã xong logo mới', async () => {
    const { result, rerender } = renderHook(({ u }) => usePaperReady(u), { initialProps: { u: null as string | null } });
    await act(async () => {
      resolveFonts();
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    rerender({ u: 'https://anh/moi.png' });
    expect(result.current.ready).toBe(false);
  });
});
