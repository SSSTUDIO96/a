// Các thẻ của trang học viên (bản vẽ E mục 5.1). Chỉ HIỂN THỊ dữ liệu PortalMe: tiền qua formatVnd của shared, không tính lại.
import { useState, type ReactNode } from 'react';
import { formatVnd, type PortalMe } from '@makeup/shared';
import { Button } from '../ui/Button';
import { IconChat, IconCheck, IconClock, IconCopy, IconDownload, IconMap, IconPhone, IconPin, IconUser, IconWarn } from './icons';
import {
  daysPastDue,
  digitsOnly,
  installmentShortfall,
  mapsDirectionsUrl,
  sessionBadge,
  type NextSession,
} from './logic';
import { dm, dmyInZone, dmy, hmInZone, weekdayDm, WEEKDAY_NAME, weekdayOfYmd, ymdInZone } from './time';

type Enrollment = PortalMe['enrollments'][number];
type Contract = PortalMe['contracts'][number];
type Card = PortalMe['cards'][number];

export interface Ctx {
  tz: string;
  nowMs: number;
}

const money = (n: number) => <span className="num">{formatVnd(n)}</span>;

function CardShell({ id, title, aside, children, tone }: { id?: string; title: string; aside?: ReactNode; children: ReactNode; tone?: 'accent' }) {
  const headId = id ? `${id}-t` : undefined;
  return (
    <section id={id} className={tone === 'accent' ? 'pt-card pt-card--accent' : 'pt-card'} aria-labelledby={headId}>
      <header className="pt-card__head">
        <h2 id={headId}>{title}</h2>
        {aside !== undefined && aside !== null && <span className="pt-card__aside">{aside}</span>}
      </header>
      <div className="pt-card__body">{children}</div>
    </section>
  );
}

// ---------- Chép vào bộ nhớ tạm ----------
function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      // Trình duyệt không cho chép: chữ vẫn hiện ngay cạnh để học viên tự chọn.
    }
  };
  return (
    <Button size="sm" icon={done ? <IconCheck /> : <IconCopy />} onClick={() => void copy()} aria-label={`Chép ${label}`}>
      {done ? 'Đã chép' : 'Chép'}
    </Button>
  );
}

// ---------- Buổi học tới ----------
export function NextSessionCard({ next, ctx }: { next: NextSession; ctx: Ctx }) {
  const { enrollment: e, session: s, ordinal } = next;
  const today = ymdInZone(new Date(ctx.nowMs), ctx.tz);
  const tomorrow = ymdInZone(new Date(ctx.nowMs + 86_400_000), ctx.tz);
  const day = s.date === today ? `Hôm nay, ${weekdayDm(s.date)}` : s.date === tomorrow ? `Ngày mai, ${weekdayDm(s.date)}` : weekdayDm(s.date);
  const tag = e.sessionCount !== null && ordinal <= e.sessionCount ? `Buổi ${ordinal}/${e.sessionCount}` : `Buổi ${ordinal}`;
  const loc = e.location;
  return (
    <CardShell id="buoi-hoc-toi" title="Buổi học tới" aside={<span className="pt-tag pt-tag--accent">{tag}</span>} tone="accent">
      <p className="pt-when">
        <strong>{day}</strong>
        <span className="pt-when__time num">
          {hmInZone(s.startsAt, ctx.tz)}–{hmInZone(s.endsAt, ctx.tz)}
        </span>
      </p>
      {e.instructor && (
        <p className="pt-line">
          <IconUser />
          <span>
            Giảng viên <strong>{e.instructor.name}</strong>
          </span>
        </p>
      )}
      {loc && (
        <p className="pt-line pt-line--top">
          <IconPin />
          <span>
            <strong>{loc.name}</strong>
            {loc.address && <span className="pt-muted pt-block">{loc.address}</span>}
          </span>
        </p>
      )}
      <div className="pt-actions">
        {loc && loc.latitude !== null && loc.longitude !== null && (
          <a className="pt-btn" href={mapsDirectionsUrl(loc.latitude, loc.longitude)} target="_blank" rel="noopener noreferrer">
            <IconMap /> Chỉ đường
          </a>
        )}
        <a className="pt-link" href="#lich-hoc">
          Cả lịch học
        </a>
      </div>
    </CardShell>
  );
}

