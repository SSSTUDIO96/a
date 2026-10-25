import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES } from '@makeup/shared';
import { routes } from '../../app/routes';
import type { CertificatePage, CertificateView } from '../../api/certificates';
import { fakeView } from './fixtures';
import { todayInTz, viDate } from './logic';
import { registerPerms, statusLabel } from './RegisterPage';
import { ENROLLMENT_CANCELLED_MESSAGE } from './ReissueDialog';
import { REVOKE_MESSAGE_MAX, revokeConsequence } from './RevokeDialog';

// Sổ giấy chứng nhận chạy thật trong khung (phiên, router, quyền) với máy chủ giả lập qua fetch (bản vẽ F mục 6.5, 9.3; ký duyệt F câu 2):
// lọc (năm, từ khoá, trạng thái, lớp), phân trang, chọn nhiều + In lại, hộp cấp lại, thu hồi bắt lý do, quyền theo vai trò mẫu, ba khổ màn.
configure({ asyncUtilTimeout: 5000 });

// Bản in trong bài thử: không vẽ thật (jsdom không có canvas / iframe thật) nhưng GHI LẠI địa chỉ khung đã dựng cho từng giấy.
const hoisted = vi.hoisted(() => ({ rendered: [] as string[] }));
vi.mock('./render', async (orig) => {
  const real = await orig<typeof import('./render')>();
  const { JPEG_1X1 } = await import('./fixtures');
  return {
    ...real,
    renderCertificates: (views: CertificateView[], opts: Parameters<typeof real.renderCertificates>[1]) =>
      real.renderCertificates(views, {
        ...opts,
        deps: {
          ...opts?.deps,
          renderPng: async (src: string) => {
            hoisted.rendered.push(src);
            return new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
          },
          toJpeg: async () => JPEG_1X1,
        },
      }),
  };
});

const T = '2026-10-18T03:00:00.000Z';
const ORG = { membershipId: 'm-1', id: 'org-1', name: 'Makeup Pro Academy', slug: 'hv', kind: 'ACADEMY', roles: [{ key: 'owner', name: 'Chủ tài khoản' }] };
const CLASS_ID = '20000000-0000-4000-8000-000000000001';
const TODAY = todayInTz('Asia/Ho_Chi_Minh');
const THIS_YEAR = Number(TODAY.slice(0, 4));

interface Call {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}
type Override = (method: string, path: string, body: unknown) => Response | undefined;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const apiErr = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details, requestId: 'r' } });

// Bốn bản: 0011 cấp lại (hiệu lực), 0011 bản gốc đã thu hồi, 0008 (tên sai dấu), 0003 (bản gốc).
const A = fakeView(3, { studentName: 'Hoàng Minh Anh', templateCode: 'cc-05' });
const B = fakeView(8, { studentName: 'Le Thi Mai', customer: { id: 'c-mai', fullName: 'Lê Thị Mai' }, templateCode: 'cc-05' });
const C = fakeView(15, { code: 'CC-2026-0011', seq: 11, reissueNo: 1, reissuedOn: '2026-10-20', replacesId: 'rv', studentName: 'Phạm Quỳnh Hương', customer: { id: 'c-huong', fullName: 'Phạm Quỳnh Hương' }, templateCode: 'cc-05' });
const R = fakeView(12, {
  code: 'CC-2026-0011',
  seq: 11,
  status: 'REVOKED',
  revokedAt: T,
  revokeReason: 'Sai tên người nhận',
  replacedById: C.id,
  studentName: 'Phạm Quỳnh Hương',
  customer: { id: 'c-huong', fullName: 'Phạm Quỳnh Hương' },
  templateCode: 'cc-05',
});
const ALL: CertificateView[] = [C, R, B, A];

const pageOf = (items: CertificateView[], over: Partial<CertificatePage> = {}): CertificatePage => ({ items, page: 1, pageSize: 50, total: items.length, years: [THIS_YEAR, THIS_YEAR - 1], ...over });

function setupServer(permissions: readonly string[], override?: Override, list: () => CertificatePage = () => pageOf(ALL)) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const method = init?.method ?? 'GET';
      const path = url.pathname.replace('/api/v1', '');
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      if (!path.startsWith('/auth')) calls.push({ method, path: path + url.search, body, headers: { ...(init?.headers as Record<string, string>) } });
      const o = override?.(method, path + url.search, body);
      if (o) return o;
      if (path === '/auth/refresh') return json(200, { accessToken: 'tok', expiresIn: 900 });
      if (path === '/auth/me') return json(200, { id: 'u-1', email: 'a@b.vn', fullName: 'Nguyễn Trọng Chiến', organizations: [ORG] });
      if (path === '/orgs/org-1') return json(200, { ...ORG, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', myRoles: ['owner'], myPermissions: [...permissions] });
      if (path === '/orgs/org-1/certificates' && method === 'GET') {
        const ids = url.searchParams.get('ids');
        if (ids) return json(200, pageOf(pool.filter((c) => ids.split(',').includes(c.id))));
        return json(200, list());
      }
      return apiErr(404, 'NOT_FOUND', `Không có đường ${method} ${path}`);
    }),
  );
  return calls;
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

