// Trang chính của học viên: một trang cuộn (bản vẽ E mục 5.1). Điện thoại: chip neo ngang dưới đầu trang;
// máy tính (≥ 1024): cột trái neo mục, nội dung bên phải.
import { useEffect, useMemo, useState } from 'react';
import type { PortalMe } from '@makeup/shared';
import { Button } from '../ui/Button';
import { InstallGuide } from '../pwa/InstallGuide';
import { isStandalone } from '../pwa/platform';
import { PortalHttpError, portalApi } from './api';
import { classStatusLabel, courseNameOfContract, initialOf, nextSession } from './logic';
import {
  BankCard,
  ContactCard,
  ContractsCard,
  EmptyContracts,
  InstallmentsCard,
  NextSessionCard,
  PhotosCard,
  ReceiptsCard,
  RulesCard,
  ScheduleCard,
  TuitionCard,
  type Ctx,
} from './sections';
import { Avatar, ConfirmSheet } from './widgets';

interface NavItem {
  id: string;
  label: string;
  /** Chỉ hiện ở cột trái trên máy tính, không có chip trên điện thoại. */
  deskOnly?: boolean;
}

interface Props {
  me: PortalMe;
  /** Chênh giữa đồng hồ máy chủ và đồng hồ máy học viên (ms): "hôm nay" theo giờ máy chủ, không tin đồng hồ máy. */
  clockOffsetMs: number;
  onSessionLost: () => void;
  onSignedOut: () => void;
}

