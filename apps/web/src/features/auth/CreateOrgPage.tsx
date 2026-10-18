import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { createOrganization, type CreatedOrganization, type OrgKind } from '../../api/auth';
import { ApiError, conflictFields, fieldErrors } from '../../api/errors';
import { newIdempotencyKey } from '../../api/idempotency';
import { ErrorNotice, FieldError } from '../../app/ErrorNotice';
import { LogoutButton } from '../../app/LogoutButton';
import { useSession } from '../../app/session';
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
  const { organizations, reloadMe, selectOrg } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [kind, setKind] = useState<OrgKind | ''>('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

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
    const idempotencyKey = newIdempotencyKey();
    let created: CreatedOrganization;
    try {
      created = await createOrganization({ name: name.trim(), slug: slug.trim().toLowerCase(), kind }, idempotencyKey);
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
    selectOrg(created.id);
    void navigate(`/${created.slug}/lich`, { replace: true });
  }

  return (
    <main>
      <h1>Tạo tổ chức</h1>
      {organizations.length === 0 ? <p>Bạn chưa thuộc tổ chức nào. Tạo tổ chức đầu tiên để bắt đầu.</p> : null}
      <form onSubmit={onSubmit} noValidate>
        <p>
          <label htmlFor="name">Tên tổ chức</label>
          <br />
          <input
            id="name"
            name="name"
            maxLength={120}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'name-loi' : undefined}
          />
          <FieldError id="name-loi" message={errors.name} />
        </p>
        <p>
          <label htmlFor="slug">Đường dẫn (chữ thường không dấu, số, gạch ngang)</label>
          <br />
          <input
            id="slug"
            name="slug"
            maxLength={48}
            autoCapitalize="none"
            spellCheck={false}
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby={errors.slug ? 'slug-loi' : undefined}
          />
          <FieldError id="slug-loi" message={errors.slug} />
        </p>
        <fieldset aria-describedby={errors.kind ? 'kind-loi' : undefined}>
          <legend>Loại tổ chức</legend>
          {KIND_OPTIONS.map((o) => (
            <p key={o.value}>
              <label>
                <input type="radio" name="kind" value={o.value} checked={kind === o.value} onChange={() => setKind(o.value)} /> {o.label}
              </label>
            </p>
          ))}
          <FieldError id="kind-loi" message={errors.kind} />
        </fieldset>
        <ErrorNotice error={submitError} />
        <button type="submit" disabled={pending}>
          {pending ? 'Đang tạo…' : 'Tạo tổ chức'}
        </button>
      </form>
      {organizations.length > 0 ? (
        <p>
          <Link to="/">Quay lại</Link>
        </p>
      ) : (
        <LogoutButton />
      )}
    </main>
  );
}

