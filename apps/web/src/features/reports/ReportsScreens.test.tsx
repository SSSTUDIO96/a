import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentLedgerEntry, RevenueBasis, RevenueBucket } from '../../api/types';
import { LedgerScreen } from './LedgerScreen';
import { RevenueScreen } from './RevenueScreen';

// Báo cáo › Doanh thu (reports.read), Sổ thu (payments.read) với máy chủ giả lập. Hôm nay = 19/10/2026 giờ Việt Nam.

const ORG = 'org-1';
const BASIS: RevenueBasis = {
  sales: 'Doanh số: tổng tiền các hợp đồng đã xác nhận hoặc hoàn thành có ngày xác nhận trong kỳ',
  depositRequired: 'Cọc phải thu: tổng tiền cọc của chính các hợp đồng đó',
  collected: 'Đã thu thực tế: phiếu thu trừ phiếu hoàn có ngày thu trong kỳ (mọi hợp đồng, kể cả đã huỷ), không tính phiếu đã huỷ',
  outstanding: 'Còn lại: tổng tiền chưa thu của các hợp đồng tính vào doanh số, tính đến hiện tại',
};
const TOTALS: RevenueBucket = {
  contractCount: 14,
  sales: 58_000_000,
  depositRequired: 12_500_000,
  depositOutstanding: 2_000_000,
  outstanding: 33_300_000,
  received: 28_500_000,
  refunded: 300_000,
  collected: 28_200_000,
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
const err = (status: number, code: string, message: string) => json(status, { error: { code, message, requestId: 'r' } });

let calls: string[] = [];

function ledgerItem(over: Partial<PaymentLedgerEntry>): PaymentLedgerEntry {
  return {
    id: 'p1',
    code: 'PT-000091',
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
  };
}

function setupServer(opts: { revenue?: Response; ledger?: (url: string) => Response } = {}) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input));
      calls.push(url);
      if (url.includes('/reports/revenue') && url.includes('groupBy=contract')) {
        return (
          opts.revenue ??
          json(200, {
            from: '',
            to: '',
            groupBy: 'contract',
            basis: BASIS,
            totals: TOTALS,
            rows: [
              { contractId: 'h142', code: 'HD-000142', status: 'CONFIRMED', customer: { id: 'k', fullName: 'Phương Thảo' }, confirmedAt: '2026-10-12T03:00:00Z', eventDate: null, bookedInPeriod: true, total: 5_300_000, depositRequired: 1_000_000, paid: 1_000_000, paidInPeriod: 1_000_000, remaining: 4_300_000, depositOutstanding: 0 },
              { contractId: 'h120', code: 'HD-000120', status: 'CONFIRMED', customer: { id: 'k2', fullName: 'Vũ Thanh Hương' }, confirmedAt: '2026-09-22T03:00:00Z', eventDate: null, bookedInPeriod: false, total: 1_900_000, depositRequired: 500_000, paid: 1_600_000, paidInPeriod: -300_000, remaining: 300_000, depositOutstanding: 0 },
              { contractId: 'h99', code: 'HD-000099', status: 'CANCELLED', customer: { id: 'k3', fullName: 'Lê Bảo Châu' }, confirmedAt: null, eventDate: null, bookedInPeriod: false, total: 1_000_000, depositRequired: 0, paid: 0, paidInPeriod: 0, remaining: null, depositOutstanding: null },
            ],
          })
        );
      }
      if (url.includes('/reports/revenue') && url.includes('groupBy=month')) {
        const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
        return json(200, { from: '', to: '', groupBy: 'month', basis: BASIS, totals: TOTALS, rows: months.map((period, i) => ({ ...TOTALS, period, sales: (48 + i) * 1_000_000, collected: (40 + i) * 1_000_000 })) });
      }
      if (url.includes(`/orgs/${ORG}/payments?`)) {
        return (
          opts.ledger?.(url) ??
          json(200, {
            from: '',
            to: '',
            totals: { received: 28_500_000, receiptCount: 42, refunded: 300_000, refundCount: 1, net: 28_200_000 },
            items: [
              ledgerItem({}),
              ledgerItem({ id: 'p2', code: 'PT-000089', kind: 'REFUND', method: 'BANK_TRANSFER', amount: 300_000 }),
              ledgerItem({ id: 'p3', code: 'PT-000085', voidedAt: '2026-10-11T00:00:00Z', voidReason: 'Ghi nhầm hợp đồng' }),
            ],
            page: 1,
            pageSize: 50,
            total: 3,
          })
        );
      }
      return err(404, 'NOT_FOUND', 'Không có đường API này');
    }),
  );
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/:orgSlug/bao-cao/doanh-thu', element: <RevenueScreen orgId={ORG} orgSlug="hoa-dao" /> },
      { path: '/:orgSlug/bao-cao/so-thu', element: <LedgerScreen orgId={ORG} orgSlug="hoa-dao" /> },
    ],
    { initialEntries: [path] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

const tile = (k: string) => document.querySelector(`[data-so="${k}"]`)?.textContent;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-19T03:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Doanh thu (reports.read)', () => {
  it('tháng này: [from, to) giờ Việt Nam; 4 ô = totals; tooltip = basis máy chủ; biểu đồ 6 tháng tới tháng đang chọn', async () => {
    setupServer();
    renderAt('/hoa-dao/bao-cao/doanh-thu');
    await waitFor(() => expect(tile('sales')).toBe('58.000.000 ₫'));
    expect(tile('depositRequired')).toBe('12.500.000 ₫');
    expect(tile('collected')).toBe('28.200.000 ₫');
    expect(tile('outstanding')).toBe('33.300.000 ₫');
    expect(screen.getByText('14 hợp đồng')).toBeTruthy();
    expect(screen.getByText('còn thiếu 2.000.000 ₫')).toBeTruthy();
    expect(calls.find((u) => u.includes('groupBy=contract'))).toContain('from=2026-10-01T00:00:00+07:00&to=2026-11-01T00:00:00+07:00');
    expect(calls.find((u) => u.includes('groupBy=month'))).toContain('from=2026-05-01T00:00:00+07:00&to=2026-11-01T00:00:00+07:00');
    const tips = [...document.querySelectorAll('.ui-stat')].map((t) => t.querySelector('span[hidden]')?.textContent ?? '');
    expect(tips).toEqual([BASIS.sales, BASIS.depositRequired, BASIS.collected, BASIS.outstanding]);
    // Biểu đồ: 6 nhóm cột, dòng đọc số mặc định là tháng đang chọn.
    expect(await screen.findByText('Tháng 10 · Doanh số 53 tr · Thực thu 45 tr')).toBeTruthy();
    fireEvent.mouseEnter(screen.getByRole('button', { name: /^Tháng 5\/2026/ }));
    expect(screen.getByText('Tháng 5 · Doanh số 48 tr · Thực thu 40 tr')).toBeTruthy();
    expect(document.body.textContent?.toLowerCase()).not.toContain('lợi nhuận');
  });

  it('bảng theo hợp đồng: Kỳ khác, thu trong kỳ âm "−300.000 ₫", hợp đồng đã huỷ Còn lại "—"', async () => {
    setupServer();
    renderAt('/hoa-dao/bao-cao/doanh-thu');
    const row120 = await waitFor(() => {
      const r = document.querySelector('tr[data-hop-dong="HD-000120"]');
      if (!r) throw new Error('chưa có bảng');
      return r as HTMLElement;
    });
    expect(row120.className).toBe('rp-muted');
    expect(within(row120).getByText('Kỳ khác')).toBeTruthy();
    expect(within(row120).getByText('−300.000 ₫')).toBeTruthy();
    const row99 = document.querySelector('tr[data-hop-dong="HD-000099"]') as HTMLElement;
    expect(within(row99).getByText('Đã huỷ')).toBeTruthy();
    expect(row99.lastElementChild?.textContent).toBe('—');
    expect(within(document.querySelector('tr[data-hop-dong="HD-000142"]') as HTMLElement).getByRole('link', { name: 'HD-000142' }).getAttribute('href')).toBe('/hoa-dao/hop-dong/h142');
  });

  it('đổi kỳ sang Quý: gọi lại đúng [from, to), mã kỳ lên đường dẫn', async () => {
    setupServer();
    const { router } = renderAt('/hoa-dao/bao-cao/doanh-thu');
    await waitFor(() => expect(tile('sales')).toBe('58.000.000 ₫'));
    await act(async () => fireEvent.click(screen.getByRole('radio', { name: 'Quý' })));
    await waitFor(() => expect(router.state.location.search).toBe('?ky=2026-Q4'));
    await waitFor(() => expect(calls.filter((u) => u.includes('groupBy=contract')).at(-1)).toContain('from=2026-10-01T00:00:00+07:00&to=2027-01-01T00:00:00+07:00'));
  });

  it('403 (thiếu reports.read) → dải đỏ chữ máy chủ', async () => {
    setupServer({ revenue: err(403, 'FORBIDDEN', 'Bạn không có quyền xem báo cáo doanh thu') });
    renderAt('/hoa-dao/bao-cao/doanh-thu');
    expect((await screen.findByRole('alert')).textContent).toBe('Bạn không có quyền xem báo cáo doanh thu');
  });
});

