import { describe, expect, it } from 'vitest';
import { SYSTEM_ROLE_KEYS, SYSTEM_ROLES, PERMISSIONS, type Permission } from './permissions';
import {
  callName,
  deviceLabelFromUserAgent,
  PORTAL_DENIED_MESSAGE,
  PORTAL_HANDOFF_MINUTES,
  PORTAL_LINK_TTL_DAYS,
  PORTAL_MAX_DEVICES,
  PORTAL_MAX_FAILED,
  PORTAL_MAX_SESSIONS_PER_DEVICE,
  PORTAL_MIN_RESPONSE_MS,
  PORTAL_SESSION_DAYS,
  PORTAL_SESSION_INVALID_MESSAGE,
  PORTAL_SESSION_TOUCH_MINUTES,
  PORTAL_WEB_PATH,
  portalMessage,
  transferNote,
} from './portal';

describe('cổng học viên — hằng số (bản vẽ E mục 3.4)', () => {
  it('GIỮ: đúng các con số đã chốt', () => {
    expect({
      PORTAL_LINK_TTL_DAYS,
      PORTAL_MAX_DEVICES,
      PORTAL_MAX_FAILED,
      PORTAL_SESSION_DAYS,
      PORTAL_SESSION_TOUCH_MINUTES,
      PORTAL_HANDOFF_MINUTES,
      PORTAL_MAX_SESSIONS_PER_DEVICE,
      PORTAL_MIN_RESPONSE_MS,
      PORTAL_WEB_PATH,
    }).toEqual({
      PORTAL_LINK_TTL_DAYS: 7,
      PORTAL_MAX_DEVICES: 2,
      PORTAL_MAX_FAILED: 5,
      PORTAL_SESSION_DAYS: 90,
      PORTAL_SESSION_TOUCH_MINUTES: 60,
      PORTAL_HANDOFF_MINUTES: 10,
      PORTAL_MAX_SESSIONS_PER_DEVICE: 3,
      PORTAL_MIN_RESPONSE_MS: 300,
      PORTAL_WEB_PATH: '/hv',
    });
  });
  it('GIỮ: một lời chung cho mọi lần mở hỏng, tiếng Việt có dấu', () => {
    expect(PORTAL_DENIED_MESSAGE).toBe(
      'Không mở được trang. Kiểm tra lại 4 số cuối số điện thoại, hoặc nhắn trung tâm gửi đường dẫn mới.',
    );
    expect(PORTAL_SESSION_INVALID_MESSAGE).toBe('Phiên đã hết. Mở lại đường dẫn trung tâm gửi qua Zalo.');
  });
});

describe('callName — tên gọi', () => {
  it('GIỮ: chữ cuối của họ tên', () => {
    expect(callName('Tôn Nữ Phương Thảo')).toBe('Thảo');
    expect(callName('  Nguyễn   Văn  Hùng  ')).toBe('Hùng');
    expect(callName('Thảo')).toBe('Thảo');
  });
  it('GIỮ: hai chữ cuối khi chữ cuối chỉ 1–2 ký tự (đếm theo chữ có dấu, kể cả chuỗi NFD)', () => {
    expect(callName('Nguyễn Thị Mỹ Lệ')).toBe('Mỹ Lệ');
    expect(callName('Trần Ý')).toBe('Trần Ý');
    expect(callName('Nguyễn Thị Mỹ Lệ'.normalize('NFD'))).toBe('Mỹ Lệ');
    expect(callName('Lê Văn Anh')).toBe('Anh'); // 3 ký tự → một chữ
    expect(callName('Ý')).toBe('Ý'); // chỉ một chữ
  });
  it('BẮT: họ tên trống ném lỗi, không trả chuỗi rỗng im lặng', () => {
    expect(() => callName('')).toThrow();
    expect(() => callName('   ')).toThrow();
  });
});

describe('transferNote — nội dung chuyển khoản', () => {
  it('GIỮ: bỏ dấu (cả đ/Đ), giữ mã hợp đồng', () => {
    expect(transferNote('HĐKH-000042', 'Phương Thảo')).toBe('HDKH-000042 Phuong Thao');
    expect(transferNote('HĐKH-000042', 'Đặng Thị Đào')).toBe('HDKH-000042 Dang Thi Dao');
  });
  it('BẮT: chỉ còn [A-Za-z0-9 -], gộp dấu cách, tối đa 50 ký tự, không đuôi cách', () => {
    const n = transferNote('HĐKH-000042', "  Ngô (Bé) O'Brien_ Hà  ");
    expect(n).toBe('HDKH-000042 Ngo Be O Brien Ha');
    expect(n).toMatch(/^[A-Za-z0-9 -]+$/);
    const long = transferNote('HĐKH-000042', 'Tôn Nữ Hoàng Phương Thảo Nguyên Khánh Linh Bảo Ngọc');
    expect(long.length).toBeLessThanOrEqual(50);
    expect(long).toBe('HDKH-000042 Ton Nu Hoang Phuong Thao Nguyen Khanh');
    expect(long.endsWith(' ')).toBe(false);
  });
  it('BẮT: mã hợp đồng trống ném lỗi', () => {
    expect(() => transferNote(' ', 'Thảo')).toThrow();
  });
});

