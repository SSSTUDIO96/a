import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { createOrganization, type CreatedOrganization, type OrgKind } from '../../api/auth';
import { ApiError, conflictFields, fieldErrors } from '../../api/errors';
import { ErrorNotice } from '../../app/ErrorNotice';
import { LogoutButton } from '../../app/LogoutButton';
import { useSession } from '../../app/session';
import { Button, SettingRow, TextInput, Tooltip } from '../../ui';
import { AuthLayout } from './AuthLayout';
import { useRetainedIdempotencyKey } from './useRetainedIdempotencyKey';
import { checkRequired, checkSlug, hasErrors, slugify, type FieldErrors } from './validate';

type Field = 'name' | 'slug' | 'kind';

const KIND_OPTIONS: { value: OrgKind; label: string }[] = [
  { value: 'INDIVIDUAL', label: 'Thợ cá nhân' },
  { value: 'TEAM', label: 'Đội / studio' },
  { value: 'ACADEMY', label: 'Trung tâm đào tạo' },
];

function slugTakenError(err: unknown): string | undefined {
  return conflictFields(err).includes('slug') ? 'Đường dẫn này đã có tổ chức khác dùng' : undefined;
}

export function CreateOrgPage() {
  const { organizations, reloadMe, selectOrg, user } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [kind, setKind] = useState<OrgKind | ''>('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  // Giữ khoá qua các lần bấm lại (lỗi mạng, hay đã tạo mà tải lại danh sách hỏng) — máy chủ trả lại đúng tổ chức cũ.
  const idempotency = useRetainedIdempotencyKey();

  function onNameChange(v: string) {
    setName(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const next: FieldErrors<Field> = {
      name: checkRequired(name, 'tên tổ chức', 120),
      slug: checkSlug(slug),
      kind: kind ? undefined : 'Vui lòng chọn loại tổ chức',
    };
    setErrors(next);
    setSubmitError(null);
    if (hasErrors(next) || !kind) return;
    setPending(true);
    const input = { name: name.trim(), slug: slug.trim().toLowerCase(), kind };
    let created: CreatedOrganization;
    try {
      created = await createOrganization(input, idempotency.keyFor(input));
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors({ ...fe, slug: slugTakenError(err) ?? fe.slug });
      setSubmitError(err);
      setPending(false);
      return;
    }
    try {
      await reloadMe();
    } catch (err) {
      setSubmitError(
        new ApiError(
          'RELOAD_FAILED',
          `Đã tạo tổ chức "${created.name}" nhưng chưa tải lại được danh sách tổ chức. Vui lòng tải lại trang.`,
          err instanceof ApiError ? err.status : 0,
          err instanceof ApiError ? err.requestId : null,
        ),
      );
      setPending(false);
      return;
    }
    idempotency.reset();
    selectOrg(created.id);
    void navigate(`/${created.slug}/lich`, { replace: true });
  }

  return (
    <AuthLayout
      title="Tạo tổ chức"
      lead={organizations.length === 0 ? 'Bạn chưa thuộc tổ chức nào. Tạo tổ chức đầu tiên để bắt đầu.' : undefined}
      footer={
        organizations.length > 0 ? (
          <Link to="/">Quay lại</Link>
        ) : (
          <div className="au-foot-row">
            {user?.email ? <span className="au-email">{user.email}</span> : null}
            <LogoutButton errorClassName="au-alert" />
          </div>
        )
      }
    >
      <form className="au-form" onSubmit={onSubmit} noValidate>
        <SettingRow label="Tên tổ chức" htmlFor="name" stack>
          <TextInput
            id="name"
            name="name"
            maxLength={120}
            placeholder="Studio Hoa Đào"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            error={errors.name}
          />
        </SettingRow>
        <SettingRow
          label="Đường dẫn"
          htmlFor="slug"
          stack
          tip="Tên ngắn của tổ chức trong địa chỉ trang, ví dụ /studio-hoa-dao/lich và trang giới thiệu /trang/studio-hoa-dao. Tự gợi ý theo tên; chỉ gồm chữ thường không dấu, số, gạch ngang, 3–48 ký tự."
        >
          <TextInput
            id="slug"
            name="slug"
            maxLength={48}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="studio-hoa-dao"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
            error={errors.slug}
          />
        </SettingRow>
        <fieldset
          className="au-kinds"
          aria-labelledby="kind-nhan"
          aria-describedby={errors.kind ? 'kind-loi' : undefined}
          data-invalid={errors.kind ? '' : undefined}
        >
          <legend className="au-kinds__legend">
            <span id="kind-nhan">Loại tổ chức</span>
            <Tooltip text="Trung tâm đào tạo có thêm mục Đào tạo (khoá học, lớp) và hợp đồng khoá học. Thợ cá nhân và Đội / studio dùng các mục còn lại: lịch, hợp đồng, bảng giá, khách, thợ, báo cáo." />
          </legend>
          <div className="au-kinds__list">
            {KIND_OPTIONS.map((o) => (
              <label key={o.value} className="au-kind">
                <input type="radio" name="kind" value={o.value} checked={kind === o.value} onChange={() => setKind(o.value)} /> {o.label}
              </label>
            ))}
          </div>
          {errors.kind ? (
            <div id="kind-loi" className="ui-field__error" role="alert">
              {errors.kind}
            </div>
          ) : null}
        </fieldset>
        <ErrorNotice error={submitError} className="au-alert" />
        <div className="au-submit">
          <Button type="submit" variant="primary" block loading={pending}>
            {pending ? 'Đang tạo…' : 'Tạo tổ chức'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
