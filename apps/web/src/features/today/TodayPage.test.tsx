import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TodayView } from '../../api/types';
import { emptyView, fullView, noMoneyView, noScheduleView, nothingView, ownView } from './fixtures';
import { TodayScreen } from './index';
import type { TodayAccess } from './model';

// Màn Hôm nay chạy thật (src/api/today.ts, router) với máy chủ giả lập qua fetch. Số trên màn phải là số máy chủ trả.

const ORG = 'org-1';
const ALL: TodayAccess = { paymentsWrite: true, scheduleWrite: true, staffRead: false };
const READ_ONLY: TodayAccess = { paymentsWrite: false, scheduleWrite: false, staffRead: false };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

let calls: string[] = [];
function serve(...responses: Array<TodayView | Response | (() => TodayView | Response)>) {
  calls = [];
  let n = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      const r = responses[Math.min(n, responses.length - 1)];
      n += 1;
      const v = typeof r === 'function' ? r() : r;
      return v instanceof Response ? v : json(200, v);
    }),
  );
}

function renderToday(access: TodayAccess = ALL) {
  const router = createMemoryRouter(
    [
      { path: '/:orgSlug/hom-nay', element: <TodayScreen orgId={ORG} orgSlug="hoa-dao" access={access} /> },
      { path: '/:orgSlug/thu-tien/:id', element: <p>Màn Thu tiền</p> },
      { path: '/:orgSlug/lich', element: <p>Màn Lịch</p> },
    ],
    { initialEntries: ['/hoa-dao/hom-nay'] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

// Đã có dữ liệu: tiêu đề trang đổi từ "Hôm nay" sang "Hôm nay · Thứ Bảy 21/11" (khối chờ cũng có thẻ tên "Cần làm ngay").
const loaded = () => screen.findByRole('heading', { level: 1, name: /^Hôm nay · / });
async function needsCard() {
  await loaded();
  return screen.getByRole('heading', { name: /^Cần làm ngay/ }).closest('section') as HTMLElement;
}
const card = (title: RegExp) => screen.getByRole('heading', { name: title }).closest('section') as HTMLElement;
const tile = (name: string) => document.querySelector(`[data-tile="${name}"]`) as HTMLElement | null;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  try {
    window.localStorage.clear();
  } catch {
    // bỏ qua
  }
});

describe('có dữ liệu (chủ studio, giao diện ALL)', () => {
  it('gọi đúng GET /orgs/:orgId/today một lần; chờ thì có khối chờ', async () => {
    serve(fullView());
    renderToday();
    expect(screen.getByRole('status', { name: 'Đang tải trang Hôm nay' })).toBeTruthy();
    await loaded();
    expect(calls).toEqual(['/api/v1/orgs/org-1/today']);
  });

  it('4 ô số đúng số máy chủ trả, tiền định dạng bằng formatVnd, ca kế tiếp ghi "giờ + tên thợ"', async () => {
    serve(fullView());
    renderToday();
    await loaded();
    expect(tile('today')?.textContent).toContain('Ca hôm nay');
    expect(tile('today')?.textContent).toContain('15:00 Thu Hà');
    expect(tile('tomorrow')?.textContent).toMatch(/Ca ngày mai.*3.*1 ca chưa có thợ \(7 ngày tới\)/);
    expect(tile('overdue')?.textContent).toContain('2');
    expect(tile('overdue')?.textContent).toContain('3.500.000 ₫');
    expect(tile('due')?.textContent).toContain('1.500.000 ₫');
    expect(document.querySelector('.td-tiles')?.getAttribute('style')).toContain('--stat-cols: 4');
    expect(screen.getByRole('heading', { level: 1, name: 'Hôm nay · Thứ Bảy 21/11' })).toBeTruthy();
  });

  it('thẻ "Cần làm ngay": ba nhóm, 4 việc, dòng tiền đủ chữ', async () => {
    serve(fullView());
    renderToday();
    const needs = await needsCard();
    expect(within(needs).getByText('4 việc')).toBeTruthy();
    expect(within(needs).getByText('Tiền quá hạn')).toBeTruthy();
    expect(within(needs).getByText('Ca chưa có thợ')).toBeTruthy();
    expect(within(needs).getByText('Lớp sắp đầy')).toBeTruthy();
    expect(within(needs).getByText('Đợt 2 · HD-000004 · Đỗ Thanh Mai')).toBeTruthy();
    expect(within(needs).getByText('Hạn 18/11 (quá 3 ngày) · phụ trách: Mai · 0901222333')).toBeTruthy();
    // SĐT khách bị ẩn theo quyền: máy chủ trả phone null → không có số, không có chữ thừa.
    expect(within(needs).getByText('Hạn 17/11 (quá 4 ngày)')).toBeTruthy();
    expect(within(needs).getByText('Ngày mai 15:00 · Phù dâu · Hoàng Minh Thư')).toBeTruthy();
    expect(within(needs).getByText('Chuyên nghiệp K5 · 10/12 chỗ')).toBeTruthy();
    expect(within(needs).getByText('Khai giảng 01/12 · còn 2 chỗ')).toBeTruthy();
  });

  it('thẻ Thu tiền 7 ngày tới, Ngày mai (gom theo thợ), Mới trong 24 giờ', async () => {
    serve(fullView());
    renderToday();
    await loaded();
    const due = card(/Thu tiền 7 ngày tới/);
    expect(within(due).getByText('1 đợt')).toBeTruthy();
    expect(within(due).getByText('Hạn Thứ Ba 24/11 (ngày sự kiện) · phụ trách Mai')).toBeTruthy();
    expect(within(due).getByText('1.500.000 ₫')).toBeTruthy();
    expect(within(due).getByRole('link', { name: 'Mở Thu tiền' }).getAttribute('href')).toBe('/hoa-dao/thu-tien');

    const tomorrow = card(/Ngày mai · Chủ nhật 22\/11/);
    expect(within(tomorrow).getByText('3 ca')).toBeTruthy();
    expect(within(tomorrow).getByText('Linh Trần · 2 ca')).toBeTruthy();
    expect(within(tomorrow).getByText('05:00 · 13:00')).toBeTruthy();
    expect(within(tomorrow).getByText('Chưa có thợ · 1 ca')).toBeTruthy();
    expect(within(tomorrow).getByRole('link', { name: 'Mở Lịch' }).getAttribute('href')).toBe('/hoa-dao/lich?ngay=2026-11-22');

    const fresh = card(/Mới trong 24 giờ/);
    expect(within(fresh).getByText('2')).toBeTruthy();
    expect(within(fresh).getByText('HD-000007 xác nhận · Ngô Thảo Vy')).toBeTruthy();
    expect(within(fresh).getByText('3.200.000 ₫ · ngày sự kiện 22/11 · 20:14 hôm qua · Nguyễn Văn Chiến')).toBeTruthy();
    expect(within(fresh).getByText('Nguyễn Hải Yến ghi danh')).toBeTruthy();
    expect(within(fresh).getByText('K12 · còn 3/12 chỗ · 19:40 hôm qua')).toBeTruthy();
  });

  it('nút "Mở Thu tiền" chỉ khi có payments.write; "Phân thợ" dẫn đúng lich?ngay=&ca= chỉ khi có schedule.write', async () => {
    serve(fullView());
    const { unmount } = renderToday(ALL);
    const needs = await needsCard();
    const open = within(needs).getAllByRole('link', { name: /^Mở Thu tiền HD-/ });
    expect(open.map((a) => a.getAttribute('href'))).toEqual(['/hoa-dao/thu-tien/hd-4', '/hoa-dao/thu-tien/hd-3']);
    expect(within(needs).getByRole('link', { name: 'Phân thợ cho ca CA-000001' }).getAttribute('href')).toBe('/hoa-dao/lich?ngay=2026-11-22&ca=ca-chua');
    expect(within(needs).getByRole('link', { name: 'Mở lớp Chuyên nghiệp K5' }).getAttribute('href')).toBe('/hoa-dao/dao-tao/kh-5');
    unmount();

    serve(fullView());
    renderToday(READ_ONLY);
    const needs2 = await needsCard();
    expect(within(needs2).queryByText('Mở Thu tiền')).toBeNull();
    expect(within(needs2).queryByText('Phân thợ')).toBeNull();
    // Không có quyền ghi: cả dòng là đường dẫn để xem.
    expect(within(needs2).getByRole('link', { name: /Đợt 2 · HD-000004/ }).getAttribute('href')).toBe('/hoa-dao/thu-tien/hd-4');
    expect(within(needs2).getByRole('link', { name: /Ngày mai 15:00/ }).getAttribute('href')).toBe('/hoa-dao/lich?ngay=2026-11-22&ca=ca-chua');
  });

  it('bấm "Phân thợ" chuyển tới Lịch (đường dẫn trong ứng dụng, không tải lại trang)', async () => {
    serve(fullView());
    const { router } = renderToday();
    const needs = await needsCard();
    fireEvent.click(within(needs).getByRole('link', { name: 'Phân thợ cho ca CA-000001' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/hoa-dao/lich'));
    expect(router.state.location.search).toBe('?ngay=2026-11-22&ca=ca-chua');
  });

  it('bị cắt bớt: ghi rõ "Chỉ hiện N dòng đầu", số việc vẫn là số máy chủ đếm', async () => {
    const v = fullView();
    serve({ ...v, counts: { ...v.counts, overdue: { count: 120, amount: 9_000_000 } }, installments: { ...v.installments!, truncated: true } });
    renderToday();
    const needs = await needsCard();
    expect(within(needs).getByText('122 việc')).toBeTruthy();
    expect(within(needs).getByText('Chỉ hiện 2 dòng đầu — xem đủ ở Thu tiền.')).toBeTruthy();
    expect(within(needs).getByText('9.000.000 ₫')).toBeTruthy();
  });

  it('giờ theo múi giờ tổ chức của máy chủ, không theo máy', async () => {
    const v = fullView();
    serve({ ...v, timezone: 'UTC', today: '2026-11-21', tomorrow: '2026-11-22' });
    renderToday();
    await loaded();
    expect(tile('today')?.textContent).toContain('08:00 Thu Hà');
  });
});

describe('trạng thái rỗng thật', () => {
  it('có quyền mà không có gì: số 0 thật, câu "Không có …", không bịa số tiền', async () => {
    serve(emptyView());
    renderToday();
    await loaded();
    expect(screen.getByText('Không có việc gấp.')).toBeTruthy();
    expect(tile('today')?.textContent).toContain('0');
    expect(tile('today')?.textContent).toContain('Không có ca');
    expect(tile('overdue')?.textContent).toContain('Không có đợt nào quá hạn.');
    expect(tile('tomorrow')?.textContent).toContain('Mọi ca 7 ngày tới đã có thợ.');
    expect(screen.getByText('Ngày mai chưa có ca nào.')).toBeTruthy();
    expect(screen.getByText('Không có đợt nào đến hạn trong 7 ngày tới.')).toBeTruthy();
    expect(screen.getByText('Không có gì mới trong 24 giờ.')).toBeTruthy();
    expect(screen.queryByText('Thu gọn')).toBeNull();
  });

  it('thợ không có ca hôm nay: "Bạn không có ca nào hôm nay."', async () => {
    serve(ownView());
    renderToday();
    await loaded();
    expect(screen.getByText('Bạn không có ca nào hôm nay.')).toBeTruthy();
  });
});

describe('người không có quyền xem tiền (máy chủ trả null)', () => {
  it('không vẽ ô tiền, thẻ Thu tiền, thẻ hợp đồng/khoá học/lớp; không có chữ ₫ nào trên màn', async () => {
    serve(noMoneyView());
    renderToday();
    await loaded();
    expect(tile('overdue')).toBeNull();
    expect(tile('due')).toBeNull();
    expect(document.querySelector('.td-tiles')?.getAttribute('style')).toContain('--stat-cols: 2');
    expect(screen.queryByText(/Thu tiền 7 ngày tới/)).toBeNull();
    expect(screen.queryByText('Mới trong 24 giờ')).toBeNull();
    expect(screen.queryByText('Lớp sắp đầy')).toBeNull();
    expect(screen.queryByText('Tiền quá hạn')).toBeNull();
    expect(screen.queryByText('Mở Thu tiền')).toBeNull();
    // Vẫn có việc ca chưa có thợ → thẻ Cần làm ngay hiện đúng 1 việc.
    expect(screen.getByText('1 việc')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/₫/);
  });

  it('ẩn thẻ là theo dữ liệu máy chủ: web không tự giấu — máy chủ trả tiền thì web hiện', async () => {
    serve(fullView());
    renderToday(READ_ONLY);
    await loaded();
    expect(tile('overdue')?.textContent).toContain('3.500.000 ₫');
  });
});

describe('giao diện thợ (OWN)', () => {
  it('không có 4 ô số; ba thẻ Hôm nay / Ngày mai / Sau đó; dòng ca đủ giờ, sự kiện, khách, nơi làm, trạng thái', async () => {
    serve(ownView());
    renderToday();
    await loaded();
    expect(document.querySelector('.td-tiles')).toBeNull();
    expect(screen.queryByText('Cần làm ngay')).toBeNull();
    expect(screen.getByRole('heading', { name: /^Hôm nay/, level: 2 })).toBeTruthy();
    const tomorrow = card(/Ngày mai · Chủ nhật 22\/11/);
    expect(within(tomorrow).getByText('2 ca')).toBeTruthy();
    expect(within(tomorrow).getByText('Cô dâu cao cấp · Cô dâu')).toBeTruthy();
    expect(within(tomorrow).getByText('Tại nhà khách – 25 Nguyễn Văn Cừ · đi trước 30 phút')).toBeTruthy();
    expect(within(tomorrow).getByText('05:00')).toBeTruthy();
    expect(within(tomorrow).getByText('07:00')).toBeTruthy();
    // Ca chưa có sự kiện: chỉ nhân vật, màu trung tính.
    expect(within(tomorrow).getByText('Dặm makeup')).toBeTruthy();
    expect(within(tomorrow).getAllByText('Đã xác nhận')).toHaveLength(2);
    expect(tomorrow.querySelector('.td-sw-rose')).toBeTruthy();
    expect(tomorrow.querySelector('.td-sw-other')).toBeTruthy();
    const later = card(/Sau đó · 7 ngày tới/);
    expect(within(later).getByText('Thứ Ba 24/11 · 1 ca')).toBeTruthy();
    expect(within(later).getByText('08:00 Cô dâu · Phan Thu Trang')).toBeTruthy();
    expect(within(later).getByRole('link', { name: /08:00 Cô dâu/ }).getAttribute('href')).toBe('/hoa-dao/lich?ngay=2026-11-24&ca=ca-c');
  });
});

describe('không có quyền xem lịch (máy chủ trả ca = null)', () => {
  it('hiện "không có quyền xem lịch", không hiện số 0 hay thẻ Ngày mai; thẻ tiền vẫn theo dữ liệu', async () => {
    serve(noScheduleView());
    renderToday();
    await loaded();
    expect(screen.getByText('Bạn không có quyền xem lịch nên Hôm nay không hiện ca nào.')).toBeTruthy();
    expect(tile('today')).toBeNull();
    expect(tile('tomorrow')).toBeNull();
    expect(screen.queryByRole('heading', { name: /^Ngày mai/ })).toBeNull();
    expect(screen.queryByText(/0 ca/)).toBeNull();
    expect(tile('overdue')?.textContent).toContain('3.500.000 ₫');
    expect(document.querySelector('.td-tiles')?.getAttribute('style')).toContain('--stat-cols: 2');
    expect(screen.getByText('Thu tiền 7 ngày tới', { exact: false })).toBeTruthy();
  });

  it('không còn quyền nào ngoài org.read: chỉ có lời báo, không ô số, không thẻ', async () => {
    serve(nothingView());
    renderToday();
    await loaded();
    expect(screen.getByText(/Bạn không có quyền xem lịch/)).toBeTruthy();
    expect(document.querySelector('.td-tiles')).toBeNull();
    expect(screen.queryByText('Cần làm ngay')).toBeNull();
    expect(document.body.textContent).not.toMatch(/₫/);
  });

  it('thợ (OWN) mà máy chủ lỡ trả ca null: cũng báo không có quyền, không vẽ số 0', async () => {
    serve({ ...ownView(), appointments: null, counts: { ...ownView().counts, appointmentsToday: null, appointmentsTomorrow: null } });
    renderToday();
    await loaded();
    expect(screen.getByText(/Bạn không có quyền xem lịch/)).toBeTruthy();
    expect(screen.queryByText(/0 ca/)).toBeNull();
  });
});

describe('Thu gọn nhớ trên máy', () => {
  it('thu gọn rồi mở lại trang vẫn thu gọn; khoá hom-nay:thu-gon:can-lam', async () => {
    serve(fullView());
    const first = renderToday();
    const needs = await needsCard();
    expect(within(needs).getByText('Tiền quá hạn')).toBeTruthy();
    fireEvent.click(within(needs).getByRole('button', { name: 'Thu gọn' }));
    expect(within(needs).queryByText('Tiền quá hạn')).toBeNull();
    expect(within(needs).getByRole('button', { name: 'Mở rộng' }).getAttribute('aria-expanded')).toBe('false');
    expect(window.localStorage.getItem('hom-nay:thu-gon:can-lam')).toBe('1');
    first.unmount();

    serve(fullView());
    renderToday();
    const again = await needsCard();
    expect(within(again).queryByText('Tiền quá hạn')).toBeNull();
    fireEvent.click(within(again).getByRole('button', { name: 'Mở rộng' }));
    expect(within(again).getByText('Tiền quá hạn')).toBeTruthy();
    expect(window.localStorage.getItem('hom-nay:thu-gon:can-lam')).toBeNull();
  });

  it('localStorage ném lỗi vẫn vẽ được và vẫn thu gọn được trong phiên', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bị chặn');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bị chặn');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bị chặn');
    });
    serve(fullView());
    renderToday();
    const needs = await needsCard();
    expect(within(needs).getByText('Tiền quá hạn')).toBeTruthy();
    fireEvent.click(within(needs).getByRole('button', { name: 'Thu gọn' }));
    expect(within(needs).queryByText('Tiền quá hạn')).toBeNull();
    fireEvent.click(within(needs).getByRole('button', { name: 'Mở rộng' }));
    expect(within(needs).getByText('Tiền quá hạn')).toBeTruthy();
  });
});

