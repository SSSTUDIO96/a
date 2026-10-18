// Trang xem thử: bày mọi component ở mọi trạng thái (mặc định / rê chuột / tiêu điểm / khoá / lỗi / đang tải).
// Trạng thái rê chuột và tiêu điểm vẽ tĩnh bằng data-demo; các ô khác bấm, gõ được thật.
import { useState, type ReactNode } from 'react';
import { CONTRACT_STATUSES, WORK_STATUSES } from '@makeup/shared';
import {
  Avatar,
  AvatarStack,
  BottomSheet,
  Button,
  Card,
  CheckChip,
  Checkbox,
  Chip,
  ContractStatusTag,
  Dialog,
  EmptyState,
  formatKm,
  formatVnd,
  IconLock,
  IconPlus,
  MoneyInput,
  Qty,
  Segmented,
  Select,
  SettingRow,
  Skeleton,
  SkeletonText,
  StatusTag,
  StickyTotalBar,
  Switch,
  TextInput,
  Textarea,
  Tooltip,
  UnitInput,
  WithTooltip,
  WorkStatusTag,
  type AvatarPerson,
  type Vnd,
} from '../index';
import './gallery.css';

function Cell({ cap, children }: { cap: string; children: ReactNode }) {
  return (
    <div className="xt-cell">
      <span className="xt-cell__cap">{cap}</span>
      {children}
    </div>
  );
}

function Set({ name, fill, children }: { name: string; fill?: boolean; children: ReactNode }) {
  return (
    <div className="xt-set">
      <div className="xt-set__name">{name}</div>
      <div className={fill ? 'xt-cells xt-cells--fill' : 'xt-cells'}>{children}</div>
    </div>
  );
}

const STAFF: AvatarPerson[] = [
  { membershipId: 'm-thu-ha', displayName: 'Nguyễn Thu Hà', initials: 'TH' },
  { membershipId: 'm-minh-anh', displayName: 'Trần Minh Anh', initials: 'MA' },
  { membershipId: 'm-ngoc-tram', displayName: 'Lê Ngọc Trâm', initials: 'NT' },
  { membershipId: 'm-bao-vy', displayName: 'Phạm Bảo Vy', initials: 'BV' },
  { membershipId: 'm-khanh-linh', displayName: 'Đỗ Khánh Linh', initials: 'KL' },
];

// Ảnh đại diện mẫu (SVG nền phẳng, không gọi mạng).
const PHOTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#E7B8C9"/><circle cx="32" cy="25" r="12" fill="#A63D62"/><rect x="12" y="42" width="40" height="30" rx="20" fill="#A63D62"/></svg>',
  );

const LOC_OPTIONS = [
  { value: 'STUDIO', label: 'Studio' },
  { value: 'CUSTOMER_HOME', label: 'Tại nhà' },
  { value: 'OTHER', label: 'Nơi khác', disabled: true, disabledReason: 'Gói này không làm nơi khác' },
] as const;
type Loc = (typeof LOC_OPTIONS)[number]['value'];

const TRAVEL_OPTIONS = [
  { value: 'FIXED', label: 'Cố định' },
  { value: 'PER_KM', label: 'Theo km' },
  { value: 'MANUAL', label: 'Nhập tay' },
] as const;
type Travel = (typeof TRAVEL_OPTIONS)[number]['value'];

const STUDIOS = [
  { value: 's1', label: 'Studio Chiến', address: '25 Hoàng Quốc Việt, Cầu Giấy, Hà Nội' },
  { value: 's2', label: 'Cửa hàng Long Biên', address: '90 Nguyễn Văn Cừ, Long Biên, Hà Nội' },
];

const TIP_DC =
  'Theo km: số km × 2 chiều − số km miễn phí, nhân đơn giá, làm tròn lên 1.000 ₫. Nhập tay: ghi số tiền đã thoả thuận (miễn phí = 0).';

