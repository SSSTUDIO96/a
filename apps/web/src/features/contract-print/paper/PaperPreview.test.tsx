import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRINT_LAYOUTS } from '@makeup/shared';
import { PaperPreview } from './PaperPreview';
import { PAGE_CONTENT_MM } from './pageCss';

// Xem trước: thu phóng --hdin-zoom = bề rộng vùng chứa / 793,7 px (chỉ thu nhỏ, không phóng quá 1); dòng "Khoảng N trang A4".
// jsdom không có ResizeObserver / bố cục: dựng giả và đặt kích thước bằng tay.

const PX_PER_MM = 96 / 25.4;
let callbacks: (() => void)[] = [];
let width = 600;
let paperHeight = 1000;

beforeEach(() => {
  callbacks = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        callbacks.push(cb);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('hdin-giay') ? paperHeight : 0;
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const zoomOf = (c: HTMLElement) => (c.querySelector('.hdin-zoom') as HTMLElement).style.getPropertyValue('--hdin-zoom');
const fire = () => act(() => callbacks.forEach((cb) => cb()));

describe('PaperPreview', () => {
  it('zoom = bề rộng vùng chứa / 793,7; tờ rộng hơn vùng chứa thì thu nhỏ, vùng chứa rộng hơn tờ thì giữ 1', () => {
    width = 600;
    const { container } = render(
      <PaperPreview layout={1}>
        <article className="hdin-giay" />
      </PaperPreview>,
    );
    expect(Number(zoomOf(container))).toBeCloseTo(600 / 793.7, 5);
    width = 1200;
    fire();
    expect(Number(zoomOf(container))).toBe(1);
    width = 390;
    fire();
    expect(Number(zoomOf(container))).toBeCloseTo(390 / 793.7, 5);
  });

  it('"Khoảng N trang A4": theo chiều cao CHƯA thu phóng của tờ, trừ padding xem trước', () => {
    const seen: number[] = [];
    paperHeight = 600;
    const { container } = render(
      <PaperPreview layout={2} onPages={(n) => seen.push(n)}>
        <article className="hdin-giay" />
      </PaperPreview>,
    );
    expect(container.querySelector('.hdin-prev-cap')?.textContent).toContain('Khoảng 1 trang A4');
    paperHeight = PAGE_CONTENT_MM[2] * PX_PER_MM * 2 - 10;
    fire();
    expect(container.querySelector('.hdin-prev-cap')?.textContent).toContain('Khoảng 2 trang A4');
    paperHeight = PAGE_CONTENT_MM[2] * PX_PER_MM * 2 + 20;
    fire();
    expect(container.querySelector('.hdin-prev-cap')?.textContent).toContain('Khoảng 3 trang A4');
    expect(seen.at(-1)).toBe(3);
  });

  it('mọi bố cục ước được số trang', () => {
    for (const layout of PRINT_LAYOUTS) {
      paperHeight = 1800;
      const { container, unmount } = render(
        <PaperPreview layout={layout}>
          <article className="hdin-giay" />
        </PaperPreview>,
      );
      expect(container.querySelector('.hdin-prev-cap')?.getAttribute('data-pages')).toBe('2');
      unmount();
    }
  });
});
