import { formatLocalDate } from '@makeup/shared';
import { installmentState, methodLabel, receiptAmount, type PaperModel } from '../model';
import { Bien, Draft, Logo, TermsList, detailLines, partyA, partyB, RowName, sourceText, studioContacts, vnd, Lines } from '../parts';

function Ornament() {
  return (
    <div className="hdin-hv" aria-hidden="true">
      <i />
      <b />
      <i />
    </div>
  );
}

// MẪU 5 — SANG TRỌNG VIỀN & LOGO LỚN: khung viền kép lặp mọi trang in, logo to giữa đầu trang, hoa văn ngăn mục.
// `.hdin-khung-trang` là phần tử fixed DUY NHẤT được phép (L6): rỗng, aria-hidden, chỉ hiện khi in.
export function Layout5({ m }: { m: PaperModel }) {
  const { on, data, config } = m;
  const c = studioContacts(m);
  const pay = m.payments;
  const contacts = [c.address, c.phoneText, c.email, c.website].filter((x): x is string => !!x).join(' · ');
  const tong = [...m.totals, { label: 'Tiền cọc', value: m.deposit, strong: false }];
  const extra = pay && m.receipts.length ? [{ label: 'Đã thanh toán', value: vnd(pay.paid), dam: false }, { label: 'Còn phải thanh toán', value: vnd(pay.remaining), dam: true }] : [];
  return (
    <>
      <div className="hdin-khung-trang" aria-hidden="true" />
      {on('dau-trang') && (
        <header className="hdin-dt">
          <Logo m={m} />
          <b className="hdin-ten">{m.brand}</b>
          {data.studio.tagline && <small>{data.studio.tagline}</small>}
          {contacts && <small className="hdin-lh">{contacts}</small>}
        </header>
      )}
      <Ornament />
      <h1 className="hdin-td">{config.title}</h1>
      <p className="hdin-so">
        Số {data.contract.code}
        {m.draft && <> <Draft /></>} · Ngày {m.issuedLong.replace(/^ngày /, '')}
      </p>
      {on('hai-ben') && (
        <div className="hdin-ben">
          <section>
            <small>{m.labelA}</small>
            <b>{m.brand}</b>
            {partyA(m)
              .slice(1)
              .map(([a, b]) => (
                <p key={a}>
                  {a}: {b}
                </p>
              ))}
          </section>
          <section>
            <small>{m.labelB}</small>
            <b>{data.customer.fullName}</b>
            {partyB(m)
              .slice(1)
              .map(([a, b]) => (
                <p key={a}>
                  {a}: {b}
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
      <Ornament />
      <h2 className="hdin-h">{m.sv ? 'Dịch vụ' : 'Khoá học'}</h2>
      <table className="hdin-sv">
        <tbody>
          {m.rows.map((r, i) => {
            const ct = detailLines(r);
            return (
              <tr key={i} className={`hdin-cap${r.cap}`}>
                <td>
                  <RowName r={r} />
                  {ct.length > 0 && (
                    <small>
                      <Lines items={ct} />
                    </small>
                  )}
                </td>
                <td className="hdin-c">{r.sl > 1 ? `${r.sl} × ${vnd(r.dg)}` : ''}</td>
                <td className="hdin-r">{vnd(r.tt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="hdin-tien2">
        {m.installments.length > 0 ? (
          <section>
            <h2 className="hdin-h hdin-nho">Tiến độ thanh toán</h2>
            <table className="hdin-sv hdin-dot">
              <tbody>
                {m.installments.map((i, n) => (
                  <tr key={n}>
                    <td>
                      {i.name}
                      <small>
                        Hạn {formatLocalDate(i.dueDate)} · {installmentState(i)}
                      </small>
                    </td>
                    <td className="hdin-r">{vnd(i.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section />
        )}
        <div className="hdin-khoi-tong">
          {tong.map((t) => (
            <p key={t.label} className={t.strong ? 'hdin-dong-tong' : ''}>
              <span>{t.label}</span>
              {t.value}
            </p>
          ))}
          {extra.map((t) => (
            <p key={t.label} className={t.dam ? 'hdin-dam' : ''}>
              <span>{t.label}</span>
              {t.value}
            </p>
          ))}
          {m.words && <p className="hdin-bc">{m.words}</p>}
        </div>
      </div>
      {m.receipts.length > 0 && (
        <div className="hdin-thu">
          {m.receipts.map((r) => (
            <p key={r.code}>
              Phiếu thu {r.code} · {formatLocalDate(r.receivedOn)} · {methodLabel(r).toLowerCase()} · {receiptAmount(r)}
            </p>
          ))}
        </div>
      )}
      {m.bank && (
        <p className="hdin-ck">
          {m.bank.bankName} · {m.bank.accountNumber} · {m.bank.accountName} · Nội dung “{m.bank.note}”
        </p>
      )}
      {m.terms && (
        <>
          <Ornament />
          <h2 className="hdin-h">
            Điều khoản {sourceText(m.terms) && <small className="hdin-nguon">{sourceText(m.terms)}</small>}
          </h2>
          <div>
            <TermsList items={m.terms.items} />
          </div>
        </>
      )}
      {m.rules && (
        <>
          <h2 className="hdin-h hdin-nho">
            Nội quy lớp học {sourceText(m.rules) && <small className="hdin-nguon">{sourceText(m.rules)}</small>}
          </h2>
          <div>
            <TermsList items={m.rules.items} cls="hdin-dk hdin-nq" />
          </div>
        </>
      )}
      {m.notes && (
        <p className="hdin-gc">
          <i>Ghi chú:</i> {m.notes}
        </p>
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