export function UiGallery() {
  const [money, setMoney] = useState<Vnd | null>(2_700_000);
  const [moneyNull, setMoneyNull] = useState<Vnd | null>(null);
  const [km, setKm] = useState<number | null>(12.35);
  const [minutes, setMinutes] = useState<number | null>(150);
  const [studio, setStudio] = useState('s1');
  const [checked, setChecked] = useState(true);
  const [addons, setAddons] = useState({ nail: true, lens: true, mi: false });
  const [sw, setSw] = useState(true);
  const [loc, setLoc] = useState<Loc>('CUSTOMER_HOME');
  const [travel, setTravel] = useState<Travel>('PER_KM');
  const [pricingTab, setPricingTab] = useState<'goi' | 'phu' | 'dc' | 'nv'>('goi');
  const [qty, setQty] = useState(2);
  const [chip, setChip] = useState('all');
  const [dialog, setDialog] = useState<null | 'lg' | 'sm'>(null);
  const [sheet, setSheet] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [listPrice, setListPrice] = useState<Vnd | null>(3_000_000);
  const [salePrice, setSalePrice] = useState<Vnd | null>(2_700_000);
  const [deposit, setDeposit] = useState<Vnd | null>(1_000_000);
  const [tierPay, setTierPay] = useState<Vnd | null>(null);

  const studioAddr = STUDIOS.find((s) => s.value === studio)?.address;

  return (
    <div className="xt-page">
      <div className="xt-head">
        <h1>Xem thử component</h1>
        <Button variant="primary" icon={<IconPlus />} onClick={() => setDialog('lg')}>
          Mở hộp thoại
        </Button>
        <Button onClick={() => setSheet(true)}>Mở ngăn kéo đáy</Button>
      </div>

      <div className="xt-grid">
        {/* ===== Button ===== */}
        <Card title="Button" subtitle="md 36 · sm 30 · biểu tượng 34" className="xt-wide">
          {(['default', 'primary', 'ghost', 'dashed'] as const).map((v) => (
            <Set key={v} name={v}>
              <Cell cap="Mặc định">
                <Button variant={v} icon={v === 'dashed' ? <IconPlus /> : undefined}>
                  {v === 'dashed' ? 'Thêm từ bảng giá' : 'Lưu nháp'}
                </Button>
              </Cell>
              <Cell cap="Rê chuột">
                <Button variant={v} data-demo="hover">
                  Lưu nháp
                </Button>
              </Cell>
              <Cell cap="Tiêu điểm">
                <Button variant={v} data-demo="focus">
                  Lưu nháp
                </Button>
              </Cell>
              <Cell cap="Khoá">
                <Button variant={v} disabled>
                  Lưu nháp
                </Button>
              </Cell>
              <Cell cap="Đang tải">
                <Button variant={v} loading icon={<IconPlus />}>
                  Đang lưu
                </Button>
              </Cell>
              <Cell cap="sm">
                <Button variant={v} size="sm" icon={<IconPlus />}>
                  Phụ phí
                </Button>
              </Cell>
              <Cell cap="Chỉ biểu tượng">
                <div className="xt-row">
                  <Button variant={v} icon={<IconPlus />} aria-label="Thêm" />
                  <Button variant={v} size="sm" icon={<IconPlus />} aria-label="Thêm" />
                </div>
              </Cell>
            </Set>
          ))}
          <Set name="Thử bấm">
            <Cell cap="Bấm để thấy đang tải 1,5 giây">
              <Button
                variant="primary"
                loading={saving}
                onClick={() => {
                  setSaving(true);
                  window.setTimeout(() => setSaving(false), 1500);
                }}
              >
                Xác nhận hợp đồng
              </Button>
            </Cell>
          </Set>
        </Card>

        {/* ===== Ô nhập ===== */}
        <Card title="TextInput · Textarea" subtitle="cao 36 (sm 30), bo 8">
          <Set name="TextInput" fill>
            <Cell cap="Mặc định">
              <TextInput aria-label="Tìm gói" placeholder="Tìm gói, dịch vụ, phụ phí" />
            </Cell>
            <Cell cap="Có chữ">
              <TextInput aria-label="Tên gói" defaultValue="Cô dâu – Ngày cưới" />
            </Cell>
            <Cell cap="Rê chuột">
              <TextInput aria-label="Tên gói" defaultValue="Cô dâu – Ăn hỏi" data-demo="hover" />
            </Cell>
            <Cell cap="Tiêu điểm">
              <TextInput aria-label="Tên gói" defaultValue="Phù dâu" data-demo="focus" />
            </Cell>
            <Cell cap="Khoá">
              <TextInput aria-label="Mã gói" defaultValue="G-CD01" disabled />
            </Cell>
            <Cell cap="Lỗi">
              <TextInput aria-label="Số điện thoại" defaultValue="09123" error="Số điện thoại phải có 10 chữ số." />
            </Cell>
            <Cell cap="sm">
              <TextInput aria-label="Giờ bắt đầu" size="sm" defaultValue="04:30" />
            </Cell>
          </Set>
          <Set name="Textarea" fill>
            <Cell cap="Mặc định (2 dòng)">
              <Textarea aria-label="Địa chỉ" placeholder="Số nhà, đường, phường, quận" />
            </Cell>
            <Cell cap="Tiêu điểm">
              <Textarea aria-label="Địa chỉ" defaultValue="Số 7, ngõ 128 Nguyễn Văn Cừ, Long Biên, Hà Nội" data-demo="focus" />
            </Cell>
            <Cell cap="Khoá">
              <Textarea aria-label="Ghi chú" defaultValue="Nhà gái ở ngõ nhỏ, xe máy vào được." disabled />
            </Cell>
            <Cell cap="Lỗi">
              <Textarea aria-label="Lý do huỷ" error="Bắt buộc ghi lý do." />
            </Cell>
          </Set>
        </Card>

        <Card title="MoneyInput · UnitInput" subtitle="căn phải, số nguyên đồng">
          <Set name="Money" fill>
            <Cell cap={`Gõ thử → ${money === null ? 'null' : money}`}>
              <MoneyInput aria-label="Giá bán" value={money} onChange={setMoney} placeholder="Không giảm" />
            </Cell>
            <Cell cap={`Trống → ${moneyNull === null ? 'null' : moneyNull}`}>
              <MoneyInput aria-label="Tiền công" value={moneyNull} onChange={setMoneyNull} placeholder="Chưa đặt" />
            </Cell>
            <Cell cap="Rê chuột">
              <MoneyInput aria-label="Cọc" value={1_000_000} onChange={() => {}} data-demo="hover" />
            </Cell>
            <Cell cap="Tiêu điểm">
              <MoneyInput aria-label="Cọc" value={500_000} onChange={() => {}} data-demo="focus" />
            </Cell>
            <Cell cap="Khoá">
              <MoneyInput aria-label="Giảm giá" value={327_000} onChange={() => {}} disabled />
            </Cell>
            <Cell cap="Lỗi">
              <MoneyInput aria-label="Giá bán" value={3_200_000} onChange={() => {}} error="Giá bán lớn hơn giá niêm yết." />
            </Cell>
          </Set>
          <Set name="Unit" fill>
            <Cell cap={`km → ${km === null ? 'null' : km}`}>
              <UnitInput aria-label="Số km" unit="km" value={km} onChange={setKm} />
            </Cell>
            <Cell cap={`phút → ${minutes === null ? 'null' : minutes}`}>
              <UnitInput aria-label="Thời lượng" unit="phút" value={minutes} onChange={setMinutes} />
            </Cell>
            <Cell cap="lần · tiêu điểm">
              <UnitInput aria-label="Số lần" unit="lần" value={1} onChange={() => {}} data-demo="focus" />
            </Cell>
            <Cell cap="Khoá">
              <UnitInput aria-label="Số km" unit="km" value={3} onChange={() => {}} disabled />
            </Cell>
            <Cell cap="Lỗi">
              <UnitInput aria-label="Số km" unit="km" value={null} onChange={() => {}} error="Tối đa 99.999,99 km." />
            </Cell>
          </Set>
        </Card>

        <Card title="Select" subtitle="chữ ngắn, thông tin phụ ở dòng dưới">
          <Set name="Select" fill>
            <Cell cap="Mặc định + địa chỉ">
              <Select aria-label="Studio" options={STUDIOS} value={studio} onChange={(e) => setStudio(e.target.value)} hint={studioAddr} />
            </Cell>
            <Cell cap="Chưa chọn">
              <Select aria-label="Nhân vật" options={[{ value: 'cd', label: 'Cô dâu' }, { value: 'pd', label: 'Phù dâu' }]} placeholder="Chọn nhân vật" defaultValue="" />
            </Cell>
            <Cell cap="Tiêu điểm">
              <Select aria-label="Nhân vật" options={[{ value: 'cd', label: 'Cô dâu' }]} data-demo="focus" />
            </Cell>
            <Cell cap="Khoá">
              <Select aria-label="Studio" options={STUDIOS} value="s2" onChange={() => {}} disabled hint={STUDIOS[1]?.address} />
            </Cell>
            <Cell cap="Lỗi">
              <Select aria-label="Studio" options={STUDIOS} placeholder="Chọn studio" defaultValue="" error="Chọn studio cho dòng này." />
            </Cell>
            <Cell cap="sm">
              <Select aria-label="Nhân vật" size="sm" options={[{ value: 'cd', label: 'Cô dâu' }]} />
            </Cell>
          </Set>
        </Card>

        <Card title="Checkbox · Switch" subtitle="ô 16 · công tắc 38×22">
          <Set name="Checkbox">
            <div className="xt-col" style={{ width: '100%' }}>
              <Checkbox label="Tại studio / cửa hàng" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <Checkbox
                label="Tại nhà khách"
                defaultChecked
                tip={<Tooltip text="Lập hợp đồng ở đây sẽ bắt buộc có phí di chuyển." />}
              />
              <Checkbox label="Làm nail" defaultChecked trailing={formatVnd(250_000)} />
              <Checkbox label="Làm tóc" trailing={formatVnd(300_000)} />
              <Checkbox label="Tiêu điểm" data-demo="focus" />
              <Checkbox label="Khoá (đã tick)" defaultChecked disabled />
              <Checkbox label="Khoá" disabled />
              <Checkbox label="Tôi đã kiểm tra lịch thợ" error="Cần tick trước khi xác nhận." />
            </div>
          </Set>
          <Set name="Switch">
            <Cell cap="Bật (bấm thử)">
              <Switch checked={sw} onChange={setSw} aria-label="Tính cả chiều về" />
            </Cell>
            <Cell cap="Tắt">
              <Switch checked={false} onChange={() => {}} aria-label="Đang dùng" />
            </Cell>
            <Cell cap="Rê chuột">
              <Switch checked onChange={() => {}} aria-label="Đang dùng" data-demo="hover" />
            </Cell>
            <Cell cap="Tiêu điểm">
              <Switch checked={false} onChange={() => {}} aria-label="Đang dùng" data-demo="focus" />
            </Cell>
            <Cell cap="Khoá bật">
              <Switch checked onChange={() => {}} aria-label="Đang dùng" disabled />
            </Cell>
            <Cell cap="Khoá tắt">
              <Switch checked={false} onChange={() => {}} aria-label="Đang dùng" disabled />
            </Cell>
          </Set>
        </Card>

        <Card title="CheckChip · Qty" subtitle="viên cao 28 · số lượng 28–32">
          <Set name="CheckChip">
            <Cell cap="Bật">
              <CheckChip label="Làm nail" price={`+${formatVnd(250_000)}`} checked={addons.nail} onChange={(e) => setAddons({ ...addons, nail: e.target.checked })} />
            </Cell>
            <Cell cap="Bật">
              <CheckChip label="Lens" price={`+${formatVnd(100_000)}`} checked={addons.lens} onChange={(e) => setAddons({ ...addons, lens: e.target.checked })} />
            </Cell>
            <Cell cap="Tắt">
              <CheckChip label="Kẹp mi" price={`+${formatVnd(80_000)}`} checked={addons.mi} onChange={(e) => setAddons({ ...addons, mi: e.target.checked })} />
            </Cell>
            <Cell cap="Rê chuột">
              <CheckChip label="Làm tóc" price={`+${formatVnd(300_000)}`} checked={false} onChange={() => {}} data-demo="hover" />
            </Cell>
            <Cell cap="Tiêu điểm">
              <CheckChip label="Làm tóc" price={`+${formatVnd(300_000)}`} checked onChange={() => {}} data-demo="focus" />
            </Cell>
            <Cell cap="Khoá">
              <CheckChip label="Kẹp mi × 2" price={`+${formatVnd(80_000)}`} checked={false} disabled onChange={() => {}} />
            </Cell>
            <Cell cap="Khoá, đã bật">
              <CheckChip label="Làm tóc" price={`+${formatVnd(300_000)}`} checked disabled onChange={() => {}} />
            </Cell>
            <Cell cap="Đã huỷ">
              <CheckChip label="Lens" price={`+${formatVnd(100_000)}`} voidReason="khách đổi ý" />
            </Cell>
          </Set>
          <Set name="Qty">
            <Cell cap={`Bấm thử: ${qty}`}>
              <Qty value={qty} onChange={setQty} label="Số người" />
            </Cell>
            <Cell cap="Ở 1: khoá −">
              <Qty value={1} onChange={() => {}} label="Số người" />
            </Cell>
            <Cell cap="Ở 1000: khoá +">
              <Qty value={1000} onChange={() => {}} label="Số người" />
            </Cell>
            <Cell cap="sm">
              <Qty value={2} onChange={() => {}} size="sm" label="Số người" />
            </Cell>
            <Cell cap="Khoá">
              <Qty value={2} onChange={() => {}} disabled label="Số người" />
            </Cell>
          </Set>
        </Card>

        <Card title="Segmented" subtitle="ô cao 34 (sm 28)">
          <Set name="md">
            <Cell cap="Bấm thử; ô sọc rê chuột để xem lý do">
              <Segmented aria-label="Làm ở đâu" options={LOC_OPTIONS} value={loc} onChange={setLoc} />
            </Cell>
            <Cell cap="Rê chuột ô Cố định">
              <Segmented aria-label="Cách tính" options={TRAVEL_OPTIONS} value="PER_KM" onChange={() => {}} demo={{ value: 'FIXED', state: 'hover' }} />
            </Cell>
            <Cell cap="Tiêu điểm">
              <Segmented aria-label="Cách tính" options={TRAVEL_OPTIONS} value="PER_KM" onChange={() => {}} demo={{ value: 'PER_KM', state: 'focus' }} />
            </Cell>
          </Set>
          <Set name="sm">
            <Cell cap="Bấm thử">
              <Segmented aria-label="Cách tính" size="sm" options={TRAVEL_OPTIONS} value={travel} onChange={setTravel} />
            </Cell>
            <Cell cap="Khoá cả nhóm (dòng đã chốt)">
              <Segmented aria-label="Cách tính" size="sm" options={TRAVEL_OPTIONS} value="PER_KM" onChange={() => {}} disabled />
            </Cell>
            <Cell cap="Ô khoá, tooltip mở">
              <span className="xt-row">
                <WithTooltip text="Gói này không làm tại nhà" open>
                  <Segmented
                    aria-label="Làm ở đâu"
                    size="sm"
                    options={[
                      { value: 'STUDIO', label: 'Studio' },
                      { value: 'CUSTOMER_HOME', label: 'Tại nhà', disabled: true },
                      { value: 'OTHER', label: 'Nơi khác', disabled: true },
                    ]}
                    value="STUDIO"
                    onChange={() => {}}
                  />
                </WithTooltip>
              </span>
            </Cell>
          </Set>
          <Set name="Chia đều">
            <Cell cap="Nhóm 4 ô (điện thoại)">
              <Segmented
                aria-label="Nhóm bảng giá"
                block
                options={[
                  { value: 'goi', label: 'Gói' },
                  { value: 'phu', label: 'Dịch vụ phụ' },
                  { value: 'dc', label: 'Di chuyển' },
                  { value: 'nv', label: 'Nhân vật' },
                ]}
                value={pricingTab}
                onChange={setPricingTab}
              />
            </Cell>
          </Set>
        </Card>

        <Card title="Tooltip" subtitle="vòng 16 · khung 240">
          <Set name="Tooltip">
            <div className="xt-col" style={{ width: '100%' }}>
              <SettingRow label="Số km miễn phí" tip="Trừ vào tổng số km (đã tính cả chiều về) trước khi nhân đơn giá." controlWidth={160}>
                <UnitInput aria-label="Số km miễn phí" unit="km" value={3} onChange={() => {}} />
              </SettingRow>
              <SettingRow label="Phí tối thiểu" tip="Tính ra thấp hơn mức này thì lấy mức này." controlWidth={160}>
                <MoneyInput aria-label="Phí tối thiểu" value={100_000} onChange={() => {}} />
              </SettingRow>
              <SettingRow label="Tooltip đang mở (ép)" controlWidth={160}>
                <span className="xt-row">
                  <span className="xt-out">Giá bán</span>
                  <Tooltip open text="Bỏ trống nếu không giảm. Hợp đồng dùng giá bán khi có. Đổi giá = thêm bản giá mới có ngày áp dụng." />
                </span>
              </SettingRow>
            </div>
          </Set>
        </Card>

        <Card title="Avatar · AvatarStack" subtitle="32 / 28 / 22">
          <Set name="Avatar">
            <Cell cap="md 32">
              <div className="xt-row">
                {STAFF.map((s) => (
                  <Avatar key={s.membershipId} name={s.displayName} initials={s.initials} colorKey={s.membershipId} />
                ))}
              </div>
            </Cell>
            <Cell cap="sm 28">
              <div className="xt-row">
                <Avatar name="Nguyễn Trọng Chiến" colorKey="m-chien" size="sm" />
                <Avatar name="Lê Ngọc Trâm" colorKey="m-ngoc-tram" size="sm" />
              </div>
            </Cell>
            <Cell cap="nhỏ 22">
              <div className="xt-row">
                <Avatar name="Phạm Bảo Vy" colorKey="m-bao-vy" size="xs" />
                <Avatar name="Đỗ Khánh Linh" colorKey="m-khanh-linh" size="xs" />
              </div>
            </Cell>
            <Cell cap="Có ảnh · ảnh lỗi">
              <div className="xt-row">
                <Avatar name="Nguyễn Thu Hà" avatarUrl={PHOTO} />
                <Avatar name="Trần Minh Anh" colorKey="m-minh-anh" avatarUrl="/khong-co-anh.png" />
              </div>
            </Cell>
          </Set>
          <Set name="Stack">
            <Cell cap="2 người">
              <AvatarStack people={STAFF.slice(0, 2)} />
            </Cell>
            <Cell cap="3 người">
              <AvatarStack people={STAFF.slice(0, 3)} />
            </Cell>
            <Cell cap="5 người → +2">
              <AvatarStack people={STAFF} />
            </Cell>
          </Set>
        </Card>

        <Card title="StatusTag · Chip">
          <Set name="Hợp đồng">
            <div className="xt-row">
              {CONTRACT_STATUSES.map((s) => (
                <ContractStatusTag key={s} status={s} />
              ))}
            </div>
          </Set>
          <Set name="Lịch">
            <div className="xt-row">
              {WORK_STATUSES.map((s) => (
                <WorkStatusTag key={s} status={s} />
              ))}
            </div>
          </Set>
          <Set name="Nhãn khác">
            <div className="xt-row">
              <StatusTag tone="warn">Phát sinh 26/10</StatusTag>
              <StatusTag>Phụ phí</StatusTag>
              <StatusTag>Tự đặt tên</StatusTag>
              <StatusTag tone="accent">Cô dâu</StatusTag>
              <StatusTag tone="accent">Mẹ cô dâu</StatusTag>
              <StatusTag tone="danger">2 ca trùng lịch</StatusTag>
            </div>
          </Set>
          <Set name="Chip">
            <div className="xt-row">
              {[
                ['all', 'Tất cả'],
                ['cd', 'Cô dâu'],
                ['mcd', 'Mẹ cô dâu'],
                ['pd', 'Phù dâu'],
                ['any', 'Mọi nhân vật'],
              ].map(([k, t]) => (
                <Chip key={k} selected={chip === k} onClick={() => setChip(k!)}>
                  {t}
                </Chip>
              ))}
            </div>
          </Set>
          <Set name="Chip trạng thái">
            <Cell cap="Có số">
              <Chip count={3}>Thu Hà</Chip>
            </Cell>
            <Cell cap="Rê chuột">
              <Chip data-demo="hover">Minh Anh</Chip>
            </Cell>
            <Cell cap="Tiêu điểm">
              <Chip data-demo="focus">Ngọc Trâm</Chip>
            </Cell>
            <Cell cap="Khoá">
              <Chip disabled>Bảo Vy</Chip>
            </Cell>
          </Set>
        </Card>

        {/* ===== Ghép thử: thẻ dòng gói (theo .ln2 bản mẫu) ===== */}
        <Card
          className="xt-ln"
          title={
            <span className="xt-row">
              <StatusTag tone="accent">Cô dâu</StatusTag>
              <span>Cô dâu – Ngày cưới</span>
            </span>
          }
          actions={
            <>
              <Qty value={1} onChange={() => {}} size="sm" label="Số người" />
              <Button variant="ghost" size="sm" aria-label="Bỏ dòng" icon={<span aria-hidden="true">✕</span>} />
            </>
          }
          footer={
            <>
              <span className="xt-out">Cộng cô dâu</span>
              <b className="num">{formatVnd(3_267_000)}</b>
            </>
          }
        >
          <div className="xt-rw">
            <span>Giờ</span>
            <div className="xt-fl">
              <TextInput aria-label="Bắt đầu" size="sm" defaultValue="04:30" className="xt-time" />
              <span>–</span>
              <TextInput aria-label="Kết thúc" size="sm" defaultValue="07:00" className="xt-time" />
              <span className="xt-out num">1 × {formatVnd(2_700_000)}</span>
            </div>
          </div>
          <div className="xt-rw">
            <span>Dịch vụ phụ</span>
            <div className="xt-fl">
              <CheckChip label="Làm nail" price={`+${formatVnd(250_000)}`} checked onChange={() => {}} />
              <CheckChip label="Lens" price={`+${formatVnd(100_000)}`} checked onChange={() => {}} />
              <CheckChip label="Kẹp mi" price={`+${formatVnd(80_000)}`} checked={false} onChange={() => {}} />
            </div>
          </div>
          <div className="xt-rw">
            <span>Làm ở đâu</span>
            <div className="xt-col">
              <Segmented aria-label="Làm ở đâu" size="sm" options={LOC_OPTIONS} value={loc} onChange={setLoc} />
              {loc === 'STUDIO' ? (
                <Select aria-label="Studio" options={STUDIOS} value={studio} onChange={(e) => setStudio(e.target.value)} hint={studioAddr} />
              ) : (
                <Textarea aria-label="Địa chỉ" size="sm" defaultValue="Số 7, ngõ 128 Nguyễn Văn Cừ, Long Biên, Hà Nội" />
              )}
            </div>
          </div>
          {loc !== 'STUDIO' && (
            <div className="xt-rw">
              <span>
                Di chuyển<span className="ui-req">*</span>
                <Tooltip text={TIP_DC} />
              </span>
              <div className="xt-col">
                <div className="xt-fl">
                  <Segmented aria-label="Cách tính phí di chuyển" size="sm" options={TRAVEL_OPTIONS} value={travel} onChange={setTravel} />
                  {travel === 'PER_KM' && (
                    <UnitInput aria-label="Số km" unit="km" size="sm" value={km} onChange={setKm} className="xt-km" />
                  )}
                  {travel === 'MANUAL' && <MoneyInput aria-label="Phí di chuyển" size="sm" value={0} onChange={() => {}} className="xt-km" />}
                  <b className="num" style={{ marginLeft: 'auto' }}>
                    {formatVnd(217_000)}
                  </b>
                </div>
                {travel === 'PER_KM' && km !== null && (
                  <span className="xt-out num" style={{ whiteSpace: 'normal' }}>
                    {formatKm(km)} × 2 chiều − 3 km miễn phí = 21,7 km × {formatVnd(10_000)}
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* ===== Ghép thử: thẻ dòng đã chốt ===== */}
        <Card
          className="xt-ln"
          title={
            <span className="xt-row">
              <StatusTag tone="accent">Phù dâu</StatusTag>
              <span>Phù dâu</span>
              <IconLock aria-label="Đã chốt" />
            </span>
          }
          actions={
            <>
              <span className="xt-out">2 người</span>
              <Button variant="ghost" size="sm">
                Huỷ dòng
              </Button>
            </>
          }
          footer={
            <>
              <span className="xt-out">Cộng phù dâu</span>
              <b className="num">{formatVnd(960_000)}</b>
            </>
          }
        >
          <div className="xt-rw">
            <span>Dịch vụ phụ</span>
            <div className="xt-fl">
              <CheckChip label="Làm tóc" price={`+${formatVnd(300_000)}`} checked={false} disabled onChange={() => {}} />
              <CheckChip label="Kẹp mi × 2" price={`+${formatVnd(80_000)}`} checked disabled onChange={() => {}} />
            </div>
          </div>
          <div className="xt-rw">
            <span>Làm ở đâu</span>
            <div className="xt-col">
              <Segmented aria-label="Làm ở đâu" size="sm" options={LOC_OPTIONS} value="STUDIO" onChange={() => {}} disabled />
              <Select aria-label="Studio" options={STUDIOS} value="s1" onChange={() => {}} disabled hint={STUDIOS[0]?.address} />
            </div>
          </div>
        </Card>

        {/* ===== Thẻ tổng + StickyTotalBar ===== */}
        <div className="xt-stack">
          <Card>
            <SettingRow label="Tạm tính" controlWidth={180}>
              <span className="num">{formatVnd(5_627_000)}</span>
            </SettingRow>
            <SettingRow label="Giảm giá" tip="Máy chủ báo lỗi nếu lớn hơn tạm tính." controlWidth={180}>
              <MoneyInput aria-label="Giảm giá" value={327_000} onChange={() => {}} />
            </SettingRow>
            <SettingRow label={<span style={{ fontSize: 18, fontWeight: 700 }}>Tổng</span>} controlWidth={180}>
              <b className="num" style={{ fontSize: 18 }}>
                {formatVnd(5_300_000)}
              </b>
            </SettingRow>
            <SettingRow label="Cọc cần thu" tip={`Gợi ý: ${formatVnd(1_000_000)}`} controlWidth={180}>
              <MoneyInput aria-label="Cọc cần thu" value={1_000_000} onChange={() => {}} />
            </SettingRow>
          </Card>
          <StickyTotalBar
            position="static"
            total={5_300_000}
            deposit={1_000_000}
            pending={pending}
            actions={
              <>
                <Button className="ui-total__hide-phone" onClick={() => setPending((p) => !p)}>
                  Lưu nháp
                </Button>
                <Button variant="primary">Xác nhận hợp đồng</Button>
              </>
            }
          />
          <StickyTotalBar position="static" total={5_300_000} deposit={1_000_000} pending actions={<Button variant="primary">Xác nhận hợp đồng</Button>} />
          <StickyTotalBar
            position="static"
            total={5_450_000}
            deposit={1_000_000}
            actions={
              <Button variant="primary" icon={<IconPlus />}>
                Phát sinh
              </Button>
            }
          />
          <span className="xt-out">Thanh 1: bấm "Lưu nháp" để bật/tắt đang chờ quote. Thanh 2: đang chờ (số mờ, giữ chỗ). Thanh 3: hợp đồng đã xác nhận.</span>
        </div>

        {/* ===== Card · EmptyState · Skeleton ===== */}
        <div className="xt-stack">
          <Card
            title="Cô dâu"
            subtitle="2 gói"
            actions={<Button variant="ghost" size="sm" icon={<IconPlus />} aria-label="Thêm gói cho Cô dâu" />}
            footer={
              <>
                <span>Chân thẻ (--soft)</span>
                <b className="num">{formatVnd(4_500_000)}</b>
              </>
            }
          >
            <SettingRow label="Cô dâu – Ngày cưới">
              <b className="num">{formatVnd(2_700_000)}</b>
            </SettingRow>
            <SettingRow label="Cô dâu – Ăn hỏi">
              <b className="num">{formatVnd(1_800_000)}</b>
            </SettingRow>
          </Card>
          <Card title="Chú rể" subtitle="0 gói">
            <EmptyState
              message="Chưa có gói nào cho Chú rể."
              action={
                <Button variant="dashed" size="sm" icon={<IconPlus />}>
                  Thêm gói
                </Button>
              }
            />
          </Card>
          <Card title="Đang tải lần đầu">
            <div className="xt-skel-row">
              <SkeletonText lines={2} widths={['70%', '40%']} />
              <Skeleton width={92} height={14} />
            </div>
            <div className="xt-skel-row">
              <span className="xt-row" style={{ flexWrap: 'nowrap' }}>
                <Skeleton width={32} height={32} circle />
                <SkeletonText lines={2} widths={['60%', '35%']} />
              </span>
              <Skeleton width={92} height={14} />
            </div>
          </Card>
        </div>
      </div>

      {/* ===== Dialog ===== */}
      <Dialog
        open={dialog === 'lg'}
        onClose={() => setDialog(null)}
        eyebrow="Cô dâu · G-CD01"
        title="Cô dâu – Ngày cưới"
        primaryLabel="Lưu"
        primaryLoading={saving}
        onPrimary={() => {
          setSaving(true);
          window.setTimeout(() => {
            setSaving(false);
            setDialog(null);
          }, 1200);
        }}
      >
        <div className="xt-dg">
          <div className="xt-ng">
            <h3>Thông tin &amp; giá</h3>
            <SettingRow label="Tên gói" htmlFor="xt-ten-goi" controlWidth={180}>
              <TextInput id="xt-ten-goi" defaultValue="Cô dâu – Ngày cưới" />
            </SettingRow>
            <SettingRow label="Nhân vật" tip="Để Mọi nhân vật nếu gói dùng cho ai cũng được." controlWidth={180}>
              <Select aria-label="Nhân vật" options={[{ value: 'cd', label: 'Cô dâu' }, { value: '', label: 'Mọi nhân vật' }]} defaultValue="cd" />
            </SettingRow>
            <SettingRow label="Thời lượng" controlWidth={180}>
              <UnitInput aria-label="Thời lượng" unit="phút" value={minutes} onChange={setMinutes} />
            </SettingRow>
            <SettingRow label="Giá niêm yết" controlWidth={180}>
              <MoneyInput aria-label="Giá niêm yết" value={listPrice} onChange={setListPrice} />
            </SettingRow>
            <SettingRow label="Giá bán" tip="Bỏ trống nếu không giảm. Hợp đồng dùng giá bán khi có." controlWidth={180}>
              <MoneyInput
                aria-label="Giá bán"
                value={salePrice}
                onChange={setSalePrice}
                placeholder="Không giảm"
                error={salePrice !== null && listPrice !== null && salePrice > listPrice ? 'Giá bán lớn hơn giá niêm yết.' : undefined}
              />
            </SettingRow>
            <SettingRow label="Cọc mặc định" controlWidth={180}>
              <MoneyInput aria-label="Cọc mặc định" value={deposit} onChange={setDeposit} />
            </SettingRow>
          </div>
          <div className="xt-ng">
            <h3>
              Dịch vụ phụ cho tick
              <Tooltip text="Khi lập hợp đồng, các dịch vụ được chọn ở đây hiện thành ô tick dưới gói." />
            </h3>
            <Checkbox label="Làm tóc" trailing={formatVnd(300_000)} disabled />
            <Checkbox label="Làm nail" trailing={formatVnd(250_000)} defaultChecked />
            <Checkbox label="Lens" trailing={formatVnd(100_000)} defaultChecked />
            <h3>
              Tiền công thợ theo bậc
              <Tooltip text="Số tiền trả cho thợ mỗi lần làm gói này, theo bậc lương của thợ. Bỏ trống = chưa đặt." />
            </h3>
            <SettingRow
              label={
                <span className="xt-tier">
                  <AvatarStack people={STAFF.slice(0, 2)} />
                  <span>
                    <b>Thợ chính bậc 1</b>
                    <span className="xt-out">Nguyễn Thu Hà, Trần Minh Anh</span>
                  </span>
                </span>
              }
              controlWidth={150}
            >
              <MoneyInput aria-label="Tiền công thợ chính bậc 1" value={700_000} onChange={() => {}} />
            </SettingRow>
            <SettingRow
              label={
                <span className="xt-tier">
                  <AvatarStack people={STAFF.slice(3)} />
                  <span>
                    <b>Thợ phụ</b>
                    <span className="xt-out">Phạm Bảo Vy, Đỗ Khánh Linh</span>
                  </span>
                </span>
              }
              controlWidth={150}
            >
              <MoneyInput aria-label="Tiền công thợ phụ" value={tierPay} onChange={setTierPay} placeholder="Chưa đặt" />
            </SettingRow>
            <div className="xt-row" style={{ paddingTop: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => setDialog('sm')}>
                Mở hộp nhỏ chồng lên (huỷ dòng)
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={dialog === 'sm'}
        size="sm"
        onClose={() => setDialog('lg')}
        title="Huỷ dòng Phù dâu"
        primaryLabel="Huỷ dòng"
        primaryDisabled={reason.trim() === ''}
        onPrimary={() => setDialog('lg')}
        cancelLabel="Thôi"
      >
        <SettingRow label="Lý do" required stack>
          <Textarea aria-label="Lý do huỷ" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: khách bớt một phù dâu" />
        </SettingRow>
      </Dialog>

      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Thêm từ bảng giá"
        footer={
          <Button variant="primary" onClick={() => setSheet(false)}>
            Xong
          </Button>
        }
      >
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
          <TextInput aria-label="Tìm" placeholder="Tìm gói, dịch vụ, phụ phí" />
        </div>
        {[
          ['Cô dâu – Ngày cưới', 'Cô dâu · Studio, Tại nhà, Nơi khác', 2_700_000],
          ['Cô dâu – Ăn hỏi', 'Cô dâu · Studio, Tại nhà, Nơi khác', 1_800_000],
          ['Mẹ – Trang điểm nhẹ nhàng', 'Mẹ cô dâu · Studio, Tại nhà', 600_000],
          ['Phù dâu', 'Phù dâu · Studio', 400_000],
          ['Khách dự tiệc', 'Mọi nhân vật · Studio', 450_000],
        ].map(([name, meta, price]) => (
          <div key={String(name)} className="xt-skel-row">
            <span>
              <b style={{ fontWeight: 600, display: 'block' }}>{name}</b>
              <span className="xt-out">{meta}</span>
            </span>
            <Button size="sm" icon={<IconPlus />}>
              <span className="num">{formatVnd(Number(price))}</span>
            </Button>
          </div>
        ))}
      </BottomSheet>
    </div>
  );
}
