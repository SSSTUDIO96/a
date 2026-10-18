import { describe, expect, it } from 'vitest';
import { DESIGN_TEMPLATES, findDesignTemplate, type DesignTemplate } from '@makeup/shared';
import type { DesignData } from '../../api/designs';
import { ApiError } from '../../api/errors';
import {
  cardCreateInput,
  checkDraft,
  contractKindsForKind,
  designPerms,
  downloadName,
  frameQuery,
  kindTabsFor,
  missingDataSlots,
  photoCountError,
  photoRule,
  serverFormErrors,
  templateChoices,
  thumbnailUrl,
  ymdToVn,
} from './model';

const T = (code: string): DesignTemplate => {
  const t = findDesignTemplate(code);
  if (!t) throw new Error(code);
  return t;
};

const SERVICE_DATA: DesignData = {
  contractKind: 'SERVICE',
  courseClassId: null,
  th: 'Quỳnh Hương Makeup Academy',
  diachi: '18 Nguyễn Chí Thanh, Đống Đa, Hà Nội',
  sdt: '0987654321',
  web: 'https://quynhhuong.vn',
  ten: 'Thuý Tây',
  khoa: null,
  lop: null,
  ngay: null,
  nkt: null,
  lich: null,
  gv: null,
  nv: 'Cô dâu',
  goi: 'Ngày cưới trọn gói',
  nsk: '2026-10-24',
  logoUrl: '/api/v1/files/raw/logo',
  anhUrl: null,
  signedUrlExpiresAt: null,
};
const COURSE_DATA: DesignData = {
  ...SERVICE_DATA,
  contractKind: 'COURSE',
  courseClassId: 'cls-1',
  ten: 'Quỳnh Như',
  khoa: 'Makeup chuyên nghiệp',
  lop: 'K12',
  ngay: '2026-11-03',
  nkt: '2026-12-20',
  lich: 'T3 · T5 · T7, 18:00–21:00',
  gv: 'Nguyễn Thu Hà',
  nv: null,
  goi: null,
  nsk: null,
  anhUrl: '/api/v1/files/raw/anh',
};

describe('lọc mẫu theo loại hợp đồng (danh mục là dữ liệu)', () => {
  it('thẻ chào mừng chỉ có hợp đồng khoá học; feedback, lời chúc có cả hai loại', () => {
    expect(contractKindsForKind('WELCOME')).toEqual(['COURSE']);
    expect(contractKindsForKind('FEEDBACK')).toEqual(['COURSE', 'SERVICE']);
    expect(contractKindsForKind('GREETING')).toEqual(['COURSE', 'SERVICE']);
  });

  it('"Hợp với hợp đồng này": feedback dịch vụ có 10 mẫu, feedback khoá học 9 (fb-09 trước – sau chỉ dịch vụ)', () => {
    expect(templateChoices('FEEDBACK', 'SERVICE', 'fit').map((c) => c.template.code)).toHaveLength(10);
    const course = templateChoices('FEEDBACK', 'COURSE', 'fit').map((c) => c.template.code);
    expect(course).toHaveLength(9);
    expect(course).not.toContain('fb-09');
  });

  it('"Tất cả mẫu": mẫu không hợp loại hợp đồng vẫn hiện nhưng tắt, có lý do', () => {
    const all = templateChoices('GREETING', 'COURSE', 'all');
    expect(all).toHaveLength(6);
    const lc01 = all.find((c) => c.template.code === 'lc-01');
    expect(lc01).toMatchObject({ enabled: false, reason: 'Chỉ dùng cho hợp đồng dịch vụ' });
    expect(all.filter((c) => c.enabled).map((c) => c.template.code)).toEqual(['lc-02', 'lc-05']);
    const lc05 = templateChoices('GREETING', 'SERVICE', 'all').find((c) => c.template.code === 'lc-05');
    expect(lc05).toMatchObject({ enabled: false, reason: 'Chỉ dùng cho hợp đồng khoá học' });
  });

  it('thêm mẫu vào danh mục là có trên lưới, không sửa màn', () => {
    const extra: DesignTemplate = { ...T('fb-01'), code: 'fb-99', name: 'Mẫu mới', contractKinds: ['SERVICE'] };
    const list = [...DESIGN_TEMPLATES, extra];
    expect(templateChoices('FEEDBACK', 'SERVICE', 'fit', list).map((c) => c.template.code)).toContain('fb-99');
    expect(templateChoices('FEEDBACK', 'COURSE', 'fit', list).map((c) => c.template.code)).not.toContain('fb-99');
  });

  it('ảnh nhỏ: mẫu dùng cả hai loại lấy bản khoá học / dịch vụ; mẫu một loại lấy bản chung', () => {
    expect(thumbnailUrl(T('fb-02'), 'SERVICE')).toBe('/mau/anh-nho/fb-02-dv.jpg');
    expect(thumbnailUrl(T('fb-02'), 'COURSE')).toBe('/mau/anh-nho/fb-02-khoa.jpg');
    expect(thumbnailUrl(T('shd-01'), 'COURSE')).toBe('/mau/anh-nho/shd-01.jpg');
  });

  it('Thẻ chào mừng chỉ có ở tổ chức ACADEMY', () => {
    expect(kindTabsFor('ACADEMY').map((t) => t.path)).toEqual(['the-chao', 'feedback', 'loi-chuc']);
    expect(kindTabsFor('TEAM').map((t) => t.path)).toEqual(['feedback', 'loi-chuc']);
  });
});

