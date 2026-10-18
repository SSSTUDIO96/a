import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  api,
  ApiError,
  refreshSession,
  setAccessToken,
  setSessionExpiredHandler,
  type AuthResult,
  type Me,
  type MyOrganization,
} from './api';

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

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

interface SessionValue {
  status: SessionStatus;
  // Lỗi khi khôi phục phiên lúc tải trang (mất mạng, máy chủ lỗi) — khác với "chưa đăng nhập".
  restoreError: ApiError | null;
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
  const [restoreError, setRestoreError] = useState<ApiError | null>(null);
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
    const me = await api.get<Me>('/auth/me');
    setUser(me);
    setStatus('authenticated');
    return me;
  }, []);

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
    refreshSession(false)
      .then(() => api.get<Me>('/auth/me'))
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAccessToken(null);
        setUser(null);
        setStatus('anonymous');
        if (err instanceof ApiError && err.code === 'UNAUTHENTICATED') return;
        setRestoreError(err instanceof ApiError ? err : new ApiError('UNKNOWN', 'Không khôi phục được phiên đăng nhập.', 0, null));
      });
    return () => {
      cancelled = true;
    };
  }, [restoreAttempt]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<AuthResult>('/auth/login', { email, password }, { auth: false });
      setAccessToken(res.accessToken);
      setRestoreError(null);
      await reloadMe();
    },
    [reloadMe],
  );

  const register = useCallback(
    async (input: RegisterInput, idempotencyKey: string) => {
      const res = await api.create<AuthResult>('/auth/register', input, idempotencyKey, { auth: false });
      setAccessToken(res.accessToken);
      setRestoreError(null);
      await reloadMe();
    },
    [reloadMe],
  );

  const logout = useCallback(async () => {
    try {
      await api.post<undefined>('/auth/logout', {}, { auth: false });
    } catch (err) {
      // Máy chủ báo phiên vốn đã không còn → coi như đã đăng xuất. Lỗi khác (mất mạng...) thì báo lên, không giả vờ thành công.
      if (!(err instanceof ApiError && err.code === 'UNAUTHENTICATED')) throw err;
    }
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
      retryRestore: () => setRestoreAttempt((n) => n + 1),
    }),
    [status, restoreError, user, organizations, currentOrg, selectOrg, login, register, logout, reloadMe],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession phải dùng bên trong SessionProvider');
  return v;
}
