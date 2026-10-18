import type { LocationType, MakeupSubject, ServicePackage, StudioLocation, TravelFeePolicy } from '../../api/types';
import {
  Button,
  CheckChip,
  IconClose,
  IconLock,
  Qty,
  Segmented,
  Select,
  StatusTag,
  TextInput,
  Textarea,
  Tooltip,
  formatVnd,
} from '../../ui';
import {
  LOCATION_LABEL,
  LOCATION_ORDER,
  groupTotal,
  lineKey,
  needsTravel,
  type GroupedLineExt,
  type LineWarning,
  type PlacedDraft,
} from './model';
import { StaffRow, type StaffPerson } from './StaffRow';
import { StaffWarningBanner } from './StaffWarningBanner';
import { TravelControl } from './TravelControl';

// Một dòng gói = một thẻ nhân vật (bản vẽ 4.3). Số tiền (đơn giá, phí di chuyển, cộng dòng) lấy từ máy chủ.

const NOT_HERE: Record<LocationType, string> = { STUDIO: 'tại studio', CUSTOMER_HOME: 'tại nhà khách', OTHER: 'ở nơi khác' };
const TIP_TRAVEL = 'Bắt buộc với dòng tại nhà khách hoặc địa điểm khác. Miễn phí thì chọn Nhập tay và ghi 0 ₫.';

export interface PackageLineCardProps {
  index: number;
  line: PlacedDraft;
  pkg: ServicePackage | null;
  subjects: MakeupSubject[];
  studios: StudioLocation[];
  policy: TravelFeePolicy | null;
  // Bảng tính máy chủ của dòng (quote khi nháp, hợp đồng đã lưu khi đã xác nhận). null = chưa có.
  view: GroupedLineExt<string | null> | null;
  pending: boolean;
  locked: boolean;
  errors: Record<string, string>;
  lineError: string | null;
  warnings: LineWarning[];
  people: StaffPerson[];
  nameOf: (membershipId: string) => string;
  onChange: (patch: Partial<PlacedDraft>) => void;
  onRemove: () => void;
  onPickStaff: () => void;
  canPickStaff: boolean;
  pickBlockedReason: string | null;
  scheduleHref: string | null;
  // Đã xác nhận: nút "Huỷ dòng" (quyền contracts.adjust).
  onVoid: (() => void) | null;
}

