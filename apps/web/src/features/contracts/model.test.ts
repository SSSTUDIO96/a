import { describe, expect, it } from 'vitest';
import { SYSTEM_ROLES, type Permission } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import type { AutoSurchargeReport, AvailabilityShift, StaffMember } from '../../api/types';
import { pickableStaff } from './useStaffAvailability';
import {
  EMPTY_DRAFT,
  appliedEntries,
  autoEndTime,
  autoNotesByDraft,
  buildBody,
  conflictsForLine,
  dateOf,
  draftFromDetail,
  groupTotal,
  legacyAddedCount,
  lineInput,
  overridesFromView,
  placedFromView,
  removedText,
  skippedText,
  surchargeToasts,
  draftIndexesOfLineIds,
  linesWithoutTime,
  noTimeBlockedReason,
  hiddenSubjectOf,
  quotePlan,
  remapLineFields,
  splitPackagesBySubject,
  viewsByDraft,
  draftIndexOfQuoteLine,
  liveErrors,
  missingTimeLabel,
  missingTimeOf,
  staffGapText,
  confirmBlockedReason,
  conflictsOf,
  contractAbilities,
  errorLineOf,
  matchQuote,
  displayWarnings,
  newPackageLine,
  overlapLineCount,
  serverWarnings,
  travelFormula,
  validateDraft,
  zonedIso,
  type ContractDraft,
  type LineWarning,
  type PlacedDraft,
  type StaffWarning,
} from './model';

const TZ = 'Asia/Ho_Chi_Minh';

function pkgLine(over: Partial<PlacedDraft> = {}): PlacedDraft {
  return {
    ...newPackageLine({ id: 'p-cd', name: 'Cô dâu – Ngày cưới', subjectId: 's-cd', locationTypes: [] }, 'st-1', 'PER_KM'),
    ...over,
  };
}

function draftWith(lines: ContractDraft['lines'], over: Partial<ContractDraft> = {}): ContractDraft {
  return {
    ...EMPTY_DRAFT,
    customer: { kind: 'existing', id: 'c-1', fullName: 'Phương Thảo', phone: null, email: null },
    eventDate: '2026-10-24',
    lines,
    ...over,
  };
}

const ctx = (km: number) => ({ includedKmOf: () => km });

const shift = (start: string, end: string, code = 'L-0001'): AvailabilityShift => ({
  appointmentId: `a-${code}`,
  code,
  status: 'CONFIRMED',
  startsAt: start,
  endsAt: end,
  blockStart: start,
  blockEnd: end,
  title: 'Makeup ăn hỏi',
  customerName: 'Vũ Hồng Nhung',
});

describe('dòng phí di chuyển bắt buộc khi làm tại nhà / nơi khác', () => {
  it('tại nhà, Nhập tay chưa có số tiền → lỗi; ghi 0 thì hết lỗi và gửi amount 0', () => {
    const l = pkgLine({ locationType: 'CUSTOMER_HOME', travel: { mode: 'MANUAL', distanceKm: null, amount: null } });
    expect(validateDraft(draftWith([l]), ctx(0))['lines.0.travel.amount']).toBe('Nhập số tiền (miễn phí ghi 0).');
    const ok = { ...l, travel: { mode: 'MANUAL' as const, distanceKm: null, amount: 0 } };
    expect(validateDraft(draftWith([ok]), ctx(0))).toEqual({});
    const body = buildBody(draftWith([ok]), TZ);
    expect(body?.lines[0]).toMatchObject({ locationType: 'CUSTOMER_HOME', travel: { mode: 'MANUAL', amount: 0 } });
  });

  it('nơi khác, Theo km / Theo bậc chưa có km → lỗi', () => {
    for (const mode of ['PER_KM', 'TIERED'] as const) {
      const l = pkgLine({ locationType: 'OTHER', travel: { mode, distanceKm: null, amount: null } });
      expect(validateDraft(draftWith([l]), ctx(0))['lines.0.travel.distanceKm']).toBe('Nhập số km.');
    }
  });

  it('Cố định: có bán kính miễn phí thì phải có km; không có bán kính thì không cần', () => {
    const l = pkgLine({ locationType: 'CUSTOMER_HOME', travel: { mode: 'FIXED', distanceKm: null, amount: null } });
    expect(validateDraft(draftWith([l]), ctx(1.5))['lines.0.travel.distanceKm']).toBe('Nhập số km để xét bán kính miễn phí.');
    expect(validateDraft(draftWith([l]), ctx(0))).toEqual({});
  });

  it('tại nhà LUÔN gửi travel; Cố định/Theo km không gửi amount; studio không gửi travel', () => {
    const home = pkgLine({ locationType: 'CUSTOMER_HOME', address: ' Số 7 ', travel: { mode: 'PER_KM', distanceKm: 12.35, amount: null } });
    const studio = pkgLine({ locationType: 'STUDIO', studioLocationId: 'st-1' });
    const body = buildBody(draftWith([home, studio]), TZ);
    expect(body?.lines[0]).toEqual({
      kind: 'PACKAGE',
      packageId: 'p-cd',
      quantity: 1,
      subjectId: 's-cd',
      locationType: 'CUSTOMER_HOME',
      address: 'Số 7',
      travel: { mode: 'PER_KM', distanceKm: 12.35 },
    });
    expect(body?.lines[1]).not.toHaveProperty('travel');
    expect(body?.lines[1]).toMatchObject({ locationType: 'STUDIO', studioLocationId: 'st-1' });
  });

  it('dòng công thức đọc nguyên số liệu máy chủ (12,35 km → 21,7 km × 10.000 ₫)', () => {
    const text = travelFormula({
      travelMode: 'PER_KM',
      perKmAmount: 10_000,
      travelBreakdown: { includedKm: 1.5, includedFrom: 'ORGANIZATION', excessKm: 10.85, chargedKm: 21.7, roundTrip: true, tier: null },
    } as never);
    expect(text).toBe('Miễn phí 1,5 km · vượt 10,85 km × 2 chiều = 21,7 km × 10.000 ₫');
    expect(travelFormula({ travelMode: 'MANUAL', travelBreakdown: null } as never)).toBeNull();
  });
});