describe('số ảnh theo mẫu (photos.min..max)', () => {
  it('fb-05 cần đúng 2 ảnh, fb-04 cần 3, lc-01 cần 1, thẻ chào mừng không có ô ảnh tải lên', () => {
    expect(photoRule(T('fb-05'))).toMatchObject({ min: 2, max: 2, text: 'Mẫu này cần đúng 2 ảnh' });
    expect(photoRule(T('fb-04')).max).toBe(3);
    expect(photoRule(T('lc-01')).max).toBe(1);
    expect(photoRule(T('shd-01'))).toMatchObject({ max: 0, text: 'Mẫu này không có ô ảnh tải lên' });
  });

  it('thiếu hoặc thừa ảnh → lời lỗi có số đang có; đủ → null', () => {
    expect(photoCountError(T('fb-05'), 1)).toBe('Mẫu này cần đúng 2 ảnh (đang có 1).');
    expect(photoCountError(T('fb-05'), 3)).toBe('Mẫu này cần đúng 2 ảnh (đang có 3).');
    expect(photoCountError(T('fb-05'), 2)).toBeNull();
    expect(photoCountError(T('shd-01'), 0)).toBeNull();
  });
});

describe('đổi ngày máy chủ YYYY-MM-DD → dd/mm/yyyy của tệp vẽ', () => {
  it('đổi đúng, giữ số 0 đầu', () => {
    expect(ymdToVn('2026-11-03')).toBe('03/11/2026');
    expect(ymdToVn('2026-10-24')).toBe('24/10/2026');
  });
  it('trống, sai dạng hoặc ngày không có thật → null (không đoán)', () => {
    expect(ymdToVn(null)).toBeNull();
    expect(ymdToVn('')).toBeNull();
    expect(ymdToVn('24/10/2026')).toBeNull();
    expect(ymdToVn('2026-02-30')).toBeNull();
    expect(ymdToVn('2026-10-24T00:00:00Z')).toBeNull();
  });
});

describe('tham số cho tệp vẽ', () => {
  const imgs = { logo: 'blob:logo', anh: 'blob:anh', photos: ['blob:a1', 'blob:a2'] };
  const input = { title: '', body: 'Cảm ơn team nhiều lắm!', rating: 5, receivedAt: '2026-10-12' };

  it('feedback dịch vụ fb-05: chế độ dữ liệu thật, loai=dv, ngày sự kiện đổi dd/mm/yyyy, tên khách có cả ten và kh', () => {
    const p = new URLSearchParams(frameQuery({ template: T('fb-05'), contractKind: 'SERVICE', data: SERVICE_DATA, images: imgs, input, size: '1080x1350', font: null }));
    expect(p.get('that')).toBe('1');
    expect(p.get('loai')).toBe('dv');
    expect(p.get('kho')).toBeNull();
    expect(p.get('nsk')).toBe('24/10/2026');
    expect(p.get('ten')).toBe('Thuý Tây');
    expect(p.get('kh')).toBe('Thuý Tây');
    expect(p.get('nd')).toBe('Cảm ơn team nhiều lắm!');
    expect([p.get('a1'), p.get('a2'), p.get('a3')]).toEqual(['blob:a1', 'blob:a2', null]);
    expect(p.get('logo')).toBe('blob:logo');
    // Ô chỉ của hợp đồng khoá học không gửi ở bản dịch vụ; ô không thuộc mẫu (web, sao) không gửi.
    expect(p.has('khoa')).toBe(false);
    expect(p.has('web')).toBe(false);
    expect(p.has('sao')).toBe(false);
  });

  it('chào mừng khoá học shd-10: ngày khai giảng đổi dd/mm/yyyy, khổ vuông, phông chữ ký 2', () => {
    const p = new URLSearchParams(frameQuery({ template: T('shd-10'), contractKind: 'COURSE', data: COURSE_DATA, images: imgs, input, size: '1080x1080', font: 'ky-2' }));
    expect(p.get('loai')).toBe('khoa');
    expect(p.get('ngay')).toBe('03/11/2026');
    expect(p.get('kho')).toBe('vuong');
    expect(p.get('ky')).toBe('2');
    expect(p.get('gv')).toBe('Nguyễn Thu Hà');
    expect(p.get('anh')).toBe('blob:anh');
    expect(p.has('nd')).toBe(false);
  });

  it('ô hợp đồng chưa có → không gửi (tệp vẽ để trống, không lấy chữ mẫu); báo ra ô trống', () => {
    const data = { ...SERVICE_DATA, nsk: null, logoUrl: null };
    const p = new URLSearchParams(frameQuery({ template: T('lc-01'), contractKind: 'SERVICE', data, images: { logo: null, anh: null, photos: [] }, input, size: '1080x1350', font: null }));
    expect(p.has('nsk')).toBe(false);
    expect(p.has('logo')).toBe(false);
    expect(missingDataSlots(T('lc-01'), 'SERVICE', data).map((m) => m.label)).toEqual(['Logo', 'Ngày sự kiện']);
  });

  it('feedback có sao, có ngày nhận: gửi sao và ngày nhận dd/mm/yyyy', () => {
    const p = new URLSearchParams(frameQuery({ template: T('fb-02'), contractKind: 'COURSE', data: COURSE_DATA, images: imgs, input, size: '1080x1350', font: null }));
    expect(p.get('sao')).toBe('5');
    const p4 = new URLSearchParams(frameQuery({ template: T('fb-04'), contractKind: 'COURSE', data: COURSE_DATA, images: imgs, input, size: '1080x1350', font: null }));
    expect(p4.get('nfb')).toBe('12/10/2026');
  });
});

