// /trang/:slug — trang giới thiệu công khai, KHÔNG cần đăng nhập, không có khung app (bản vẽ C2 mục 4.3).
// Gọi GET /public/sites/:slug không kèm thẻ đăng nhập. 404 (slug sai, chưa xuất bản, tổ chức bị khoá, thuê bao hết hạn)
// → cùng MỘT màn "Không tìm thấy trang giới thiệu", đúng như máy chủ. Mất mạng / lỗi máy chủ → báo lỗi + "Thử lại".
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { errorKind, userMessage } from '../../api/errors';
import { getPublicSite } from '../../api/profile';
import type { PublicSite } from '../../api/types';
import { Button, Skeleton } from '../../ui';
import { siteDescription } from './format';
import { SiteView } from './SiteView';
import './site.css';

type State = { status: 'loading' } | { status: 'ready'; site: PublicSite } | { status: 'missing' } | { status: 'error'; message: string };

const NOT_FOUND_TITLE = 'Không tìm thấy trang giới thiệu';

// Đặt <title> và <meta name="description"> theo thương hiệu; rời trang thì trả lại như cũ.
function useDocumentMeta(title: string | null, description: string | null) {
  useEffect(() => {
    if (title === null) return undefined;
    const prevTitle = document.title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    const prevDesc = meta?.getAttribute('content') ?? null;
    document.title = title;
    if (description) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    } else if (meta && !created) {
      meta.removeAttribute('content');
    }
    return () => {
      document.title = prevTitle;
      if (!meta) return;
      if (created) meta.remove();
      else if (prevDesc === null) meta.removeAttribute('content');
      else meta.setAttribute('content', prevDesc);
    };
  }, [title, description]);
}

export function PublicSitePage() {
  const { slug = '' } = useParams();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    getPublicSite(slug, ctrl.signal)
      .then((site) => setState({ status: 'ready', site }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        if (errorKind(err) === 'not_found') setState({ status: 'missing' });
        else setState({ status: 'error', message: userMessage(err) });
      });
    return () => ctrl.abort();
  }, [slug, attempt]);

  const title =
    state.status === 'ready'
      ? state.site.profile.brandName
      : state.status === 'missing'
        ? NOT_FOUND_TITLE
        : state.status === 'error'
          ? 'Không tải được trang giới thiệu'
          : null;
  const description = state.status === 'ready' ? siteDescription(state.site.profile) : null;
  useDocumentMeta(title, description);

  if (state.status === 'missing') {
    return (
      <main className="ps-missing">
        <div className="ps-missing__box">
          <h1>{NOT_FOUND_TITLE}</h1>
          <p>Liên kết có thể sai, hoặc studio đã gỡ trang.</p>
        </div>
      </main>
    );
  }
  if (state.status === 'error') {
    return (
      <main className="ps-missing">
        <div className="ps-missing__box" role="alert">
          <h1>Không tải được trang giới thiệu</h1>
          <p>{state.message}</p>
          <Button onClick={() => setAttempt((n) => n + 1)}>Thử lại</Button>
        </div>
      </main>
    );
  }
  return (
    <main className="ps-page">
      <div className="ps-page__inner">
        {state.status === 'loading' ? (
          <div className="ps-skel" role="status" aria-label="Đang tải trang giới thiệu">
            <div className="ps-skel__cover" />
            <div className="ps-skel__body">
              <Skeleton width="45%" height={24} />
              <Skeleton width="70%" />
              <Skeleton width="100%" height={120} />
              <Skeleton width="100%" height={120} />
            </div>
          </div>
        ) : (
          <SiteView data={state.site} />
        )}
      </div>
    </main>
  );
}
