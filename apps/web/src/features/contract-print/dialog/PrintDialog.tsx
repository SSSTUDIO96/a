import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Link, useParams } from 'react-router';
import {
  PRINT_LAYOUT_NAMES,
  blockAppliesTo,
  resolvePrintConfig,
  type ContractPrintData,
  type PrintBlockOverrides,
  type ResolvedPrintConfig,
  type ToggleBlockKey,
} from '@makeup/shared';
import { ApiError, userMessage } from '../../../api/errors';
import { newIdempotencyKey } from '../../../api/idempotency';
import { createContractPrint, getContractPrint, getPrintData } from '../../../api/print';
import type { ContractPrintResult, PrintCreateInput, PrintDataResult, PrintRecordView, PrintTemplateView, PrintWarning } from '../../../api/types';
import { useOnline } from '../../../layout/ErrorStates';
import { Button, Skeleton, Switch } from '../../../ui';
import { PrintFrame, PrintPaper, usePaperReady, type PrintMark } from '../paper';
import { defaultChoice } from './defaultChoice';
import { printDiff } from './printDiff';
import { formatDateTimeIn, isStandaloneApp, isWebKitPrint, localDateIn, SAFARI_FOOTER_WARNING, type NavLike } from './printEnv';
import './dialog.css';

// Hộp "In hợp đồng" (bản vẽ G mục 4.4). Web CHỈ chọn mẫu, bật/tắt khối và gọi máy chủ: dữ liệu in, tiền, mã băm do máy chủ dựng.
// Luồng bấm In: POST nhật ký in (Idempotency-Key giữ khi thử lại cùng nội dung) → có phản hồi 201 mới gắn dấu lần in vào chân trang
// và gọi window.print(). 409 (mẫu / dữ liệu đổi, hợp đồng huỷ) → không in, tải lại và nói rõ cách xử lý.

export interface PrintDialogProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  /** Múi giờ của tổ chức: giờ lần in trước và ngày ghi ở chân trang. */
  tz: string;
  contractId: string;
  /** has('contracts.texts'): có liên kết "Sửa mẫu in" tới Cài đặt › Mẫu in hợp đồng. */
  canManageTemplates: boolean;
  phone: boolean;
}

interface Loaded {
  pd: PrintDataResult;
  // Bản chụp lần in gần nhất (che theo người xem hiện tại). null: chưa in lần nào hoặc không tải được (snapError).
  snap: ContractPrintResult | null;
  snapError: string | null;
}

type Sel = { kind: 'LAST' } | { kind: 'TEMPLATE'; id: string } | { kind: 'NONE' };

interface Preview {
  data: ContractPrintData;
  config: ResolvedPrintConfig;
  logoUrl: string | null;
  hash: string;
  warnings: PrintWarning[];
  body: PrintCreateInput;
  /** Số lần in của dấu ở chân trang: in lại y hệt thì ghi số của bản gốc ("In lại bản lần k"). */
  markNo: number | null;
}

interface Notice {
  tone: 'warn' | 'danger';
  text: string;
  hint?: string;
  changes?: string[];
}

interface Recorded {
  sig: string;
  record: PrintRecordView;
  mark: PrintMark;
}

const QUICK: { key: ToggleBlockKey; label: string }[] = [
  { key: 'da-thu', label: 'Kèm phiếu thu đã nhận' },
  { key: 'chuyen-khoan', label: 'Tài khoản chuyển khoản' },
  { key: 'ky-nhay', label: 'Ô ký nháy cuối mỗi trang' },
];

const nextFrame = () => new Promise<void>((res) => requestAnimationFrame(() => res()));

export function reasonOf(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const r = (err.details as { reason?: unknown } | undefined)?.reason;
  return typeof r === 'string' ? r : null;
}

