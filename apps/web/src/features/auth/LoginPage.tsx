import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { fieldErrors } from '../../api/errors';
import { ErrorNotice } from '../../app/ErrorNotice';
import { useSession } from '../../app/session';
import { Button, SettingRow, TextInput } from '../../ui';
import { AuthLayout } from './AuthLayout';
import { checkEmail, hasErrors, type FieldErrors } from './validate';

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
      setErrors(fieldErrors(err));
      setSubmitError(err);
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Đăng nhập"
      footer={
        <span>
          Chưa có tài khoản? <Link to="/dang-ky">Đăng ký</Link>
        </span>
      }
    >
      {restoreError ? (
        <div className="au-restore">
          <ErrorNotice error={restoreError} className="au-alert" />
          <Button size="sm" onClick={retryRestore}>
            Thử khôi phục phiên lại
          </Button>
        </div>
      ) : null}
      <form className="au-form" onSubmit={onSubmit} noValidate>
        <SettingRow label="Email" htmlFor="email" stack>
          <TextInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ban@vidu.vn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
        </SettingRow>
        <SettingRow label="Mật khẩu" htmlFor="password" stack>
          <TextInput
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <div className="au-forgot">
            <Link to="/quen-mat-khau" state={{ email: email.trim() }}>
              Quên mật khẩu?
            </Link>
          </div>
        </SettingRow>
        <ErrorNotice error={submitError} className="au-alert" />
        <div className="au-submit">
          <Button type="submit" variant="primary" block loading={pending}>
            {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