export function PackageLineCard(p: PackageLineCardProps) {
  const { line, pkg, view, locked, errors, index: i } = p;
  const voided = Boolean(view?.voidedAt);
  const subjectName = view?.subjectName ?? (line.subjectId ? p.subjects.find((s) => s.id === line.subjectId)?.name : null) ?? null;
  const allowed = pkg?.locationTypes ?? [];
  const optional = pkg
    ? pkg.items.filter((it) => it.isOptional).map((it) => ({ id: it.serviceId, name: it.service.name, price: it.currentPrice?.unitPrice ?? null }))
    : (view?.addons ?? []).filter((a) => a.serviceId).map((a) => ({ id: a.serviceId as string, name: a.name, price: a.unitPrice }));
  const addonView = (id: string) => view?.addons.find((a) => a.serviceId === id) ?? null;
  const includedKm = pkg?.includedKm ?? p.policy?.freeKm ?? 0;
  const studio = p.studios.find((s) => s.id === line.studioLocationId) ?? null;
  const idp = `dong-${line.key}`;
  const changeLocation = (loc: LocationType) => {
    const def = p.studios.find((s) => s.isDefault) ?? p.studios[0] ?? null;
    p.onChange({
      locationType: loc,
      studioLocationId: loc === 'STUDIO' ? (line.studioLocationId ?? def?.id ?? null) : null,
    });
  };
  const subjectOptions = p.subjects.filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name }));

  return (
    <section
      className={`ct-ln${locked ? ' ct-ln--locked' : ''}${voided ? ' ct-ln--void' : ''}`}
      aria-label={`${subjectName ? `${subjectName} · ` : ''}${line.name}`}
      data-dong={i}
      aria-busy={p.pending || undefined}
    >
      <div className="ct-ln__hd">
        <span className="ct-ln__ttl">
          {subjectName && <StatusTag tone="accent">{subjectName}</StatusTag>}
          {!locked && pkg && pkg.subjectId === null && (
            <Select
              size="sm"
              aria-label="Nhân vật của dòng"
              placeholder="Chọn nhân vật"
              value={line.subjectId ?? ''}
              options={subjectOptions}
              onChange={(e) => p.onChange({ subjectId: e.target.value || null })}
            />
          )}
          <span className="ct-ln__n">{line.name}</span>
          {locked && <IconLock />}
        </span>
        <span className="ct-ln__sp" />
        {locked ? (
          <>
            {voided ? (
              <StatusTag tone="danger">Đã huỷ: {view?.voidReason}</StatusTag>
            ) : (
              <span className="ct-fx">{line.quantity} người</span>
            )}
            {!voided && p.onVoid && (
              <Button variant="ghost" size="sm" onClick={p.onVoid} title="Huỷ dòng này (bắt buộc ghi lý do)">
                Huỷ dòng
              </Button>
            )}
          </>
        ) : (
          <>
            <Qty size="sm" label="Số người" value={line.quantity} onChange={(quantity) => p.onChange({ quantity })} />
            <Button variant="ghost" size="sm" icon={<IconClose />} aria-label={`Bỏ dòng ${line.name}`} onClick={p.onRemove} />
          </>
        )}
      </div>

      <div className="ct-rw">
        <span className="ct-rw__l">Giờ</span>
        <div className="ct-dcr">
          <div className="ct-fl">
            <TextInput
              type="time"
              size="sm"
              className="ct-time"
              aria-label="Giờ bắt đầu"
              value={line.start}
              disabled={locked}
              onChange={(e) => p.onChange({ start: e.target.value })}
              error={errors[lineKey(i, 'scheduledStart')]}
            />
            –
            <TextInput
              type="time"
              size="sm"
              className="ct-time"
              aria-label="Giờ kết thúc"
              value={line.end}
              disabled={locked}
              onChange={(e) => p.onChange({ end: e.target.value })}
              error={errors[lineKey(i, 'scheduledEnd')]}
            />
            <span className="ct-fx ct-num ct-pend">{view ? `${view.quantity} × ${formatVnd(view.unitPrice)}` : ''}</span>
          </div>
        </div>
      </div>

      <StaffRow
        people={p.people}
        mode={locked ? 'locked' : p.canPickStaff ? 'edit' : 'view'}
        onPick={p.onPickStaff}
        pickBlockedReason={p.pickBlockedReason}
        scheduleHref={p.scheduleHref}
        error={errors[lineKey(i, 'staff')]}
      />
      {!locked && <StaffWarningBanner warnings={p.warnings} nameOf={p.nameOf} />}

      {optional.length > 0 && (
        <div className="ct-rw">
          <span className="ct-rw__l">Dịch vụ phụ</span>
          <div className="ct-fl">
            {optional.map((o) => {
              const on = line.addonIds.includes(o.id);
              const av = addonView(o.id);
              const voidReason = locked && av?.voidedAt ? (av.voidReason ?? '') : undefined;
              return (
                <CheckChip
                  key={o.id}
                  label={`${o.name}${on && line.quantity > 1 ? ` × ${line.quantity}` : ''}`}
                  price={o.price === null ? undefined : `+${formatVnd(o.price)}`}
                  checked={on}
                  disabled={locked}
                  voidReason={voidReason}
                  onChange={(e) =>
                    p.onChange({ addonIds: e.target.checked ? [...line.addonIds, o.id] : line.addonIds.filter((x) => x !== o.id) })
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="ct-rw">
        <span className="ct-rw__l">Làm ở đâu</span>
        <div className="ct-dcr">
          <Segmented
            size="sm"
            aria-label="Làm ở đâu"
            value={line.locationType}
            disabled={locked}
            onChange={changeLocation}
            options={LOCATION_ORDER.map((loc) => {
              const no = allowed.length > 0 && !allowed.includes(loc);
              return { value: loc, label: LOCATION_LABEL[loc], disabled: no, disabledReason: no ? `Gói này không làm ${NOT_HERE[loc]}` : undefined };
            })}
          />
          {errors[lineKey(i, 'locationType')] && <div className="ct-err">{errors[lineKey(i, 'locationType')]}</div>}
          {line.locationType === 'STUDIO' && p.studios.length > 0 && (
            <Select
              size="sm"
              aria-label="Studio"
              value={line.studioLocationId ?? ''}
              disabled={locked}
              options={p.studios.map((s) => ({ value: s.id, label: s.name }))}
              hint={studio?.address}
              onChange={(e) => p.onChange({ studioLocationId: e.target.value || null })}
              error={errors[lineKey(i, 'studioLocationId')]}
            />
          )}
          {needsTravel(line.locationType) && (
            <Textarea
              size="sm"
              rows={2}
              aria-label="Địa chỉ"
              placeholder="Địa chỉ"
              value={line.address}
              disabled={locked}
              onChange={(e) => p.onChange({ address: e.target.value })}
              error={errors[lineKey(i, 'address')]}
            />
          )}
        </div>
      </div>

      {needsTravel(line.locationType) && (
        <div className="ct-rw">
          <span className="ct-rw__l">
            Di chuyển<span className="ct-req" aria-label="bắt buộc">*</span>
            <Tooltip text={TIP_TRAVEL} />
          </span>
          <TravelControl
            idPrefix={idp}
            value={line.travel}
            onChange={(travel) => p.onChange({ travel })}
            hasTiers={(p.policy?.tiers.length ?? 0) > 0}
            fixedNeedsKm={includedKm > 0}
            quoteTravel={view?.travel ?? null}
            disabled={locked}
            errors={{
              distanceKm: errors[lineKey(i, 'travel.distanceKm')] ?? errors[lineKey(i, 'travel')],
              amount: errors[lineKey(i, 'travel.amount')],
            }}
          />
        </div>
      )}

      {p.lineError && <div className="ct-ln__err ct-err" role="alert">{p.lineError}</div>}

      <div className="ct-ln__ft">
        <span className="ct-fx" style={{ fontSize: 13 }}>
          Cộng {(subjectName ?? line.name).toLocaleLowerCase('vi')}
        </span>
        <b className="ct-num ct-pend">{view ? formatVnd(groupTotal(view)) : '—'}</b>
      </div>
    </section>
  );
}
