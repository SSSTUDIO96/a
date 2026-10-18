import { describe, expect, it } from 'vitest';
import type { PaymentLedgerEntry } from '../../api/types';
import { ledgerCsv } from './csv';
import { convertPeriod, monthPeriod, parsePeriod, periodOptions, quarterPeriod, sixMonthsTo, yearPeriod } from './period';
import { axisMax } from './RevenueChart';

describe('kỳ báo cáo [from, to) giờ Việt Nam', () => {
  it('tháng, quý, năm: to = đầu kỳ sau', () => {
    expect(monthPeriod(2026, 12)).toMatchObject({ key: '2026-12', label: 'Tháng 12/2026', from: '2026-12-01T00:00:00+07:00', to: '2027-01-01T00:00:00+07:00' });
    expect(quarterPeriod(2026, 4)).toMatchObject({ key: '2026-Q4', label: 'Quý 4/2026', from: '2026-10-01T00:00:00+07:00', to: '2027-01-01T00:00:00+07:00' });
    expect(yearPeriod(2026)).toMatchObject({ key: '2026', label: 'Năm 2026', from: '2026-01-01T00:00:00+07:00', to: '2027-01-01T00:00:00+07:00' });
  });
  it('đọc mã kỳ trên đường dẫn; sai dạng → null (không đoán)', () => {
    expect(parsePeriod('2026-10')?.label).toBe('Tháng 10/2026');
    expect(parsePeriod('2026-Q2')?.from).toBe('2026-04-01T00:00:00+07:00');
    expect(parsePeriod('2025')?.to).toBe('2026-01-01T00:00:00+07:00');
    expect(parsePeriod('2026-13')).toBeNull();
    expect(parsePeriod('10/2026')).toBeNull();
    expect(parsePeriod(null)).toBeNull();
  });
  it('danh sách kỳ mới nhất trước, tính theo giờ Việt Nam', () => {
    const now = new Date('2026-12-31T18:00:00Z'); // 01:00 ngày 01/01/2027 ở Việt Nam
    expect(periodOptions('month', now).slice(0, 2).map((p) => p.key)).toEqual(['2027-01', '2026-12']);
    expect(periodOptions('quarter', now).slice(0, 2).map((p) => p.key)).toEqual(['2027-Q1', '2026-Q4']);
    expect(periodOptions('year', now)[0]?.key).toBe('2027');
  });
  it('đổi loại kỳ giữ tháng cuối; biểu đồ 6 tháng tính tới tháng cuối của kỳ', () => {
    expect(convertPeriod(monthPeriod(2026, 11), 'quarter').key).toBe('2026-Q4');
    expect(convertPeriod(quarterPeriod(2026, 4), 'month').key).toBe('2026-12');
    expect(sixMonthsTo(monthPeriod(2026, 3))).toEqual({ from: '2025-10-01T00:00:00+07:00', to: '2026-04-01T00:00:00+07:00' });
  });
});

describe('trục biểu đồ', () => {
  it('4 vạch đều, bước tròn theo triệu', () => {
    expect(axisMax(58_000_000)).toEqual({ max: 80_000_000, step: 20_000_000 });
    expect(axisMax(0)).toEqual({ max: 4_000_000, step: 1_000_000 });
    expect(axisMax(5_300_000)).toEqual({ max: 8_000_000, step: 2_000_000 });
  });
});

describe('CSV sổ thu', () => {
  const p = (over: Partial<PaymentLedgerEntry>): PaymentLedgerEntry => ({
    id: 'p1',
    code: 'PT-000001',
    contractId: 'h1',
    kind: 'RECEIPT',
    method: 'CASH',
    amount: 500_000,
    receivedAt: '2026-10-18T03:00:00.000Z',
    note: null,
    voidedAt: null,
    voidReason: null,
    createdAt: '2026-10-18T03:00:00.000Z',
    createdBy: { id: 'u1', fullName: 'Lương Hà My' },
    contract: { id: 'h1', code: 'HD-000149', customer: { id: 'k1', fullName: 'Nguyễn Thị Mai' } },
    ...over,
  });
  it('có BOM, phiếu hoàn mang số âm, phiếu huỷ ghi trạng thái và lý do, chống công thức và dấu phẩy', () => {
    const csv = ledgerCsv([
      p({}),
      p({ code: 'PT-000002', kind: 'REFUND', method: 'BANK_TRANSFER', amount: 300_000, note: 'Bớt 1, phù dâu' }),
      p({ code: 'PT-000003', voidedAt: '2026-10-19T00:00:00Z', voidReason: '=Ghi nhầm' }),
    ]);
    expect(csv.startsWith('﻿Ngày thu,Mã phiếu,')).toBe(true);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[1]).toBe('18/10/2026,PT-000001,Phiếu thu,Hiệu lực,,HD-000149,Nguyễn Thị Mai,Tiền mặt,500000,,Lương Hà My');
    expect(lines[2]).toBe('18/10/2026,PT-000002,Phiếu hoàn tiền,Hiệu lực,,HD-000149,Nguyễn Thị Mai,Chuyển khoản,-300000,"Bớt 1, phù dâu",Lương Hà My');
    expect(lines[3]).toContain("Đã huỷ,'=Ghi nhầm,");
  });
});
