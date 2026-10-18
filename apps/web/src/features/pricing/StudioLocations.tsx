import { useId, useState } from 'react';
import { createStudioLocation, listStudioLocations, updateStudioLocation } from '../../api/catalog';
import { userMessage } from '../../api/errors';
import type { StudioLocation } from '../../api/types';
import { useOnline } from '../../layout/ErrorStates';
import { Button, Card, Dialog, IconPlus, SettingRow, Skeleton, Textarea, TextInput } from '../../ui';
import { useStableKey } from './formHooks';
import { useResource } from './hooks';
import { mapSaveError, type FormErrors } from './logic';
import { ErrorBanner, Group, GroupError, LoadError } from './parts';

export const TIP_STUDIO = 'Điểm xuất phát để đo số km. Chấm tròn = mặc định.';

// Thẻ "Studio / cửa hàng": chấm tròn mặc định (isDefault) · tên · địa chỉ 12px; nút thêm. GET/POST/PATCH /studio-locations.
export function StudioLocations({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  const [res, reload] = useResource((signal) => listStudioLocations(orgId, { isActive: true }, signal).then((r) => r.items), [orgId]);
  const [editing, setEditing] = useState<StudioLocation | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();
  const name = useId();

  async function makeDefault(s: StudioLocation) {
    setError(null);
    setBusyId(s.id);
    try {
      await updateStudioLocation(orgId, s.id, { isDefault: true });
      reload();
    } catch (err) {
      setError(userMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  let body;
  if (res.status === 'loading') {
    body = (
      <div role="status" aria-label="Đang tải studio">
        {[0, 1].map((i) => (
          <div key={i} className="pr-stu">
            <Skeleton width={16} height={16} circle />
            <span className="pr-stu__txt">
              <Skeleton width={140} height={14} />
              <Skeleton width={220} height={12} />
            </span>
          </div>
        ))}
      </div>
    );
  } else if (res.status === 'error') {
    body = <LoadError error={res.error} retry={reload} />;
  } else if (res.data.length === 0) {
    body = <p className="pr-muted">Chưa có studio / cửa hàng.</p>;
  } else {
    body = res.data.map((s) => (
      <div key={s.id} className="pr-stu">
        <input
          type="radio"
          name={name}
          checked={s.isDefault}
          disabled={!canWrite || !online || busyId !== null}
          aria-label={`Đặt ${s.name} làm mặc định`}
          onChange={() => void makeDefault(s)}
        />
        {canWrite ? (
          <button type="button" className="pr-stu__txt pr-stu__btn" onClick={() => setEditing(s)}>
            <span className="pr-stu__name">{s.name}</span>
            <span className="pr-fx">{s.address}</span>
          </button>
        ) : (
          <span className="pr-stu__txt">
            <span className="pr-stu__name">{s.name}</span>
            <span className="pr-fx">{s.address}</span>
          </span>
        )}
      </div>
    ));
  }

  return (
    <Card className="pr-setcard">
      <Group title="Studio / cửa hàng" tip={TIP_STUDIO}>
        {body}
        <GroupError message={error} />
        {canWrite && (
          <Button variant="ghost" size="sm" className="pr-add-link" icon={<IconPlus />} onClick={() => setEditing('new')}>
            Thêm studio / cửa hàng
          </Button>
        )}
      </Group>
      {editing && (
        <StudioDialog
          orgId={orgId}
          studio={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </Card>
  );
}

function StudioDialog({ orgId, studio, onClose, onSaved }: { orgId: string; studio: StudioLocation | null; onClose: () => void; onSaved: () => void }) {
  const id = useId();
  const online = useOnline();
  const [form, setForm] = useState({ name: studio?.name ?? '', address: studio?.address ?? '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const key = useStableKey();

  async function save() {
    setBanner(null);
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Nhập tên.';
    if (!form.address.trim()) e.address = 'Nhập địa chỉ.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const body = { name: form.name.trim(), address: form.address.trim() };
    setSaving(true);
    try {
      if (studio) await updateStudioLocation(orgId, studio.id, body);
      else await createStudioLocation(orgId, body, key.get(JSON.stringify(body)));
      onSaved();
    } catch (err) {
      const m = mapSaveError(err, 'package');
      setErrors(m.fields);
      setBanner(m.banner);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      size="sm"
      onClose={onClose}
      title={studio ? 'Sửa studio / cửa hàng' : 'Thêm studio / cửa hàng'}
      primaryLabel="Lưu"
      onPrimary={() => void save()}
      primaryLoading={saving}
      primaryDisabled={!online}
    >
      {banner && <ErrorBanner>{banner}</ErrorBanner>}
      <SettingRow label="Tên" htmlFor={`${id}-ten`} controlWidth={240}>
        <TextInput id={`${id}-ten`} value={form.name} maxLength={120} onChange={(ev) => setForm({ ...form, name: ev.target.value })} error={errors.name} />
      </SettingRow>
      <SettingRow label="Địa chỉ" htmlFor={`${id}-dc`} stack>
        <Textarea id={`${id}-dc`} rows={2} value={form.address} maxLength={500} onChange={(ev) => setForm({ ...form, address: ev.target.value })} error={errors.address} />
      </SettingRow>
    </Dialog>
  );
}