export function PortalPage({ me, clockOffsetMs, onSessionLost, onSignedOut }: Props) {
  const [tick, setTick] = useState(0);
  const [askSignOut, setAskSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<{ code: string; expiresAt: string } | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  // Đồng hồ trượt mỗi phút để nhãn "Hôm nay" / "Đã qua" không cũ khi để trang mở lâu.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const nowMs = useMemo(() => Date.now() + clockOffsetMs, [clockOffsetMs, tick, me]); // eslint-disable-line react-hooks/exhaustive-deps
  const ctx: Ctx = { tz: me.timezone, nowMs };
  const next = nextSession(me.enrollments, nowMs);
  const many = me.contracts.length > 1;
  const manyEnroll = me.enrollments.length > 1;
  const rulesExist = me.contracts.some((c) => c.rules !== null && c.rules.trim() !== '');
  const contactExists = Boolean(me.center.phone || me.center.zalo || me.center.address);

  // Mục neo: chỉ mục có dữ liệu.
  const nav: NavItem[] = [];
  if (next) nav.push({ id: 'buoi-hoc-toi', label: 'Buổi học tới', deskOnly: true });
  if (me.enrollments.length > 0) nav.push({ id: 'lich-hoc', label: 'Lịch học' });
  if (me.contracts.length > 0) {
    if (many) {
      me.contracts.forEach((c, i) => nav.push({ id: `hoc-phi-${i}`, label: courseNameOfContract(me, c.code) ?? c.code }));
    } else nav.push({ id: 'hoc-phi', label: 'Học phí' });
  }
  if (rulesExist) nav.push({ id: 'noi-quy', label: 'Nội quy' });
  if (me.cards.length > 0) nav.push({ id: 'anh', label: 'Ảnh' });
  if (me.contracts.length > 0) nav.push({ id: 'hop-dong', label: 'Hợp đồng' });
  if (contactExists) nav.push({ id: 'lien-he', label: 'Liên hệ', deskOnly: true });

  // Mục đang xem (chỉ khi trình duyệt có IntersectionObserver).
  const navKey = nav.map((n) => n.id).join('|');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const els = nav.map((n) => document.getElementById(n.id)).filter((x): x is HTMLElement => x !== null);
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) seen.set(en.target.id, en.isIntersecting ? en.boundingClientRect.top : Number.POSITIVE_INFINITY);
        let best: string | null = null;
        let bestTop = Number.POSITIVE_INFINITY;
        for (const [id, top] of seen) if (top < bestTop && top > -1e9) { best = id; bestTop = top; }
        if (best) setActive(best);
      },
      { rootMargin: '-110px 0px -55% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [navKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  const getHandoff = async () => {
    setHandoffError(null);
    try {
      setHandoff(await portalApi.handoff());
    } catch (e) {
      if (e instanceof PortalHttpError && e.status === 401) onSessionLost();
      else setHandoffError('Chưa lấy được mã. Kiểm tra mạng rồi thử lại.');
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await portalApi.signOut();
      onSignedOut();
    } catch (e) {
      if (e instanceof PortalHttpError && e.status === 401) onSignedOut(); // phiên đã hết sẵn: coi như đã thoát
      else {
        setSignOutError('Chưa thoát được. Kiểm tra mạng rồi thử lại.');
        setSigningOut(false);
      }
    }
  };

  const first = me.enrollments[0];
  const sub = first ? `${first.courseName} · ${first.className}` : null;

  return (
    <div className="pt-app">
      <header className="pt-top">
        <div className="pt-top__in">
          <Avatar name={me.center.name} url={me.center.logoUrl} size={32} tone="brand" />
          <div className="pt-top__text">
            <strong>{me.center.name}</strong>
            <span>Cổng học viên</span>
          </div>
          <Avatar name={me.student.callName} url={me.student.avatarUrl} size={32} />
        </div>
      </header>

      <div className="pt-wrap">
        {nav.length > 0 && (
          <nav className="pt-nav" aria-label="Các mục của trang">
            <ul>
              {nav.map((n) => (
                <li key={n.id} className={n.deskOnly ? 'pt-nav__desk' : undefined}>
                  <button type="button" className={n.id === active ? 'pt-chip pt-chip--on' : 'pt-chip'} aria-current={n.id === active ? 'true' : undefined} onClick={() => goTo(n.id)}>
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <main className="pt-main">
          <section className="pt-hello" aria-label="Học viên">
            <Avatar name={me.student.callName} url={me.student.avatarUrl} size={72} />
            <div className="pt-hello__text">
              <h1>Chào {me.student.callName}</h1>
              {sub && <p className="pt-muted">{sub}</p>}
              {first && <span className={first.classStatus === 'OPEN' ? 'pt-tag pt-tag--ok' : 'pt-tag'}>{classStatusLabel(first.classStatus)}</span>}
            </div>
          </section>

          {next && <NextSessionCard next={next} ctx={ctx} />}

          {me.contracts.length === 0 ? (
            <EmptyContracts />
          ) : (
            me.contracts.map((c, i) => (
              <div key={c.code} className="pt-group">
                <TuitionCard c={c} ctx={ctx} anchorId={many ? `hoc-phi-${i}` : 'hoc-phi'} {...(many ? { label: courseNameOfContract(me, c.code) ?? c.code } : {})} />
                <InstallmentsCard c={c} ctx={ctx} />
                <ReceiptsCard c={c} ctx={ctx} />
              </div>
            ))
          )}

          {me.bank && me.contracts.length > 0 && <BankCard bank={me.bank} contracts={me.contracts} />}

          {me.enrollments.map((e, i) => (
            <ScheduleCard key={`${e.contractCode}-${e.className}`} e={e} ctx={ctx} many={manyEnroll} anchorId={i === 0 ? 'lich-hoc' : `lich-hoc-${i}`} />
          ))}

          <RulesCard contracts={me.contracts} />
          <PhotosCard cards={me.cards} ctx={ctx} />
          {me.contracts.length > 0 && <ContractsCard contracts={me.contracts} ctx={ctx} />}
          <ContactCard center={me.center} />

          {!isStandalone() && (
            <section id="cai-app" className="pt-card" aria-labelledby="cai-app-t">
              <header className="pt-card__head">
                <h2 id="cai-app-t">Cài lên màn hình chính</h2>
              </header>
              <div className="pt-card__body">
                <InstallGuide variant="portal" onGetHandoffCode={() => void getHandoff()} />
                {handoff && (
                  <div className="pt-handoff" role="status">
                    <span className="pt-muted pt-small">Mã chuyển sang app (dùng một lần, trong 10 phút)</span>
                    <strong className="pt-handoff__code num">{handoff.code}</strong>
                  </div>
                )}
                {handoffError && (
                  <p className="pt-note pt-note--danger" role="alert">
                    {handoffError}
                  </p>
                )}
              </div>
            </section>
          )}

          <footer className="pt-foot">
            <p>
              Đang mở trên {me.device.label} ·{' '}
              <button type="button" className="pt-linkbtn" onClick={() => { setSignOutError(null); setAskSignOut(true); }}>
                Thoát khỏi máy này
              </button>
            </p>
            <p className="pt-muted pt-small">Chạy trên Makeup Pro</p>
          </footer>
        </main>
      </div>

      {askSignOut && (
        <ConfirmSheet
          title="Thoát khỏi máy này?"
          onClose={() => !signingOut && setAskSignOut(false)}
          actions={
            <>
              <Button onClick={() => setAskSignOut(false)} disabled={signingOut}>
                Ở lại
              </Button>
              <Button variant="danger" loading={signingOut} onClick={() => void signOut()}>
                Thoát khỏi máy này
              </Button>
            </>
          }
        >
          <p>Trang sẽ đóng trên máy này. Muốn xem lại, em mở đường dẫn trung tâm đã gửi. Nếu đường dẫn đã mở đủ 2 máy, nhắn trung tâm gửi đường dẫn mới.</p>
          {signOutError && (
            <p className="pt-note pt-note--danger" role="alert">
              {signOutError}
            </p>
          )}
        </ConfirmSheet>
      )}
    </div>
  );
}

export { initialOf };