type Viewport = 'phone' | 'tablet' | 'desktop';
function setViewport(v: Viewport) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: (v === 'phone' && q === '(max-width: 640px)') || (v === 'tablet' && q === '(min-width: 641px) and (max-width: 1180px)'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

const OWNER = SYSTEM_ROLES.owner.permissions;
const registerGets = (calls: Call[]) => calls.filter((c) => c.method === 'GET' && c.path.startsWith('/orgs/org-1/certificates'));
const listGets = (calls: Call[]) => registerGets(calls).filter((c) => !c.path.includes('ids='));
const idsGets = (calls: Call[]) => registerGets(calls).filter((c) => c.path.includes('ids='));
const posts = (calls: Call[]) => calls.filter((c) => c.method === 'POST');
// Tên in trên giấy trong địa chỉ khung đã dựng (tham số ten).
const tenOf = (src: string | undefined) => new URL(src ?? '/', 'http://x').searchParams.get('ten');
const queryOf = (c: Call | undefined) => new URL(c?.path ?? '/', 'http://x').searchParams;

async function rows(): Promise<HTMLElement[]> {
  const table = await screen.findByRole('table');
  return within(table).getAllByRole('row').slice(1);
}
const rowOf = async (code: string, status?: string) => (await rows()).find((r) => r.getAttribute('data-code') === code && (!status || r.getAttribute('data-status') === status)) as HTMLElement;

let objectUrls = 0;
let pool: CertificateView[] = ALL;
beforeEach(() => {
  objectUrls = 0;
  hoisted.rendered = [];
  pool = ALL;
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => `blob:test/${(objectUrls += 1)}`, revokeObjectURL: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('logic của sổ', () => {
  it('statusLabel: Hiệu lực · bản cấp lại dd/mm/yyyy · Đã thu hồi; bản cấp lại thiếu ngày thì ném lỗi (không bịa ngày)', () => {
    expect(statusLabel(A)).toBe('Hiệu lực');
    expect(statusLabel(C)).toBe('Hiệu lực · bản cấp lại 20/10/2026');
    expect(statusLabel(R)).toBe('Đã thu hồi');
    expect(() => statusLabel({ status: 'ISSUED', reissueNo: 1, reissuedOn: null })).toThrow(/reissuedOn/);
  });

  it('quyền theo vai trò mẫu: Chủ, Quản trị, Quản lý xem + cấp lại + thu hồi; Lễ tân, Giảng viên chỉ xem + in lại; còn lại không thấy sổ', () => {
    const has = (k: keyof typeof SYSTEM_ROLES) => (p: string) => (SYSTEM_ROLES[k].permissions as readonly string[]).includes(p);
    const of = (k: keyof typeof SYSTEM_ROLES) => registerPerms(has(k) as Parameters<typeof registerPerms>[0]);
    for (const k of ['owner', 'admin', 'manager'] as const) expect(of(k), k).toEqual({ read: true, issue: true });
    for (const k of ['receptionist', 'instructor'] as const) expect(of(k), k).toEqual({ read: true, issue: false });
    for (const k of ['artist', 'assistant', 'accountant', 'teaching_assistant'] as const) expect(of(k), k).toEqual({ read: false, issue: false });
  });

  it('revokeConsequence: nêu hậu quả, không quá 90 ký tự kể cả số dài nhất (CC-2999-999999)', () => {
    const t = revokeConsequence('CC-2026-0011');
    expect(t).toBe('Số CC-2026-0011 không dùng lại. Giấy đã in coi như hết giá trị.');
    expect(revokeConsequence('CC-2999-999999').length).toBeLessThanOrEqual(REVOKE_MESSAGE_MAX);
    expect(() => revokeConsequence('x'.repeat(60))).toThrow(/90/);
  });
});

describe('Sổ — danh sách và trạng thái', () => {
  it('tải đúng năm nay + 50 dòng; bảng có Số, Học viên, Khoá · Lớp, Ngày cấp, Mẫu, Trạng thái; thứ tự theo máy chủ; ngày dd/mm/yyyy', async () => {
    const calls = setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan');
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['', 'Số', 'Học viên', 'Khoá · Lớp', 'Ngày cấp', 'Mẫu', 'Trạng thái', 'Thao tác']);
    const q = queryOf(listGets(calls)[0]);
    expect(q.get('year')).toBe(String(THIS_YEAR));
    expect(q.get('page')).toBe('1');
    expect(q.get('pageSize')).toBe('50');
    expect([...q.keys()].sort()).toEqual(['page', 'pageSize', 'year']);
    const rs = await rows();
    expect(rs.map((r) => r.getAttribute('data-code'))).toEqual(['CC-2026-0011', 'CC-2026-0011', 'CC-2026-0008', 'CC-2026-0003']);
    expect(within(rs[3] as HTMLElement).getByText('20/12/2026')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Giấy chứng nhận' })).toBeTruthy();
    expect(screen.getByText('Sổ giấy chứng nhận của trung tâm')).toBeTruthy();
  });

  it('"Hiệu lực" · "Hiệu lực · bản cấp lại 20/10/2026" · "Đã thu hồi" kèm ngày và lý do; bản thu hồi KHÔNG có ô chọn, không có nút', async () => {
    setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan');
    const a = await rowOf('CC-2026-0003');
    expect(within(a).getByText('Hiệu lực')).toBeTruthy();
    const c = await rowOf('CC-2026-0011', 'ISSUED');
    expect(within(c).getByText('Hiệu lực · bản cấp lại 20/10/2026')).toBeTruthy();
    const r = await rowOf('CC-2026-0011', 'REVOKED');
    const tag = within(r).getByText('Đã thu hồi', { selector: '.ui-tag' });
    expect(tag.getAttribute('title')).toBe('Sai tên người nhận');
    expect(r.textContent).toContain('Sai tên người nhận');
    expect(r.textContent).toContain('đã có bản cấp lại');
    expect(within(r).queryByRole('checkbox')).toBeNull();
    expect(within(r).queryByRole('button')).toBeNull();
    // Mẫu hiện số mẫu (05), tên mẫu ở tooltip.
    expect(within(a).getByText('05').getAttribute('title')).toMatch(/^05 · /);
  });

  it('máy chủ lỗi 500 → dải lỗi + Thử lại tải lại được; 403 → lời máy chủ, KHÔNG có Thử lại', async () => {
    let fail = true;
    setupServer(OWNER, (m, p) => (m === 'GET' && p.startsWith('/orgs/org-1/certificates') && fail ? apiErr(500, 'INTERNAL', 'Máy chủ gặp lỗi, vui lòng thử lại.') : undefined));
    renderAt('/hv/giay-chung-nhan');
    expect((await screen.findByRole('alert')).textContent).toContain('Máy chủ gặp lỗi');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('table')).toBeTruthy();
    cleanup();
    setupServer(OWNER, (m, p) => (m === 'GET' && p.startsWith('/orgs/org-1/certificates') ? apiErr(403, 'FORBIDDEN', 'Tổ chức chưa bật đào tạo') : undefined));
    renderAt('/hv/giay-chung-nhan');
    expect((await screen.findByRole('alert')).textContent).toContain('Tổ chức chưa bật đào tạo');
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });

  it('rỗng: năm nay chưa có → "Xem năm {năm gần nhất}"; chưa cấp bao giờ → liên kết sang Khoá & lớp; lọc không khớp → Xoá bộ lọc', async () => {
    const calls = setupServer(OWNER, undefined, () => pageOf([], { years: [THIS_YEAR - 1] }));
    renderAt('/hv/giay-chung-nhan');
    expect(await screen.findByText(`Năm ${THIS_YEAR} chưa có giấy chứng nhận nào.`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Xem năm ${THIS_YEAR - 1}` }));
    await waitFor(() => expect(queryOf(listGets(calls).at(-1)).get('year')).toBe(String(THIS_YEAR - 1)));
    cleanup();
    setupServer(OWNER, undefined, () => pageOf([], { years: [] }));
    renderAt('/hv/giay-chung-nhan?nam=tat-ca');
    expect(await screen.findByText(/Trung tâm chưa cấp giấy chứng nhận nào/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Khoá & lớp/ }).getAttribute('href')).toBe('/hv/dao-tao');
    cleanup();
    const calls3 = setupServer(OWNER, undefined, () => pageOf([], { years: [THIS_YEAR] }));
    renderAt('/hv/giay-chung-nhan?q=zzz');
    expect(await screen.findByText('Không có giấy chứng nhận nào khớp bộ lọc.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xoá bộ lọc, xem mọi năm' }));
    await waitFor(() => {
      const q = queryOf(listGets(calls3).at(-1));
      expect(q.has('q')).toBe(false);
      expect(q.has('year')).toBe(false);
    });
  });
});

describe('Sổ — lọc và phân trang (máy chủ lọc)', () => {
  it('đổi năm → gửi year; "Tất cả các năm" → không gửi year; năm lấy từ máy chủ (years)', async () => {
    const calls = setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan');
    const year = (await screen.findByLabelText('Năm')) as HTMLSelectElement;
    expect([...year.options].map((o) => o.textContent)).toEqual(['Tất cả các năm', `Năm ${THIS_YEAR}`, `Năm ${THIS_YEAR - 1}`]);
    expect(year.value).toBe(String(THIS_YEAR));
    fireEvent.change(year, { target: { value: String(THIS_YEAR - 1) } });
    await waitFor(() => expect(queryOf(listGets(calls).at(-1)).get('year')).toBe(String(THIS_YEAR - 1)));
    fireEvent.change(year, { target: { value: 'tat-ca' } });
    await waitFor(() => expect(queryOf(listGets(calls).at(-1)).has('year')).toBe(false));
  });

  it('ô tìm: gõ xong ~300 ms mới gọi máy chủ (không gọi từng phím), gửi q đã cắt khoảng trắng; xoá ô thì bỏ q; về trang 1', async () => {
    const calls = setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan?trang=3');
    const box = (await screen.findByPlaceholderText('Tìm số hoặc tên học viên')) as HTMLInputElement;
    await screen.findByRole('table');
    const before = listGets(calls).length;
    fireEvent.change(box, { target: { value: ' Mai ' } });
    expect(listGets(calls).length).toBe(before);
    await waitFor(() => expect(queryOf(listGets(calls).at(-1)).get('q')).toBe('Mai'));
    expect(queryOf(listGets(calls).at(-1)).get('page')).toBe('1');
    fireEvent.change(box, { target: { value: '' } });
    await waitFor(() => expect(queryOf(listGets(calls).at(-1)).has('q')).toBe(false));
  });

  it('Trạng thái: Hiệu lực → status=ISSUED; Đã thu hồi → status=REVOKED; Tất cả → không gửi', async () => {
    const calls = setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan');
    const st = (await screen.findByLabelText('Trạng thái')) as HTMLSelectElement;
    expect([...st.options].map((o) => o.textContent)).toEqual(['Tất cả', 'Hiệu lực', 'Đã thu hồi']);
    fireEvent.change(st, { target: { value: 'hieu-luc' } });
    await waitFor(() => expect(queryOf(listGets(calls).at(-1)).get('status')).toBe('ISSUED'));
    fireEvent.change(st, { target: { value: 'da-thu-hoi' } });
    await waitFor(() => expect(queryOf(listGets(calls).at(-1)).get('status')).toBe('REVOKED'));
    fireEvent.change(st, { target: { value: '' } });
    await waitFor(() => expect(queryOf(listGets(calls).at(-1)).has('status')).toBe(false));
  });

  it('?lop= → gửi classId, KHÔNG ép năm nay (giấy vừa cấp có thể thuộc năm trước), hiện chip "Lớp K12 ×"; bấm chip bỏ lọc lớp và quay về năm nay', async () => {
    const calls = setupServer(OWNER);
    renderAt(`/hv/giay-chung-nhan?lop=${CLASS_ID}`);
    const chip = await screen.findByRole('button', { name: 'Bỏ lọc lớp K12' });
    expect(chip.textContent).toContain('Lớp K12');
    const q = queryOf(listGets(calls)[0]);
    expect(q.get('classId')).toBe(CLASS_ID);
    expect(q.has('year')).toBe(false);
    expect((screen.getByLabelText('Năm') as HTMLSelectElement).value).toBe('tat-ca');
    fireEvent.click(chip);
    await waitFor(() => {
      const last = queryOf(listGets(calls).at(-1));
      expect(last.has('classId')).toBe(false);
      expect(last.get('year')).toBe(String(THIS_YEAR));
    });
    expect(screen.queryByRole('button', { name: /Bỏ lọc lớp/ })).toBeNull();
  });

  it('?khach= → gửi customerId + chip tên học viên (để liên kết "Xem trong sổ" từ hồ sơ học viên dùng được)', async () => {
    const calls = setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan?khach=c-huong');
    await screen.findByRole('button', { name: 'Bỏ lọc học viên Phạm Quỳnh Hương' });
    expect(queryOf(listGets(calls)[0]).get('customerId')).toBe('c-huong');
  });

  it('phân trang 50 dòng theo máy chủ: "1–4 / 120 giấy", Trang 1/3 → Trang sau gửi page=2; trang đầu khoá Trang trước', async () => {
    const calls = setupServer(OWNER, undefined, () => pageOf(ALL, { total: 120 }));
    renderAt('/hv/giay-chung-nhan');
    expect(await screen.findByText('1–4 / 120 giấy')).toBeTruthy();
    expect(screen.getByText('Trang 1/3')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Trang trước' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(queryOf(listGets(calls).at(-1)).get('page')).toBe('2'));
  });
});

describe('Sổ — chọn nhiều và In lại (dùng ảnh lúc cấp)', () => {
  it('chọn 2 → thanh "Đã chọn 2 giấy" + "In lại (2)" → GET ?ids= lấy URL mới → bản in 2 trang; ô chọn tất cả chỉ lấy bản hiệu lực', async () => {
    const calls = setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan');
    await screen.findByRole('table');
    expect(screen.queryByRole('region', { name: 'Giấy đã chọn' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn CC-2026-0003 · Hoàng Minh Anh' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn CC-2026-0008 · Le Thi Mai' }));
    const bar = screen.getByRole('region', { name: 'Giấy đã chọn' });
    expect(bar.textContent).toContain('Đã chọn 2 giấy');
    fireEvent.click(within(bar).getByRole('button', { name: 'In lại (2)' }));
    const d = await screen.findByRole('dialog', { name: 'In lại giấy chứng nhận' });
    await within(d).findByRole('button', { name: 'Tải PDF (2 trang)' });
    expect(idsGets(calls)).toHaveLength(1);
    expect(queryOf(idsGets(calls)[0]).get('ids')).toBe(`${A.id},${B.id}`);
    // Vẽ đúng dữ liệu bản chụp lúc cấp (tên in trên giấy là "Le Thi Mai", không phải tên hiện hành của khách), xếp theo số tăng dần.
    expect(hoisted.rendered).toHaveLength(2);
    expect(tenOf(hoisted.rendered[0])).toBe('Hoàng Minh Anh');
    expect(tenOf(hoisted.rendered[1])).toBe('Le Thi Mai');
    expect(within(d).getByText(/Tệp PDF: 2 trang A4 ngang/)).toBeTruthy();
    fireEvent.click(within(d).getByRole('button', { name: 'Xong' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'In lại giấy chứng nhận' })).toBeNull());
  });

  it('"Chọn tất cả" chỉ chọn bản hiệu lực trên trang (3 trong 4), bỏ chọn được, "Bỏ chọn" xoá hết', async () => {
    setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan');
    await screen.findByRole('table');
    const all = screen.getByRole('checkbox', { name: 'Chọn tất cả giấy còn hiệu lực trên trang' });
    fireEvent.click(all);
    expect(screen.getByRole('region', { name: 'Giấy đã chọn' }).textContent).toContain('Đã chọn 3 giấy');
    fireEvent.click(all);
    expect(screen.queryByRole('region', { name: 'Giấy đã chọn' })).toBeNull();
    fireEvent.click(all);
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(screen.queryByRole('region', { name: 'Giấy đã chọn' })).toBeNull();
  });

  it('đổi bộ lọc thì bỏ chọn (không in nhầm giấy không còn thấy); đổi trang thì GIỮ chọn', async () => {
    setupServer(OWNER, undefined, () => pageOf(ALL, { total: 120 }));
    renderAt('/hv/giay-chung-nhan');
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn CC-2026-0003 · Hoàng Minh Anh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(screen.getByText('Trang 2/3')).toBeTruthy());
    expect(screen.getByRole('region', { name: 'Giấy đã chọn' }).textContent).toContain('Đã chọn 1 giấy');
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'hieu-luc' } });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Giấy đã chọn' })).toBeNull());
  });

  it('"In lại" một dòng → cũng lấy URL mới theo ids của đúng giấy đó; tên tệp theo số giấy', async () => {
    const calls = setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan');
    fireEvent.click(await within(await rowOf('CC-2026-0003')).findByRole('button', { name: 'In lại CC-2026-0003' }));
    const d = await screen.findByRole('dialog', { name: 'In lại giấy chứng nhận' });
    await within(d).findByRole('button', { name: 'Tải PDF (1 trang)' });
    expect(queryOf(idsGets(calls)[0]).get('ids')).toBe(A.id);
    expect(within(d).getByText(/Tệp: Giay-chung-nhan-CC-2026-0003\.pdf/)).toBeTruthy();
  });

  it('chọn quá 50 giấy (qua hai trang) → lấy ids từng lô 50 (50 rồi 1), bản in đủ 51 trang', async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => fakeView(100 + i, { studentName: `Học viên ${100 + i}` }));
    const extra = fakeView(200, { studentName: 'Học viên 200' });
    pool = [...page1, extra];
    const calls = setupServer(OWNER, undefined, () => pageOf(page1, { total: 51 }));
    // Trang 2 trả đúng một giấy.
    const base = (globalThis.fetch as unknown as (i: RequestInfo | URL, init?: RequestInit) => Promise<Response>);
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = new URL(String(input), 'http://localhost');
      if (u.pathname.endsWith('/orgs/org-1/certificates') && u.searchParams.get('page') === '2' && !u.searchParams.has('ids')) return json(200, pageOf([extra], { page: 2, total: 51 }));
      return base(input, init);
    });
    renderAt('/hv/giay-chung-nhan');
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả giấy còn hiệu lực trên trang' }));
    expect(screen.getByRole('region', { name: 'Giấy đã chọn' }).textContent).toContain('Đã chọn 50 giấy');
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Chọn CC-2026-0200 · Học viên 200' }));
    fireEvent.click(screen.getByRole('button', { name: 'In lại (51)' }));
    const d = await screen.findByRole('dialog', { name: 'In lại giấy chứng nhận' });
    await within(d).findByRole('button', { name: 'Tải PDF (51 trang)' });
    expect(idsGets(calls).map((c) => (queryOf(c).get('ids') ?? '').split(',').length)).toEqual([50, 1]);
  });

  it('giấy chọn đã bị thu hồi lúc in: máy chủ trả bản REVOKED → bỏ khỏi bản in + dải "không còn hiệu lực"; nếu không còn bản nào → báo lỗi, không mở bản in', async () => {
    setupServer(OWNER, (m, p) => {
      if (m === 'GET' && p.includes('ids=')) return json(200, pageOf([{ ...A, status: 'REVOKED', revokedAt: T, revokeReason: 'Cấp nhầm' }, B]));
      return undefined;
    });
    renderAt('/hv/giay-chung-nhan');
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn CC-2026-0003 · Hoàng Minh Anh' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn CC-2026-0008 · Le Thi Mai' }));
    fireEvent.click(screen.getByRole('button', { name: 'In lại (2)' }));
    const d = await screen.findByRole('dialog', { name: 'In lại giấy chứng nhận' });
    expect(within(d).getByText('1 giấy đã chọn không còn hiệu lực nên không có trong bản in.')).toBeTruthy();
    await within(d).findByRole('button', { name: 'Tải PDF (1 trang)' });
    cleanup();
    setupServer(OWNER, (m, p) => (m === 'GET' && p.includes('ids=') ? json(200, pageOf([{ ...A, status: 'REVOKED', revokedAt: T, revokeReason: 'Cấp nhầm' }])) : undefined));
    renderAt('/hv/giay-chung-nhan');
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'In lại CC-2026-0003' }));
    expect((await screen.findByRole('alert')).textContent).toContain('không còn hiệu lực');
    expect(screen.queryByRole('dialog', { name: 'In lại giấy chứng nhận' })).toBeNull();
  });

  it('lấy giấy để in bị lỗi mạng → dải đỏ tiếng Việt, không mở bản in, bấm lại được', async () => {
    setupServer(OWNER, (m, p) => (m === 'GET' && p.includes('ids=') ? apiErr(500, 'INTERNAL', 'Máy chủ gặp lỗi, vui lòng thử lại.') : undefined));
    renderAt('/hv/giay-chung-nhan');
    fireEvent.click(await screen.findByRole('button', { name: 'In lại CC-2026-0003' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Chưa lấy được giấy để in: Máy chủ gặp lỗi');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByRole('button', { name: 'In lại CC-2026-0003' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('Cấp lại (giữ số, ghi "bản cấp lại")', () => {
  const openReissue = async (code = 'CC-2026-0008') => {
    const r = await rowOf(code, 'ISSUED');
    fireEvent.click(within(r).getByRole('button', { name: `Thao tác khác cho ${code}` }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Cấp lại' }));
    return screen.findByRole('dialog', { name: `Cấp lại giấy chứng nhận ${code}` });
  };

  it('menu ⋯ có Cấp lại và Thu hồi; hộp điền sẵn TÊN HIỆN HÀNH của học viên, mẫu cũ, phông cũ, dải ghi rõ giữ số', async () => {
    setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan');
    const r = await rowOf('CC-2026-0008', 'ISSUED');
    fireEvent.click(within(r).getByRole('button', { name: 'Thao tác khác cho CC-2026-0008' }));
    expect((await screen.findAllByRole('menuitem')).map((i) => i.textContent)).toEqual(['Cấp lại', 'Thu hồi']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cấp lại' }));
    const d = await screen.findByRole('dialog', { name: 'Cấp lại giấy chứng nhận CC-2026-0008' });
    expect((within(d).getByLabelText(/^Tên in trên giấy/) as HTMLInputElement).value).toBe('Lê Thị Mai');
    expect((within(d).getByLabelText(/^Lý do/) as HTMLSelectElement).value).toBe('Sai tên / sai dấu');
    expect((within(d).getByLabelText('Mẫu') as HTMLSelectElement).value).toBe('cc-05');
    expect((within(d).getByLabelText('Phông tên') as HTMLSelectElement).value).toBe('keep');
    expect(within(d).getByText('Tên trong hồ sơ học viên không đổi theo — sửa hồ sơ nếu tên ở đó cũng sai.')).toBeTruthy();
    const note = d.querySelector('.gcr-reissue__band') as HTMLElement;
    expect(note.textContent).toBe(`Bản CC-2026-0008 chuyển “Đã thu hồi” (vẫn nằm trong sổ). Bản mới giữ số CC-2026-0008, in thêm “Bản cấp lại ${viDate(TODAY)}”.`);
    expect(within(d).getByRole('button', { name: 'Cấp lại và in' })).toBeTruthy();
  });

  it('Esc đóng menu và trả tiêu điểm về nút ⋯; bấm ra ngoài cũng đóng', async () => {
    setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan');
    const r = await rowOf('CC-2026-0008', 'ISSUED');
    const btn = within(r).getByRole('button', { name: 'Thao tác khác cho CC-2026-0008' });
    fireEvent.click(btn);
    const menu = await screen.findByRole('menu');
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn);
    await screen.findByRole('menu');
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('gửi đúng thân + Idempotency-Key; thành công → mở bản in 1 giấy ghi "bản cấp lại", danh sách tải lại', async () => {
    const view = fakeView(8, { studentName: 'Lê Thị Mai', reissueNo: 1, reissuedOn: TODAY, replacesId: B.id, customer: { id: 'c-mai', fullName: 'Lê Thị Mai' } });
    const calls = setupServer(OWNER, (m, p) => (m === 'POST' && p === `/orgs/org-1/certificates/${B.id}/reissue` ? json(201, view) : undefined));
    renderAt('/hv/giay-chung-nhan');
    const d = await openReissue();
    fireEvent.click(within(d).getByRole('button', { name: 'Cấp lại và in' }));
    const sheet = await screen.findByRole('dialog', { name: 'In lại giấy chứng nhận' });
    const p = posts(calls);
    expect(p).toHaveLength(1);
    expect(p[0]?.body).toEqual({ reason: 'Sai tên / sai dấu', studentName: 'Lê Thị Mai', templateCode: 'cc-05' });
    expect(p[0]?.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(await within(sheet).findByText(new RegExp(`Đã cấp lại CC-2026-0008, giữ nguyên số\\. Giấy ghi “Bản cấp lại ${viDate(TODAY).replace(/\//g, '\\/')}”`))).toBeTruthy();
    await within(sheet).findByRole('button', { name: 'Tải PDF (1 trang)' });
    expect(tenOf(hoisted.rendered[0])).toBe('Lê Thị Mai');
    await waitFor(() => expect(listGets(calls).length).toBeGreaterThanOrEqual(2));
  });

  it('lý do "Khác": hiện ô chữ, BẮT BUỘC (trống thì không gửi); chọn mẫu khác + phông → thân có templateCode, fontOverride', async () => {
    const calls = setupServer(OWNER, (m, p) => (m === 'POST' && p.endsWith('/reissue') ? json(201, fakeView(8, { reissueNo: 1, reissuedOn: TODAY })) : undefined));
    renderAt('/hv/giay-chung-nhan');
    const d = await openReissue();
    fireEvent.change(within(d).getByLabelText(/^Lý do/), { target: { value: 'Khác' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Cấp lại và in' }));
    expect(await within(d).findByText('Nhập lý do cấp lại.')).toBeTruthy();
    expect(posts(calls)).toHaveLength(0);
    fireEvent.change(within(d).getByLabelText('Lý do khác'), { target: { value: '  Đổi tên theo giấy khai sinh ' } });
    fireEvent.change(within(d).getByLabelText('Mẫu'), { target: { value: 'cc-08' } });
    fireEvent.change(within(d).getByLabelText('Phông tên'), { target: { value: 'ky-3' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Cấp lại và in' }));
    await screen.findByRole('dialog', { name: 'In lại giấy chứng nhận' });
    expect(posts(calls)[0]?.body).toEqual({ reason: 'Đổi tên theo giấy khai sinh', studentName: 'Lê Thị Mai', templateCode: 'cc-08', fontOverride: 'ky-3' });
  });

  it('tên trống → báo dưới ô, không gửi; chọn "Theo mẫu" gửi fontOverride null', async () => {
    const calls = setupServer(OWNER, (m, p) => (m === 'POST' && p.endsWith('/reissue') ? json(201, fakeView(8, { reissueNo: 1, reissuedOn: TODAY })) : undefined));
    renderAt('/hv/giay-chung-nhan');
    const d = await openReissue();
    fireEvent.change(within(d).getByLabelText(/^Tên in trên giấy/), { target: { value: '   ' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Cấp lại và in' }));
    expect(await within(d).findByText('Nhập tên in trên giấy.')).toBeTruthy();
    expect(posts(calls)).toHaveLength(0);
    fireEvent.change(within(d).getByLabelText(/^Tên in trên giấy/), { target: { value: 'Lê Thị Mai' } });
    fireEvent.change(within(d).getByLabelText('Phông tên'), { target: { value: 'template' } });
    fireEvent.click(within(d).getByRole('button', { name: 'Cấp lại và in' }));
    await screen.findByRole('dialog', { name: 'In lại giấy chứng nhận' });
    expect((posts(calls)[0]?.body as { fontOverride?: unknown }).fontOverride).toBeNull();
  });

  it('VIỆC TỒN 69: ghi danh đã huỷ → 409 ENROLLMENT_CANCELLED hiện lời tiếng Việt rõ, hộp và nút "Cấp lại và in" VẪN CÒN; bản cũ vẫn in lại được', async () => {
    const calls = setupServer(OWNER, (m, p) =>
      m === 'POST' && p.endsWith('/reissue') ? apiErr(409, 'CONFLICT', 'Học viên đã huỷ ghi danh — không cấp lại được', { reason: 'ENROLLMENT_CANCELLED' }) : undefined,
    );
    renderAt('/hv/giay-chung-nhan');
    const d = await openReissue();
    fireEvent.click(within(d).getByRole('button', { name: 'Cấp lại và in' }));
    const alert = await within(d).findByRole('alert');
    expect(alert.textContent).toBe(ENROLLMENT_CANCELLED_MESSAGE);
    expect(alert.textContent).toContain('huỷ ghi danh');
    expect(within(d).getByRole('button', { name: 'Cấp lại và in' })).toBeTruthy();
    expect((within(d).getByRole('button', { name: 'Cấp lại và in' }) as HTMLButtonElement).disabled).toBe(false);
    expect(posts(calls)).toHaveLength(1);
    // Không mở bản in, không báo thành công.
    expect(screen.queryByRole('dialog', { name: 'In lại giấy chứng nhận' })).toBeNull();
    fireEvent.click(within(d).getByRole('button', { name: 'Huỷ' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(await rowOf('CC-2026-0008', 'ISSUED')).getByRole('button', { name: 'In lại CC-2026-0008' })).toBeTruthy();
  });

  it('409 CERTIFICATE_REVOKED (người khác vừa thu hồi) → hiện lời máy chủ và tải lại sổ', async () => {
    const calls = setupServer(OWNER, (m, p) =>
      m === 'POST' && p.endsWith('/reissue') ? apiErr(409, 'CONFLICT', 'Bản này đã thu hồi — cấp lại từ bản đang hiệu lực', { reason: 'CERTIFICATE_REVOKED', replacedById: null }) : undefined,
    );
    renderAt('/hv/giay-chung-nhan');
    const d = await openReissue();
    const before = listGets(calls).length;
    fireEvent.click(within(d).getByRole('button', { name: 'Cấp lại và in' }));
    expect((await within(d).findByRole('alert')).textContent).toBe('Bản này đã thu hồi — cấp lại từ bản đang hiệu lực');
    await waitFor(() => expect(listGets(calls).length).toBeGreaterThan(before));
  });

  it('BẮT khoá: bấm lại sau lỗi mạng DÙNG LẠI cùng Idempotency-Key; đổi tên → khoá MỚI', async () => {
    let n = 0;
    const calls = setupServer(OWNER, (m, p) => {
      if (m === 'POST' && p.endsWith('/reissue')) {
        n += 1;
        if (n <= 2) return apiErr(500, 'INTERNAL', 'Máy chủ gặp lỗi, vui lòng thử lại.');
        return json(201, fakeView(8, { reissueNo: 1, reissuedOn: TODAY }));
      }
      return undefined;
    });
    renderAt('/hv/giay-chung-nhan');
    const d = await openReissue();
    const go = () => fireEvent.click(within(d).getByRole('button', { name: 'Cấp lại và in' }));
    go();
    await within(d).findByRole('alert');
    go();
    await waitFor(() => expect(posts(calls)).toHaveLength(2));
    const key = (i: number) => posts(calls)[i]?.headers['Idempotency-Key'];
    expect(key(1)).toBe(key(0));
    await within(d).findByRole('alert');
    fireEvent.change(within(d).getByLabelText(/^Tên in trên giấy/), { target: { value: 'Lê Thị Mai A' } });
    go();
    await waitFor(() => expect(posts(calls)).toHaveLength(3));
    expect(key(2)).not.toBe(key(0));
  });
});

describe('Thu hồi (bắt buộc lý do)', () => {
  const openRevoke = async (code = 'CC-2026-0003') => {
    const r = await rowOf(code, 'ISSUED');
    fireEvent.click(within(r).getByRole('button', { name: `Thao tác khác cho ${code}` }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Thu hồi' }));
    return screen.findByRole('dialog', { name: `Thu hồi ${code}?` });
  };

  it('hộp xác nhận loại nguy hiểm nêu hậu quả ≤ 90 ký tự; lý do trống → báo, KHÔNG gọi máy chủ', async () => {
    const calls = setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan');
    const d = await openRevoke();
    const msg = d.querySelector('.ui-confirm__msg') as HTMLElement;
    expect(msg.textContent).toBe('Số CC-2026-0003 không dùng lại. Giấy đã in coi như hết giá trị.');
    expect((msg.textContent ?? '').length).toBeLessThanOrEqual(90);
    expect(within(d).getByRole('button', { name: 'Thu hồi' }).className).toContain('danger');
    fireEvent.click(within(d).getByRole('button', { name: 'Thu hồi' }));
    expect(await within(d).findByText(/Nhập lý do thu hồi/)).toBeTruthy();
    expect(posts(calls)).toHaveLength(0);
  });

  it('có lý do → POST /revoke đúng thân; xong: hộp đóng, dải xanh "Đã thu hồi", sổ tải lại, số bị bỏ khỏi bộ chọn', async () => {
    let revoked = false;
    const calls = setupServer(
      OWNER,
      (m, p) => {
        if (m === 'POST' && p === `/orgs/org-1/certificates/${A.id}/revoke`) {
          revoked = true;
          return json(200, { ...A, status: 'REVOKED', revokedAt: T, revokeReason: 'Cấp nhầm người' });
        }
        return undefined;
      },
      () => pageOf(revoked ? [C, R, B, { ...A, status: 'REVOKED', revokedAt: T, revokeReason: 'Cấp nhầm người' }] : ALL),
    );
    renderAt('/hv/giay-chung-nhan');
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn CC-2026-0003 · Hoàng Minh Anh' }));
    const d = await openRevoke();
    await userEvent.setup().type(within(d).getByRole('textbox'), '  Cấp nhầm người ');
    fireEvent.click(within(d).getByRole('button', { name: 'Thu hồi' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(posts(calls)[0]?.body).toEqual({ reason: 'Cấp nhầm người' });
    expect(screen.getByText(/Đã thu hồi CC-2026-0003\./)).toBeTruthy();
    await waitFor(async () => expect(within(await rowOf('CC-2026-0003', 'REVOKED')).getByText('Đã thu hồi', { selector: '.ui-tag' })).toBeTruthy());
    expect(screen.queryByRole('region', { name: 'Giấy đã chọn' })).toBeNull();
  });

  it('409 (đã thu hồi từ trước) → hiện lời máy chủ trong hộp và tải lại sổ', async () => {
    const calls = setupServer(OWNER, (m, p) => (m === 'POST' && p.endsWith('/revoke') ? apiErr(409, 'CONFLICT', 'Bản này đã thu hồi', { reason: 'CERTIFICATE_REVOKED', replacedById: null }) : undefined));
    renderAt('/hv/giay-chung-nhan');
    const d = await openRevoke();
    const before = listGets(calls).length;
    await userEvent.setup().type(within(d).getByRole('textbox'), 'Cấp nhầm');
    fireEvent.click(within(d).getByRole('button', { name: 'Thu hồi' }));
    expect((await within(d).findByRole('alert')).textContent).toBe('Bản này đã thu hồi');
    await waitFor(() => expect(listGets(calls).length).toBeGreaterThan(before));
  });
});

describe('Quyền theo vai trò mẫu (ký duyệt F câu 2)', () => {
  it('Lễ tân và Giảng viên: thấy sổ, In lại và chọn nhiều ĐƯỢC; KHÔNG có ⋯ (Cấp lại / Thu hồi)', async () => {
    for (const role of ['receptionist', 'instructor'] as const) {
      setupServer(SYSTEM_ROLES[role].permissions);
      renderAt('/hv/giay-chung-nhan');
      const a = await rowOf('CC-2026-0003', 'ISSUED');
      expect(within(a).getByRole('button', { name: 'In lại CC-2026-0003' }), role).toBeTruthy();
      expect(within(a).getByRole('checkbox'), role).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Thao tác khác/ }), role).toBeNull();
      expect(screen.queryByRole('button', { name: /Cấp lại|Thu hồi/ }), role).toBeNull();
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it('Quản lý, Quản trị, Chủ: có ⋯ ở mọi bản hiệu lực (3 bản), không có ở bản đã thu hồi', async () => {
    for (const role of ['manager', 'admin', 'owner'] as const) {
      setupServer(SYSTEM_ROLES[role].permissions);
      renderAt('/hv/giay-chung-nhan');
      await screen.findByRole('table');
      expect(screen.getAllByRole('button', { name: /^Thao tác khác cho/ }), role).toHaveLength(3);
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it('Thợ makeup (không certificates.read): vào thẳng đường → dải 403, máy chủ KHÔNG bị hỏi sổ', async () => {
    const calls = setupServer(SYSTEM_ROLES.artist.permissions);
    renderAt('/hv/giay-chung-nhan');
    expect((await screen.findByRole('alert')).textContent).toBe('Bạn không có quyền xem giấy chứng nhận.');
    expect(registerGets(calls)).toHaveLength(0);
  });
});

describe('Ba khổ màn', () => {
  it('máy tính bảng: bỏ cột Mẫu và Khoá · Lớp, tên khoá · lớp nằm dưới tên học viên', async () => {
    setViewport('tablet');
    setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan');
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['', 'Số', 'Học viên', 'Ngày cấp', 'Trạng thái', 'Thao tác']);
    const a = await rowOf('CC-2026-0003');
    expect(a.textContent).toContain('Makeup chuyên nghiệp · K12');
  });

  it('điện thoại: mỗi bản một thẻ (không bảng), nhãn Số / Học viên / Lớp / Ngày cấp / Mẫu / Trạng thái; nút In lại, Cấp lại, Thu hồi nằm ngay trên thẻ', async () => {
    setViewport('phone');
    const calls = setupServer(OWNER);
    renderAt('/hv/giay-chung-nhan');
    const list = await screen.findByRole('list', { name: 'Sổ giấy chứng nhận' });
    expect(screen.queryByRole('table')).toBeNull();
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(4);
    const a = cards.find((c) => c.getAttribute('data-code') === 'CC-2026-0003') as HTMLElement;
    expect([...a.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Số', 'Học viên', 'Lớp', 'Ngày cấp', 'Mẫu', 'Trạng thái']);
    expect(within(a).getByRole('button', { name: 'In lại CC-2026-0003' })).toBeTruthy();
    expect(within(a).getByRole('button', { name: 'Cấp lại CC-2026-0003' })).toBeTruthy();
    expect(within(a).getByRole('button', { name: 'Thu hồi CC-2026-0003' })).toBeTruthy();
    expect(within(a).queryByRole('button', { name: /Thao tác khác/ })).toBeNull();
    const revoked = cards.find((c) => c.className.includes('is-revoked')) as HTMLElement;
    expect(within(revoked).queryByRole('button')).toBeNull();
    expect(within(revoked).queryByRole('checkbox')).toBeNull();
    // Thẻ phone: bấm Cấp lại mở thẳng hộp cấp lại.
    fireEvent.click(within(a).getByRole('button', { name: 'Cấp lại CC-2026-0003' }));
    expect(await screen.findByRole('dialog', { name: 'Cấp lại giấy chứng nhận CC-2026-0003' })).toBeTruthy();
    void calls;
  });

  it('điện thoại, Lễ tân: thẻ chỉ có In lại', async () => {
    setViewport('phone');
    setupServer(SYSTEM_ROLES.receptionist.permissions);
    renderAt('/hv/giay-chung-nhan');
    const list = await screen.findByRole('list', { name: 'Sổ giấy chứng nhận' });
    const a = within(list).getAllByRole('listitem').find((c) => c.getAttribute('data-code') === 'CC-2026-0003') as HTMLElement;
    expect(within(a).getAllByRole('button').map((b) => b.textContent)).toEqual(['In lại']);
  });
});

