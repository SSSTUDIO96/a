import { describe, expect, it, vi } from 'vitest';
import { fakeView } from './fixtures';
import { renderCertificates, type RenderDeps } from './render';

const png = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

function deps(over: Partial<RenderDeps> = {}): Partial<RenderDeps> {
  let n = 0;
  return {
    renderPng: async () => png(),
    toJpeg: async () => jpeg,
    fetchBlob: async () => new Blob([new Uint8Array([9])]),
    makeBlobUrl: () => `blob:fake/${(n += 1)}`,
    revokeBlobUrl: () => undefined,
    now: () => 0,
    ...over,
  };
}

const withPhoto = (n: number) => fakeView(n, { photo: { url: `https://f/p${n}`, expiresAt: '2026-12-20T03:10:00.000Z', width: 800, height: 800 } });

describe('render.ts: vẽ lần lượt, lỗi một người không mất cả lô', () => {
  it('vẽ LẦN LƯỢT từng người (không bao giờ hai người cùng lúc) và đúng thứ tự', async () => {
    let live = 0;
    let peak = 0;
    const order: string[] = [];
    const out = await renderCertificates([fakeView(1), fakeView(2), fakeView(3)], {
      deps: deps({
        renderPng: async (src) => {
          live += 1;
          peak = Math.max(peak, live);
          order.push(new URLSearchParams(src.split('?')[1]).get('ten') ?? '');
          await new Promise((r) => setTimeout(r, 5));
          live -= 1;
          return png();
        },
      }),
    });
    expect(peak).toBe(1);
    expect(order).toEqual(['Học viên 1', 'Học viên 2', 'Học viên 3']);
    expect(out.map((o) => o.view.studentName)).toEqual(['Học viên 1', 'Học viên 2', 'Học viên 3']);
    expect(out.every((o) => o.page !== null && o.error === null)).toBe(true);
  });

  it('một người lỗi: người đó có error nêu tên, hai người kia vẫn xong', async () => {
    const out = await renderCertificates([fakeView(1), fakeView(2), fakeView(3)], {
      deps: deps({
        renderPng: async (src) => {
          if (new URLSearchParams(src.split('?')[1]).get('ten') === 'Học viên 2') throw new Error('Vẽ ảnh quá lâu');
          return png();
        },
      }),
    });
    expect(out.map((o) => o.page !== null)).toEqual([true, false, true]);
    expect(out[1]?.error).toBe('Không vẽ được giấy của Học viên 2: Vẽ ảnh quá lâu');
  });

  it('báo tiến độ: 0/3 người đầu … 3/3 xong', async () => {
    const seen: string[] = [];
    await renderCertificates([fakeView(1), fakeView(2), fakeView(3)], {
      deps: deps(),
      onProgress: (p) => seen.push(`${p.done}/${p.total}:${p.current ?? '-'}`),
    });
    expect(seen).toEqual(['0/3:Học viên 1', '1/3:Học viên 2', '2/3:Học viên 3', '3/3:-']);
  });

  it('dừng giữa chừng: ném AbortError, không trả phần đã vẽ', async () => {
    const ctl = new AbortController();
    const p = renderCertificates([fakeView(1), fakeView(2), fakeView(3)], {
      signal: ctl.signal,
      deps: deps({
        renderPng: async () => {
          ctl.abort();
          return png();
        },
      }),
    });
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('ảnh tải đúng: truyền blob cùng nguồn vào tham số anh, rồi thu hồi', async () => {
    const srcs: string[] = [];
    const revoked: string[] = [];
    await renderCertificates([withPhoto(1)], { deps: deps({ renderPng: async (s) => (srcs.push(s), png()), revokeBlobUrl: (u) => void revoked.push(u) }) });
    expect(new URLSearchParams(srcs[0]?.split('?')[1]).get('anh')).toBe('blob:fake/1');
    expect(revoked).toContain('blob:fake/1');
  });

  it('URL ảnh hết hạn (403): hỏi máy chủ URL mới đúng MỘT lần cho cả lô rồi thử lại', async () => {
    const refresh = vi.fn(async (ids: string[]) => ids.map((id) => {
      const n = Number(id.slice(-12));
      return withPhoto(n).id === id ? fakeView(n, { photo: { url: `https://f/moi${n}`, expiresAt: '2027-01-01T00:00:00.000Z', width: 800, height: 800 } }) : fakeView(n);
    }));
    const fetched: string[] = [];
    const out = await renderCertificates([withPhoto(1), withPhoto(2)], {
      refresh,
      deps: deps({
        fetchBlob: async (url) => {
          fetched.push(url);
          if (url.includes('/p')) throw new Error('403');
          return new Blob([new Uint8Array([9])]);
        },
      }),
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetched.filter((u) => u.includes('moi'))).toHaveLength(2);
    expect(out.every((o) => o.page && o.page.warnings.length === 0)).toBe(true);
  });

  it('thử lại vẫn hỏng: vẽ KHÔNG ảnh, kèm dòng vàng nêu tên, người đó không bị bỏ', async () => {
    const srcs: string[] = [];
    const out = await renderCertificates([withPhoto(1)], {
      refresh: async () => [withPhoto(1)],
      deps: deps({ fetchBlob: async () => { throw new Error('403'); }, renderPng: async (s) => (srcs.push(s), png()) }),
    });
    expect(new URLSearchParams(srcs[0]?.split('?')[1]).has('anh')).toBe(false);
    expect(out[0]?.page?.warnings).toEqual(['Không tải được ảnh của Học viên 1 — đã in chữ cái đầu']);
  });

  it('tải ảnh tối đa 4 cùng lúc', async () => {
    let live = 0;
    let peak = 0;
    await renderCertificates(Array.from({ length: 10 }, (_, i) => withPhoto(i + 1)), {
      deps: deps({
        fetchBlob: async () => {
          live += 1;
          peak = Math.max(peak, live);
          await new Promise((r) => setTimeout(r, 10));
          live -= 1;
          return new Blob([new Uint8Array([9])]);
        },
      }),
    });
    expect(peak).toBe(4);
  });

  it('logo dùng chung chỉ tải một lần cho cả lô', async () => {
    const logo = { url: 'https://f/logo', expiresAt: '2026-12-20T03:10:00.000Z' };
    const fetched: string[] = [];
    await renderCertificates([fakeView(1, { logo }), fakeView(2, { logo }), fakeView(3, { logo })], {
      deps: deps({ fetchBlob: async (u) => (fetched.push(u), new Blob([new Uint8Array([9])])) }),
    });
    expect(fetched).toEqual(['https://f/logo']);
  });
});