describe('lỗi tải và làm mới', () => {
  it('lỗi máy chủ: lời tiếng Việt + nút "Thử lại"; bấm thử lại tải lại và hiện dữ liệu', async () => {
    serve(json(500, { error: { code: 'INTERNAL', message: 'Máy chủ đang bận, vui lòng thử lại sau.', requestId: 'r' } }), fullView());
    renderToday();
    expect(await screen.findByText(/Không tải được trang Hôm nay\. Máy chủ đang bận, vui lòng thử lại sau\./)).toBeTruthy();
    expect(screen.queryByText('Cần làm ngay')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await loaded();
    expect(screen.getByText('Cần làm ngay')).toBeTruthy();
    expect(calls).toHaveLength(2);
  });

  it('mất mạng: lời mặc định tiếng Việt + nút "Thử lại"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    renderToday();
    expect(await screen.findByText(/Không tải được trang Hôm nay\. Không kết nối được máy chủ/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });

  it('403: dải "không có quyền", không có nút "Thử lại"', async () => {
    serve(json(403, { error: { code: 'FORBIDDEN', message: 'Bạn không có quyền xem trang này.', requestId: 'r' } }));
    renderToday();
    expect((await screen.findByRole('alert')).textContent).toBe('Bạn không có quyền xem trang này.');
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });

  it('"Làm mới" tải lại số liệu mới; tải lại hỏng thì GIỮ số cũ và báo lỗi', async () => {
    const v1 = fullView();
    const v2 = { ...fullView(), counts: { ...fullView().counts, appointmentsToday: 7 } };
    serve(v1, v2, json(500, { error: { code: 'INTERNAL', message: 'Máy chủ đang bận.', requestId: 'r' } }));
    renderToday();
    await loaded();
    expect(tile('today')?.textContent).toContain('1');
    const refresh = screen.getByRole('button', { name: /Làm mới/, description: undefined });
    await act(async () => fireEvent.click(refresh));
    await waitFor(() => expect(tile('today')?.textContent).toContain('7'));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Làm mới/ })));
    expect(await screen.findByText(/Không làm mới được: Máy chủ đang bận\./)).toBeTruthy();
    expect(tile('today')?.textContent).toContain('7');
  });
});
