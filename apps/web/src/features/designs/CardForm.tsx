import { useId, useState } from 'react';
import type { ContractKindKey, DesignData, DesignKind, DesignTemplate, GreetingPhrase, SourceContract } from '../../api/designs';
import { userMessage } from '../../api/errors';
import { Button, DateInput, ImageUpload, Segmented, Select, SettingRow, Textarea, TextInput, Tooltip } from '../../ui';
import { Strip } from '../staff/parts';
import { GreetingPicker } from './GreetingPicker';
import {
  autoFields,
  BODY_MAX,
  CONTRACT_KIND_LABEL,
  dataSlotText,
  missingDataSlots,
  photoRule,
  TITLE_MAX,
  type DesignPerms,
  type FormErrors,
} from './model';
import { PhotoSlots, type PhotoItem } from './PhotoSlots';

export interface CardFormDraft {
  title: string;
  body: string;
  rating: number | null;
  receivedAt: string | null;
  photos: PhotoItem[];
  phraseId: string | null;
}

type Loadable<T> = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

// Cột "Nội dung" (C3 2.6): loại hợp đồng · hợp đồng · hộp xám giá trị tự lấy · ô riêng theo loại thẻ.
export function CardForm(props: {
  orgId: string;
  kind: DesignKind;
  perms: DesignPerms;
  contractKinds: readonly { value: ContractKindKey; disabledReason?: string }[];
  contractKind: ContractKindKey;
  onContractKind: (k: ContractKindKey) => void;
  q: string;
  onQ: (q: string) => void;
  contracts: Loadable<SourceContract[]>;
  contractId: string | null;
  onContract: (id: string | null) => void;
  data: Loadable<DesignData> | null;
  template: DesignTemplate | null;
  phrases: readonly GreetingPhrase[];
  draft: CardFormDraft;
  setDraft: (fn: (d: CardFormDraft) => CardFormDraft) => void;
  errors: FormErrors;
  onAvatar: (file: File) => Promise<unknown>;
  avatarUrl: string | null;
}) {
  const { kind, perms, contractKind, contracts, contractId, data, template, draft, setDraft, errors } = props;
  const ids = { contract: useId(), q: useId(), body: useId(), title: useId(), date: useId() };
  const [copied, setCopied] = useState<string | null>(null);
  const ready = data?.status === 'ready' ? data.data : null;

  async function copy() {
    const text = kind === 'GREETING' && draft.title.trim() ? `${draft.title.trim()}\n${draft.body}` : draft.body;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(text);
      setCopied('Đã sao chép vào bộ nhớ tạm.');
    } catch {
      setCopied('Trình duyệt không cho sao chép. Hãy chọn chữ trong ô rồi sao chép.');
    }
  }

  const options =
    contracts.status === 'ready'
      ? contracts.data.map((c) => ({ value: c.id, label: `${c.code} · ${c.customer.fullName}` }))
      : [];

  return (
    <section className="ui-card mtk-form" aria-label="Nội dung thẻ">
      <header className="ui-card__head">
        <h2 className="ui-card__title">Nội dung</h2>
      </header>
      <div className="ui-card__body">
        <SettingRow label="Loại hợp đồng" stack>
          <Segmented
            aria-label="Loại hợp đồng"
            block
            value={contractKind}
            onChange={props.onContractKind}
            options={props.contractKinds.map((k) => ({
              value: k.value,
              label: CONTRACT_KIND_LABEL[k.value],
              disabled: !!k.disabledReason,
              disabledReason: k.disabledReason,
            }))}
          />
        </SettingRow>

        {!perms.contracts ? (
          <Strip tone="grey" icon="lock">
            Cần quyền xem hợp đồng để chọn hợp đồng nguồn.
          </Strip>
        ) : (
          <>
            <SettingRow label="Hợp đồng" htmlFor={ids.contract} stack tip="Thẻ lấy tên, khoá học hoặc gói, ngày… từ hợp đồng này và hồ sơ thương hiệu.">
              <div className="mtk-stack">
                <TextInput
                  id={ids.q}
                  aria-label="Tìm hợp đồng"
                  placeholder="Tìm mã, tên hoặc số điện thoại khách"
                  value={props.q}
                  onChange={(e) => props.onQ(e.target.value)}
                />
                <Select
                  id={ids.contract}
                  options={options}
                  placeholder={contracts.status === 'loading' ? 'Đang tải hợp đồng…' : options.length ? 'Chọn hợp đồng' : 'Không có hợp đồng phù hợp'}
                  value={contractId ?? ''}
                  error={errors.contract ?? (contracts.status === 'error' ? userMessage(contracts.error) : null)}
                  onChange={(e) => props.onContract(e.target.value || null)}
                />
              </div>
            </SettingRow>
            {contractId && (
              <div className="mtk-auto" aria-label="Giá trị tự lấy từ hợp đồng">
                {data?.status === 'loading' && <span className="mtk-hint">Đang lấy dữ liệu hợp đồng…</span>}
                {data?.status === 'error' && <span className="mtk-err">{userMessage(data.error)}</span>}
                {ready &&
                  autoFields(contractKind, kind).map((f) => {
                    const v = dataSlotText(ready, f.slot);
                    return (
                      <span key={f.slot} className="mtk-auto__it">
                        {f.label} <b className={v ? undefined : 'mtk-auto__none'}>{v ?? 'chưa có'}</b>
                      </span>
                    );
                  })}
                {ready && template && missingDataSlots(template, contractKind, ready).length > 0 && (
                  <span className="mtk-auto__miss">
                    Ô trống trên ảnh: {missingDataSlots(template, contractKind, ready).map((m) => m.label).join(', ')}
                    <Tooltip text="Mẫu này có ô lấy từ dữ liệu nhưng hợp đồng hoặc Hồ sơ thương hiệu chưa có. Ô đó để trống trên ảnh, phần còn lại vẫn vẽ. Điền ở Hồ sơ thương hiệu hoặc hợp đồng rồi chọn lại hợp đồng." />
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {kind === 'WELCOME' && ready && (
          <SettingRow label="Ảnh học viên" stack tip="Lấy từ ảnh của khách trong hồ sơ khách hàng. Đổi ảnh ở đây là đổi ảnh trong hồ sơ khách.">
            {perms.customers ? (
              <ImageUpload value={props.avatarUrl} shape="round" size={88} layout="inline" uploadLabel="Thêm ảnh" changeLabel="Đổi ảnh" onUpload={props.onAvatar} errorMessage={userMessage}>
                <span className="mtk-hint">{props.avatarUrl ? 'Ảnh trong hồ sơ khách' : 'Khách chưa có ảnh'}</span>
              </ImageUpload>
            ) : props.avatarUrl ? (
              <img className="mtk-avatar" src={props.avatarUrl} alt="Ảnh học viên" />
            ) : (
              <span className="mtk-hint">Khách chưa có ảnh</span>
            )}
          </SettingRow>
        )}

        {kind === 'GREETING' && (
          <SettingRow label="Câu chúc soạn sẵn" stack tip="Chọn một câu để điền sẵn tiêu đề và lời chúc, rồi sửa lại cho hợp từng khách. Quản lý ở thẻ Câu chúc soạn sẵn.">
            <GreetingPicker
              phrases={props.phrases}
              value={draft.phraseId}
              onPick={(p) => setDraft((d) => ({ ...d, phraseId: p.id, title: p.title, body: p.body }))}
            />
          </SettingRow>
        )}
        {kind === 'GREETING' && (
          <SettingRow label="Tiêu đề" htmlFor={ids.title} stack>
            <TextInput id={ids.title} value={draft.title} maxLength={TITLE_MAX} disabled={!perms.write} error={errors.title ?? null} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          </SettingRow>
        )}
        {kind !== 'WELCOME' && (
          <SettingRow
            label={kind === 'FEEDBACK' ? 'Nội dung lời khen' : 'Lời chúc'}
            htmlFor={ids.body}
            stack
            required
            tip={kind === 'FEEDBACK' ? 'Dán nguyên văn tin nhắn khen của khách (Zalo, Facebook…). Chữ dài tự co nhỏ trên thẻ.' : undefined}
          >
            <Textarea
              id={ids.body}
              rows={6}
              value={draft.body}
              maxLength={BODY_MAX}
              disabled={!perms.write}
              error={errors.body ?? null}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            />
            <div className="mtk-count">
              <span className="num">{draft.body.length} ký tự</span>
              <Button size="sm" variant="ghost" onClick={copy} disabled={!draft.body}>
                Sao chép nội dung
              </Button>
            </div>
            {copied && (
              <p className="mtk-hint" role="status">
                {copied}
              </p>
            )}
          </SettingRow>
        )}

        {template && template.photos.max > 0 && (
          <SettingRow label="Ảnh" stack required>
            <PhotoSlots
              orgId={props.orgId}
              rule={photoRule(template)}
              items={draft.photos}
              onChange={(photos) => setDraft((d) => ({ ...d, photos }))}
              canUpload={perms.files}
              error={errors.photos}
            />
          </SettingRow>
        )}

        {kind === 'FEEDBACK' && template?.slots.includes('sao') && (
          <SettingRow label="Số sao" stack required>
            <Segmented
              aria-label="Số sao"
              value={draft.rating === null ? null : (String(draft.rating) as '1' | '2' | '3' | '4' | '5')}
              onChange={(v) => setDraft((d) => ({ ...d, rating: Number(v) }))}
              options={(['1', '2', '3', '4', '5'] as const).map((v) => ({ value: v, label: `${v} ★` }))}
            />
            {errors.rating && <p className="mtk-err">{errors.rating}</p>}
          </SettingRow>
        )}
        {kind === 'FEEDBACK' && (
          <SettingRow label="Ngày nhận" htmlFor={ids.date} required={template?.slots.includes('nfb')} tip="Ngày khách gửi lời khen." controlWidth={170}>
            <DateInput id={ids.date} value={draft.receivedAt} onChange={(v) => setDraft((d) => ({ ...d, receivedAt: v }))} error={errors.receivedAt ?? null} />
          </SettingRow>
        )}
      </div>
    </section>
  );
}
