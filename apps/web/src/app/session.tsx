import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import * as auth from '../api/auth';
import type { Me, MyOrganization, RegisterInput } from '../api/auth';
import { setAccessToken, setSessionExpiredHandler } from '../api/client';
import { ApiError } from '../api/errors';

// Chỉ lưu id tổ chức đang chọn — tiện ích cho từng người xem, mất cũng không sao (chọn tổ chức đầu).
const SELECTED_ORG_KEY = 'makeup-pro.to-chuc-dang-chon';

function readSelectedOrgId(): string | null {
  try {
    return window.localStorage.getItem(SELECTED_ORG_KEY);
  } catch {
    return null;
  }
}

function writeSelectedOrgId(id: string): void {
  try {
    window.localStorage.setItem(SELECTED_ORG_KEY, id);
  } catch {
    // Trình duyệt chặn lưu trữ (chế độ riêng tư...) — chỉ mất tiện ích nhớ lựa chọn.
  }
}

export type SessionStatus = 'loading' | 'anonymous' | 'authenticated';

// 429 lúc khôi phục phiên: máy chủ bận/giới hạn tốc độ, KHÔNG phải chưa đăng nhập.
// Chờ theo Retry-After (client.ts gắn vào ApiError.retryAfterSeconds khi có); thiếu thì 60 giây = cửa sổ đếm của máy chủ.
const DEFAULT_RETRY_AFTER_SECONDS = 60;
const MAX_RETRY_AFTER_SECONDS = 300;

export function retryAfterSeconds(err: unknown): number {
  const v = typeof err === 'object' && err !== null ? (err as { retryAfterSeconds?: unknown }).retryAfterSeconds : undefined;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return DEFAULT_RETRY_AFTER_SECONDS;
  return Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(1, Math.ceil(v)));
}

function isRateLimited(err: unknown): boolean {
  return err instanceof ApiError && err.status === 429;
}

interface RestoreBusy {
  retryAt: number;
  // true: sẽ tự thử lại khi hết giờ chờ; false: đã tự thử một lần, chờ người dùng bấm.
  autoRetry: boolean;
}

function RestoreBusyNotice({ busy, onRetry }: { busy: RestoreBusy; onRetry: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((busy.retryAt - now) / 1000));
  if (busy.autoRetry) {
    return (
      <div role="status">
        <p>{`Máy chủ đang bận, thử lại sau ${left} giây.`}</p>
      </div>
    );
  }
  return (
    <div role="status">
      <p>{left > 0 ? `Máy chủ vẫn đang bận. Vui lòng thử lại sau ${left} giây.` : 'Máy chủ vẫn đang bận. Bạn có thể thử lại.'}</p>
      <button type="button" onClick={onRetry}>
        Thử lại
      </button>
    </div>
  );
}

interface SessionValue {
  status: SessionStatus;
  // Lỗi khi khôi phục phiên lúc tải trang (mất mạng, máy chủ lỗi) — khác với "chưa đăng nhập".
  restoreError: unknown;
  user: Me | null;
  organizations: MyOrganization[];
  currentOrg: MyOrganization | null;
  selectOrg: (orgId: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput, idempotencyKey: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadMe: () => Promise<Me>;
  retryRestore: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [restoreError, setRestoreError] = useState<unknown>(null);
  const [user, setUser] = useState<Me | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => readSelectedOrgId());
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [restoreBusy, setRestoreBusy] = useState<RestoreBusy | null>(null);
  // Đã tự thử lại một lần sau 429 chưa — chỉ tự thử MỘT lần cho mỗi chuỗi khôi phục.
  const autoRetriedRef = useRef(false);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const reloadMe = useCallback(async () => {
    const me = await auth.getMe();
    setUser(me);
    setStatus('authenticated');
    return me;
  }, []);

  // client.ts gọi khi refresh bị máy chủ từ chối: xoá phiên, về đăng nhập (nhớ trang đang đứng).
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearSession();
      void navigateRef.current('/dang-nhap', { replace: true, state: { from: window.location.pathname } });
    });
    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  // Khôi phục phiên khi tải lại trang: cookie refresh (httpOnly) đổi lấy access token mới.
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setStatus('loading');
    setRestoreError(null);
    setRestoreBusy(null);
    auth
      .refreshSession(false)
      .then(() => auth.getMe())
      .then((me) => {
        if (cancelled) return;
        autoRetriedRef.current = false;
        setUser(me);
        setStatus('authenticated');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isRateLimited(err)) {
          // Giữ nguyên trạng thái 'loading' (cửa gác không đá về đăng nhập), không xoá thẻ; báo bận và tự thử lại một lần.
          const waitMs = retryAfterSeconds(err) * 1000;
          const autoRetry = !autoRetriedRef.current;
          setRestoreBusy({ retryAt: Date.now() + waitMs, autoRetry });
          if (autoRetry) {
            retryTimer = setTimeout(() => {
              autoRetriedRef.current = true;
              setRestoreAttempt((n) => n + 1);
            }, waitMs);
          }
          return;
        }
        autoRetriedRef.current = false;
        clearSession();
        // Chưa đăng nhập / cookie hết hạn là bình thường; lỗi khác thì báo cho người dùng.
        if (!(err instanceof ApiError && err.code === 'UNAUTHENTICATED')) setRestoreError(err);
      });
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [restoreAttempt, clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      await auth.login(email, password);
      setRestoreError(null);
      await reloadMe();
    },
    [reloadMe],
  );

  const register = useCallback(
    async (input: RegisterInput, idempotencyKey: string) => {
      await auth.register(input, idempotencyKey);
      setRestoreError(null);
      await reloadMe();
    },
    [reloadMe],
  );

  const logout = useCallback(async () => {
    await auth.logout();
    clearSession();
    void navigateRef.current('/dang-nhap', { replace: true });
  }, [clearSession]);

  const selectOrg = useCallback((orgId: string) => {
    setSelectedOrgId(orgId);
    writeSelectedOrgId(orgId);
  }, []);

  const organizations = useMemo(() => user?.organizations ?? [], [user]);
  const currentOrg = useMemo(
    () => organizations.find((o) => o.id === selectedOrgId) ?? organizations[0] ?? null,
    [organizations, selectedOrgId],
  );
  // Người dùng tự bấm thử lại: chuỗi khôi phục mới, lại được tự thử một lần nếu gặp 429.
  const retryRestore = useCallback(() => {
    autoRetriedRef.current = false;
    setRestoreAttempt((n) => n + 1);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      restoreError,
      user,
      organizations,
      currentOrg,
      selectOrg,
      login,
      register,
      logout,
      reloadMe,
      retryRestore,
    }),
    [status, restoreError, user, organizations, currentOrg, selectOrg, login, register, logout, reloadMe, retryRestore],
  );

  return (
    <SessionContext.Provider value={value}>
      {restoreBusy ? <RestoreBusyNotice key={restoreBusy.retryAt} busy={restoreBusy} onRetry={retryRestore} /> : null}
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession phải dùng bên trong SessionProvider');
  return v;
}