describe('thân tạo thẻ và kiểm trước khi gửi', () => {
  const draft = { title: 'Trăm năm hạnh phúc', body: 'Chúc hai bạn…', rating: 4, receivedAt: '2026-10-12', photoFileIds: ['f1'] };

  it('lời chúc: gửi title, body; không gửi số sao, ngày nhận', () => {
    const b = cardCreateInput({ kind: 'GREETING', template: T('lc-01'), contractId: 'c1', courseClassId: null, draft, size: '1080x1350', font: null });
    expect(b).toEqual({ kind: 'GREETING', templateCode: 'lc-01', contractId: 'c1', photoFileIds: ['f1'], fontOverride: null, size: '1080x1350', title: 'Trăm năm hạnh phúc', body: 'Chúc hai bạn…' });
  });

  it('chào mừng khoá học: gửi lớp, không gửi chữ nhập', () => {
    const b = cardCreateInput({ kind: 'WELCOME', template: T('shd-01'), contractId: 'c1', courseClassId: 'cls-1', draft: { ...draft, photoFileIds: [] }, size: '1080x1080', font: 'ky-1' });
    expect(b).toEqual({ kind: 'WELCOME', templateCode: 'shd-01', contractId: 'c1', courseClassId: 'cls-1', photoFileIds: [], fontOverride: 'ky-1', size: '1080x1080' });
  });

  it('feedback thiếu lời khen, thiếu ảnh, mẫu có sao mà chưa chọn → lỗi đúng ô', () => {
    const e = checkDraft({ kind: 'FEEDBACK', template: T('fb-02'), contractId: 'c1', draft: { ...draft, body: ' ', rating: null, photoFileIds: [] } });
    expect(e).toEqual({ body: 'Dán nội dung lời khen.', photos: 'Mẫu này cần đúng 1 ảnh (đang có 0).', rating: 'Chọn số sao.' });
    expect(checkDraft({ kind: 'FEEDBACK', template: T('fb-02'), contractId: null, draft }).contract).toBe('Chọn hợp đồng nguồn.');
  });
});

describe('lỗi 400 của máy chủ về đúng ô', () => {
  it('mẫu sai loại hợp đồng (templateCode) → ô mẫu; ảnh → ô ảnh; lỗi lạ → dải chung', () => {
    const err = new ApiError('VALIDATION_FAILED', 'Mẫu lc-01 chỉ dùng cho hợp đồng dịch vụ', 400, 'r', {
      issues: [
        { path: 'templateCode', message: 'Mẫu lc-01 chỉ dùng cho hợp đồng dịch vụ' },
        { path: 'photoFileIds.0', message: 'Không tìm thấy ảnh trong tổ chức' },
        { path: 'khac', message: 'Lỗi khác' },
      ],
    });
    expect(serverFormErrors(err)).toEqual({
      fields: { template: 'Mẫu lc-01 chỉ dùng cho hợp đồng dịch vụ', photos: 'Không tìm thấy ảnh trong tổ chức' },
      rest: ['Lỗi khác'],
    });
  });
});

describe('quyền', () => {
  const has = (list: string[]) => (p: string) => list.includes(p);
  it('designs.write + files.write: tạo thẻ, thêm ảnh; thiếu files.write: không thêm ảnh', () => {
    expect(designPerms(has(['designs.read', 'designs.write', 'files.write', 'contracts.read']))).toEqual({ read: true, write: true, files: true, contracts: true, customers: false });
    expect(designPerms(has(['designs.read', 'designs.write'])).files).toBe(false);
  });
  it('chỉ designs.read: không tạo thẻ, không thêm ảnh', () => {
    expect(designPerms(has(['designs.read']))).toMatchObject({ read: true, write: false, files: false });
  });
});

it('tên tệp tải về bỏ dấu tiếng Việt', () => {
  expect(downloadName('fb-05', 'Thuý Tây', '1080x1350')).toBe('fb-05-thuy-tay-1080x1350.png');
  expect(downloadName('shd-01', 'Đặng Quỳnh Như', '1080x1080')).toBe('shd-01-dang-quynh-nhu-1080x1080.png');
});
