import { describe, expect, it } from 'vitest';
import {
  ALMOST_FULL_RATIO,
  classScheduleLabel,
  minutesToTime,
  seatsLeft,
  seatState,
  timeToMinutes,
  weekdaysLabel,
} from './courses';

describe('seatState — tình trạng chỗ của lớp', () => {
  it('ngưỡng sắp đầy là 0,75', () => {
    expect(ALMOST_FULL_RATIO).toBe(0.75);
  });
  it('biên 0: lớp trống còn chỗ', () => {
    expect(seatState(0, 8)).toBe('AVAILABLE');
    expect(seatState(0, 100)).toBe('AVAILABLE');
  });
  it('74% vẫn còn chỗ', () => {
    expect(seatState(74, 100)).toBe('AVAILABLE');
    expect(seatState(5, 8)).toBe('AVAILABLE'); // 62,5%
    expect(seatState(2, 3)).toBe('AVAILABLE'); // 66,7%
  });
  it('đúng 75% là sắp đầy', () => {
    expect(seatState(75, 100)).toBe('ALMOST_FULL');
    expect(seatState(6, 8)).toBe('ALMOST_FULL');
    expect(seatState(3, 4)).toBe('ALMOST_FULL');
    expect(seatState(99, 100)).toBe('ALMOST_FULL');
  });
  it('100% (và lỡ vượt) là hết chỗ', () => {
    expect(seatState(100, 100)).toBe('FULL');
    expect(seatState(8, 8)).toBe('FULL');
    expect(seatState(1, 1)).toBe('FULL');
    expect(seatState(9, 8)).toBe('FULL');
  });
  it('lớp 1 chỗ còn trống: còn chỗ', () => {
    expect(seatState(0, 1)).toBe('AVAILABLE');
  });
  it('số chỗ còn lại không âm', () => {
    expect(seatsLeft(5, 8)).toBe(3);
    expect(seatsLeft(8, 8)).toBe(0);
    expect(seatsLeft(9, 8)).toBe(0);
  });
});

describe('thứ trong tuần', () => {
  it('sắp theo thứ, CN cuối', () => {
    expect(weekdaysLabel([6, 2, 4])).toBe('T3 · T5 · T7');
    expect(weekdaysLabel([7, 1])).toBe('T2 · CN');
    expect(weekdaysLabel([1, 2, 3, 4, 5, 6, 7])).toBe('T2 · T3 · T4 · T5 · T6 · T7 · CN');
  });
  it('rỗng, ngoài 1..7, số lẻ, trùng → lỗi', () => {
    expect(() => weekdaysLabel([])).toThrow();
    expect(() => weekdaysLabel([0])).toThrow();
    expect(() => weekdaysLabel([8])).toThrow();
    expect(() => weekdaysLabel([1.5])).toThrow();
    expect(() => weekdaysLabel([2, 2])).toThrow();
  });
});

describe('phút ↔ HH:MM', () => {
  it('phút → HH:MM', () => {
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(510)).toBe('08:30');
    expect(minutesToTime(1080)).toBe('18:00');
    expect(minutesToTime(1439)).toBe('23:59');
    expect(minutesToTime(1440)).toBe('24:00');
  });
  it('HH:MM → phút', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('08:30')).toBe(510);
    expect(timeToMinutes('18:00')).toBe(1080);
    expect(timeToMinutes('23:59')).toBe(1439);
    expect(timeToMinutes('24:00')).toBe(1440);
  });
  it('đổi đi đổi lại giữ nguyên mọi phút trong ngày', () => {
    for (let m = 0; m <= 1440; m++) expect(timeToMinutes(minutesToTime(m))).toBe(m);
  });
  it('phút sai → lỗi', () => {
    expect(() => minutesToTime(-1)).toThrow();
    expect(() => minutesToTime(1441)).toThrow();
    expect(() => minutesToTime(10.5)).toThrow();
    expect(() => minutesToTime(Number.NaN)).toThrow();
  });
  it('chuỗi sai dạng → lỗi', () => {
    for (const bad of ['8:30', '08:3', '24:01', '25:00', '12:60', '1800', '18h00', ' 18:00', '18:00 ', '', '-1:00', '24:30']) {
      expect(() => timeToMinutes(bad), bad).toThrow();
    }
  });
  it('lịch học hiển thị', () => {
    expect(classScheduleLabel([2, 4, 6], 1080, 1320)).toBe('T3 · T5 · T7, 18:00–22:00');
    expect(classScheduleLabel([1, 3], null, null)).toBe('T2 · T4');
  });
});
