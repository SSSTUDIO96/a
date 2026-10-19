import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './registerSW';

// Môi trường node: dựng navigator giả khi cần. import.meta.env.PROD đổi bằng vi.stubEnv.
describe('registerServiceWorker', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    warn.mockRestore();
  });

  it('lúc dev (không phải PROD) → KHÔNG đăng ký', () => {
    vi.stubEnv('PROD', false);
    const register = vi.fn();
    vi.stubGlobal('navigator', { serviceWorker: { register } });
    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
  });

  it('bản build (PROD) có serviceWorker → đăng ký /sw.js với scope "/"', () => {
    vi.stubEnv('PROD', true);
    const register = vi.fn().mockResolvedValue({});
    vi.stubGlobal('navigator', { serviceWorker: { register } });
    registerServiceWorker();
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('trình duyệt không có serviceWorker → không làm gì, không ném lỗi', () => {
    vi.stubEnv('PROD', true);
    vi.stubGlobal('navigator', {});
    expect(() => registerServiceWorker()).not.toThrow();
  });

  it('register từ chối (Promise reject) → nuốt lỗi, ghi console.warn', async () => {
    vi.stubEnv('PROD', true);
    const register = vi.fn().mockRejectedValue(new Error('SecurityError'));
    vi.stubGlobal('navigator', { serviceWorker: { register } });
    expect(() => registerServiceWorker()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('register ném lỗi đồng bộ → nuốt lỗi, ghi console.warn', () => {
    vi.stubEnv('PROD', true);
    const register = vi.fn(() => {
      throw new Error('ném đồng bộ');
    });
    vi.stubGlobal('navigator', { serviceWorker: { register } });
    expect(() => registerServiceWorker()).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
