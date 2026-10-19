import { useEffect, useMemo, useRef, useState } from 'react';
import { findDesignTemplate } from '@makeup/shared';
import {
  createDesignCard,
  getDesignData,
  listGreetingPhrases,
  listSourceContracts,
  setCustomerAvatar,
  setDesignCardOutput,
  updateDesignCard,
  uploadDesignFile,
  type ContractKindKey,
  type DesignCard,
  type DesignKind,
  type DesignSize,
  type FontOverride,
} from '../../api/designs';
import { userMessage } from '../../api/errors';
import { uploadFile } from '../../api/files';
import { newIdempotencyKey } from '../../api/idempotency';
import { Button, Segmented, Select, Tooltip } from '../../ui';
import { Strip } from '../staff/parts';
import { useLoad } from '../staff/useOrgInfo';
import { CardForm, type CardFormDraft } from './CardForm';
import { downloadBlob, renderTemplatePng } from './exportPng';
import {
  cardCreateInput,
  checkDraft,
  contractKindsForKind,
  CONTRACT_KIND_LABEL,
  downloadName,
  frameQuery,
  isoToVnDate,
  serverFormErrors,
  templateChoices,
  templateUsesHandwriting,
  type DesignPerms,
  type FormErrors,
} from './model';
import { PreviewFrame } from './PreviewFrame';
import { TemplateGrid } from './TemplateGrid';
import { useBlobUrl, useDebounced } from './useBlobUrl';

const EMPTY_DRAFT: CardFormDraft = { title: '', body: '', rating: null, receivedAt: null, photos: [], phraseId: null };
const FONT_OPTIONS = [
  { value: '', label: 'Theo mẫu' },
  { value: 'ky-1', label: 'Chữ ký 1' },
  { value: 'ky-2', label: 'Chữ ký 2' },
  { value: 'ky-3', label: 'Chữ ký 3' },
  { value: 'ky-4', label: 'Chữ ký 4' },
  { value: 'ky-5', label: 'Chữ ký 5 · MonteCarlo' },
  { value: 'ky-6', label: 'Chữ ký 6 · Ephesis' },
  // Thư pháp nét thanh-đậm: thuộc nhóm chữ viết tay, không phải chữ ký nét mảnh đều.
  { value: 'ky-8', label: 'Chữ viết tay · Pinyon Script' },
];
type Step = 'idle' | 'save' | 'draw' | 'upload';
const STEP_LABEL: Record<Step, string> = { idle: '', save: 'Đang lưu thẻ…', draw: 'Đang vẽ ảnh…', upload: 'Đang tải ảnh lên…' };

