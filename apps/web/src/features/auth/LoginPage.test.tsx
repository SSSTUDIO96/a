import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

vi.mock('../../app/session', () => ({ useSession: () => ({ login: vi.fn(), restoreError: null, retryRestore: vi.fn() }) }));

function Forgot() {
  const l = useLocation();
  return <p>Quên: {(l.state as { email?: string } | null)?.email}</p>;
}

describe('LoginPage — liên kết Quên mật khẩu', () => {
  it('có liên kết "Quên mật khẩu?" sang /quen-mat-khau, mang theo email đang gõ', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dang-nhap']}>
        <Routes>
          <Route path="/dang-nhap" element={<LoginPage />} />
          <Route path="/quen-mat-khau" element={<Forgot />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('Email'), 'hoa@vidu.vn ');
    const link = screen.getByRole('link', { name: 'Quên mật khẩu?' });
    expect(link.getAttribute('href')).toBe('/quen-mat-khau');
    await user.click(link);
    expect(await screen.findByText('Quên: hoa@vidu.vn')).toBeTruthy();
  });
});
