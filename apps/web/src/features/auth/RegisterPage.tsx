import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { fieldErrors } from '../../api/errors';
import { ErrorNotice } from '../../app/ErrorNotice';
import { useSession } from '../../app/session';
import { Button, SettingRow, TextInput } from '../../ui';
import { AuthLayout } from './AuthLayout';
import { useRetainedIdempotencyKey } from './useRetainedIdempotencyKey';
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
  // Bấm lại cùng họ tên/email/mật khẩu sau lỗi → cùng khoá: máy chủ trả lại đúng tài khoản vừa tạo, không báo trùng email.
  const idempotency = useRetainedIdempotencyKey();

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
    const input = { fullName: fullName.trim(), email: email.trim(), password };
    try {
      await register(input, idempotency.keyFor(input));
      idempotency.reset();
    } catch (err) {
      setErrors(fieldErrors(err));
      setSubmitError(err);
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Đăng ký tài khoản"
      footer={
        <span>
          Đã có tài khoản? <Link to="/dang-nhap">Đăng nhập</Link>
        </span>
      }
    >
      <form className="au-form" onSubmit={onSubmit} noValidate>
        <SettingRow label="Họ tên" htmlFor="fullName" stack>
          <TextInput
            id="fullName"
            name="fullName"
            autoComplete="name"
            maxLength={120}
            placeholder="Nguyễn Thị Hoa"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
          />
        </SettingRow>
        <SettingRow
          label="Email"
          htmlFor="email"
          stack
          tip="Dùng để đăng nhập. Chủ studio thêm bạn làm thợ cũng bằng email này."
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
        <SettingRow
          label="Mật khẩu"
          htmlFor="password"
          stack
          tip="Ít nhất 10 ký tự, tối đa 72 byte (khoảng 24–72 ký tự tuỳ chữ có dấu). Một câu ngắn dễ nhớ là đủ, ví dụ: son-moi-mau-do."
        >
          <TextInput
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Tối thiểu 10 ký tự"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
        </SettingRow>
        <ErrorNotice error={submitError} className="au-alert" />
        <div className="au-submit">
          <Button type="submit" variant="primary" block loading={pending}>
            {pending ? 'Đang tạo tài khoản…' : 'Đăng ký'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
