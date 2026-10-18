import { describe, expect, it } from 'vitest';
import { SYSTEM_ROLES } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import type { MakeupSubject, PayRateSheet, ServicePackage } from '../../api/types';
import {
  buildPackageCreate,
  buildPackagePatch,
  buildPayRatesInput,
  buildPriceInput,
  buildServicePatch,
  buildTravelInput,
  emptyPackageForm,
  fetchAllPages,
  formatDuration,
  mapSaveError,
  mapTravelError,
  moveItem,
  packageToForm,
  placeLabel,
  PRICING_GROUPS,
  pricingPerms,
  resolveGroup,
  sortOrderPatches,
  subjectCards,
  travelDirty,
  travelToForm,
  validatePackageForm,
  validateTravelForm,
} from './logic';

const T = '2026-10-18T00:00:00.000Z';

function subject(id: string, name: string, sortOrder: number, isActive = true): MakeupSubject {
  return { id, organizationId: 'o', name, sortOrder, isActive, createdAt: T, updatedAt: T };
}

function pkg(over: Partial<ServicePackage> = {}): ServicePackage {
  return {
    id: 'p1',
    code: 'G-CD01',
    name: 'Cô dâu – Ngày cưới',
    description: null,
    durationMinutes: 150,
    staffCount: 1,
    depositAmount: 1_000_000,
    subjectId: 's1',
    locationTypes: [],
    includedKm: null,
    terms: null,
    isActive: true,
    isPublic: true,
    sortOrder: 0,
    createdAt: T,
    updatedAt: T,
    subject: { id: 's1', name: 'Cô dâu', isActive: true },
    items: [
      { serviceId: 'mcd', quantity: 1, isOptional: false, service: { id: 'mcd', code: 'MCD', name: 'Makeup cô dâu', kind: 'MAIN', isActive: true }, currentPrice: null },
      { serviceId: 'nail', quantity: 2, isOptional: true, service: { id: 'nail', code: 'NAIL', name: 'Làm nail', kind: 'ADDON', isActive: true }, currentPrice: null },
    ],
    currentPrice: { priceVersionId: 'v1', listPrice: 3_000_000, salePrice: 2_700_000, unitPrice: 2_700_000, effectiveFrom: T },
    ...over,
  };
}

const SHEET: PayRateSheet = {
  owner: { kind: 'package', id: 'p1', name: 'Cô dâu – Ngày cưới' },
  items: [
    { tier: { id: 't1', name: 'Thợ chính bậc 1', sortOrder: 0 }, amount: 700_000, updatedAt: T, staff: [] },
    { tier: { id: 't2', name: 'Thợ phụ', sortOrder: 1 }, amount: null, updatedAt: null, staff: [] },
  ],
};

function apiErr(status: number, code: string, message: string, details?: unknown) {
  return new ApiError(code, message, status, 'r', details);
}

describe('nhóm và quyền', () => {
  it('4 mục con lấy đúng từ nav.ts, chữ ngắn cho nhóm nút chuyển điện thoại', () => {
    expect(PRICING_GROUPS.map((g) => [g.key, g.label, g.short])).toEqual([
      ['goi', 'Gói theo nhân vật', 'Gói'],
      ['dich-vu', 'Dịch vụ phụ & phụ phí', 'Dịch vụ phụ'],
      ['di-chuyen', 'Phí di chuyển & studio', 'Di chuyển'],
      ['nhan-vat', 'Nhân vật', 'Nhân vật'],
    ]);
    expect(resolveGroup(undefined)).toBeNull();
    expect(resolveGroup('di-chuyen')).toBe('di-chuyen');
    expect(resolveGroup('abc')).toBe('unknown');
  });

  it('quyền theo vai trò hệ thống: chủ đủ, thợ chỉ xem, kế toán xem tiền công', () => {
    const of = (perms: readonly string[]) => pricingPerms((p) => perms.includes(p));
    expect(of(SYSTEM_ROLES.owner.permissions)).toEqual({ catalogWrite: true, pricesWrite: true, payrollRead: true, payrollWrite: true, canCreatePriced: true });
    expect(of(SYSTEM_ROLES.artist.permissions)).toEqual({ catalogWrite: false, pricesWrite: false, payrollRead: false, payrollWrite: false, canCreatePriced: false });
    expect(of(SYSTEM_ROLES.accountant.permissions)).toMatchObject({ payrollRead: true, payrollWrite: false, catalogWrite: false });
    // Quản lý: sửa được gói và giá nhưng không thấy tiền công.
    expect(of(SYSTEM_ROLES.manager.permissions)).toMatchObject({ catalogWrite: true, pricesWrite: true, payrollRead: false, canCreatePriced: true });
    // payroll.write mà thiếu payroll.read thì không đọc được bảng công → không coi là được sửa.
    expect(of(['payroll.write'])).toMatchObject({ payrollRead: false, payrollWrite: false });
    // catalog.write mà thiếu prices.write thì không tạo được gói (thân tạo có giá).
    expect(of(['catalog.write'])).toMatchObject({ canCreatePriced: false });
  });
});

