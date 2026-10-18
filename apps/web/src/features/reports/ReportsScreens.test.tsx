import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentLedgerEntry, RevenueBasis, RevenueBucket, RevenueContractRow } from '../../api/types';
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

// Máy chủ (payments/reports.ts presentBucket, routes.ts sổ thu): ô tiền vượt ngưỡng số nguyên an toàn → null + totalsOverflow.
describe('tổng tràn (null) → "—"', () => {
  it('báo cáo: ô tổng null hiện "—", dòng hợp đồng tràn hiện "—", có dải cảnh báo', async () => {
    const totals: RevenueBucket = { ...TOTALS, sales: null, outstanding: null };
    const row: RevenueContractRow = {
      contractId: 'h7', code: 'HD-000007', kind: 'SERVICE', status: 'CONFIRMED', customer: { id: 'k7', fullName: 'Đỗ Ngọc Hà' }, courses: [],
      confirmedAt: '2026-10-12T03:00:00Z', eventDate: null, bookedInPeriod: true,
      total: null, depositRequired: null, paid: 1_000_000, paidInPeriod: null, remaining: null, depositOutstanding: null,
    };
    setupServer({ revenue: json(200, { from: '', to: '', kind: null, groupBy: 'contract', basis: BASIS, totals, totalsOverflow: true, rows: [row] }) });
    renderAt('/hoa-dao/bao-cao/doanh-thu');
    await waitFor(() => expect(tile('sales')).toBe('—'));
    expect(tile('outstanding')).toBe('—');
    expect(tile('collected')).toBe('28.200.000 ₫');
    expect(screen.getByText('Có tổng quá lớn để hiện đúng (ô hiện "—"). Kiểm lại các phiếu có số tiền bất thường trong Sổ thu.')).toBeTruthy();
    const tr = await waitFor(() => {
      const r = document.querySelector('tr[data-hop-dong="HD-000007"]');
      if (!r) throw new Error('chưa có bảng');
      return r as HTMLElement;
    });
    const cell = (l: string) => tr.querySelector(`td[data-l="${l}"]`)?.textContent;
    expect([cell('Tổng'), cell('Cọc'), cell('Đã thu'), cell('Thu trong kỳ'), cell('Còn lại')]).toEqual(['—', '—', '1.000.000 ₫', '—', '—']);
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('sổ thu: tổng null hiện "—", số phiếu vẫn hiện, có dải cảnh báo', async () => {
    setupServer({
      ledger: () =>
        json(200, { from: '', to: '', totals: { received: null, receiptCount: 3, refunded: 300_000, refundCount: 1, net: null }, totalsOverflow: true, items: [ledgerItem({})], page: 1, pageSize: 50, total: 1 }),
    });
    renderAt('/hoa-dao/bao-cao/so-thu?ky=2026-10');
    await waitFor(() => expect(tile('received')).toBe('—'));
    expect(tile('net')).toBe('—');
    expect(tile('refunded')).toBe('300.000 ₫');
    expect(screen.getByText('3 phiếu')).toBeTruthy();
    expect(screen.getByText('Có tổng quá lớn để hiện đúng (ô hiện "—"). Kiểm lại các phiếu có số tiền bất thường trong bảng dưới.')).toBeTruthy();
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

describe('Doanh thu — tổ chức đào tạo: lọc loại hợp đồng, nhóm theo nhóm khoá / khoá', () => {
  const COURSE_TOTALS: RevenueBucket = {
    contractCount: 2,
    sales: 29_000_000,
    depositRequired: 8_000_000,
    depositOutstanding: 3_000_000,
    outstanding: 21_000_000,
    received: 8_000_000,
    refunded: 0,
    collected: 8_000_000,
  };
  const ALLOCATION = 'Hợp đồng khoá học có nhiều khoá: mọi số tiền của hợp đồng chia cho các khoá theo thành tiền…';
  function setupAcademy() {
    calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = decodeURIComponent(String(input));
        calls.push(url);
        const course = url.includes('kind=COURSE');
        const totals = course ? COURSE_TOTALS : TOTALS;
        if (url.includes('groupBy=contract')) {
          return json(200, {
            from: '', to: '', kind: course ? 'COURSE' : null, groupBy: 'contract', basis: BASIS, totals, totalsOverflow: false,
            rows: course
              ? [{ contractId: 'kh57', code: 'HĐKH-2026-0057', kind: 'COURSE', status: 'CONFIRMED', customer: { id: 'k', fullName: 'Phương Thảo' }, courses: [{ id: 'c1', code: 'MCP-01', name: 'Makeup chuyên nghiệp', groupId: 'g1' }], confirmedAt: '2026-10-12T03:00:00Z', eventDate: null, bookedInPeriod: true, total: 17_000_000, depositRequired: 5_000_000, paid: 5_000_000, paidInPeriod: 5_000_000, remaining: 12_000_000, depositOutstanding: 0 }]
              : [],
          });
        }
        if (url.includes('groupBy=course') || url.includes('groupBy=courseGroup')) {
          const byCourse = url.includes('groupBy=course&') || url.endsWith('groupBy=course');
          return json(200, {
            from: '', to: '', kind: 'COURSE', groupBy: byCourse ? 'course' : 'courseGroup', basis: BASIS, totals: COURSE_TOTALS, totalsOverflow: false, allocation: ALLOCATION,
            rows: [
              { segment: 'COURSE', group: { id: 'g1', name: 'Makeup chuyên nghiệp' }, ...(byCourse ? { course: { id: 'c1', code: 'MCP-01', name: 'Makeup chuyên nghiệp' } } : {}), ...COURSE_TOTALS, contractCount: 1, sales: 17_000_000, depositRequired: 5_000_000, collected: 5_000_000, outstanding: 12_000_000 },
              { segment: 'COURSE', group: { id: 'g2', name: 'Nâng cao' }, ...(byCourse ? { course: { id: 'c2', code: 'NC-01', name: 'Makeup cô dâu chuyên sâu' } } : {}), ...COURSE_TOTALS, contractCount: 1, sales: 12_000_000, depositRequired: 3_000_000, collected: 3_000_000, outstanding: 9_000_000 },
            ],
          });
        }
        if (url.includes('groupBy=month')) {
          const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
          return json(200, { from: '', to: '', kind: null, groupBy: 'month', basis: BASIS, totals, totalsOverflow: false, rows: months.map((period) => ({ ...totals, period })) });
        }
        return err(404, 'NOT_FOUND', 'Không có đường API này');
      }),
    );
  }
  function renderAcademy(path: string) {
    const router = createMemoryRouter([{ path: '/:orgSlug/bao-cao/doanh-thu', element: <RevenueScreen orgId={ORG} orgSlug="hv" academy /> }], { initialEntries: [path] });
    return { router, ...render(<RouterProvider router={router} />) };
  }

  it('chip Khoá học → gửi kind=COURSE (bảng hợp đồng + biểu đồ); 4 ô = totals máy chủ; bảng hợp đồng khoá học có Cọc, Đã thu, Còn lại', async () => {
    setupAcademy();
    const { router } = renderAcademy('/hv/bao-cao/doanh-thu');
    const chips = await screen.findByRole('group', { name: 'Loại hợp đồng' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tất cả', 'Dịch vụ', 'Khoá học']);
    await waitFor(() => expect(tile('sales')).toBe('58.000.000 ₫'));
    expect(calls.some((u) => u.includes('kind='))).toBe(false);
    fireEvent.click(within(chips).getByRole('button', { name: 'Khoá học' }));
    await waitFor(() => expect(tile('sales')).toBe('29.000.000 ₫'));
    expect(tile('depositRequired')).toBe('8.000.000 ₫');
    expect(tile('collected')).toBe('8.000.000 ₫');
    expect(tile('outstanding')).toBe('21.000.000 ₫');
    expect(router.state.location.search).toContain('loai=khoa-hoc');
    expect(calls.some((u) => u.includes('kind=COURSE') && u.includes('groupBy=contract'))).toBe(true);
    expect(calls.some((u) => u.includes('kind=COURSE') && u.includes('groupBy=month'))).toBe(true);
    const table = screen.getByRole('region', { name: 'Theo hợp đồng khoá học' });
    const heads = [...table.querySelectorAll('th')].map((t) => t.textContent);
    expect(heads).toEqual(expect.arrayContaining(['Cọc', 'Đã thu', 'Còn lại']));
    expect([...table.querySelectorAll('th.rp-t-hide')].map((t) => t.textContent)).not.toContain('Cọc');
    expect(within(table).getByText('Makeup chuyên nghiệp')).toBeTruthy();
    expect(document.body.textContent?.toLowerCase()).not.toContain('lợi nhuận');
  });

  it('nhóm theo Khoá / Nhóm khoá → groupBy=course|courseGroup; dòng Tổng = 4 ô', async () => {
    setupAcademy();
    renderAcademy('/hv/bao-cao/doanh-thu?loai=khoa-hoc');
    const seg = await screen.findByRole('radiogroup', { name: 'Nhóm theo' });
    fireEvent.click(within(seg).getByRole('radio', { name: 'Khoá' }));
    const table = await screen.findByRole('region', { name: 'Theo khoá' });
    expect(calls.some((u) => u.includes('kind=COURSE') && u.includes('groupBy=course') && !u.includes('groupBy=courseGroup'))).toBe(true);
    expect(within(table).getByText('Makeup cô dâu chuyên sâu')).toBeTruthy();
    const total = table.querySelector('.rp-total-row') as HTMLElement;
    expect([...total.querySelectorAll('td')].map((t) => t.textContent)).toEqual(['Tổng', '2', '29.000.000 ₫', '8.000.000 ₫', '8.000.000 ₫', '21.000.000 ₫']);
    fireEvent.click(within(seg).getByRole('radio', { name: 'Nhóm khoá' }));
    const groups = await screen.findByRole('region', { name: 'Theo nhóm khoá' });
    expect(within(groups).getByText('Nâng cao')).toBeTruthy();
    expect(calls.some((u) => u.includes('groupBy=courseGroup'))).toBe(true);
  });

  it('tổ chức không đào tạo: không có chip loại, không gửi kind', async () => {
    setupServer();
    renderAt('/hoa-dao/bao-cao/doanh-thu?loai=khoa-hoc');
    await waitFor(() => expect(tile('sales')).toBe('58.000.000 ₫'));
    expect(screen.queryByRole('group', { name: 'Loại hợp đồng' })).toBeNull();
    expect(calls.some((u) => u.includes('kind='))).toBe(false);
  });
});
