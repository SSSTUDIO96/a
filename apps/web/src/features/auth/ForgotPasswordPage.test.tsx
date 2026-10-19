import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import { ForgotPasswordPage } from './ForgotPasswordPage';

const requestPasswordReset = vi.fn();
vi.mock('../../api/auth', () => ({ requestPasswordReset: (...a: unknown[]) => requestPasswordReset(...a) }));

const SAME = 'Nếu email này có tài khoản, chúng tôi đã gửi đường dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (cả mục thư rác).';

function renderAt(state?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/quen-mat-khau', state }]}>
      <Routes>
        <Route path="/quen-mat-khau" element={<ForgotPasswordPage />} />
        <Route path="/dang-nhap" element={<p>Màn đăng nhập</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => requestPasswordReset.mockReset());

describe('ForgotPasswordPage — màn Quên mật khẩu', () => {
  it('nhãn + ô Email, lời giải thích nằm trong tooltip (không viết ra màn); email mang từ màn Đăng nhập', () => {
    renderAt({ email: 'hoa@vidu.vn' });
    expect(screen.getByRole('heading', { name: 'Quên mật khẩu' })).toBeTruthy();
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('hoa@vidu.vn');
    expect(screen.getByText(/hết hạn sau 30 phút/).closest('[hidden]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Đăng nhập' }).getAttribute('href')).toBe('/dang-nhap');
  });

  it('email sai → lỗi dưới ô, không gọi máy chủ', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.type(screen.getByLabelText('Email'), 'khong-phai-email');
    await user.click(screen.getByRole('button', { name: 'Gửi đường dẫn đặt lại' }));
    expect(await screen.findByText('Email không hợp lệ')).toBeTruthy();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('gửi → hiện NGUYÊN lời máy chủ (giống nhau dù email có tài khoản hay không), cho gửi lại', async () => {
    requestPasswordReset.mockResolvedValue({ message: SAME });
    const user = userEvent.setup();
    renderAt();
    await user.type(screen.getByLabelText('Email'), '  hoa@vidu.vn ');
    await user.click(screen.getByRole('button', { name: 'Gửi đường dẫn đặt lại' }));
    expect(requestPasswordReset).toHaveBeenCalledWith('hoa@vidu.vn');
    expect(await screen.findByText(SAME)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Kiểm tra hộp thư' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Gửi lại hoặc dùng email khác' }));
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('  hoa@vidu.vn ');
  });

  it('máy chủ chưa cấu hình gửi thư (503) hay quá lượt (429) → dải lỗi đúng lời máy chủ', async () => {
    requestPasswordReset.mockRejectedValue(
      new ApiError('NOT_CONFIGURED', 'Máy chủ chưa cấu hình gửi thư nên chưa đặt lại mật khẩu qua email được.', 503, 'req-1', { reason: 'MAIL_NOT_CONFIGURED' }),
    );
    const user = userEvent.setup();
    renderAt();
    await user.type(screen.getByLabelText('Email'), 'hoa@vidu.vn');
    await user.click(screen.getByRole('button', { name: 'Gửi đường dẫn đặt lại' }));
    expect(await screen.findByText(/chưa cấu hình gửi thư/)).toBeTruthy();
    expect(screen.getByText('Mã yêu cầu: req-1')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Kiểm tra hộp thư' })).toBeNull();
  });
});
