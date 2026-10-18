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
    setStatus('loading');
    setRestoreError(null);
    auth
      .refreshSession(false)
      .then(() => auth.getMe())
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        clearSession();
        // Chưa đăng nhập / cookie hết hạn là bình thường; lỗi khác thì báo cho người dùng.
        if (!(err instanceof ApiError && err.code === 'UNAUTHENTICATED')) setRestoreError(err);
      });
    return () => {
      cancelled = true;
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
  const retryRestore = useCallback(() => setRestoreAttempt((n) => n + 1), []);

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

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession phải dùng bên trong SessionProvider');
  return v;
}
