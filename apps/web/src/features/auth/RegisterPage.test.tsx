import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NETWORK_MESSAGE } from '../../api/errors';
import { RegisterPage } from './RegisterPage';

// Đăng ký: máy chủ nhận lại cùng khoá + cùng email/tên/mật khẩu trong 24 giờ → 201 cùng tài khoản.
const register = vi.fn();
vi.mock('../../app/session', () => ({ useSession: () => ({ register }) }));

const networkError = () => new ApiError('NETWORK', NETWORK_MESSAGE, 0, null);

function keys(): string[] {
  return register.mock.calls.map((c) => c[1] as string);
}

async function setup() {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
  await user.type(screen.getByLabelText('Họ tên'), 'Nguyễn Thị Hoa');
  await user.type(screen.getByLabelText('Email'), 'hoa@vidu.vn');
  await user.type(screen.getByLabelText(/Mật khẩu/), 'matkhau-dai-1');
  const submit = () => user.click(screen.getByRole('button', { name: 'Đăng ký' }));
  return { user, submit };
}

beforeEach(() => {
  register.mockReset();
});

describe('RegisterPage — giữ Idempotency-Key tới khi đăng ký thành công', () => {
  it('lỗi mạng rồi bấm lại cùng nội dung → dùng lại khoá cũ', async () => {
    register.mockRejectedValue(networkError());
    const { submit } = await setup();
    await submit();
    await screen.findByText(NETWORK_MESSAGE);
    await submit();
    expect(register).toHaveBeenCalledTimes(2);
    const [k1, k2] = keys();
    expect(k1).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(k2).toBe(k1);
    expect(register.mock.calls[0]?.[0]).toEqual({ fullName: 'Nguyễn Thị Hoa', email: 'hoa@vidu.vn', password: 'matkhau-dai-1' });
  });

  it.each([
    ['email', 'Email', 'x'],
    ['họ tên', 'Họ tên', ' B'],
    ['mật khẩu', /Mật khẩu/, '2'],
  ] as const)('đổi %s sau lỗi → khoá mới', async (_ten, label, them) => {
    register.mockRejectedValue(networkError());
    const { user, submit } = await setup();
    await submit();
    await user.type(screen.getByLabelText(label), them);
    await submit();
    const [k1, k2] = keys();
    expect(k2).not.toBe(k1);
  });
});
