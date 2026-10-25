import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from '../../api/client';
import type { ClassCertificateRoster, IssueResult, RosterItem } from '../../api/certificates';
import { fakeView, JPEG_1X1 } from './fixtures';
import { IssueDialog, TEMPLATE_MEMO_KEY } from './IssueDialog';
import type { RenderDeps } from './render';

// Hộp "Cấp giấy chứng nhận" (bản vẽ F mục 6.2, 9.3): chọn sẵn, nhãn nợ chỉ khi thấy tiền, số dự kiến, xem trước đúng từng người,
// hộp xác nhận, khoá chống gửi trùng giữ qua lần bấm lại, lỗi máy chủ bằng tiếng Việt, 0 người mới thì không gọi POST, điện thoại hai bước.
configure({ asyncUtilTimeout: 5000 });

const ORG = 'org-1';
const CLASS = '20000000-0000-4000-8000-000000000001';
const T = '2026-10-18T03:00:00.000Z';

interface Call {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const apiErr = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details, requestId: 'r' } });

const eid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const cid = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const photo = (w: number, h: number) => ({ url: 'https://files.test/anh.jpg', expiresAt: T, width: w, height: h });
const contract = (n: number, debt: number | null) => ({ id: `c${n}`, code: `HD-00${n}`, total: debt === null ? null : 6_500_000, paid: debt === null ? null : 6_500_000 - debt, debt });

function item(n: number, name: string, over: Partial<RosterItem> = {}): RosterItem {
  return {
    enrollmentId: eid(n),
    enrolledAt: T,
    customer: { id: cid(n), fullName: name, photo: photo(900, 900) },
    contract: contract(n, 0),
    certificate: null,
    lastRevoked: null,
    ...over,
  };
}

const CERT3 = fakeView(3, { studentName: 'Hoàng Minh Anh', enrollmentId: eid(3), customer: { id: cid(3), fullName: 'Hoàng Minh Anh' }, courseClassId: CLASS, code: 'CC-2026-0003', templateCode: 'cc-04' });

function roster(over: Partial<ClassCertificateRoster> = {}): ClassCertificateRoster {
  return {
    class: {
      id: CLASS,
      name: 'K12',
      courseId: 'co1',
      courseName: 'Makeup chuyên nghiệp',
      courseMode: 'MULTI_CLASS',
      startDate: '2026-08-01',
      endDate: '2026-10-10',
      status: 'OPEN',
      instructorName: 'Nguyễn Thu Hà',
    },
    today: '2026-10-18',
    ended: true,
    defaultIssuedOn: '2026-10-10',
    brandName: 'Chiến Makeup Academy',
    logo: null,
    signer: { name: 'Nguyễn Trọng Chiến', title: 'Giám đốc trung tâm' },
    nextNumber: { year: 2026, seq: 8, code: 'CC-2026-0008' },
    moneyVisible: true,
    items: [
      item(1, 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', { contract: contract(1, 1_500_000) }),
      item(2, 'Phạm Quỳnh Hương', { customer: { id: cid(2), fullName: 'Phạm Quỳnh Hương', photo: null } }),
      item(3, 'Hoàng Minh Anh', { certificate: CERT3 }),
      item(4, 'Vũ Thu Trang', { lastRevoked: { id: 'rv', code: 'CC-2026-0002', revokedAt: T, revokeReason: 'Sai tên' } }),
      item(5, 'Bùi Khánh Linh', { customer: { id: cid(5), fullName: 'Bùi Khánh Linh', photo: photo(250, 250) } }),
    ],
    ...over,
  };
}

function issued(ids: number[]): IssueResult {
  return {
    items: ids.map((n) => fakeView(n === 3 ? 3 : 7 + n, { studentName: `Học viên ${n}`, enrollmentId: eid(n), customer: { id: cid(n), fullName: `Học viên ${n}` } })),
    issuedCount: ids.filter((n) => n !== 3).length,
    existingCount: ids.filter((n) => n === 3).length,
    debtWarnings: [{ enrollmentId: eid(1), customerName: 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', contractCode: 'HD-001', debt: 1_500_000 }],
  };
}

type Handler = (method: string, path: string, body: unknown) => Response | Promise<Response> | undefined;

function setupServer(over?: Handler, data: ClassCertificateRoster = roster()) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      const path = url.pathname.replace('/api/v1', '') + url.search;
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, path, body, headers: { ...(init?.headers as Record<string, string>) } });
      const o = over?.(method, path, body);
      if (o) return o;
      if (method === 'GET' && url.pathname === `/api/v1/orgs/${ORG}/classes/${CLASS}/certificates`) return json(200, data);
      if (method === 'POST' && url.pathname === `/api/v1/orgs/${ORG}/classes/${CLASS}/certificates`) return json(201, issued([1, 2, 3, 5]));
      return apiErr(404, 'NOT_FOUND', `Không có đường ${method} ${url.pathname}`);
    }),
  );
  return calls;
}

