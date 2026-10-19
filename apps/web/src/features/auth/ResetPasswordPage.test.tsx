import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { readResetToken, ResetPasswordPage } from './ResetPasswordPage';

const confirmPasswordReset = vi.fn();
vi.mock('../../api/auth', async (importActual) => ({
  ...(await importActual<typeof import('../../api/auth')>()),
  confirmPasswordReset: (...a: unknown[]) => confirmPasswordReset(...a),
}));

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde';
let seenUrl = '';

function UrlProbe() {
  const l = useLocation();
  seenUrl = l.pathname + l.search + l.hash;
  return null;
}

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <UrlProbe />
      <Routes>
        <Route path="/dat-lai-mat-khau" element={<ResetPasswordPage />} />
        <Route path="/quen-mat-khau" element={<p>Màn quên mật khẩu</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fill(pw: string, again = pw) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Mật khẩu mới'), pw);
  await user.type(screen.getByLabelText('Nhập lại mật khẩu mới'), again);
  await user.click(screen.getByRole('button', { name: 'Đặt mật khẩu mới' }));
  return user;
}

beforeEach(() => {
  confirmPasswordReset.mockReset();
  seenUrl = '';
});

describe('readResetToken', () => {
  it('chỉ nhận thẻ đúng dạng sau #the=', () => {
    expect(readResetToken(`#the=${TOKEN}`)).toBe(TOKEN);
    expect(readResetToken('')).toBeNull();
    expect(readResetToken('#the=ngan')).toBeNull();
    expect(readResetToken('#the=<script>alert(1)</script>xxxxxxxxxxxx')).toBeNull();
  });
});

describe('ResetPasswordPage — màn Đặt mật khẩu mới', () => {
  it('đọc thẻ trên đường dẫn rồi xoá nó khỏi thanh địa chỉ; nhãn + ô, lời giải thích trong tooltip', async () => {
    renderAt(`/dat-lai-mat-khau#the=${TOKEN}`);
    expect(screen.getByRole('heading', { name: 'Đặt mật khẩu mới' })).toBeTruthy();
    await vi.waitFor(() => expect(seenUrl).toBe('/dat-lai-mat-khau'));
    // Lời giải thích nằm trong tooltip (ẩn tới khi bấm "?"), không viết ra màn.
    expect(screen.getByText(/72 byte/).closest('[hidden]')).not.toBeNull();
    await fill('mat-khau-moi-456');
    expect(confirmPasswordReset).toHaveBeenCalledWith(TOKEN, 'mat-khau-moi-456');
  });

  it('hai lần nhập không khớp / quá ngắn → lỗi dưới ô, không gọi máy chủ', async () => {
    renderAt(`/dat-lai-mat-khau#the=${TOKEN}`);
    await fill('mat-khau-moi-456', 'mat-khau-khac-456');
    expect(await screen.findByText('Hai lần nhập chưa khớp nhau')).toBeTruthy();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('thành công → báo đã đăng xuất mọi thiết bị, nút sang Đăng nhập tải lại trang', async () => {
    confirmPasswordReset.mockResolvedValue(undefined);
    renderAt(`/dat-lai-mat-khau#the=${TOKEN}`);
    await fill('mat-khau-moi-456');
    expect(await screen.findByText(/Mọi thiết bị đang đăng nhập đã được đăng xuất/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Đăng nhập bằng mật khẩu mới' }).getAttribute('href')).toBe('/dang-nhap');
  });

  it('thẻ hết hạn/đã dùng (RESET_TOKEN_INVALID) → lời máy chủ + liên kết gửi đường dẫn mới', async () => {
    confirmPasswordReset.mockRejectedValue(
      new ApiError('VALIDATION_FAILED', 'Đường dẫn đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu đường dẫn mới.', 400, 'r', {
        reason: 'RESET_TOKEN_INVALID',
      }),
    );
    renderAt(`/dat-lai-mat-khau#the=${TOKEN}`);
    await fill('mat-khau-moi-456');
    expect(await screen.findByText(/không hợp lệ hoặc đã hết hạn/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Gửi đường dẫn mới' }).getAttribute('href')).toBe('/quen-mat-khau');
  });

  it('đường dẫn thiếu thẻ → báo rõ, không có ô nhập', () => {
    renderAt('/dat-lai-mat-khau');
    expect(screen.getByText(/thiếu mã đặt lại/)).toBeTruthy();
    expect(screen.queryByLabelText('Mật khẩu mới')).toBeNull();
    expect(screen.getByRole('link', { name: 'Gửi lại đường dẫn' }).getAttribute('href')).toBe('/quen-mat-khau');
  });
});
