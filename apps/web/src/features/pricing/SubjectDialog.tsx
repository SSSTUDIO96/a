import { useId, useState } from 'react';
import { createMakeupSubject, updateMakeupSubject } from '../../api/catalog';
import { errorKind } from '../../api/errors';
import type { MakeupSubject } from '../../api/types';
import { useOnline } from '../../layout/ErrorStates';
import { Dialog, SettingRow, TextInput } from '../../ui';
import { useStableKey } from './formHooks';
import { mapSaveError, type FormErrors } from './logic';
import { ErrorBanner } from './parts';

// Thêm nhân vật / đổi tên nhân vật (GET/POST/PATCH /makeup-subjects). Một dòng: Tên nhân vật.
export function SubjectDialog({
  orgId,
  subject,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  orgId: string;
  // null = thêm mới.
  subject: MakeupSubject | null;
  // Nhân vật mới xếp cuối danh sách.
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (s: MakeupSubject) => void;
}) {
  const id = useId();
  const online = useOnline();
  const [name, setName] = useState(subject?.name ?? '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const key = useStableKey();

  async function save() {
    setBanner(null);
    if (!name.trim()) {
      setErrors({ name: 'Nhập tên nhân vật.' });
      return;
    }
    if (subject && name.trim() === subject.name) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const saved = subject
        ? await updateMakeupSubject(orgId, subject.id, { name: name.trim() })
        : await createMakeupSubject(orgId, { name: name.trim(), sortOrder: nextSortOrder }, key.get(name.trim()));
      onSaved(saved);
    } catch (err) {
      const m = mapSaveError(err, 'package');
      // Trùng tên (409) → dưới ô Tên.
      if (errorKind(err) === 'conflict') setErrors({ name: m.banner ?? 'Tên đã có.' });
      else {
        setErrors(m.fields);
        setBanner(m.banner);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      size="sm"
      onClose={onClose}
      title={subject ? 'Đổi tên nhân vật' : 'Thêm nhân vật'}
      primaryLabel="Lưu"
      onPrimary={() => void save()}
      primaryLoading={saving}
      primaryDisabled={!online}
    >
      {banner && <ErrorBanner>{banner}</ErrorBanner>}
      <SettingRow label="Tên nhân vật" htmlFor={`${id}-ten`} controlWidth={220}>
        <TextInput
          id={`${id}-ten`}
          value={name}
          maxLength={120}
          onChange={(e) => {
            setName(e.target.value);
            setErrors({});
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
          }}
          error={errors.name}
        />
      </SettingRow>
    </Dialog>
  );
}
