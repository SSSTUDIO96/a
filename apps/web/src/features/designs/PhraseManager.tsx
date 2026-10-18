import { useId, useState } from 'react';
import {
  createGreetingPhrase,
  listGreetingPhrases,
  updateGreetingPhrase,
  type ContractKindKey,
  type GreetingPhrase,
  type GreetingPhraseInput,
} from '../../api/designs';
import { fieldErrors, userMessage } from '../../api/errors';
import { newIdempotencyKey } from '../../api/idempotency';
import { Button, EmptyState, IconPlus, Segmented, SettingRow, Skeleton, Switch, Textarea, TextInput } from '../../ui';
import { FormDialog, LoadErrorStrip, Strip } from '../staff/parts';
import { useLoad } from '../staff/useOrgInfo';
import type { DesignPerms } from './model';

type Applies = 'BOTH' | ContractKindKey;
const APPLIES_LABEL: Record<Applies, string> = { BOTH: 'Cả hai loại', COURSE: 'Hợp đồng khoá học', SERVICE: 'Hợp đồng dịch vụ' };

function appliesOf(p: { appliesTo: ContractKindKey[] }): Applies {
  return p.appliesTo.length === 1 ? (p.appliesTo[0] as ContractKindKey) : 'BOTH';
}

interface PhraseDraft {
  name: string;
  applies: Applies;
  title: string;
  body: string;
}

