import type { ReactNode } from 'react';
import type { PaymentInstallment, Vnd } from '../../api/types';
import { Button, Dialog, formatVnd } from '../../ui';
import { paragraphs } from './courseModel';

// Xem bản in hợp đồng khoá học (bản vẽ C3 mục 2.3 — #hop-dong-in): nội dung hợp đồng, học phí, giảm giá, tổng, cọc,
// tiến độ thanh toán, điều khoản, nội quy, chỗ ký. Mọi số tiền là số máy chủ trả; nháp chưa tính xong hiện "—".
// "In / Lưu PDF" dùng hộp in của trình duyệt (chọn "Lưu dưới dạng PDF").

export interface PrintLine {
  key: string;
  name: string;
  // Dòng phụ dưới tên (lớp: khai giảng, lịch học, giảng viên).
  detail?: string | null;
  amount: Vnd | null;
}

export interface PrintText {
  title: string;
  // "Điều khoản khoá học · bản v3"
  source: string | null;
  body: string;
}

export interface ContractPaperProps {
  orgName: string;
  title: string;
  code: string | null;
  dateText: string;
  customer: { fullName: string; phone: string | null } | null;
  lines: PrintLine[];
  subtotal: Vnd | null;
  discount: Vnd;
  total: Vnd | null;
  deposit: Vnd | null;
  installments: Pick<PaymentInstallment, 'id' | 'name' | 'dueDate' | 'amount' | 'isDeposit'>[] | null;
  texts: PrintText[];
  notes: string | null;
  fmtDate: (iso: string) => string;
}

const money = (v: Vnd | null) => (v === null ? '—' : formatVnd(v));

export function ContractPaper(p: ContractPaperProps) {
  return (
    <article className="ct-paper" aria-label="Bản in hợp đồng">
      <header className="ct-paper__top">
        <b>{p.orgName.toUpperCase()}</b>
      </header>
      <h2 className="ct-paper__t">{p.title}</h2>
      <p className="ct-paper__no">
        {p.code ? `Số ${p.code}` : 'Bản nháp chưa lưu'} · {p.dateText}
      </p>
      <p>
        <b>Học viên:</b> {p.customer ? `${p.customer.fullName}${p.customer.phone ? ` · ${p.customer.phone}` : ''}` : '—'}
      </p>
      <table className="ct-paper__tbl">
        <tbody>
          {p.lines.map((l) => (
            <tr key={l.key}>
              <td>
                {l.name}
                {l.detail && <span className="ct-paper__sub">{l.detail}</span>}
              </td>
              <td className="ct-paper__r">{money(l.amount)}</td>
            </tr>
          ))}
          {p.discount > 0 && (
            <tr>
              <td>Giảm giá</td>
              <td className="ct-paper__r">− {formatVnd(p.discount)}</td>
            </tr>
          )}
          <tr className="ct-paper__b">
            <td>Tổng</td>
            <td className="ct-paper__r">{money(p.total)}</td>
          </tr>
          <tr>
            <td>Cọc phải thu</td>
            <td className="ct-paper__r">{money(p.deposit)}</td>
          </tr>
        </tbody>
      </table>
      <Section title="Tiến độ thanh toán">
        {p.installments && p.installments.length > 0 ? (
          <table className="ct-paper__tbl">
            <tbody>
              {p.installments.map((i, n) => (
                <tr key={i.id}>
                  <td>
                    {n + 1}. {i.name} — hạn {p.fmtDate(i.dueDate)}
                    {i.isDeposit ? ' (đợt cọc)' : ''}
                  </td>
                  <td className="ct-paper__r">{formatVnd(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ct-paper__muted">Chưa lập tiến độ thanh toán.</p>
        )}
      </Section>
      {p.texts.map((t) => (
        <Section
          key={t.title}
          title={
            <>
              {t.title} {t.source && <i className="ct-paper__src">({t.source})</i>}
            </>
          }
        >
          <ol className="ct-paper__ol">
            {paragraphs(t.body).map((x, i) => (
              <li key={i}>{x.replace(/^\d+[.)]\s*/, '')}</li>
            ))}
          </ol>
        </Section>
      ))}
      {p.notes && (
        <Section title="Ghi chú">
          <p>{p.notes}</p>
        </Section>
      )}
      <div className="ct-paper__sign">
        <div>
          <b>Học viên</b>
          <span>{p.customer?.fullName ?? ''}</span>
        </div>
        <div>
          <b>Đại diện trung tâm</b>
          <span>{p.orgName}</span>
        </div>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="ct-paper__sec">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export interface ContractPrintDialogProps extends ContractPaperProps {
  open: boolean;
  eyebrow: string;
  onClose: () => void;
}

export function ContractPrintDialog({ open, eyebrow, onClose, ...paper }: ContractPrintDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow={eyebrow}
      title="Xem bản in"
      className="ct-print-dlg"
      footer={
        <>
          <Button onClick={onClose}>Đóng</Button>
          <Button variant="primary" onClick={() => window.print()}>
            In / Lưu PDF
          </Button>
        </>
      }
    >
      <div className="ct-paper__wrap">
        <ContractPaper {...paper} />
      </div>
    </Dialog>
  );
}
