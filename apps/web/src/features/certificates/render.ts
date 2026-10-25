import { CERTIFICATE_IDS_MAX, CERTIFICATE_IMAGE } from '@makeup/shared';
import { listCertificates, type CertificateView } from '../../api/certificates';
import { renderTemplatePng } from '../designs/exportPng';
import { certificateFrameSrc, frameInputOfView } from './frame';

// Vẽ giấy chứng nhận thành ảnh, LẦN LƯỢT từng người (bản vẽ F mục 7.2) — không song song, để điện thoại khỏi hết bộ nhớ:
// 1) ảnh học viên + logo tải về blob cùng nguồn (html-to-image chỉ nhúng được ảnh cùng nguồn), tối đa 4 cùng lúc, tải trước
//    trong lúc đang vẽ người trước; gặp lỗi (URL ký hết hạn 10 phút → 403) thì hỏi máy chủ URL mới đúng MỘT lần rồi thử lại;
//    vẫn hỏng → vẽ không ảnh (tệp mẫu tự in chữ cái đầu) kèm dòng vàng, không bỏ người đó;
// 2) vẽ bằng renderTemplatePng(tệp mẫu, '1754x1240') của designs/exportPng.ts;
// 3) PNG đổi sang JPEG chất lượng 0,92 (nền trắng); PDF chỉ giữ JPEG, PNG giữ để "Tải ảnh" / "In ngay".
// Lỗi MỘT người không làm mất cả lô: người đó thành `error`, người khác vẫn xong.

export const IMAGE_FETCH_CONCURRENCY = 4;
export const JPEG_QUALITY = 0.92;

export interface RenderedPage {
  view: CertificateView;
  png: Blob;
  jpeg: Uint8Array;
  // Dòng vàng ("Không tải được ảnh của X — đã in chữ cái đầu").
  warnings: string[];
}

export interface RenderOutcome {
  view: CertificateView;
  page: RenderedPage | null;
  // Có khi vẽ lỗi: lời báo tiếng Việt kèm lý do kỹ thuật ngắn.
  error: string | null;
}

export interface RenderProgress {
  done: number;
  total: number;
  // Tên người đang vẽ; null khi xong.
  current: string | null;
  elapsedMs: number;
}

export interface RenderDeps {
  renderPng: (src: string) => Promise<Blob>;
  fetchBlob: (url: string, signal?: AbortSignal) => Promise<Blob>;
  toJpeg: (png: Blob) => Promise<Uint8Array>;
  makeBlobUrl: (blob: Blob) => string;
  revokeBlobUrl: (url: string) => void;
  now: () => number;
}

export interface RenderOptions {
  onProgress?: (p: RenderProgress) => void;
  signal?: AbortSignal;
  // Lấy lại giấy theo mã để có URL ảnh ký mới (GET /certificates?ids=). Không có thì không thử lại ảnh.
  refresh?: (ids: string[]) => Promise<CertificateView[]>;
  deps?: Partial<RenderDeps>;
}

