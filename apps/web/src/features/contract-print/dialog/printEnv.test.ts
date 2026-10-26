import { describe, expect, it } from 'vitest';
import { SAFARI_FOOTER_WARNING, formatDateTimeIn, isStandaloneApp, isWebKitPrint, localDateIn } from './printEnv';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
};

describe('isWebKitPrint: trình duyệt không in hộp lề @page', () => {
  it('Safari iPhone, Chrome trên iPhone (cũng là WebKit), Safari Mac → có', () => {
    expect(isWebKitPrint({ userAgent: UA.iphoneSafari })).toBe(true);
    expect(isWebKitPrint({ userAgent: UA.iphoneChrome })).toBe(true);
    expect(isWebKitPrint({ userAgent: UA.macSafari })).toBe(true);
  });
  it('iPad xưng là Mac nhưng có màn cảm ứng → có', () => {
    expect(isWebKitPrint({ userAgent: UA.macSafari, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
  });
  it('Chrome Mac, Edge, Android Chrome, Firefox → không', () => {
    for (const ua of [UA.macChrome, UA.winEdge, UA.android, UA.firefox]) expect(isWebKitPrint({ userAgent: ua })).toBe(false);
  });
});

describe('isStandaloneApp, lời cảnh báo, giờ theo múi giờ tổ chức', () => {
  it('chỉ standalone === true mới là app thêm ra màn hình chính', () => {
    expect(isStandaloneApp({ userAgent: '', standalone: true })).toBe(true);
    expect(isStandaloneApp({ userAgent: '' })).toBe(false);
  });
  it('lời cảnh báo Safari là một dòng không quá 90 ký tự', () => {
    expect(SAFARI_FOOTER_WARNING.length).toBeLessThanOrEqual(90);
    expect(SAFARI_FOOTER_WARNING).not.toContain('\n');
  });
  it('giờ lần in và ngày ghi chân trang theo múi giờ tổ chức (qua nửa đêm UTC vẫn đúng ngày địa phương)', () => {
    expect(formatDateTimeIn('2026-10-20T07:30:00.000Z', 'Asia/Ho_Chi_Minh')).toBe('20/10/2026 14:30');
    expect(localDateIn('2026-10-24T18:30:00.000Z', 'Asia/Ho_Chi_Minh')).toBe('2026-10-25');
    expect(localDateIn('2026-10-24T18:30:00.000Z', 'UTC')).toBe('2026-10-24');
    expect(() => formatDateTimeIn('không phải giờ', 'UTC')).toThrow(RangeError);
  });
});
