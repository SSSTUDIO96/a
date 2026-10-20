// Vài matcher DOM tối thiểu cho bài thử cổng (repo chưa dùng jest-dom). Nhập tệp này ở đầu mỗi *.test.tsx của cổng.
import { expect } from 'vitest';

interface DomMatchers<R = unknown> {
  toBeInTheDocument(): R;
  toHaveTextContent(text: string): R;
  toHaveAttribute(name: string, value?: string): R;
  toBeDisabled(): R;
  toBeEnabled(): R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends DomMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends DomMatchers {}
}

const asEl = (x: unknown): Element => {
  if (!(x instanceof Element)) throw new TypeError('Giá trị không phải phần tử DOM');
  return x;
};

expect.extend({
  toBeInTheDocument(received: unknown) {
    const pass = received instanceof Element && received.ownerDocument.contains(received);
    return { pass, message: () => (pass ? 'mong phần tử KHÔNG nằm trong trang' : 'mong phần tử nằm trong trang') };
  },
  toHaveTextContent(received: unknown, text: string) {
    const got = asEl(received).textContent ?? '';
    const pass = got.includes(text);
    return { pass, message: () => `mong chữ ${pass ? 'KHÔNG ' : ''}chứa "${text}", thực tế: "${got}"` };
  },
  toHaveAttribute(received: unknown, name: string, value?: string) {
    const el = asEl(received);
    const got = el.getAttribute(name);
    const pass = value === undefined ? got !== null : got === value;
    return { pass, message: () => `mong thuộc tính ${name}${value === undefined ? '' : `="${value}"`}, thực tế: ${String(got)}` };
  },
  toBeDisabled(received: unknown) {
    const pass = (asEl(received) as HTMLButtonElement).disabled === true;
    return { pass, message: () => `mong phần tử ${pass ? 'KHÔNG ' : ''}bị khoá` };
  },
  toBeEnabled(received: unknown) {
    const pass = (asEl(received) as HTMLButtonElement).disabled !== true;
    return { pass, message: () => `mong phần tử ${pass ? 'KHÔNG ' : ''}mở` };
  },
});
