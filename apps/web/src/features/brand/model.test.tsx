import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/errors';
import type { BrandProfile, ServicePackage } from '../../api/types';
import { draftToSite, previewPackages } from './draftToSite';
import { addStyle, draftFromProfile, emptyDraft, expiredSlots, mapSaveError, sameInput, toInput, validateDraft } from './model';
import { parseSiteOrigin, shareUrl, siteLink } from './publicLink';

const T = '2026-10-18T00:00:00.000Z';
const PROFILE: BrandProfile = {
  brandName: 'Studio Chiến Makeup',
  tagline: null,
  bio: 'Giới thiệu',
  experience: null,
  styles: ['Tự nhiên'],
  serviceArea: null,
  address: null,
  phone: '0903112233',
  email: null,
  zalo: null,
  facebook: 'https://facebook.com/studiochien',
  instagram: null,
  tiktok: null,
  website: null,
  logoFileId: '11111111-1111-4111-8111-111111111111',
  avatarFileId: null,
  coverFileId: null,
  workingHours: [
    { weekday: 1, open: '08:00', close: '12:00' },
    { weekday: 1, open: '13:30', close: '20:00' },
    { weekday: 6, open: '04:00', close: '21:00' },
  ],
  bookingPolicy: null,
  cancellationPolicy: null,
  depositPolicy: null,
  isPublished: true,
  publishedAt: T,
  updatedAt: T,
  logo: { url: '/anh/logo.png', expiresAt: '2026-10-18T00:10:00.000Z' },
  avatar: null,
  cover: null,
};

const issues = (list: { path: string; message: string }[]) => new ApiError('VALIDATION_FAILED', 'Dữ liệu không hợp lệ', 400, 'r', { issues: list });

describe('Bản nháp ↔ thân PUT /profile', () => {
  it('luôn gửi đủ 21 trường, không có isPublished/publishedAt; chuỗi rỗng → null', () => {
    const { input } = toInput(draftFromProfile(PROFILE));
    expect(Object.keys(input).sort()).toHaveLength(21);
    expect(input).not.toHaveProperty('isPublished');
    expect(input).not.toHaveProperty('publishedAt');
    expect(input.tagline).toBeNull();
    expect(input.logoFileId).toBe(PROFILE.logoFileId);
    expect(input.workingHours).toEqual(PROFILE.workingHours);
  });

  it('ngày tắt "mở cửa" không gửi ca; bật lại khôi phục đúng giờ cũ và không tính là thay đổi', () => {
    const d = draftFromProfile(PROFILE);
    const off = { ...d, days: d.days.map((x, i) => (i === 0 ? { ...x, open: false } : x)) };
    expect(toInput(off).input.workingHours).toEqual([{ weekday: 6, open: '04:00', close: '21:00' }]);
    const on = { ...off, days: off.days.map((x, i) => (i === 0 ? { ...x, open: true } : x)) };
    expect(sameInput(on, d)).toBe(true);
  });

  it('kiểm trước khi gửi: tên trống, ca chưa đủ giờ (dưới đúng hàng thứ)', () => {
    const d = { ...emptyDraft(), days: emptyDraft().days.map((x, i) => (i === 2 ? { open: true, shifts: [{ open: '08:00', close: null }] } : x)) };
    expect(validateDraft(d)).toEqual({ brandName: 'Tên thương hiệu không được để trống', 'hours.3': 'Nhập đủ giờ mở và giờ đóng của ca' });
  });
});

describe('Lỗi 400 của máy chủ → dưới đúng ô', () => {
  it('liên kết http, SĐT sai → đúng tên trường', () => {
    const e = mapSaveError(
      issues([
        { path: 'instagram', message: 'Liên kết phải là địa chỉ https:// đầy đủ' },
        { path: 'phone', message: 'Số điện thoại không hợp lệ (di động 10 số hoặc cố định 11 số)' },
      ]),
      [],
    );
    expect(e).toEqual({ instagram: 'Liên kết phải là địa chỉ https:// đầy đủ', phone: 'Số điện thoại không hợp lệ (di động 10 số hoặc cố định 11 số)' });
  });

  it('giờ làm việc: đường dẫn [i, "close"] → hàng thứ của ca thứ i đã gửi; câu "Thứ N: … chồng nhau" → hàng thứ N', () => {
    const { sent } = toInput(draftFromProfile(PROFILE));
    const e = mapSaveError(
      issues([
        { path: 'workingHours.2.close', message: 'Thứ 6: giờ đóng (03:00) phải sau giờ mở (04:00)' },
        { path: 'workingHours', message: 'Thứ 1: ca 08:00–12:00 và ca 11:00–20:00 chồng nhau' },
      ]),
      sent,
    );
    expect(e).toEqual({ 'hours.6': 'Giờ đóng (03:00) phải sau giờ mở (04:00)', 'hours.1': 'Ca 08:00–12:00 và ca 11:00–20:00 chồng nhau' });
  });

  it('lỗi ảnh (details.field) → dưới ô ảnh; lỗi không rõ ô → _form', () => {
    expect(mapSaveError(new ApiError('VALIDATION_FAILED', 'Tệp logo phải là ảnh tải lên cho mục ORG_LOGO', 400, 'r', { field: 'logoFileId' }), [])).toEqual({
      logoFileId: 'Tệp logo phải là ảnh tải lên cho mục ORG_LOGO',
    });
    expect(mapSaveError(new ApiError('VALIDATION_FAILED', 'Chưa có hồ sơ', 400, 'r'), [])).toEqual({ _form: 'Chưa có hồ sơ' });
  });
});