describe('Sổ thu (payments.read)', () => {
  it('3 ô = totals máy chủ; phiếu hoàn có dấu −, phiếu đã huỷ mờ và gạch ngang; liên kết sang Thu tiền', async () => {
    setupServer();
    renderAt('/hoa-dao/bao-cao/so-thu?ky=2026-10');
    await waitFor(() => expect(tile('received')).toBe('28.500.000 ₫'));
    expect(tile('refunded')).toBe('300.000 ₫');
    expect(tile('net')).toBe('28.200.000 ₫');
    expect(screen.getByText('42 phiếu')).toBeTruthy();
    expect(calls[0]).toContain('from=2026-10-01T00:00:00+07:00&to=2026-11-01T00:00:00+07:00&page=1&pageSize=50');
    const refund = document.querySelector('tr[data-phieu="PT-000089"]') as HTMLElement;
    expect(within(refund).getByText('−300.000 ₫')).toBeTruthy();
    expect(within(refund).getByText('Hoàn')).toBeTruthy();
    const voided = document.querySelector('tr[data-phieu="PT-000085"]') as HTMLElement;
    expect(voided.className).toBe('rp-muted');
    expect(within(voided).getByText('Đã huỷ')).toBeTruthy();
    expect(within(voided).getByText('500.000 ₫').className).toContain('rp-strike');
    expect(within(voided).getByRole('link', { name: 'HD-000149' }).getAttribute('href')).toBe('/hoa-dao/thu-tien/h1');
  });

  it('lọc Cách trả và Loại phiếu → tham số method, kind', async () => {
    setupServer();
    renderAt('/hoa-dao/bao-cao/so-thu');
    await waitFor(() => expect(tile('net')).toBe('28.200.000 ₫'));
    await act(async () => fireEvent.click(within(screen.getByRole('group', { name: 'Cách trả' })).getByRole('button', { name: 'Chuyển khoản' })));
    await act(async () => fireEvent.click(within(screen.getByRole('group', { name: 'Loại phiếu' })).getByRole('button', { name: 'Phiếu hoàn' })));
    await waitFor(() => expect(calls.at(-1)).toContain('method=BANK_TRANSFER&kind=REFUND'));
  });

  it('403 → dải đỏ chữ máy chủ', async () => {
    setupServer({ ledger: () => err(403, 'FORBIDDEN', 'Bạn không có quyền xem sổ thu') });
    renderAt('/hoa-dao/bao-cao/so-thu');
    expect((await screen.findByRole('alert')).textContent).toBe('Bạn không có quyền xem sổ thu');
  });

  it('kỳ sai → 400 máy chủ hiện chữ máy chủ, có nút Thử lại', async () => {
    setupServer({ ledger: () => json(400, { error: { code: 'VALIDATION_FAILED', message: 'Kỳ xem tối đa 366 ngày', requestId: 'r' } }) });
    renderAt('/hoa-dao/bao-cao/so-thu');
    expect(await screen.findByText('Kỳ xem tối đa 366 ngày')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });
});