async function fetchAll(orgId: string, contractId: string, signal: AbortSignal): Promise<Loaded> {
  const pd = await getPrintData(orgId, contractId, signal);
  if (!pd.lastPrint) return { pd, snap: null, snapError: null };
  try {
    return { pd, snap: await getContractPrint(orgId, contractId, pd.lastPrint.id, signal), snapError: null };
  } catch (err) {
    if (signal.aborted) throw err;
    return { pd, snap: null, snapError: userMessage(err) };
  }
}

function navLike(): NavLike {
  const n = navigator as Navigator & { standalone?: boolean };
  return { userAgent: n.userAgent, platform: n.platform, maxTouchPoints: n.maxTouchPoints, standalone: n.standalone };
}

export function PrintDialog({ open, onClose, orgId, tz, contractId, canManageTemplates, phone }: PrintDialogProps) {
  const { orgSlug } = useParams();
  const online = useOnline();
  const [view, setView] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sel, setSel] = useState<Sel>({ kind: 'NONE' });
  const [reprint, setReprint] = useState(false);
  const [quick, setQuick] = useState<PrintBlockOverrides>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [recorded, setRecorded] = useState<Recorded | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [pages, setPages] = useState<number | null>(null);
  const attempt = useRef<{ sig: string; key: string } | null>(null);
  const mounted = useRef(true);
  const viewRef = useRef<Loaded | null>(null);
  viewRef.current = view;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Chọn sẵn theo hàm thuần defaultChoice (bảng 4.4).
  const applyDefault = useCallback((v: Loaded) => {
    const last = v.snap && v.pd.lastPrint ? { templateId: v.pd.lastPrint.templateId, sameData: v.pd.lastPrint.sameData } : null;
    const c = defaultChoice({ status: v.pd.contract.status, lastPrint: last, templates: v.pd.templates, defaultTemplateId: v.pd.defaultTemplateId });
    if (c.source === 'NONE') setSel({ kind: 'NONE' });
    else if (c.source === 'TEMPLATE') setSel({ kind: 'TEMPLATE', id: c.templateId });
    else {
      setSel({ kind: 'LAST' });
      setReprint(c.source === 'REPRINT');
    }
  }, []);

  // Tải lần đầu (và khi bấm "Thử lại").
  const [retryTick, setRetryTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    setView(null);
    setLoadError(null);
    setNotice(null);
    setRecorded(null);
    setCancelled(false);
    setQuick({});
    attempt.current = null;
    fetchAll(orgId, contractId, ac.signal).then(
      (v) => {
        if (ac.signal.aborted) return;
        setView(v);
        setCancelled(v.pd.contract.status === 'CANCELLED');
        applyDefault(v);
      },
      (err: unknown) => {
        if (!ac.signal.aborted) setLoadError(userMessage(err));
      },
    );
    return () => ac.abort();
  }, [open, orgId, contractId, retryTick, applyDefault]);

  // ---------- Bản xem trước + thân POST của lựa chọn hiện tại ----------
  const preview: Preview | null = useMemo(() => {
    if (!view) return null;
    const { pd, snap } = view;
    const kind = pd.contract.kind;
    const overrides: PrintBlockOverrides = {};
    for (const [k, v] of Object.entries(quick) as [ToggleBlockKey, boolean][]) if (blockAppliesTo(k, kind)) overrides[k] = v;
    const hasOverrides = Object.keys(overrides).length > 0;
    if (sel.kind === 'LAST' && snap && pd.lastPrint) {
      const reprintNow = pd.lastPrint.sameData || reprint;
      if (reprintNow) {
        return {
          data: snap.data,
          config: snap.config,
          logoUrl: snap.logoUrl,
          hash: snap.dataHash,
          warnings: snap.warnings,
          body: { source: 'REPRINT', basedOnPrintId: snap.print.id, expectedDataHash: snap.dataHash },
          markNo: snap.print.printNo,
        };
      }
      const config: ResolvedPrintConfig = { ...snap.config, blocks: { ...snap.config.blocks, ...overrides } };
      return {
        data: pd.data,
        config,
        logoUrl: pd.logoUrl,
        hash: pd.dataHash,
        warnings: pd.warnings,
        body: { source: 'PRIOR_CONFIG', basedOnPrintId: snap.print.id, ...(hasOverrides ? { blockOverrides: overrides } : {}), expectedDataHash: pd.dataHash },
        markNo: null,
      };
    }
    if (sel.kind === 'TEMPLATE') {
      const t = pd.templates.find((x) => x.id === sel.id);
      if (!t) return null;
      return {
        data: pd.data,
        config: resolvePrintConfig(t, kind, overrides),
        logoUrl: pd.logoUrl,
        hash: pd.dataHash,
        warnings: pd.warnings,
        body: { source: 'TEMPLATE', templateId: t.id, expectedTemplateVersion: t.version, ...(hasOverrides ? { blockOverrides: overrides } : {}), expectedDataHash: pd.dataHash },
        markNo: null,
      };
    }
    return null;
  }, [view, sel, reprint, quick]);

  const sig = preview ? JSON.stringify(preview.body) : null;
  const ready = usePaperReady(preview?.logoUrl ?? null);
  const logoUrl = preview && ready.logoOk ? preview.logoUrl : null;
  const mark = recorded && recorded.sig === sig ? recorded.mark : undefined;
  const justRecorded = recorded && recorded.sig === sig ? recorded.record : null;

  // ---------- Hành động ----------
  const touch = () => {
    setNotice(null);
  };

  const reloadAfterConflict = async (): Promise<Loaded | null> => {
    const ac = new AbortController();
    try {
      const v = await fetchAll(orgId, contractId, ac.signal);
      if (!mounted.current) return null;
      setView(v);
      setCancelled(v.pd.contract.status === 'CANCELLED');
      // Giữ lựa chọn nếu còn dùng được; không thì chọn lại theo mặc định.
      setSel((cur) => {
        if (cur.kind === 'TEMPLATE' && v.pd.templates.some((t) => t.id === cur.id)) return cur;
        if (cur.kind === 'LAST' && v.snap && v.pd.lastPrint) return cur;
        const last = v.snap && v.pd.lastPrint ? { templateId: v.pd.lastPrint.templateId, sameData: v.pd.lastPrint.sameData } : null;
        const c = defaultChoice({ status: v.pd.contract.status, lastPrint: last, templates: v.pd.templates, defaultTemplateId: v.pd.defaultTemplateId });
        if (c.source === 'TEMPLATE') return { kind: 'TEMPLATE', id: c.templateId };
        if (c.source === 'NONE') return { kind: 'NONE' };
        return { kind: 'LAST' };
      });
      return v;
    } catch (err) {
      if (mounted.current) setNotice({ tone: 'danger', text: userMessage(err), hint: 'Không tải lại được dữ liệu hợp đồng. Kiểm tra mạng rồi mở lại hộp In.' });
      return null;
    }
  };

  const doPrint = async () => {
    if (!preview || sig === null || busy || !ready.ready || !online || cancelled) return;
    setBusy(true);
    setNotice(null);
    const body = preview.body;
    // Cùng nội dung bấm lại sau lỗi mạng / máy chủ → CÙNG khoá (máy chủ không ghi hai dòng nhật ký). Nội dung khác → khoá mới.
    const key = attempt.current && attempt.current.sig === sig ? attempt.current.key : newIdempotencyKey();
    attempt.current = { sig, key };
    const before = viewRef.current;
    let record: PrintRecordView;
    try {
      record = await createContractPrint(orgId, contractId, body, key);
    } catch (err) {
      if (!mounted.current) return;
      setBusy(false);
      await explain(err, before);
      return;
    }
    attempt.current = null;
    if (!mounted.current) return;
    const m: PrintMark = { printNo: preview.markNo ?? record.printNo, printedOn: localDateIn(record.printedAt, tz), source: body.source };
    // Dấu lần in phải nằm trên tờ TRƯỚC khi hộp in của trình duyệt chụp trang.
    flushSync(() => {
      setRecorded({ sig, record, mark: m });
      setBusy(false);
    });
    await nextFrame();
    window.print();
  };

  // Lời tiếng Việt + cách xử lý cho lỗi ghi nhật ký in. Không bao giờ mở hộp in ở đây.
  const explain = async (err: unknown, before: Loaded | null) => {
    const reason = reasonOf(err);
    const retryHint = 'Chưa ghi được lần in. Bấm "In / Lưu PDF" lần nữa để thử lại — hệ thống không ghi trùng.';
    if (reason === 'CONTRACT_CANCELLED') {
      attempt.current = null;
      setCancelled(true);
      setNotice({ tone: 'danger', text: userMessage(err), hint: 'Hợp đồng đã huỷ nên không có bản in. Đóng hộp này; muốn in thì nhờ người quản lý mở lại hợp đồng.' });
    } else if (reason === 'DATA_CHANGED' || reason === 'TEMPLATE_CHANGED') {
      attempt.current = null;
      const fresh = await reloadAfterConflict();
      if (!mounted.current || !fresh) return;
      const changes = reason === 'DATA_CHANGED' && before ? printDiff(before.pd.data, fresh.pd.data) : [];
      setNotice({
        tone: 'warn',
        text: userMessage(err),
        hint:
          reason === 'DATA_CHANGED'
            ? 'Bản xem trước đã được làm mới theo dữ liệu mới nhất. Kiểm tra lại rồi bấm "In / Lưu PDF" lần nữa.'
            : 'Bản xem trước đã dùng bản mẫu mới. Kiểm tra lại rồi bấm "In / Lưu PDF" lần nữa.',
        changes,
      });
    } else if (err instanceof ApiError && (err.code === 'NETWORK' || err.status >= 500)) {
      // Giữ khoá: bấm lại là gửi lại đúng yêu cầu đó, không ghi trùng.
      setNotice({ tone: 'danger', text: userMessage(err), hint: retryHint });
    } else {
      attempt.current = null;
      setNotice({
        tone: 'danger',
        text: userMessage(err),
        hint: err instanceof ApiError && err.status === 403 ? 'Tài khoản của bạn không có quyền in hợp đồng này.' : 'Đóng hộp rồi mở lại để tải dữ liệu mới.',
      });
    }
  };

  const reopenPrinter = () => window.print();

  // ---------- Dựng giao diện ----------
  const nav = typeof navigator === 'undefined' ? null : navLike();
  const safariWarn = !!preview && !!nav && isWebKitPrint(nav) && (preview.config.blocks['so-trang'] || preview.config.blocks['ky-nhay']);
  const standalone = !!nav && isStandaloneApp(nav);
  const pd = view?.pd ?? null;
  const last = pd?.lastPrint && view?.snap ? pd.lastPrint : null;
  const labelBase = phone ? 'In / PDF' : 'In / Lưu PDF';
  const canPrint = !!preview && ready.ready && online && !busy && !cancelled;

  const setQuickKey = (k: ToggleBlockKey, v: boolean) => {
    touch();
    setQuick((q) => ({ ...q, [k]: v }));
  };

  const aside: ReactNode = loadError ? (
    <div className="hdin-ctl">
      <div className="hdin-note hdin-note--danger" role="alert">
        <b>{loadError}</b>
        <p>Chưa tải được dữ liệu in.</p>
        <Button size="sm" onClick={() => setRetryTick((n) => n + 1)}>
          Thử lại
        </Button>
      </div>
    </div>
  ) : !view || !pd ? (
    <div className="hdin-ctl" role="status" aria-label="Đang tải dữ liệu in">
      <Skeleton height={20} width="60%" />
      <Skeleton height={58} />
      <Skeleton height={58} />
      <Skeleton height={40} />
    </div>
  ) : (
    <div className="hdin-ctl">
      {cancelled && (
        <div className="hdin-note hdin-note--danger" role="alert">
          <b>Hợp đồng đã huỷ — không in</b>
        </div>
      )}
      {pd.templates.length === 0 && !last && (
        <div className="hdin-note hdin-note--warn" role="status">
          <b>Chưa có mẫu in cho loại hợp đồng này</b>
          {canManageTemplates && orgSlug && (
            <p>
              Tạo mẫu ở <Link to={`/${orgSlug}/cai-dat/mau-in`}>Cài đặt › Mẫu in hợp đồng</Link>.
            </p>
          )}
        </div>
      )}
      {view.snapError && (
        <div className="hdin-note hdin-note--warn" role="status">
          Không tải được bản đã in lần trước: {view.snapError}
        </div>
      )}

      {!cancelled && (last || pd.templates.length > 0) && (
        <fieldset className="hdin-opts">
          <legend>Chọn mẫu in</legend>
          {last && view.snap && (
            <>
              <label className={`hdin-opt${sel.kind === 'LAST' ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="hdin-sel"
                  checked={sel.kind === 'LAST'}
                  onChange={() => {
                    touch();
                    setSel({ kind: 'LAST' });
                  }}
                />
                <span className="hdin-opt__body">
                  <b>
                    Giữ mẫu đã in — {view.snap.config.templateName} · bản v{last.templateVersion}
                  </b>
                  <small>
                    Lần in {last.printNo}: {formatDateTimeIn(last.printedAt, tz)} · {last.printedBy.fullName}
                  </small>
                  {last.sameData && <small>Dữ liệu hợp đồng không đổi kể từ lần in này.</small>}
                </span>
              </label>
              {sel.kind === 'LAST' && !last.sameData && (
                <div className="hdin-reprint">
                  <div className="hdin-qs">
                    <span id="hdin-reprint-l">In lại y hệt bản đã in</span>
                    <Switch
                      aria-labelledby="hdin-reprint-l"
                      checked={reprint}
                      onChange={(v) => {
                        touch();
                        setReprint(v);
                      }}
                    />
                  </div>
                  <p className="hdin-hint">{reprint ? 'In đúng nội dung của lần in trước, không lấy dữ liệu mới.' : 'Giữ mẫu và các khối đã in, nhưng lấy dữ liệu hiện tại.'}</p>
                  <p className="hdin-hint">
                    <b>Từ lần in {last.printNo}, hợp đồng đã đổi:</b>
                  </p>
                  <ul className="hdin-diff">
                    {printDiff(view.snap.data, pd.data).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {pd.templates.map((t: PrintTemplateView) => {
            const changed = last && last.templateId === t.id && t.version > last.templateVersion;
            const on = sel.kind === 'TEMPLATE' && sel.id === t.id;
            return (
              <label key={t.id} className={`hdin-opt${on ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="hdin-sel"
                  checked={on}
                  onChange={() => {
                    touch();
                    setSel({ kind: 'TEMPLATE', id: t.id });
                  }}
                />
                <span className="hdin-opt__body">
                  <b>
                    {t.name} · bản v{t.version}
                    {t.id === pd.defaultTemplateId && <span className="hdin-tag">Mặc định</span>}
                  </b>
                  <small>
                    Bố cục {t.layout} · {PRINT_LAYOUT_NAMES[t.layout]}
                  </small>
                  {changed && last && (
                    <small className="hdin-opt__warn">
                      Đã sửa từ v{last.templateVersion} lên v{t.version} sau lần in trước
                    </small>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      {!cancelled && preview && preview.body.source !== 'REPRINT' && (
        <fieldset className="hdin-quick">
          <legend>Chỉ cho lần in này</legend>
          {QUICK.map(({ key, label }) => {
            const noBank = key === 'chuyen-khoan' && preview.data.studio.bank === null;
            const noPay = key === 'da-thu' && preview.data.paymentsHidden;
            const off = noBank || noPay;
            const id = `hdin-q-${key}`;
            return (
              <div className="hdin-qs" key={key}>
                <span id={id}>
                  {label}
                  {noBank && <small className="hdin-hint"> · chưa nhập ngân hàng</small>}
                  {noPay && <small className="hdin-hint"> · bạn không có quyền xem thu tiền</small>}
                </span>
                <Switch aria-labelledby={id} checked={off ? false : preview.config.blocks[key]} disabled={off} onChange={(v) => setQuickKey(key, v)} />
              </div>
            );
          })}
        </fieldset>
      )}
      {!cancelled && preview && preview.body.source === 'REPRINT' && <p className="hdin-hint">In lại y hệt: không đổi được khối nào. Muốn bật hoặc tắt khối, tắt “In lại y hệt bản đã in”.</p>}

      {preview && pages !== null && (
        <p className="hdin-pages" data-pages={pages}>
          Khoảng {pages} trang A4
        </p>
      )}
      {(preview?.warnings.length ?? 0) > 0 && (
        <ul className="hdin-warns" aria-label="Lưu ý khi in">
          {preview!.warnings.map((w) => (
            <li key={w.code}>{w.message}</li>
          ))}
        </ul>
      )}
      {safariWarn && <p className="hdin-safari">{SAFARI_FOOTER_WARNING}</p>}
      {standalone && (
        <div className="hdin-note hdin-note--warn" role="status">
          <b>Mở bằng Safari để in</b>
          <p>App thêm ra màn hình chính có thể không mở được hộp in.</p>
          <Button
            size="sm"
            onClick={() => {
              try {
                void navigator.clipboard.writeText(window.location.href);
              } catch {
                /* trình duyệt không cho chép: người dùng tự sao chép đường dẫn */
              }
            }}
          >
            Chép đường dẫn
          </Button>
        </div>
      )}
      {canManageTemplates && orgSlug && pd.templates.length > 0 && (
        <p className="hdin-hint">
          <Link to={`/${orgSlug}/cai-dat/mau-in`}>Sửa mẫu in</Link>
        </p>
      )}
    </div>
  );

  const footer = (
    <div className="hdin-foot">
      {notice && (
        <div className={`hdin-note hdin-note--${notice.tone}`} role="alert">
          <b>{notice.text}</b>
          {notice.changes && notice.changes.length > 0 && (
            <ul className="hdin-diff">
              {notice.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          {notice.hint && <p>{notice.hint}</p>}
        </div>
      )}
      {justRecorded && !notice && (
        <div className="hdin-note hdin-note--ok" role="status">
          <b>Đã ghi lần in thứ {justRecorded.printNo}</b>
          <button type="button" className="hdin-link" onClick={reopenPrinter}>
            Hộp in không hiện? Mở lại
          </button>
        </div>
      )}
      {!online && (
        <p className="hdin-hint" role="status">
          Cần mạng để ghi nhật ký in
        </p>
      )}
      <div className="hdin-foot__btns">
        <Button onClick={onClose}>Đóng</Button>
        <Button variant="primary" onClick={() => void doPrint()} loading={busy} disabled={!canPrint && !busy}>
          {!ready.ready && preview ? 'Đang chuẩn bị bản in…' : labelBase}
        </Button>
      </div>
    </div>
  );

  return (
    <PrintFrame
      open={open}
      onClose={onClose}
      title="In hợp đồng"
      eyebrow={pd ? `${pd.contract.code}${pd.contract.status === 'DRAFT' ? ' · Nháp' : ''}` : undefined}
      layout={preview?.config.layout ?? 2}
      aside={aside}
      footer={footer}
      onPages={setPages}
    >
      {preview ? (
        <PrintPaper data={preview.data} config={preview.config} logoUrl={logoUrl} printMark={mark} />
      ) : (
        <div className="hdin-empty" aria-hidden="true" />
      )}
    </PrintFrame>
  );
}
