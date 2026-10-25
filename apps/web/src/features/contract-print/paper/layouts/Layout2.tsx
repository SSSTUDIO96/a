import { formatLocalDate } from '@makeup/shared';
import type { ReactNode } from 'react';
import { installmentState, methodLabel, receiptAmount, type PaperModel } from '../model';
import { Bien, Draft, Logo, TermsList, detailLines, partyA, partyB, RowName, sourceText, studioContacts, vnd, Lines } from '../parts';
import { weekdayName } from '../rows';

// MẪU 2 — HIỆN ĐẠI TỐI GIẢN: chữ không chân (Be Vietnam Pro), danh sách thay bảng kẻ, màu nhấn, khung tổng bên phải.
export function Layout2({ m }: { m: PaperModel }) {
  const { on, data, config } = m;
  const c = studioContacts(m);
  const sentence = config.title === config.title.toUpperCase() ? config.title.charAt(0) + config.title.slice(1).toLowerCase() : config.title;
  const meta: [string, ReactNode][] = [
    [
      'Số hợp đồng',
      <>
        {data.contract.code}
        {m.draft && <> <Draft /></>}
      </>,
    ],
    ['Ngày lập', m.issuedShort],
  ];
  if (data.contract.eventDate) meta.push(['Ngày sự kiện', `${weekdayName(data.contract.eventDate)}, ${formatLocalDate(data.contract.eventDate)}`]);
  if (m.course) meta.push(['Khai giảng', formatLocalDate(m.course.startDate)]);
  const contactLine2 = [c.phoneText, c.email, c.website].filter((x): x is string => !!x).join(' · ');
  const pay = m.payments;
  const showCol2 = (m.receipts.length > 0 && pay) || m.bank;
  return (
    <>
      {on('dau-trang') && (
        <header className="hdin-dt">
          <Logo m={m} />
          <div className="hdin-ten">
            <b>{m.brand}</b>
            {data.studio.tagline && <small>{data.studio.tagline}</small>}
          </div>
          <div className="hdin-lh">
            {c.address}
            {c.address && contactLine2 && <br />}
            {contactLine2}
          </div>
        </header>
      )}
      <div className="hdin-tdo">
        <h1 className="hdin-td">{sentence}</h1>
        <dl className="hdin-meta">
          {meta.map(([a, b]) => (
            <div key={a}>
              <dt>{a}</dt>
              <dd>{b}</dd>
            </div>
          ))}
        </dl>
      </div>
      {on('hai-ben') && (
        <div className="hdin-ben2">
          <section>
            <h3>{m.sv ? 'Studio · Bên A' : 'Trung tâm · Bên A'}</h3>
            {partyA(m).map(([a, b]) => (
              <p key={a}>
                <span>{a}</span>
                <span className="hdin-v">{b}</span>
              </p>
            ))}
          </section>
          <section>
            <h3>{m.sv ? 'Khách hàng · Bên B' : 'Học viên · Bên B'}</h3>
            {partyB(m).map(([a, b]) => (
              <p key={a}>
                <span>{a}</span>
                <span className="hdin-v">{b}</span>
              </p>
            ))}
          </section>
        </div>
      )}
      {on('chu-dau') && (
        <p className="hdin-mo">
          <Bien text={config.openingText} m={m} />
        </p>
      )}
      <h2 className="hdin-h">{m.sv ? 'Dịch vụ' : 'Khoá học'}</h2>
      <ul className="hdin-ds">
        {m.rows.map((r, i) => {
          const ct = detailLines(r);
          return (
            <li key={i} className={`hdin-cap${r.cap}`}>
              <div className="hdin-t">
                <b>
                  <RowName r={r} />
                </b>
                {ct.length > 0 && (
                  <small>
                    <Lines items={ct} />
                  </small>
                )}
              </div>
              <div className="hdin-sl">{r.sl > 1 || r.cap === 0 ? `${r.sl} × ${vnd(r.dg)}` : ''}</div>
              <div className="hdin-r">{vnd(r.tt)}</div>
            </li>
          );
        })}
      </ul>
      <div className="hdin-khoi-tong">
        <div className="hdin-bc">
          {m.words && (
            <>
              <span>Bằng chữ</span>
              {m.words}
            </>
          )}
        </div>
        <table>
          <tbody>
            {m.totals.map((t) => (
              <tr key={t.label} className={t.strong ? 'hdin-dong-tong' : ''}>
                <td>{t.label}</td>
                <td className="hdin-r">{t.value}</td>
              </tr>
            ))}
            <tr>
              <td>Cọc phải thu</td>
              <td className="hdin-r">{m.deposit}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {(m.installments.length > 0 || showCol2) && (
        <div className="hdin-hai-cot">
          {m.installments.length > 0 ? (
            <section>
              <h2 className="hdin-h">Tiến độ thanh toán</h2>
              <ol className="hdin-moc">
                {m.installments.map((i, n) => (
                  <li key={n} className={i.state === 'PAID' ? 'hdin-xong' : ''}>
                    <b>{i.name}</b>
                    <span>
                      Hạn {formatLocalDate(i.dueDate)} · {installmentState(i)}
                    </span>
                    <em>{vnd(i.amount)}</em>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <section />
          )}
          <section>
            {m.receipts.length > 0 && pay && (
              <>
                <h2 className="hdin-h">Đã thanh toán</h2>
                <ul className="hdin-thu">
                  {m.receipts.map((r) => (
                    <li key={r.code}>
                      <span>
                        {r.code} · {formatLocalDate(r.receivedOn)} · {methodLabel(r)}
                      </span>
                      <b>{receiptAmount(r)}</b>
                    </li>
                  ))}
                </ul>
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
              <>
                <h2 className="hdin-h">Chuyển khoản</h2>
                <div className="hdin-ck">
                  <p>{m.bank.bankName}</p>
                  <p>
                    STK <b>{m.bank.accountNumber}</b>
                  </p>
                  <p>{m.bank.accountName}</p>
                  <p>
                    Nội dung: <b>{m.bank.note}</b>
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {m.terms && (
        <>
          <h2 className="hdin-h">
            Điều khoản {sourceText(m.terms) && <small>{sourceText(m.terms)}</small>}
          </h2>
          <TermsList items={m.terms.items} />
        </>
      )}
      {m.rules && (
        <>
          <h2 className="hdin-h">
            Nội quy lớp học {sourceText(m.rules) && <small>{sourceText(m.rules)}</small>}
          </h2>
          <TermsList items={m.rules.items} cls="hdin-dk hdin-nq" />
        </>
      )}
      {m.notes && (
        <>
          <h2 className="hdin-h">Ghi chú</h2>
          <p>{m.notes}</p>
        </>
      )}
      {on('chu-cuoi') && (
        <p className="hdin-cuoi">
          <Bien text={config.closingText} m={m} />
        </p>
      )}
      <div className="hdin-ky">
        <div>
          <small>{m.labelA}</small>
          <span />
          <b>{m.signA}</b>
        </div>
        <div>
          <small>{m.labelB}</small>
          <span />
          <b>{m.signB}</b>
        </div>
      </div>
    </>
  );
}