describe('chữ hiển thị trong danh sách gọn', () => {
  it('nơi làm: rỗng hoặc đủ 3 loại = "Mọi nơi"; còn lại nối bằng " · " theo thứ tự cố định', () => {
    expect(placeLabel([])).toBe('Mọi nơi');
    expect(placeLabel(['OTHER', 'STUDIO', 'CUSTOMER_HOME'])).toBe('Mọi nơi');
    expect(placeLabel(['CUSTOMER_HOME', 'STUDIO'])).toBe('Studio · Tại nhà');
    expect(placeLabel(['STUDIO'])).toBe('Studio');
    expect(placeLabel(['OTHER'])).toBe('Nơi khác');
  });

  it('thời lượng', () => {
    expect(formatDuration(45)).toBe('45 phút');
    expect(formatDuration(60)).toBe('1 giờ');
    expect(formatDuration(150)).toBe('2 giờ 30 phút');
  });

  it('thẻ nhân vật: nhân vật đang dùng theo sortOrder, nhân vật đã tắt chỉ hiện khi còn gói, "Mọi nhân vật" cuối', () => {
    const subjects = [subject('s2', 'Phù dâu', 2), subject('s1', 'Cô dâu', 0), subject('s3', 'Chú rể', 1, false), subject('s4', 'Khách mời', 3, false)];
    const packages = [pkg({ id: 'a', subjectId: 's1' }), pkg({ id: 'b', subjectId: 's1' }), pkg({ id: 'c', subjectId: 's4' }), pkg({ id: 'd', subjectId: null })];
    const cards = subjectCards(subjects, packages);
    expect(cards.map((c) => [c.name, c.packages.length])).toEqual([
      ['Cô dâu', 2],
      ['Phù dâu', 0],
      ['Khách mời', 1],
      ['Mọi nhân vật', 1],
    ]);
  });
});

