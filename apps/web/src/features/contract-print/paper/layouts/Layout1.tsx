import { formatLocalDate } from '@makeup/shared';
import { Fragment, type ReactNode } from 'react';
import { installmentState, methodLabel, receiptAmount, type PaperModel } from '../model';
import { Bien, Blank, Draft, Logo, TermsList, detailLines, partyA, partyB, RowName, sourceText, studioContacts, vnd, Lines } from '../parts';

// MẪU 1 — CỔ ĐIỂN TRANG TRỌNG: quốc hiệu, chữ có chân, "Điều 1, 2…", bảng kẻ mảnh (R&D ban-in.js mau1()).
export function Layout1({ m }: { m: PaperModel }) {
  const { on, data, config } = m;
  const c = studioContacts(m);
  let dieu = 0;
  const D = (t: ReactNode) => (
    <h2 className="hdin-dieu">
      Điều {++dieu}. {t}
    </h2>
  );
  const rowsA = partyA(m).slice(1);
  const rowsB = partyB(m).slice(1);
  const pay = m.payments;
  return (
    <>
      {(on('dau-trang') || on('quoc-hieu')) && (
        <div className="hdin-dau">
          {on('dau-trang') && (
            <div className="hdin-dt">
              <Logo m={m} />
              <div>
                <b>{m.brand}</b>
                {c.address && <small>{c.address}</small>}
                {c.phoneText && <small>{c.phoneText}</small>}
              </div>
            </div>
          )}
          {on('quoc-hieu') && (
            <div className="hdin-qh">
              <b>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</b>
              <span>Độc lập – Tự do – Hạnh phúc</span>
              <i />
            </div>
          )}
        </div>
      )}
      <h1 className="hdin-td">{config.title}</h1>
      <p className="hdin-so">
        Số: {data.contract.code}
        {m.draft && <> <Draft /></>}
      </p>
      {on('hai-ben') && (
        <>
          <p className="hdin-mo">
            Hôm nay, {m.issuedLong}, tại {data.studio.address ?? <Blank long />}, chúng tôi gồm:
          </p>
          <div className="hdin-hai-ben">
            <div className="hdin-ben">
              <h3>
                BÊN A (Bên {m.sv ? 'cung cấp dịch vụ' : 'đào tạo'}): {m.brand}
              </h3>
              <dl>
                {rowsA.map(([a, b]) => (
                  <Fragment key={a}>
                    <dt>{a}:</dt>
                    <dd>{b}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
            <div className="hdin-ben">
              <h3>
                BÊN B ({m.sv ? 'Khách hàng' : 'Học viên'}): {data.customer.fullName.toUpperCase()}
              </h3>
              <dl>
                {rowsB.map(([a, b]) => (
                  <Fragment key={a}>
                    <dt>{a}:</dt>
                    <dd>{b}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
          </div>
        </>
      )}
      {on('chu-dau') && (
        <p className="hdin-mo">
          <Bien text={config.openingText} m={m} />
        </p>
      )}
      {D(m.sv ? 'Nội dung dịch vụ' : 'Nội dung đào tạo')}
      <table className="hdin-bang">
        <thead>
          <tr>
            <th className="hdin-c">STT</th>
            <th>{m.sv ? 'Dịch vụ' : 'Khoá học / hạng mục'}</th>
            <th className="hdin-c">SL</th>
            <th className="hdin-r">Đơn giá</th>
            <th className="hdin-r">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {m.rows.map((r, i) => {
            const ct = detailLines(r);
            return (
              <tr key={i} className={`hdin-cap${r.cap}`}>
                <td className="hdin-c">{r.stt}</td>
                <td>
                  <RowName r={r} />
                  {ct.length > 0 && (
                    <div className="hdin-ct">
                      <Lines items={ct} />
                    </div>
                  )}
                </td>
                <td className="hdin-c">{r.sl}</td>
                <td className="hdin-r">{vnd(r.dg)}</td>
                <td className="hdin-r">{vnd(r.tt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {D('Giá trị hợp đồng và thanh toán')}
      <table className="hdin-bang-tong">
        <tbody>
          {m.totals.map((t) => (
            <tr key={t.label} className={t.strong ? 'hdin-dong-tong' : ''}>
              <td>{t.label}</td>
              <td className="hdin-r">{t.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        {m.words && <span className="hdin-bc">Bằng chữ: {m.words}. </span>}
        Tiền cọc phải thu: {m.deposit}.
      </p>
      {m.installments.length > 0 && (
        <>
          <h3 className="hdin-tieu">Tiến độ thanh toán</h3>
          <table className="hdin-bang hdin-nho">
            <thead>
              <tr>
                <th>Đợt</th>
                <th>Hạn</th>
                <th className="hdin-r">Số tiền</th>
                <th>Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {m.installments.map((i, n) => (
                <tr key={n}>
                  <td>
                    {n + 1}. {i.name}
                    {i.isDeposit && <small> (cọc)</small>}
                  </td>
                  <td>{formatLocalDate(i.dueDate)}</td>
                  <td className="hdin-r">{vnd(i.amount)}</td>
                  <td>{installmentState(i)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {m.receipts.length > 0 && pay && (
        <>
          <h3 className="hdin-tieu">Các khoản đã thanh toán</h3>
          <table className="hdin-bang hdin-nho">
            <thead>
              <tr>
                <th>Phiếu thu</th>
                <th>Ngày</th>
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
          </table>
          <div className="hdin-dong-tien">
            <span>Đã thu</span>
            <span>{vnd(pay.paid)}</span>
          </div>
          <div className="hdin-dong-tien hdin-dam">
            <span>Còn phải thanh toán</span>
            <span>{vnd(pay.remaining)}</span>
          </div>
        </>
      )}
      {m.bank && (
        <p className="hdin-ck">
          Chuyển khoản: {m.bank.bankName} · Số TK {m.bank.accountNumber} · Chủ TK {m.bank.accountName} · Nội dung: {m.bank.note}
        </p>
      )}
      {m.terms && (
        <>
          {D(
            <>
              Điều khoản
              {sourceText(m.terms) && <small className="hdin-nguon"> ({sourceText(m.terms)})</small>}
            </>,
          )}
          <div>
            <TermsList items={m.terms.items} />
          </div>
        </>
      )}
      {m.rules && (
        <>
          {D(
            <>
              Nội quy lớp học
              {sourceText(m.rules) && <small className="hdin-nguon"> ({sourceText(m.rules)})</small>}
            </>,
          )}
          <div>
            <TermsList items={m.rules.items} cls="hdin-dk hdin-nq" />
          </div>
        </>
      )}
      {m.notes && (
        <>
          {D('Thoả thuận khác')}
          <p>{m.notes}</p>
        </>
      )}
      {on('chu-cuoi') && (
        <>
          {D('Hiệu lực hợp đồng')}
          <p>
            <Bien text={config.closingText} m={m} />
          </p>
        </>
      )}
      <div className="hdin-ky">
        <div>
          <b>ĐẠI DIỆN BÊN A</b>
          <i>(Ký, ghi rõ họ tên)</i>
          <span>{m.signA}</span>
        </div>
        <div>
          <b>BÊN B</b>
          <i>(Ký, ghi rõ họ tên)</i>
          <span>{m.signB}</span>
        </div>
      </div>
    </>
  );
}
