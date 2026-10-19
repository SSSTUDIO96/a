import { useState } from 'react';
import { updatePackage } from '../../../api/catalog';
import { userMessage } from '../../../api/errors';
import type { ServicePackage } from '../../../api/types';
import { Button, formatVnd, Skeleton, Switch, Tooltip, WithTooltip } from '../../../ui';
import type { CatalogState } from '../useProfileDraft';
import { GroupTitle } from './common';

export interface PublicPackagesGroupProps {
  orgId: string;
  state: CatalogState;
  reload: () => void;
  // catalog.write: bật/tắt được; không có thì công tắc khoá.
  canWrite: boolean;
  onChanged: (pkg: ServicePackage) => void;
}

// Nhóm "Gói hiện trên trang": mỗi gói đang bán một công tắc isPublic — PATCH /packages/:id LƯU NGAY (không chờ "Lưu hồ sơ").
// L1 (biên bản nghiệm thu lần 4): gói của nhân vật đang ẩn KHÔNG hiện trên trang công khai dù công tắc bật (máy chủ lọc,
// khung xem trước cũng lọc) → ghi rõ ngay dưới tên gói, giải thích trong tooltip. Công tắc vẫn đổi được (lưu ý muốn của
// chủ studio cho lúc bật lại nhân vật).
export const HIDDEN_SUBJECT_NOTE = 'Nhân vật đang ẩn, gói không hiện';
export function hiddenSubjectTip(subjectName: string): string {
  return `Nhân vật "${subjectName}" đang ẩn (Bảng giá → Nhân vật) nên gói này không hiện trên trang giới thiệu, kể cả khi công tắc bật. Bật lại nhân vật thì gói hiện theo công tắc này.`;
}

// Gói gắn nhân vật đang ẩn: nhân vật tắt (isActive = false) hoặc không có trong danh sách nhân vật đang dùng mà khung
// xem trước dùng (usePreviewCatalog) — cùng luật với trang công khai. Gói không gắn nhân vật luôn theo công tắc.
export function subjectHidden(pkg: ServicePackage, activeSubjectIds: ReadonlySet<string>): boolean {
  if (!pkg.subject) return false;
  return !pkg.subject.isActive || !activeSubjectIds.has(pkg.subject.id);
}
export function PublicPackagesGroup({ orgId, state, reload, canWrite, onChanged }: PublicPackagesGroupProps) {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function toggle(pkg: ServicePackage, isPublic: boolean) {
    setPending((p) => ({ ...p, [pkg.id]: true }));
    setRowError((e) => {
      const { [pkg.id]: _drop, ...rest } = e;
      return rest;
    });
    try {
      onChanged(await updatePackage(orgId, pkg.id, { isPublic }));
    } catch (err) {
      setRowError((e) => ({ ...e, [pkg.id]: userMessage(err) }));
    } finally {
      setPending((p) => ({ ...p, [pkg.id]: false }));
    }
  }

  let body;
  if (state.status === 'loading') {
    body = (
      <div className="br-pk-skel" role="status" aria-label="Đang tải gói">
        <Skeleton width="70%" />
        <Skeleton width="55%" />
      </div>
    );
  } else if (state.status === 'error') {
    body = (
      <div className="br-pk-err">
        <span className="br-err" role="alert">
          Không tải được danh sách gói. {userMessage(state.error)}
        </span>
        <Button size="sm" onClick={reload}>
          Thử lại
        </Button>
      </div>
    );
  } else if (state.status === 'ready') {
    const list = state.data.packages;
    const activeSubjectIds = new Set(state.data.subjects.map((x) => x.id));
    body =
      list.length === 0 ? (
        <p className="br-muted">Chưa có gói nào đang bán.</p>
      ) : (
        list.map((pkg) => {
          const sw = (
            <Switch
              checked={pkg.isPublic}
              disabled={!canWrite || pending[pkg.id]}
              aria-label={`Hiện gói ${pkg.name} trên trang`}
              onChange={(v) => void toggle(pkg, v)}
            />
          );
          const hidden = subjectHidden(pkg, activeSubjectIds);
          return (
            <div key={pkg.id} className="br-pk" data-an-nhan-vat={hidden || undefined}>
              <span className="br-pk__name">
                {pkg.name}
                {hidden && pkg.subject && (
                  <span className="br-pk__note" data-o="nhan-vat-an">
                    {HIDDEN_SUBJECT_NOTE}
                    <Tooltip label={`Vì sao gói ${pkg.name} không hiện`} text={hiddenSubjectTip(pkg.subject.name)} />
                  </span>
                )}
              </span>
              <span className="br-pk__price num">{pkg.currentPrice ? formatVnd(pkg.currentPrice.unitPrice) : 'Chưa đặt giá'}</span>
              {canWrite ? sw : <WithTooltip text="Cần quyền sửa bảng giá để bật/tắt gói trên trang.">{sw}</WithTooltip>}
              {rowError[pkg.id] && (
                <span className="br-err br-pk__err" role="alert">
                  {rowError[pkg.id]}
                </span>
              )}
            </div>
          );
        })
      );
  }

  return (
    <div className="br-group" data-group="goi">
      <GroupTitle tip="Tắt thì gói vẫn bán bình thường, chỉ không hiện trên trang giới thiệu. Bật/tắt được lưu ngay. Sửa giá ở Bảng giá.">
        Gói hiện trên trang
      </GroupTitle>
      {body}
    </div>
  );
}
