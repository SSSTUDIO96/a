import { describe, expect, it } from 'vitest';
import { LAYOUT_DEFAULT_OFF, PRINT_VARIABLES, TOGGLE_BLOCK_KEYS } from '@makeup/shared';
import { tpl } from './fixtures';
import {
  changesPrintContent,
  choiceOf,
  createOf,
  defaultRequiredField,
  defaultText,
  draftOf,
  effectiveBlock,
  isDirty,
  kindsOfChoice,
  lockedKinds,
  newDraft,
  patchOf,
  printedWarning,
  saveLabel,
  setBlock,
  textError,
  usableVariables,
  validateDraft,
  visibleBlocks,
} from './logic';

const base = tpl({ id: 't1', name: 'Hiện đại', layout: 2, version: 3, defaultFor: ['SERVICE'], blocks: { 'ky-nhay': true } });
const saved = draftOf(base);

describe('thân PATCH chỉ có trường đã đổi', () => {
  it('không đổi gì → rỗng, không bẩn', () => {
    expect(patchOf(saved, saved)).toEqual({});
    expect(isDirty(saved, saved)).toBe(false);
  });
  it('đổi tên → chỉ {name}; không đổi nội dung in (không bump)', () => {
    const d = { ...saved, name: '  Tên mới ' };
    expect(patchOf(d, saved)).toEqual({ name: 'Tên mới' });
    expect(changesPrintContent(d, saved)).toBe(false);
    expect(saveLabel(d, saved, 3)).toBe('Lưu');
  });
  it('đổi bố cục → chỉ {layout}; bump v4', () => {
    const d = { ...saved, layout: 4 as const };
    expect(patchOf(d, saved)).toEqual({ layout: 4 });
    expect(saveLabel(d, saved, 3)).toBe('Lưu thành bản v4');
  });
  it('đổi một khối → gửi CẢ bảng công tắc (thay toàn bộ), không trộn', () => {
    const d = setBlock(saved, saved, 'tho', false);
    expect(patchOf(d, saved)).toEqual({ blocks: { 'ky-nhay': true, tho: false } });
  });
  it('chữ rỗng ↔ null; chữ cũ viết lại y hệt (kể cả thừa khoảng trắng) không gửi', () => {
    const withText = draftOf({ ...base, openingText: 'Xin chào {Tên khách}' });
    expect(patchOf({ ...withText, openingText: ' Xin chào {Tên khách} ' }, withText)).toEqual({});
    expect(patchOf({ ...withText, openingText: '   ' }, withText)).toEqual({ openingText: null });
    expect(patchOf({ ...saved, title: 'TIÊU ĐỀ' }, saved)).toEqual({ title: 'TIÊU ĐỀ' });
  });
  it('mặc định, ngừng dùng, loại hợp đồng: gửi đúng trường, không bump', () => {
    const other = draftOf(tpl({ id: 't2', name: 'B', appliesTo: ['SERVICE'], defaultFor: [] }));
    const d = { ...other, defaultFor: ['SERVICE' as const], isActive: false, appliesTo: ['SERVICE' as const, 'COURSE' as const] };
    expect(patchOf(d, other)).toEqual({ appliesTo: ['SERVICE', 'COURSE'], defaultFor: ['SERVICE'], isActive: false });
    expect(changesPrintContent(d, other)).toBe(false);
  });
});

describe('khối bật/tắt: giá trị hiệu lực theo bố cục, bật rồi tắt lại không để khoá thừa', () => {
  it('mặc định tắt của bố cục (quoc-hieu ở bố cục 2) và mặc định bật (bố cục 1)', () => {
    expect(effectiveBlock({ layout: 2, blocks: {} }, 'quoc-hieu')).toBe(false);
    expect(effectiveBlock({ layout: 1, blocks: {} }, 'quoc-hieu')).toBe(true);
    expect(effectiveBlock({ layout: 2, blocks: { 'quoc-hieu': true } }, 'quoc-hieu')).toBe(true);
  });
  it('bật quốc hiệu rồi tắt lại → bảng khối trở về y bản đã lưu, không bẩn, không bump', () => {
    const s = draftOf(tpl({ id: 'x', name: 'X', layout: 2 }));
    const on = setBlock(s, s, 'quoc-hieu', true);
    expect(on.blocks).toEqual({ 'quoc-hieu': true });
    const off = setBlock(on, s, 'quoc-hieu', false);
    expect(off.blocks).toEqual({});
    expect(isDirty(off, s)).toBe(false);
  });
  it('khối bản đã lưu có khoá tường minh thì giữ khoá khi quay về', () => {
    const s = draftOf(tpl({ id: 'x', name: 'X', layout: 2, blocks: { 'ky-nhay': true } }));
    const off = setBlock(s, s, 'ky-nhay', false);
    expect(off.blocks).toEqual({ 'ky-nhay': false });
    expect(setBlock(off, s, 'ky-nhay', true).blocks).toEqual({ 'ky-nhay': true });
  });
  it('mẫu mới (không có bản lưu): bật đúng mặc định thì bỏ khoá', () => {
    const d = newDraft(2, 'SERVICE', 'Hiện đại');
    expect(setBlock(d, null, 'tho', true).blocks).toEqual({});
    expect(setBlock(d, null, 'tho', false).blocks).toEqual({ tho: false });
  });
  it('khối có công tắc theo loại: dịch vụ không có Nội quy; khoá học không có Tên thợ; cả hai có đủ 17', () => {
    expect(visibleBlocks(['SERVICE'])).not.toContain('noi-quy');
    expect(visibleBlocks(['COURSE'])).not.toContain('tho');
    expect(visibleBlocks(['SERVICE', 'COURSE'])).toEqual(TOGGLE_BLOCK_KEYS);
    expect(TOGGLE_BLOCK_KEYS).toHaveLength(17);
    expect(LAYOUT_DEFAULT_OFF[4]).toContain('giay-to');
  });
});

