import { cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ROLES, type SystemRoleKey } from '@makeup/shared';
import { ApiError } from '../../api/errors';
import type { CertificateSigner } from '../../api/certificates';
import { routes } from '../../app/routes';
import { permissionsValue, StaticPermissionsProvider } from '../../layout/usePermissions';
import { CertificateSignerCard, PROFILE_REQUIRED_MESSAGE, SIGNER_MAX, signerSaveError, signerValue } from './CertificateSignerCard';

// Thẻ người ký giấy chứng nhận ở Hồ sơ thương hiệu (bản vẽ F 6.7, 4.8; ký duyệt F câu 4): chỉ ACADEMY, chỉ Chủ/Quản trị (org.update) sửa,
// người khác chỉ xem, chưa có hồ sơ → 409 PROFILE_REQUIRED hiện lời tiếng Việt.
configure({ asyncUtilTimeout: 5000 });

const T = '2026-10-18T03:00:00.000Z';
const ORG_ID = 'org-1';
const PATH = `/orgs/${ORG_ID}/profile/certificate`;

interface Call {
  method: string;
  path: string;
  body: unknown;
}
type Reply = (call: Call) => Response | undefined;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const apiErr = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details, requestId: 'r' } });
const signer = (over: Partial<CertificateSigner> = {}): CertificateSigner => ({ hasProfile: true, signerName: null, signerTitle: null, defaultTitle: 'Giám đốc trung tâm', ...over });

// Máy chủ giả: GET trả bản đang giữ; PUT áp đúng luật thân (hai khoá bắt buộc, trim, ≤ 120) rồi giữ lại.
function stub(initial: CertificateSigner, reply?: Reply) {
  let cur = initial;
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const call: Call = { method: init?.method ?? 'GET', path: url.pathname.replace('/api/v1', ''), body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined };
      calls.push(call);
      const r = reply?.(call);
      if (r) return r;
      if (call.path === PATH && call.method === 'GET') return json(200, cur);
      if (call.path === PATH && call.method === 'PUT') {
        const b = call.body as Record<string, unknown>;
        if (!('signerName' in b) || !('signerTitle' in b)) return apiErr(400, 'VALIDATION_FAILED', 'Thiếu trường');
        cur = { ...cur, signerName: (b.signerName as string | null) ?? null, signerTitle: (b.signerTitle as string | null) ?? null };
        return json(200, cur);
      }
      return apiErr(404, 'NOT_FOUND', `Không có đường ${call.method} ${call.path}`);
    }),
  );
  return calls;
}