describe('biểu mẫu gói', () => {
  it('đọc gói: locationTypes rỗng → tick đủ 3 ô; tách đã gồm / dịch vụ phụ; nạp tiền công', () => {
    const f = packageToForm(pkg(), SHEET);
    expect(f.locationTypes).toEqual(['STUDIO', 'CUSTOMER_HOME', 'OTHER']);
    expect(f.included).toEqual([{ serviceId: 'mcd', name: 'Makeup cô dâu', quantity: 1 }]);
    expect(f.addons).toEqual(['nail']);
    expect(f.listPrice).toBe(3_000_000);
    expect(f.salePrice).toBe(2_700_000);
    expect(f.payRates).toEqual({ t1: 700_000, t2: null });
  });

  it('ô trống báo lỗi, không đoán: tên, mã (khi tạo), thời lượng, giá niêm yết, cọc, số lần, địa điểm', () => {
    const f = { ...emptyPackageForm(null), staffCount: null, locationTypes: [], included: [{ serviceId: 'x', name: 'X', quantity: null }] };
    expect(Object.keys(validatePackageForm(f, 'create')).sort()).toEqual(
      ['code', 'depositAmount', 'durationMinutes', 'included.0', 'listPrice', 'locationTypes', 'name', 'staffCount'].sort(),
    );
    expect(validatePackageForm({ ...packageToForm(pkg(), null), staffCount: 21 }, 'edit')).toEqual({ staffCount: 'Số thợ từ 1 đến 20.' });
    // Sửa: mã không có ô → không bắt nhập.
    expect(validatePackageForm(packageToForm(pkg(), null), 'edit')).toEqual({});
  });

  it('PATCH chỉ gửi trường đã đổi; không đổi gì → không gọi', () => {
    const p = pkg();
    const f = packageToForm(p, null);
    expect(buildPackagePatch(p, f)).toBeNull();
    // Tick lại đủ 3 ô khi máy chủ đang lưu rỗng = không đổi.
    expect(buildPackagePatch(p, { ...f, locationTypes: ['OTHER', 'STUDIO', 'CUSTOMER_HOME'] })).toBeNull();
    expect(buildPackagePatch(p, { ...f, name: '  Cô dâu – Cưới  ' })).toEqual({ name: 'Cô dâu – Cưới' });
    expect(buildPackagePatch(p, { ...f, locationTypes: ['CUSTOMER_HOME', 'STUDIO'] })).toEqual({ locationTypes: ['STUDIO', 'CUSTOMER_HOME'] });
    expect(buildPackagePatch(p, { ...f, subjectId: null, includedKm: 5 })).toEqual({ subjectId: null, includedKm: 5 });
  });

  it('đổi dịch vụ trong gói → gửi lại TOÀN BỘ items, giữ số lượng cũ của dòng tick', () => {
    const p = pkg();
    const f = packageToForm(p, null);
    const patch = buildPackagePatch(p, { ...f, included: [...f.included, { serviceId: 'toc', name: 'Làm tóc', quantity: 2 }], addons: ['nail', 'lens'] });
    expect(patch).toEqual({
      items: [
        { serviceId: 'mcd', quantity: 1, isOptional: false },
        { serviceId: 'toc', quantity: 2, isOptional: false },
        { serviceId: 'nail', quantity: 2, isOptional: true },
        { serviceId: 'lens', quantity: 1, isOptional: true },
      ],
    });
  });

  it('giá: chỉ thêm phiên bản khi giá niêm yết hoặc giá bán đổi; bỏ trống giá bán = không giảm (null)', () => {
    const cur = { listPrice: 3_000_000, salePrice: 2_700_000 };
    expect(buildPriceInput(cur, { listPrice: 3_000_000, salePrice: 2_700_000 })).toBeNull();
    expect(buildPriceInput(cur, { listPrice: 3_000_000, salePrice: null })).toEqual({ listPrice: 3_000_000, salePrice: null });
    expect(buildPriceInput(null, { listPrice: 500_000, salePrice: null })).toEqual({ listPrice: 500_000, salePrice: null });
    expect(buildPriceInput(cur, { listPrice: null, salePrice: null })).toBeNull();
  });

  it('tiền công: chỉ gửi bậc đổi; xoá trắng = null (bỏ mức)', () => {
    expect(buildPayRatesInput(SHEET, { t1: 700_000, t2: null })).toBeNull();
    expect(buildPayRatesInput(SHEET, { t1: null, t2: 80_000 })).toEqual({ rates: [{ tierId: 't1', amount: null }, { tierId: 't2', amount: 80_000 }] });
    expect(buildPayRatesInput(null, { t1: 1 })).toBeNull();
  });

  it('tạo gói: bán kính riêng chỉ gửi khi gói làm tại nhà / nơi khác', () => {
    const f = { ...emptyPackageForm('s1'), code: 'G-1', name: 'Gói', durationMinutes: 60, listPrice: 500_000, depositAmount: 0, locationTypes: ['STUDIO' as const], includedKm: 7 };
    expect(buildPackageCreate(f)).toMatchObject({ code: 'G-1', subjectId: 's1', locationTypes: ['STUDIO'], includedKm: null, items: [], listPrice: 500_000, salePrice: null });
  });

  it('dịch vụ: mã so theo chữ hoa (máy chủ tự đổi)', () => {
    const svc = { id: 'n', kind: 'ADDON' as const, code: 'NAIL', name: 'Làm nail', description: null, durationMinutes: 40, categoryId: null, isActive: true, isPublic: true, sortOrder: 0, createdAt: T, updatedAt: T, category: null, currentPrice: null };
    expect(buildServicePatch(svc, { code: 'nail', name: 'Làm nail', durationMinutes: 40, listPrice: 1, salePrice: null, payRates: {} })).toBeNull();
    expect(buildServicePatch(svc, { code: 'NAIL2', name: 'Nail', durationMinutes: 30, listPrice: 1, salePrice: null, payRates: {} })).toEqual({ code: 'NAIL2', name: 'Nail', durationMinutes: 30 });
  });
});

