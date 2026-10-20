// Máy trạng thái của cổng học viên /hv (bản vẽ E mục 5.1). Không React Router, không SessionProvider: cổng chỉ có một địa chỉ.
//
//   khởi động: key = '#k=' trong địa chỉ → GET /portal/me
//     200 → Trang (có key thì xoá # bằng history.replaceState, KHÔNG gọi mở lần nữa: không tốn suất máy)
//     401 + có key → Nhập 4 số;  401 không key → Chưa có phiên;  403 → Tạm đóng;  mạng hỏng → Không tải được
//   Nhập 4 số → POST /portal/session: 201 → xoá # → GET /me → Trang; 401 → MỘT lời chung PORTAL_DENIED_MESSAGE; 429 → đợi
//   Trang: bất kỳ 401 → Chưa có phiên; quay lại trang sau ≥ 8 phút → tải lại /me (URL ảnh chỉ sống 10 phút)
import { useCallback, useEffect, useRef, useState } from 'react';
import { PORTAL_DENIED_MESSAGE, PORTAL_SESSION_INVALID_MESSAGE, type PortalMe } from '@makeup/shared';
import { PortalHttpError, portalApi } from './api';
import { PortalPage } from './PortalPage';
import { ClosedScreen, LoadingScreen, NoSessionScreen, OpenScreen, ProblemScreen } from './screens';

export const REFRESH_AFTER_MS = 8 * 60_000;
const RATE_MESSAGE = 'Thử quá nhiều lần, vui lòng đợi một phút rồi thử lại.';
const NETWORK_MESSAGE = 'Không kết nối được. Kiểm tra mạng rồi thử lại.';

type View =
  | { k: 'loading' }
  | { k: 'open' }
  | { k: 'none'; notice: string | null }
  | { k: 'closed' }
  | { k: 'problem' }
  | { k: 'page'; me: PortalMe; offset: number };

/** Chìa trong '#k=…' (phần sau # không bao giờ gửi lên máy chủ). */
export function readKeyFromHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const k = new URLSearchParams(raw).get('k');
  return k !== null && k !== '' ? k : null;
}

function clearHash(): void {
  if (window.location.hash !== '') window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

/** Tên trung tâm lên tiêu đề tab và tên dưới biểu tượng khi học viên cài (apple-mobile-web-app-title). */
function applyCenterName(name: string): void {
  document.title = name;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'apple-mobile-web-app-title';
    document.head.appendChild(meta);
  }
  meta.content = name;
}

export function PortalApp() {
  const keyRef = useRef<string | null>(readKeyFromHash(window.location.hash));
  const [view, setView] = useState<View>({ k: 'loading' });
  const loadedAt = useRef(0);
  const started = useRef(false);

  const showPage = useCallback((me: PortalMe) => {
    loadedAt.current = Date.now();
    applyCenterName(me.center.name);
    setView({ k: 'page', me, offset: Date.parse(me.serverTime) - Date.now() });
  }, []);

  /** Tải /me. `silent`: giữ trang cũ khi lỗi mạng (tải lại nền). */
  const loadMe = useCallback(
    async (silent: boolean) => {
      try {
        const me = await portalApi.me();
        if (keyRef.current !== null) {
          clearHash();
          keyRef.current = null;
        }
        showPage(me);
      } catch (e) {
        if (e instanceof PortalHttpError && e.status === 401) {
          setView(keyRef.current !== null && !silent ? { k: 'open' } : { k: 'none', notice: silent ? PORTAL_SESSION_INVALID_MESSAGE : null });
        } else if (e instanceof PortalHttpError && e.status === 403) {
          setView({ k: 'closed' });
        } else if (!silent) {
          setView({ k: 'problem' });
        }
      }
    },
    [showPage],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void loadMe(false);
  }, [loadMe]);

  // Quay lại trang sau ≥ 8 phút: tải lại (URL ảnh sống 10 phút).
  useEffect(() => {
    if (view.k !== 'page') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - loadedAt.current >= REFRESH_AFTER_MS) void loadMe(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [view.k, loadMe]);

  /** Trả null khi thành công, hoặc lời báo để hiện. */
  const submitOpen = async (last4: string): Promise<string | null> => {
    const key = keyRef.current;
    if (key === null) return PORTAL_DENIED_MESSAGE;
    try {
      await portalApi.open(key, last4);
    } catch (e) {
      if (e instanceof PortalHttpError) return e.status === 429 ? RATE_MESSAGE : e.status === 401 ? PORTAL_DENIED_MESSAGE : NETWORK_MESSAGE;
      return NETWORK_MESSAGE;
    }
    clearHash();
    keyRef.current = null;
    await loadMe(false);
    return null;
  };

  const submitClaim = async (code: string): Promise<string | null> => {
    try {
      await portalApi.claim(code);
    } catch (e) {
      if (e instanceof PortalHttpError) return e.status === 429 ? RATE_MESSAGE : e.status === 401 ? PORTAL_DENIED_MESSAGE : NETWORK_MESSAGE;
      return NETWORK_MESSAGE;
    }
    await loadMe(false);
    return null;
  };

  switch (view.k) {
    case 'loading':
      return <LoadingScreen />;
    case 'open':
      return <OpenScreen onSubmit={submitOpen} />;
    case 'none':
      return <NoSessionScreen notice={view.notice} onClaim={submitClaim} />;
    case 'closed':
      return <ClosedScreen />;
    case 'problem':
      return (
        <ProblemScreen
          onRetry={() => {
            setView({ k: 'loading' });
            void loadMe(false);
          }}
        />
      );
    case 'page':
      return (
        <PortalPage
          me={view.me}
          clockOffsetMs={view.offset}
          onSessionLost={() => setView({ k: 'none', notice: PORTAL_SESSION_INVALID_MESSAGE })}
          onSignedOut={() => setView({ k: 'none', notice: 'Đã thoát khỏi máy này.' })}
        />
      );
  }
}
