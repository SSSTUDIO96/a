import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OCCASION_COLORS, SYSTEM_ROLES } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import type { MakeupSubject, OccasionView, PayRateSheet, Service, ServicePackage, SurchargeRuleView } from '../../api/types';
import {
  buildOccasionCreate,
  buildOccasionPatch,
  buildRuleCreate,
  buildRulePatch,
  emptyRuleForm,
  holidayDates,
  mapOccasionError,
  mapRuleError,
  mergeDates,
  OCCASION_COLOR_LABEL,
  occasionToForm,
  occasionUsage,
  ruleToForm,
  sortOccasions,
  summarizeRule,
  validateOccasionForm,
  validateRuleForm,
  wireEnd,
  buildPackageCreate,
  buildPackagePatch,
  buildPayRatesInput,
  buildPriceInput,
  buildServiceCreate,
  buildServicePatch,
  buildTravelInput,
  emptyPackageForm,
  fetchAllPages,
  filterActive,
  formatDuration,
  mapSaveError,
  mapTravelError,
  moveItem,
  packageToForm,
  placeLabel,
  PRICING_GROUPS,
  pricingPerms,
  resolveGroup,
  serviceToForm,
  showDurationField,
  sortOrderPatches,
  splitCards,
  subjectCards,
  travelDirty,
  travelToForm,
  validatePackageForm,
  validateServiceForm,
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
  it('6 nhóm (4 từ nav.ts + Loại sự kiện, Luật phụ phí), chữ ngắn cho nhóm nút chuyển điện thoại', () => {
    expect(PRICING_GROUPS.map((g) => [g.key, g.label, g.short])).toEqual([
      ['goi', 'Gói theo nhân vật', 'Gói'],
      ['dich-vu', 'Dịch vụ phụ & phụ phí', 'Dịch vụ phụ'],
      ['di-chuyen', 'Phí di chuyển & studio', 'Di chuyển'],
      ['nhan-vat', 'Nhân vật', 'Nhân vật'],
      ['su-kien', 'Loại sự kiện', 'Sự kiện'],
      ['luat-phu-phi', 'Luật phụ phí', 'Luật phí'],
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

describe('nhân vật chưa có gói và món ngừng bán', () => {
  it('nhân vật có gói → thẻ; chưa có gói (kể cả "Mọi nhân vật") → gom một dòng cuối', () => {
    const subjects = [subject('s1', 'Cô dâu', 0), subject('s2', 'Chú rể', 1), subject('s3', 'Phù dâu', 2)];
    const { filled, empty } = splitCards(subjectCards(subjects, [pkg({ id: 'a', subjectId: 's1' }), pkg({ id: 'b', subjectId: 's3' })]));
    expect(filled.map((c) => c.name)).toEqual(['Cô dâu', 'Phù dâu']);
    expect(empty.map((c) => c.name)).toEqual(['Chú rể', 'Mọi nhân vật']);
  });

  it('mặc định ẩn món ngừng bán; chip "Cả ngừng bán" hiện lại; ngừng bán gửi PATCH {isActive:false}', () => {
    const list = [pkg({ id: 'a' }), pkg({ id: 'b', isActive: false })];
    expect(filterActive(list, false).map((p) => p.id)).toEqual(['a']);
    expect(filterActive(list, true).map((p) => p.id)).toEqual(['a', 'b']);
    const p = pkg();
    expect(buildPackagePatch(p, { ...packageToForm(p, null), isActive: false })).toEqual({ isActive: false });
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
    expect(buildServicePatch(svc, { kind: 'ADDON', code: 'nail', name: 'Làm nail', isActive: true, durationMinutes: 40, listPrice: 1, salePrice: null, payRates: {} })).toBeNull();
    expect(buildServicePatch(svc, { kind: 'ADDON', code: 'NAIL2', name: 'Nail', isActive: false, durationMinutes: 30, listPrice: 1, salePrice: null, payRates: {} })).toEqual({ code: 'NAIL2', name: 'Nail', isActive: false, durationMinutes: 30 });
  });
});

// Máy chủ commit 74fda02/2f362c9: phụ phí (SURCHARGE) được bỏ trống thời lượng — lưu và trả durationMinutes: null.
describe('thời lượng dịch vụ: phụ phí để trống, MAIN/ADDON bắt buộc', () => {
  const service = (over: Partial<Service>): Service => ({
    id: 's',
    kind: 'SURCHARGE',
    code: 'PP-LE',
    name: 'Phụ phí ngày lễ',
    description: null,
    durationMinutes: null,
    categoryId: null,
    isActive: true,
    isPublic: true,
    sortOrder: 0,
    createdAt: T,
    updatedAt: T,
    category: null,
    currentPrice: { priceVersionId: 'pv', listPrice: 200_000, salePrice: null, unitPrice: 200_000, effectiveFrom: T },
    ...over,
  });

  it('null hiện trống, không phải "0 phút"', () => {
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(30)).toBe('30 phút');
  });

  it('tạo phụ phí: KHÔNG gửi trường durationMinutes (kể cả còn số đã gõ trước khi đổi loại); dịch vụ phụ gửi đủ', () => {
    const f = { ...serviceToForm(null, 'SURCHARGE'), code: 'PP-NG', name: 'Phụ phí ngoài giờ', listPrice: 300_000 };
    expect(validateServiceForm(f)).toEqual({});
    const body = buildServiceCreate(f);
    expect('durationMinutes' in body).toBe(false);
    expect(body).toMatchObject({ kind: 'SURCHARGE', code: 'PP-NG', listPrice: 300_000 });
    expect('durationMinutes' in buildServiceCreate({ ...f, durationMinutes: 45 })).toBe(false);
    expect(buildServiceCreate({ ...f, kind: 'ADDON', durationMinutes: 30 })).toMatchObject({ kind: 'ADDON', durationMinutes: 30 });
  });

  it('MAIN/ADDON thiếu thời lượng → lỗi ô; phụ phí để trống hợp lệ, có số thì vẫn kiểm 1..1440', () => {
    const f = { ...serviceToForm(null, 'MAIN'), code: 'X', name: 'X', listPrice: 1 };
    expect(Object.keys(validateServiceForm(f))).toEqual(['durationMinutes']);
    expect(Object.keys(validateServiceForm({ ...f, kind: 'ADDON' }))).toEqual(['durationMinutes']);
    expect(validateServiceForm({ ...f, kind: 'SURCHARGE' })).toEqual({});
    expect(Object.keys(validateServiceForm({ ...f, kind: 'SURCHARGE', durationMinutes: 0 }))).toEqual(['durationMinutes']);
    expect(() => buildServiceCreate(f)).toThrow();
  });

  it('sửa phụ phí: xoá trống ô → gửi durationMinutes: null; phụ phí cũ mang số phút giả mà không đụng tới → không gửi gì', () => {
    const legacy = service({ durationMinutes: 1 });
    expect(buildServicePatch(legacy, serviceToForm(legacy))).toBeNull();
    expect(buildServicePatch(legacy, { ...serviceToForm(legacy), durationMinutes: null })).toEqual({ durationMinutes: null });
    const clean = service({});
    expect(serviceToForm(clean).durationMinutes).toBeNull();
    expect(buildServicePatch(clean, serviceToForm(clean))).toBeNull();
  });

  it('đổi phụ phí sang MAIN/ADDON: form bắt nhập thời lượng; có số thì gửi kind + durationMinutes; không bao giờ gửi null cho MAIN/ADDON', () => {
    const s = service({});
    const toMain = { ...serviceToForm(s), kind: 'MAIN' as const };
    expect(validateServiceForm(toMain).durationMinutes).toBeTruthy();
    expect(buildServicePatch(s, toMain)).toEqual({ kind: 'MAIN' });
    expect(buildServicePatch(s, { ...toMain, durationMinutes: 60 })).toEqual({ kind: 'MAIN', durationMinutes: 60 });
    const main = service({ kind: 'MAIN', durationMinutes: 30 });
    expect(buildServicePatch(main, { ...serviceToForm(main), durationMinutes: null })).toBeNull();
  });

  it('ô thời lượng: MAIN/ADDON luôn hiện; phụ phí chỉ hiện khi bản lưu còn số phút hoặc ô đang có lỗi', () => {
    expect(showDurationField('MAIN', null)).toBe(true);
    expect(showDurationField('ADDON', null)).toBe(true);
    expect(showDurationField('SURCHARGE', null)).toBe(false);
    expect(showDurationField('SURCHARGE', 1)).toBe(true);
    expect(showDurationField('SURCHARGE', null, 'Lỗi máy chủ')).toBe(true);
  });

  it('400 của máy chủ (details.issues[0].path = durationMinutes) → lời lỗi nằm đúng ô Thời lượng, không thành dải chung', () => {
    const msg = 'Dịch vụ chính và dịch vụ phụ phải có thời lượng (1–1440 phút); chỉ phụ phí được bỏ trống';
    const err = apiErr(400, 'VALIDATION_FAILED', msg, { formErrors: [], fieldErrors: { durationMinutes: [msg] }, issues: [{ path: 'durationMinutes', message: msg }] });
    expect(mapSaveError(err, 'package')).toEqual({ fields: { durationMinutes: msg }, banner: null });
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

// ======================= Bản vẽ D: Loại sự kiện, Luật phụ phí =======================

const occ = (over: Partial<OccasionView> = {}): OccasionView => ({ id: 'o1', name: 'Lễ cưới', color: 'rose', sortOrder: 0, isActive: true, lineCount: 0, createdAt: T, updatedAt: T, ...over });
const ruleView = (over: Partial<SurchargeRuleView> = {}): SurchargeRuleView => ({
  id: 'r1',
  name: 'Ca sớm',
  serviceId: 'sv',
  service: { id: 'sv', name: 'Phụ phí', kind: 'SURCHARGE', isActive: true, currentPrice: 200000 },
  startTime: null,
  endTime: null,
  weekdays: [],
  dates: [],
  occasionIds: [],
  packageIds: [],
  subjectIds: [],
  perQuantity: true,
  note: null,
  sortOrder: 0,
  isActive: true,
  status: 'OK',
  usedLineCount: 0,
  createdAt: T,
  updatedAt: T,
  ...over,
});
const LK = { occasions: [{ id: 'o1', name: 'Lễ cưới' }, { id: 'o2', name: 'Lễ vu quy' }], packages: [{ id: 'p1', name: 'Cô dâu cao cấp' }], subjects: [{ id: 's1', name: 'Cô dâu' }] };

describe('nhóm Bảng giá có thêm Loại sự kiện, Luật phụ phí', () => {
  it('resolveGroup nhận hai nhóm mới, mỗi nhóm đúng một lần, có chữ ngắn cho điện thoại', () => {
    expect(resolveGroup('su-kien')).toBe('su-kien');
    expect(resolveGroup('luat-phu-phi')).toBe('luat-phu-phi');
    expect(resolveGroup('khong-co')).toBe('unknown');
    const keys = PRICING_GROUPS.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(PRICING_GROUPS.find((g) => g.key === 'su-kien')?.label).toBe('Loại sự kiện');
    expect(PRICING_GROUPS.find((g) => g.key === 'luat-phu-phi')?.short).toBe('Luật phí');
  });

  it('sortOrderPatches dùng được cho mọi danh sách có id + sortOrder', () => {
    expect(sortOrderPatches([{ id: 'a', sortOrder: 5 }, { id: 'b', sortOrder: 1 }])).toEqual([{ id: 'a', sortOrder: 0 }]);
  });
});

describe('màu sự kiện', () => {
  it('mỗi trong 12 màu có tên tiếng Việt khác nhau', () => {
    expect(Object.keys(OCCASION_COLOR_LABEL)).toEqual([...OCCASION_COLORS]);
    expect(new Set(Object.values(OCCASION_COLOR_LABEL)).size).toBe(12);
  });

  it('pricing.css có đủ 12 ô màu, cùng giá trị với .ws-sw-* của Lịch', () => {
    const pr = readFileSync(new URL('./pricing.css', import.meta.url), 'utf8');
    const ws = readFileSync(new URL('../schedule/schedule.css', import.meta.url), 'utf8');
    for (const c of OCCASION_COLORS) {
      const mine = new RegExp(`\\.pr-sw--${c} \\{ --c: ([^;]+);`).exec(pr)?.[1];
      const theirs = new RegExp(`\\.ws-sw-${c} \\{ --c: ([^;]+);`).exec(ws)?.[1];
      expect(mine, `pricing.css thiếu màu ${c}`).toBeTruthy();
      expect(mine).toBe(theirs);
    }
  });
});

describe('loại sự kiện: biểu mẫu', () => {
  it('kiểm: tên trống, quá 60 ký tự, chưa chọn màu', () => {
    expect(validateOccasionForm({ name: '  ', color: null })).toEqual({ name: 'Nhập tên loại sự kiện.', color: 'Chọn một màu.' });
    expect(validateOccasionForm({ name: 'x'.repeat(61), color: 'rose' })).toEqual({ name: 'Tên tối đa 60 ký tự.' });
    expect(validateOccasionForm({ name: 'x'.repeat(60), color: 'rose' })).toEqual({});
  });

  it('tạo: cắt khoảng trắng, xếp cuối, đang dùng; thiếu màu thì ném lỗi (không màu mặc định)', () => {
    expect(buildOccasionCreate({ name: ' Tiệc ', color: 'violet' }, 4)).toEqual({ name: 'Tiệc', color: 'violet', sortOrder: 4, isActive: true });
    expect(() => buildOccasionCreate({ name: 'Tiệc', color: null }, 0)).toThrow();
  });

  it('sửa: chỉ trường đổi; không đổi → null', () => {
    const o = occ();
    expect(buildOccasionPatch(o, occasionToForm(o))).toBeNull();
    expect(buildOccasionPatch(o, { name: 'Lễ cưới sáng', color: 'rose' })).toEqual({ name: 'Lễ cưới sáng' });
    expect(buildOccasionPatch(o, { name: 'Lễ cưới', color: 'blue' })).toEqual({ color: 'blue' });
  });

  it('chữ "N dòng hợp đồng đang dùng"; sắp theo sortOrder rồi tên', () => {
    expect(occasionUsage(14)).toBe('14 dòng hợp đồng đang dùng');
    expect(occasionUsage(0)).toBe('Chưa có dòng hợp đồng nào dùng');
    expect(sortOccasions([occ({ id: 'b', name: 'B', sortOrder: 1 }), occ({ id: 'a', name: 'A', sortOrder: 1 }), occ({ id: 'c', name: 'C', sortOrder: 0 })]).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('lỗi máy chủ: trùng tên → ô Tên; Tối đa 50 → dải; lời luôn nguyên văn', () => {
    const dup = apiErr(409, 'CONFLICT', 'Tên loại sự kiện đã có trong tổ chức', { fields: ['name'] });
    expect(mapOccasionError(dup)).toEqual({ fields: { name: 'Tên loại sự kiện đã có trong tổ chức' }, banner: null });
    expect(mapOccasionError(apiErr(409, 'CONFLICT', 'Tối đa 50 loại sự kiện'))).toEqual({ fields: {}, banner: 'Tối đa 50 loại sự kiện' });
  });
});

describe('luật phụ phí: tóm tắt điều kiện', () => {
  it('giờ · sự kiện · gói — đúng chữ bản vẽ', () => {
    const r = ruleView({ startTime: '00:00', endTime: '06:00', occasionIds: ['o1', 'o2'], packageIds: ['p1'] });
    expect(summarizeRule(r, LK)).toBe('Giờ bắt đầu 00:00–06:00 · Lễ cưới, Lễ vu quy · Gói Cô dâu cao cấp');
  });

  it('ngày: thứ HOẶC ngày cụ thể (≤ 3 ngày liệt kê, nhiều hơn thì đếm); nhân vật', () => {
    expect(summarizeRule(ruleView({ weekdays: [7, 6], dates: ['2026-09-02'], subjectIds: ['s1'] }), LK)).toBe('Thứ 7, Chủ nhật hoặc ngày 02/09/2026 · Nhân vật Cô dâu');
    expect(summarizeRule(ruleView({ weekdays: [1, 2, 3] }), LK)).toBe('Thứ 2, 3, 4');
    expect(summarizeRule(ruleView({ dates: ['2026-01-01', '2026-04-30', '2026-05-01', '2026-09-02'] }), LK)).toBe('4 ngày cụ thể');
  });

  it('mã không tra được thì ghi "không rõ", không bỏ im lặng', () => {
    expect(summarizeRule(ruleView({ occasionIds: ['zz'] }), LK)).toBe('Loại sự kiện không rõ');
  });
});

describe('luật phụ phí: giờ kết thúc 24:00 (nửa đêm)', () => {
  it('wireEnd: "Đến" 00:00 với giờ bắt đầu khác 00:00 → 24:00; còn lại giữ nguyên', () => {
    expect(wireEnd('22:00', '00:00')).toBe('24:00');
    expect(wireEnd('00:00', '00:00')).toBe('00:00');
    expect(wireEnd('00:00', '06:00')).toBe('06:00');
    expect(wireEnd('22:00', '02:00')).toBe('02:00');
    expect(wireEnd(null, null)).toBeNull();
  });

  it('ruleToForm hiện 24:00 của máy chủ thành 00:00; gửi lại thành 24:00; không đổi gì thì không PATCH', () => {
    const r = ruleView({ startTime: '22:00', endTime: '24:00', weekdays: [] });
    const f = ruleToForm(r);
    expect(f.endTime).toBe('00:00');
    expect(buildRuleCreate({ ...f, name: 'Đêm', serviceId: 'sv' }, 0)).toMatchObject({ startTime: '22:00', endTime: '24:00' });
    expect(buildRulePatch(r, f)).toBeNull();
  });

  it('00:00–00:00 vẫn là lỗi "phải khác nhau" (không đổi thành cả ngày)', () => {
    const f = { ...emptyRuleForm(), name: 'X', serviceId: 'sv', useTime: true, startTime: '00:00', endTime: '00:00' };
    expect(validateRuleForm(f)).toEqual({ endTime: 'Giờ bắt đầu và kết thúc phải khác nhau.' });
  });
});

describe('luật phụ phí: biểu mẫu', () => {
  it('kiểm: nhóm đã tick mà chưa điền; không tick nhóm nào thì để máy chủ trả lời', () => {
    expect(validateRuleForm(emptyRuleForm())).toEqual({ name: 'Nhập tên luật.', serviceId: 'Chọn phụ phí thu.' });
    const f = { ...emptyRuleForm(), name: 'X', serviceId: 's', useTime: true, useDays: true, useOccasions: true };
    expect(validateRuleForm(f)).toEqual({
      startTime: 'Nhập giờ bắt đầu.',
      endTime: 'Nhập giờ kết thúc.',
      days: 'Chọn ít nhất một thứ hoặc một ngày.',
      occasionIds: 'Chọn ít nhất một loại sự kiện.',
    });
    expect(validateRuleForm({ ...emptyRuleForm(), name: 'X', serviceId: 's' })).toEqual({});
  });

  it('tạo: chỉ gửi nhóm có dữ liệu và đang tick; nhóm bỏ tick coi như rỗng', () => {
    const f = { ...emptyRuleForm(), name: ' Cuối tuần ', serviceId: 's', useDays: true, weekdays: [7, 6], dates: ['2026-09-02'], useOccasions: false, occasionIds: ['o1'], packageIds: ['p1'], perQuantity: false, note: ' ' };
    expect(buildRuleCreate(f, 3)).toEqual({ name: 'Cuối tuần', serviceId: 's', weekdays: [6, 7], dates: ['2026-09-02'], packageIds: ['p1'], perQuantity: false, sortOrder: 3, isActive: true });
    expect(buildRuleCreate(emptyRuleForm().name === '' ? { ...emptyRuleForm(), name: 'N', serviceId: 's' } : emptyRuleForm(), 0)).toEqual({ name: 'N', serviceId: 's', perQuantity: true, sortOrder: 0, isActive: true });
    expect(() => buildRuleCreate(emptyRuleForm(), 0)).toThrow();
  });

  it('sửa: chỉ nhóm đã đổi; bỏ tick giờ → null; mảng gửi cả mảng; so theo tập (thứ tự không tính)', () => {
    const r = ruleView({ startTime: '00:00', endTime: '06:00', weekdays: [6, 7], occasionIds: ['o1', 'o2'], note: 'n' });
    const base = ruleToForm(r);
    expect(buildRulePatch(r, base)).toBeNull();
    expect(buildRulePatch(r, { ...base, weekdays: [7, 6], occasionIds: ['o2', 'o1'] })).toBeNull();
    expect(buildRulePatch(r, { ...base, useTime: false })).toEqual({ startTime: null, endTime: null });
    expect(buildRulePatch(r, { ...base, occasionIds: ['o1'], note: '', isActive: false })).toEqual({ occasionIds: ['o1'], note: null, isActive: false });
    expect(buildRulePatch(r, { ...base, useDays: false })).toEqual({ weekdays: [] });
    expect(buildRulePatch(r, { ...base, serviceId: 'sv2' })).toEqual({ serviceId: 'sv2' });
  });

  it('ngày lễ: 4 ngày dương lịch; gộp bỏ trùng, tăng dần', () => {
    expect(holidayDates(2027)).toEqual(['2027-01-01', '2027-04-30', '2027-05-01', '2027-09-02']);
    expect(() => holidayDates(12)).toThrow();
    expect(mergeDates(['2027-05-01', '2027-01-01'], ['2027-01-01', '2026-12-31'])).toEqual(['2026-12-31', '2027-01-01', '2027-05-01']);
  });
});

describe('luật phụ phí: lỗi máy chủ → ô', () => {
  const validation = (issues: { path: string; message: string }[], details: object = {}) => apiErr(400, 'VALIDATION_FAILED', 'Dữ liệu không hợp lệ', { issues, ...details });
  const NO_TRIGGER = 'Luật phải có ít nhất một điều kiện: khung giờ, ngày hoặc loại sự kiện';

  it('"chưa có điều kiện" (path startTime) khi ô giờ đang ẩn → nhóm Khi nào áp (conditions); ô giờ đang hiện → ô giờ', () => {
    const e = validation([{ path: 'startTime', message: NO_TRIGGER }]);
    expect(mapRuleError(e, emptyRuleForm())).toEqual({ fields: { conditions: NO_TRIGGER }, banner: null });
    expect(mapRuleError(e, { ...emptyRuleForm(), useTime: true })).toEqual({ fields: { startTime: NO_TRIGGER }, banner: null });
  });

  it('weekdays / dates → khoá days; endTime của máy chủ ("nửa đêm ghi 24:00") ở ô giờ khi ô giờ hiện', () => {
    const f = { ...emptyRuleForm(), useTime: true };
    expect(mapRuleError(validation([{ path: 'dates.2', message: 'Ngày theo dạng YYYY-MM-DD' }]), f).fields).toEqual({ days: 'Ngày theo dạng YYYY-MM-DD' });
    expect(mapRuleError(validation([{ path: 'endTime', message: 'Giờ kết thúc từ 00:01 đến 24:00 — nửa đêm ghi 24:00' }]), f).fields).toEqual({ endTime: 'Giờ kết thúc từ 00:01 đến 24:00 — nửa đêm ghi 24:00' });
  });

  it('trùng tên → ô Tên; phụ phí ngừng (details.fields serviceId) → ô Phụ phí; Tối đa 50 luật đang bật, 404, 403 → dải', () => {
    const f = emptyRuleForm();
    expect(mapRuleError(apiErr(409, 'CONFLICT', 'Tên luật đã có trong tổ chức'), f)).toEqual({ fields: { name: 'Tên luật đã có trong tổ chức' }, banner: null });
    const stop = apiErr(400, 'VALIDATION_FAILED', 'Phụ phí "A" đang ngừng hoạt động', { fields: ['serviceId'] });
    expect(mapRuleError(stop, f)).toEqual({ fields: { serviceId: 'Phụ phí "A" đang ngừng hoạt động' }, banner: null });
    expect(mapRuleError(apiErr(409, 'CONFLICT', 'Tối đa 50 luật đang bật'), f).banner).toBe('Tối đa 50 luật đang bật');
    expect(mapRuleError(apiErr(404, 'NOT_FOUND', 'Không tìm thấy loại sự kiện'), f).banner).toBe('Không tìm thấy loại sự kiện');
    expect(mapRuleError(apiErr(403, 'FORBIDDEN', 'Bạn không có quyền đặt giá'), f).banner).toMatch(/Bạn không có quyền/);
  });
});