describe('lỗi máy chủ → ô (bản vẽ mục 5)', () => {
  it('400 có đường dẫn: items.N → dòng đã gồm thứ N, vượt số dòng → nhóm dịch vụ phụ; rates.N → đúng bậc đã gửi', () => {
    const err = apiErr(400, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', {
      issues: [
        { path: 'items.1.quantity', message: 'Số lượng tối đa 100' },
        { path: 'items.3', message: 'Dịch vụ phụ sai' },
        { path: 'name', message: 'Tên không được để trống' },
      ],
    });
    expect(mapSaveError(err, 'package', { includedCount: 2 })).toEqual({
      fields: { 'included.1': 'Số lượng tối đa 100', addons: 'Dịch vụ phụ sai', name: 'Tên không được để trống' },
      banner: null,
    });
    const rateErr = apiErr(400, 'VALIDATION_FAILED', 'x', { issues: [{ path: 'rates.0.amount', message: 'Số tiền không được âm' }] });
    expect(mapSaveError(rateErr, 'payRates', { sentRates: { rates: [{ tierId: 't2', amount: -1 }] } }).fields).toEqual({ 'payRates.t2': 'Số tiền không được âm' });
  });

  it('400 không đường dẫn ở bước giá (giá bán > giá niêm yết) → dưới ô Giá bán; bước khác → dải', () => {
    const err = apiErr(400, 'VALIDATION_FAILED', 'Giá khuyến mại không được lớn hơn giá niêm yết', { listPrice: 1, salePrice: 2 });
    expect(mapSaveError(err, 'price')).toEqual({ fields: { salePrice: 'Giá khuyến mại không được lớn hơn giá niêm yết' }, banner: null });
    expect(mapSaveError(err, 'package')).toEqual({ fields: {}, banner: 'Giá khuyến mại không được lớn hơn giá niêm yết' });
  });

  it('403 → dải "Bạn không có quyền …"; 409 trùng mã → dưới ô Mã; 409 khác → dải lời máy chủ', () => {
    expect(mapSaveError(apiErr(403, 'FORBIDDEN', 'Bạn không có quyền đặt giá'), 'price')).toEqual({ fields: {}, banner: 'Bạn không có quyền đặt giá' });
    expect(mapSaveError(apiErr(403, 'FORBIDDEN', 'Thiếu quyền payroll.write'), 'payRates').banner).toBe('Bạn không có quyền lưu thay đổi này. Thiếu quyền payroll.write');
    expect(mapSaveError(apiErr(409, 'CONFLICT', 'Mã gói đã có trong tổ chức', { fields: ['organization_id', 'code'] }), 'create')).toEqual({
      fields: { code: 'Mã gói đã có trong tổ chức' },
      banner: null,
    });
    expect(mapSaveError(apiErr(409, 'CONFLICT', 'Dữ liệu đã đổi'), 'package')).toEqual({ fields: {}, banner: 'Dữ liệu đã đổi' });
  });

  it('mất mạng → dải lời mất mạng', () => {
    expect(mapSaveError(new ApiError('NETWORK', 'Không kết nối được máy chủ.', 0, null), 'package').banner).toBe('Không kết nối được máy chủ.');
  });
});