// ---------- Học phí ----------
function overdueSentences(c: Contract, ctx: Ctx): string[] {
  const out: string[] = [];
  for (const i of c.installments) {
    if (i.status !== 'OVERDUE') continue;
    const days = daysPastDue(i.dueDate, ctx.nowMs, ctx.tz);
    const due = dm(ymdInZone(i.dueDate, ctx.tz));
    out.push(`${i.name} còn thiếu ${formatVnd(installmentShortfall(i))} — hạn ${due}${days >= 1 ? `, đã qua ${days} ngày` : ''}.`);
  }
  return out;
}

export function TuitionCard({ c, ctx, anchorId, label }: { c: Contract; ctx: Ctx; anchorId?: string; label?: string }) {
  const pct = c.total > 0 ? Math.max(0, Math.min(100, (c.paid / c.total) * 100)) : 0;
  const overdue = overdueSentences(c, ctx);
  const nextDue = c.installments.find((i) => i.status === 'DUE' || i.status === 'PARTIAL');
  return (
    <CardShell id={anchorId} title={label ? `Học phí · ${label}` : 'Học phí'} aside={<span className="num">{c.code}</span>}>
      <dl className="pt-sums">
        <div>
          <dt>Tổng phải đóng</dt>
          <dd>{money(c.total)}</dd>
        </div>
        <div>
          <dt>Đã đóng</dt>
          <dd>{money(c.paid)}</dd>
        </div>
        <div>
          <dt>Còn lại</dt>
          <dd className="pt-sums__left">{money(c.remaining)}</dd>
        </div>
      </dl>
      <div className="pt-bar" role="progressbar" aria-label="Đã đóng so với tổng phải đóng" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <span style={{ width: `${pct}%` }} />
      </div>
      {overdue.length > 0 && (
        <div className="pt-note pt-note--warn" role="note">
          <IconClock />
          <p>
            <strong>{overdue[0]}</strong>
            {overdue.slice(1).map((t) => (
              <span key={t}> {t}</span>
            ))}
            {nextDue && (
              <span>
                {' '}
                {nextDue.name}: {formatVnd(nextDue.amount)}, hạn {dm(ymdInZone(nextDue.dueDate, ctx.tz))}.
              </span>
            )}
          </p>
        </div>
      )}
    </CardShell>
  );
}

