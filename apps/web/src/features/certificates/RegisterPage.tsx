import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router';
import type { Permission } from '@makeup/shared';
import { CERTIFICATE_IDS_MAX, CERTIFICATE_MAX_BATCH, listDesignTemplates } from '@makeup/shared';
import { listCertificates, type CertificateListQuery, type CertificatePage, type CertificateStatus, type CertificateView } from '../../api/certificates';
import { errorKind, userMessage } from '../../api/errors';
import { PageHeader } from '../../layout/PageHeader';
import { useBreakpoint, type Breakpoint } from '../../layout/useBreakpoint';
import { usePermissions } from '../../layout/usePermissions';
import { Button, Card, Dialog, EmptyState, IconLock, IconWarn, Select, Skeleton, StatusTag, TextInput } from '../../ui';
import { useOrgInfo } from '../staff/useOrgInfo';
import { lopLabel, pdfFileName, todayInTz, viDate } from './logic';
import { PrintSheet } from './PrintSheet';
import type { RenderDeps } from './render';
import { ReissueDialog } from './ReissueDialog';
import { RevokeDialog } from './RevokeDialog';
import './RegisterPage.css';

// Sổ giấy chứng nhận (bản vẽ F mục 6.5; ký duyệt F câu 2): lọc theo năm / từ khoá / trạng thái / lớp, phân trang theo máy chủ (50 dòng),
// chọn một hoặc nhiều giấy còn hiệu lực → In lại (PrintSheet, chữ và ảnh là bản chụp LÚC CẤP; URL ảnh lấy mới bằng GET /certificates?ids=).
// Cấp lại (giữ số, ghi "bản cấp lại") và Thu hồi (bắt buộc lý do) chỉ người có certificates.issue; Lễ tân, Giảng viên chỉ xem và in lại.
// Máy tính: bảng. Máy tính bảng: bỏ cột Mẫu, gộp Khoá · Lớp dưới tên. Điện thoại: mỗi bản một thẻ.

export const PAGE_SIZE = 50;
export const SEARCH_DELAY_MS = 300;
const ALL_YEARS = 'tat-ca';
const STATUS_PARAM: Record<string, CertificateStatus> = { 'hieu-luc': 'ISSUED', 'da-thu-hoi': 'REVOKED' };
const STATUS_TO_PARAM: Record<CertificateStatus, string> = { ISSUED: 'hieu-luc', REVOKED: 'da-thu-hoi' };

export interface RegisterPerms {
  read: boolean;
  issue: boolean;
}

export function registerPerms(has: (p: Permission) => boolean): RegisterPerms {
  return { read: has('certificates.read'), issue: has('certificates.issue') };
}

// Chữ ở cột Trạng thái. "Hiệu lực" (bản gốc) · "Hiệu lực · bản cấp lại dd/mm/yyyy" · "Đã thu hồi".
export function statusLabel(c: Pick<CertificateView, 'status' | 'reissueNo' | 'reissuedOn'>): string {
  if (c.status === 'REVOKED') return 'Đã thu hồi';
  if (c.reissueNo > 0) {
    if (c.reissuedOn === null) throw new Error('Bản cấp lại thiếu ngày cấp lại (reissuedOn)');
    return `Hiệu lực · bản cấp lại ${viDate(c.reissuedOn)}`;
  }
  return 'Hiệu lực';
}

interface Filters {
  year: number | null;
  q: string;
  status: CertificateStatus | null;
  classId: string | null;
  customerId: string | null;
  page: number;
}

function parseFilters(params: URLSearchParams, thisYear: number): Filters {
  const nam = params.get('nam');
  const hasScope = params.get('lop') !== null || params.get('khach') !== null;
  let year: number | null;
  if (nam === ALL_YEARS) year = null;
  else if (nam !== null && /^\d{4}$/.test(nam)) year = Number(nam);
  else {
    // Không chọn năm: mặc định năm nay; đang lọc theo lớp / học viên thì xem mọi năm (giấy vừa cấp có thể thuộc năm trước).
    year = hasScope ? null : thisYear;
  }
  const tt = params.get('tt');
  return {
    year,
    q: (params.get('q') ?? '').trim().slice(0, 100),
    status: tt !== null ? (STATUS_PARAM[tt] ?? null) : null,
    classId: params.get('lop'),
    customerId: params.get('khach'),
    page: Math.max(1, Number(params.get('trang')) || 1),
  };
}