// Màn tạo thẻ (C3 2.6): cột mẫu · xem trước · nội dung. Xuất PNG = lưu thẻ → vẽ ảnh trong trình duyệt → tải lên
// (DESIGN_CARD) → gắn vào thẻ (PUT output) → tải về máy.
export function DesignStudio({
  kind,
  orgId,
  orgKind,
  timezone,
  perms,
  userName,
  onSaved,
}: {
  kind: DesignKind;
  orgId: string;
  orgKind: string | undefined;
  timezone: string;
  perms: DesignPerms;
  userName: string | null;
  onSaved?: (c: DesignCard) => void;
}) {
  const kinds = contractKindsForKind(kind);
  const academy = orgKind === 'ACADEMY';
  const defaultKind: ContractKindKey = !academy && kinds.includes('SERVICE') ? 'SERVICE' : (kinds[0] ?? 'SERVICE');
  const [contractKind, setContractKind] = useState<ContractKindKey>(defaultKind);
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const [contractId, setContractId] = useState<string | null>(null);
  const [scope, setScope] = useState<'fit' | 'all'>('fit');
  const [code, setCode] = useState<string | null>(() => templateChoices(kind, defaultKind, 'fit')[0]?.template.code ?? null);
  const [size, setSize] = useState<DesignSize>('1080x1350');
  const [font, setFont] = useState<FontOverride | null>(null);
  const [draft, setDraftState] = useState<CardFormDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [card, setCard] = useState<DesignCard | null>(null);
  const createKey = useRef<string>(newIdempotencyKey());

  const template = code ? (findDesignTemplate(code) ?? null) : null;

  const contracts = useLoad(
    perms.contracts ? (signal) => listSourceContracts(orgId, { kind: contractKind, q: dq || undefined, pageSize: 100 }, signal).then((p) => p.items) : null,
    [orgId, contractKind, dq, perms.contracts],
  );
  const data = useLoad(contractId ? (signal) => getDesignData(orgId, contractId, {}, signal) : null, [orgId, contractId]);
  const phrases = useLoad(kind === 'GREETING' ? (signal) => listGreetingPhrases(orgId, { contractKind }, signal) : null, [orgId, kind, contractKind]);

  const ready = contractId && data.state.status === 'ready' ? data.state.data : null;
  const selected = contracts.state.status === 'ready' ? contracts.state.data.find((c) => c.id === contractId) : undefined;
  const logo = useBlobUrl(ready?.logoUrl ? `${contractId}:logo` : null, ready?.logoUrl ?? null);
  const [avatarRev, setAvatarRev] = useState(0);
  const anh = useBlobUrl(ready?.anhUrl ? `${contractId}:anh:${avatarRev}` : null, ready?.anhUrl ?? null);

  function setDraft(fn: (d: CardFormDraft) => CardFormDraft) {
    setDraftState(fn);
    setErrors({});
    setDone(null);
  }

  // Đổi loại hợp đồng / hợp đồng → thẻ mới (máy chủ không đổi hợp đồng của thẻ đã tạo).
  function newCard() {
    setCard(null);
    createKey.current = newIdempotencyKey();
    setDone(null);
    setBanner(null);
    setErrors({});
  }

  function chooseContractKind(k: ContractKindKey) {
    setContractKind(k);
    setContractId(null);
    setQ('');
    newCard();
    const t = code ? findDesignTemplate(code) : undefined;
    if (!t || !t.contractKinds.includes(k)) setCode(templateChoices(kind, k, 'fit')[0]?.template.code ?? null);
    // Câu chúc đang là gợi ý chưa sửa → bỏ để gợi ý lại theo loại hợp đồng mới; chữ người dùng đã sửa thì giữ.
    const cur = phrases.state.status === 'ready' ? phrases.state.data.find((p) => p.id === draft.phraseId) : undefined;
    setDraftState((d) => (cur && d.title === cur.title && d.body === cur.body ? { ...d, phraseId: null, title: '', body: '' } : { ...d, phraseId: null }));
  }

  // Câu chúc soạn sẵn đầu tiên làm gợi ý khi lời chúc còn trống (người dùng thấy và sửa được ngay trên form).
  useEffect(() => {
    if (kind !== 'GREETING' || phrases.state.status !== 'ready') return;
    const first = phrases.state.data[0];
    if (first) setDraftState((d) => (d.body || d.title ? d : { ...d, phraseId: first.id, title: first.title, body: first.body }));
  }, [kind, phrases.state]);

  const input = { title: draft.title, body: draft.body, rating: draft.rating, receivedAt: draft.receivedAt };
  const photoUrls = template ? draft.photos.slice(0, template.photos.max).map((p) => p.url) : [];
  const query =
    template && ready
      ? frameQuery({ template, contractKind, data: ready, images: { logo: logo.url, anh: anh.url, photos: photoUrls }, input, size, font })
      : null;
  const liveQuery = useDebounced(query, 350);
  const imagesPending = (!!ready?.logoUrl && !logo.url) || (!!ready?.anhUrl && !anh.url);
  const previewSrc = template && liveQuery && !imagesPending ? `/mau/${template.code}.html?${liveQuery}` : null;

  async function onAvatar(file: File) {
    if (!selected) return;
    const f = await uploadFile(orgId, { purpose: 'CUSTOMER_AVATAR', name: file.name.slice(0, 200) || 'anh.jpg', data: file }, newIdempotencyKey());
    await setCustomerAvatar(orgId, selected.customer.id, f.id);
    setAvatarRev((n) => n + 1);
    data.reload();
  }

  async function exportCard() {
    setBanner(null);
    setDone(null);
    const cardDraft = { ...input, photoFileIds: draft.photos.map((p) => p.fileId) };
    const local = checkDraft({ kind, template, contractId, draft: cardDraft, hasAvatar: !!ready?.anhUrl });
    if (Object.keys(local).length > 0) {
      setErrors(local);
      setBanner('Còn ô chưa điền đúng — xem dòng đỏ ở từng ô.');
      return;
    }
    if (!template || !contractId || !ready || !query) return;
    const body = cardCreateInput({ kind, template, contractId, courseClassId: ready.courseClassId, draft: cardDraft, size, font });
    let saved: DesignCard;
    try {
      setStep('save');
      if (card) {
        const { kind: _k, contractId: _c, courseClassId: _cc, ...patch } = body;
        saved = await updateDesignCard(orgId, card.id, patch);
      } else {
        saved = await createDesignCard(orgId, body, createKey.current);
      }
      setCard(saved);
    } catch (err) {
      const { fields, rest } = serverFormErrors(err);
      setErrors(fields);
      setBanner(rest[0] ?? (Object.keys(fields).length ? 'Máy chủ không nhận — xem dòng đỏ ở từng ô.' : userMessage(err)));
      setStep('idle');
      return;
    }
    try {
      setStep('draw');
      const blob = await renderTemplatePng(`/mau/${template.code}.html?${query}`, size);
      setStep('upload');
      const name = downloadName(template.code, ready.ten, size);
      const file = await uploadDesignFile(orgId, 'DESIGN_CARD', name, blob, newIdempotencyKey());
      const withOutput = await setDesignCardOutput(orgId, saved.id, file.id);
      setCard(withOutput);
      onSaved?.(withOutput);
      downloadBlob(blob, name);
      setDone(`Đã lưu thẻ và tải ảnh ${name} về máy.`);
    } catch (err) {
      setBanner(`Thẻ đã lưu nhưng chưa xuất được ảnh: ${err instanceof Error && !('status' in err) ? err.message : userMessage(err)}`);
    } finally {
      setStep('idle');
    }
  }

  const kindOptions = (['COURSE', 'SERVICE'] as const).map((k) => ({
    value: k,
    disabledReason: !kinds.includes(k)
      ? kind === 'WELCOME'
        ? 'Thẻ chào mừng chỉ dùng cho hợp đồng khoá học'
        : `Không có mẫu cho hợp đồng ${CONTRACT_KIND_LABEL[k].toLowerCase()}`
      : k === 'COURSE' && !academy
        ? 'Tổ chức chưa bật đào tạo'
        : undefined,
  }));

  const busy = step !== 'idle';
  const handwriting = template ? templateUsesHandwriting(template) : false;
  const meta = useMemo(() => (card ? `Ghi bởi ${userName ?? 'bạn'} · ${isoToVnDate(card.createdAt, timezone)}` : null), [card, userName, timezone]);

  return (
    <div className="mtk-studio">
      {meta && <p className="mtk-meta">{meta}</p>}
      <div className="mtk-col-grid">
        <TemplateGrid
          kind={kind}
          contractKind={contractKind}
          scope={scope}
          onScope={setScope}
          value={code}
          onChange={(c) => {
            setCode(c);
            setErrors({});
            setDone(null);
          }}
          error={errors.template}
        />
      </div>
      <div className="mtk-col-prev">
        <section className="ui-card mtk-prev" aria-label="Xem trước">
          <PreviewFrame src={previewSrc} size={size} title={template ? `Xem trước mẫu ${template.code}` : 'Xem trước'} />
        </section>
        <div className="mtk-prev__bar">
          <span className="mtk-prev__cap">
            {template ? `${template.code} · ${template.name}` : 'Chưa chọn mẫu'}
            {template && template.contractKinds.length > 1 ? ` — bản ${contractKind === 'SERVICE' ? 'dịch vụ' : 'khoá học'}` : ''}
          </span>
          <Segmented
            aria-label="Khổ ảnh"
            size="sm"
            value={size}
            onChange={setSize}
            options={[
              { value: '1080x1080', label: 'Vuông', disabled: !!template && !template.sizes.includes('1080x1080') },
              { value: '1080x1350', label: 'Dọc 4:5', disabled: !!template && !template.sizes.includes('1080x1350') },
            ]}
          />
          <span className="mtk-font">
            <Select
              aria-label="Phông viết tay"
              size="sm"
              options={FONT_OPTIONS}
              value={font ?? ''}
              disabled={!handwriting}
              onChange={(e) => setFont((e.target.value || null) as FontOverride | null)}
            />
            <Tooltip
              label="Giải thích phông"
              text={handwriting ? 'Đổi mọi chữ viết tay của mẫu sang một phông chữ ký nét mảnh đều.' : 'Mẫu này không dùng chữ viết tay nên không đổi phông.'}
            />
          </span>
        </div>
      </div>
      <div className="mtk-col-form">
        <CardForm
          orgId={orgId}
          kind={kind}
          perms={perms}
          contractKinds={kindOptions}
          contractKind={contractKind}
          onContractKind={chooseContractKind}
          q={q}
          onQ={setQ}
          contracts={contracts.state}
          contractId={contractId}
          onContract={(id) => {
            setContractId(id);
            newCard();
          }}
          data={contractId ? data.state : null}
          template={template}
          phrases={phrases.state.status === 'ready' ? phrases.state.data : []}
          draft={draft}
          setDraft={setDraft}
          errors={errors}
          onAvatar={onAvatar}
          avatarUrl={anh.url}
        />
        {banner && (
          <Strip tone="danger" icon="warn">
            {banner}
          </Strip>
        )}
        {done && (
          <p className="mtk-done" role="status">
            {done}
          </p>
        )}
        {perms.write ? (
          <div className="mtk-export">
            <Button variant="primary" block loading={busy} disabled={busy || !contractId || !template} onClick={exportCard}>
              {busy ? STEP_LABEL[step] : 'Tải ảnh PNG'}
            </Button>
          </div>
        ) : (
          <Strip tone="grey" icon="lock">
            Bạn chỉ có quyền xem thẻ đã tạo.
          </Strip>
        )}
      </div>
    </div>
  );
}