describe('thân gửi máy chủ', () => {
  it('ghép giờ với ngày sự kiện theo múi giờ tổ chức, gửi thợ, dịch vụ phụ theo số người', () => {
    const l = pkgLine({
      start: '04:30',
      end: '07:00',
      quantity: 2,
      addonIds: ['sv-kepmi'],
      staff: [
        { membershipId: 'm1', role: 'PRIMARY' },
        { membershipId: 'm4', role: 'ASSIST' },
      ],
    });
    const body = buildBody(draftWith([l]), TZ);
    expect(body).toMatchObject({ customerId: 'c-1', eventDate: '2026-10-24T00:00:00+07:00', discount: 0 });
    expect(body?.lines[0]).toMatchObject({
      scheduledStart: '2026-10-24T04:30:00+07:00',
      scheduledEnd: '2026-10-24T07:00:00+07:00',
      addons: [{ serviceId: 'sv-kepmi', quantity: 2 }],
      staff: [
        { membershipId: 'm1', role: 'PRIMARY' },
        { membershipId: 'm4', role: 'ASSIST' },
      ],
    });
    expect(zonedIso('2026-10-24', '04:30', 'UTC')).toBe('2026-10-24T04:30:00+00:00');
  });

  it('phụ phí ghi đè giá bắt buộc ghi chú; có ghi chú thì gửi unitPrice + note', () => {
    const s = { key: 'x', kind: 'SURCHARGE' as const, serviceId: 'sv-cs', name: 'Ca sớm', quantity: 1, unitPrice: 150_000, note: ' ' };
    expect(validateDraft(draftWith([s]), ctx(0))['lines.0.note']).toBe('Ghi đè giá phải ghi lý do.');
    const ok = { ...s, note: 'Khách quen' };
    expect(buildBody(draftWith([ok]), TZ)?.lines[0]).toEqual({ kind: 'SURCHARGE', serviceId: 'sv-cs', quantity: 1, unitPrice: 150_000, note: 'Khách quen' });
    expect(buildBody(draftWith([{ ...ok, unitPrice: null, note: '' }]), TZ)?.lines[0]).toEqual({ kind: 'SURCHARGE', serviceId: 'sv-cs', quantity: 1 });
  });

  it('khách mới gửi newCustomer; chưa có khách hoặc chưa có dòng → không gọi máy chủ', () => {
    const l = pkgLine();
    expect(buildBody(draftWith([l], { customer: { kind: 'new', fullName: ' Lan ', phone: '' } }), TZ)).toMatchObject({ newCustomer: { fullName: 'Lan' } });
    expect(buildBody(draftWith([l], { customer: null }), TZ)).toBeNull();
    expect(buildBody(draftWith([]), TZ)).toBeNull();
  });

  it('có thợ mà chưa có giờ → lỗi; giờ kết thúc trước giờ bắt đầu → lỗi', () => {
    const l = pkgLine({ staff: [{ membershipId: 'm1', role: 'PRIMARY' }] });
    expect(validateDraft(draftWith([l]), ctx(0))['lines.0.staff']).toBe('Nhập giờ trước khi chọn thợ.');
    const bad = pkgLine({ start: '07:00', end: '06:00' });
    expect(validateDraft(draftWith([bad]), ctx(0))['lines.0.scheduledEnd']).toBe('Giờ kết thúc phải sau giờ bắt đầu.');
  });

  it('quote lệch dòng (vừa thêm/bỏ dòng) thì không gán số sang dòng khác', () => {
    const d = draftWith([pkgLine(), pkgLine({ refId: 'p-me' })]);
    const q = { lines: [{ kind: 'PACKAGE', packageId: 'p-cd' }], subtotal: 1, total: 1 } as never;
    expect(matchQuote(d, q)).toEqual([null, null]);
  });
});

describe('cảnh báo thợ: đỏ / giữ chỗ nháp / vàng', () => {
  const w = (over: Partial<StaffWarning>): StaffWarning => ({ membershipId: 'm1', level: 'SAME_DAY', overlaps: [], sameDay: [], draftHolds: [], sameContract: [], ...over });
  const hold = (overlaps: boolean) => ({
    contractId: 'khac',
    code: 'HĐ-2026-0139',
    lineId: 'l',
    lineName: 'Cô dâu',
    scheduledStart: '2026-10-23T22:00:00Z',
    scheduledEnd: '2026-10-23T23:00:00Z',
    overlaps,
  });

  it('rảnh: không có dải', () => {
    expect(serverWarnings([])).toEqual([]);
    expect(serverWarnings(undefined)).toEqual([]);
  });

  it('vàng SAME_DAY: có lịch trong ngày, đếm số ca', () => {
    const out = serverWarnings([w({ sameDay: [shift('2026-10-24T03:00:00Z', '2026-10-24T04:00:00Z')] })]);
    expect(out).toMatchObject([{ level: 'SAME_DAY', count: 1 }]);
  });

  it('đỏ OVERLAP: trùng giờ ca đã có; giờ hiện theo múi giờ tổ chức', () => {
    const out = serverWarnings([w({ level: 'OVERLAP', overlaps: [shift('2026-10-23T22:00:00Z', '2026-10-23T23:30:00Z')] })]);
    expect(out[0]?.level).toBe('OVERLAP');
    expect(displayWarnings(out, TZ)[0]?.ranges[0]).toMatchObject({ start: '05:00', end: '06:30' });
  });

  it('T1: chỉ chồng giờ với giữ chỗ của hợp đồng NHÁP khác → DRAFT_HOLD (không đỏ, không chặn), dù máy chủ ghi level OVERLAP', () => {
    const held = serverWarnings([w({ level: 'OVERLAP', draftHolds: [hold(true), hold(true)] })]);
    expect(held[0]).toMatchObject({ level: 'DRAFT_HOLD', holdCodes: ['HĐ-2026-0139'] });
    const map = new Map<string, LineWarning[]>([['k', displayWarnings(held, TZ)]]);
    expect(overlapLineCount(map)).toBe(0);
    expect(confirmBlockedReason(overlapLineCount(map))).toBeNull();
    // Máy chủ mới trả level DRAFT_HOLD; giữ chỗ cùng ngày khác giờ → xám "cùng ngày, khác giờ"; có thêm ca thật cùng ngày → vàng.
    expect(serverWarnings([w({ level: 'DRAFT_HOLD', draftHolds: [hold(true)] })])[0]).toMatchObject({ level: 'DRAFT_HOLD', holdSameDayOnly: false });
    expect(serverWarnings([w({ level: 'DRAFT_HOLD', draftHolds: [hold(false)] })])[0]).toMatchObject({ level: 'DRAFT_HOLD', holdSameDayOnly: true, holdCodes: ['HĐ-2026-0139'] });
    expect(serverWarnings([w({ level: 'SAME_DAY', sameDay: [shift('2026-10-24T03:00:00Z', '2026-10-24T04:00:00Z')], draftHolds: [hold(false)] })])[0]).toMatchObject({ level: 'SAME_DAY', count: 2 });
    // Có cả ca đã chặn giờ trùng → vẫn đỏ.
    const both = serverWarnings([w({ level: 'OVERLAP', overlaps: [shift('2026-10-23T22:00:00Z', '2026-10-23T23:30:00Z')], draftHolds: [hold(true)] })]);
    expect(both[0]?.level).toBe('OVERLAP');
  });

  it('một thợ ở hai dòng chồng giờ (máy chủ báo sameContract) → đỏ, chặn xác nhận, nhãn theo nhân vật của dòng kia', () => {
    const hit = { lineId: null, lineIndex: 0, lineName: 'Cô dâu – Ngày cưới', scheduledStart: '2026-10-23T21:30:00Z', scheduledEnd: '2026-10-24T00:00:00Z' };
    const out = serverWarnings([w({ level: 'OVERLAP', draftHolds: [hold(true)], sameContract: [hit] })], (i, n) => (i === 0 ? 'Cô dâu' : n));
    expect(out[0]?.level).toBe('OVERLAP');
    const shown = displayWarnings(out, TZ);
    expect(shown[0]?.ranges[0]).toMatchObject({ start: '04:30', end: '07:00', label: 'Dòng Cô dâu của hợp đồng này' });
    const map = new Map<string, LineWarning[]>([['a', shown], ['b', []]]);
    expect(overlapLineCount(map)).toBe(1);
    expect(confirmBlockedReason(2)).toBe('Còn 2 dòng thợ trùng giờ. Đổi thợ hoặc đổi giờ trước khi xác nhận.');
  });

  it('xếp: đỏ trước, rồi giữ chỗ nháp, rồi vàng', () => {
    const list: LineWarning[] = [
      { membershipId: 'a', level: 'SAME_DAY', ranges: [], count: 1 },
      { membershipId: 'b', level: 'DRAFT_HOLD', ranges: [], count: 1 },
      { membershipId: 'c', level: 'OVERLAP', ranges: [], count: 0 },
    ];
    expect(displayWarnings(list, TZ).map((x) => x.level)).toEqual(['OVERLAP', 'DRAFT_HOLD', 'SAME_DAY']);
  });
});

