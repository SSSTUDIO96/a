import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { confirmPasswordReset, isResetTokenInvalid } from '../../api/auth';
import { fieldErrors } from '../../api/errors';
import { ErrorNotice } from '../../app/ErrorNotice';
import { Button, SettingRow, TextInput } from '../../ui';
import { AuthLayout } from './AuthLayout';
import { checkNewPassword, hasErrors, type FieldErrors } from './validate';

type Field = 'password' | 'confirm';

// Thẻ nằm sau dấu # của đường dẫn trong thư: /dat-lai-mat-khau#the=<thẻ>. Phần sau # không được trình duyệt gửi lên
// máy chủ web, không lọt vào Referer hay nhật ký truy cập.
export function readResetToken(hash: string): string | null {
  const t = new URLSearchParams(hash.replace(/^#/, '')).get('the');
  return t && /^[A-Za-z0-9_-]{20,200}$/.test(t) ? t : null;
}

const Footer = (
  <span>
    <Link to="/quen-mat-khau">Gửi lại đường dẫn</Link> · <Link to="/dang-nhap">Đăng nhập</Link>
  </span>
);

// Màn "Đặt mật khẩu mới": mở từ đường dẫn trong thư. Không chặn người đang đăng nhập (mở thư trên máy đang dùng app).
export function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // Đọc thẻ MỘT lần rồi xoá khỏi thanh địa chỉ (không nằm lại trong lịch sử, ảnh chụp màn hình).
  const [token] = useState(() => readResetToken(location.hash));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (location.hash) void navigate({ pathname: location.pathname, search: location.search }, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !token) return;
    const next: FieldErrors<Field> = {
      password: checkNewPassword(password),
      confirm: confirm === password ? undefined : 'Hai lần nhập chưa khớp nhau',
    };
    setErrors(next);
    setSubmitError(null);
    if (hasErrors(next)) return;
    setPending(true);
    try {
      await confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setErrors(fieldErrors(err));
      setSubmitError(err);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <AuthLayout title="Đã đặt mật khẩu mới">
        <div className="au-notice" role="status">
          <p>Mật khẩu đã được đổi. Mọi thiết bị đang đăng nhập đã được đăng xuất.</p>
        </div>
        <div className="au-submit">
          {/* Tải lại trang: phiên cũ trong bộ nhớ (nếu có) bị bỏ hẳn, màn đăng nhập bắt đầu sạch. */}
          <a className="ui-btn ui-btn--primary ui-btn--block au-link-btn" href="/dang-nhap">
            Đăng nhập bằng mật khẩu mới
          </a>
        </div>
      </AuthLayout>
    );
  }

  if (!token) {
    return (
      <AuthLayout title="Đặt mật khẩu mới" footer={Footer}>
        <div className="au-alert" role="alert">
          <p>Đường dẫn thiếu mã đặt lại hoặc đã bị cắt. Hãy mở lại đúng đường dẫn trong thư, hoặc gửi đường dẫn mới.</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Đặt mật khẩu mới" footer={Footer}>
      <form className="au-form" onSubmit={onSubmit} noValidate>
        <SettingRow
          label="Mật khẩu mới"
          htmlFor="password"
          stack
          tip="Ít nhất 10 ký tự, tối đa 72 byte (khoảng 24–72 ký tự tuỳ chữ có dấu). Đặt xong, mọi thiết bị đang đăng nhập sẽ bị đăng xuất."
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
        <SettingRow label="Nhập lại mật khẩu mới" htmlFor="confirm" stack tip="Gõ lại đúng mật khẩu ở trên để chắc không gõ nhầm.">
          <TextInput
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
          />
        </SettingRow>
        <ErrorNotice error={submitError} className="au-alert" />
        {isResetTokenInvalid(submitError) ? (
          <p className="au-hint">
            <Link to="/quen-mat-khau">Gửi đường dẫn mới</Link>
          </p>
        ) : null}
        <div className="au-submit">
          <Button type="submit" variant="primary" block loading={pending}>
            {pending ? 'Đang lưu…' : 'Đặt mật khẩu mới'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