export function InstallmentsCard({ c, ctx }: { c: Contract; ctx: Ctx }) {
  if (c.installments.length === 0) return null;
  return (
    <CardShell title="Tiến độ đóng tiền" aside={`${c.installments.length} đợt`}>
      <ul className="pt-rows">
        {c.installments.map((i) => {
          const days = i.status === 'OVERDUE' ? daysPastDue(i.dueDate, ctx.nowMs, ctx.tz) : 0;
          const due = dmyInZone(i.dueDate, ctx.tz);
          const short = i.status === 'OVERDUE' || i.status === 'PARTIAL' ? installmentShortfall(i) : 0;
          return (
            <li key={`${i.name}-${i.dueDate}`} className="pt-inst">
              <span className={`pt-dot pt-dot--${i.status.toLowerCase()}`} aria-hidden="true">
                {i.status === 'PAID' ? <IconCheck /> : i.status === 'OVERDUE' ? '!' : null}
              </span>
              <span className="pt-inst__main">
                <strong>{i.name}</strong>
                <span className="pt-muted">
                  Hạn {due}
                  {i.status === 'PAID' && ' · đã đủ'}
                  {i.status === 'PARTIAL' && ' · đã đóng một phần'}
                  {i.status === 'OVERDUE' && <span className="pt-warn-text"> · quá hạn{days >= 1 ? ` ${days} ngày` : ''}</span>}
                </span>
              </span>
              <span className="pt-inst__amt">
                <strong>{money(i.amount)}</strong>
                {short > 0 && <span className="pt-warn-text pt-small">còn thiếu {money(short)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </CardShell>
  );
}

const METHOD: Record<Contract['receipts'][number]['method'], string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  CARD: 'Thẻ',
  OTHER: 'Khác',
};

export function ReceiptsCard({ c, ctx }: { c: Contract; ctx: Ctx }) {
  if (c.receipts.length === 0) return null;
  return (
    <CardShell title="Đã đóng" aside={`${c.receipts.length} phiếu`}>
      <ul className="pt-rows">
        {c.receipts.map((r) => (
          <li key={r.code} className="pt-inst">
            <span className="pt-inst__main">
              <strong className="num">{r.code}</strong>
              <span className="pt-muted">
                {dmyInZone(r.receivedAt, ctx.tz)} · {METHOD[r.method]}
                {r.kind === 'REFUND' && ' · hoàn tiền'}
              </span>
            </span>
            <span className="pt-inst__amt">
              <strong>{r.kind === 'REFUND' ? <span className="num">−{formatVnd(r.amount)}</span> : money(r.amount)}</strong>
            </span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

// ---------- Cách đóng tiền ----------
export function BankCard({ bank, contracts }: { bank: NonNullable<PortalMe['bank']>; contracts: Contract[] }) {
  return (
    <CardShell id="cach-dong" title="Cách đóng tiền">
      <dl className="pt-kv">
        <div>
          <dt>Ngân hàng</dt>
          <dd>{bank.bankName}</dd>
        </div>
        <div>
          <dt>Số tài khoản</dt>
          <dd className="pt-kv__copy">
            <strong className="num">{bank.accountNo}</strong>
            <CopyButton text={bank.accountNo} label="số tài khoản" />
          </dd>
        </div>
        <div>
          <dt>Chủ tài khoản</dt>
          <dd>{bank.accountName}</dd>
        </div>
        {contracts.map((c) => (
          <div key={c.code}>
            <dt>Nội dung chuyển khoản{contracts.length > 1 ? ` (${c.code})` : ''}</dt>
            <dd className="pt-kv__copy">
              <strong className="num">{c.transferNote}</strong>
              <CopyButton text={c.transferNote} label="nội dung chuyển khoản" />
            </dd>
          </div>
        ))}
      </dl>
      <p className="pt-muted pt-small pt-pad-top">Chuyển xong trung tâm sẽ ghi phiếu thu, số Đã đóng cập nhật sau khi trung tâm xác nhận.</p>
    </CardShell>
  );
}

// ---------- Lịch học ----------
function weekdaysText(weekdays: number[]): string {
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_NAME[d])
    .filter((x): x is string => x !== undefined)
    .join(', ');
}

export function ScheduleCard({ e, ctx, anchorId, many }: { e: Enrollment; ctx: Ctx; anchorId?: string; many: boolean }) {
  const time = e.startTime && e.endTime ? `${e.startTime}–${e.endTime}` : null;
  const count = e.sessionCount !== null ? `${e.sessionCount} buổi` : e.sessions.length > 0 ? `${e.sessions.length} buổi` : null;
  return (
    <CardShell id={anchorId} title={many ? `Lịch học · ${e.courseName}` : 'Lịch học'} aside={count}>
      <dl className="pt-kv">
        <div>
          <dt>Khoá, lớp</dt>
          <dd>
            {e.courseName} · {e.className}
          </dd>
        </div>
        <div>
          <dt>Giờ học</dt>
          <dd>
            {weekdaysText(e.weekdays)}
            {time && <span className="num"> · {time}</span>}
          </dd>
        </div>
        <div>
          <dt>Thời gian</dt>
          <dd className="num">
            {dmy(e.startDate)} – {dmy(e.endDate)}
          </dd>
        </div>
        {e.instructor && (
          <div>
            <dt>Giảng viên</dt>
            <dd>{e.instructor.name}</dd>
          </div>
        )}
        {e.location && (
          <div>
            <dt>Địa điểm</dt>
            <dd>
              {e.location.name}
              {e.location.address && <span className="pt-muted pt-block">{e.location.address}</span>}
            </dd>
          </div>
        )}
      </dl>
      {e.sessions.length > 0 && (
        <ul className="pt-rows pt-sessions" aria-label="Từng buổi học">
          {e.sessions.map((s, idx) => {
            const badge = sessionBadge(s, ctx.nowMs, ctx.tz);
            const wd = weekdayOfYmd(s.date);
            return (
              <li key={`${s.date}-${s.startsAt}`} className={badge === 'past' || badge === 'cancelled' ? 'pt-sess pt-sess--dim' : 'pt-sess'}>
                <span className="pt-day" aria-hidden="true">
                  <b className="num">{s.date.slice(8, 10)}</b>
                  <small>
                    {wd === 7 ? 'CN' : `T${wd}`} · th{Number(s.date.slice(5, 7))}
                  </small>
                </span>
                <span className="pt-inst__main">
                  <strong>Buổi {idx + 1}</strong>
                  <span className="pt-muted num">
                    {hmInZone(s.startsAt, ctx.tz)}–{hmInZone(s.endsAt, ctx.tz)}
                    {e.location ? ` · ${e.location.name}` : ''}
                  </span>
                </span>
                {badge === 'past' && <span className="pt-tag">Đã qua</span>}
                {badge === 'today' && <span className="pt-tag pt-tag--accent">Hôm nay</span>}
                {badge === 'cancelled' && <span className="pt-tag pt-tag--danger">Huỷ</span>}
              </li>
            );
          })}
        </ul>
      )}
    </CardShell>
  );
}

// ---------- Nội quy ----------
export function RulesCard({ contracts }: { contracts: Contract[] }) {
  const withRules = contracts.filter((c) => c.rules !== null && c.rules.trim() !== '');
  if (withRules.length === 0) return null;
  return (
    <CardShell id="noi-quy" title="Nội quy">
      {withRules.map((c) => (
        <div key={c.code} className="pt-text">
          {withRules.length > 1 && <p className="pt-muted pt-small num">Hợp đồng {c.code}</p>}
          <p className="pt-pre">{c.rules}</p>
        </div>
      ))}
    </CardShell>
  );
}

// ---------- Ảnh của tôi ----------
const CARD_LABEL: Record<Card['kind'], string> = { WELCOME: 'Thẻ chào mừng', FEEDBACK: 'Ảnh Feedback' };

async function savePhoto(card: Card): Promise<'shared' | 'opened'> {
  try {
    const res = await fetch(card.url, { credentials: 'same-origin' });
    if (res.ok) {
      const blob = await res.blob();
      const file = new File([blob], `${CARD_LABEL[card.kind]}.png`, { type: blob.type || 'image/png' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return 'shared';
      }
    }
  } catch (err) {
    // Học viên tự đóng bảng chia sẻ không phải là lỗi.
    if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
  }
  window.open(card.url, '_blank', 'noopener,noreferrer');
  return 'opened';
}

export function PhotosCard({ cards, ctx }: { cards: Card[]; ctx: Ctx }) {
  const [open, setOpen] = useState<Card | null>(null);
  const [hint, setHint] = useState(false);
  if (cards.length === 0) return null;
  return (
    <CardShell id="anh" title="Ảnh của tôi" aside={`${cards.length} ảnh`}>
      <ul className="pt-photos">
        {cards.map((c) => (
          <li key={c.url}>
            <button type="button" className="pt-photo" onClick={() => { setHint(false); setOpen(c); }} aria-label={`Xem to: ${CARD_LABEL[c.kind]}${c.className ? `, ${c.className}` : ''}`}>
              <img
                src={c.url}
                alt={CARD_LABEL[c.kind]}
                loading="lazy"
                {...(c.width && c.height ? { width: c.width, height: c.height } : {})}
                style={c.width && c.height ? { aspectRatio: `${c.width} / ${c.height}` } : undefined}
              />
            </button>
            <p className="pt-photo__cap">
              <strong>{CARD_LABEL[c.kind]}</strong>
              <span className="pt-muted pt-small">
                {c.className ? `${c.className} · ` : ''}
                {dmyInZone(c.createdAt, ctx.tz)}
              </span>
            </p>
          </li>
        ))}
      </ul>
      {open && (
        <Lightbox onClose={() => setOpen(null)} label={CARD_LABEL[open.kind]}>
          <img src={open.url} alt={CARD_LABEL[open.kind]} className="pt-lightbox__img" />
          <div className="pt-lightbox__bar">
            <Button
              variant="primary"
              icon={<IconDownload />}
              onClick={() => {
                void savePhoto(open).then((r) => setHint(r === 'opened'));
              }}
            >
              Lưu vào Ảnh
            </Button>
            <Button onClick={() => setOpen(null)}>Đóng</Button>
          </div>
          {hint && <p className="pt-lightbox__hint">Nhấn giữ ảnh để lưu.</p>}
        </Lightbox>
      )}
    </CardShell>
  );
}

function Lightbox({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  return (
    <div
      className="pt-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="pt-lightbox">{children}</div>
    </div>
  );
}

// ---------- Hợp đồng ----------
export function ContractsCard({ contracts, ctx }: { contracts: Contract[]; ctx: Ctx }) {
  return (
    <CardShell id="hop-dong" title="Hợp đồng" aside={contracts.length > 1 ? `${contracts.length} hợp đồng` : null}>
      {contracts.map((c) => (
        <article key={c.code} className="pt-contract">
          <header>
            <strong className="num">{c.code}</strong>
            <span className="pt-muted pt-small">{c.confirmedAt ? `Ký ngày ${dmyInZone(c.confirmedAt, ctx.tz)}` : 'Chưa có ngày ký'}</span>
          </header>
          <ul className="pt-rows">
            {c.lines.map((l, i) => (
              <li key={`${l.name}-${i}`} className="pt-inst">
                <span className="pt-inst__main">
                  <strong>{l.name}</strong>
                  {l.quantity !== 1 && (
                    <span className="pt-muted pt-small num">
                      {l.quantity} × {formatVnd(l.unitPrice)}
                    </span>
                  )}
                </span>
                <span className="pt-inst__amt">{money(l.lineTotal)}</span>
              </li>
            ))}
            {c.discount > 0 && (
              <li className="pt-inst">
                <span className="pt-inst__main">
                  <span>Giảm</span>
                </span>
                <span className="pt-inst__amt">
                  <span className="num">−{formatVnd(c.discount)}</span>
                </span>
              </li>
            )}
            <li className="pt-inst pt-inst--total">
              <span className="pt-inst__main">
                <strong>Phải đóng</strong>
              </span>
              <span className="pt-inst__amt">
                <strong>{money(c.total)}</strong>
              </span>
            </li>
          </ul>
          {c.terms !== null && c.terms.trim() !== '' && (
            <details className="pt-terms">
              <summary>Điều khoản hợp đồng</summary>
              <p className="pt-pre">{c.terms}</p>
            </details>
          )}
        </article>
      ))}
    </CardShell>
  );
}

// ---------- Liên hệ ----------
export function ContactCard({ center }: { center: PortalMe['center'] }) {
  if (!center.phone && !center.zalo && !center.address) return null;
  return (
    <CardShell id="lien-he" title="Liên hệ trung tâm">
      {center.address && (
        <p className="pt-line pt-line--top">
          <IconPin />
          <span>{center.address}</span>
        </p>
      )}
      <div className="pt-actions">
        {center.phone && (
          <a className="pt-btn" href={`tel:${center.phone}`}>
            <IconPhone /> Gọi {center.phone}
          </a>
        )}
        {center.zalo && (
          <a className="pt-btn" href={`https://zalo.me/${digitsOnly(center.zalo)}`} target="_blank" rel="noopener noreferrer">
            <IconChat /> Nhắn Zalo
          </a>
        )}
      </div>
    </CardShell>
  );
}

export function EmptyContracts() {
  return (
    <section className="pt-card" aria-label="Chưa có hợp đồng">
      <div className="pt-card__body">
        <p className="pt-empty">
          <IconWarn />
          Trung tâm chưa có hợp đồng khoá học nào cho em.
        </p>
      </div>
    </section>
  );
}