describe('quyền → phần nào hiện', () => {
  const as = (perms: readonly Permission[]) => (p: Permission) => perms.includes(p);
  const owner = as(SYSTEM_ROLES.owner.permissions);
  const reception = as(SYSTEM_ROLES.receptionist.permissions);
  const accountant = as(SYSTEM_ROLES.accountant.permissions);

  it('chủ: nháp sửa/xác nhận được; đã xác nhận thì thêm phát sinh, huỷ dòng', () => {
    expect(contractAbilities(owner, null)).toMatchObject({ canEdit: true, canConfirm: true, canVoidLine: false, showCatalog: true, canPickStaff: true });
    expect(contractAbilities(owner, 'CONFIRMED')).toMatchObject({ canEdit: false, canAddExtra: true, canVoidLine: true, canCancel: true });
  });

  it('lễ tân (không có contracts.adjust): đã xác nhận KHÔNG huỷ dòng được, vẫn thêm phát sinh', () => {
    expect(contractAbilities(reception, 'CONFIRMED')).toMatchObject({ canAddExtra: true, canVoidLine: false });
  });

  it('T4: lễ tân KHÔNG huỷ được hợp đồng đã xác nhận (cần contracts.adjust như máy chủ); nháp thì huỷ được', () => {
    expect(contractAbilities(reception, 'CONFIRMED').canCancel).toBe(false);
    expect(contractAbilities(reception, 'DRAFT').canCancel).toBe(true);
    expect(contractAbilities(owner, 'CONFIRMED').canCancel).toBe(true);
  });

  it('kế toán (chỉ contracts.read): chỉ xem', () => {
    const a = contractAbilities(accountant, 'DRAFT');
    expect(a).toMatchObject({ canEdit: false, canConfirm: false, canEditNotes: false, showCatalog: false, canPickStaff: false, canCancel: false });
  });

  it('"Thu tiền": chỉ hợp đồng đã xác nhận và có payments.read', () => {
    expect(contractAbilities(owner, 'CONFIRMED').canCollect).toBe(true);
    expect(contractAbilities(owner, 'DRAFT').canCollect).toBe(false);
    expect(contractAbilities(as(SYSTEM_ROLES.artist.permissions), 'CONFIRMED').canCollect).toBe(false);
  });

  it('hợp đồng đã huỷ / hoàn thành: không làm gì được', () => {
    expect(contractAbilities(owner, 'CANCELLED')).toMatchObject({ canEdit: false, canAddExtra: false, canVoidLine: false, canCancel: false, canEditNotes: false });
  });
});

describe('lỗi máy chủ', () => {
  it('409 trùng giờ: đọc danh sách ca trùng', () => {
    const conflicts = [{ appointmentId: 'a', code: 'L-0123', startsAt: 's', endsAt: 'e', blockStart: 's', blockEnd: 'e', membershipId: 'm', staffName: 'Thu Hà' }];
    expect(conflictsOf(new ApiError('CONFLICT', 'Trùng lịch', 409, 'r', { conflicts }))).toEqual(conflicts);
    expect(conflictsOf(new ApiError('CONFLICT', 'Đã huỷ', 409, 'r'))).toEqual([]);
    expect(conflictsOf(new Error('x'))).toEqual([]);
  });

  it('400 của một dòng: details.line', () => {
    expect(errorLineOf(new ApiError('VALIDATION_FAILED', 'Cần số km', 400, 'r', { line: 2 }))).toBe(2);
    expect(errorLineOf(new ApiError('FORBIDDEN', 'Không có quyền', 403, 'r'))).toBeNull();
  });
});