function queryOf(f: Filters): CertificateListQuery {
  const q: CertificateListQuery = { page: f.page, pageSize: PAGE_SIZE };
  if (f.year !== null) q.year = f.year;
  if (f.q) q.q = f.q;
  if (f.status) q.status = f.status;
  if (f.classId) q.classId = f.classId;
  if (f.customerId) q.customerId = f.customerId;
  return q;
}

interface Sheet {
  items: CertificateView[];
  baseName: string;
  pdfTitle: string;
  issuedNote: string | null;
  warn: string | null;
}

function sheetNames(items: readonly CertificateView[], today: string): { baseName: string; pdfTitle: string } {
  const first = items[0];
  if (!first) throw new Error('Không có giấy nào để in');
  if (items.length === 1) return { baseName: `Giay-chung-nhan-${first.code}`, pdfTitle: `Giấy chứng nhận ${first.code}` };
  const sameClass = items.every((c) => c.courseClassId === first.courseClassId);
  const sameDay = items.every((c) => c.issuedOn === first.issuedOn);
  if (sameClass && sameDay) return { baseName: pdfFileName({ className: first.className, issuedOn: first.issuedOn, today }), pdfTitle: `Giấy chứng nhận — ${first.className}` };
  return { baseName: pdfFileName({ className: null, issuedOn: null, today }), pdfTitle: 'Giấy chứng nhận' };
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico">
      <path d="M7 9V3h10v6M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v7H7z" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico" fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

// ---------- Menu ⋯ (Cấp lại, Thu hồi) ----------
interface MenuAction {
  key: string;
  label: string;
  danger?: boolean;
  onSelect: () => void;
}

// Menu gắn vào body (bảng có overflow-x nên menu tuyệt đối sẽ bị cắt). Esc đóng và trả tiêu điểm; ↑ ↓ đổi mục.
export function RowMenu({ label, actions }: { label: string; actions: readonly MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const right = Math.max(8, window.innerWidth - r.right);
    const below = window.innerHeight - r.bottom;
    setPos(below < 120 ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onFar = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onFar);
    window.addEventListener('scroll', onFar, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onFar);
      window.removeEventListener('scroll', onFar, true);
    };
  }, [open]);

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="ui-btn ui-btn--sm ui-btn--icon gcr-more"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <DotsIcon />
      </button>
      {open &&
        createPortal(
          <div ref={menuRef} role="menu" aria-label={label} className="gcr-menu" style={pos ?? { top: -9999, right: 0 }} onKeyDown={onKey}>
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                role="menuitem"
                className={`gcr-menu__item${a.danger ? ' is-danger' : ''}`}
                onClick={() => {
                  close(false);
                  a.onSelect();
                }}
              >
                {a.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

// ---------- Màn ----------
type Load = { data: CertificatePage | null; error: unknown; loading: boolean };

export interface RegisterPageProps {
  // Ghi đè khổ màn / bộ vẽ (bài thử); không truyền thì theo màn thật.
  breakpoint?: Breakpoint;
  renderDeps?: Partial<RenderDeps>;
}

export function RegisterPage({ breakpoint, renderDeps }: RegisterPageProps = {}) {
  const org = useOrgInfo();
  const has = usePermissions();
  const perms = useMemo(() => registerPerms(has), [has]);
  const detected = useBreakpoint();
  const bp = breakpoint ?? detected;
  const phone = bp === 'phone';
  const tablet = bp === 'tablet';
  const [params, setParams] = useSearchParams();
  const today = todayInTz(org.timezone);
  const thisYear = Number(today.slice(0, 4));
  const filters = useMemo(() => parseFilters(params, thisYear), [params, thisYear]);

  const [load, setLoad] = useState<Load>({ data: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);
  const [qDraft, setQDraft] = useState(filters.q);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [limitNote, setLimitNote] = useState<string | null>(null);
  const [printBusy, setPrintBusy] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [reissueTarget, setReissueTarget] = useState<CertificateView | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<CertificateView | null>(null);
  const [names, setNames] = useState<{ cls: Record<string, string>; customer: Record<string, string> }>({ cls: {}, customer: {} });

  const templateNames = useMemo(() => new Map(listDesignTemplates({ kind: 'CERTIFICATE' }).map((t) => [t.code, t.name])), []);

  // ---- Tải sổ ----
  const loadKey = JSON.stringify(queryOf(filters));
  useEffect(() => {
    const c = new AbortController();
    setLoad((s) => ({ ...s, loading: true, error: null }));
    listCertificates(org.orgId, JSON.parse(loadKey) as CertificateListQuery, c.signal)
      .then((data) => {
        if (!c.signal.aborted) setLoad({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (!c.signal.aborted) setLoad({ data: null, error, loading: false });
      });
    return () => c.abort();
  }, [org.orgId, loadKey, attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const data = load.data;
  const items = useMemo(() => data?.items ?? [], [data]);

  // Tên lớp / học viên cho chip lọc: lấy từ dòng đầu của kết quả, nhớ lại để chip không mất tên khi kết quả rỗng.
  useEffect(() => {
    if (items.length === 0) return;
    setNames((n) => {
      const next = { cls: { ...n.cls }, customer: { ...n.customer } };
      for (const c of items) {
        next.cls[c.courseClassId] = c.className;
        next.customer[c.customer.id] = c.customer.fullName;
      }
      return next;
    });
  }, [items]);

  // ---- Bộ lọc trên đường dẫn ----
  const patch = useCallback(
    (changes: Record<string, string | null>, opts: { keepSelection?: boolean } = {}) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (!('trang' in changes)) next.delete('trang');
      setParams(next, { replace: true });
      if (!opts.keepSelection) {
        setSelected(new Set());
        setLimitNote(null);
      }
    },
    [params, setParams],
  );

  // Ô tìm: gõ xong 300 ms mới đổi đường dẫn (máy chủ lọc).
  useEffect(() => {
    if (qDraft.trim() === filters.q) return undefined;
    const t = setTimeout(() => patch({ q: qDraft.trim() === '' ? null : qDraft.trim().slice(0, 100) }), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [qDraft, filters.q, patch]);
  // Đường dẫn đổi từ nơi khác (nút Xoá bộ lọc, quay lại) thì ô tìm theo.
  useEffect(() => {
    setQDraft((d) => (d.trim() === filters.q ? d : filters.q));
    // Chỉ khi q trên đường dẫn đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  const yearOptions = useMemo(() => {
    const ys = new Set<number>(data?.years ?? []);
    if (filters.year !== null) ys.add(filters.year);
    const list = [...ys].sort((a, b) => b - a).map((y) => ({ value: String(y), label: `Năm ${y}` }));
    return [{ value: ALL_YEARS, label: 'Tất cả các năm' }, ...list];
  }, [data, filters.year]);

  const narrowed = filters.q !== '' || filters.status !== null || filters.classId !== null || filters.customerId !== null;

  // ---- Chọn nhiều ----
  const selectableOnPage = useMemo(() => items.filter((c) => c.status === 'ISSUED').map((c) => c.id), [items]);
  const allOnPage = selectableOnPage.length > 0 && selectableOnPage.every((id) => selected.has(id));
  const someOnPage = selectableOnPage.some((id) => selected.has(id));
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someOnPage && !allOnPage;
  }, [someOnPage, allOnPage]);

  const toggle = (id: string) => {
    setLimitNote(null);
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else if (next.size >= CERTIFICATE_MAX_BATCH) setLimitNote(`Chọn tối đa ${CERTIFICATE_MAX_BATCH} giấy một lần.`);
      else next.add(id);
      return next;
    });
  };
  const toggleAllOnPage = () => {
    setLimitNote(null);
    setSelected((cur) => {
      const next = new Set(cur);
      if (allOnPage) for (const id of selectableOnPage) next.delete(id);
      else
        for (const id of selectableOnPage) {
          if (next.size >= CERTIFICATE_MAX_BATCH) {
            setLimitNote(`Chọn tối đa ${CERTIFICATE_MAX_BATCH} giấy một lần.`);
            break;
          }
          next.add(id);
        }
      return next;
    });
  };

  // ---- In lại: lấy URL ảnh mới (GET /certificates?ids=, từng lô 50) rồi mở bản in ----
  const printIds = async (idList: readonly string[]) => {
    if (printBusy || idList.length === 0) return;
    setPrintBusy(true);
    setPrintError(null);
    setNotice(null);
    try {
      const got: CertificateView[] = [];
      for (let i = 0; i < idList.length; i += CERTIFICATE_IDS_MAX) {
        const chunk = idList.slice(i, i + CERTIFICATE_IDS_MAX);
        const res = await listCertificates(org.orgId, { ids: chunk, pageSize: CERTIFICATE_IDS_MAX });
        got.push(...res.items);
      }
      const valid = got.filter((c) => c.status === 'ISSUED').sort((a, b) => a.year - b.year || a.seq - b.seq);
      if (valid.length === 0) {
        setPrintError('Giấy đã chọn không còn hiệu lực (đã thu hồi hoặc cấp lại), không in được. Đã tải lại sổ.');
        setSelected(new Set());
        reload();
        return;
      }
      const skipped = idList.length - valid.length;
      setSheet({
        items: valid,
        ...sheetNames(valid, today),
        issuedNote: null,
        warn: skipped > 0 ? `${skipped} giấy đã chọn không còn hiệu lực nên không có trong bản in.` : null,
      });
      if (skipped > 0) reload();
    } catch (err) {
      setPrintError(`Chưa lấy được giấy để in: ${userMessage(err)}`);
    } finally {
      setPrintBusy(false);
    }
  };

  const onReissued = (view: CertificateView) => {
    const old = reissueTarget;
    setReissueTarget(null);
    if (old) setSelected((cur) => (cur.has(old.id) ? new Set([...cur].filter((id) => id !== old.id)) : cur));
    reload();
    setSheet({
      items: [view],
      ...sheetNames([view], today),
      issuedNote: `Đã cấp lại ${view.code}, giữ nguyên số. Giấy ghi “Bản cấp lại ${view.reissuedOn ? viDate(view.reissuedOn) : viDate(today)}”.`,
      warn: null,
    });
  };

  const onRevoked = (view: CertificateView) => {
    setRevokeTarget(null);
    setSelected((cur) => (cur.has(view.id) ? new Set([...cur].filter((id) => id !== view.id)) : cur));
    setNotice(`Đã thu hồi ${view.code}. Giấy này vẫn nằm trong sổ, ghi “Đã thu hồi”.`);
    reload();
  };

  // ---- Dựng giao diện ----
  const menuFor = (c: CertificateView): MenuAction[] => [
    { key: 'reissue', label: 'Cấp lại', onSelect: () => setReissueTarget(c) },
    { key: 'revoke', label: 'Thu hồi', danger: true, onSelect: () => setRevokeTarget(c) },
  ];

  const actionsOf = (c: CertificateView): ReactNode => {
    if (c.status !== 'ISSUED') return null;
    return (
      <>
        <Button size="sm" icon={<PrintIcon />} aria-label={`In lại ${c.code}`} disabled={printBusy} onClick={() => void printIds([c.id])}>
          In lại
        </Button>
        {perms.issue &&
          (phone ? (
            <>
              <Button size="sm" variant="ghost" aria-label={`Cấp lại ${c.code}`} onClick={() => setReissueTarget(c)}>
                Cấp lại
              </Button>
              <Button size="sm" variant="ghost" className="gcr-danger" aria-label={`Thu hồi ${c.code}`} onClick={() => setRevokeTarget(c)}>
                Thu hồi
              </Button>
            </>
          ) : (
            <RowMenu label={`Thao tác khác cho ${c.code}`} actions={menuFor(c)} />
          ))}
      </>
    );
  };

  const statusCell = (c: CertificateView): ReactNode => {
    if (c.status === 'REVOKED') {
      const day = c.revokedAt ? viDate(todayInTz(org.timezone, new Date(c.revokedAt))) : null;
      return (
        <span className="gcr-status">
          <StatusTag tone="danger" title={c.revokeReason ?? undefined}>
            {statusLabel(c)}
          </StatusTag>
          <span className="gcr-status__why">
            {day ? `Thu hồi ${day}` : 'Đã thu hồi'}
            {c.revokeReason ? ` · ${c.revokeReason}` : ''}
            {c.replacedById ? ' · đã có bản cấp lại' : ''}
          </span>
        </span>
      );
    }
    return (
      <span className="gcr-status">
        <StatusTag tone="ok">{statusLabel(c)}</StatusTag>
      </span>
    );
  };

  const tplLabel = (c: CertificateView) => c.templateCode.replace(/^cc-/, '');
  const tplTitle = (c: CertificateView) => `${tplLabel(c)} · ${templateNames.get(c.templateCode) ?? c.templateCode}`;

  const checkboxOf = (c: CertificateView) =>
    c.status === 'ISSUED' ? <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Chọn ${c.code} · ${c.studentName}`} /> : null;

  let list: ReactNode;
  if (load.error) {
    const forbidden = errorKind(load.error) === 'forbidden';
    list = (
      <div className="gcr-err" role="alert">
        {forbidden ? <IconLock /> : <IconWarn />}
        <span className="gcr-err__text">{userMessage(load.error)}</span>
        {!forbidden && (
          <Button size="sm" onClick={reload}>
            Thử lại
          </Button>
        )}
      </div>
    );
  } else if (!data) {
    list = (
      <div role="status" aria-label="Đang tải sổ giấy chứng nhận" className="gcr-skel">
        <Skeleton height={44} />
        <Skeleton height={44} />
        <Skeleton height={44} />
      </div>
    );
  } else if (items.length === 0) {
    const latest = data.years.find((y) => y !== filters.year);
    if (narrowed) {
      list = (
        <EmptyState
          className="gcr-empty"
          message="Không có giấy chứng nhận nào khớp bộ lọc."
          action={
            <Button size="sm" onClick={() => patch({ q: null, tt: null, lop: null, khach: null, nam: ALL_YEARS })}>
              Xoá bộ lọc, xem mọi năm
            </Button>
          }
        />
      );
    } else if (filters.year !== null) {
      list = (
        <EmptyState
          className="gcr-empty"
          message={`Năm ${filters.year} chưa có giấy chứng nhận nào.`}
          action={
            <Button size="sm" onClick={() => patch({ nam: latest !== undefined ? String(latest) : ALL_YEARS })}>
              {latest !== undefined ? `Xem năm ${latest}` : 'Xem mọi năm'}
            </Button>
          }
        />
      );
    } else {
      list = (
        <EmptyState
          className="gcr-empty"
          message="Trung tâm chưa cấp giấy chứng nhận nào. Giấy được cấp từ thẻ lớp đã kết thúc."
          action={
            <Link className="ui-btn ui-btn--sm" to={`/${org.slug}/dao-tao`}>
              <span className="ui-btn__text">Đến Khoá &amp; lớp</span>
            </Link>
          }
        />
      );
    }
  } else if (phone) {
    list = (
      <>
        {selectableOnPage.length > 0 && (
          <label className="gcr-allrow">
            <input ref={selectAllRef} type="checkbox" checked={allOnPage} onChange={toggleAllOnPage} aria-label="Chọn tất cả giấy còn hiệu lực trên trang" />
            <span>Chọn tất cả trên trang ({selectableOnPage.length})</span>
          </label>
        )}
        <ul className="gcr-cards" aria-label="Sổ giấy chứng nhận">
          {items.map((c) => (
            <li key={c.id} className={`gcr-cardrow${c.status === 'REVOKED' ? ' is-revoked' : ''}`} data-code={c.code}>
              <div className="gcr-cardrow__top">{checkboxOf(c)}</div>
              <dl className="gcr-dl">
                <div>
                  <dt>Số</dt>
                  <dd className="gcr-code num">{c.code}</dd>
                </div>
                <div>
                  <dt>Học viên</dt>
                  <dd>{c.studentName}</dd>
                </div>
                <div>
                  <dt>Lớp</dt>
                  <dd>
                    {c.courseName} · {c.className}
                  </dd>
                </div>
                <div>
                  <dt>Ngày cấp</dt>
                  <dd>{viDate(c.issuedOn)}</dd>
                </div>
                <div>
                  <dt>Mẫu</dt>
                  <dd title={tplTitle(c)}>{tplLabel(c)}</dd>
                </div>
                <div>
                  <dt>Trạng thái</dt>
                  <dd>{statusCell(c)}</dd>
                </div>
              </dl>
              {c.status === 'ISSUED' && <div className="gcr-cardrow__btns">{actionsOf(c)}</div>}
            </li>
          ))}
        </ul>
      </>
    );
  } else {
    list = (
      <div className="gcr-wrapx">
        <table className="gcr-tbl">
          <thead>
            <tr>
              <th className="gcr-col-check">
                {selectableOnPage.length > 0 && (
                  <input ref={selectAllRef} type="checkbox" checked={allOnPage} onChange={toggleAllOnPage} aria-label="Chọn tất cả giấy còn hiệu lực trên trang" />
                )}
              </th>
              <th>Số</th>
              <th>Học viên</th>
              {!tablet && <th className="gcr-col-course">Khoá · Lớp</th>}
              <th>Ngày cấp</th>
              {!tablet && <th>Mẫu</th>}
              <th>Trạng thái</th>
              <th className="gcr-col-act">
                <span className="gcr-sr">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className={c.status === 'REVOKED' ? 'is-revoked' : undefined} data-code={c.code} data-status={c.status}>
                <td className="gcr-col-check">{checkboxOf(c)}</td>
                <td className="gcr-code num">{c.code}</td>
                <td>
                  <span className="gcr-name">{c.studentName}</span>
                  {tablet && (
                    <span className="gcr-sub">
                      {c.courseName} · {c.className}
                    </span>
                  )}
                </td>
                {!tablet && (
                  <td className="gcr-col-course">
                    <span className="gcr-name">{c.courseName}</span>
                    <span className="gcr-sub">{lopLabel(c.className)}</span>
                  </td>
                )}
                <td className="num">{viDate(c.issuedOn)}</td>
                {!tablet && (
                  <td className="num" title={tplTitle(c)}>
                    {tplLabel(c)}
                  </td>
                )}
                <td>{statusCell(c)}</td>
                <td className="gcr-col-act">
                  <div className="gcr-acts">{actionsOf(c)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = (filters.page - 1) * PAGE_SIZE + 1;
  const last = first + items.length - 1;
  const clsName = filters.classId ? (names.cls[filters.classId] ?? 'đã chọn') : '';
  const customerName = filters.customerId ? (names.customer[filters.customerId] ?? 'đã chọn') : '';
  const statusValue = filters.status ? STATUS_TO_PARAM[filters.status] : '';

  return (
    <>
      <PageHeader title="Giấy chứng nhận" actions={<span className="gcr-ph-sub">Sổ giấy chứng nhận của trung tâm</span>} />
      <div className={`gcr-page${selected.size > 0 ? ' has-sel' : ''}`}>
        {notice && (
          <div className="gcr-band gcr-band--ok" role="status">
            <span>{notice}</span>
            <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
              Đóng
            </Button>
          </div>
        )}
        {printError && (
          <div className="gcr-band gcr-band--err" role="alert">
            <span>{printError}</span>
            <Button size="sm" variant="ghost" onClick={() => setPrintError(null)}>
              Đóng
            </Button>
          </div>
        )}
        <Card flush className="gcr-card">
          <div className="gcr-filters">
            <div className="gcr-f">
              <label htmlFor="gcr-year">Năm</label>
              <Select id="gcr-year" size="sm" value={filters.year === null ? ALL_YEARS : String(filters.year)} onChange={(e) => patch({ nam: e.target.value })} options={yearOptions} />
            </div>
            <div className="gcr-f gcr-f--grow">
              <label htmlFor="gcr-q">Tìm</label>
              <TextInput
                id="gcr-q"
                type="search"
                size="sm"
                value={qDraft}
                maxLength={100}
                autoComplete="off"
                placeholder="Tìm số hoặc tên học viên"
                onChange={(e) => setQDraft(e.target.value)}
              />
            </div>
            <div className="gcr-f">
              <label htmlFor="gcr-status">Trạng thái</label>
              <Select
                id="gcr-status"
                size="sm"
                value={statusValue}
                onChange={(e) => patch({ tt: e.target.value })}
                options={[
                  { value: '', label: 'Tất cả' },
                  { value: 'hieu-luc', label: 'Hiệu lực' },
                  { value: 'da-thu-hoi', label: 'Đã thu hồi' },
                ]}
              />
            </div>
          </div>
          {(filters.classId || filters.customerId) && (
            <div className="gcr-chips">
              {filters.classId && (
                <button type="button" className="gcr-chip" aria-label={`Bỏ lọc ${lopLabel(clsName).replace(/^Lớp/i, 'lớp')}`} onClick={() => patch({ lop: null })}>
                  {lopLabel(clsName)} <span aria-hidden="true">×</span>
                </button>
              )}
              {filters.customerId && (
                <button type="button" className="gcr-chip" aria-label={`Bỏ lọc học viên ${customerName}`} onClick={() => patch({ khach: null })}>
                  Học viên {customerName} <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
          )}
          {selected.size > 0 && (
            <div className="gcr-selbar" role="region" aria-label="Giấy đã chọn">
              <span className="gcr-selbar__txt">
                Đã chọn <b>{selected.size}</b> giấy{limitNote ? ` · ${limitNote}` : ''}
              </span>
              <span className="gcr-selbar__btns">
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Bỏ chọn
                </Button>
                <Button size="sm" variant="primary" icon={<PrintIcon />} loading={printBusy} onClick={() => void printIds([...selected])}>
                  In lại ({selected.size})
                </Button>
              </span>
            </div>
          )}
          <div className="gcr-body" aria-busy={load.loading}>
            {list}
          </div>
          {data && items.length > 0 && (
            <div className="gcr-pager">
              <span>
                {first}–{last} / {total} giấy
              </span>
              {pages > 1 && (
                <span className="gcr-pager__btns">
                  <Button size="sm" disabled={filters.page <= 1} onClick={() => patch({ trang: String(filters.page - 1) }, { keepSelection: true })}>
                    Trang trước
                  </Button>
                  <span>
                    Trang {filters.page}/{pages}
                  </span>
                  <Button size="sm" disabled={filters.page >= pages} onClick={() => patch({ trang: String(filters.page + 1) }, { keepSelection: true })}>
                    Trang sau
                  </Button>
                </span>
              )}
            </div>
          )}
        </Card>
      </div>

      {reissueTarget && <ReissueDialog orgId={org.orgId} target={reissueTarget} today={today} onClose={() => setReissueTarget(null)} onReissued={onReissued} onStale={reload} />}
      <RevokeDialog orgId={org.orgId} target={revokeTarget} onClose={() => setRevokeTarget(null)} onRevoked={onRevoked} onStale={reload} />
      {sheet && (
        <Dialog
          open
          onClose={() => setSheet(null)}
          className="gcr-dlg gcr-dlg--print"
          eyebrow="Sổ giấy chứng nhận"
          title="In lại giấy chứng nhận"
          footer={
            <Button variant="primary" onClick={() => setSheet(null)}>
              Xong
            </Button>
          }
        >
          <div className="gcr-print">
            {sheet.warn && (
              <div className="gcr-band gcr-band--warn" role="note">
                {sheet.warn}
              </div>
            )}
            <PrintSheet orgId={org.orgId} items={sheet.items} baseName={sheet.baseName} pdfTitle={sheet.pdfTitle} issuedNote={sheet.issuedNote} breakpoint={bp} renderDeps={renderDeps} />
          </div>
        </Dialog>
      )}
    </>
  );
}
