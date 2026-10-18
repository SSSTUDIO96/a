import { describe, expect, it } from 'vitest';
import type { ContractDetail, Customer } from '../../api/types';
import {
  appointmentsOf,
  createInput,
  customerPatch,
  dayKeyIn,
  draftOf,
  firstLineName,
  formatPhone,
  formatTimeIn,
  highlightPhone,
  initialsOf,
  phoneQueryDigits,
  prefillFromQuery,
  sortAppointments,
} from './logic';

const T = '2026-08-12T03:00:00.000Z';
const C: Customer = { id: 'k1', fullName: 'Tôn Nữ Phương Thảo', phone: '0912345678', email: 'thao@gmail.com', note: 'Da nhạy cảm', createdAt: T, updatedAt: T };

describe('số điện thoại', () => {
  it('định dạng 0912 345 678; số lạ để nguyên', () => {
    expect(formatPhone('0912345678')).toBe('0912 345 678');
    expect(formatPhone('19001234')).toBe('19001234');
  });

  it('chuỗi tìm: lấy chữ số, +84 → 0, dưới 3 số → null (khớp máy chủ)', () => {
    expect(phoneQueryDigits('0912 34')).toBe('091234');
    expect(phoneQueryDigits('+84 912 345')).toBe('0912345');
    expect(phoneQueryDigits('Mai 09')).toBeNull();
  });

  it('in đậm phần khớp theo vị trí trên số đã định dạng', () => {
    expect(highlightPhone('0912345678', '0912 34')).toEqual([
      { text: '0912 34', match: true },
      { text: '5 678', match: false },
    ]);
    expect(highlightPhone('0912345678', '345')).toEqual([
      { text: '0912 ', match: false },
      { text: '345', match: true },
      { text: ' 678', match: false },
    ]);
    expect(highlightPhone('0912345678', 'Thảo')).toEqual([{ text: '0912 345 678', match: false }]);
    expect(highlightPhone('0912345678', '999')).toEqual([{ text: '0912 345 678', match: false }]);
  });

  it('"Thêm khách "…"": số → ô Số điện thoại, chữ → ô Họ tên', () => {
    expect(prefillFromQuery('0987 1')).toEqual({ fullName: '', phone: '0987 1' });
    expect(prefillFromQuery(' Ngọc ')).toEqual({ fullName: 'Ngọc' });
    expect(prefillFromQuery('')).toEqual({ fullName: '' });
  });

  it('chữ viết tắt như máy chủ làm cho thợ: chữ đầu từ đầu + từ cuối', () => {
    expect(initialsOf('Nguyễn Thị Mai')).toBe('NM');
    expect(initialsOf('Tôn Nữ Hoàng Bảo Ngọc Phương Thảo')).toBe('TT');
    expect(initialsOf('Linh')).toBe('L');
  });
});

describe('sửa / thêm khách: chỉ gửi trường đã đổi, xoá trắng = null', () => {
  it('không đổi gì → rỗng; đổi dấu cách trong số → không gửi', () => {
    expect(customerPatch(C, draftOf(C))).toEqual({});
    expect(customerPatch(C, { ...draftOf(C), phone: '0912 345 678' })).toEqual({});
  });

  it('xoá trắng email + ghi chú → null; đổi tên → tên mới đã cắt khoảng trắng', () => {
    expect(customerPatch(C, { ...draftOf(C), fullName: ' Phương Thảo ', email: '', note: '  ' })).toEqual({ fullName: 'Phương Thảo', email: null, note: null });
  });

  it('thêm mới: bỏ ô trống', () => {
    expect(createInput({ fullName: ' Mai ', phone: '', email: 'mai@x.vn', note: '' })).toEqual({ fullName: 'Mai', email: 'mai@x.vn' });
  });
});

describe('hợp đồng, lịch của khách', () => {
  const line = (id: string, kind: string, name: string, voidedAt: string | null = null) => ({ id, kind, name, voidedAt, addons: [], travel: null });
  const detail = (id: string, code: string, lines: unknown[], appointments: ContractDetail['appointments']) => ({ id, code, lines, appointments }) as unknown as ContractDetail;

  it('tên dòng gói đầu tiên (bỏ dòng đã huỷ)', () => {
    expect(firstLineName(detail('c', 'HD-1', [line('l0', 'CUSTOM', 'Phụ phí'), line('l1', 'PACKAGE', 'Ăn hỏi', T), line('l2', 'PACKAGE', 'Ngày cưới')], []))).toBe('Ngày cưới');
    expect(firstLineName(detail('c', 'HD-1', [], []))).toBeNull();
  });

  it('lịch: tên dòng gắn ca; sắp tới trước (gần nhất trên), rồi đã qua (mới nhất trên)', () => {
    const now = Date.parse('2026-10-18T00:00:00Z');
    const d1 = detail('c1', 'HD-1', [line('l1', 'PACKAGE', 'Ăn hỏi')], [{ id: 'a1', code: 'LH-1', startsAt: '2026-08-14T22:30:00Z', status: 'COMPLETED', contractLineId: 'l1' }]);
    const d2 = detail('c2', 'HD-2', [line('l2', 'PACKAGE', 'Ngày cưới')], [
      { id: 'a3', code: 'LH-3', startsAt: '2026-10-24T00:00:00Z', status: 'CONFIRMED', contractLineId: 'l2' },
      { id: 'a2', code: 'LH-2', startsAt: '2026-10-23T21:30:00Z', status: 'CONFIRMED', contractLineId: null },
      { id: 'a0', code: 'LH-0', startsAt: '2026-09-01T00:00:00Z', status: 'CANCELLED', contractLineId: 'l2' },
    ]);
    const items = sortAppointments(appointmentsOf([d1, d2]), now);
    expect(items.map((a) => a.code)).toEqual(['LH-2', 'LH-3', 'LH-0', 'LH-1']);
    expect(items[1]).toMatchObject({ lineName: 'Ngày cưới', contractCode: 'HD-2', contractId: 'c2' });
    expect(items[0]?.lineName).toBeNull();
  });

  it('giờ, ngày (tham số ?ngay=) theo múi giờ tổ chức', () => {
    expect(formatTimeIn('2026-10-23T21:30:00Z', 'Asia/Ho_Chi_Minh')).toBe('04:30');
    expect(dayKeyIn('2026-10-23T21:30:00Z', 'Asia/Ho_Chi_Minh')).toBe('2026-10-24');
  });
});