describe('N9: ô chọn thợ dùng cùng luật với Lịch', () => {
  const av = (membershipId: string) => ({ membershipId, displayName: membershipId, fullName: membershipId, avatarUrl: null, initials: 'X', tier: null, isBookable: true, level: 'FREE' as const, overlaps: [], sameDay: [], draftHolds: [] });
  const mem = (membershipId: string, over: Partial<StaffMember> = {}): StaffMember => ({
    membershipId,
    userId: membershipId,
    fullName: membershipId,
    displayName: membershipId,
    initials: 'X',
    avatarUrl: null,
    phone: null,
    tier: null,
    isBookable: true,
    hasProfile: false,
    status: 'ACTIVE',
    roleKeys: [],
    ...over,
  });

  it('chỉ thợ có hồ sơ / vai trò thợ; chủ, lễ tân, kế toán không hiện — trừ người đã gán sẵn', () => {
    const items = ['ha', 'tu', 'chu', 'letan'].map(av);
    const members = [mem('ha', { hasProfile: true }), mem('tu', { roleKeys: ['assistant'] }), mem('chu', { roleKeys: ['owner'] }), mem('letan', { roleKeys: ['receptionist'] })];
    expect(pickableStaff(items, members, new Set()).map((s) => s.membershipId)).toEqual(['ha', 'tu']);
    expect(pickableStaff(items, members, new Set(['chu'])).map((s) => s.membershipId)).toEqual(['ha', 'tu', 'chu']);
  });

  it('studio một người (không ai là thợ) → mọi người đang nhận lịch; không đọc được danh sách → không lọc', () => {
    const items = ['chu'].map(av);
    expect(pickableStaff(items, [mem('chu', { roleKeys: ['owner'] })], new Set()).map((s) => s.membershipId)).toEqual(['chu']);
    expect(pickableStaff(items, null, new Set())).toEqual(items);
  });
});

describe('N2: dòng chưa có giờ chặn xác nhận hợp đồng dịch vụ', () => {
  const subject = (id: string | null) => (id === 's-cd' ? 'Cô dâu' : null);
  const custom = { key: 'k-x', kind: 'CUSTOM' as const, name: 'Phí gửi xe', unitPrice: 50_000, quantity: 1, note: '' };

  it('kể đúng dòng gói thiếu giờ (vị trí trong nháp, số thứ tự dòng gói); khoản tự đặt tên không tính', () => {
    const d = draftWith([pkgLine({ start: '05:00', end: '07:00' }), custom, pkgLine({ start: '06:00', end: '' }), pkgLine({ subjectId: null })]);
    expect(linesWithoutTime(d, subject)).toEqual([
      { index: 2, label: 'Dòng 2 · Cô dâu · Cô dâu – Ngày cưới' },
      { index: 3, label: 'Dòng 3 · Cô dâu – Ngày cưới' },
    ]);
    expect(noTimeBlockedReason([])).toBeNull();
    expect(noTimeBlockedReason(linesWithoutTime(d, subject))).toBe(
      'Còn 2 dòng chưa có giờ (Dòng 2 · Cô dâu · Cô dâu – Ngày cưới; Dòng 3 · Cô dâu – Ngày cưới). Nhập giờ bắt đầu và giờ kết thúc rồi mới xác nhận được — hợp đồng đã chốt phải có lịch.',
    );
    expect(linesWithoutTime(draftWith([pkgLine({ start: '05:00', end: '07:00' })]), subject)).toEqual([]);
  });

  it('dải vàng chỉ còn phần "chưa có thợ" (chưa có giờ hiện riêng, chặn)', () => {
    expect(staffGapText({ noStaff: 1, noTime: 2 })).toBe('1 dòng chưa có thợ — lịch sẽ nằm ở hàng Chưa có thợ');
    expect(staffGapText({ noStaff: 0, noTime: 2 })).toBeNull();
  });

  it('đọc lỗi máy chủ 409 LINES_MISSING_TIME đúng một hình dạng; lệch chỗ nào → null, không đoán', () => {
    const e = (status: number, details: unknown, code = 'CONFLICT') => new ApiError(code, 'x', status, 'r', details);
    const l1 = { id: 'l1', name: 'Phù dâu', subjectName: null, missing: ['scheduledStart', 'scheduledEnd'] };
    const l2 = { id: 'l2', name: 'Trang điểm', subjectName: 'Mẹ cô dâu', missing: ['scheduledEnd'] };
    const ok = { reason: 'LINES_MISSING_TIME', lineIds: ['l1', 'l2'], lines: [l1, l2] };
    expect(missingTimeOf(e(409, ok))).toEqual({ lineIds: ['l1', 'l2'], lines: [l1, l2] });
    expect(missingTimeLabel(l1 as never)).toBe('Phù dâu: chưa có giờ bắt đầu và giờ kết thúc');
    expect(missingTimeLabel(l2 as never)).toBe('Mẹ cô dâu · Trang điểm: chưa có giờ kết thúc');
    // Sai mã / sai trạng thái / sai reason / thiếu hoặc lệch lineIds, lines → null.
    expect(missingTimeOf(e(400, ok, 'VALIDATION_FAILED'))).toBeNull();
    expect(missingTimeOf(e(409, ok, 'INVALID_STATE'))).toBeNull();
    expect(missingTimeOf(e(409, { ...ok, reason: 'LINES_WITHOUT_TIME' }))).toBeNull();
    expect(missingTimeOf(e(409, { ...ok, lineIds: [] , lines: [] }))).toBeNull();
    expect(missingTimeOf(e(409, { reason: 'LINES_MISSING_TIME', lineIds: ['l1'] }))).toBeNull();
    expect(missingTimeOf(e(409, { reason: 'LINES_MISSING_TIME', lines: [l1] }))).toBeNull();
    expect(missingTimeOf(e(409, { ...ok, lineIds: ['l2', 'l1'] }))).toBeNull();
    expect(missingTimeOf(e(409, { ...ok, lines: [l1, { ...l2, missing: ['startsAt'] }] }))).toBeNull();
    expect(missingTimeOf(e(409, { reason: 'LINES_MISSING_TIME', lineId: 'l1' }))).toBeNull();
    expect(missingTimeOf(e(400, { lineId: 'l1' }, 'VALIDATION_FAILED'))).toBeNull();
    expect(missingTimeOf(new Error('x'))).toBeNull();
  });

  it('mã dòng máy chủ → vị trí trong nháp theo thứ tự dòng gói; không thấy / lệch số dòng → null', () => {
    const saved = [
      { id: 'l1', kind: 'PACKAGE' as const, name: 'Gói A', voidedAt: null },
      { id: 'l2', kind: 'CUSTOM' as const, name: 'Phí xe', voidedAt: null },
      { id: 'l3', kind: 'PACKAGE' as const, name: 'Gói B', voidedAt: null },
    ];
    const d = draftWith([pkgLine(), custom, pkgLine()]);
    expect(draftIndexesOfLineIds(saved, d, ['l3', 'zz'])).toEqual([
      { id: 'l3', index: 2, name: 'Gói B' },
      { id: 'zz', index: null, name: null },
    ]);
    expect(draftIndexesOfLineIds(saved, draftWith([pkgLine()]), ['l1'])).toEqual([{ id: 'l1', index: null, name: 'Gói A' }]);
  });
});

