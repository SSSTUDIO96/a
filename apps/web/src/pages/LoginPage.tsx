import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ErrorNotice, FieldError } from '../components/ErrorNotice';
import { useSession } from '../lib/session';
import { checkEmail, hasErrors, serverFieldErrors, type FieldErrors } from '../lib/validate';

type Field = 'email' | 'password';

export function LoginPage() {
  const { login, restoreError, retryRestore } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const next: FieldErrors<Field> = { email: checkEmail(email), password: password ? undefined : 'Vui lòng nhập mật khẩu' };
    setErrors(next);
    setSubmitError(null);
    if (hasErrors(next)) return;
    setPending(true);
    try {
      // Thành công thì GuestOnly tự chuyển trang khi phiên đã được máy chủ xác nhận.
      await login(email.trim(), password);
    } catch (err) {
      setErrors(serverFieldErrors(err));
      setSubmitError(err);
      setPending(false);
    }
  }

  return (
    <main>
      <h1>Đăng nhập</h1>
      {restoreError ? (
        <div>
          <ErrorNotice error={restoreError} />
          <button type="button" onClick={retryRestore}>
            Thử khôi phục phiên lại
          </button>
        </div>
      ) : null}
      <form onSubmit={onSubmit} noValidate>
        <p>
          <label htmlFor="email">Email</label>
          <br />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'email-loi' : undefined}
          />
          <FieldError id="email-loi" message={errors.email} />
        </p>
        <p>
          <label htmlFor="password">Mật khẩu</label>
          <br />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'password-loi' : undefined}
          />
          <FieldError id="password-loi" message={errors.password} />
        </p>
        <ErrorNotice error={submitError} />
        <button type="submit" disabled={pending}>
          {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
      <p>
        Chưa có tài khoản? <Link to="/dang-ky">Đăng ký</Link>
      </p>
    </main>
  );
}