const stateOf = (perms: readonly string[]) => ({
  status: 'ready' as const,
  org: { id: ORG_ID, slug: 'hv', name: 'X', kind: 'ACADEMY', timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', createdAt: T, updatedAt: T, myRoles: [], myPermissions: [...perms] } as never,
  permissions: new Set(perms),
});

function renderCard(over: { kind?: 'ACADEMY' | 'TEAM' | 'INDIVIDUAL' | 'chua-ro'; canEdit?: boolean } = {}) {
  const kind = over.kind ?? 'ACADEMY';
  return render(
    <StaticPermissionsProvider value={permissionsValue(stateOf([]))}>
      <CertificateSignerCard orgId={ORG_ID} orgKind={kind === 'chua-ro' ? undefined : kind} canEdit={over.canEdit ?? true} profileSaved />
    </StaticPermissionsProvider>,
  );
}

// Thẻ đã tải xong (không còn khung chờ). Thẻ dựng lại khi dữ liệu về, nên bài thử lấy lại thẻ sau mỗi lần tải.
async function card() {
  await waitFor(() => {
    expect(screen.getByRole('region', { name: 'Người ký giấy chứng nhận' })).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Đang tải người ký' })).toBeNull();
  });
  return screen.getByRole('region', { name: 'Người ký giấy chứng nhận' });
}
const nameBox = (c: HTMLElement) => within(c).getByLabelText('Tên Giám đốc') as HTMLInputElement;
const titleBox = (c: HTMLElement) => within(c).getByLabelText('Chức danh') as HTMLInputElement;
const puts = (calls: Call[]) => calls.filter((c) => c.method === 'PUT');

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('hàm thuần', () => {
  it('signerValue: bỏ dấu cách hai đầu; trống hoặc toàn dấu cách → null', () => {
    expect(signerValue('  Nguyễn Trọng Chiến ')).toBe('Nguyễn Trọng Chiến');
    expect(signerValue('')).toBeNull();
    expect(signerValue('   ')).toBeNull();
  });

  it('signerSaveError: 409 PROFILE_REQUIRED → lời cố định + báo thiếu hồ sơ; 403 → lời quyền; lỗi khác → lời máy chủ', () => {
    const e409 = new ApiError('CONFLICT', 'Lưu Hồ sơ thương hiệu (tên thương hiệu) trước', 409, 'r', { reason: 'PROFILE_REQUIRED' });
    expect(signerSaveError(e409)).toEqual({ text: PROFILE_REQUIRED_MESSAGE, profileMissing: true });
    // 409 khác lý do không bị nhận nhầm.
    const other = new ApiError('CONFLICT', 'Dữ liệu đã thay đổi', 409, 'r', { reason: 'KHAC' });
    expect(signerSaveError(other)).toEqual({ text: 'Dữ liệu đã thay đổi', profileMissing: false });
    expect(signerSaveError(new ApiError('FORBIDDEN', 'Không đủ quyền', 403, 'r')).text).toBe('Chỉ Chủ và Quản trị được đổi người ký giấy chứng nhận.');
    expect(signerSaveError(new ApiError('INTERNAL', 'Máy chủ gặp lỗi', 500, 'r')).text).toBe('Máy chủ gặp lỗi');
  });
});

describe('Thẻ người ký — loại tổ chức và quyền', () => {
  it.each(['TEAM', 'INDIVIDUAL', 'chua-ro'] as const)('tổ chức %s → không hiện gì và KHÔNG gọi máy chủ', (kind) => {
    const calls = stub(signer());
    const { container } = renderCard({ kind });
    expect(container.textContent).toBe('');
    expect(calls).toHaveLength(0);
  });

  // canEdit của trang = has('org.update'): theo từng vai trò mẫu chỉ Chủ và Quản trị sửa (ký duyệt F câu 4).
  const ROLES = Object.keys(SYSTEM_ROLES) as SystemRoleKey[];
  const EDIT: Record<SystemRoleKey, boolean> = { owner: true, admin: true, manager: false, artist: false, assistant: false, receptionist: false, accountant: false, instructor: false, teaching_assistant: false };
  it('bảng quyền khớp đủ 9 vai trò mẫu', () => {
    expect(ROLES.sort()).toEqual(Object.keys(EDIT).sort());
    for (const r of ROLES) expect((SYSTEM_ROLES[r].permissions as readonly string[]).includes('org.update')).toBe(EDIT[r]);
  });
  it.each(ROLES)('vai trò %s: %s', async (role) => {
    stub(signer({ signerName: 'Nguyễn Trọng Chiến', signerTitle: 'Giám đốc' }));
    renderCard({ canEdit: (SYSTEM_ROLES[role].permissions as readonly string[]).includes('org.update') });
    const c = await card();
    // Mọi vai trò thấy tên và chức danh đang đặt.
    expect(nameBox(c).value).toBe('Nguyễn Trọng Chiến');
    expect(titleBox(c).value).toBe('Giám đốc');
    if (EDIT[role]) {
      expect(nameBox(c).disabled).toBe(false);
      expect(within(c).getByRole('button', { name: 'Lưu' })).toBeTruthy();
      expect(within(c).queryByText(/Bạn chỉ xem được/)).toBeNull();
    } else {
      expect(nameBox(c).disabled).toBe(true);
      expect(titleBox(c).disabled).toBe(true);
      expect(within(c).queryByRole('button', { name: 'Lưu' })).toBeNull();
      expect(within(c).getByText('Bạn chỉ xem được. Chỉ Chủ và Quản trị đổi người ký.')).toBeTruthy();
    }
  });

  it('người chỉ xem gõ Enter vào ô cũng KHÔNG gửi gì lên máy chủ', async () => {
    const calls = stub(signer({ signerName: 'A' }));
    renderCard({ canEdit: false });
    const c = await card();
    fireEvent.keyDown(nameBox(c), { key: 'Enter' });
    expect(puts(calls)).toHaveLength(0);
  });
});

describe('Thẻ người ký — xem và sửa', () => {
  it('chưa đặt: ô trống, gợi ý chức danh mặc định lấy từ máy chủ; lời giải thích nằm trong tooltip, không in ra màn', async () => {
    stub(signer());
    renderCard();
    const c = await card();
    expect(nameBox(c).value).toBe('');
    expect(titleBox(c).placeholder).toBe('Giám đốc trung tâm');
    // Một dòng = nhãn + ô: lời giải thích chỉ hiện khi mở "?" (Tooltip), không có sẵn trên màn.
    expect(screen.queryByRole('tooltip')).toBeNull();
    const tips = within(c).getAllByRole('button', { name: 'Giải thích' });
    expect(tips).toHaveLength(3);
    await userEvent.setup().hover(tips[2] as HTMLElement);
    expect((await screen.findByRole('tooltip')).textContent).toContain('Để trống thì giấy in “Giám đốc trung tâm”.');
  });

  it('nút Lưu khoá khi chưa sửa gì; sửa rồi mới mở', async () => {
    stub(signer({ signerName: 'Chiến' }));
    renderCard();
    const c = await card();
    const save = within(c).getByRole('button', { name: 'Lưu' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await userEvent.setup().type(nameBox(c), ' Trọng');
    expect(save.disabled).toBe(false);
  });

  it('lưu: gửi ĐÚNG hai khoá (đã bỏ dấu cách), hiện "Đã lưu", rồi khoá lại Lưu', async () => {
    const calls = stub(signer());
    renderCard();
    const c = await card();
    const user = userEvent.setup();
    await user.type(nameBox(c), '  Nguyễn Trọng Chiến  ');
    await user.type(titleBox(c), 'Giám đốc điều hành');
    await user.click(within(c).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0]?.path).toBe(PATH);
    expect(puts(calls)[0]?.body).toEqual({ signerName: 'Nguyễn Trọng Chiến', signerTitle: 'Giám đốc điều hành' });
    expect(await within(c).findByText('Đã lưu')).toBeTruthy();
    expect(nameBox(c).value).toBe('Nguyễn Trọng Chiến');
    expect((within(c).getByRole('button', { name: 'Lưu' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('xoá hết chữ rồi lưu: gửi cả hai null (không gửi chuỗi rỗng, không bỏ khoá)', async () => {
    const calls = stub(signer({ signerName: 'Chiến', signerTitle: 'Giám đốc' }));
    renderCard();
    const c = await card();
    const user = userEvent.setup();
    await user.clear(nameBox(c));
    await user.clear(titleBox(c));
    await user.click(within(c).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0]?.body).toStrictEqual({ signerName: null, signerTitle: null });
  });

  it('chỉ chức danh để trống: tên được giữ, chức danh gửi null', async () => {
    const calls = stub(signer());
    renderCard();
    const c = await card();
    const user = userEvent.setup();
    await user.type(nameBox(c), 'Chiến');
    await user.type(titleBox(c), '   ');
    await user.click(within(c).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
    expect(puts(calls)[0]?.body).toStrictEqual({ signerName: 'Chiến', signerTitle: null });
  });

  it('Enter trong ô cũng lưu; ô giới hạn đúng 120 ký tự như máy chủ', async () => {
    const calls = stub(signer());
    renderCard();
    const c = await card();
    expect(nameBox(c).maxLength).toBe(SIGNER_MAX);
    expect(titleBox(c).maxLength).toBe(SIGNER_MAX);
    expect(SIGNER_MAX).toBe(120);
    const user = userEvent.setup();
    await user.type(nameBox(c), 'Chiến{Enter}');
    await waitFor(() => expect(puts(calls)).toHaveLength(1));
  });

  it('lưu lần hai sau khi sửa tiếp: gửi bản mới nhất', async () => {
    const calls = stub(signer({ signerName: 'A' }));
    renderCard();
    const c = await card();
    const user = userEvent.setup();
    await user.type(nameBox(c), 'B');
    await user.click(within(c).getByRole('button', { name: 'Lưu' }));
    await within(c).findByText('Đã lưu');
    await user.type(nameBox(c), 'C');
    expect(within(c).queryByText('Đã lưu')).toBeNull();
    await user.click(within(c).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(puts(calls)).toHaveLength(2));
    expect((puts(calls)[1]?.body as { signerName: string }).signerName).toBe('ABC');
  });
});

describe('Thẻ người ký — chưa có hồ sơ thương hiệu', () => {
  it('GET báo hasProfile=false: dải "Lưu hồ sơ thương hiệu trước", ô và Lưu bị khoá, không gửi PUT', async () => {
    const calls = stub(signer({ hasProfile: false }));
    renderCard();
    const c = await card();
    expect(within(c).getByText('Lưu hồ sơ thương hiệu trước, rồi đặt người ký ở đây.')).toBeTruthy();
    expect(nameBox(c).disabled).toBe(true);
    expect((within(c).getByRole('button', { name: 'Lưu' }) as HTMLButtonElement).disabled).toBe(true);
    expect(puts(calls)).toHaveLength(0);
  });

  it('người chỉ xem + chưa có hồ sơ: lời riêng, không có nút Lưu', async () => {
    stub(signer({ hasProfile: false }));
    renderCard({ canEdit: false });
    const c = await card();
    expect(within(c).getByText('Chưa có hồ sơ thương hiệu, nên chưa đặt người ký được.')).toBeTruthy();
    expect(within(c).queryByRole('button', { name: 'Lưu' })).toBeNull();
  });

  it('máy chủ trả 409 PROFILE_REQUIRED khi lưu (hồ sơ vừa bị xoá / lệch): hiện lời tiếng Việt, khoá ô, giữ chữ đã gõ', async () => {
    const calls = stub(signer(), (c) =>
      c.method === 'PUT' ? apiErr(409, 'CONFLICT', 'Lưu Hồ sơ thương hiệu (tên thương hiệu) trước', { reason: 'PROFILE_REQUIRED' }) : undefined,
    );
    renderCard();
    const c = await card();
    const user = userEvent.setup();
    await user.type(nameBox(c), 'Chiến');
    await user.click(within(c).getByRole('button', { name: 'Lưu' }));
    const alert = await within(c).findByRole('alert');
    expect(alert.textContent).toBe(PROFILE_REQUIRED_MESSAGE);
    expect(PROFILE_REQUIRED_MESSAGE).toMatch(/Chưa có hồ sơ thương hiệu/);
    expect(puts(calls)).toHaveLength(1);
    expect(nameBox(c).disabled).toBe(true);
    expect(nameBox(c).value).toBe('Chiến');
    expect((within(c).getByRole('button', { name: 'Lưu' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('409 lý do khác: hiện lời máy chủ, KHÔNG khoá ô', async () => {
    stub(signer(), (c) => (c.method === 'PUT' ? apiErr(409, 'CONFLICT', 'Dữ liệu vừa đổi, hãy tải lại') : undefined));
    renderCard();
    const c = await card();
    const user = userEvent.setup();
    await user.type(nameBox(c), 'Chiến');
    await user.click(within(c).getByRole('button', { name: 'Lưu' }));
    expect((await within(c).findByRole('alert')).textContent).toBe('Dữ liệu vừa đổi, hãy tải lại');
    expect(nameBox(c).disabled).toBe(false);
  });
});

describe('Thẻ người ký — lỗi', () => {
  it('403 khi lưu → lời "Chỉ Chủ và Quản trị…"', async () => {
    stub(signer(), (c) => (c.method === 'PUT' ? apiErr(403, 'FORBIDDEN', 'Bạn không có quyền', { required: ['org.update'] }) : undefined));
    renderCard();
    const c = await card();
    const user = userEvent.setup();
    await user.type(nameBox(c), 'Chiến');
    await user.click(within(c).getByRole('button', { name: 'Lưu' }));
    expect((await within(c).findByRole('alert')).textContent).toBe('Chỉ Chủ và Quản trị được đổi người ký giấy chứng nhận.');
  });

  it('GET lỗi 500 → dải lỗi + Thử lại; thử lại được thì hiện ô', async () => {
    let fail = true;
    stub(signer({ signerName: 'Chiến' }), (c) => (c.method === 'GET' && fail ? apiErr(500, 'INTERNAL', 'Máy chủ gặp lỗi') : undefined));
    renderCard();
    const c = await card();
    expect(within(c).getByRole('alert')).toBeTruthy();
    fail = false;
    await userEvent.setup().click(within(c).getByRole('button', { name: /Thử lại/ }));
    const after = await card();
    await waitFor(() => expect(nameBox(after).value).toBe('Chiến'));
  });
});

// Trong trang Hồ sơ thương hiệu thật: chỗ đặt thẻ, loại tổ chức, quyền, và hồ sơ chưa có.
describe('Hồ sơ thương hiệu — chỗ đặt thẻ người ký', () => {
  const PROFILE = {
    brandName: 'Chiến Makeup Academy', tagline: null, bio: null, experience: null, styles: [], serviceArea: null, address: null, phone: null, email: null, zalo: null,
    facebook: null, instagram: null, tiktok: null, website: null, logoFileId: null, avatarFileId: null, coverFileId: null, workingHours: [],
    bookingPolicy: null, cancellationPolicy: null, depositPolicy: null, isPublished: false, publishedAt: null, updatedAt: T, logo: null, avatar: null, cover: null,
  };

  function server(kind: 'ACADEMY' | 'TEAM', permissions: readonly string[], hasProfile = true) {
    const org = { membershipId: 'm-1', id: ORG_ID, name: 'Học viện', slug: 'hv', kind, roles: [{ key: 'owner', name: 'Chủ' }] };
    const calls: Call[] = [];
    let profileExists = hasProfile;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), 'http://localhost');
        const path = url.pathname.replace('/api/v1', '');
        const method = init?.method ?? 'GET';
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
        calls.push({ method, path, body });
        if (path === '/auth/refresh') return json(200, { accessToken: 't', expiresIn: 900 });
        if (path === '/auth/me') return json(200, { id: 'u', email: 'a@b.vn', fullName: 'Chiến', organizations: [org] });
        if (path === `/orgs/${ORG_ID}`) return json(200, { ...org, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE', createdAt: T, updatedAt: T, myRoles: ['owner'], myPermissions: [...permissions] });
        if (path === `/orgs/${ORG_ID}/profile` && method === 'GET') return json(200, profileExists ? { hasProfile: true, profile: PROFILE } : { hasProfile: false, profile: null });
        if (path === `/orgs/${ORG_ID}/profile` && method === 'PUT') {
          profileExists = true;
          return json(200, { hasProfile: true, profile: { ...PROFILE, brandName: (body as { brandName: string }).brandName } });
        }
        if (path === PATH && method === 'GET') return json(200, signer({ hasProfile: profileExists, signerName: profileExists ? 'Nguyễn Trọng Chiến' : null }));
        if (path === `/orgs/${ORG_ID}/packages`) return json(200, { items: [], page: 1, pageSize: 100, total: 0 });
        if (path === `/orgs/${ORG_ID}/makeup-subjects`) return json(200, { items: [] });
        return apiErr(404, 'NOT_FOUND', path);
      }),
    );
    return calls;
  }
  const open = () => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/hv/cai-dat/thuong-hieu'] })} />);

  it('ACADEMY + Chủ: thẻ nằm trong cột sửa, ngay sau form hồ sơ, có tên đang đặt', async () => {
    server('ACADEMY', SYSTEM_ROLES.owner.permissions);
    open();
    const c = await card();
    expect(nameBox(c).value).toBe('Nguyễn Trọng Chiến');
    const form = screen.getByRole('region', { name: 'Sửa hồ sơ thương hiệu' });
    expect(form.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(form.parentElement).toBe(c.parentElement);
  });

  it('tổ chức TEAM: không có thẻ và không gọi đường người ký', async () => {
    const calls = server('TEAM', SYSTEM_ROLES.owner.permissions);
    open();
    await screen.findByRole('region', { name: 'Sửa hồ sơ thương hiệu' });
    expect(screen.queryByRole('region', { name: 'Người ký giấy chứng nhận' })).toBeNull();
    expect(calls.some((c) => c.path === PATH)).toBe(false);
  });

  it('Quản lý (không có org.update): cổng điều hướng chặn cả trang, nên không có thẻ và không gọi đường người ký', async () => {
    const calls = server('ACADEMY', SYSTEM_ROLES.manager.permissions);
    open();
    await waitFor(() => expect(calls.some((c) => c.path === `/orgs/${ORG_ID}`)).toBe(true));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Sửa hồ sơ thương hiệu' })).toBeNull());
    expect(screen.queryByRole('region', { name: 'Người ký giấy chứng nhận' })).toBeNull();
    expect(calls.some((c) => c.path === PATH)).toBe(false);
  });

  it('chưa có hồ sơ thương hiệu: thẻ hiện dải "Lưu hồ sơ thương hiệu trước"; lưu hồ sơ xong thì thẻ mở khoá', async () => {
    const calls = server('ACADEMY', SYSTEM_ROLES.owner.permissions, false);
    open();
    const c = await card();
    expect(within(c).getByText('Lưu hồ sơ thương hiệu trước, rồi đặt người ký ở đây.')).toBeTruthy();
    expect(nameBox(c).disabled).toBe(true);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Tên thương hiệu'), 'Chiến Makeup Academy');
    await user.click(screen.getByRole('button', { name: 'Lưu và tiếp tục' }));
    await waitFor(() => expect(calls.filter((x) => x.path === PATH && x.method === 'GET').length).toBe(2));
    const after = await card();
    await waitFor(() => expect(nameBox(after).disabled).toBe(false));
    expect(nameBox(after).value).toBe('Nguyễn Trọng Chiến');
    expect(within(after).queryByText(/Lưu hồ sơ thương hiệu trước/)).toBeNull();
  });
});