describe('phí di chuyển: bán kính + 4 cách tính', () => {
  const policy = {
    defaultMode: 'PER_KM' as const,
    fixedAmount: 150_000,
    perKmAmount: 10_000,
    freeKm: 3,
    minimumAmount: 100_000,
    roundTrip: true,
    tiers: [
      { fromKm: 0, toKm: 10, amount: 100_000 },
      { fromKm: 10, toKm: null, amount: 250_000 },
    ],
    updatedAt: T,
  };

  it('đọc → sửa → gửi đủ 7 trường (kể cả tiers), giữ đúng bậc', () => {
    const f = travelToForm(policy);
    expect(travelDirty(policy, f)).toBe(false);
    const g = { ...f, defaultMode: 'TIERED' as const };
    expect(travelDirty(policy, g)).toBe(true);
    expect(validateTravelForm(g)).toEqual({});
    const body = buildTravelInput(g);
    expect(Object.keys(body).sort()).toEqual(['defaultMode', 'fixedAmount', 'freeKm', 'minimumAmount', 'perKmAmount', 'roundTrip', 'tiers']);
    expect(body.tiers).toEqual(policy.tiers);
  });

  it('chưa có cấu hình (404): ô trống hết và phải nhập đủ, không tự điền', () => {
    const f = travelToForm(null);
    expect(validateTravelForm(f)).toEqual({
      defaultMode: 'Chọn cách tính mặc định.',
      fixedAmount: 'Nhập số tiền (không dùng thì nhập 0).',
      perKmAmount: 'Nhập số tiền (không dùng thì nhập 0).',
      minimumAmount: 'Nhập số tiền (không dùng thì nhập 0).',
      freeKm: 'Nhập bán kính (không miễn phí thì nhập 0).',
    });
  });

  it('theo bậc mà không có bậc → lỗi; bậc thiếu km bắt đầu / tiền, km kết thúc ≤ km bắt đầu → lỗi đúng ô', () => {
    const f = { ...travelToForm(policy), defaultMode: 'TIERED' as const, tiers: [] };
    expect(validateTravelForm(f)).toEqual({ tiers: 'Tính theo bậc thì cần ít nhất một bậc.' });
    const g = { ...travelToForm(policy), tiers: [{ key: 'a', fromKm: null, toKm: 5, amount: null }, { key: 'b', fromKm: 10, toKm: 10, amount: 1 }] };
    expect(validateTravelForm(g)).toEqual({
      'tiers.0.fromKm': 'Nhập km bắt đầu.',
      'tiers.0.amount': 'Nhập số tiền.',
      'tiers.1.toKm': 'Km kết thúc phải lớn hơn km bắt đầu.',
    });
    expect(validateTravelForm({ ...travelToForm(policy), defaultMode: 'FIXED', fixedAmount: 0 })).toEqual({
      fixedAmount: 'Cách tính mặc định là cố định thì mức cố định phải lớn hơn 0.',
    });
  });

  it('máy chủ báo chồng bậc (details.tiers, không đường dẫn) → lỗi dưới nhóm Bậc khoảng cách', () => {
    const err = apiErr(400, 'VALIDATION_FAILED', 'Bậc 0–10 km và bậc 5–∞ km chồng nhau', { tiers: [] });
    expect(mapTravelError(err)).toEqual({ fields: { tiers: 'Bậc 0–10 km và bậc 5–∞ km chồng nhau' }, banner: null });
  });
});

describe('tải đủ trang và đổi thứ tự', () => {
  it('gọi lần lượt tới khi đủ total', async () => {
    const pages: number[] = [];
    const all = await fetchAllPages(async (page, pageSize) => {
      pages.push(page);
      const start = (page - 1) * pageSize;
      return { items: Array.from({ length: Math.min(pageSize, 230 - start) }, (_, i) => start + i), page, pageSize, total: 230 };
    });
    expect(pages).toEqual([1, 2, 3]);
    expect(all).toHaveLength(230);
  });

  it('kéo nhân vật: chỉ PATCH nhân vật có sortOrder đổi', () => {
    const list = [subject('a', 'A', 0), subject('b', 'B', 1), subject('c', 'C', 2), subject('d', 'D', 3)];
    const moved = moveItem(list, 3, 1);
    expect(moved.map((s) => s.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(sortOrderPatches(moved)).toEqual([
      { id: 'd', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
      { id: 'c', sortOrder: 3 },
    ]);
  });
});
