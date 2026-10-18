// Trang xem thử — phần component bản vẽ C2 mục 0.1–0.2 (ListDetail, ListGroupHeader, ListRow, StatTile,
// PersonChip, ImageUpload, ConfirmDialog). Trạng thái rê chuột / tiêu điểm vẽ tĩnh bằng data-demo.
import { useState, type ReactNode } from 'react';
import {
  Avatar,
  Button,
  Card,
  ConfirmDialog,
  ImageUpload,
  ListDetail,
  ListGroupHeader,
  ListRow,
  ListRowSkeleton,
  PersonChip,
  PersonChipList,
  Segmented,
  StatGrid,
  StatTile,
  StatusTag,
  TextInput,
  formatVnd,
  type ImageUploadContext,
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

const svg = (body: string, vb = '0 0 100 100') =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`);
// Ảnh mẫu SVG nền phẳng, không gọi mạng (màu lấy từ bảng token).
const LOGO = svg(
  '<rect width="100" height="100" fill="#fff"/><circle cx="50" cy="50" r="44" fill="none" stroke="#A63D62" stroke-width="3"/><text x="50" y="62" text-anchor="middle" font-family="Georgia,serif" font-size="34" fill="#A63D62">SC</text>',
);
const COVER = svg(
  '<rect width="300" height="100" fill="#F7E8EE"/><circle cx="240" cy="30" r="50" fill="#E7B8C9"/><rect x="40" y="40" width="90" height="16" rx="8" fill="#A63D62" opacity=".6"/><rect x="145" y="20" width="8" height="58" fill="#7A6A62"/><rect x="160" y="14" width="8" height="64" fill="#A63D62"/>',
  '0 0 300 100',
);
const PHOTO = svg(
  '<rect width="100" height="100" fill="#F7E8EE"/><circle cx="50" cy="40" r="18" fill="#221C19"/><circle cx="50" cy="44" r="14" fill="#E9C9A8"/><rect x="22" y="66" width="56" height="44" rx="28" fill="#A63D62"/>',
);

const PEOPLE = [
  { id: 'm-thu-ha', name: 'Nguyễn Thu Hà' },
  { id: 'm-minh-anh', name: 'Trần Minh Anh' },
  { id: 'm-ngoc-tram', name: 'Lê Ngọc Trâm' },
  { id: 'm-bao-vy', name: 'Phạm Bảo Vy' },
];

const CONTRACTS = [
  { id: 'HD-000138', name: 'Phạm Thu Trang', total: 3_200_000, date: '20/10' },
  { id: 'HD-000149', name: 'Nguyễn Thị Mai', total: 4_100_000, date: '22/10' },
  { id: 'HD-000142', name: 'Tôn Nữ Hoàng Bảo Ngọc Phương Thảo', total: 5_300_000, date: '24/10' },
];

/** Tải giả: chạy tiến độ 0 → 100% trong ~1,6 giây. Tệp tên có chữ "loi" thì giả lỗi 400 của máy chủ. */
function fakeUpload(file: File, ctx: ImageUploadContext, onDone: (url: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let p = 0;
    const t = setInterval(() => {
      p += 0.125;
      ctx.onProgress(p);
      if (p >= 1) {
        clearInterval(t);
        if (/loi/i.test(file.name)) {
          reject(new Error('Tệp không phải ảnh hợp lệ (máy chủ trả 400).'));
          return;
        }
        onDone(URL.createObjectURL(file));
        resolve();
      }
    }, 200);
    ctx.signal.addEventListener('abort', () => clearInterval(t));
  });
}

export function GalleryC2() {
  const [selected, setSelected] = useState('HD-000142');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [logo, setLogo] = useState<string | null>(LOGO);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(COVER);
  const [staffPhoto, setStaffPhoto] = useState<string | null>(PHOTO);
  const [confirm, setConfirm] = useState<null | 'huy' | 'bo' | 'khoa'>(null);
  const [lastReason, setLastReason] = useState<string | null>(null);

  const current = CONTRACTS.find((c) => c.id === selected) ?? CONTRACTS[2]!;

  return (
    <div className="xt-grid xt-c2" id="c2">
      {/* ===== ListDetail ===== */}
      <Card
        title="ListDetail"
        subtitle="380 | 1fr · hẹp 300 · máy tính bảng 320/240 · điện thoại một cột"
        className="xt-wide"
        id="c2-list-detail"
      >
        <div className="xt-ld-ctl">
          <Segmented
            size="sm"
            aria-label="Màn trên điện thoại"
            value={mobileView}
            onChange={setMobileView}
            options={[
              { value: 'list', label: 'Điện thoại: danh sách' },
              { value: 'detail', label: 'Điện thoại: chi tiết' },
            ]}
          />
        </div>
        <div className="xt-ld-frame">
          <ListDetail
            mobileView={mobileView}
            sticky={false}
            listLabel="Hợp đồng cần thu"
            detailLabel="Chi tiết hợp đồng"
            list={
              <Card title="Hợp đồng cần thu" subtitle="hôm nay 18/10/2026" flush>
                <div className="xt-ld-search">
                  <TextInput size="sm" aria-label="Tìm hợp đồng" placeholder="Tìm mã HĐ, tên khách, số điện thoại" />
                </div>
                <ListGroupHeader aside={CONTRACTS.length}>Sự kiện 7 ngày tới</ListGroupHeader>
                {CONTRACTS.map((c) => (
                  <ListRow
                    key={c.id}
                    title={c.name}
                    subtitle={c.id}
                    amount={formatVnd(c.total)}
                    selected={c.id === selected}
                    onClick={() => {
                      setSelected(c.id);
                      setMobileView('detail');
                    }}
                  />
                ))}
                <ListGroupHeader tone="danger" aside={1}>
                  Đã qua ngày sự kiện
                </ListGroupHeader>
                <ListRow
                  title="Trần Hải Yến"
                  subtitle="HD-000131"
                  amount={formatVnd(2_800_000)}
                  trailing={<StatusTag tone="neutral">Sự kiện 12/10</StatusTag>}
                  onClick={() => setMobileView('detail')}
                />
              </Card>
            }
            detail={
              <>
                <Card
                  title={current.name}
                  subtitle={`${current.id} · Sự kiện ${current.date}/2026`}
                  actions={
                    <Button size="sm" className="xt-m-only" onClick={() => setMobileView('list')}>
                      ‹ Danh sách
                    </Button>
                  }
                >
                  <StatGrid label="Tiền hợp đồng">
                    <StatTile label="Tổng" value={formatVnd(current.total)} />
                    <StatTile label="Cọc phải thu" value={formatVnd(1_000_000)} />
                    <StatTile label="Đã thu thực tế" value={formatVnd(1_000_000)} />
                    <StatTile label="Còn lại" value={formatVnd(current.total - 1_000_000)} variant="highlight" />
                  </StatGrid>
                </Card>
              </>
            }
          />
        </div>
        <ListDetail
          variant="narrow"
          sticky={false}
          className="xt-ld-narrow"
          list={
            <Card title="Bậc lương" flush>
              <ListRow title="Tất cả thợ" trailing="8" selected onClick={() => {}} />
              <ListRow title="Thợ chính" trailing="3" onClick={() => {}} />
              <ListRow title="Cộng tác viên (cũ) · đang ẩn" trailing="1" tone="faint" onClick={() => {}} />
              <ListRow title="Chưa gán bậc" trailing="2" tone="warn" onClick={() => {}} />
            </Card>
          }
          detail={<Card title="Biến thể hẹp" subtitle="300 | 1fr">{null}</Card>}
        />
      </Card>

      {/* ===== ListGroupHeader + ListRow ===== */}
      <Card title="ListGroupHeader · ListRow" subtitle="đệm 11 16 · lưới [ảnh] 1fr auto" className="xt-wide" id="c2-list-row" flush>
        <ListGroupHeader aside="12 khách">Mới thêm gần đây</ListGroupHeader>
        <ListGroupHeader tone="danger" aside={2}>
          Quá hạn (biến thể danger)
        </ListGroupHeader>
        <div className="xt-rows">
          <Cell cap="Mặc định (có ảnh)">
            <ListRow
              leading={<Avatar name="Phạm Thu Trang" colorKey="k1" />}
              title="Phạm Thu Trang"
              amount="0912 345 678"
              onClick={() => {}}
            />
          </Cell>
          <Cell cap="Rê chuột">
            <ListRow title="Nguyễn Thị Mai" subtitle="HD-000149" amount={formatVnd(4_100_000)} onClick={() => {}} data-demo="hover" />
          </Cell>
          <Cell cap="Tiêu điểm">
            <ListRow title="Đỗ Minh Ngọc" subtitle="HD-000150" amount={formatVnd(3_600_000)} onClick={() => {}} data-demo="focus" />
          </Cell>
          <Cell cap="Đang chọn — tên dài xuống dòng, không cắt">
            <ListRow
              title="Tôn Nữ Hoàng Bảo Ngọc Phương Thảo"
              subtitle="HD-000142"
              amount={formatVnd(5_300_000)}
              trailing={<StatusTag tone="neutral">Sự kiện 24/10</StatusTag>}
              selected
              onClick={() => {}}
            />
          </Cell>
          <Cell cap="Khoá">
            <ListRow title="Hoàng Gia Linh" subtitle="HD-000152" amount={formatVnd(2_900_000)} disabled onClick={() => {}} />
          </Cell>
          <Cell cap="Lỗi">
            <ListRow title="Trần Hải Yến" error="Không tải được tiền đã thu" amount={formatVnd(2_800_000)} onClick={() => {}} />
          </Cell>
          <Cell cap="Đang tải">
            <ListRowSkeleton rows={2} avatar amount />
          </Cell>
        </div>
      </Card>

      {/* ===== StatTile ===== */}
      <Card title="StatTile" subtitle="đệm 12 16 · số 20/700 (điện thoại 16) · lưới 4 ô, nhỏ hơn 2×2" className="xt-wide" id="c2-stat">
        <Set name="Lưới 4" fill>
          <StatGrid label="Doanh thu tháng 10">
            <StatTile label="Doanh số" tip="Tổng giá trị hợp đồng có ngày sự kiện trong kỳ." value={formatVnd(48_600_000)} note="12 hợp đồng" />
            <StatTile label="Cọc phải thu" tip="Tổng tiền cọc theo tiến độ." value={formatVnd(14_000_000)} note={`còn thiếu ${formatVnd(2_000_000)}`} noteTone="warn" />
            <StatTile label="Đã thu thực tế" tip="Thu trừ hoàn, không tính phiếu đã huỷ." value={formatVnd(30_100_000)} />
            <StatTile label="Còn lại" tip="Doanh số trừ đã thu." value={formatVnd(18_500_000)} variant="highlight" />
          </StatGrid>
        </Set>
        <Set name="Trạng thái" fill>
          <StatTile label="Quá hạn (danger)" value="3" variant="danger" />
          <StatTile label="Đang tải" value="—" loading />
          <StatTile label="Lỗi" value="—" error="Không tải được số liệu" />
        </Set>
      </Card>

      {/* ===== PersonChip ===== */}
      <Card title="PersonChip" subtitle="Avatar 28 + tên 13/500, khe 6" id="c2-person">
        <Set name="Thường">
          <PersonChipList label="Thợ ở bậc Thợ chính">
            {PEOPLE.map((p) => (
              <PersonChip key={p.id} name={p.name} colorKey={p.id} />
            ))}
            <PersonChip name="Nguyễn Thu Hà (có ảnh)" avatarUrl={PHOTO} colorKey="m-thu-ha" />
          </PersonChipList>
        </Set>
        <Set name="Khoá">
          <PersonChip name="Phạm Bảo Vy" colorKey="m-bao-vy" disabled />
        </Set>
        <Set name="Trống">
          <span className="xt-faint">Chưa có thợ ở bậc này</span>
        </Set>
      </Card>

      {/* ===== ConfirmDialog ===== */}
      <Card title="ConfirmDialog" subtitle="Dialog 440 · ô lý do khi requireReason · nút đỏ" id="c2-confirm">
        <Set name="Mở thử">
          <Button variant="danger" onClick={() => setConfirm('huy')}>
            Huỷ phiếu PT-000087
          </Button>
          <Button onClick={() => setConfirm('bo')}>Bỏ thay đổi (không lý do)</Button>
          <Button variant="danger" onClick={() => setConfirm('khoa')}>
            Tạm khoá (460)
          </Button>
        </Set>
        {lastReason !== null && <p className="xt-out">Lần xác nhận gần nhất — lý do: “{lastReason || '(trống)'}”</p>}
        <Set name="Nút danger">
          <Cell cap="Mặc định">
            <Button variant="danger">Huỷ phiếu</Button>
          </Cell>
          <Cell cap="Rê chuột">
            <Button variant="danger" data-demo="hover">
              Huỷ phiếu
            </Button>
          </Cell>
          <Cell cap="Tiêu điểm">
            <Button variant="danger" data-demo="focus">
              Huỷ phiếu
            </Button>
          </Cell>
          <Cell cap="Khoá">
            <Button variant="danger" disabled>
              Huỷ phiếu
            </Button>
          </Cell>
          <Cell cap="Đang chạy">
            <Button variant="danger" loading>
              Huỷ phiếu
            </Button>
          </Cell>
        </Set>
      </Card>

      {/* ===== ImageUpload ===== */}
      <Card
        title="ImageUpload"
        subtitle="vuông / tròn / ngang · chọn tệp, xem trước, tiến độ, lỗi, bỏ ảnh"
        className="xt-wide"
        id="c2-image"
      >
        <Set name="Hồ sơ thương hiệu" fill>
          <div className="ui-img-row">
            <ImageUpload
              label="Logo"
              value={logo}
              maxBytes={2 * 1024 * 1024}
              changeLabel="Đổi"
              onUpload={(f, c) => fakeUpload(f, c, setLogo)}
            />
            <ImageUpload
              label="Ảnh đại diện"
              shape="round"
              value={avatar}
              maxBytes={15 * 1024 * 1024}
              changeLabel="Đổi"
              removeLabel="Bỏ"
              onUpload={(f, c) => fakeUpload(f, c, setAvatar)}
              onRemove={() => setAvatar(null)}
            />
            <ImageUpload
              label="Ảnh bìa"
              shape="wide"
              value={cover}
              maxBytes={15 * 1024 * 1024}
              changeLabel="Đổi"
              removeLabel="Bỏ"
              onUpload={(f, c) => fakeUpload(f, c, setCover)}
              onRemove={() => setCover(null)}
            />
          </div>
        </Set>
        <Set name="Hồ sơ thợ" fill>
          <ImageUpload
            layout="inline"
            shape="round"
            size={72}
            label="Ảnh đại diện"
            value={staffPhoto}
            hint="Ảnh JPG, PNG hoặc WebP, tối đa 5 MB. Tệp tên có “loi” sẽ giả lỗi máy chủ."
            onUpload={(f, c) => fakeUpload(f, c, setStaffPhoto)}
            onRemove={() => setStaffPhoto(null)}
          >
            <span>
              <b className="xt-b">Nguyễn Thu Hà</b>
              <span className="xt-out xt-block">Tên tài khoản: Nguyễn Thị Thu Hà</span>
            </span>
          </ImageUpload>
        </Set>
        <Set name="Trạng thái">
          <div className="xt-cell">
            <ImageUpload label="Trống" value={null} onUpload={async () => {}} />
          </div>
          <div className="xt-cell">
            <ImageUpload label="Rê chuột" value={null} onUpload={async () => {}} demo={{ hover: true }} />
          </div>
          <div className="xt-cell">
            <ImageUpload label="Tiêu điểm" value={null} onUpload={async () => {}} demo={{ focus: true }} />
          </div>
          <div className="xt-cell">
            <ImageUpload label="Đang tải" shape="round" value={PHOTO} onUpload={async () => {}} onRemove={() => {}} demo={{ busy: true, progress: 0.4 }} />
          </div>
          <div className="xt-cell">
            <ImageUpload label="Lỗi" value={null} onUpload={async () => {}} error="Ảnh 3 MB — vượt quá 2 MB." />
          </div>
          <div className="xt-cell">
            <ImageUpload label="Khoá" value={LOGO} onUpload={async () => {}} onRemove={() => {}} disabled />
          </div>
        </Set>
      </Card>

      <ConfirmDialog
        open={confirm === 'huy'}
        onClose={() => setConfirm(null)}
        title="Huỷ phiếu PT-000087?"
        message="Phiếu không bị xoá: vẫn hiện trong sổ thu, gạch ngang, kèm lý do. Chỉ huỷ được một lần."
        confirmLabel="Huỷ phiếu"
        cancelLabel="Giữ phiếu"
        danger
        requireReason
        reasonLabel="Lý do huỷ"
        reasonPlaceholder="Ví dụ: ghi nhầm hợp đồng"
        onConfirm={(r) =>
          new Promise<void>((res) =>
            setTimeout(() => {
              setLastReason(r);
              setConfirm(null);
              res();
            }, 800),
          )
        }
      />
      <ConfirmDialog
        open={confirm === 'bo'}
        onClose={() => setConfirm(null)}
        title="Bỏ thay đổi tiền công của Cô dâu – Ngày cưới?"
        confirmLabel="Bỏ thay đổi"
        cancelLabel="Ở lại"
        onConfirm={(r) => {
          setLastReason(r);
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm === 'khoa'}
        onClose={() => setConfirm(null)}
        width={460}
        title="Tạm khoá Studio Chiến?"
        message="Mọi thành viên không vào được tổ chức; trang giới thiệu công khai tắt. Dữ liệu giữ nguyên, mở khoá lúc nào cũng được."
        confirmLabel="Tạm khoá"
        danger
        requireReason
        onConfirm={() => Promise.reject(new Error('Không kết nối được máy chủ. Vui lòng kiểm tra mạng rồi thử lại.'))}
      />
    </div>
  );
}
