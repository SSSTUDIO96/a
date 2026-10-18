import { useState } from 'react';
import { createCourseGroup, updateCourseGroup, type CourseGroup } from '../../api/courses';
import { userMessage } from '../../api/errors';
import { Button, Dialog, IconPlus, Switch, TextInput } from '../../ui';
import { useStableKey } from './formHooks';

// Cài đặt nhóm khoá (bản vẽ C3 mục 1.1 CourseGroup): trung tâm tự đặt tên nhóm; ẩn nhóm thay cho xoá.
// Mỗi dòng: tên (sửa tại chỗ, "Lưu" khi đã đổi) · số khoá · công tắc Hiện. Dòng cuối: thêm nhóm.

export function GroupsDialog({
  orgId,
  groups,
  canWrite,
  onClose,
  onChanged,
}: {
  orgId: string;
  groups: CourseGroup[];
  canWrite: boolean;
  onClose: () => void;
  // Đã thêm / sửa nhóm — màn tải lại danh sách nhóm.
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const stableKey = useStableKey();

  async function add() {
    const name = newName.trim();
    if (!name) {
      setAddError('Nhập tên nhóm');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await createCourseGroup(orgId, { name, sortOrder: groups.length }, stableKey(name));
      setNewName('');
      onChanged();
    } catch (err) {
      setAddError(userMessage(err));
    } finally {
      setAdding(false);
    }
  }

  return (
    <Dialog open onClose={onClose} size="sm" width={560} className="kc-dlg" eyebrow="Khoá & lớp" title="Nhóm khoá" footer={<Button onClick={onClose}>Đóng</Button>}>
      <div className="kc-groups">
        {groups.length === 0 && <p className="kc-muted">Chưa có nhóm nào. Khoá chưa xếp nhóm nằm ở mục “Chưa xếp nhóm”.</p>}
        {groups.map((g) => (
          <GroupRow key={`${g.id}-${g.updatedAt}`} orgId={orgId} group={g} canWrite={canWrite} onChanged={onChanged} />
        ))}
        {canWrite && (
          <div className="kc-grow kc-grow--new">
            <TextInput
              aria-label="Tên nhóm mới"
              placeholder="Tên nhóm mới, ví dụ Nâng cao"
              value={newName}
              maxLength={120}
              error={addError}
              onChange={(e) => {
                setNewName(e.target.value);
                setAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void add();
              }}
            />
            <Button icon={<IconPlus />} onClick={() => void add()} loading={adding}>
              Thêm nhóm
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function GroupRow({ orgId, group, canWrite, onChanged }: { orgId: string; group: CourseGroup; canWrite: boolean; onChanged: () => void }) {
  const [name, setName] = useState(group.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = name.trim() !== group.name;

  async function save(input: { name?: string; isActive?: boolean }) {
    if (input.name !== undefined && !input.name) {
      setError('Nhập tên nhóm');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateCourseGroup(orgId, group.id, input);
      onChanged();
    } catch (err) {
      setError(userMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={group.isActive ? 'kc-grow' : 'kc-grow kc-grow--off'}>
      <TextInput
        aria-label={`Tên nhóm ${group.name}`}
        value={name}
        maxLength={120}
        disabled={!canWrite}
        error={error}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
      />
      <span className="kc-grow__count">{group.courseCount ?? 0} khoá</span>
      {canWrite && dirty && (
        <Button size="sm" variant="primary" loading={saving} onClick={() => void save({ name: name.trim() })}>
          Lưu
        </Button>
      )}
      <label className="kc-grow__switch">
        <span>Hiện</span>
        <Switch
          checked={group.isActive}
          disabled={!canWrite || saving}
          aria-label={`Hiện nhóm ${group.name}`}
          onChange={(isActive) => void save({ isActive })}
        />
      </label>
    </div>
  );
}
