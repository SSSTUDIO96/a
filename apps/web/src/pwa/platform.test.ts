import { afterEach, describe, expect, it, vi } from 'vitest';
import { isIOS, isIOSSafari, isStandalone, isZaloInApp } from './platform';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1';
const IPHONE_ZALO = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo/24.04.1 ZaloTheme/light';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

function stub(userAgent: string, extra: Record<string, unknown> = {}, matches = false) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints: 0, ...extra });
  vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: matches && q === '(display-mode: standalone)' }) });
}

afterEach(() => vi.unstubAllGlobals());

describe('platform', () => {
  it('isIOS: iPhone, iPad (UA Macintosh + cảm ứng) là iOS; Android và máy tính không', () => {
    stub(IPHONE_SAFARI);
    expect(isIOS()).toBe(true);
    stub(IPAD_DESKTOP_UA, { maxTouchPoints: 5 });
    expect(isIOS()).toBe(true);
    stub(IPAD_DESKTOP_UA);
    expect(isIOS()).toBe(false);
    stub(ANDROID_CHROME);
    expect(isIOS()).toBe(false);
  });

  it('isIOSSafari: chỉ Safari thật, không phải Chrome iOS hay Zalo', () => {
    stub(IPHONE_SAFARI);
    expect(isIOSSafari()).toBe(true);
    stub(IPHONE_CHROME);
    expect(isIOSSafari()).toBe(false);
    stub(IPHONE_ZALO);
    expect(isIOSSafari()).toBe(false);
    stub(ANDROID_CHROME);
    expect(isIOSSafari()).toBe(false);
  });

  it('isZaloInApp: có "Zalo" trong User-Agent', () => {
    stub(IPHONE_ZALO);
    expect(isZaloInApp()).toBe(true);
    stub(IPHONE_SAFARI);
    expect(isZaloInApp()).toBe(false);
  });

  it('isStandalone: display-mode standalone hoặc navigator.standalone (iOS)', () => {
    stub(IPHONE_SAFARI);
    expect(isStandalone()).toBe(false);
    stub(ANDROID_CHROME, {}, true);
    expect(isStandalone()).toBe(true);
    stub(IPHONE_SAFARI, { standalone: true });
    expect(isStandalone()).toBe(true);
    stub(IPHONE_SAFARI, { standalone: false });
    expect(isStandalone()).toBe(false);
  });
});