describe('deviceLabelFromUserAgent — tên máy do máy chủ đọc', () => {
  const UA = {
    iphoneSafari:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    iphoneChrome:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
    iphoneZalo:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 Zalo iOS/24.06.01',
    androidChrome:
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    androidZalo:
      'Mozilla/5.0 (Linux; Android 13; Redmi Note 12) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36 Zalo android/12100657',
    androidSamsung:
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
    windowsChrome:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    windowsEdge:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
    macSafari:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  };
  it('GIỮ: đúng các tên trong bản vẽ', () => {
    expect(deviceLabelFromUserAgent(UA.iphoneSafari)).toBe('iPhone · Safari');
    expect(deviceLabelFromUserAgent(UA.iphoneZalo)).toBe('iPhone · Zalo');
    expect(deviceLabelFromUserAgent(UA.androidChrome)).toBe('Android · Chrome');
    expect(deviceLabelFromUserAgent(UA.windowsChrome)).toBe('Máy tính · Chrome');
    expect(deviceLabelFromUserAgent(undefined)).toBe('Máy khác · Trình duyệt');
    expect(deviceLabelFromUserAgent('')).toBe('Máy khác · Trình duyệt');
    expect(deviceLabelFromUserAgent('curl/8.5.0')).toBe('Máy khác · Trình duyệt');
  });
  it('BẮT: trình duyệt nhúng / nhái chữ "Chrome", "Safari" không bị nhận nhầm', () => {
    expect(deviceLabelFromUserAgent(UA.iphoneChrome)).toBe('iPhone · Chrome');
    expect(deviceLabelFromUserAgent(UA.androidZalo)).toBe('Android · Zalo');
    expect(deviceLabelFromUserAgent(UA.androidSamsung)).toBe('Android · Samsung Internet');
    expect(deviceLabelFromUserAgent(UA.windowsEdge)).toBe('Máy tính · Edge');
    expect(deviceLabelFromUserAgent(UA.macSafari)).toBe('Máy tính · Safari');
    expect(deviceLabelFromUserAgent(UA.linuxFirefox)).toBe('Máy tính · Firefox');
  });
  it('BẮT: luôn 1–80 ký tự (CHECK portal_devices_label_len), kể cả User-Agent dài 10 000 ký tự', () => {
    for (const ua of [...Object.values(UA), 'x'.repeat(10_000), `${UA.iphoneSafari}${'Z'.repeat(5000)}`]) {
      const label = deviceLabelFromUserAgent(ua);
      expect(label.length).toBeGreaterThanOrEqual(1);
      expect(label.length).toBeLessThanOrEqual(80);
    }
  });
});

describe('portalMessage — tin nhắn dán Zalo', () => {
  it('GIỮ: đúng nguyên văn bản vẽ', () => {
    expect(portalMessage({ callName: 'Thảo', centerName: 'Học viện Mai Anh', url: 'https://app.vd/hv#k=abc' })).toBe(
      'Chào Thảo, đây là trang học viên của em tại Học viện Mai Anh (lịch học, học phí, nội quy, ảnh):\n' +
        'https://app.vd/hv#k=abc\n' +
        'Mở bằng điện thoại của em và nhập 4 số cuối số điện thoại đã đăng ký. Đường dẫn chưa mở sẽ hết hạn sau 7 ngày. ' +
        'Đường dẫn này chỉ dành cho em, đừng chuyển cho người khác nhé.',
    );
  });
});

describe('quyền portal.manage', () => {
  it('GIỮ: có trong danh mục; vai trò mẫu Chủ, Quản trị, Quản lý, Lễ tân có (KY-DUYET-E quyết định 3)', () => {
    expect(PERMISSIONS['portal.manage']).toBe('Gửi, thu hồi đường dẫn cổng học viên; xem, chặn máy đã mở');
    const holders = (p: Permission) => SYSTEM_ROLE_KEYS.filter((k) => SYSTEM_ROLES[k].permissions.includes(p)).sort();
    expect(holders('portal.manage')).toEqual(['admin', 'manager', 'owner', 'receptionist']);
  });
  it('BẮT: vai trò mẫu nào có portal.manage cũng có đủ customers.read, contracts.read, payments.read (tạo đường dẫn đòi cả ba)', () => {
    for (const k of SYSTEM_ROLE_KEYS) {
      const perms = SYSTEM_ROLES[k].permissions;
      if (!perms.includes('portal.manage')) continue;
      for (const need of ['customers.read', 'contracts.read', 'payments.read'] as const) expect(perms, `${k} thiếu ${need}`).toContain(need);
    }
  });
});
