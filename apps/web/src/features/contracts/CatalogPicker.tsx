import { useMemo, useState } from 'react';
import { Button, Chip, IconCheck, IconPlus, TextInput, Tooltip, formatVnd } from '../../ui';
import type { LocationType, Service, ServicePackage } from '../../api/types';
import { LOCATION_LABEL, LOCATION_ORDER, splitPackagesBySubject } from './model';
import type { ContractCatalog } from './useContractCatalog';

// Cột trái "Bảng giá" / "Thêm phát sinh" (bản vẽ 4.3) — dùng chung cho cột trái máy tính và ngăn kéo điện thoại.

export interface CatalogPickerProps {
  catalog: ContractCatalog;
  usedPackageIds: ReadonlySet<string>;
  onAddPackage: (pkg: ServicePackage) => void;
  onAddSurcharge: (svc: Service) => void;
  onAddCustom: () => void;
}

const ALL = 'tat-ca';
const NONE = 'moi-nhan-vat';

function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function placesText(types: readonly LocationType[]): string {
  const list = types.length === 0 ? LOCATION_ORDER : LOCATION_ORDER.filter((t) => types.includes(t));
  return list.map((t) => LOCATION_LABEL[t]).join(', ');
}

export function CatalogPicker({ catalog, usedPackageIds, onAddPackage, onAddSurcharge, onAddCustom }: CatalogPickerProps) {
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<string>(ALL);
  const subjectName = useMemo(() => new Map(catalog.subjects.map((s) => [s.id, s.name])), [catalog.subjects]);
  // M1 (biên bản nghiệm thu lại): gói của nhân vật đang ẩn KHÔNG bày để chọn — máy chủ chặn lưu "Nhân vật … đang ẩn".
  const sellable = useMemo(() => splitPackagesBySubject(catalog.packages, catalog.subjects), [catalog.packages, catalog.subjects]);
  const chips = useMemo(() => {
    const used = new Set(sellable.shown.map((p) => p.subjectId));
    const list = [...catalog.subjects].filter((s) => s.isActive && used.has(s.id)).sort((a, b) => a.sortOrder - b.sortOrder);
    return { list, hasNone: used.has(null) };
  }, [catalog.subjects, sellable]);
  const hiddenSubjects = useMemo(
    () => [...new Set(sellable.hidden.map((p) => (p.subjectId ? subjectName.get(p.subjectId) : null) ?? p.subject?.name ?? ''))].filter(Boolean),
    [sellable, subjectName],
  );
  const needle = fold(q.trim());
  const match = (name: string) => needle === '' || fold(name).includes(needle);
  const packages = sellable.shown.filter(
    (p) => match(p.name) && (chip === ALL || (chip === NONE ? p.subjectId === null : p.subjectId === chip)),
  );
  const surcharges = catalog.surcharges.filter((s) => match(s.name));

  return (
    <div className="ct-cat">
      <div className="ct-cat__sch">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm gói, dịch vụ, phụ phí" aria-label="Tìm gói, dịch vụ, phụ phí" />
        <div className="ct-cat__chips" role="group" aria-label="Lọc theo nhân vật">
          <Chip selected={chip === ALL} onClick={() => setChip(ALL)}>
            Tất cả
          </Chip>
          {chips.list.map((s) => (
            <Chip key={s.id} selected={chip === s.id} onClick={() => setChip(s.id)}>
              {s.name}
            </Chip>
          ))}
          {chips.hasNone && (
            <Chip selected={chip === NONE} onClick={() => setChip(NONE)}>
              Mọi nhân vật
            </Chip>
          )}
        </div>
      </div>
      <div className="ct-cat__ls">
        <div className="ct-lbl">Gói</div>
        {packages.length === 0 && <div className="ct-cat__empty">Không có gói phù hợp.</div>}
        {sellable.hidden.length > 0 && (
          <div className="ct-cat__empty" data-o="goi-nhan-vat-an">
            {sellable.hidden.length} gói của nhân vật đang ẩn ({hiddenSubjects.join(', ')}) không hiện ở đây.{' '}
            <Tooltip
              label="Vì sao có gói không hiện"
              text="Nhân vật đã bị tắt ở Bảng giá → Nhân vật. Hợp đồng không nhận dòng của nhân vật đang ẩn. Muốn bán lại các gói này, bật nhân vật ở Bảng giá → Nhân vật."
            />
          </div>
        )}
        {packages.map((p) => (
          <div className="ct-pk" key={p.id}>
            <div style={{ minWidth: 0 }}>
              <div className="ct-pk__n">{p.name}</div>
              <div className="ct-pk__m">
                {(p.subjectId ? subjectName.get(p.subjectId) : null) ?? 'Mọi nhân vật'} · {placesText(p.locationTypes)}
              </div>
            </div>
            {p.currentPrice ? (
              <Button size="sm" icon={<IconPlus />} onClick={() => onAddPackage(p)} aria-label={`Thêm ${p.name}`}>
                <span className="ct-num">{formatVnd(p.currentPrice.unitPrice)}</span>
              </Button>
            ) : (
              <Button size="sm" disabled title="Gói chưa có giá hiệu lực">
                Chưa có giá
              </Button>
            )}
            {usedPackageIds.has(p.id) && (
              <div className="ct-pk__in">
                <IconCheck /> Đã có trong hợp đồng
              </div>
            )}
          </div>
        ))}
        <div className="ct-lbl">Phụ phí cài sẵn</div>
        {surcharges.length === 0 && <div className="ct-cat__empty">Không có phụ phí phù hợp.</div>}
        {surcharges.map((s) => (
          <div className="ct-sp1" key={s.id}>
            <span className="ct-sp1__n">{s.name}</span>
            <span className="ct-num ct-fx" style={{ fontSize: 14 }}>
              {s.currentPrice ? formatVnd(s.currentPrice.unitPrice) : 'Chưa có giá'}
            </span>
            <Button size="sm" icon={<IconPlus />} aria-label={`Thêm ${s.name}`} disabled={!s.currentPrice} onClick={() => onAddSurcharge(s)} />
          </div>
        ))}
        <div className="ct-sp1">
          <span className="ct-sp1__n">Khoản tự đặt tên</span>
          <Button size="sm" icon={<IconPlus />} onClick={onAddCustom}>
            Thêm
          </Button>
        </div>
      </div>
    </div>
  );
}
