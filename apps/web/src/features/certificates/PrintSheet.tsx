import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CertificateView } from '../../api/certificates';
import { Button } from '../../ui';
import { useBreakpoint, type Breakpoint } from '../../layout/useBreakpoint';
import { PrintArea } from './PrintArea';
import { buildCertificatePdf } from './pdf';
import { renderCertificates, refreshViewsOf, type RenderDeps, type RenderOutcome } from './render';
import { canShareFile, downloadFile, makePdfFile, makePngFile, shareFile, type ShareOutcome } from './share';
import { estimateMegabytes, formatBytes, isLargeBatch, isSmallPhoto, pngFileName, progressText, withPdfExt } from './logic';
import './certificates.css';

// Bản in dùng chung cho hộp cấp, sổ, hồ sơ học viên (bản vẽ F mục 6.4). Đầu vào: các giấy ĐÃ CẤP (CertificateView, chữ là bản
// chụp lúc cấp → in lại ra y hệt) và tên tệp gốc. Vẽ lần lượt từng người → một PDF nhiều trang A4 ngang.
// Lỗi một người không làm mất cả lô. Máy tính: In ngay / Tải PDF / Tải ảnh / Chia sẻ PDF (nếu máy chia sẻ được tệp).
// Điện thoại (≤ 640): Chia sẻ PDF (In / Zalo / Lưu) là nút chính, Tải PDF, Lưu ảnh từng người; KHÔNG có "In ngay"
// (Safari iPhone in sai khổ ngang).

export interface PrintMetrics {
  count: number;
  failed: number;
  renderMs: number;
  pdfMs: number;
  pdfBytes: number;
  pdfPages: number;
}

export interface PrintSheetProps {
  orgId: string;
  items: CertificateView[];
  // "Giay-chung-nhan-K12-2026-12-20" (đuôi .pdf có hay không đều được).
  baseName: string;
  // Tiêu đề trong tệp PDF: "Giấy chứng nhận — Lớp K12".
  pdfTitle: string;
  // Vừa cấp: "Đã cấp 7 giấy chứng nhận (CC-2026-0008 → 0014)." Không có thì dải xanh chỉ ghi số trang.
  issuedNote?: string | null;
  // Mặc định tự vẽ khi mở. false: chờ nơi gọi bấm (ít dùng).
  autoStart?: boolean;
  // Ghi đè khổ màn (bài thử); không truyền thì theo màn thật.
  breakpoint?: Breakpoint;
  // Gọi khi vẽ + ghép PDF xong (đo thời gian, cỡ tệp).
  onFinished?: (m: PrintMetrics) => void;
  // Thay bộ vẽ (bài thử).
  renderDeps?: Partial<RenderDeps>;
}

interface PngEntry {
  url: string;
  file: File;
}

interface PdfState {
  file: File;
  pages: number;
  bytes: number;
  buildMs: number;
}

type Phase = 'idle' | 'rendering' | 'packing' | 'done' | 'stopped' | 'failed';