export async function fetchImageBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Máy chủ trả ${res.status} khi tải ảnh`);
  return res.blob();
}

// PNG 1754×1240 → JPEG (nền trắng) cho PDF. Chỉ trả byte của JPEG.
export async function pngToJpeg(png: Blob): Promise<Uint8Array> {
  const bmp = await createImageBitmap(png);
  const canvas = document.createElement('canvas');
  try {
    canvas.width = CERTIFICATE_IMAGE.width;
    canvas.height = CERTIFICATE_IMAGE.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không cho vẽ canvas 2D');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('Không đổi được ảnh sang JPEG');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    bmp.close();
    // Trả bộ nhớ canvas ngay (Safari giữ canvas lớn rất lâu).
    canvas.width = 0;
    canvas.height = 0;
  }
}

const DEFAULT_DEPS: RenderDeps = {
  renderPng: (src) => renderTemplatePng(src, '1754x1240'),
  fetchBlob: fetchImageBlob,
  toJpeg: pngToJpeg,
  makeBlobUrl: (b) => URL.createObjectURL(b),
  revokeBlobUrl: (u) => URL.revokeObjectURL(u),
  now: () => performance.now(),
};

// Hàm lấy lại giấy theo mã cho một tổ chức; mã nhiều hơn 50 thì chia lô.
export function refreshViewsOf(orgId: string): (ids: string[]) => Promise<CertificateView[]> {
  return async (ids) => {
    const out: CertificateView[] = [];
    for (let i = 0; i < ids.length; i += CERTIFICATE_IDS_MAX) {
      const page = await listCertificates(orgId, { ids: ids.slice(i, i + CERTIFICATE_IDS_MAX), pageSize: CERTIFICATE_IDS_MAX });
      out.push(...page.items);
    }
    return out;
  };
}

function abortError(): DOMException {
  return new DOMException('Đã dừng vẽ', 'AbortError');
}

function limiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    active -= 1;
    queue.shift()?.();
  };
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        active += 1;
        fn().then(resolve, reject).finally(next);
      };
      if (active < max) run();
      else queue.push(run);
    });
}

type Fetched = { ok: true; blob: Blob } | { ok: false };

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Vẽ nhiều giấy. Trả kết quả đúng thứ tự `views`. Dừng giữa chừng (signal) → ném AbortError, phần đã vẽ bị bỏ.
export async function renderCertificates(views: CertificateView[], opts: RenderOptions = {}): Promise<RenderOutcome[]> {
  const deps: RenderDeps = { ...DEFAULT_DEPS, ...opts.deps };
  const { signal } = opts;
  const t0 = deps.now();
  const total = views.length;
  const limit = limiter(IMAGE_FETCH_CONCURRENCY);
  const blobUrls = new Set<string>();
  const logoByUrl = new Map<string, string>();

  const attempt = (url: string): Promise<Fetched> =>
    limit(() => deps.fetchBlob(url, signal)).then(
      (blob): Fetched => ({ ok: true, blob }),
      (): Fetched => ({ ok: false }),
    );

  // Tải trước ảnh học viên (tối đa 4 cùng lúc) trong lúc đang vẽ người trước.
  const photoFirst = new Map<string, Promise<Fetched>>();
  for (const v of views) if (v.photo) photoFirst.set(v.id, attempt(v.photo.url));

  // Lấy lại URL mới: đúng MỘT lần cho cả lô (URL ký cùng hết hạn một lúc), dùng chung cho mọi người.
  let refreshed: Promise<Map<string, CertificateView> | null> | null = null;
  const fresh = (): Promise<Map<string, CertificateView> | null> => {
    if (!opts.refresh) return Promise.resolve(null);
    refreshed ??= opts.refresh(views.map((v) => v.id)).then(
      (list) => new Map(list.map((c) => [c.id, c])),
      () => null,
    );
    return refreshed;
  };

  const urlOf = (blob: Blob): string => {
    const u = deps.makeBlobUrl(blob);
    blobUrls.add(u);
    return u;
  };

  async function loadPhoto(v: CertificateView, warnings: string[]): Promise<string | null> {
    if (!v.photo) return null;
    let got = await (photoFirst.get(v.id) as Promise<Fetched>);
    if (!got.ok) {
      const map = await fresh();
      const url = map?.get(v.id)?.photo?.url;
      if (url) got = await attempt(url);
    }
    if (!got.ok) {
      warnings.push(`Không tải được ảnh của ${v.studentName} — đã in chữ cái đầu`);
      return null;
    }
    return urlOf(got.blob);
  }

  async function loadLogo(v: CertificateView, warnings: string[]): Promise<string | null> {
    if (!v.logo) return null;
    const known = logoByUrl.get(v.logo.url);
    if (known) return known;
    let got = await attempt(v.logo.url);
    if (!got.ok) {
      const map = await fresh();
      const url = map?.get(v.id)?.logo?.url;
      if (url) got = await attempt(url);
    }
    if (!got.ok) {
      warnings.push(`Không tải được logo của ${v.studentName} — đã bỏ logo`);
      return null;
    }
    const made = urlOf(got.blob);
    logoByUrl.set(v.logo.url, made);
    return made;
  }

  const outcomes: RenderOutcome[] = [];
  try {
    for (const [i, v] of views.entries()) {
      if (signal?.aborted) throw abortError();
      opts.onProgress?.({ done: i, total, current: v.studentName, elapsedMs: deps.now() - t0 });
      try {
        const warnings: string[] = [];
        const photo = await loadPhoto(v, warnings);
        const logo = await loadLogo(v, warnings);
        if (signal?.aborted) throw abortError();
        const src = certificateFrameSrc(frameInputOfView(v), { photo, logo });
        const png = await deps.renderPng(src);
        const jpeg = await deps.toJpeg(png);
        if (photo) {
          deps.revokeBlobUrl(photo);
          blobUrls.delete(photo);
        }
        outcomes.push({ view: v, page: { view: v, png, jpeg, warnings }, error: null });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        outcomes.push({ view: v, page: null, error: `Không vẽ được giấy của ${v.studentName}: ${message(err)}` });
      }
    }
    opts.onProgress?.({ done: total, total, current: null, elapsedMs: deps.now() - t0 });
    return outcomes;
  } finally {
    for (const u of blobUrls) deps.revokeBlobUrl(u);
    blobUrls.clear();
  }
}