describe('L1: giờ kết thúc tự điền theo thời lượng gói', () => {
  it('ô kết thúc trống → bắt đầu + thời lượng', () => {
    expect(autoEndTime('', '05:00', '', 120)).toBe('07:00');
    expect(autoEndTime('', '05:30', '', 45)).toBe('06:15');
  });
  it('kết thúc vẫn là giờ tự điền → đi theo giờ bắt đầu mới (kể cả giờ đang gõ dở)', () => {
    expect(autoEndTime('05:00', '06:00', '07:00', 120)).toBe('08:00');
    expect(autoEndTime('00:00', '05:00', '02:00', 120)).toBe('07:00');
  });
  it('giờ kết thúc người dùng tự gõ → giữ nguyên', () => {
    expect(autoEndTime('05:00', '06:00', '09:30', 120)).toBe('09:30');
  });
  it('không có thời lượng → không đụng; qua nửa đêm hoặc xoá giờ bắt đầu → để trống', () => {
    expect(autoEndTime('', '05:00', '', null)).toBe('');
    expect(autoEndTime('', '05:00', '', 0)).toBe('');
    expect(autoEndTime('', '23:00', '', 120)).toBe('');
    expect(autoEndTime('05:00', '', '07:00', 120)).toBe('');
    expect(autoEndTime('05:00', '', '09:00', 120)).toBe('09:00');
  });
});

describe('M5 (biên bản nghiệm thu lại): lỗi chỉ về giờ không chặn bảng tính', () => {
  const CUSTOMER = { kind: 'existing' as const, id: 'c', fullName: 'Khách', phone: null, email: null };
  const ctx = { includedKmOf: () => 0 };
  const draftOf = (lines: PlacedDraft[], eventDate = '2026-10-24'): ContractDraft => ({ ...EMPTY_DRAFT, customer: CUSTOMER, eventDate, lines });
  const staff = [{ membershipId: 'm1', role: 'PRIMARY' as const }];

  it('GỐC: một dòng có giờ bắt đầu, giờ kết thúc trống → validateDraft có lỗi (trước đây làm bỏ cả lời gọi quote)', () => {
    const d = draftOf([pkgLine({ start: '05:00', end: '06:00' }), pkgLine({ start: '07:00', end: '', staff })]);
    const e = validateDraft(d, ctx);
    expect(Object.keys(e).sort()).toEqual(['lines.1.scheduledEnd', 'lines.1.staff']);
    const plan = quotePlan(d, e);
    expect(plan.draft).not.toBeNull();
    expect(plan.complete).toBe(true);
    const body = buildBody(plan.draft!, TZ)!;
    expect(body.lines[0]).toHaveProperty('scheduledStart');
    expect(body.lines[1]).not.toHaveProperty('scheduledStart');
    expect(body.lines[1]).not.toHaveProperty('staff');
  });

  it('giờ ngược / chưa có ngày sự kiện: vẫn tính, bỏ giờ và thợ của dòng đó', () => {
    const rev = draftOf([pkgLine({ start: '07:00', end: '06:00', staff })]);
    const p1 = quotePlan(rev, validateDraft(rev, ctx));
    expect(p1.draft?.lines[0]).toMatchObject({ start: '', end: '', staff: [] });
    const noDate = draftOf([pkgLine({ start: '05:00', end: '06:00', staff })], '');
    const p2 = quotePlan(noDate, validateDraft(noDate, ctx));
    expect(p2.draft?.lines[0]).toMatchObject({ start: '', end: '', staff: [] });
  });

  it('lỗi làm đổi tiền (phí di chuyển thiếu số, chưa chọn nơi làm) vẫn chặn bảng tính', () => {
    const d = draftOf([pkgLine({ start: '05:00', end: '06:00' }), pkgLine({ locationType: null })]);
    expect(quotePlan(d, validateDraft(d, ctx)).draft).toBeNull();
  });

  it('lời báo giờ thiếu hiện ngay (liveErrors), không đợi Lưu', () => {
    expect(liveErrors({ 'lines.1.scheduledEnd': 'Nhập đủ giờ bắt đầu và kết thúc.', customerId: 'Chọn khách hàng.' })).toEqual({
      'lines.1.scheduledEnd': 'Nhập đủ giờ bắt đầu và kết thúc.',
    });
  });
});

describe('M1 (biên bản nghiệm thu lại): nhân vật đang ẩn', () => {
  const subjects = [
    { id: 's-me', name: 'Mẹ cô dâu', isActive: false },
    { id: 's-cd', name: 'Cô dâu', isActive: true },
  ];
  const CUSTOMER = { kind: 'existing' as const, id: 'c', fullName: 'Khách', phone: null, email: null };

  it('splitPackagesBySubject: gói của nhân vật đang ẩn tách riêng; gói "mọi nhân vật" vẫn bán', () => {
    const pk = [
      { id: 'a', subjectId: 's-me' },
      { id: 'b', subjectId: 's-cd' },
      { id: 'c', subjectId: null },
      { id: 'd', subjectId: 's-x', subject: { isActive: false } },
    ];
    const r = splitPackagesBySubject(pk, subjects);
    expect(r.shown.map((p) => p.id)).toEqual(['b', 'c']);
    expect(r.hidden.map((p) => p.id)).toEqual(['a', 'd']);
    expect(hiddenSubjectOf('s-me', subjects)?.name).toBe('Mẹ cô dâu');
    expect(hiddenSubjectOf('s-cd', subjects)).toBeNull();
    expect(hiddenSubjectOf(null, subjects)).toBeNull();
  });

  it('dòng của nhân vật đang ẩn: lỗi ở dòng, bỏ khỏi bảng tính (complete=false), vị trí lỗi máy chủ đổi về vị trí nháp', () => {
    const d: ContractDraft = {
      ...EMPTY_DRAFT,
      customer: CUSTOMER,
      lines: [pkgLine({ subjectId: 's-me', name: 'Mẹ' }), pkgLine({ refId: 'p-cd' })],
    };
    const e = validateDraft(d, { includedKmOf: () => 0, hiddenSubjectName: (id) => hiddenSubjectOf(id, subjects)?.name ?? null });
    expect(e['lines.0.subjectId']).toContain('Nhân vật "Mẹ cô dâu" đang ẩn');
    const plan = quotePlan(d, e);
    expect(plan.complete).toBe(false);
    expect(plan.toQuote).toEqual([null, 0]);
    expect(plan.draft?.lines).toHaveLength(1);
    expect(viewsByDraft(plan, ['v-cd'])).toEqual([null, 'v-cd']);
    expect(draftIndexOfQuoteLine(plan, 0)).toBe(1);
    expect(remapLineFields({ 'lines.0.travel.amount': 'x', discount: 'y' }, plan)).toEqual({ 'lines.1.travel.amount': 'x', discount: 'y' });
  });
});


