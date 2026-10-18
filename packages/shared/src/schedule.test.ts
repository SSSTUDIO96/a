import { describe, expect, it } from 'vitest';
import {
  STATUS_TRANSITIONS,
  WORK_STATUSES,
  blocksOverlap,
  canTransition,
  computeBlock,
  isBlockingStatus,
  isTerminalStatus,
  normalizeVnPhone,
} from './schedule';

describe('bảng chuyển trạng thái lịch', () => {
  it('cho đi đúng các bước trong bảng', () => {
    expect(canTransition('DRAFT', 'PENDING_CONFIRMATION')).toBe(true);
    expect(canTransition('DRAFT', 'CONFIRMED')).toBe(true);
    expect(canTransition('DRAFT', 'CANCELLED')).toBe(true);
    expect(canTransition('PENDING_CONFIRMATION', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('CONFIRMED', 'NO_SHOW')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });
  it('chặn nhảy cóc và quay lui', () => {
    expect(canTransition('DRAFT', 'COMPLETED')).toBe(false);
    expect(canTransition('DRAFT', 'IN_PROGRESS')).toBe(false);
    expect(canTransition('PENDING_CONFIRMATION', 'NO_SHOW')).toBe(false);
    expect(canTransition('CONFIRMED', 'DRAFT')).toBe(false);
    expect(canTransition('IN_PROGRESS', 'CANCELLED')).toBe(false);
  });
  it('trạng thái cuối không đi đâu được', () => {
    for (const s of ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const) {
      expect(isTerminalStatus(s)).toBe(true);
      for (const to of WORK_STATUSES) expect(canTransition(s, to)).toBe(false);
    }
    expect(isTerminalStatus('CONFIRMED')).toBe(false);
  });
  it('bảng chỉ trỏ tới trạng thái có thật và không tự chuyển về chính nó', () => {
    for (const [from, tos] of Object.entries(STATUS_TRANSITIONS)) {
      for (const to of tos) {
        expect(WORK_STATUSES).toContain(to);
        expect(to).not.toBe(from);
      }
    }
  });
});

describe('khoảng bận', () => {
  it('nháp, huỷ, khách không đến thì không chiếm giờ', () => {
    expect(isBlockingStatus('DRAFT')).toBe(false);
    expect(isBlockingStatus('CANCELLED')).toBe(false);
    expect(isBlockingStatus('NO_SHOW')).toBe(false);
    expect(isBlockingStatus('PENDING_CONFIRMATION')).toBe(true);
    expect(isBlockingStatus('CONFIRMED')).toBe(true);
    expect(isBlockingStatus('IN_PROGRESS')).toBe(true);
    expect(isBlockingStatus('COMPLETED')).toBe(true);
  });
  it('cộng thời gian di chuyển trước và sau', () => {
    const b = computeBlock({
      startsAt: new Date('2030-05-01T01:00:00Z'),
      endsAt: new Date('2030-05-01T03:00:00Z'),
      travelBeforeMin: 30,
      travelAfterMin: 60,
    });
    expect(b.blockStart.toISOString()).toBe('2030-05-01T00:30:00.000Z');
    expect(b.blockEnd.toISOString()).toBe('2030-05-01T04:00:00.000Z');
  });
  it('khoảng nửa mở: nối đuôi không tính là trùng', () => {
    const a = { blockStart: new Date('2030-05-01T01:00:00Z'), blockEnd: new Date('2030-05-01T03:00:00Z') };
    const touch = { blockStart: new Date('2030-05-01T03:00:00Z'), blockEnd: new Date('2030-05-01T04:00:00Z') };
    const cross = { blockStart: new Date('2030-05-01T02:59:00Z'), blockEnd: new Date('2030-05-01T04:00:00Z') };
    expect(blocksOverlap(a, touch)).toBe(false);
    expect(blocksOverlap(a, cross)).toBe(true);
    expect(blocksOverlap(cross, a)).toBe(true);
  });
});

describe('chuẩn hoá số điện thoại Việt Nam', () => {
  it('đưa về dạng 0xxxxxxxxx', () => {
    expect(normalizeVnPhone('+84 912 345 678')).toBe('0912345678');
    expect(normalizeVnPhone('0912 345 678')).toBe('0912345678');
    expect(normalizeVnPhone('0912.345.678')).toBe('0912345678');
    expect(normalizeVnPhone('84912345678')).toBe('0912345678');
    expect(normalizeVnPhone('+84-38-123-4567')).toBe('0381234567');
    expect(normalizeVnPhone('(028) 3822 1234')).toBe('02838221234');
  });
  it('sai định dạng trả null, không đoán', () => {
    expect(normalizeVnPhone('')).toBeNull();
    expect(normalizeVnPhone('091234567')).toBeNull();
    expect(normalizeVnPhone('09123456789')).toBeNull();
    expect(normalizeVnPhone('0112345678')).toBeNull();
    expect(normalizeVnPhone('+1 415 555 0100')).toBeNull();
    expect(normalizeVnPhone('0912abc678')).toBeNull();
  });
});