export function PrintSheet({ orgId, items, baseName, pdfTitle, issuedNote = null, autoStart = true, breakpoint, onFinished, renderDeps }: PrintSheetProps) {
  const detected = useBreakpoint();
  const phone = (breakpoint ?? detected) === 'phone';
  const pdfName = withPdfExt(baseName);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<{ done: number; total: number; current: string | null }>({ done: 0, total: items.length, current: null });
  const [outcomes, setOutcomes] = useState<Map<string, RenderOutcome>>(new Map());
  const [pngs, setPngs] = useState<Map<string, PngEntry>>(new Map());
  const [pdf, setPdf] = useState<PdfState | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<Set<string>>(new Set());
  const renderMsRef = useRef(0);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;
  const depsRef = useRef(renderDeps);
  depsRef.current = renderDeps;

  const itemsKey = items.map((c) => c.id).join(',');

  const dropUrls = useCallback(() => {
    for (const u of urlsRef.current) URL.revokeObjectURL(u);
    urlsRef.current.clear();
  }, []);

  // Ghép PDF từ các trang đã vẽ xong (theo thứ tự `items`).
  const pack = useCallback(
    async (list: CertificateView[], done: Map<string, RenderOutcome>, signal: AbortSignal): Promise<PdfState | null> => {
      const jpegs = list.flatMap((v) => {
        const p = done.get(v.id)?.page;
        return p ? [p.jpeg] : [];
      });
      if (jpegs.length === 0) return null;
      const t0 = performance.now();
      const res = await buildCertificatePdf(jpegs, pdfTitle);
      if (signal.aborted) return null;
      return { file: makePdfFile(res.bytes, pdfName), pages: res.pageCount, bytes: res.bytes.byteLength, buildMs: performance.now() - t0 };
    },
    [pdfTitle, pdfName],
  );

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    dropUrls();
    setOutcomes(new Map());
    setPngs(new Map());
    setPdf(null);
    setFatal(null);
    setShareMsg(null);
    setPhase('rendering');
    setProgress({ done: 0, total: items.length, current: null });
    try {
      const t0 = performance.now();
      const list = await renderCertificates(items, {
        signal: ctl.signal,
        refresh: refreshViewsOf(orgId),
        deps: depsRef.current,
        onProgress: (p) => setProgress({ done: p.done, total: p.total, current: p.current }),
      });
      renderMsRef.current = performance.now() - t0;
      const map = new Map(list.map((o) => [o.view.id, o]));
      const pngMap = new Map<string, PngEntry>();
      for (const o of list) {
        if (!o.page) continue;
        const url = URL.createObjectURL(o.page.png);
        urlsRef.current.add(url);
        pngMap.set(o.view.id, { url, file: makePngFile(o.page.png, pngFileName(o.view.code, o.view.studentName)) });
      }
      setOutcomes(map);
      setPngs(pngMap);
      setPhase('packing');
      const packed = await pack(items, map, ctl.signal);
      if (ctl.signal.aborted) return;
      setPdf(packed);
      setPhase('done');
      finishedRef.current?.({
        count: items.length,
        failed: list.filter((o) => !o.page).length,
        renderMs: renderMsRef.current,
        pdfMs: packed?.buildMs ?? 0,
        pdfBytes: packed?.bytes ?? 0,
        pdfPages: packed?.pages ?? 0,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setPhase('stopped');
        return;
      }
      setFatal(err instanceof Error ? err.message : String(err));
      setPhase('failed');
    }
  }, [items, orgId, pack, dropUrls]);

  // Mở ra là vẽ ngay; đổi danh sách giấy thì vẽ lại; đóng thì dừng và gỡ ảnh.
  useEffect(() => {
    if (autoStart && items.length > 0) void run();
    return () => {
      abortRef.current?.abort();
      dropUrls();
    };
    // run phụ thuộc items (đã gói trong itemsKey): chỉ vẽ lại khi tập giấy đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, autoStart]);

  const stop = () => abortRef.current?.abort();

  // Thử lại MỘT người vẽ lỗi: vẽ riêng người đó rồi ghép lại PDF (người khác giữ nguyên).
  const retryOne = async (v: CertificateView) => {
    const ctl = new AbortController();
    abortRef.current = ctl;
    setRetrying(v.id);
    try {
      const [again] = await renderCertificates([v], { signal: ctl.signal, refresh: refreshViewsOf(orgId), deps: depsRef.current });
      if (!again) return;
      const map = new Map(outcomes);
      map.set(v.id, again);
      if (again.page) {
        const url = URL.createObjectURL(again.page.png);
        urlsRef.current.add(url);
        setPngs((old) => new Map(old).set(v.id, { url, file: makePngFile(again.page!.png, pngFileName(v.code, v.studentName)) }));
      }
      setOutcomes(map);
      setPdf(await pack(items, map, ctl.signal));
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) setFatal(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrying(null);
    }
  };

  const failures = useMemo(() => items.flatMap((v) => (outcomes.get(v.id)?.error ? [{ view: v, error: outcomes.get(v.id)?.error as string }] : [])), [items, outcomes]);
  const warnings = useMemo(() => items.flatMap((v) => outcomes.get(v.id)?.page?.warnings ?? []), [items, outcomes]);
  const smallPhotos = useMemo(() => items.filter((v) => isSmallPhoto(v.photo)), [items]);
  const okViews = useMemo(() => items.filter((v) => outcomes.get(v.id)?.page), [items, outcomes]);
  const printImages = useMemo(
    () => okViews.flatMap((v) => (pngs.get(v.id) ? [{ key: v.id, url: (pngs.get(v.id) as PngEntry).url, alt: `Giấy chứng nhận ${v.code} — ${v.studentName}` }] : [])),
    [okViews, pngs],
  );

  const handleShare = (out: Promise<ShareOutcome>, fallback?: () => void) => {
    void out.then((o) => {
      if (o.kind === 'failed') setShareMsg(o.message);
      else if (o.kind === 'unsupported') fallback?.();
      else setShareMsg(null);
    });
  };

  // Chia sẻ PDF: lời gọi navigator.share nằm NGAY trong lượt bấm (không await trước) — xem share.ts.
  const sharePdfNow = () => {
    if (!pdf) return;
    handleShare(shareFile(pdf.file, 'Giấy chứng nhận'), () => downloadFile(pdf.file));
  };
  const saveImage = (id: string) => {
    const e = pngs.get(id);
    if (!e) return;
    if (phone) handleShare(shareFile(e.file, 'Giấy chứng nhận'), () => downloadFile(e.file));
    else downloadFile(e.file);
  };

  const canShare = pdf ? canShareFile(pdf.file) : false;
  const working = phase === 'rendering' || phase === 'packing';
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const pages = pdf?.pages ?? 0;

  return (
    <section className="gcn-sheet" aria-label="Bản in giấy chứng nhận">
      {isLargeBatch(items.length) && (
        <div className="gcn-band gcn-band--warn" role="note">
          Tệp lớn (~{estimateMegabytes(items.length)} MB), vẽ có thể mất vài phút. Giữ màn hình sáng đến khi xong.
        </div>
      )}

      {working && (
        <div className="gcn-progress" role="status" aria-live="polite">
          <div className="gcn-progress__row">
            <span className="gcn-progress__text">{phase === 'packing' ? 'Đang ghép tệp PDF…' : progressText(progress.done, progress.total, progress.current)}</span>
            {phase === 'rendering' && (
              <Button size="sm" onClick={stop}>
                Dừng
              </Button>
            )}
          </div>
          <div className="gcn-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={phase === 'packing' ? 100 : pct} aria-label="Tiến độ vẽ">
            <div className="gcn-bar__fill" style={{ width: `${phase === 'packing' ? 100 : pct}%` }} />
          </div>
        </div>
      )}

      {phase === 'stopped' && (
        <div className="gcn-band gcn-band--warn" role="status">
          <div className="gcn-band__row">
            <span>Đã dừng vẽ. Phần đã vẽ được bỏ đi, chưa có tệp PDF.</span>
            <Button size="sm" onClick={() => void run()}>
              Vẽ lại
            </Button>
          </div>
        </div>
      )}

      {phase === 'failed' && fatal && (
        <div className="gcn-band gcn-band--error" role="alert">
          <div className="gcn-band__row">
            <span>Không làm được tệp PDF: {fatal}</span>
            <Button size="sm" onClick={() => void run()}>
              Thử lại
            </Button>
          </div>
        </div>
      )}

      {phase === 'done' && pdf && (
        <div className="gcn-band gcn-band--ok" role="status">
          <span>
            {issuedNote ? `${issuedNote} ` : `Đã vẽ ${pages} giấy chứng nhận. `}
            <strong>
              Tệp PDF: {pages} trang A4 ngang, mỗi học viên một trang ({formatBytes(pdf.bytes)}).
            </strong>
          </span>
        </div>
      )}

      {failures.map((f) => (
        <div className="gcn-band gcn-band--error" role="alert" key={f.view.id}>
          <div className="gcn-band__row">
            <span>{f.error}</span>
            <Button size="sm" loading={retrying === f.view.id} disabled={working || retrying !== null} onClick={() => void retryOne(f.view)}>
              Thử lại người này
            </Button>
          </div>
        </div>
      ))}
      {failures.length > 0 && phase === 'done' && (
        <div className="gcn-band gcn-band--warn" role="note">
          Tệp PDF chưa có giấy của: {failures.map((f) => f.view.studentName).join(', ')}.
        </div>
      )}
      {warnings.map((w) => (
        <div className="gcn-band gcn-band--warn" role="note" key={w}>
          {w}
        </div>
      ))}
      {smallPhotos.length > 0 && phase === 'done' && (
        <div className="gcn-band gcn-band--warn" role="note">
          Ảnh nhỏ, in có thể mờ: {smallPhotos.map((v) => `${v.studentName} (${v.photo?.width}×${v.photo?.height})`).join(', ')}.
        </div>
      )}
      {shareMsg && (
        <div className="gcn-band gcn-band--warn" role="alert">
          {shareMsg}
        </div>
      )}

      {phase === 'done' && pdf && (
        <>
          <div className="gcn-actions">
            {phone ? (
              <>
                {canShare && (
                  <Button variant="primary" onClick={sharePdfNow}>
                    Chia sẻ PDF (In / Zalo / Lưu)
                  </Button>
                )}
                <Button variant={canShare ? 'default' : 'primary'} onClick={() => downloadFile(pdf.file)}>
                  Tải PDF
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={() => setPrinting(true)} disabled={printing || printImages.length === 0}>
                  In ngay
                </Button>
                <Button onClick={() => downloadFile(pdf.file)}>Tải PDF ({pages} trang)</Button>
                {canShare && <Button onClick={sharePdfNow}>Chia sẻ PDF</Button>}
              </>
            )}
          </div>
          {!phone && <p className="gcn-file">Mở hộp in của máy. Chọn khổ A4, hướng Ngang, lề Không. Tệp: {pdf.file.name}</p>}
          {phone && <p className="gcn-file">Tệp: {pdf.file.name}</p>}
        </>
      )}

      {phase === 'done' && okViews.length > 0 && (
        <ul className="gcn-list" aria-label="Từng học viên">
          {okViews.map((v) => (
            <li className="gcn-list__item" key={v.id}>
              <span className="gcn-list__name">
                <b>{v.studentName}</b>
                <span>{v.reissueNo > 0 ? `${v.code} · bản cấp lại` : v.code}</span>
              </span>
              <Button size="sm" onClick={() => saveImage(v.id)}>
                {phone ? 'Lưu ảnh' : 'Tải ảnh'}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {printing && <PrintArea images={printImages} onFinished={() => setPrinting(false)} />}
    </section>
  );
}