// ---------------------------------------------------------------------------------------------
// Bản vẽ D 3.4 (gói W3): sự kiện, ngày của dòng, phụ phí tự thêm.
const view = (over: Record<string, unknown> = {}) =>
  ({
    id: 'l1', kind: 'PACKAGE', name: 'Phù dâu', serviceId: null, packageId: 'p-pd', priceVersionId: 'pv', subjectId: 's-pd', subjectName: 'Phù dâu',
    locationType: 'STUDIO', studioLocationId: 'st-1', address: null, latitude: null, longitude: null,
    scheduledStart: null, scheduledEnd: null, quantity: 1, unitPrice: 400_000, lineDiscount: 0, lineTotal: 400_000,
    travelMode: null, distanceKm: null, perKmAmount: null, note: null, courseClassId: null,
    occasionId: null, occasionName: null, surchargeRuleId: null, surchargeRuleName: null, dismissedRuleIds: [],
    addedAfterConfirm: false, createdAt: null, voidedAt: null, voidReason: null, staff: [], staffWarnings: [], travelBreakdown: null,
    addons: [], travel: null, surcharges: [],
    ...over,
  }) as never as Parameters<typeof placedFromView>[0];

const sur = (over: Record<string, unknown> = {}) =>
  view({ id: 's1', kind: 'SURCHARGE', name: 'Phụ phí ngoài giờ', serviceId: 'sv-gio', packageId: null, surchargeRuleId: 'r-gio', surchargeRuleName: 'Ngoài giờ', unitPrice: 100_000, lineTotal: 100_000, ...over });

describe('D 3.4: ngày riêng của dòng', () => {
  it('dòng có ngày riêng gửi scheduledStart đúng ngày đó; dòng không có thì theo ngày sự kiện', () => {
    const rieng = pkgLine({ date: '2026-10-19', start: '08:00', end: '09:00' });
    const theo = pkgLine({ start: '08:00', end: '09:00' });
    const body = buildBody(draftWith([rieng, theo], { eventDate: '2026-10-22' }), TZ);
    expect(body?.lines[0]).toMatchObject({ scheduledStart: '2026-10-19T08:00:00+07:00', scheduledEnd: '2026-10-19T09:00:00+07:00' });
    expect(body?.lines[1]).toMatchObject({ scheduledStart: '2026-10-22T08:00:00+07:00' });
  });

  it('đổi ngày sự kiện kéo theo dòng date="" và KHÔNG kéo dòng có ngày riêng', () => {
    const lines = [pkgLine({ date: '2026-10-19', start: '08:00', end: '09:00' }), pkgLine({ start: '08:00', end: '09:00' })];
    const a = buildBody(draftWith(lines, { eventDate: '2026-10-22' }), TZ);
    const b = buildBody(draftWith(lines, { eventDate: '2026-11-05' }), TZ);
    expect(a?.lines[0]).toEqual(b?.lines[0]);
    expect(a?.lines[1]).toMatchObject({ scheduledStart: '2026-10-22T08:00:00+07:00' });
    expect(b?.lines[1]).toMatchObject({ scheduledStart: '2026-11-05T08:00:00+07:00' });
  });

  it('có giờ mà không có ngày nào: không gửi giờ, báo ở ô ngày của dòng, không chặn bảng tính; có ngày riêng thì hết lỗi', () => {
    const l = pkgLine({ start: '08:00', end: '09:00' });
    const d = draftWith([l], { eventDate: '' });
    const errs = validateDraft(d, ctx(0));
    expect(errs['lines.0.date']).toBe('Chọn ngày cho dòng hoặc ngày sự kiện của hợp đồng');
    expect(errs.eventDate).toBeUndefined();
    expect(buildBody(d, TZ)?.lines[0]).not.toHaveProperty('scheduledStart');
    expect(quotePlan(d, errs).draft).not.toBeNull();
    expect(validateDraft(draftWith([{ ...l, date: '2026-10-19' }], { eventDate: '' }), ctx(0))).toEqual({});
  });

  it('thợ trùng giờ chỉ tính khi cùng NGÀY (ngày riêng của dòng)', () => {
    const staff = [{ membershipId: 'm1', role: 'PRIMARY' as const }];
    const a = pkgLine({ key: 'a', start: '08:00', end: '09:00' });
    const sameDay = pkgLine({ key: 'b', start: '08:30', end: '09:30', staff });
    const otherDay = pkgLine({ key: 'c', date: '2026-10-19', start: '08:30', end: '09:30', staff });
    expect(conflictsForLine(draftWith([a, sameDay]), 'a', () => null).get('m1')).toHaveLength(1);
    expect(conflictsForLine(draftWith([a, otherDay]), 'a', () => null).size).toBe(0);
  });

  it('dòng mới thêm từ Bảng giá lấy sự kiện và ngày của dòng đặt chỗ ngay trên', () => {
    const above = pkgLine({ occasionId: 'oc-vq', date: '2026-10-19' });
    const nl = newPackageLine({ id: 'p2', name: 'Mẹ cô dâu', subjectId: null, locationTypes: [] }, 'st-1', 'PER_KM', above);
    expect(nl).toMatchObject({ occasionId: 'oc-vq', date: '2026-10-19' });
    expect(newPackageLine({ id: 'p2', name: 'x', subjectId: null, locationTypes: [] }, null, 'PER_KM')).toMatchObject({ occasionId: null, date: '' });
  });

  it('mở hợp đồng đã lưu: date = ngày của dòng nếu khác ngày sự kiện, bằng thì ""', () => {
    const o = { eventDate: '2026-10-22' };
    expect(placedFromView(view({ scheduledStart: '2026-10-19T01:00:00.000Z', scheduledEnd: '2026-10-19T02:00:00.000Z' }), TZ, o).date).toBe('2026-10-19');
    expect(placedFromView(view({ scheduledStart: '2026-10-22T01:00:00.000Z', scheduledEnd: '2026-10-22T02:00:00.000Z' }), TZ, o).date).toBe('');
    expect(placedFromView(view(), TZ, o).date).toBe('');
    // 23:00 UTC ngày 21 = 06:00 ngày 22 theo giờ tổ chức → trùng ngày sự kiện.
    expect(dateOf('2026-10-21T23:00:00.000Z', TZ)).toBe('2026-10-22');
    expect(placedFromView(view({ scheduledStart: '2026-10-21T23:00:00.000Z', scheduledEnd: '2026-10-22T00:00:00.000Z' }), TZ, o).date).toBe('');
  });
});

