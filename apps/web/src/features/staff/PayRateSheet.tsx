import { useMemo, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router';
import { ApiError, errorKind, userMessage } from '../../api/errors';
import type { PayRateSheet as Sheet } from '../../api/types';
import { Button, Card, ConfirmDialog, EmptyState, formatVnd, IconBack, IconPlus, Skeleton, Tooltip } from '../../ui';
import { changedRates, errorTierIds, formatDateIn, rateDraftOf, type PayOwner, type RateDraft } from './logic';
import { LoadErrorStrip, Strip } from './parts';
import { PayRateRow } from './PayRateRow';
import { rosterEntryOf, useCurrentOrgStaffNaming } from './useStaffNaming';
import { getPayRates, putPayRates } from './usePayRates';
import { useLoad } from './useOrgInfo';

// Thẻ tiền công của MỘT gói / dịch vụ phụ (C2 1.3) — "hiển thị cấp bậc kèm avatar tên rồi nhập số tiền".
export interface PayRateSheetProps {
  orgId: string;
  slug: string;
  timezone: string;
  owner: PayOwner;
  canWrite: boolean;
  canAddTier: boolean;
}

export function PayRateSheet({ orgId, slug, timezone, owner, canWrite, canAddTier }: PayRateSheetProps) {
  const navigate = useNavigate();
  const { state, reload, set } = useLoad<Sheet>((signal) => getPayRates(orgId, owner.kind, owner.id, signal), [orgId, owner.kind, owner.id]);
  const [draft, setDraft] = useState<RateDraft | null>(null);
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const sheet = state.status === 'ready' ? state.data : null;
  // L2: màu ảnh thợ qua sổ thợ chung (GET /staff ∪ thợ trên bảng) — cùng màu với Thợ makeup, Lịch, Hợp đồng.
  const shownStaff = useMemo(() => (sheet?.items ?? []).flatMap((r) => r.staff.map(rosterEntryOf)), [sheet]);
  const naming = useCurrentOrgStaffNaming(shownStaff);
  const values: RateDraft = draft ?? (sheet ? rateDraftOf(sheet.items) : {});
  const changes = sheet && canWrite ? changedRates(sheet.items, values) : [];
  const dirty = changes.length > 0;
  const hasInputError = Object.values(inputErrors).some(Boolean);

  // Đang có thay đổi chưa lưu mà rời thẻ (bấm gói khác, nút quay lại, menu) → hỏi trước.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  async function save() {
    if (!sheet || !dirty || hasInputError) return;
    setSaving(true);
    setSaveError(null);
    setServerErrors({});
    try {
      const next = await putPayRates(orgId, owner.kind, owner.id, { rates: changes });
      // Máy chủ trả lại cả bảng → thay số trên màn.
      set(() => next);
      setDraft(null);
    } catch (err) {
      const ids = err instanceof ApiError ? errorTierIds(err.details) : [];
      if (errorKind(err) === 'validation' && ids.length > 0) {
        setServerErrors(Object.fromEntries(ids.map((id) => [id, userMessage(err)])));
      } else setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  const head = (
    <div className="st-sheet__head">
      <div className="st-sheet__titles">
        <div className="st-sheet__eyebrow">{owner.groupLabel}</div>
        <h2 className="st-sheet__name">{owner.name}</h2>
      </div>
      {owner.price !== null && (
        <span className="st-sheet__price">
          Giá bán <b>{formatVnd(owner.price)}</b>
        </span>
      )}
    </div>
  );

  let body;
  if (state.status === 'loading') {
    body = (
      <div role="status" aria-label="Đang tải tiền công">
        {[0, 1, 2].map((i) => (
          <div key={i} className="st-pr" aria-hidden="true">
            <div className="st-pr__who st-pr__who--skel">
              <Skeleton circle width={28} height={28} />
              <Skeleton height={12} width="auto" style={{ flex: '1 1 0', minWidth: 0 }} />
            </div>
            <Skeleton width={90} height={30} />
          </div>
        ))}
      </div>
    );
  } else if (state.status === 'error') {
    if (errorKind(state.error) === 'not_found') {
      return (
        <Card>
          <EmptyState
            message={owner.kind === 'goi' ? 'Không tìm thấy gói này — có thể đã bị xoá ở máy khác.' : 'Không tìm thấy dịch vụ này — có thể đã bị xoá ở máy khác.'}
            action={
              <Button icon={<IconBack />} onClick={() => navigate(`/${slug}/nhan-su/tien-cong`)}>
                Về danh sách
              </Button>
            }
          />
        </Card>
      );
    }
    body = <LoadErrorStrip error={state.error} retry={reload} />;
  } else if (state.data.items.length === 0) {
    body = (
      <EmptyState
        message="Chưa có bậc lương nào. Tạo bậc trước rồi mới đặt tiền công."
        action={
          canAddTier ? (
            <Button variant="primary" size="sm" icon={<IconPlus />} onClick={() => navigate(`/${slug}/nhan-su`, { state: { openTiers: true } })}>
              Thêm bậc lương
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    body = state.data.items.map((r) => (
      <PayRateRow
        key={r.tier.id}
        row={r}
        naming={naming}
        value={values[r.tier.id] ?? null}
        readOnly={!canWrite}
        disabled={saving}
        error={serverErrors[r.tier.id] || null}
        updatedText={r.amount === null || r.updatedAt === null ? 'Chưa đặt mức' : `Cập nhật ${formatDateIn(r.updatedAt, timezone)}`}
        onChange={(v) => {
          setDraft({ ...values, [r.tier.id]: v });
          if (serverErrors[r.tier.id]) setServerErrors((e) => ({ ...e, [r.tier.id]: '' }));
        }}
        onInputError={(msg) => setInputErrors((e) => ({ ...e, [r.tier.id]: msg ?? '' }))}
      />
    ));
  }

  const showFoot = sheet !== null && sheet.items.length > 0;
  return (
    <>
      <section className="ui-card st-sheet" aria-label={`Tiền công ${owner.name}`}>
        {head}
        {!canWrite && sheet && (
          <div className="st-sheet__ro">
            <Strip tone="grey" icon="lock">
              Bạn chỉ được xem tiền công. Chủ studio hoặc quản trị đặt mức.
            </Strip>
          </div>
        )}
        {saveError !== null && (
          <div className="st-sheet__ro">
            <Strip
              tone="danger"
              icon={errorKind(saveError) === 'forbidden' ? 'lock' : 'warn'}
              action={
                errorKind(saveError) === 'network' || errorKind(saveError) === 'server' ? (
                  <Button size="sm" onClick={() => void save()}>
                    Thử lại
                  </Button>
                ) : undefined
              }
            >
              {userMessage(saveError)}
            </Strip>
          </div>
        )}
        <div className="st-sheet__rows">{body}</div>
        {showFoot && (
          <footer className="ui-card__foot st-sheet__foot">
            <span className="st-sheet__rule">
              Để trống = chưa đặt mức cho bậc đó
              <Tooltip text="Gửi trống thì xoá mức cũ. Bậc đang ẩn không hiện ở đây. Thợ chưa gán bậc không nhận tiền công theo gói." />
            </span>
            {canWrite && (
              <>
                <Button
                  disabled={!dirty || saving}
                  onClick={() => {
                    setDraft(null);
                    setInputErrors({});
                    setServerErrors({});
                    setSaveError(null);
                  }}
                >
                  Huỷ
                </Button>
                <Button variant="primary" loading={saving} disabled={!dirty || hasInputError} onClick={() => void save()}>
                  Lưu tiền công
                </Button>
              </>
            )}
          </footer>
        )}
      </section>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title={`Bỏ thay đổi tiền công của ${owner.name}?`}
        message="Số vừa nhập chưa được lưu."
        cancelLabel="Ở lại"
        confirmLabel="Bỏ thay đổi"
        danger
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      />
    </>
  );
}
