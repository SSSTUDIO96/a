import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrganization, type CreatedOrganization } from '../../api/auth';
import { ApiError, NETWORK_MESSAGE } from '../../api/errors';
import { CreateOrgPage } from './CreateOrgPage';

// Khoá chống gửi trùng cho POST /orgs: giữ nguyên qua các lần bấm lại sau lỗi; đổi nội dung form thì sinh khoá mới.
vi.mock('../../api/auth', () => ({ createOrganization: vi.fn() }));

const reloadMe = vi.fn();
const selectOrg = vi.fn();
vi.mock('../../app/session', () => ({
  useSession: () => ({
    organizations: [{ membershipId: 'm-0', id: 'org-0', name: 'Cũ', slug: 'cu', kind: 'TEAM', roles: [] }],
    reloadMe,
    selectOrg,
  }),
}));

const create = vi.mocked(createOrganization);
const networkError = () => new ApiError('NETWORK', NETWORK_MESSAGE, 0, null);
const CREATED: CreatedOrganization = {
  id: 'org-1',
  name: 'Studio Hoa Đào',
  slug: 'hoa-dao',
  kind: 'TEAM',
  timezone: 'Asia/Ho_Chi_Minh',
  currency: 'VND',
  status: 'ACTIVE',
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
};

function keys(): string[] {
  return create.mock.calls.map((c) => c[1]);
}

async function setup() {
  const user = userEvent.setup();
  const { unmount } = render(
    <MemoryRouter>
      <CreateOrgPage />
    </MemoryRouter>,
  );
  await user.type(screen.getByLabelText('Tên tổ chức'), 'Studio Hoa Đào');
  await user.click(screen.getByLabelText('Đội / studio'));
  const submit = () => user.click(screen.getByRole('button', { name: 'Tạo tổ chức' }));
  return { user, submit, unmount };
}

beforeEach(() => {
  create.mockReset();
  reloadMe.mockReset();
  selectOrg.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('CreateOrgPage — giữ Idempotency-Key tới khi tạo thành công', () => {
  it('lỗi mạng rồi bấm lại cùng nội dung → dùng lại khoá cũ', async () => {
    create.mockRejectedValue(networkError());
    const { submit } = await setup();
    await submit();
    await screen.findByText(NETWORK_MESSAGE);
    await submit();
    await submit();
    expect(create).toHaveBeenCalledTimes(3);
    const [k1, k2, k3] = keys();
    expect(k1).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(k2).toBe(k1);
    expect(k3).toBe(k1);
    expect(create.mock.calls[0]?.[0]).toEqual({ name: 'Studio Hoa Đào', slug: 'studio-hoa-dao', kind: 'TEAM' });
  });

  it('đổi tên sau lỗi → khoá mới', async () => {
    create.mockRejectedValue(networkError());
    const { user, submit } = await setup();
    await submit();
    await user.type(screen.getByLabelText('Tên tổ chức'), ' Mới');
    await submit();
    const [k1, k2] = keys();
    expect(k2).not.toBe(k1);
  });

  it('đổi đường dẫn (slug) sau lỗi → khoá mới', async () => {
    create.mockRejectedValue(networkError());
    const { user, submit } = await setup();
    await submit();
    const slug = screen.getByLabelText(/Đường dẫn/);
    await user.clear(slug);
    await user.type(slug, 'hoa-dao');
    await submit();
    const [k1, k2] = keys();
    expect(k2).not.toBe(k1);
    expect(create.mock.calls[1]?.[0].slug).toBe('hoa-dao');
  });

  it('đổi loại tổ chức sau lỗi → khoá mới (cùng khoá khác nội dung máy chủ trả 409)', async () => {
    create.mockRejectedValue(networkError());
    const { user, submit } = await setup();
    await submit();
    await user.click(screen.getByLabelText('Thợ cá nhân'));
    await submit();
    const [k1, k2] = keys();
    expect(k2).not.toBe(k1);
  });

  it('đã tạo nhưng tải lại danh sách hỏng → bấm lại dùng lại khoá cũ (máy chủ trả lại đúng tổ chức, không tạo trùng)', async () => {
    create.mockResolvedValue(CREATED);
    reloadMe.mockRejectedValueOnce(networkError()).mockResolvedValueOnce({});
    const { submit } = await setup();
    await submit();
    await screen.findByText(/Đã tạo tổ chức "Studio Hoa Đào"/);
    await submit();
    expect(create).toHaveBeenCalledTimes(2);
    const [k1, k2] = keys();
    expect(k2).toBe(k1);
    expect(selectOrg).toHaveBeenCalledWith('org-1');
  });

  it('mỗi lần mở trang (form mới) → khoá mới', async () => {
    create.mockRejectedValue(networkError());
    const first = await setup();
    await first.submit();
    first.unmount();
    const second = await setup();
    await second.submit();
    const [k1, k2] = keys();
    expect(k2).not.toBe(k1);
  });
});
