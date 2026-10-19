import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { requestPasswordReset } from '../../api/auth';
import { fieldErrors } from '../../api/errors';
import { ErrorNotice } from '../../app/ErrorNotice';
import { Button, SettingRow, TextInput } from '../../ui';
import { AuthLayout } from './AuthLayout';
import { checkEmail, hasErrors, type FieldErrors } from './validate';

type Field = 'email';

// Email gõ dở ở màn Đăng nhập được mang sang (state của liên kết "Quên mật khẩu?").
function emailFromState(state: unknown): string {
  const v = (state as { email?: unknown } | null)?.email;
  return typeof v === 'string' ? v : '';
}

// Màn "Quên mật khẩu": nhập email → máy chủ gửi thư có đường dẫn đặt lại.
// Máy chủ trả CÙNG một lời dù email có tài khoản hay không (chống dò tài khoản) — màn hiện nguyên lời đó, không đoán thêm.
export function ForgotPasswordPage() {
  const location = useLocation();
  const [email, setEmail] = useState(() => emailFromState(location.state));
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const next: FieldErrors<Field> = { email: checkEmail(email) };
    setErrors(next);
    setSubmitError(null);
    if (hasErrors(next)) return;
    setPending(true);
    try {
      const res = await requestPasswordReset(email.trim());
      setSentMessage(res.message);
    } catch (err) {
      setErrors(fieldErrors(err));
      setSubmitError(err);
    } finally {
      setPending(false);
    }
  }

  const footer = (
    <span>
      Nhớ ra mật khẩu? <Link to="/dang-nhap">Đăng nhập</Link>
    </span>
  );

  if (sentMessage !== null) {
    return (
      <AuthLayout title="Kiểm tra hộp thư" footer={footer}>
        <div className="au-notice" role="status">
          <p>{sentMessage}</p>
          <p className="au-email">{email.trim()}</p>
        </div>
        <div className="au-submit">
          <Button block onClick={() => setSentMessage(null)}>
            Gửi lại hoặc dùng email khác
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Quên mật khẩu" footer={footer}>
      <form className="au-form" onSubmit={onSubmit} noValidate>
        <SettingRow
          label="Email"
          htmlFor="email"
          stack
          tip="Email bạn dùng để đăng nhập. Chúng tôi gửi tới đó một đường dẫn đặt mật khẩu mới, hết hạn sau 30 phút và chỉ dùng được một lần."
        >
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
        <ErrorNotice error={submitError} className="au-alert" />
        <div className="au-submit">
          <Button type="submit" variant="primary" block loading={pending}>
            {pending ? 'Đang gửi…' : 'Gửi đường dẫn đặt lại'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
