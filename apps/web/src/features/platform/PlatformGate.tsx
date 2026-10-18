// Cửa vào /quan-tri (bản vẽ C2 mục 5.1, 5.7). Không có trang đăng nhập riêng, không mật khẩu chung:
// người dùng đã đăng nhập như mọi người; web gọi GET /platform/stats để biết có phải quản trị nền tảng không.
// - Đang kiểm: chỉ khối chờ 4 ô số, KHÔNG vẽ thanh trái (tránh lộ khung quản trị rồi mới giấu).
// - 404: đúng màn "Không có trang này." như đường bịa — không có chữ nào nói về quyền.
// - 200: hiện trang; số liệu đưa xuống qua PlatformStatsContext.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { errorKind, userMessage } from '../../api/errors';
import { getPlatformStats, type PlatformStats } from '../../api/platform';
import { NotFoundView } from '../../layout/ErrorStates';
import { Button, EmptyState, Skeleton } from '../../ui';
import { PlatformStatsContext } from './context';
import '../../layout/layout.css';
import './platform.css';

type GateState =
  | { status: 'checking' }
  | { status: 'ok'; stats: PlatformStats }
  | { status: 'not_found' }
  | { status: 'error'; error: unknown };

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export function PlatformGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const reloadCtl = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    setState({ status: 'checking' });
    getPlatformStats(ctl.signal).then(
      (stats) => setState({ status: 'ok', stats }),
      (err: unknown) => {
        if (isAbort(err)) return;
        setState(errorKind(err) === 'not_found' ? { status: 'not_found' } : { status: 'error', error: err });
      },
    );
    return () => ctl.abort();
  }, [attempt]);

  // Tải lại số sau khi gia hạn / khoá: giữ số cũ trên màn trong lúc chờ; lỗi thì giữ số cũ (không xoá trang).
  const reloadStats = useCallback(() => {
    reloadCtl.current?.abort();
    const ctl = new AbortController();
    reloadCtl.current = ctl;
    getPlatformStats(ctl.signal).then(
      (stats) => setState((s) => (s.status === 'ok' ? { status: 'ok', stats } : s)),
      () => undefined,
    );
  }, []);
  useEffect(() => () => reloadCtl.current?.abort(), []);

  const value = useMemo(() => (state.status === 'ok' ? { stats: state.stats, reloadStats } : null), [state, reloadStats]);

  if (state.status === 'checking') {
    return (
      <main className="sh-alone pf-gate" role="status" aria-label="Đang tải">
        <div className="ui-stats pf-gate__tiles">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="ui-stat" aria-hidden="true">
              <Skeleton width="55%" height={11} />
              <Skeleton width="70%" height={18} />
            </div>
          ))}
        </div>
      </main>
    );
  }
  if (state.status === 'not_found') {
    // Y hệt phần tử của đường bịa trong src/app/routes.tsx ('*').
    return (
      <main className="sh-alone">
        <NotFoundView message="Không có trang này." backTo="/" />
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main className="sh-alone">
        <EmptyState
          message={`Không tải được trang. ${userMessage(state.error)}`}
          action={<Button onClick={() => setAttempt((n) => n + 1)}>Thử lại</Button>}
        />
      </main>
    );
  }
  return <PlatformStatsContext.Provider value={value}>{children}</PlatformStatsContext.Provider>;
}
