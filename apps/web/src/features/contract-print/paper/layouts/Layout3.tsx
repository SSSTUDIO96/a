import { formatLocalDate } from '@makeup/shared';
import type { ReactNode } from 'react';
import { installmentState, capitalize, methodLabel, receiptAmount, type PaperModel } from '../model';
import { Bien, Draft, Logo, detailLines, partyA, partyB, RowName, sourceText, studioContacts, vnd, Lines } from '../parts';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const;

// MẪU 3 — BẢNG KẺ ĐẦY ĐỦ: mọi phần trong bảng có kẻ, nhiều cột; đầu bảng lặp khi sang trang, dòng tổng KHÔNG lặp.
export function Layout3({ m }: { m: PaperModel }) {
  const { on, data, config } = m;
  const c = studioContacts(m);
  let sec = 0;
  const H = (t: ReactNode) => (
    <h2 className="hdin-h">
      {ROMAN[++sec]}. {t}
    </h2>
  );
  const a = partyA(m);
  const b = partyB(m);
  const n = Math.max(a.length, b.length);
  const pay = m.payments;
  const contacts = [c.address, c.phoneText, c.email, c.website].filter((x): x is string => !!x);
  return (
    <>
      {on('dau-trang') && (
        <table className="hdin-khung hdin-dt">
          <tbody>
            <tr>
              <td className="hdin-lo">
                <Logo m={m} />
              </td>
              <td>
                <b>{m.brand}</b>
                {contacts.map((t, i) => (
                  <span key={i}>
                    <br />
                    {t}
                  </span>
                ))}
              </td>
              <td className="hdin-so-o">
                <small>SỐ HỢP ĐỒNG</small>
                <b>{data.contract.code}</b>
                {m.draft && <Draft />}
                <small>{capitalize(m.issuedLong)}</small>
              </td>
            </tr>
          </tbody>
        </table>
      )}
      {on('quoc-hieu') && (
        <div className="hdin-qh">
          <b>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</b>
          <span>Độc lập – Tự do – Hạnh phúc</span>
        </div>
      )}
      <h1 className="hdin-td">{config.title}</h1>
      {on('hai-ben') && (
        <table className="hdin-khung hdin-ben">
          <thead>
            <tr>
              <th colSpan={2}>{m.labelA}</th>
              <th colSpan={2}>{m.labelB}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: n }, (_, i) => (
              <tr key={i}>
                <td className="hdin-nh">{a[i]?.[0]}</td>
                <td>{a[i]?.[1]}</td>
                <td className="hdin-nh">{b[i]?.[0]}</td>
                <td>{b[i]?.[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {on('chu-dau') && (
        <p className="hdin-mo">
          <Bien text={config.openingText} m={m} />
        </p>
      )}
      {H(m.sv ? 'BẢNG DỊCH VỤ' : 'BẢNG KHOÁ HỌC')}
      <table className="hdin-khung hdin-sv">
        <thead>
          <tr>
            <th className="hdin-c">STT</th>
            <th>Hạng mục</th>
            <th>{m.sv ? 'Thời gian · địa điểm · thợ' : 'Lớp · lịch học · giảng viên'}</th>
            <th className="hdin-c">SL</th>
            <th className="hdin-r">Đơn giá</th>
            <th className="hdin-r">Giảm</th>
            <th className="hdin-r">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {m.rows.map((r, i) => {
            const ct = detailLines(r, false);
            return (
              <tr key={i} className={`hdin-cap${r.cap}`}>
                <td className="hdin-c">{r.stt}</td>
                <td>
                  <RowName r={r} />
                </td>
                <td className="hdin-ct">{ct.length ? <Lines items={ct} /> : '—'}</td>
                <td className="hdin-c">{r.sl}</td>
                <td className="hdin-r">{vnd(r.dg)}</td>
                <td className="hdin-r">{r.giam > 0 ? vnd(r.giam) : '—'}</td>
                <td className="hdin-r">{vnd(r.tt)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {m.totals.map((t) => (
            <tr key={t.label} className={t.strong ? 'hdin-dong-tong' : ''}>
              <td colSpan={6} className="hdin-r">
                {t.label}
              </td>
              <td className="hdin-r">{t.value}</td>
            </tr>
          ))}
          {m.words && (
            <tr>
              <td colSpan={7} className="hdin-bc">
                Bằng chữ: {m.words}
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={6} className="hdin-r">
              Tiền cọc phải thu
            </td>
            <td className="hdin-r">{m.deposit}</td>
          </tr>
        </tfoot>
      </table>
      {m.installments.length > 0 && pay && (
        <>
          {H('TIẾN ĐỘ THANH TOÁN')}
          <table className="hdin-khung">
            <thead>
              <tr>
                <th className="hdin-c">STT</th>
                <th>Đợt</th>
                <th>Hạn thanh toán</th>
                <th className="hdin-r">Số tiền</th>
                <th className="hdin-r">Đã thu</th>
                <th>Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {m.installments.map((i, k) => (
                <tr key={k}>
                  <td className="hdin-c">{k + 1}</td>
                  <td>
                    {i.name}
                    {i.isDeposit ? ' (cọc)' : ''}
                  </td>
                  <td>{formatLocalDate(i.dueDate)}</td>
                  <td className="hdin-r">{vnd(i.amount)}</td>
                  <td className="hdin-r">{i.state === 'UNPAID' ? '—' : vnd(i.paid)}</td>
                  <td>{i.state === 'PARTIAL' ? 'Thu một phần' : installmentState(i)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="hdin-r">
                  Tổng hợp đồng
                </td>
                <td className="hdin-r">{vnd(data.money.total)}</td>
                <td className="hdin-r">{vnd(pay.paid)}</td>
                <td>Còn {vnd(pay.remaining)}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
      {m.receipts.length > 0 && pay && (
        <>
          {H('PHIẾU THU ĐÃ NHẬN')}
          <table className="hdin-khung">
            <thead>
              <tr>
                <th>Số phiếu</th>
                <th>Ngày thu</th>
                <th>Hình thức</th>
                <th className="hdin-r">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {m.receipts.map((r) => (
                <tr key={r.code}>
                  <td>{r.code}</td>
                  <td>{formatLocalDate(r.receivedOn)}</td>
                  <td>{methodLabel(r)}</td>
                  <td className="hdin-r">{receiptAmount(r)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="hdin-r">
                  Còn phải thanh toán
                </td>
                <td className="hdin-r">{vnd(pay.remaining)}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
      {m.bank && (
        <table className="hdin-khung hdin-ck">
          <tbody>
            <tr>
              <td className="hdin-nh">Chuyển khoản</td>
              <td>
                {m.bank.bankName} · STK <b>{m.bank.accountNumber}</b> · Chủ TK {m.bank.accountName}
              </td>
            </tr>
            <tr>
              <td className="hdin-nh">Nội dung CK</td>
              <td>{m.bank.note}</td>
            </tr>
          </tbody>
        </table>
      )}
      {m.terms && (
        <>
          <h2 className="hdin-h">
            {ROMAN[++sec]}. ĐIỀU KHOẢN {sourceText(m.terms) && <small>({sourceText(m.terms)})</small>}
          </h2>
          <div>
            <table className="hdin-khung hdin-dkb">
              <thead>
                <tr>
                  <th className="hdin-c">Điều</th>
                  <th>Nội dung</th>
                </tr>
              </thead>
              <tbody>
                {m.terms.items.map((x, i) => (
                  <tr key={i}>
                    <td className="hdin-c">{i + 1}</td>
                    <td>{x}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {m.rules && (
        <>
          <h2 className="hdin-h">
            {ROMAN[++sec]}. NỘI QUY LỚP HỌC {sourceText(m.rules) && <small>({sourceText(m.rules)})</small>}
          </h2>
          <div>
            <table className="hdin-khung hdin-dkb">
              <thead>
                <tr>
                  <th className="hdin-c">STT</th>
                  <th>Nội dung</th>
                </tr>
              </thead>
              <tbody>
                {m.rules.items.map((x, i) => (
                  <tr key={i}>
                    <td className="hdin-c">{i + 1}</td>
                    <td>{x}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {m.notes && (
        <table className="hdin-khung">
          <tbody>
            <tr>
              <td className="hdin-nh">Ghi chú</td>
              <td>{m.notes}</td>
            </tr>
          </tbody>
        </table>
      )}
      {on('chu-cuoi') && (
        <p className="hdin-cuoi">
          <Bien text={config.closingText} m={m} />
        </p>
      )}
      <table className="hdin-khung hdin-ky">
        <thead>
          <tr>
            <th>{m.labelA}</th>
            <th>{m.labelB}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <i>(Ký, ghi rõ họ tên)</i>
              <span />
              {m.signA}
            </td>
            <td>
              <i>(Ký, ghi rõ họ tên)</i>
              <span />
              {m.signB}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