describe('kiểm biến ở máy khách (cùng lời với máy chủ)', () => {
  it('biến lạ: nêu biến và liệt kê biến dùng được cho loại đang chọn', () => {
    const m = textError('Chào {Tên khách} và {Xyz}', ['SERVICE']);
    expect(m).toMatch(/^Không có biến \{Xyz\}\. Biến dùng được: /);
    expect(m).toContain('{Ngày sự kiện}');
    expect(m).not.toContain('{Tên lớp}');
  });
  it('biến sai loại: {Tên lớp} cho mẫu dùng cả hai loại', () => {
    expect(textError('Lớp {Tên lớp}', ['SERVICE', 'COURSE'])).toBe('Biến {Tên lớp} chỉ dùng cho hợp đồng khoá học — mẫu này dùng cho cả hợp đồng dịch vụ');
    expect(textError('Lớp {Tên lớp}', ['COURSE'])).toBeNull();
    expect(textError('Sự kiện {Ngày sự kiện}', ['SERVICE', 'COURSE'])).toBe('Biến {Ngày sự kiện} chỉ dùng cho hợp đồng dịch vụ — mẫu này dùng cho cả hợp đồng khoá học');
  });
  it('chữ rỗng và chữ không biến hợp lệ; biến dùng được = dùng được cho MỌI loại đã chọn', () => {
    expect(textError('', ['SERVICE'])).toBeNull();
    expect(textError('Hai bên thoả thuận', ['SERVICE'])).toBeNull();
    const both = usableVariables(['SERVICE', 'COURSE']);
    expect(both).not.toContain('Tên lớp');
    expect(both).not.toContain('Ngày sự kiện');
    expect(usableVariables(['COURSE'])).toContain('Tên lớp');
    expect(Object.keys(PRINT_VARIABLES)).toHaveLength(17);
  });
  it('validateDraft: tên trống, biến lạ đúng ô, quá dài', () => {
    const d = { ...saved, name: '  ', openingText: 'x {Lạ}', closingText: 'ok', title: 'a'.repeat(161) };
    const e = validateDraft(d);
    expect(e.name).toBe('Tên mẫu không được để trống');
    expect(e.openingText).toMatch(/Không có biến \{Lạ\}/);
    expect(e.closingText).toBeUndefined();
    expect(e.title).toBe('Tối đa 160 ký tự');
  });
  it('chữ mặc định chỉ hiện khi một loại', () => {
    expect(defaultText('title', ['SERVICE'])).toBe('HỢP ĐỒNG DỊCH VỤ TRANG ĐIỂM');
    expect(defaultText('title', ['COURSE'])).toBe('HỢP ĐỒNG ĐÀO TẠO');
    expect(defaultText('title', ['SERVICE', 'COURSE'])).toBeNull();
  });
});

describe('thân POST, nhãn, cảnh báo, khoá', () => {
  it('createOf: không gửi chữ rỗng, bảng khối rỗng, mặc định rỗng', () => {
    expect(createOf(newDraft(2, 'SERVICE', 'Hiện đại'))).toEqual({ name: 'Mẫu Hiện đại', layout: 2, appliesTo: ['SERVICE'] });
    const d = { ...newDraft(1, 'COURSE', 'Cổ điển'), blocks: { tho: false }, title: ' T ', defaultFor: ['COURSE' as const] };
    expect(createOf(d)).toEqual({ name: 'Mẫu Cổ điển', layout: 1, appliesTo: ['COURSE'], blocks: { tho: false }, title: 'T', defaultFor: ['COURSE'] });
  });
  it('nhãn nút lưu: mẫu mới "Tạo mẫu"; chạm nội dung in "Lưu thành bản v{n+1}"; còn lại "Lưu"', () => {
    expect(saveLabel(newDraft(2, 'SERVICE', 'X'), null, null)).toBe('Tạo mẫu');
    expect(saveLabel({ ...saved, closingText: 'Kết' }, saved, 3)).toBe('Lưu thành bản v4');
    expect(saveLabel({ ...saved, isActive: false }, saved, 3)).toBe('Lưu');
  });
  it('dải vàng chỉ khi đã có hợp đồng in bằng mẫu', () => {
    expect(printedWarning(3, 0)).toBeNull();
    expect(printedWarning(3, 46)).toBe('Lưu là tạo bản v4. 46 hợp đồng đã in bằng bản cũ vẫn in lại đúng như cũ; hợp đồng in sau dùng bản mới.');
  });
  it('409 DEFAULT_REQUIRED hiện dưới công tắc nào; loại đang là mặc định bị khoá khỏi "Dùng cho"', () => {
    expect(defaultRequiredField({ isActive: false })).toBe('isActive');
    expect(defaultRequiredField({ appliesTo: ['COURSE'] })).toBe('appliesTo');
    expect(defaultRequiredField({ defaultFor: [] })).toBe('defaultFor');
    expect(lockedKinds(saved)).toEqual(['SERVICE']);
    expect(lockedKinds(null)).toEqual([]);
    expect(choiceOf(['SERVICE', 'COURSE'])).toBe('BOTH');
    expect(choiceOf(['COURSE'])).toBe('COURSE');
    expect(kindsOfChoice('BOTH')).toEqual(['SERVICE', 'COURSE']);
  });
});
