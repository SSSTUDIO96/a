import { formatLocalDate } from '@makeup/shared';
import { Fragment } from 'react';
import { installmentState, methodLabel, receiptAmount, type PaperModel } from '../model';
import { Bien, Draft, Logo, TermsList, detailLines, partyB, RowName, sourceText, studioContacts, vnd } from '../parts';

// MẪU 4 — GỌN MỘT TRANG: chữ nhỏ, hai bên chung một hàng, tiền + tiến độ + đã thu trong một dải, điều khoản 2 cột.
export function Layout4({ m }: { m: PaperModel }) {
  const { on, data, config } = m;
  const c = studioContacts(m);
  const rep = data.studio.representative?.name;
  const pay = m.payments;
  const partyBRows = partyB(m);
  const head = [c.address, c.phoneText].filter((x): x is string => !!x).join(' · ');
  return (
    <>
      <header className="hdin-dt">
        {on('dau-trang') && (
          <>
            <Logo m={m} />
            <div className="hdin-ten">
              <b>{m.brand}</b>
              {head && <small>{head}</small>}
            </div>
          </>
        )}
        <div className="hdin-tdo">
          <h1 className="hdin-td">{config.title}</h1>
          <small>
            Số {data.contract.code}
            {m.draft && <> <Draft /></>} · Ngày {m.issuedLong.replace(/^ngày /, '')}
          </small>
        </div>
      </header>
      {on('hai-ben') && (
        <div className="hdin-ben">
          <p>
            <b>Bên A:</b> {m.brand}
            {rep ? ` — ${rep}` : ''}
            {data.studio.phone ? ` · ${data.studio.phone}` : ''}
          </p>
          <p>
            <b>Bên B:</b>{' '}
            {partyBRows.map(([a, b], i) => (
              <Fragment key={a}>
                {i > 0 && ' · '}
                {i === 0 ? '' : `${a.toLowerCase()} `}
                {b}
              </Fragment>
            ))}
          </p>
        </div>
      )}
      {on('chu-dau') && (
        <p className="hdin-mo">
          <Bien text={config.openingText} m={m} />
        </p>
      )}
      <table className="hdin-sv">
        <thead>
          <tr>
            <th>{m.sv ? 'Dịch vụ' : 'Khoá học'}</th>
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
                <td>
                  <RowName r={r} />
                  {ct.length > 0 && <span className="hdin-ct"> — {ct.join(' · ')}</span>}
                </td>
                <td className="hdin-c">{r.sl}</td>
                <td className="hdin-r">{vnd(r.dg)}</td>
                <td className="hdin-r">{vnd(r.tt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="hdin-hang-tien">
        <div className="hdin-khoi-tong">
          {m.totals.map((t) => (
            <span key={t.label} className={t.strong ? 'hdin-dong-tong' : ''}>
              {t.label} <b>{t.value}</b>
            </span>
          ))}
          <span>
            Cọc <b>{m.deposit}</b>
          </span>
          {m.words && <em>({m.words})</em>}
        </div>
        {m.installments.length > 0 && (
          <div className="hdin-dot">
            <b>Tiến độ:</b>{' '}
            {m.installments
              .map((i, n) => `${n + 1}) ${i.name} ${vnd(i.amount)} hạn ${formatLocalDate(i.dueDate)} — ${installmentState(i).toLowerCase()}`)
              .join('; ')}
            .
          </div>
        )}
        {(on('da-thu') && pay !== null) || m.bank ? (
          <div className="hdin-dot">
            {on('da-thu') && pay && (
              <>
                <b>Đã thu:</b>{' '}
                {m.receipts.length
                  ? m.receipts.map((r) => `${r.code} ${formatLocalDate(r.receivedOn)} ${methodLabel(r).toLowerCase()} ${receiptAmount(r)}`).join('; ')
                  : 'chưa có'}{' '}
                · <b>Còn lại: {vnd(pay.remaining)}</b>
              </>
            )}
            {m.bank && (
              <>
                {on('da-thu') && pay ? ' · ' : ''}CK: {m.bank.bankName} — {m.bank.accountNumber} — {m.bank.accountName} — ND: {m.bank.note}
              </>
            )}
          </div>
        ) : null}
      </div>
      {m.terms && (
        <>
          <h2 className="hdin-h">
            Điều khoản {sourceText(m.terms) && <small>{sourceText(m.terms)}</small>}
          </h2>
          <TermsList items={m.terms.items} cls="hdin-dk hdin-cot" />
        </>
      )}
      {m.rules && (
        <>
          <h2 className="hdin-h">
            Nội quy {sourceText(m.rules) && <small>{sourceText(m.rules)}</small>}
          </h2>
          <TermsList items={m.rules.items} cls="hdin-dk hdin-cot" />
        </>
      )}
      {m.notes && (
        <p className="hdin-gc">
          <b>Ghi chú:</b> {m.notes}
        </p>
      )}
      {on('chu-cuoi') && (
        <p className="hdin-cuoi">
          <Bien text={config.closingText} m={m} />
        </p>
      )}
      <div className="hdin-ky">
        <div>
          <b>{m.labelA}</b>
          <span />
          {m.signA}
        </div>
        <div>
          <b>{m.labelB}</b>
          <span />
          {m.signB}
        </div>
      </div>
    </>
  );
}