describe('D 3.4: sự kiện và phần sửa phụ phí trong thân gửi máy chủ', () => {
  it('gửi occasionId, surchargeOverrides (chỉ phần tử có sửa), dismissedRuleIds khi khác rỗng; rỗng thì không gửi', () => {
    const trong = lineInput(pkgLine(), '', TZ);
    expect(trong).not.toHaveProperty('occasionId');
    expect(trong).not.toHaveProperty('surchargeOverrides');
    expect(trong).not.toHaveProperty('dismissedRuleIds');
    const co = lineInput(
      pkgLine({
        occasionId: 'oc-vq',
        dismissedRuleIds: ['r-le'],
        surchargeOverrides: [
          { ruleId: 'r-gio', quantity: 3, unitPrice: 50_000, note: ' khách quen ' },
          { ruleId: 'r-khong-sua', quantity: null, unitPrice: null, note: '' },
        ],
      }),
      '',
      TZ,
    );
    expect(co).toMatchObject({
      occasionId: 'oc-vq',
      dismissedRuleIds: ['r-le'],
      surchargeOverrides: [{ ruleId: 'r-gio', quantity: 3, unitPrice: 50_000, note: 'khách quen' }],
    });
  });

  it('ghi đè giá bắt buộc ghi chú: thiếu thì lỗi ở đúng phần tử, chặn bảng tính; có thì hết', () => {
    const l = pkgLine({ surchargeOverrides: [{ ruleId: 'r-gio', quantity: null, unitPrice: 50_000, note: '  ' }] });
    const errs = validateDraft(draftWith([l]), ctx(0));
    expect(errs['lines.0.surchargeOverrides.0.note']).toBe('Ghi đè giá phải ghi lý do.');
    expect(quotePlan(draftWith([l]), errs).draft).toBeNull();
    const ok = pkgLine({ surchargeOverrides: [{ ruleId: 'r-gio', quantity: null, unitPrice: 50_000, note: 'khách quen' }] });
    expect(validateDraft(draftWith([ok]), ctx(0))).toEqual({});
  });
});

describe('D 3.4: dòng phụ phí tự thêm không phải dòng gốc', () => {
  const detailOf = (lines: unknown[]) =>
    ({
      id: 'hd', eventDate: '2026-10-21T17:00:00.000Z',
      customer: { id: 'c', fullName: 'A', phone: null, email: null },
      discount: 0, depositRequired: 0, notes: null, lines,
    }) as never as Parameters<typeof draftFromDetail>[0];

  it('mở hợp đồng đã lưu: dòng con có surchargeRuleId không thành SurchargeDraft; phụ phí nhập tay (gốc) vẫn thành', () => {
    const goc = view({ surcharges: [sur()] });
    const tay = view({ id: 'l2', kind: 'SURCHARGE', name: 'Phụ phí tay', serviceId: 'sv-x', packageId: null });
    // Kể cả khi dòng con bị trả phẳng ở mảng gốc (không bao giờ thành dòng gốc nhập tay).
    const phang = sur({ id: 's9' });
    const d = draftFromDetail(detailOf([goc, tay, phang]), TZ);
    expect(d.lines.map((l) => l.kind)).toEqual(['PACKAGE', 'SURCHARGE']);
    expect(d.lines[1]).toMatchObject({ serviceId: 'sv-x' });
  });

  it('cộng dòng = gói + dịch vụ phụ + di chuyển + phụ phí tự thêm CHƯA huỷ — mọi số do máy chủ trả', () => {
    const l = view({ lineTotal: 400_000, addons: [view({ lineTotal: 50_000 })], surcharges: [sur({ lineTotal: 100_000 }), sur({ id: 's2', lineTotal: 70_000, voidedAt: '2026-10-20T00:00:00Z' })] });
    expect(groupTotal(l as never)).toBe(550_000);
  });

  // T1 (biên bản nghiệm thu D): dữ liệu CỐ Ý có thành tiền ≠ đơn giá × số lượng và số người > 1.
  it('cộng dòng lấy đúng lineTotal máy chủ trả, KHÔNG tự nhân đơn giá × số lượng (số người > 1, giá đã giảm / sửa)', () => {
    const l = view({
      quantity: 3, unitPrice: 600_000, lineDiscount: 100_000, lineTotal: 1_700_000, // 600.000 × 3 = 1.800.000 ≠ 1.700.000
      addons: [view({ quantity: 3, unitPrice: 50_000, lineTotal: 120_000 })], // 150.000 ≠ 120.000
      travel: view({ quantity: 2, unitPrice: 40_000, lineTotal: 65_000 }), // 80.000 ≠ 65.000
      surcharges: [
        sur({ quantity: 3, unitPrice: 100_000, lineTotal: 250_000 }), // 300.000 ≠ 250.000
        sur({ id: 's2', quantity: 1, unitPrice: 100_000, lineTotal: 70_000 }), // 100.000 ≠ 70.000
        sur({ id: 's3', quantity: 2, unitPrice: 100_000, lineTotal: 150_000, voidedAt: '2026-10-20T00:00:00Z' }), // đã huỷ → 0
      ],
    });
    expect(groupTotal(l as never)).toBe(1_700_000 + 120_000 + 65_000 + 250_000 + 70_000);
  });

  it('phụ phí tự thêm: chỉ đổi lineTotal (đơn giá và số lượng giữ nguyên) thì "Cộng" đổi đúng bằng mức đổi đó', () => {
    const base = (total: number) => view({ quantity: 3, lineTotal: 1_700_000, surcharges: [sur({ quantity: 3, unitPrice: 100_000, lineTotal: total })] });
    expect(groupTotal(base(250_000) as never)).toBe(1_950_000);
    expect(groupTotal(base(251_000) as never)).toBe(1_951_000);
  });

  it('phần sửa đọc lại từ dòng đã lưu: giá không trỏ phiên bản = ghi đè; số lượng khác mặc định của luật = sửa', () => {
    const pq = (id: string) => (id === 'r-gio' ? true : id === 'r-le' ? false : null);
    const l = view({
      quantity: 2,
      surcharges: [
        sur({ quantity: 2 }), // perQuantity, bằng số lượng dòng → mặc định
        sur({ id: 's2', surchargeRuleId: 'r-le', surchargeRuleName: 'Ngày lễ', quantity: 1 }), // không perQuantity, 1 → mặc định
        sur({ id: 's3', surchargeRuleId: 'r-x', quantity: 2, priceVersionId: null, unitPrice: 30_000, note: 'bạn thân' }), // luật lạ + giá ghi đè
      ],
    });
    expect(overridesFromView(l, pq)).toEqual([{ ruleId: 'r-x', quantity: 2, unitPrice: 30_000, note: 'bạn thân' }]);
    // Số lượng 1 ở luật perQuantity khi dòng có 2 người = đã sửa.
    expect(overridesFromView(view({ quantity: 2, surcharges: [sur({ quantity: 1 })] }), pq)).toEqual([{ ruleId: 'r-gio', quantity: 1, unitPrice: null, note: '' }]);
    // Không biết luật mà dòng nhiều người: GIỮ số đã lưu (không đoán, khỏi đổi tiền).
    expect(overridesFromView(view({ quantity: 2, surcharges: [sur({ quantity: 2 })] }))).toEqual([{ ruleId: 'r-gio', quantity: 2, unitPrice: null, note: '' }]);
  });

  it('mở lại: sự kiện, luật đã bỏ và phần sửa trở về nháp', () => {
    const l = view({ occasionId: 'oc-vq', dismissedRuleIds: ['r-le'], surcharges: [sur({ priceVersionId: null, unitPrice: 20_000, note: 'x' })] });
    const d = draftFromDetail(detailOf([l]), TZ);
    expect(d.lines[0]).toMatchObject({ occasionId: 'oc-vq', dismissedRuleIds: ['r-le'], surchargeOverrides: [{ ruleId: 'r-gio', unitPrice: 20_000, note: 'x' }] });
  });
});

