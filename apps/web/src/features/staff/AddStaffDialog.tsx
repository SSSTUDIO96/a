import { useEffect, useId, useState } from 'react';
import { SYSTEM_ROLE_KEYS, SYSTEM_ROLES } from '@makeup/shared';
import { errorKind, fieldErrors, userMessage } from '../../api/errors';
import { addMember, type MemberView, type RoleView } from '../../api/org';
import { Button, Select, SettingRow, TextInput } from '../../ui';
import { FormDialog, Strip } from './parts';

// Hộp "Thêm thợ vào studio" (C2 1.2, quyền members.invite): Email tài khoản * · Vai trò * → POST /members.
export interface AddStaffDialogProps {
  orgId: string;
  open: boolean;
  phone: boolean;
  // GET /roles (khi có roles.read); null → vai trò hệ thống.
  roles: RoleView[] | null;
  onClose: () => void;
  onAdded: (m: MemberView) => void;
}

const DEFAULT_ROLE = 'artist';

export function roleChoices(roles: RoleView[] | null): { value: string; label: string }[] {
  if (roles && roles.length > 0) return roles.map((r) => ({ value: r.key, label: r.name }));
  return SYSTEM_ROLE_KEYS.map((k) => ({ value: k, label: SYSTEM_ROLES[k].name }));
}

export function AddStaffDialog(p: AddStaffDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(DEFAULT_ROLE);
  const [errors, setErrors] = useState<{ email?: string; role?: string }>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ids = { email: useId(), role: useId() };
  const choices = roleChoices(p.roles);

  useEffect(() => {
    if (p.open) {
      setEmail('');
      setRole(choices.some((c) => c.value === DEFAULT_ROLE) ? DEFAULT_ROLE : (choices[0]?.value ?? ''));
      setErrors({});
      setBanner(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open]);

  if (!p.open) return null;

  async function submit() {
    const e = email.trim();
    const next: { email?: string; role?: string } = {};
    if (!e) next.email = 'Nhập email tài khoản của thợ.';
    if (!role) next.role = 'Chọn vai trò.';
    if (next.email || next.role) {
      setErrors(next);
      return;
    }
    setSaving(true);
    setBanner(null);
    try {
      const m = await addMember(p.orgId, { email: e, roleKeys: [role] });
      p.onAdded(m);
    } catch (err) {
      const kind = errorKind(err);
      const fe = fieldErrors(err);
      // 404: chưa có tài khoản; 409: đã là thành viên → cả hai thuộc ô email.
      if (kind === 'not_found' || kind === 'conflict') setErrors({ email: userMessage(err) });
      else if (fe.email || fe.roleKeys) setErrors({ email: fe.email, role: fe.roleKeys });
      else if (kind === 'validation' && /vai trò/i.test(userMessage(err))) setErrors({ role: userMessage(err) });
      else setBanner(userMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open
      phone={p.phone}
      onClose={() => !saving && p.onClose()}
      title="Thêm thợ vào studio"
      sub="Thợ phải tự đăng ký tài khoản Makeup Pro trước, rồi đưa email cho anh."
      footer={
        <>
          <Button onClick={p.onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving}>
            Thêm
          </Button>
        </>
      }
    >
      {banner && <Strip tone="danger" icon="warn">{banner}</Strip>}
      <SettingRow label="Email tài khoản" htmlFor={ids.email} required controlWidth={360}>
        <TextInput
          id={ids.email}
          type="email"
          autoComplete="off"
          placeholder="tho@gmail.com"
          value={email}
          disabled={saving}
          error={errors.email ?? null}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
        />
      </SettingRow>
      <SettingRow label="Vai trò" htmlFor={ids.role} required controlWidth={360}>
        <Select id={ids.role} options={choices} value={role} disabled={saving} error={errors.role ?? null} onChange={(e) => setRole(e.target.value)} />
      </SettingRow>
    </FormDialog>
  );
}
