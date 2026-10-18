import { useEffect, useState } from 'react';
import { createContractText, listContractTexts, updateContractText } from '../../api/contracts';
import { fieldErrors, userMessage } from '../../api/errors';
import { newIdempotencyKey } from '../../api/idempotency';
import type { ContractKind, ContractText, ContractTextKind } from '../../api/types';
import { Button, Card, Checkbox, Dialog, IconLock, IconPlus, Segmented, Select, SettingRow, StatusTag, TextInput, Textarea } from '../../ui';
import { TEXT_KIND_LABEL, defaultText, paragraphs, textVersionText } from './courseModel';

// Thẻ "Điều khoản & nội quy" (bản vẽ C3 mục 2.3): chọn mẫu cho hợp đồng (mặc định gợi ý sẵn), xem nội dung, và — người có
// quyền contracts.texts — "Quản lý mẫu": danh sách, thêm, sửa nội dung (phiên bản tự tăng), đặt mặc định.
// Sau xác nhận: hiện BẢN CHỤP trong hợp đồng (terms / rules + phiên bản), không đổi theo mẫu.

const KINDS: ContractTextKind[] = ['TERMS', 'RULES'];
const TEXT_TITLE: Record<ContractTextKind, string> = { TERMS: 'Điều khoản', RULES: 'Nội quy trung tâm' };
const MAX_BODY = 20_000;

export interface ChosenTexts {
  termsTemplateId: string | null;
  rulesTemplateId: string | null;
}

export interface Snapshot {
  terms: string | null;
  rules: string | null;
  termsTemplateId: string | null;
  termsTemplateVersion: number | null;
  rulesTemplateId: string | null;
  rulesTemplateVersion: number | null;
}

export interface ContractTextsCardProps {
  contractKind: ContractKind;
  texts: ContractText[] | null;
  textsError: string | null;
  tz: string;
  chosen: ChosenTexts;
  // Có = hợp đồng đã xác nhận: hiện bản chụp.
  snapshot: Snapshot | null;
  locked: boolean;
  canManage: boolean;
  onChoose: (kind: ContractTextKind, id: string | null) => void;
  onManage: () => void;
  onRetry: () => void;
}

const idKey = (k: ContractTextKind) => (k === 'TERMS' ? 'termsTemplateId' : 'rulesTemplateId');

