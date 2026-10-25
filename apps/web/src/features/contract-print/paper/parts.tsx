import { Fragment, useState, type ReactNode } from 'react';
import { PRINT_BLANK, fillVariables, formatLocalDate, formatVnd, type PrintText } from '@makeup/shared';
import { installmentState, methodLabel, receiptAmount, type PaperModel } from './model';
import type { PrintRow } from './rows';

// Mảnh dùng chung của 5 bố cục. Mọi chữ đi vào cây React dưới dạng CHỮ THƯỜNG (không dangerouslySetInnerHTML — L10).

export const vnd = formatVnd;

/** Chỗ để trống cho người điền tay (CCCD, địa chỉ khách chưa có dữ liệu — ký duyệt G #1). */
export function Blank({ long }: { long?: boolean }) {
  return <span className="hdin-cho-dien">{long ? '………………………………' : '………………………'}</span>;
}

/** Chữ có biến {…}: giá trị thay vào thành chữ thường, biến lạ giữ nguyên "{…}". */
export function Bien({ text, m }: { text: string; m: PaperModel }) {
  return (
    <>
      {fillVariables(text, m.vars).map((seg, i) =>
        'variable' in seg ? (
          <span key={i} className="hdin-bien">
            {seg.value}
          </span>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}

export function Logo({ m, cls }: { m: PaperModel; cls?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!m.logoUrl || failedUrl === m.logoUrl) return null;
  return <img className={cls ? `hdin-lg ${cls}` : 'hdin-lg'} src={m.logoUrl} alt={`Logo ${m.brand}`} onError={() => setFailedUrl(m.logoUrl)} />;
}

export function Draft() {
  return <span className="hdin-nhap">BẢN NHÁP</span>;
}

export function Lines({ items }: { items: readonly string[] }) {
  return (
    <>
      {items.map((t, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {t}
        </Fragment>
      ))}
    </>
  );
}

/** Tên dòng + "phát sinh dd/mm". */
export function RowName({ r }: { r: PrintRow }) {
  return (
    <>
      {r.cap === 1 ? '+ ' : ''}
      {r.ten}
      {r.phatSinh && <small className="hdin-ps"> ({r.phatSinh})</small>}
    </>
  );
}

/** Giảm giá của dòng, cho bố cục không có cột "Giảm". */
export function discountNote(r: PrintRow): string | null {
  return r.giam > 0 ? `Giảm ${vnd(r.giam)}` : null;
}

export function detailLines(r: PrintRow, withDiscount = true): string[] {
  const d = withDiscount ? discountNote(r) : null;
  return d ? [...r.chiTiet, d] : r.chiTiet;
}

/** Địa chỉ, điện thoại, email, website của studio (bỏ trường trống). */
export function studioContacts(m: PaperModel): { address: string | null; phoneText: string | null; email: string | null; website: string | null } {
  const s = m.data.studio;
  return { address: s.address, phoneText: s.phone ? `ĐT: ${s.phone}` : null, email: s.email, website: s.website };
}

export function repText(m: PaperModel): string | null {
  const r = m.data.studio.representative;
  return r ? (r.title ? `${r.name} — ${r.title}` : r.name) : null;
}

type PartyRow = [label: string, value: ReactNode];

/** Bên A: [Tên, Địa chỉ, Điện thoại, Đại diện]. Thiếu thì để dòng chấm điền tay. */
export function partyA(m: PaperModel): PartyRow[] {
  const s = m.data.studio;
  return [
    ['Tên', s.name],
    ['Địa chỉ', s.address ?? <Blank key="a" long />],
    ['Điện thoại', s.phone ?? <Blank key="p" />],
    ['Đại diện', repText(m) ?? <Blank key="r" />],
  ];
}

/** Bên B: [Khách hàng|Học viên, Điện thoại, (Email), (Địa chỉ, CCCD khi bật giay-to)]. Bị che → "……". */
export function partyB(m: PaperModel): PartyRow[] {
  const c = m.data.customer;
  const rows: PartyRow[] = [
    [m.sv ? 'Khách hàng' : 'Học viên', c.fullName],
    ['Điện thoại', c.contactHidden ? PRINT_BLANK : (c.phone ?? PRINT_BLANK)],
  ];
  if (c.contactHidden) rows.push(['Email', PRINT_BLANK]);
  else if (c.email) rows.push(['Email', c.email]);
  if (m.on('giay-to')) {
    rows.push(['Địa chỉ', <Blank key="d" long />]);
    rows.push(['CCCD', <Blank key="c" />]);
  }
  return rows;
}

export function TermsList({ items, cls = 'hdin-dk' }: { items: readonly string[]; cls?: string }) {
  return (
    <ol className={cls}>
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ol>
  );
}

export function sourceText(t: PrintText): string | null {
  return t.source ? `${t.source.name} · bản v${t.source.version}` : null;
}

export function receiptDate(r: { receivedOn: string }): string {
  return formatLocalDate(r.receivedOn);
}

export { installmentState, methodLabel, receiptAmount };
