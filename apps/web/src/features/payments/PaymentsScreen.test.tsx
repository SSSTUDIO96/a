import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContractPayments, ContractSummary, Payment, PaymentSummary } from '../../api/types';
import { PaymentsScreen } from './PaymentsScreen';

// Màn Thu tiền chạy thật (router, src/api/payments.ts, src/api/contracts.ts) với máy chủ giả lập qua fetch.
// Hôm nay = 19/10/2026 (giờ Việt Nam). Số trên màn phải là số máy chủ trả (summary), không tự cộng.

const ORG = 'org-1';
const HD = 'hd-142';

const SUM: PaymentSummary = { total: 5_300_000, depositRequired: 1_000_000, received: 0, refunded: 0, paid: 0, remaining: 5_300_000, overpaid: 0, depositOutstanding: 1_000_000 };

function pay(over: Partial<Payment>): Payment {
  return {
    id: 'p-1',
    code: 'PT-000087',
    contractId: HD,
    kind: 'RECEIPT',
    method: 'BANK_TRANSFER',
    amount: 1_000_000,
    receivedAt: '2026-10-12T03:00:00.000Z',
    note: 'CK Vietcombank',
    voidedAt: null,
    voidReason: null,
    createdAt: '2026-10-12T03:00:00.000Z',
    createdBy: { id: 'u-1', fullName: 'Lương Hà My' },
    ...over,
  };
}

function progress(over: Partial<ContractPayments> = {}): ContractPayments {
  return {
    contract: {
      id: HD,
      code: 'HD-000142',
      status: 'CONFIRMED',
      eventDate: '2026-10-24T01:00:00.000Z',
      confirmedAt: '2026-10-12T03:00:00.000Z',
      customer: { id: 'k-1', fullName: 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', phone: '0912345678', phoneHidden: false },
    },
    summary: SUM,
    installments: [],
    installmentsTotal: 0,
    scheduleDifference: null,
    payments: [],
    ...over,
  };
}

const LIST_ITEM: ContractSummary = {
  id: HD,
  code: 'HD-000142',
  kind: 'SERVICE',
  status: 'CONFIRMED',
  eventDate: '2026-10-24T01:00:00.000Z',
  subtotal: 5_300_000,
  discount: 0,
  total: 5_300_000,
  depositRequired: 1_000_000,
  confirmedAt: '2026-10-12T03:00:00.000Z',
  createdAt: '2026-10-12T03:00:00.000Z',
  customer: { id: 'k-1', fullName: 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', phone: '0912345678' },
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
const err = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details, requestId: 'r' } });

interface Call {
  method: string;
  url: string;
  body: unknown;
  headers: Record<string, string>;
}
let calls: Call[] = [];
type Handler = (c: Call) => Response | Promise<Response> | undefined;

function setupServer(opts: { progress?: () => ContractPayments | Response; handlers?: Handler[] } = {}) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const c: Call = {
        url: String(input),
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        headers: { ...(init?.headers as Record<string, string>) },
      };
      calls.push(c);
      for (const h of opts.handlers ?? []) {
        const r = await h(c);
        if (r) return r;
      }
      if (c.method === 'GET' && c.url.includes(`/orgs/${ORG}/contracts?`)) {
        const week = decodeURIComponent(c.url).includes('eventTo=2026-10-26T23:59:59.999+07:00') && c.url.includes('eventFrom');
        return json(200, { items: week ? [LIST_ITEM] : [], page: 1, pageSize: 50, total: week ? 1 : 0 });
      }
      if (c.method === 'GET' && c.url.endsWith(`/contracts/${HD}/payments`)) {
        const p = opts.progress?.() ?? progress();
        return p instanceof Response ? p : json(200, p);
      }
      return err(404, 'NOT_FOUND', 'Không có đường API này');
    }),
  );
}

const FULL = { write: true, void: true, contractsRead: true };