const png = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
const renderDeps: Partial<RenderDeps> = { renderPng: async () => png(), toJpeg: async () => JPEG_1X1 };

function open(props: Partial<React.ComponentProps<typeof IssueDialog>> = {}) {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <IssueDialog orgId={ORG} slug="hv" classId={CLASS} title="K12" canEditBrand={false} onClose={onClose} breakpoint="desktop" renderDeps={renderDeps} {...props} />
    </MemoryRouter>,
  );
  return { onClose };
}

const dialog = () => screen.findByRole('dialog', { name: 'Cấp giấy chứng nhận' });
const posts = (calls: Call[]) => calls.filter((c) => c.method === 'POST');
// Chỉ tính các lần hỏi danh sách cấp (ảnh học viên cũng đi qua fetch GET để đổi thành blob).
const gets = (calls: Call[]) => calls.filter((c) => c.method === 'GET' && c.path.includes('/certificates'));
const rowOf = (d: HTMLElement, name: string) => within(d).getByRole('checkbox', { name: `Chọn ${name}` }).closest('li') as HTMLElement;
const footer = (d: HTMLElement) => d.querySelector('.ui-dialog__foot') as HTMLElement;

let objectUrls = 0;
beforeEach(() => {
  objectUrls = 0;
  setAccessToken('tok');
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => `blob:test/${(objectUrls += 1)}`, revokeObjectURL: () => undefined }));
  window.localStorage.clear();
});
afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true });
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true, writable: true });
});