// Câu chúc soạn sẵn (GreetingPhrase): thêm, sửa, ẩn/hiện. Máy chủ chép 6 câu mặc định lúc tạo tổ chức.
export function PhraseManager({ orgId, phone, perms }: { orgId: string; phone: boolean; perms: DesignPerms }) {
  const list = useLoad((signal) => listGreetingPhrases(orgId, { includeInactive: true }, signal), [orgId]);
  const [editing, setEditing] = useState<{ phrase: GreetingPhrase | null; draft: PhraseDraft } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);
  const [rowError, setRowError] = useState<string | null>(null);
  const ids = { name: useId(), title: useId(), body: useId() };

  function open(p: GreetingPhrase | null) {
    setErrors({});
    setBanner(null);
    setKey(newIdempotencyKey());
    setEditing({ phrase: p, draft: p ? { name: p.name, applies: appliesOf(p), title: p.title, body: p.body } : { name: '', applies: 'BOTH', title: '', body: '' } });
  }

  function setD(k: keyof PhraseDraft, v: string) {
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, [k]: v } } : e));
    setErrors((x) => ({ ...x, [k]: '' }));
  }

  async function save() {
    if (!editing) return;
    const d = editing.draft;
    const local: Record<string, string> = {};
    if (!d.name.trim()) local.name = 'Nhập tên câu chúc.';
    if (!d.title.trim()) local.title = 'Nhập tiêu đề.';
    if (!d.body.trim()) local.body = 'Nhập lời chúc.';
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    const input: GreetingPhraseInput = {
      name: d.name.trim(),
      appliesTo: d.applies === 'BOTH' ? [] : [d.applies],
      title: d.title.trim(),
      body: d.body.trim(),
    };
    setSaving(true);
    setBanner(null);
    try {
      const saved = editing.phrase ? await updateGreetingPhrase(orgId, editing.phrase.id, input) : await createGreetingPhrase(orgId, input, key);
      list.set((rows) => (editing.phrase ? rows.map((r) => (r.id === saved.id ? saved : r)) : [...rows, saved]));
      setEditing(null);
    } catch (err) {
      const fe = fieldErrors(err);
      const mapped = { name: fe.name, title: fe.title, body: fe.body, applies: fe.appliesTo };
      if (Object.values(mapped).some(Boolean)) setErrors(Object.fromEntries(Object.entries(mapped).filter(([, v]) => v)) as Record<string, string>);
      else setBanner(userMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(p: GreetingPhrase, isActive: boolean) {
    setRowError(null);
    try {
      const saved = await updateGreetingPhrase(orgId, p.id, { isActive });
      list.set((rows) => rows.map((r) => (r.id === saved.id ? saved : r)));
    } catch (err) {
      setRowError(userMessage(err));
    }
  }

  return (
    <section className="ui-card mtk-phr" aria-label="Câu chúc soạn sẵn">
      <header className="ui-card__head">
        <h2 className="ui-card__title">Câu chúc soạn sẵn</h2>
        {perms.write && (
          <Button size="sm" icon={<IconPlus />} onClick={() => open(null)}>
            Thêm câu chúc
          </Button>
        )}
      </header>
      <div className="ui-card__body">
        {rowError && (
          <Strip tone="danger" icon="warn">
            {rowError}
          </Strip>
        )}
        {list.state.status === 'loading' && <Skeleton height={80} />}
        {list.state.status === 'error' && <LoadErrorStrip error={list.state.error} retry={list.reload} />}
        {list.state.status === 'ready' && list.state.data.length === 0 && <EmptyState message="Chưa có câu chúc nào." />}
        {list.state.status === 'ready' && list.state.data.length > 0 && (
          <ul className="mtk-phr__list">
            {list.state.data.map((p) => (
              <li key={p.id} className="mtk-phr__row" data-off={!p.isActive || undefined}>
                <div className="mtk-phr__txt">
                  <b>{p.name}</b>
                  <span className="mtk-hint">
                    {APPLIES_LABEL[appliesOf(p)]} · {p.title}
                  </span>
                  <span className="mtk-phr__body">{p.body}</span>
                </div>
                <div className="mtk-phr__act">
                  <Switch aria-label={`Đang dùng: ${p.name}`} checked={p.isActive} disabled={!perms.write} onChange={(v) => toggle(p, v)} />
                  {perms.write && (
                    <Button size="sm" variant="ghost" onClick={() => open(p)}>
                      Sửa
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <FormDialog
        open={editing !== null}
        phone={phone}
        onClose={() => setEditing(null)}
        title={editing?.phrase ? 'Sửa câu chúc' : 'Thêm câu chúc'}
        footer={
          <>
            <Button onClick={() => setEditing(null)} disabled={saving}>
              Huỷ
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              Lưu
            </Button>
          </>
        }
      >
        {editing && (
          <div className="mtk-dlg">
            {banner && (
              <Strip tone="danger" icon="warn">
                {banner}
              </Strip>
            )}
            <SettingRow label="Tên" htmlFor={ids.name} required stack>
              <TextInput id={ids.name} value={editing.draft.name} maxLength={80} error={errors.name || null} onChange={(e) => setD('name', e.target.value)} />
            </SettingRow>
            <SettingRow label="Dùng cho" stack tip="Câu chỉ hiện khi làm lời chúc cho loại hợp đồng này.">
              <Segmented
                aria-label="Dùng cho"
                size="sm"
                value={editing.draft.applies}
                onChange={(v) => setD('applies', v)}
                options={(['BOTH', 'COURSE', 'SERVICE'] as const).map((v) => ({ value: v, label: v === 'BOTH' ? 'Cả hai' : v === 'COURSE' ? 'Khoá học' : 'Dịch vụ' }))}
              />
              {errors.applies && <p className="mtk-err">{errors.applies}</p>}
            </SettingRow>
            <SettingRow label="Tiêu đề" htmlFor={ids.title} required stack>
              <TextInput id={ids.title} value={editing.draft.title} maxLength={120} error={errors.title || null} onChange={(e) => setD('title', e.target.value)} />
            </SettingRow>
            <SettingRow label="Lời chúc" htmlFor={ids.body} required stack>
              <Textarea id={ids.body} rows={5} value={editing.draft.body} maxLength={1000} error={errors.body || null} onChange={(e) => setD('body', e.target.value)} />
            </SettingRow>
          </div>
        )}
      </FormDialog>
    </section>
  );
}