function renderAt(path: string, access = FULL) {
  const router = createMemoryRouter(
    [
      { path: '/:orgSlug/thu-tien', element: <PaymentsScreen orgId={ORG} orgSlug="hoa-dao" contractId={null} access={access} /> },
      { path: '/:orgSlug/thu-tien/:id', element: <PaymentsScreen orgId={ORG} orgSlug="hoa-dao" contractId={HD} access={access} /> },
      { path: '/:orgSlug/hop-dong/:id', element: <p>Trang hợp đồng</p> },
    ],
    { initialEntries: [path] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

const tile = (k: string) => document.querySelector(`[data-so="${k}"]`)?.textContent;
const posts = (suffix: string) => calls.filter((c) => c.method === 'POST' && c.url.endsWith(suffix));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-19T03:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('bố cục và số liệu', () => {
  it('/thu-tien: nhóm theo ngày sự kiện (3 lần gọi /contracts, giờ Việt Nam), mở sẵn hợp đồng đầu danh sách; 4 ô số = summary', async () => {
    setupServer({ progress: () => progress({ summary: { ...SUM, received: 1_000_000, paid: 1_000_000, remaining: 4_300_000, depositOutstanding: 0 } }) });
    renderAt('/hoa-dao/thu-tien');
    expect((await screen.findByRole('heading', { name: /^Sự kiện 7 ngày tới/ })).textContent).toBe('Sự kiện 7 ngày tới1');
    const lists = calls.filter((c) => c.url.includes('/contracts?')).map((c) => decodeURIComponent(c.url));
    expect(lists).toHaveLength(3);
    expect(lists[0]).toContain('status=CONFIRMED&pageSize=50&eventFrom=2026-10-19T00:00:00+07:00&eventTo=2026-10-26T23:59:59.999+07:00');
    expect(lists[1]).toContain('eventFrom=2026-10-27T00:00:00+07:00');
    expect(lists[2]).toContain('eventTo=2026-10-18T23:59:59.999+07:00');
    // Nhóm rỗng thì ẩn.
    expect(screen.queryByRole('heading', { name: /^Sự kiện sau đó/ })).toBeNull();
    await waitFor(() => expect(tile('total')).toBe('5.300.000 ₫'));
    expect(tile('depositRequired')).toBe('1.000.000 ₫');
    expect(tile('paid')).toBe('1.000.000 ₫');
    expect(tile('remaining')).toBe('4.300.000 ₫');
    expect(screen.getByRole('link', { name: 'Mở hợp đồng' }).getAttribute('href')).toBe(`/hoa-dao/hop-dong/${HD}`);
    expect(document.body.textContent?.toLowerCase()).not.toContain('lợi nhuận');
  });

  it('khách trả thừa: ô Còn lại 0 ₫ kèm "Khách trả thừa"; cọc còn thiếu ghi dưới ô Cọc', async () => {
    setupServer({
      progress: () =>
        progress({ summary: { ...SUM, received: 5_500_000, paid: 5_500_000, remaining: -200_000, overpaid: 200_000, depositOutstanding: 0 } }),
    });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    await waitFor(() => expect(tile('remaining')).toBe('0 ₫'));
    expect(screen.getByText('Khách trả thừa 200.000 ₫')).toBeTruthy();
  });

  it('404 → "Không tìm thấy hợp đồng" + Về danh sách; 403 → dải không có quyền', async () => {
    setupServer({ progress: () => err(404, 'NOT_FOUND', 'Không tìm thấy hợp đồng') });
    const first = renderAt(`/hoa-dao/thu-tien/${HD}`);
    expect(await screen.findByText('Không tìm thấy hợp đồng')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Về danh sách' }).getAttribute('href')).toBe('/hoa-dao/thu-tien');
    first.unmount();
    setupServer({ progress: () => err(403, 'FORBIDDEN', 'Bạn không có quyền xem thu tiền') });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    expect((await screen.findByRole('alert')).textContent).toBe('Bạn không có quyền xem thu tiền');
  });
});

describe('quyền payments.read / write / void', () => {
  const data = () =>
    progress({
      summary: { ...SUM, received: 1_000_000, paid: 1_000_000, remaining: 4_300_000, depositOutstanding: 0 },
      payments: [pay({})],
      installments: [
        { id: 'i1', name: 'Đặt cọc', dueDate: '2026-10-12T16:59:59.000Z', amount: 1_000_000, isDeposit: true, sortOrder: 0, paidAmount: 1_000_000, outstanding: 0, status: 'PAID' },
        { id: 'i2', name: 'Thanh toán còn lại', dueDate: '2026-10-24T16:59:59.000Z', amount: 4_300_000, isDeposit: false, sortOrder: 1, paidAmount: 0, outstanding: 4_300_000, status: 'DUE' },
      ],
      installmentsTotal: 5_300_000,
      scheduleDifference: 0,
    });

  it('chỉ payments.read: xem được, không có thẻ ghi phiếu, không Sửa tiến độ, không Huỷ phiếu', async () => {
    setupServer({ progress: data });
    renderAt(`/hoa-dao/thu-tien/${HD}`, { write: false, void: false, contractsRead: true });
    expect(await screen.findByText('Thanh toán còn lại')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ghi phiếu thu' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sửa tiến độ' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Huỷ phiếu/ })).toBeNull();
  });

  it('payments.write không void (lễ tân): có Ghi phiếu thu, không có "Hoàn tiền", không có Huỷ phiếu', async () => {
    setupServer({ progress: data });
    renderAt(`/hoa-dao/thu-tien/${HD}`, { write: true, void: false, contractsRead: true });
    expect(await screen.findByRole('heading', { name: 'Ghi phiếu thu' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sửa tiến độ' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Hoàn tiền' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Huỷ phiếu/ })).toBeNull();
  });

  it('đủ quyền: có Loại phiếu Thu · Hoàn tiền và Huỷ phiếu; trạng thái đợt theo nhãn tiếng Việt', async () => {
    setupServer({ progress: data });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    expect(await screen.findByRole('radio', { name: 'Hoàn tiền' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Huỷ phiếu PT-000087' })).toBeTruthy();
    const items = within(screen.getByRole('list', { name: 'Các đợt thanh toán' })).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Đặt cọcHạn 12/10/20261.000.000 ₫Đã thu đủ',
      'Thanh toán còn lạiHạn 24/10/20264.300.000 ₫Chưa đến hạn',
    ]);
    // Số điền sẵn = phần còn thiếu của đợt chưa đủ sớm nhất.
    expect((screen.getByLabelText(/Số tiền/) as HTMLInputElement).value).toBe('4.300.000 ₫');
  });

  it('không có contracts.read: cột trái báo không có quyền, vẫn mở được /thu-tien/:id', async () => {
    setupServer({ progress: data });
    renderAt(`/hoa-dao/thu-tien/${HD}`, { write: true, void: true, contractsRead: false });
    expect(screen.getByText('Bạn không có quyền xem danh sách hợp đồng')).toBeTruthy();
    await waitFor(() => expect(tile('total')).toBe('5.300.000 ₫'));
    expect(calls.some((c) => c.url.includes('/contracts?'))).toBe(false);
  });
});

describe('lập tiến độ', () => {
  it('hợp lệ: gợi ý "Cọc + còn lại vào ngày sự kiện" → PUT đúng thân (hạn = hết ngày, giờ Việt Nam), thay tiến độ bằng phản hồi', async () => {
    let saved = progress();
    setupServer({
      progress: () => saved,
      handlers: [
        (c) => {
          if (c.method !== 'PUT') return undefined;
          saved = progress({
            installments: [
              { id: 'i1', name: 'Đặt cọc', dueDate: '2026-10-19T16:59:59.000Z', amount: 1_000_000, isDeposit: true, sortOrder: 0, paidAmount: 0, outstanding: 1_000_000, status: 'DUE' },
              { id: 'i2', name: 'Thanh toán còn lại', dueDate: '2026-10-24T16:59:59.000Z', amount: 4_300_000, isDeposit: false, sortOrder: 1, paidAmount: 0, outstanding: 4_300_000, status: 'DUE' },
            ],
            installmentsTotal: 5_300_000,
            scheduleDifference: 0,
          });
          return json(200, saved);
        },
      ],
    });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    expect(await screen.findByText('Chưa lập tiến độ thanh toán. Hợp đồng vẫn ghi phiếu thu được.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lập tiến độ' }));
    const dlg = screen.getByRole('dialog', { name: 'Tiến độ thanh toán' });
    expect(within(dlg).getByText('HD-000142 · Tổng 5.300.000 ₫ · Cọc phải thu 1.000.000 ₫')).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cọc + còn lại vào ngày sự kiện' }));
    expect((within(dlg).getByLabelText('Số tiền đợt 2') as HTMLInputElement).value).toBe('4.300.000 ₫');
    await act(async () => fireEvent.click(within(dlg).getByRole('button', { name: 'Lưu tiến độ' })));
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toBe(`/api/v1/orgs/${ORG}/contracts/${HD}/installments`);
    expect(put?.body).toEqual({
      installments: [
        { name: 'Đặt cọc', dueDate: '2026-10-19T23:59:59+07:00', amount: 1_000_000, isDeposit: true },
        { name: 'Thanh toán còn lại', dueDate: '2026-10-24T23:59:59+07:00', amount: 4_300_000, isDeposit: false },
      ],
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Đã lưu tiến độ thanh toán.')).toBeTruthy();
    expect(screen.getAllByRole('listitem').some((li) => li.textContent?.startsWith('Thanh toán còn lại'))).toBe(true);
  });

  it('không hợp lệ: lệch tổng → dải đỏ đúng câu checkInstallmentPlan, nút Lưu khoá, không gửi PUT', async () => {
    setupServer();
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Lập tiến độ' }));
    const dlg = screen.getByRole('dialog', { name: 'Tiến độ thanh toán' });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cọc + còn lại vào ngày sự kiện' }));
    const amount2 = within(dlg).getByLabelText('Số tiền đợt 2');
    fireEvent.focus(amount2);
    fireEvent.change(amount2, { target: { value: '4.150.000' } });
    fireEvent.blur(amount2);
    expect(within(dlg).getAllByRole('alert').map((a) => a.textContent)).toContain(
      'Tổng các đợt (5.150.000 ₫) phải bằng tổng hợp đồng (5.300.000 ₫): còn thiếu 150.000 ₫',
    );
    expect((within(dlg).getByRole('button', { name: 'Lưu tiến độ' }) as HTMLButtonElement).disabled).toBe(true);
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('máy chủ trả 400/409 → dải đỏ đúng chữ máy chủ, hộp vẫn mở', async () => {
    setupServer({ handlers: [(c) => (c.method === 'PUT' ? err(409, 'CONFLICT', 'Hợp đồng đã huỷ — không lập tiến độ thanh toán được') : undefined)] });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Lập tiến độ' }));
    const dlg = screen.getByRole('dialog', { name: 'Tiến độ thanh toán' });
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cọc + 2 đợt' }));
    await act(async () => fireEvent.click(within(dlg).getByRole('button', { name: 'Lưu tiến độ' })));
    expect(await within(dlg).findByText('Hợp đồng đã huỷ — không lập tiến độ thanh toán được')).toBeTruthy();
  });
});

describe('gợi ý tiến độ chia đều tới ngày sự kiện (biên bản cuối T1)', () => {
  const putBody = () => calls.find((c) => c.method === 'PUT')?.body as { installments: { name: string; dueDate: string; amount: number }[] } | undefined;
  const echoPut: Handler = (c) => (c.method === 'PUT' ? json(200, progress()) : undefined);

  it('Cọc + 2 đợt: đợt cuối đúng ngày sự kiện 24/10, không đợt nào sau ngày sự kiện; tiền vẫn chia như cũ', async () => {
    setupServer({ handlers: [echoPut] });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Lập tiến độ' }));
    const dlg = screen.getByRole('dialog', { name: 'Tiến độ thanh toán' });
    expect(within(dlg).getByText('Các đợt chia đều từ hôm nay tới ngày sự kiện 24/10/2026; không đợt nào hạn sau ngày đó.')).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cọc + 2 đợt' }));
    await act(async () => fireEvent.click(within(dlg).getByRole('button', { name: 'Lưu tiến độ' })));
    expect(putBody()?.installments).toEqual([
      { name: 'Đặt cọc', dueDate: '2026-10-19T23:59:59+07:00', amount: 1_000_000, isDeposit: true },
      { name: 'Đợt 1', dueDate: '2026-10-22T23:59:59+07:00', amount: 2_150_000, isDeposit: false },
      { name: 'Đợt 2', dueDate: '2026-10-24T23:59:59+07:00', amount: 2_150_000, isDeposit: false },
    ]);
    // Hợp đồng có ngày sự kiện: không cần hỏi thêm hợp đồng / lớp.
    expect(calls.some((c) => c.url.endsWith(`/contracts/${HD}`) || c.url.includes('/classes'))).toBe(false);
  });

  it('ngày sự kiện quá gần (còn 2 ngày): Cọc + 3 đợt tắt và nói rõ vì sao; Cọc + 2 đợt vẫn dùng được', async () => {
    const near = progress();
    near.contract.eventDate = '2026-10-21T01:00:00.000Z';
    setupServer({ progress: () => near });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Lập tiến độ' }));
    const dlg = screen.getByRole('dialog', { name: 'Tiến độ thanh toán' });
    expect((within(dlg).getByRole('button', { name: 'Cọc + 3 đợt' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(dlg).getByRole('button', { name: 'Cọc + 2 đợt' }) as HTMLButtonElement).disabled).toBe(false);
    expect(
      within(dlg).getByText(
        'Còn 2 ngày tới ngày sự kiện (21/10/2026): không đủ chỗ cho 3 đợt cách nhau ít nhất 1 ngày mà không đợt nào hạn sau ngày sự kiện. Chia ít đợt hơn hoặc sửa tay hạn từng đợt.',
      ),
    ).toBeTruthy();
  });

  it('ngày sự kiện đã qua: giữ 30 ngày một đợt kể từ hôm nay và ghi rõ', async () => {
    const past = progress();
    past.contract.eventDate = '2026-10-10T01:00:00.000Z';
    setupServer({ progress: () => past, handlers: [echoPut] });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Lập tiến độ' }));
    const dlg = screen.getByRole('dialog', { name: 'Tiến độ thanh toán' });
    expect(within(dlg).getByText('Ngày sự kiện (10/10/2026) đã qua — gợi ý chia 30 ngày một đợt kể từ hôm nay.')).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cọc + 2 đợt' }));
    await act(async () => fireEvent.click(within(dlg).getByRole('button', { name: 'Lưu tiến độ' })));
    expect(putBody()?.installments.map((i) => i.dueDate)).toEqual(['2026-10-19T23:59:59+07:00', '2026-11-18T23:59:59+07:00', '2026-12-18T23:59:59+07:00']);
  });
});

describe('ghi phiếu thu / hoàn / thu vượt', () => {
  it('ghi phiếu thu: POST đúng thân + Idempotency-Key; 4 ô thay bằng summary trả về; số điền sẵn lấy lại từ máy chủ', async () => {
    let paid = false;
    const after: PaymentSummary = { ...SUM, received: 1_000_000, paid: 1_000_000, remaining: 4_300_000, depositOutstanding: 0 };
    setupServer({
      progress: () => (paid ? progress({ summary: after, payments: [pay({ id: 'p-9', code: 'PT-000009' })] }) : progress()),
      handlers: [
        (c) => {
          if (c.method !== 'POST') return undefined;
          paid = true;
          return json(201, { ...pay({ id: 'p-9', code: 'PT-000009' }), contract: { id: HD, code: 'HD-000142', status: 'CONFIRMED' }, summary: after });
        },
      ],
    });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    const amount = (await screen.findByLabelText(/Số tiền/)) as HTMLInputElement;
    expect(amount.value).toBe('5.300.000 ₫');
    fireEvent.focus(amount);
    fireEvent.change(amount, { target: { value: '1.000.000' } });
    fireEvent.blur(amount);
    // Thiếu cách trả → báo dưới ô, không gửi.
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phiếu thu' }));
    expect(screen.getByText('Chọn cách trả.')).toBeTruthy();
    expect(posts('/payments')).toHaveLength(0);
    fireEvent.click(screen.getByRole('radio', { name: 'Chuyển khoản' }));
    fireEvent.change(screen.getByLabelText('Ghi chú'), { target: { value: 'CK Vietcombank' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lưu phiếu thu' })));
    const post = posts(`/contracts/${HD}/payments`)[0];
    expect(post?.body).toEqual({ kind: 'RECEIPT', method: 'BANK_TRANSFER', amount: 1_000_000, note: 'CK Vietcombank' });
    expect(post?.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(tile('paid')).toBe('1.000.000 ₫'));
    expect(tile('remaining')).toBe('4.300.000 ₫');
    expect(await screen.findByText('Đã ghi phiếu thu PT-000009.')).toBeTruthy();
    // Form xoá, giữ cách trả vừa chọn; số điền sẵn = summary.remaining mới.
    await waitFor(() => expect((screen.getByLabelText(/Số tiền/) as HTMLInputElement).value).toBe('4.300.000 ₫'));
    expect(screen.getByRole('radio', { name: 'Chuyển khoản' }).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByLabelText('Ghi chú') as HTMLInputElement).value).toBe('');
  });

  it('ngày thu tương lai bị chặn; ghi lùi gửi receivedAt; 400 của máy chủ hiện dưới ô Ngày thu', async () => {
    setupServer({
      handlers: [
        (c) =>
          c.method === 'POST'
            ? err(400, 'VALIDATION_FAILED', 'Ngày thu không được trước ngày lập hợp đồng HD-000142 quá 1 ngày', {
                issues: [{ path: 'receivedAt', message: 'Ngày thu không được trước ngày lập hợp đồng HD-000142 quá 1 ngày' }],
              })
            : undefined,
      ],
    });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    const date = (await screen.findByLabelText('Ngày thu')) as HTMLInputElement;
    expect(date.value).toBe('19/10/2026');
    fireEvent.click(screen.getByRole('radio', { name: 'Tiền mặt' }));
    fireEvent.change(date, { target: { value: '20/10/2026' } });
    fireEvent.blur(date);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phiếu thu' }));
    expect(screen.getByText('Ngày thu không được ở tương lai.')).toBeTruthy();
    expect(posts('/payments')).toHaveLength(0);
    fireEvent.change(date, { target: { value: '01/09/2026' } });
    fireEvent.blur(date);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lưu phiếu thu' })));
    expect((posts(`/contracts/${HD}/payments`)[0]?.body as { receivedAt: string }).receivedAt).toBe('2026-09-01T12:00:00+07:00');
    expect(await screen.findByText('Ngày thu không được trước ngày lập hợp đồng HD-000142 quá 1 ngày')).toBeTruthy();
  });

  it('phiếu hoàn: bắt buộc ghi chú; gửi kind REFUND; 409 hoàn vượt → dải đỏ chữ máy chủ, giữ dữ liệu', async () => {
    setupServer({
      handlers: [(c) => (c.method === 'POST' ? err(409, 'CONFLICT', 'Số hoàn (300.000 ₫) vượt số đã thu của hợp đồng (0 ₫)', { paid: 0, amount: 300_000 }) : undefined)],
    });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    fireEvent.click(await screen.findByRole('radio', { name: 'Hoàn tiền' }));
    expect(screen.getByRole('heading', { name: 'Ghi phiếu hoàn tiền' })).toBeTruthy();
    const amount = screen.getByLabelText(/Số tiền/);
    fireEvent.focus(amount);
    fireEvent.change(amount, { target: { value: '300.000' } });
    fireEvent.blur(amount);
    fireEvent.click(screen.getByRole('radio', { name: 'Chuyển khoản' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu phiếu hoàn' }));
    expect(screen.getByText('Phiếu hoàn tiền phải ghi lý do hoàn.')).toBeTruthy();
    expect(posts('/payments')).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/Ghi chú/), { target: { value: 'Bớt 1 phù dâu' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lưu phiếu hoàn' })));
    expect(posts(`/contracts/${HD}/payments`)[0]?.body).toEqual({ kind: 'REFUND', method: 'BANK_TRANSFER', amount: 300_000, note: 'Bớt 1 phù dâu' });
    expect(await screen.findByText('Số hoàn (300.000 ₫) vượt số đã thu của hợp đồng (0 ₫)')).toBeTruthy();
    expect((screen.getByLabelText(/Ghi chú/) as HTMLInputElement).value).toBe('Bớt 1 phù dâu');
  });

  it('thu vượt: 409 overBy → hộp "Khách trả thừa?"; Vẫn ghi phiếu gửi lại allowOverpay + ghi chú với khoá MỚI', async () => {
    const overSum: PaymentSummary = { ...SUM, received: 5_500_000, paid: 5_500_000, remaining: -200_000, overpaid: 200_000, depositOutstanding: 0 };
    let saved = false;
    setupServer({
      progress: () => (saved ? progress({ summary: overSum, payments: [pay({ amount: 5_500_000 })] }) : progress()),
      handlers: [
        (c) => {
          if (c.method !== 'POST') return undefined;
          const b = c.body as { allowOverpay?: boolean };
          if (!b.allowOverpay) {
            return err(409, 'CONFLICT', 'Thu vượt tổng hợp đồng 200.000 ₫ (còn phải thu 5.300.000 ₫).', {
              total: 5_300_000,
              paid: 0,
              remaining: 5_300_000,
              overBy: 200_000,
            });
          }
          saved = true;
          return json(201, { ...pay({ amount: 5_500_000 }), contract: { id: HD, code: 'HD-000142', status: 'CONFIRMED' }, summary: overSum });
        },
      ],
    });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    const amount = await screen.findByLabelText(/Số tiền/);
    fireEvent.focus(amount);
    fireEvent.change(amount, { target: { value: '5.500.000' } });
    fireEvent.blur(amount);
    fireEvent.click(screen.getByRole('radio', { name: 'Tiền mặt' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lưu phiếu thu' })));
    const dlg = await screen.findByRole('dialog', { name: 'Khách trả thừa?' });
    expect(within(dlg).getByText('Thu vượt tổng hợp đồng 200.000 ₫ (còn phải thu 5.300.000 ₫).')).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Vẫn ghi phiếu' }));
    expect(within(dlg).getByText('Nhập lý do khách trả thừa trước khi ghi phiếu.')).toBeTruthy();
    fireEvent.change(within(dlg).getByLabelText(/Lý do/), { target: { value: 'Khách chuyển dư, trừ lần sau' } });
    await act(async () => fireEvent.click(within(dlg).getByRole('button', { name: 'Vẫn ghi phiếu' })));
    const sent = posts(`/contracts/${HD}/payments`);
    expect(sent).toHaveLength(2);
    expect(sent[1]?.body).toEqual({ kind: 'RECEIPT', method: 'CASH', amount: 5_500_000, note: 'Khách chuyển dư, trừ lần sau', allowOverpay: true });
    expect(sent[1]?.headers['Idempotency-Key']).not.toBe(sent[0]?.headers['Idempotency-Key']);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(tile('remaining')).toBe('0 ₫'));
  });

  it('mất mạng khi lưu: dải vàng; bấm lại dùng CÙNG Idempotency-Key (không sinh phiếu đôi)', async () => {
    let fail = true;
    setupServer({
      handlers: [
        (c) => {
          if (c.method !== 'POST') return undefined;
          if (fail) {
            fail = false;
            throw new TypeError('Failed to fetch');
          }
          return json(201, { ...pay({}), contract: { id: HD, code: 'HD-000142', status: 'CONFIRMED' }, summary: SUM });
        },
      ],
    });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    fireEvent.click(await screen.findByRole('radio', { name: 'Tiền mặt' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lưu phiếu thu' })));
    expect(await screen.findByText('Mất kết nối khi lưu phiếu. Bấm lưu lại khi có mạng: phiếu không bị ghi đôi.')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lưu phiếu thu' })));
    const sent = posts(`/contracts/${HD}/payments`);
    expect(sent).toHaveLength(2);
    expect(sent[1]?.headers['Idempotency-Key']).toBe(sent[0]?.headers['Idempotency-Key']);
  });
});

describe('huỷ phiếu', () => {
  it('bắt buộc lý do; POST /payments/:id/void {reason}; phiếu đã huỷ gạch ngang kèm lý do, 4 ô theo summary', async () => {
    let voided = false;
    const after: PaymentSummary = { ...SUM };
    setupServer({
      progress: () =>
        voided
          ? progress({ payments: [pay({ voidedAt: '2026-10-19T03:00:00.000Z', voidReason: 'Ghi nhầm hợp đồng' })] })
          : progress({ summary: { ...SUM, received: 1_000_000, paid: 1_000_000, remaining: 4_300_000, depositOutstanding: 0 }, payments: [pay({})] }),
      handlers: [
        (c) => {
          if (!c.url.endsWith('/void')) return undefined;
          voided = true;
          return json(200, { ...pay({ voidedAt: '2026-10-19T03:00:00.000Z', voidReason: 'Ghi nhầm hợp đồng' }), contract: { id: HD, code: 'HD-000142', status: 'CONFIRMED' }, summary: after });
        },
      ],
    });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Huỷ phiếu PT-000087' }));
    const dlg = screen.getByRole('dialog', { name: 'Huỷ phiếu PT-000087?' });
    expect(within(dlg).getByText('Phiếu không bị xoá: vẫn hiện trong sổ thu, gạch ngang, kèm lý do. Chỉ huỷ được một lần.')).toBeTruthy();
    await act(async () => fireEvent.click(within(dlg).getByRole('button', { name: 'Huỷ phiếu' })));
    expect(within(dlg).getByText('Nhập lý do huỷ trước khi huỷ phiếu.')).toBeTruthy();
    expect(posts('/void')).toHaveLength(0);
    fireEvent.change(within(dlg).getByLabelText(/Lý do huỷ/), { target: { value: 'Ghi nhầm hợp đồng' } });
    await act(async () => fireEvent.click(within(dlg).getByRole('button', { name: 'Huỷ phiếu' })));
    expect(posts('/void')[0]).toMatchObject({ url: `/api/v1/orgs/${ORG}/payments/p-1/void`, body: { reason: 'Ghi nhầm hợp đồng' } });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(tile('paid')).toBe('0 ₫'));
    expect(await screen.findByText('Đã huỷ: Ghi nhầm hợp đồng')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Huỷ phiếu PT-000087' })).toBeNull();
  });

  it('409 (huỷ làm số đã thu âm / đã huỷ trước đó) → chữ máy chủ trong hộp; 403 → chữ máy chủ', async () => {
    let status = 409;
    setupServer({
      progress: () => progress({ payments: [pay({})] }),
      handlers: [
        (c) =>
          c.url.endsWith('/void')
            ? status === 409
              ? err(409, 'CONFLICT', 'Huỷ phiếu PT-000087 làm số đã thu âm vì hợp đồng đã có phiếu hoàn — huỷ phiếu hoàn trước')
              : err(403, 'FORBIDDEN', 'Bạn không có quyền huỷ phiếu thu')
            : undefined,
      ],
    });
    renderAt(`/hoa-dao/thu-tien/${HD}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Huỷ phiếu PT-000087' }));
    const dlg = screen.getByRole('dialog', { name: 'Huỷ phiếu PT-000087?' });
    fireEvent.change(within(dlg).getByLabelText(/Lý do huỷ/), { target: { value: 'Ghi nhầm' } });
    await act(async () => fireEvent.click(within(dlg).getByRole('button', { name: 'Huỷ phiếu' })));
    expect(await within(dlg).findByText('Huỷ phiếu PT-000087 làm số đã thu âm vì hợp đồng đã có phiếu hoàn — huỷ phiếu hoàn trước')).toBeTruthy();
    status = 403;
    await act(async () => fireEvent.click(within(dlg).getByRole('button', { name: 'Huỷ phiếu' })));
    expect(await within(dlg).findByText('Bạn không có quyền huỷ phiếu thu')).toBeTruthy();
  });
});

describe('tổ chức đào tạo: chip loại hợp đồng (kind máy chủ), hợp đồng khoá học dùng nguyên khối thu tiền', () => {
  const KH = 'hd-kh-57';
  const COURSE_ITEM: ContractSummary = {
    ...LIST_ITEM,
    id: KH,
    code: 'HĐKH-2026-0057',
    kind: 'COURSE',
    eventDate: null,
    total: 17_000_000,
    confirmedAt: '2026-10-18T03:00:00.000Z',
    customer: { id: 'k-2', fullName: 'Đỗ Minh Ngọc', phone: null },
  };
  const courseHandler: Handler = (c) => {
    const url = decodeURIComponent(c.url);
    if (c.method === 'GET' && url.includes('/contracts?') && url.includes('kind=COURSE')) return json(200, { items: [COURSE_ITEM], page: 1, pageSize: 50, total: 1 });
    if (c.method === 'GET' && url.endsWith(`/contracts/${KH}`)) {
      return json(200, { id: KH, kind: 'COURSE', lines: [{ kind: 'COURSE', name: 'Makeup chuyên nghiệp · K12', voidedAt: null }, { kind: 'CUSTOM', name: 'Giáo trình', voidedAt: null }] });
    }
    if (c.method === 'GET' && url.endsWith(`/contracts/${HD}`)) return json(200, { id: HD, kind: 'SERVICE', lines: [] });
    if (c.method === 'GET' && url.endsWith(`/contracts/${KH}/payments`)) {
      const p = progress();
      return json(200, { ...p, contract: { ...p.contract, id: KH, code: 'HĐKH-2026-0057', eventDate: null, customer: { id: 'k-2', fullName: 'Đỗ Minh Ngọc', phone: null, phoneHidden: false } } });
    }
    return undefined;
  };

  function renderAcademy(path: string) {
    const router = createMemoryRouter(
      [
        { path: '/:orgSlug/thu-tien', element: <PaymentsScreen orgId={ORG} orgSlug="hv" contractId={null} access={FULL} academy /> },
        { path: '/:orgSlug/thu-tien/:id', element: <PaymentsScreen orgId={ORG} orgSlug="hv" contractId={KH} access={FULL} academy /> },
      ],
      { initialEntries: [path] },
    );
    return render(<RouterProvider router={router} />);
  }

  it('3 nhóm dịch vụ gửi kind=SERVICE + nhóm "Hợp đồng khoá học" kind=COURSE; chip đếm theo tổng máy chủ và lọc nhóm', async () => {
    setupServer({ handlers: [courseHandler] });
    renderAcademy('/hv/thu-tien');
    const chips = await screen.findByRole('group', { name: 'Loại hợp đồng' });
    await waitFor(() => expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tất cả2', 'Khoá học1', 'Dịch vụ makeup1']));
    const lists = calls.filter((c) => c.url.includes('/contracts?')).map((c) => decodeURIComponent(c.url));
    expect(lists).toHaveLength(4);
    expect(lists.filter((u) => u.includes('kind=SERVICE'))).toHaveLength(3);
    expect(lists.filter((u) => u.includes('kind=COURSE') && !u.includes('eventFrom') && !u.includes('eventTo'))).toHaveLength(1);
    expect(screen.getByRole('heading', { name: /^Hợp đồng khoá học/ })).toBeTruthy();
    fireEvent.click(within(chips).getByRole('button', { name: /^Khoá học/ }));
    expect(screen.queryByRole('heading', { name: /^Sự kiện 7 ngày tới/ })).toBeNull();
    expect(screen.getByText('HĐKH-2026-0057 · Khoá học')).toBeTruthy();
    fireEvent.click(within(chips).getByRole('button', { name: /^Dịch vụ makeup/ }));
    expect(screen.queryByRole('heading', { name: /^Hợp đồng khoá học/ })).toBeNull();
    expect(screen.getByRole('heading', { name: /^Sự kiện 7 ngày tới/ })).toBeTruthy();
  });

  it('hợp đồng khoá học: Cọc + 2 đợt chia đều tới ngày kết thúc lớp muộn nhất (lớp đã huỷ, dòng đã huỷ không tính)', async () => {
    const classes = [
      { id: 'cls-k12', endDate: '2026-11-30', status: 'OPEN' },
      { id: 'cls-k13', endDate: '2026-11-20', status: 'OPEN' },
      { id: 'cls-huy', endDate: '2027-03-01', status: 'CANCELLED' },
      { id: 'cls-dong-huy', endDate: '2027-02-01', status: 'OPEN' },
      { id: 'cls-khac', endDate: '2027-01-01', status: 'OPEN' },
    ];
    const lines = [
      { kind: 'COURSE', name: 'Makeup chuyên nghiệp · K12', courseClassId: 'cls-k12', voidedAt: null },
      { kind: 'COURSE', name: 'Makeup cá nhân · K13', courseClassId: 'cls-k13', voidedAt: null },
      { kind: 'COURSE', name: 'Lớp đã huỷ', courseClassId: 'cls-huy', voidedAt: null },
      { kind: 'COURSE', name: 'Dòng đã huỷ', courseClassId: 'cls-dong-huy', voidedAt: '2026-10-18T03:00:00.000Z' },
      { kind: 'CUSTOM', name: 'Giáo trình', courseClassId: null, voidedAt: null },
    ];
    setupServer({
      handlers: [
        (c) => {
          const url = decodeURIComponent(c.url);
          if (c.method === 'GET' && url.endsWith(`/contracts/${KH}`)) return json(200, { id: KH, kind: 'COURSE', lines });
          if (c.method === 'GET' && url.includes(`/orgs/${ORG}/classes`)) return json(200, { items: classes });
          if (c.method === 'PUT') return json(200, progress());
          return undefined;
        },
        courseHandler,
      ],
    });
    renderAcademy(`/hv/thu-tien/${KH}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Lập tiến độ' }));
    const dlg = screen.getByRole('dialog', { name: 'Tiến độ thanh toán' });
    expect(
      await within(dlg).findByText(
        'Các đợt chia đều từ hôm nay tới ngày kết thúc lớp 30/11/2026 (lớp kết thúc muộn nhất trong hợp đồng); không đợt nào hạn sau ngày đó.',
      ),
    ).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cọc + 2 đợt' }));
    await act(async () => fireEvent.click(within(dlg).getByRole('button', { name: 'Lưu tiến độ' })));
    const put = calls.find((c) => c.method === 'PUT')?.body as { installments: { dueDate: string }[] };
    expect(put.installments.map((i) => i.dueDate)).toEqual(['2026-10-19T23:59:59+07:00', '2026-11-09T23:59:59+07:00', '2026-11-30T23:59:59+07:00']);
  });

  it('hợp đồng khoá học không đọc được lớp (403): giữ 30 ngày một đợt', async () => {
    setupServer({
      handlers: [
        (c) => {
          const url = decodeURIComponent(c.url);
          if (c.method === 'GET' && url.endsWith(`/contracts/${KH}`)) return json(200, { id: KH, kind: 'COURSE', lines: [{ kind: 'COURSE', name: 'K12', courseClassId: 'cls-k12', voidedAt: null }] });
          if (c.method === 'GET' && url.includes(`/orgs/${ORG}/classes`)) return err(403, 'FORBIDDEN', 'Không có quyền');
          if (c.method === 'PUT') return json(200, progress());
          return undefined;
        },
        courseHandler,
      ],
    });
    renderAcademy(`/hv/thu-tien/${KH}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Lập tiến độ' }));
    const dlg = screen.getByRole('dialog', { name: 'Tiến độ thanh toán' });
    await waitFor(() => expect((within(dlg).getByRole('button', { name: 'Cọc + 2 đợt' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(within(dlg).getByRole('button', { name: 'Cọc + 2 đợt' }));
    await act(async () => fireEvent.click(within(dlg).getByRole('button', { name: 'Lưu tiến độ' })));
    const put = calls.find((c) => c.method === 'PUT')?.body as { installments: { dueDate: string }[] };
    expect(put.installments.map((i) => i.dueDate)).toEqual(['2026-10-19T23:59:59+07:00', '2026-11-18T23:59:59+07:00', '2026-12-18T23:59:59+07:00']);
  });

  it('hợp đồng khoá học: dòng phụ "Khoá · Lớp" (renderSubline), 4 ô số = summary máy chủ', async () => {
    setupServer({ handlers: [courseHandler] });
    renderAcademy(`/hv/thu-tien/${KH}`);
    expect((await screen.findByText('Makeup chuyên nghiệp · K12')).getAttribute('data-o')).toBe('khoa-lop');
    expect(document.body.textContent).not.toContain('Chưa có ngày sự kiện');
    expect(tile('total')).toBe('5.300.000 ₫');
    expect(tile('depositRequired')).toBe('1.000.000 ₫');
  });
});