describe('D 3.4: báo của máy chủ', () => {
  it('lý do bỏ qua (skipped) đủ bốn loại, tiếng Việt', () => {
    expect(skippedText({ reason: 'NO_PRICE', ruleName: 'Ngoài giờ' })).toBe('Luật "Ngoài giờ" khớp nhưng phụ phí chưa có giá — chưa thêm.');
    expect(skippedText({ reason: 'SERVICE_UNAVAILABLE', ruleName: 'Ngoài giờ' })).toBe('Luật "Ngoài giờ" khớp nhưng phụ phí đang ngừng — chưa thêm.');
    expect(skippedText({ reason: 'MANUAL_LINE_EXISTS', ruleName: 'Ngoài giờ' })).toMatch(/đã có dòng phụ phí cùng loại nhập tay/);
    expect(skippedText({ reason: 'SAME_SERVICE', ruleName: 'Ngày lễ', by: 'Ngoài giờ' })).toMatch(/luật "Ngoài giờ" đứng trước/);
    expect(removedText({ reason: 'RULE_INACTIVE', ruleName: 'Ngày lễ' })).toMatch(/luật đã tắt/);
  });

  const report = (over: Partial<AutoSurchargeReport> = {}): AutoSurchargeReport => ({ applied: [], removed: [], skipped: [], ...over });
  const applied = (line: number, ruleId = 'r-gio', ruleName = 'Ngoài giờ') => ({ line, ruleId, ruleName, serviceName: 'Phụ phí ngoài giờ', quantity: 1, lineTotal: 100_000, overridden: false });

  it('ghi chú theo vị trí dòng NHÁP (dòng bị bỏ khỏi bảng tính thì lệch vị trí đúng chỗ)', () => {
    const a = pkgLine({ key: 'a', subjectId: 's-hidden' });
    const b = pkgLine({ key: 'b' });
    const d = draftWith([a, b]);
    const plan = quotePlan(d, { 'lines.0.subjectId': 'ẩn' });
    expect(plan.toQuote).toEqual([null, 0]);
    const notes = autoNotesByDraft(plan, report({ skipped: [{ line: 0, ruleId: 'r-le', ruleName: 'Ngày lễ', reason: 'NO_PRICE' }] }));
    expect([...notes.keys()]).toEqual([1]);
    expect(notes.get(1)?.skipped[0]?.ruleName).toBe('Ngày lễ');
  });

  it('thông báo: luật mới vào → "Đã tự thêm …"; luật rơi → "Đã bỏ … vì …"; người lập tự bỏ / bỏ cả dòng / bị bỏ qua thì im', () => {
    const l = pkgLine({ key: 'a', name: 'Phù dâu', subjectId: null });
    const d = draftWith([l]);
    const plan = quotePlan(d, {});
    const none = appliedEntries(d, plan, report(), () => null);
    const one = appliedEntries(d, plan, report({ applied: [applied(0)] }), () => null);
    const base = { lineExists: () => true, dismissed: () => false, report: report() };
    expect(surchargeToasts(none, one, base)).toEqual(['Đã tự thêm Phụ phí ngoài giờ cho dòng Phù dâu theo luật Ngoài giờ']);
    expect(surchargeToasts(one, one, base)).toEqual([]);
    expect(surchargeToasts(one, none, base)).toEqual(['Đã bỏ Phụ phí ngoài giờ ở dòng Phù dâu vì không còn khớp luật']);
    expect(surchargeToasts(one, none, { ...base, report: report({ removed: [{ line: 0, ruleId: 'r-gio', ruleName: 'Ngoài giờ', reason: 'RULE_INACTIVE' }] }) })).toEqual([
      'Đã bỏ Phụ phí ngoài giờ ở dòng Phù dâu vì luật đã tắt',
    ]);
    expect(surchargeToasts(one, none, { ...base, dismissed: () => true })).toEqual([]);
    expect(surchargeToasts(one, none, { ...base, lineExists: () => false })).toEqual([]);
    expect(surchargeToasts(one, none, { ...base, report: report({ skipped: [{ line: 0, ruleId: 'r-gio', ruleName: 'Ngoài giờ', reason: 'NO_PRICE' }] }) })).toEqual([]);
  });

  it('nháp cũ: đếm luật tự thêm mà bản đã lưu chưa có (dải xanh)', () => {
    const l = pkgLine({ key: 'a' });
    const d = draftWith([l]);
    const plan = quotePlan(d, {});
    const next = appliedEntries(d, plan, report({ applied: [applied(0), applied(0, 'r-le', 'Ngày lễ')] }), () => null);
    expect(legacyAddedCount([view()], d, next)).toBe(2);
    expect(legacyAddedCount([view({ surcharges: [sur()] })], d, next)).toBe(1);
    expect(legacyAddedCount([view({ surcharges: [sur(), sur({ id: 's2', surchargeRuleId: 'r-le' })] })], d, next)).toBe(0);
  });
});
