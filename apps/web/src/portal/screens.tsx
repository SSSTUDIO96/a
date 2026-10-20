// Các màn ngoài trang chính: nhập 4 số, chưa có phiên (+ nhập mã chuyển máy), tạm đóng, lỗi mạng (bản vẽ E mục 5.1).
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import { isZaloInApp } from '../pwa/platform';
import { DIGITS, DigitBoxes } from './DigitBoxes';
import { IconLock, IconWarn } from './icons';

/** Khung chung của các màn ngoài trang: đầu trang CHUNG "Trang học viên" (chưa mở được thì chưa biết trung tâm nào, mục 8). */
export function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="pt-frame">
      <header className="pt-frame__head">
        <span className="pt-logo" aria-hidden="true">
          M
        </span>
        <strong>Trang học viên</strong>
        <span className="pt-muted">Cổng học viên</span>
      </header>
      <main className="pt-frame__main">{children}</main>
      <footer className="pt-frame__foot">
        <IconLock /> Chạy trên Makeup Pro
      </footer>
    </div>
  );
}

// ---------- Nhập 4 số ----------
export function OpenScreen({ onSubmit }: { onSubmit: (last4: string) => Promise<string | null> }) {
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const zalo = isZaloInApp();
  const ready = digits.length === DIGITS;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const err = await onSubmit(digits);
    if (!alive.current) return;
    setBusy(false);
    if (err !== null) {
      setError(err);
      setDigits(''); // xoá 4 ô, nhập lại từ đầu
      document.querySelector<HTMLInputElement>('.pt-digit')?.focus();
    }
  };

  return (
    <Frame>
      <form className="pt-card pt-open" onSubmit={(e) => void submit(e)} noValidate>
        <div className="pt-card__body">
          <h1>Mở trang học viên</h1>
          <p className="pt-muted">
            Đường dẫn này dành riêng cho một học viên. Nhập <strong>4 số cuối số điện thoại</strong> em đã đăng ký với trung tâm.
          </p>
          <DigitBoxes value={digits} onChange={setDigits} disabled={busy} invalid={error !== null} describedBy={error ? 'pt-open-err' : undefined} />
          {error && (
            <p id="pt-open-err" className="pt-note pt-note--danger" role="alert">
              <IconWarn />
              <span>{error}</span>
            </p>
          )}
          {zalo && (
            <p className="pt-note pt-note--warn" role="note" data-testid="zalo-warning">
              <IconWarn />
              <span>Em đang mở trong Zalo. Để lần sau mở nhanh, bấm ⋯ → Mở bằng trình duyệt.</span>
            </p>
          )}
          <Button type="submit" variant="primary" block disabled={!ready} loading={busy}>
            Mở trang của tôi
          </Button>
        </div>
        <p className="pt-card__foot">Nhập sai nhiều lần, đường dẫn sẽ bị khoá. Không phải em? Đóng trang này và báo trung tâm.</p>
      </form>
    </Frame>
  );
}

// ---------- Chưa có phiên (+ nhập mã chuyển máy) ----------
export function NoSessionScreen({ notice, onClaim }: { notice: string | null; onClaim: (code: string) => Promise<string | null> }) {
  const [claiming, setClaiming] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    const err = await onClaim(code);
    if (!alive.current) return;
    setBusy(false);
    if (err !== null) {
      setError(err);
      setCode('');
    }
  };

  return (
    <Frame>
      <section className="pt-card">
        <div className="pt-card__body">
          <h1>Chưa mở trang</h1>
          {notice && (
            <p className="pt-note pt-note--ok" role="status" data-testid="notice">
              {notice}
            </p>
          )}
          <p className="pt-muted">Mở trang học viên bằng đường dẫn trung tâm gửi qua Zalo.</p>
          {!claiming ? (
            <Button block onClick={() => setClaiming(true)}>
              Tôi có mã chuyển sang app
            </Button>
          ) : (
            <form className="pt-claim" onSubmit={(e) => void submit(e)} noValidate>
              <label htmlFor="pt-code">Mã chuyển sang app (8 ký tự)</label>
              <input
                id="pt-code"
                className="pt-code"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={12}
                value={code}
                disabled={busy}
                aria-invalid={error !== null || undefined}
                aria-describedby={error ? 'pt-claim-err' : undefined}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              {error && (
                <p id="pt-claim-err" className="pt-note pt-note--danger" role="alert">
                  <IconWarn />
                  <span>{error}</span>
                </p>
              )}
              <Button type="submit" variant="primary" block disabled={code.trim().length === 0} loading={busy}>
                Nhận trang trên app
              </Button>
            </form>
          )}
        </div>
      </section>
    </Frame>
  );
}

// ---------- Tạm đóng (403) ----------
export function ClosedScreen() {
  return (
    <Frame>
      <section className="pt-card">
        <div className="pt-card__body">
          <h1>Trang tạm đóng</h1>
          <p className="pt-muted">Trang học viên đang tạm đóng. Vui lòng liên hệ trung tâm.</p>
        </div>
      </section>
    </Frame>
  );
}

// ---------- Không tải được (mất mạng, máy chủ lỗi) ----------
export function ProblemScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <Frame>
      <section className="pt-card">
        <div className="pt-card__body">
          <h1>Chưa tải được trang</h1>
          <p className="pt-muted">Không có mạng hoặc máy chủ đang bận. Kiểm tra kết nối rồi thử lại.</p>
          <Button variant="primary" block onClick={onRetry}>
            Thử lại
          </Button>
        </div>
      </section>
    </Frame>
  );
}

export function LoadingScreen() {
  return (
    <Frame>
      <p className="pt-loading" role="status">
        Đang mở trang…
      </p>
    </Frame>
  );
}