export function ContractTextsCard(p: ContractTextsCardProps) {
  const [viewing, setViewing] = useState<{ title: string; eyebrow: string; body: string } | null>(null);
  const kinds = p.contractKind === 'COURSE' ? KINDS : (['TERMS'] as ContractTextKind[]);
  return (
    <Card
      title="Điều khoản & nội quy"
      className="ct-tx"
      actions={
        p.canManage ? (
          <Button size="sm" variant="ghost" onClick={p.onManage}>
            Quản lý mẫu
          </Button>
        ) : undefined
      }
    >
      {p.textsError && (
        <div className="ct-alert" role="alert">
          <span>{p.textsError}</span>{' '}
          <Button size="sm" onClick={p.onRetry}>
            Thử lại
          </Button>
        </div>
      )}
      {kinds.map((k) => {
        const list = (p.texts ?? []).filter((t) => t.kind === k && t.isActive);
        if (p.snapshot) {
          const body = k === 'TERMS' ? p.snapshot.terms : p.snapshot.rules;
          const version = k === 'TERMS' ? p.snapshot.termsTemplateVersion : p.snapshot.rulesTemplateVersion;
          const tplId = k === 'TERMS' ? p.snapshot.termsTemplateId : p.snapshot.rulesTemplateId;
          const name = (p.texts ?? []).find((t) => t.id === tplId)?.name ?? TEXT_TITLE[k];
          return (
            <div className="ct-tpl" key={k} data-o={`mau-${k.toLowerCase()}`}>
              <div className="ct-tpl__n">
                <b>{body ? name : TEXT_TITLE[k]}</b>
                <div className="ct-fx">{body ? (version ? `Bản v${version} đã chụp vào hợp đồng` : 'Tự nhập, đã chụp vào hợp đồng') : 'Hợp đồng không có ' + TEXT_TITLE[k].toLowerCase()}</div>
              </div>
              {body && (
                <Button size="sm" onClick={() => setViewing({ title: name, eyebrow: version ? `Bản v${version} · đã chụp` : 'Đã chụp', body })}>
                  Xem
                </Button>
              )}
            </div>
          );
        }
        const chosenId = p.chosen[idKey(k)];
        const chosen = list.find((t) => t.id === chosenId) ?? null;
        const def = defaultText(list, k);
        return (
          <div className="ct-tpl" key={k} data-o={`mau-${k.toLowerCase()}`}>
            <div className="ct-tpl__n">
              <label className="ct-tpl__l" htmlFor={`hd-mau-${k}`}>
                {TEXT_TITLE[k]}
              </label>
              {p.texts === null && !p.textsError ? (
                <div className="ct-fx">Đang tải mẫu…</div>
              ) : list.length === 0 ? (
                <div className="ct-fx">
                  Chưa có mẫu {TEXT_KIND_LABEL[k].toLowerCase()}
                  {p.canManage ? ' — bấm Quản lý mẫu để thêm.' : '.'}
                </div>
              ) : (
                <>
                  <Select
                    id={`hd-mau-${k}`}
                    size="sm"
                    aria-label={`Mẫu ${TEXT_KIND_LABEL[k].toLowerCase()}`}
                    disabled={p.locked}
                    options={[
                      { value: '', label: def ? `Theo mẫu mặc định (${def.name})` : 'Không dùng mẫu' },
                      ...list.map((t) => ({ value: t.id, label: `${t.name}${t.isDefault ? ' — mặc định' : ''}` })),
                    ]}
                    value={chosenId ?? ''}
                    onChange={(e) => p.onChoose(k, e.target.value || null)}
                  />
                  {(chosen ?? def) && <div className="ct-fx">{textVersionText((chosen ?? def) as ContractText, p.tz)}</div>}
                </>
              )}
            </div>
            {(chosen ?? def) && (
              <Button
                size="sm"
                onClick={() => {
                  const t = (chosen ?? def) as ContractText;
                  setViewing({ title: t.name, eyebrow: textVersionText(t, p.tz), body: t.body });
                }}
              >
                Xem
              </Button>
            )}
          </div>
        );
      })}
      <div className="ct-fx ct-tx__lock">
        <IconLock />
        {p.snapshot ? 'Đã chụp lúc xác nhận — sửa mẫu sau này không đổi hợp đồng này.' : 'Bấm Xác nhận: nội dung các mẫu được chụp vào hợp đồng.'}
      </div>
      <Dialog open={viewing !== null} onClose={() => setViewing(null)} eyebrow={viewing?.eyebrow} title={viewing?.title ?? ''} size="sm" width={620} footer={<Button onClick={() => setViewing(null)}>Đóng</Button>}>
        <div className="ct-txbody">
          {paragraphs(viewing?.body ?? null).map((x, i) => (
            <p key={i}>{x}</p>
          ))}
        </div>
      </Dialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Hộp "Quản lý mẫu" (quyền contracts.texts). Không có mục điều hướng riêng — mở từ thẻ trên.
type Editing = { mode: 'new' } | { mode: 'edit'; text: ContractText };

const APPLIES: { value: 'BOTH' | ContractKind; label: string }[] = [
  { value: 'BOTH', label: 'Cả hai' },
  { value: 'COURSE', label: 'Khoá học' },
  { value: 'SERVICE', label: 'Dịch vụ' },
];

function appliesLabel(a: ContractKind[]): string {
  if (a.length === 0 || a.length === 2) return 'Cả hai loại hợp đồng';
  return a[0] === 'COURSE' ? 'Hợp đồng khoá học' : 'Hợp đồng dịch vụ';
}

export interface TextsManagerProps {
  open: boolean;
  orgId: string;
  tz: string;
  onClose: () => void;
  // Danh sách đã đổi (thêm / sửa / đặt mặc định) → màn tải lại mẫu.
  onChanged: () => void;
}

export function TextsManager({ open, orgId, tz, onClose, onChanged }: TextsManagerProps) {
  const [list, setList] = useState<ContractText[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [kind, setKind] = useState<ContractTextKind>('TERMS');
  const [applies, setApplies] = useState<'BOTH' | ContractKind>('COURSE');
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [key, setKey] = useState(newIdempotencyKey());

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setLoadError(null);
    listContractTexts(orgId, { includeInactive: true }, controller.signal)
      .then((r) => setList(r))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setLoadError(userMessage(err));
      });
    return () => controller.abort();
  }, [open, orgId, attempt]);

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setNotice(null);
      setRowError(null);
    }
  }, [open]);

  function startNew() {
    setEditing({ mode: 'new' });
    setKind('TERMS');
    setApplies('COURSE');
    setName('');
    setBody('');
    setIsDefault(false);
    setErrors({});
    setKey(newIdempotencyKey());
  }

  function startEdit(t: ContractText) {
    setEditing({ mode: 'edit', text: t });
    setKind(t.kind);
    setApplies(t.appliesTo.length === 1 ? (t.appliesTo[0] as ContractKind) : 'BOTH');
    setName(t.name);
    setBody(t.body);
    setIsDefault(t.isDefault);
    setErrors({});
  }

  const appliesTo: ContractKind[] = applies === 'BOTH' ? [] : [applies];

  async function save() {
    const e: Record<string, string> = {};
    if (name.trim() === '') e.name = 'Nhập tên mẫu.';
    if (body.trim() === '') e.body = 'Nhập nội dung.';
    if (kind === 'RULES' && applies === 'SERVICE') e.appliesTo = 'Nội quy chỉ dùng cho hợp đồng khoá học.';
    setErrors(e);
    if (Object.keys(e).length > 0 || !editing) return;
    setBusy('save');
    try {
      if (editing.mode === 'new') {
        await createContractText(orgId, { kind, appliesTo, name: name.trim(), body, ...(isDefault ? { isDefault: true } : {}) }, key);
        setNotice(`Đã thêm mẫu "${name.trim()}".`);
      } else {
        const t = editing.text;
        const res = await updateContractText(orgId, t.id, {
          ...(name.trim() !== t.name ? { name: name.trim() } : {}),
          ...(body !== t.body ? { body } : {}),
          ...(JSON.stringify(appliesTo) !== JSON.stringify(t.appliesTo) ? { appliesTo } : {}),
          ...(isDefault !== t.isDefault ? { isDefault } : {}),
        });
        setNotice(res.version !== t.version ? `Đã lưu "${res.name}" thành bản v${res.version}.` : `Đã lưu "${res.name}".`);
      }
      setEditing(null);
      setAttempt((n) => n + 1);
      onChanged();
    } catch (err) {
      const f = fieldErrors(err);
      setErrors(Object.keys(f).length > 0 ? f : { form: userMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  async function patchRow(t: ContractText, input: { isDefault?: boolean; isActive?: boolean }, done: string) {
    setBusy(t.id);
    setRowError(null);
    try {
      await updateContractText(orgId, t.id, input);
      setNotice(done);
      setAttempt((n) => n + 1);
      onChanged();
    } catch (err) {
      setRowError(userMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const unchanged =
    editing?.mode === 'edit' &&
    name.trim() === editing.text.name &&
    body === editing.text.body &&
    JSON.stringify(appliesTo) === JSON.stringify(editing.text.appliesTo) &&
    isDefault === editing.text.isDefault;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      eyebrow="Hợp đồng"
      title={editing ? (editing.mode === 'new' ? 'Thêm mẫu điều khoản / nội quy' : `Sửa mẫu "${editing.text.name}"`) : 'Mẫu điều khoản & nội quy'}
      size="sm"
      width={720}
      className="ct-txm"
      footer={
        editing ? (
          <>
            <Button onClick={() => setEditing(null)} disabled={busy !== null}>
              Quay lại
            </Button>
            <Button variant="primary" loading={busy === 'save'} disabled={unchanged} onClick={() => void save()}>
              {editing.mode === 'new' ? 'Thêm mẫu' : 'Lưu mẫu'}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Đóng</Button>
            <Button variant="primary" icon={<IconPlus />} onClick={startNew}>
              Thêm mẫu
            </Button>
          </>
        )
      }
    >
      {notice && !editing && (
        <div className="ct-okband" role="status">
          <span>{notice}</span>
        </div>
      )}
      {editing ? (
        <div className="ct-txm__form">
          {errors.form && (
            <div className="ct-alert" role="alert">
              {errors.form}
            </div>
          )}
          <SettingRow label="Loại mẫu" tip="Điều khoản: in ở mọi hợp đồng. Nội quy: chỉ hợp đồng khoá học." controlWidth={260}>
            {editing.mode === 'new' ? (
              <Segmented<ContractTextKind>
                size="sm"
                block
                aria-label="Loại mẫu"
                options={KINDS.map((k) => ({ value: k, label: TEXT_KIND_LABEL[k] }))}
                value={kind}
                onChange={setKind}
              />
            ) : (
              <span>{TEXT_KIND_LABEL[kind]}</span>
            )}
          </SettingRow>
          <SettingRow label="Tên mẫu" required htmlFor="txm-ten" controlWidth={320}>
            <TextInput id="txm-ten" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Ví dụ: Điều khoản khoá học" />
          </SettingRow>
          <SettingRow label="Dùng cho" tip="Mẫu hiện ở ô chọn của loại hợp đồng này." controlWidth={300}>
            <Segmented<'BOTH' | ContractKind> size="sm" block aria-label="Dùng cho loại hợp đồng" options={APPLIES} value={applies} onChange={setApplies} />
            {errors.appliesTo && <div className="ct-err">{errors.appliesTo}</div>}
          </SettingRow>
          <SettingRow
            label="Nội dung"
            required
            htmlFor="txm-nd"
            stack
            tip={editing.mode === 'edit' ? `Đang là bản v${editing.text.version}. Đổi nội dung → bản v${editing.text.version + 1}; hợp đồng đã xác nhận giữ bản cũ đã chụp.` : 'Mỗi dòng là một mục khi in.'}
          >
            <Textarea id="txm-nd" rows={8} value={body} maxLength={MAX_BODY} onChange={(e) => setBody(e.target.value)} error={errors.body} />
          </SettingRow>
          <Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} label="Đặt làm mẫu mặc định (gợi ý sẵn khi lập hợp đồng)" />
        </div>
      ) : loadError ? (
        <div className="ct-alert" role="alert">
          <span>{loadError}</span>{' '}
          <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
            Thử lại
          </Button>
        </div>
      ) : list === null ? (
        <p className="ct-fx">Đang tải mẫu…</p>
      ) : list.length === 0 ? (
        <p className="ct-fx">Chưa có mẫu nào. Bấm "Thêm mẫu".</p>
      ) : (
        <ul className="ct-txm__ls" aria-label="Danh sách mẫu">
          {rowError && (
            <li className="ct-alert" role="alert">
              {rowError}
            </li>
          )}
          {list.map((t) => (
            <li key={t.id} className={`ct-txm__r${t.isActive ? '' : ' is-off'}`}>
              <div className="ct-txm__n">
                <b>{t.name}</b>
                <span className="ct-txm__tags">
                  <StatusTag>{TEXT_KIND_LABEL[t.kind]}</StatusTag>
                  {t.isDefault && <StatusTag tone="accent">Mặc định</StatusTag>}
                  {!t.isActive && <StatusTag tone="neutral">Ngừng dùng</StatusTag>}
                </span>
                <span className="ct-fx">
                  {appliesLabel(t.appliesTo)} · {textVersionText(t, tz)} · {t.updatedBy.fullName}
                </span>
              </div>
              <div className="ct-txm__a">
                {t.isActive && !t.isDefault && (
                  <Button size="sm" variant="ghost" loading={busy === t.id} onClick={() => void patchRow(t, { isDefault: true }, `Đã đặt "${t.name}" làm mẫu mặc định.`)}>
                    Đặt mặc định
                  </Button>
                )}
                {!t.isActive && (
                  <Button size="sm" variant="ghost" loading={busy === t.id} onClick={() => void patchRow(t, { isActive: true }, `Đã dùng lại "${t.name}".`)}>
                    Dùng lại
                  </Button>
                )}
                <Button size="sm" onClick={() => startEdit(t)} aria-label={`Sửa ${t.name}`}>
                  Sửa
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
