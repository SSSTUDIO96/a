import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { fieldErrors } from '../../api/errors';
import { newIdempotencyKey } from '../../api/idempotency';
import { ErrorNotice, FieldError } from '../../app/ErrorNotice';
import { useSession } from '../../app/session';
import { checkEmail, checkNewPassword, checkRequired, hasErrors, type FieldErrors } from './validate';

type Field = 'fullName' | 'email' | 'password';

export function RegisterPage() {
  const { register } = useSession();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const next: FieldErrors<Field> = {
      fullName: checkRequired(fullName, 'họ tên', 120),
      email: checkEmail(email),
      password: checkNewPassword(password),
    };
    setErrors(next);
    setSubmitError(null);
    if (hasErrors(next)) return;
    setPending(true);
    try {
      await register({ fullName: fullName.trim(), email: email.trim(), password }, newIdempotencyKey());
    } catch (err) {
      setErrors(fieldErrors(err));
      setSubmitError(err);
      setPending(false);
    }
  }

  return (
    <main>
      <h1>Đăng ký tài khoản</h1>
      <form onSubmit={onSubmit} noValidate>
        <p>
          <label htmlFor="fullName">Họ tên</label>
          <br />
          <input
            id="fullName"
            name="fullName"
            autoComplete="name"
            maxLength={120}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-invalid={errors.fullName ? true : undefined}
            aria-describedby={errors.fullName ? 'fullName-loi' : undefined}
          />
          <FieldError id="fullName-loi" message={errors.fullName} />
        </p>
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
          <label htmlFor="password">Mật khẩu (tối thiểu 10 ký tự)</label>
          <br />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? 'password-loi' : undefined}
          />
          <FieldError id="password-loi" message={errors.password} />
        </p>
        <ErrorNotice error={submitError} />
        <button type="submit" disabled={pending}>
          {pending ? 'Đang tạo tài khoản…' : 'Đăng ký'}
        </button>
      </form>
      <p>
        Đã có tài khoản? <Link to="/dang-nhap">Đăng nhập</Link>
      </p>
    </main>
  );
}