describe('Phong cách, URL ảnh quá hạn', () => {
  it('thêm phong cách: trống, trùng, quá 50 ký tự, quá 20 cái', () => {
    expect(addStyle(['Tự nhiên'], ' tự  nhiên ')).toEqual({ ok: false, error: 'Đã có phong cách này' });
    expect(addStyle([], '   ')).toEqual({ ok: false, error: 'Nhập tên phong cách' });
    expect(addStyle([], 'a'.repeat(51))).toEqual({ ok: false, error: 'Tối đa 50 ký tự' });
    expect(addStyle(Array.from({ length: 20 }, (_, i) => `s${i}`), 'mới')).toEqual({ ok: false, error: 'Tối đa 20 phong cách' });
    expect(addStyle(['A'], 'Hàn  Quốc')).toEqual({ ok: true, styles: ['A', 'Hàn Quốc'] });
  });

  it('ô ảnh quá hạn URL (còn < 30 giây cũng tính)', () => {
    const d = draftFromProfile(PROFILE);
    expect(expiredSlots(d.images, Date.parse('2026-10-18T00:05:00.000Z'))).toEqual([]);
    expect(expiredSlots(d.images, Date.parse('2026-10-18T00:09:45.000Z'))).toEqual(['logo']);
  });
});

describe('Đường dẫn trang công khai theo cấu hình', () => {
  it('có cấu hình: hiện tên miền, mở/sao chép tuyệt đối; thiếu/sai: hiện tương đối, không đoán', () => {
    expect(parseSiteOrigin('https://makeuppro.vn/')).toBe('https://makeuppro.vn');
    expect(parseSiteOrigin('makeuppro.vn')).toBeNull();
    expect(parseSiteOrigin('ftp://x.vn')).toBeNull();
    expect(parseSiteOrigin(undefined)).toBeNull();
    expect(siteLink('studio-chien', 'https://makeuppro.vn')).toEqual({ prefix: 'makeuppro.vn/trang/', slug: 'studio-chien', href: 'https://makeuppro.vn/trang/studio-chien' });
    expect(siteLink('studio-chien', null)).toEqual({ prefix: '/trang/', slug: 'studio-chien', href: '/trang/studio-chien' });
    expect(shareUrl('studio-chien', null, 'http://localhost:5182')).toBe('http://localhost:5182/trang/studio-chien');
  });
});

describe('Xem trước dựng từ bản nháp', () => {
  const price = (l: number, s: number | null = null) => ({ priceVersionId: 'v', listPrice: l, salePrice: s, unitPrice: s ?? l, effectiveFrom: T });
  const PKG = {
    id: 'p1',
    code: 'G-CD01',
    name: 'Cô dâu – Ngày cưới',
    description: null,
    durationMinutes: 150,
    staffCount: 1,
    depositAmount: 1_234_000,
    subjectId: 's1',
    locationTypes: ['STUDIO', 'CUSTOMER_HOME'],
    includedKm: null,
    terms: null,
    isActive: true,
    isPublic: true,
    sortOrder: 0,
    createdAt: T,
    updatedAt: T,
    subject: { id: 's1', name: 'Cô dâu', isActive: true },
    items: [
      { serviceId: 'mcd', quantity: 1, isOptional: false, service: { id: 'mcd', code: 'MCD', name: 'Makeup cô dâu', kind: 'MAIN', isActive: true }, currentPrice: price(1_500_000) },
      { serviceId: 'nail', quantity: 1, isOptional: true, service: { id: 'nail', code: 'NAIL', name: 'Làm nail', kind: 'ADDON', isActive: true }, currentPrice: price(250_000) },
      { serviceId: 'old', quantity: 1, isOptional: true, service: { id: 'old', code: 'OLD', name: 'Ngừng bán', kind: 'ADDON', isActive: false }, currentPrice: null },
    ],
    currentPrice: price(3_000_000, 2_700_000),
  } as ServicePackage;

  it('chỉ gói đang bán và bật hiện; km lấy mức chung khi gói không đặt; không mang mã gói, tiền cọc', () => {
    const list = previewPackages([PKG, { ...PKG, id: 'p2', isPublic: false }, { ...PKG, id: 'p3', isActive: false }], 3);
    expect(list.map((p) => p.id)).toEqual(['p1']);
    expect(list[0]?.includedKm).toBe(3);
    expect(list[0]?.included).toEqual([{ name: 'Makeup cô dâu', quantity: 1 }]);
    expect(list[0]?.addons.map((a) => a.name)).toEqual(['Làm nail']);
    const text = JSON.stringify(draftToSite(draftFromProfile(PROFILE), { packages: [PKG], subjects: [{ id: 's1', name: 'Cô dâu' }], freeKm: 3 }));
    expect(text).not.toContain('G-CD01');
    expect(text).not.toContain('1234000');
    expect(text).not.toContain('depositAmount');
  });
});