describe('Hộp cấp — danh sách học viên', () => {
  it('tích sẵn mọi học viên TRỪ người "đã thu hồi chưa cấp lại"; dòng đã cấp hiện số; nhãn nợ / thiếu ảnh / ảnh nhỏ; số dự kiến theo thứ tự lớp', async () => {
    setupServer();
    open();
    const d = await dialog();
    await within(d).findByText('Chọn tất cả (5)');
    const checked = (n: string) => (within(d).getByRole('checkbox', { name: `Chọn ${n}` }) as HTMLInputElement).checked;
    expect(['Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', 'Phạm Quỳnh Hương', 'Hoàng Minh Anh', 'Bùi Khánh Linh'].map(checked)).toEqual([true, true, true, true]);
    expect(checked('Vũ Thu Trang')).toBe(false);
    expect((within(d).getByRole('checkbox', { name: 'Chọn tất cả (5)' }) as HTMLInputElement).indeterminate).toBe(true);

    expect(rowOf(d, 'Phạm Quỳnh Hương').textContent).toContain('Chưa cấp');
    const done = rowOf(d, 'Hoàng Minh Anh');
    expect(done.textContent).toContain('Đã cấp · CC-2026-0003');
    expect(within(done).getByText('Đã cấp', { selector: '.ui-tag' })).toBeTruthy();
    expect(rowOf(d, 'Vũ Thu Trang').textContent).toContain('Đã thu hồi CC-2026-0002 · cấp sẽ nhận số mới');
    expect(rowOf(d, 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo').textContent).toContain('Còn nợ 1.500.000 ₫');
    const noPhoto = rowOf(d, 'Phạm Quỳnh Hương');
    expect(noPhoto.textContent).toContain('chưa có ảnh — in chữ cái đầu');
    expect(within(noPhoto).getByRole('link', { name: 'Thêm ảnh' }).getAttribute('href')).toBe(`/hv/khach-hang/${cid(2)}`);
    expect(rowOf(d, 'Bùi Khánh Linh').textContent).toContain('ảnh nhỏ, in có thể mờ');

    // 3 người cấp mới (1, 2, 5) + 1 in lại (3); số theo thứ tự danh sách lớp: 0008 → 0010.
    expect(footer(d).textContent).toBe('Đã chọn 4 học viên · 3 cấp mới + 1 in lại · 4 trang A4 ngang' + 'Cấp và in (4)');
    expect(within(d).getByText('Tự cấp: CC-2026-0008 → 0010 (dự kiến)')).toBeTruthy();
    expect(within(d).getByText('Học viên đã huỷ ghi danh không hiện ở đây')).toBeTruthy();
  });

  it('nhãn nợ CHỈ khi thấy tiền: moneyVisible=false (dù dữ liệu lọt số tiền) → không có chữ "Còn nợ" ở đâu cả, kể cả hộp xác nhận', async () => {
    const r = roster({ moneyVisible: false });
    // Máy chủ đáng lẽ trả null; cố ý để lọt số tiền để thấy web TỰ chặn theo moneyVisible (không dựa vào may mắn).
    setupServer(undefined, r);
    open();
    const d = await dialog();
    await within(d).findByText('Chọn tất cả (5)');
    expect(d.textContent).not.toContain('Còn nợ');
    fireEvent.click(within(d).getByRole('button', { name: 'Cấp và in (4)' }));
    const c = await screen.findByRole('dialog', { name: 'Cấp 3 giấy chứng nhận mới?' });
    expect(c.textContent).not.toContain('nợ học phí');
  });

  it('chọn tất cả / bỏ tất cả; bỏ hết thì nút Cấp tắt; bỏ người đã cấp: số dự kiến và đếm đổi theo', async () => {
    setupServer();
    open();
    const d = await dialog();
    const all = await within(d).findByRole('checkbox', { name: 'Chọn tất cả (5)' });
    fireEvent.click(all);
    expect(footer(d).textContent).toContain('Đã chọn 5 học viên · 4 cấp mới + 1 in lại · 5 trang A4 ngang');
    expect(within(d).getByText('Tự cấp: CC-2026-0008 → 0011 (dự kiến)')).toBeTruthy();
    fireEvent.click(all);
    expect(footer(d).textContent).toContain('Đã chọn 0 học viên');
    expect((within(d).getByRole('button', { name: 'Cấp và in' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(d).getByRole('checkbox', { name: 'Chọn Hoàng Minh Anh' }));
    expect(footer(d).textContent).toContain('Đã chọn 1 học viên · 1 in lại · 1 trang A4 ngang');
    expect(within(d).getByRole('button', { name: 'In lại (1)' })).toBeTruthy();
  });

  it('lớp không có học viên đang học → thông báo, không có nút cấp; lỗi tải → lời tiếng Việt + Thử lại, bấm lại tải được', async () => {
    setupServer(undefined, roster({ items: [] }));
    open();
    const d = await dialog();
    expect(await within(d).findByText('Lớp này không có học viên đang học.')).toBeTruthy();
    expect(within(d).queryByRole('button', { name: /Cấp và in/ })).toBeNull();
    vi.unstubAllGlobals();
    cleanup();
    let fail = true;
    const calls = setupServer((m, p) => (m === 'GET' && p.includes('/certificates') && fail ? apiErr(500, 'INTERNAL', 'Máy chủ đang bận, thử lại sau ít phút') : undefined));
    open();
    const d2 = await dialog();
    expect(await within(d2).findByText('Máy chủ đang bận, thử lại sau ít phút')).toBeTruthy();
    fail = false;
    fireEvent.click(within(d2).getByRole('button', { name: 'Thử lại' }));
    expect(await within(d2).findByText('Chọn tất cả (5)')).toBeTruthy();
    expect(gets(calls)).toHaveLength(2);
  });
});

describe('Hộp cấp — mẫu, cài đặt, xem trước', () => {
  it('16 mẫu có ảnh nhỏ, mặc định cc-01; mẫu dùng lần trước (localStorage) được chọn sẵn; chọn mẫu khác đổi khung xem trước', async () => {
    window.localStorage.setItem(TEMPLATE_MEMO_KEY(ORG), 'cc-05');
    setupServer();
    open();
    const d = await dialog();
    const group = await within(d).findByRole('radiogroup', { name: 'Mẫu giấy chứng nhận' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(16);
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(radios.map((_, i) => String(i === 4)));
    expect(within(group).getByRole('radio', { name: '05 · Hoa văn vàng cổ điển' }).querySelector('img')?.getAttribute('src')).toBe('/mau/anh-nho/cc-05.jpg');
    expect(within(group).getByRole('radio', { name: '16 · Vinh danh kim cương' })).toBeTruthy();
    const frame = () => d.querySelector('iframe') as HTMLIFrameElement;
    await waitFor(() => expect(frame().getAttribute('src')).toContain('/mau/cc-05.html?'));
    fireEvent.click(within(group).getByRole('radio', { name: '02 · Đen nhung mảng đỏ' }));
    await waitFor(() => expect(frame().getAttribute('src')).toContain('/mau/cc-02.html?'));
  });

  it('localStorage hỏng (ném lỗi) vẫn mở được, dùng cc-01', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bị chặn');
    });
    setupServer();
    open();
    const d = await dialog();
    const group = await within(d).findByRole('radiogroup', { name: 'Mẫu giấy chứng nhận' });
    expect(within(group).getByRole('radio', { name: '01 · Xanh đêm dải vàng' }).getAttribute('aria-checked')).toBe('true');
    spy.mockRestore();
  });

  it('xem trước ĐÚNG từng người: bấm tên → khung đổi tên, số dự kiến đúng vị trí, ảnh; người đã cấp giữ số + mẫu cũ + nhãn "in lại bản cũ"; nút ‹ › nhảy qua người được chọn', async () => {
    setupServer();
    open();
    const d = await dialog();
    await within(d).findByText('Chọn tất cả (5)');
    const src = () => new URL((d.querySelector('iframe') as HTMLIFrameElement).getAttribute('src') ?? '', 'http://x').searchParams;
    // Người đầu: số dự kiến 0008.
    await waitFor(() => expect(src().get('ten')).toBe('Tôn Nữ Hoàng Bảo Ngọc Phương Thảo'));
    expect(src().get('so')).toBe('CC-2026-0008');
    expect(src().get('ncap')).toBe('10/10/2026');
    expect(src().get('khoa')).toBe('Makeup chuyên nghiệp');
    expect(src().get('lop')).toBe('K12');
    expect(src().get('gv')).toBe('Nguyễn Thu Hà');
    expect(src().get('gd')).toBe('Nguyễn Trọng Chiến');
    expect(src().get('that')).toBe('1');
    expect(within(d).getByText('Số trên bản xem trước là số dự kiến')).toBeTruthy();
    expect(within(d).getByText('1/4 · Tôn Nữ Hoàng Bảo Ngọc Phương Thảo')).toBeTruthy();
    // Người thứ hai (chưa có ảnh): số 0009, không có tham số anh.
    fireEvent.click(within(d).getByRole('button', { name: 'Học viên sau' }));
    await waitFor(() => expect(src().get('ten')).toBe('Phạm Quỳnh Hương'));
    expect(src().get('so')).toBe('CC-2026-0009');
    expect(src().get('anh')).toBeNull();
    // Người đã cấp: mẫu cũ cc-04, số cũ 0003, bản chụp lúc cấp.
    fireEvent.click(within(d).getByRole('button', { name: 'Học viên sau' }));
    await waitFor(() => expect((d.querySelector('iframe') as HTMLIFrameElement).getAttribute('src')).toContain('/mau/cc-04.html?'));
    expect(src().get('so')).toBe('CC-2026-0003');
    expect(src().get('ten')).toBe('Hoàng Minh Anh');
    // Nhãn trên khung chỉ hiện khi khung vẽ xong (sự kiện load của iframe).
    fireEvent.load(d.querySelector('iframe') as HTMLIFrameElement);
    expect(await within(d).findByText('Đã cấp · CC-2026-0003 · in lại bản cũ')).toBeTruthy();
    expect(within(d).queryByText('Số trên bản xem trước là số dự kiến')).toBeNull();
    // Bấm tên người KHÔNG được chọn: xem được, ghi "Chưa chọn"; ‹ › bỏ qua người chưa chọn (3 → 5).
    fireEvent.click(within(d).getByRole('button', { name: 'Xem trước giấy của Vũ Thu Trang' }));
    await waitFor(() => expect(src().get('ten')).toBe('Vũ Thu Trang'));
    expect(src().get('so')).toBeNull();
    expect(within(d).getByText('Chưa chọn · Vũ Thu Trang')).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Học viên sau' }));
    await waitFor(() => expect(src().get('ten')).toBe('Bùi Khánh Linh'));
    expect(src().get('so')).toBe('CC-2026-0010');
    expect(within(d).getByText('4/4 · Bùi Khánh Linh')).toBeTruthy();
    // Phông đổi theo lựa chọn.
    fireEvent.change(within(d).getByLabelText('Phông tên học viên'), { target: { value: 'ky-3' } });
    await waitFor(() => expect(src().get('ky')).toBe('3'));
  });

  it('dòng "Người ký": ghi rõ khi thiếu giảng viên / tên Giám đốc; liên kết "Sửa" chỉ khi có org.update', async () => {
    const r = roster({ signer: { name: null, title: 'Giám đốc trung tâm' }, class: { ...roster().class, instructorName: null } });
    setupServer(undefined, r);
    open({ canEditBrand: true });
    const d = await dialog();
    expect(await within(d).findByText(/chưa gán giảng viên · chưa điền tên Giám đốc/)).toBeTruthy();
    expect(within(d).getByRole('link', { name: 'Sửa' }).getAttribute('href')).toBe('/hv/cai-dat/thuong-hieu');
    vi.unstubAllGlobals();
    cleanup();
    setupServer(undefined, r);
    open({ canEditBrand: false });
    const d2 = await dialog();
    await within(d2).findByText(/chưa gán giảng viên/);
    expect(within(d2).queryByRole('link', { name: 'Sửa' })).toBeNull();
  });
});

describe('Hộp cấp — ngày cấp', () => {
  it('ngày cấp mặc định = ngày kết thúc lớp; trước ngày kết thúc hoặc sau hôm nay → lỗi dưới ô, nút Cấp tắt, không gọi máy chủ', async () => {
    const calls = setupServer();
    open();
    const d = await dialog();
    const user = userEvent.setup();
    const input = (await within(d).findByLabelText('Ngày cấp')) as HTMLInputElement;
    expect(input.value).toBe('10/10/2026');
    await user.clear(input);
    await user.type(input, '09/10/2026');
    expect(await within(d).findByText('Ngày cấp phải từ ngày kết thúc lớp (10/10/2026) trở đi')).toBeTruthy();
    expect((within(d).getByRole('button', { name: 'Cấp và in (4)' }) as HTMLButtonElement).disabled).toBe(true);
    await user.clear(input);
    await user.type(input, '19/10/2026');
    expect(await within(d).findByText('Ngày cấp không được sau hôm nay')).toBeTruthy();
    expect(posts(calls)).toHaveLength(0);
  });

  it('đổi sang NĂM khác → hỏi lại máy chủ với issuedOn để cập nhật số dự kiến; cùng năm thì không hỏi', async () => {
    const r = roster({ today: '2027-03-01' });
    const calls = setupServer((m, p) => {
      if (m === 'GET' && p.includes('issuedOn=2027-01-05')) return json(200, { ...r, nextNumber: { year: 2027, seq: 1, code: 'CC-2027-0001' } });
      return undefined;
    }, r);
    open();
    const d = await dialog();
    const user = userEvent.setup();
    const input = (await within(d).findByLabelText('Ngày cấp')) as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '15/10/2026');
    expect(gets(calls)).toHaveLength(1);
    await user.clear(input);
    await user.type(input, '05/01/2027');
    expect(await within(d).findByText('Tự cấp: CC-2027-0001 → 0003 (dự kiến)')).toBeTruthy();
    expect(gets(calls).map((c) => c.path)).toEqual([`/orgs/${ORG}/classes/${CLASS}/certificates`, `/orgs/${ORG}/classes/${CLASS}/certificates?issuedOn=2027-01-05`]);
  });
});

describe('Hộp cấp — cấp và in', () => {
  it('Cấp và in (4): hộp xác nhận có dải số + cảnh báo nợ KHÔNG chặn → POST đúng thân + Idempotency-Key → bản in mở ngay trong hộp, nhớ mẫu', async () => {
    const calls = setupServer();
    open();
    const d = await dialog();
    await within(d).findByText('Chọn tất cả (5)');
    fireEvent.click(within(d).getByRole('radio', { name: '05 · Hoa văn vàng cổ điển' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Cấp và in (4)' }));
    const c = await screen.findByRole('dialog', { name: 'Cấp 3 giấy chứng nhận mới?' });
    expect(c.textContent).toContain('Số dự kiến CC-2026-0008 → 0010, ngày cấp 10/10/2026, mẫu 05 · Hoa văn vàng cổ điển.');
    expect(c.textContent).toContain('1 học viên đã có giấy: in lại bản cũ (giữ số cũ, mẫu cũ).');
    expect(c.textContent).toContain('1 học viên còn nợ học phí (tổng 1.500.000 ₫). Vẫn cấp được.');
    expect(c.textContent).toContain('Đã cấp thì số và tên không sửa được.');
    expect(posts(calls)).toHaveLength(0);
    fireEvent.click(within(c).getByRole('button', { name: 'Cấp và mở bản in' }));
    // Bản in thay thân hộp.
    expect(await screen.findByRole('button', { name: 'In ngay' })).toBeTruthy();
    const p = posts(calls);
    expect(p).toHaveLength(1);
    expect(p[0]?.path).toBe(`/orgs/${ORG}/classes/${CLASS}/certificates`);
    expect(p[0]?.body).toEqual({ enrollmentIds: [eid(1), eid(2), eid(3), eid(5)], templateCode: 'cc-05', issuedOn: '2026-10-10' });
    expect(p[0]?.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    const out = await dialog();
    expect(within(out).getByText(/Đã cấp 3 giấy chứng nhận \(CC-2026-0008 → 0012\)\. 1 học viên đã có giấy được in lại bản cũ\./)).toBeTruthy();
    expect(within(out).getByText(/Tệp PDF: 4 trang A4 ngang, mỗi học viên một trang/)).toBeTruthy();
    expect(within(out).getByText(/1 học viên còn nợ học phí, giấy vẫn được cấp: Tôn Nữ Hoàng Bảo Ngọc Phương Thảo \(1\.500\.000 ₫\)/)).toBeTruthy();
    expect(within(out).getByRole('link', { name: 'Xem sổ giấy chứng nhận' }).getAttribute('href')).toBe(`/hv/giay-chung-nhan?lop=${CLASS}`);
    expect(window.localStorage.getItem(TEMPLATE_MEMO_KEY(ORG))).toBe('cc-05');
  });

  it('BẮT khoá: bấm lại sau lỗi mạng DÙNG LẠI cùng Idempotency-Key; đổi mẫu (hoặc phông, ngày, danh sách chọn) → khoá MỚI', async () => {
    let n = 0;
    const calls = setupServer((m) => {
      if (m !== 'POST') return undefined;
      n += 1;
      if (n <= 3) throw new TypeError('Failed to fetch');
      return undefined;
    });
    open();
    const d = await dialog();
    await within(d).findByText('Chọn tất cả (5)');
    const keyOf = (i: number) => posts(calls)[i]?.headers['Idempotency-Key'];
    fireEvent.click(within(d).getByRole('button', { name: 'Cấp và in (4)' }));
    let c = await screen.findByRole('dialog', { name: 'Cấp 3 giấy chứng nhận mới?' });
    fireEvent.click(within(c).getByRole('button', { name: 'Cấp và mở bản in' }));
    expect(await within(c).findByText(/Không kết nối được máy chủ/)).toBeTruthy();
    fireEvent.click(within(c).getByRole('button', { name: 'Cấp và mở bản in' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(2));
    expect(keyOf(1)).toBe(keyOf(0));
    // Đóng hộp xác nhận, đổi mẫu → khoá mới.
    await waitFor(() => expect(within(c).queryByText('Đang xử lý…')).toBeNull());
    fireEvent.click(within(c).getByRole('button', { name: 'Huỷ' }));
    fireEvent.click(within(d).getByRole('radio', { name: '03 · Trắng sóng đỏ vàng' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Cấp và in (4)' }));
    c = await screen.findByRole('dialog', { name: 'Cấp 3 giấy chứng nhận mới?' });
    fireEvent.click(within(c).getByRole('button', { name: 'Cấp và mở bản in' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(3));
    expect(keyOf(2)).not.toBe(keyOf(0));
    // Đổi danh sách chọn → khoá mới nữa; rồi thành công (lần 4).
    await within(c).findByText(/Không kết nối được máy chủ/);
    fireEvent.click(within(c).getByRole('button', { name: 'Huỷ' }));
    fireEvent.click(within(d).getByRole('checkbox', { name: 'Chọn Bùi Khánh Linh' }));
    fireEvent.click(within(d).getByRole('button', { name: 'Cấp và in (3)' }));
    c = await screen.findByRole('dialog', { name: 'Cấp 2 giấy chứng nhận mới?' });
    fireEvent.click(within(c).getByRole('button', { name: 'Cấp và mở bản in' }));
    await screen.findByRole('button', { name: 'In ngay' });
    expect(posts(calls)).toHaveLength(4);
    expect(new Set([keyOf(0), keyOf(2), keyOf(3)]).size).toBe(3);
  });

  it('409 CLASS_NOT_ENDED (lớp vừa bị sửa ngày): hiện ĐÚNG lời máy chủ, đóng hộp xác nhận, tải lại danh sách', async () => {
    const calls = setupServer((m) =>
      m === 'POST' ? apiErr(409, 'CONFLICT', 'Lớp kết thúc ngày 20/12/2026 — cấp được từ ngày đó', { reason: 'CLASS_NOT_ENDED', endDate: '2026-12-20' }) : undefined,
    );
    open();
    const d = await dialog();
    await within(d).findByText('Chọn tất cả (5)');
    fireEvent.click(within(d).getByRole('button', { name: 'Cấp và in (4)' }));
    const c = await screen.findByRole('dialog', { name: 'Cấp 3 giấy chứng nhận mới?' });
    fireEvent.click(within(c).getByRole('button', { name: 'Cấp và mở bản in' }));
    expect((await within(d).findByRole('alert')).textContent).toBe('Lớp kết thúc ngày 20/12/2026 — cấp được từ ngày đó');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cấp 3 giấy chứng nhận mới?' })).toBeNull());
    await waitFor(() => expect(gets(calls)).toHaveLength(2));
  });

  it('400 ngày cấp: lỗi hiện dưới ô Ngày cấp; 400 enrollmentIds: "Danh sách lớp vừa thay đổi" + tải lại; 409 CERTIFICATE_RACE: lời máy chủ + tải lại', async () => {
    let mode: 'date' | 'ids' | 'race' = 'date';
    const calls = setupServer((m) => {
      if (m !== 'POST') return undefined;
      if (mode === 'date') return apiErr(400, 'VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', { issues: [{ path: 'issuedOn', message: 'Ngày cấp không được sau hôm nay' }] });
      if (mode === 'ids') return apiErr(400, 'VALIDATION_FAILED', 'Dữ liệu chưa hợp lệ', { issues: [{ path: 'enrollmentIds.2', message: 'Không tìm thấy học viên này trong lớp' }] });
      return apiErr(409, 'CONFLICT', 'Vừa có người cấp cho học viên này — tải lại danh sách', { reason: 'CERTIFICATE_RACE' });
    });
    open();
    const d = await dialog();
    await within(d).findByText('Chọn tất cả (5)');
    const submit = async () => {
      fireEvent.click(within(d).getByRole('button', { name: /^Cấp và in \(/ }));
      const c = await screen.findByRole('dialog', { name: /^Cấp \d+ giấy chứng nhận mới\?$/ });
      fireEvent.click(within(c).getByRole('button', { name: 'Cấp và mở bản in' }));
    };
    await submit();
    expect(await within(d).findByText('Ngày cấp không được sau hôm nay')).toBeTruthy();
    expect(gets(calls)).toHaveLength(1);
    mode = 'ids';
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /giấy chứng nhận mới\?$/ })).toBeNull());
    await within(d).findByText('Chọn tất cả (5)');
    // Sửa lại ngày hợp lệ để bấm tiếp (lỗi từ máy chủ là của lần gửi trước).
    const user = userEvent.setup();
    const input = within(d).getByLabelText('Ngày cấp') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '10/10/2026');
    await submit();
    expect((await within(d).findByRole('alert')).textContent).toBe('Danh sách lớp vừa thay đổi — đã tải lại, bạn kiểm tra rồi bấm lại.');
    await waitFor(() => expect(gets(calls)).toHaveLength(2));
    mode = 'race';
    await within(d).findByText('Chọn tất cả (5)');
    await submit();
    await waitFor(() => expect(within(d).getByRole('alert').textContent).toBe('Vừa có người cấp cho học viên này — tải lại danh sách'));
    await waitFor(() => expect(gets(calls)).toHaveLength(3));
  });

  it('BẮT: 0 người cấp mới (chỉ chọn người đã có giấy) → nút "In lại (1)", KHÔNG hộp xác nhận, KHÔNG gọi POST, mở thẳng bản in với giấy cũ', async () => {
    const calls = setupServer();
    open();
    const d = await dialog();
    await within(d).findByText('Chọn tất cả (5)');
    const all = within(d).getByRole('checkbox', { name: 'Chọn tất cả (5)' });
    fireEvent.click(all);
    fireEvent.click(all);
    fireEvent.click(within(d).getByRole('checkbox', { name: 'Chọn Hoàng Minh Anh' }));
    fireEvent.click(within(d).getByRole('button', { name: 'In lại (1)' }));
    expect(await screen.findByRole('button', { name: 'In ngay' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: /giấy chứng nhận mới\?$/ })).toBeNull();
    expect(posts(calls)).toHaveLength(0);
    const out = await dialog();
    expect(within(out).getByText(/Tệp PDF: 1 trang A4 ngang/)).toBeTruthy();
    expect(within(out).getByText('CC-2026-0003')).toBeTruthy();
  });

  it('lớp chưa kết thúc (lớp vừa bị sửa ngày): dải vàng đúng chữ, nút Cấp tắt; lớp đã huỷ: dải riêng', async () => {
    setupServer(undefined, roster({ ended: false, defaultIssuedOn: null, nextNumber: null, class: { ...roster().class, endDate: '2026-12-20' } }));
    open();
    const d = await dialog();
    expect(await within(d).findByText('Lớp kết thúc 20/12/2026 — cấp được từ ngày đó.')).toBeTruthy();
    expect((within(d).getByRole('button', { name: 'Cấp và in (4)' }) as HTMLButtonElement).disabled).toBe(true);
    vi.unstubAllGlobals();
    cleanup();
    setupServer(undefined, roster({ ended: false, defaultIssuedOn: null, nextNumber: null, class: { ...roster().class, status: 'CANCELLED' } }));
    open();
    expect(await within(await dialog()).findByText('Lớp đã huỷ — không cấp được giấy chứng nhận.')).toBeTruthy();
  });
});

describe('Hộp cấp — điện thoại', () => {
  it('hai bước Segmented "Học viên (5)" | "Mẫu & xem trước": mỗi bước một phần; bấm tên học viên nhảy sang xem trước người đó', async () => {
    setupServer();
    open({ breakpoint: 'phone' });
    const d = await dialog();
    const seg = await within(d).findByRole('radiogroup', { name: 'Bước cấp giấy chứng nhận' });
    expect(within(seg).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Học viên (5)', 'Mẫu & xem trước']);
    expect(within(seg).getByRole('radio', { name: 'Học viên (5)' }).getAttribute('aria-checked')).toBe('true');
    expect(within(d).getByText('Chọn tất cả (5)')).toBeTruthy();
    expect(within(d).queryByRole('radiogroup', { name: 'Mẫu giấy chứng nhận' })).toBeNull();
    expect(d.querySelector('iframe')).toBeNull();
    fireEvent.click(within(d).getByRole('button', { name: 'Xem trước giấy của Phạm Quỳnh Hương' }));
    expect(await within(d).findByRole('radiogroup', { name: 'Mẫu giấy chứng nhận' })).toBeTruthy();
    expect(within(d).queryByText('Chọn tất cả (5)')).toBeNull();
    await waitFor(() => expect(new URL((d.querySelector('iframe') as HTMLIFrameElement).getAttribute('src') ?? '', 'http://x').searchParams.get('ten')).toBe('Phạm Quỳnh Hương'));
    expect(within(d).getByText('Vuốt trái / phải để xem từng học viên.')).toBeTruthy();
    // Vuốt trái 60px → người kế (Hoàng Minh Anh); vuốt ngắn 20px → không đổi.
    const swipe = d.querySelector('.gcn-iss__swipe') as HTMLElement;
    fireEvent.pointerDown(swipe, { clientX: 200, clientY: 100 });
    fireEvent.pointerUp(swipe, { clientX: 180, clientY: 100 });
    expect(within(d).getByText('2/4 · Phạm Quỳnh Hương')).toBeTruthy();
    fireEvent.pointerDown(swipe, { clientX: 200, clientY: 100 });
    fireEvent.pointerUp(swipe, { clientX: 140, clientY: 104 });
    expect(await within(d).findByText('3/4 · Hoàng Minh Anh')).toBeTruthy();
    fireEvent.pointerDown(swipe, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(swipe, { clientX: 170, clientY: 100 });
    expect(await within(d).findByText('2/4 · Phạm Quỳnh Hương')).toBeTruthy();
    // Thanh dưới luôn có nút Cấp và in.
    expect(within(footer(d)).getByRole('button', { name: 'Cấp và in (4)' })).toBeTruthy();
  });

  it('sau khi cấp trên điện thoại: bản in KHÔNG có "In ngay"; có "Chia sẻ PDF (In / Zalo / Lưu)" khi máy chia sẻ được tệp, và navigator.share chạy trong lượt bấm', async () => {
    const calls = setupServer();
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true, writable: true });
    const shared: ShareData[] = [];
    Object.defineProperty(navigator, 'share', {
      value: (data: ShareData) => {
        shared.push(data);
        return Promise.resolve();
      },
      configurable: true,
      writable: true,
    });
    open({ breakpoint: 'phone' });
    const d = await dialog();
    await within(d).findByText('Chọn tất cả (5)');
    fireEvent.click(within(footer(d)).getByRole('button', { name: 'Cấp và in (4)' }));
    const c = await screen.findByRole('dialog', { name: 'Cấp 3 giấy chứng nhận mới?' });
    fireEvent.click(within(c).getByRole('button', { name: 'Cấp và mở bản in' }));
    const share = await screen.findByRole('button', { name: 'Chia sẻ PDF (In / Zalo / Lưu)' });
    expect(screen.queryByRole('button', { name: 'In ngay' })).toBeNull();
    fireEvent.click(share);
    expect(shared).toHaveLength(1);
    expect(shared[0]?.files?.[0]?.name).toBe('Giay-chung-nhan-k12-2026-10-10.pdf');
    expect(posts(calls)).toHaveLength(1);
  });
});
