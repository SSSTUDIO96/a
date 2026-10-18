import { useState } from 'react';
import { updatePackage } from '../../../api/catalog';
import { userMessage } from '../../../api/errors';
import type { ServicePackage } from '../../../api/types';
import { Button, formatVnd, Skeleton, Switch, WithTooltip } from '../../../ui';
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
          return (
            <div key={pkg.id} className="br-pk">
              <span className="br-pk__name">{pkg.name}</span>
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
