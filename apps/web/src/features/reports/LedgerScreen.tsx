import { useEffect, useMemo, useState } from 'react';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentKind, type PaymentMethod } from '@makeup/shared';
import { listPayments } from '../../api/payments';
import { errorKind, userMessage } from '../../api/errors';
import type { PaymentLedger, PaymentLedgerEntry, PaymentLedgerQuery } from '../../api/types';
import { ForbiddenBanner } from '../../layout/ErrorStates';
import { PageHeader } from '../../layout/PageHeader';
import { Button, Card, Chip, EmptyState, ListDetail, SkeletonText, StatGrid, StatTile } from '../../ui';
import { money } from '../payments/money';
import { downloadText, ledgerCsv } from './csv';
import { LedgerTable } from './LedgerTable';
import { PeriodFilter } from './PeriodFilter';
import { usePeriodParam } from './usePeriodParam';
import '../payments/payments.css';
import './reports.css';

const PAGE_SIZE = 50;
// Máy chủ cho tối đa 100 dòng/lần: tải CSV đi từng trang 100.
const CSV_PAGE_SIZE = 100;

const KIND_OPTIONS: { value: PaymentKind; label: string }[] = [
  { value: 'RECEIPT', label: 'Phiếu thu' },
  { value: 'REFUND', label: 'Phiếu hoàn' },
];

type LedgerResp = PaymentLedger & { totalsOverflow?: boolean };
type Load = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: LedgerResp; key: string };

function isMethod(v: string | null): v is PaymentMethod {
  return v !== null && (PAYMENT_METHODS as readonly string[]).includes(v);
}

// Báo cáo › Sổ thu (bản vẽ C2 mục 3.5) — GET /payments theo kỳ [from, to), lọc cách trả và loại phiếu.
export function LedgerScreen({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const [period, setPeriod, params, setParams] = usePeriodParam();
  const methodParam = params.get('cach-tra');
  const kindParam = params.get('loai');
  const method: PaymentMethod | undefined = isMethod(methodParam) ? methodParam : undefined;
  const kind: PaymentKind | undefined = kindParam === 'RECEIPT' || kindParam === 'REFUND' ? kindParam : undefined;
  const page = Math.max(1, Number(params.get('trang')) || 1);
  const [state, setState] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const query = useMemo<PaymentLedgerQuery>(
    () => ({ from: period.from, to: period.to, method, kind }),
    [period.from, period.to, method, kind],
  );

  const loadKey = JSON.stringify([query, page]);
  useEffect(() => {
    const controller = new AbortController();
    // Đổi bộ lọc: giữ bảng cũ trong lúc tải (đỡ nhảy), nhưng ô số chuyển sang đang tải cho tới khi có số của bộ lọc mới.
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' }));
    listPayments(orgId, { ...query, page, pageSize: PAGE_SIZE }, controller.signal)
      .then((data) => setState({ status: 'ready', data, key: JSON.stringify([query, page]) }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', error });
      });
    return () => controller.abort();
  }, [orgId, query, page, attempt]);

  function setFilter(key: string, value: string | undefined) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('trang');
    setParams(next);
  }

  function setPage(p: number) {
    const next = new URLSearchParams(params);
    if (p > 1) next.set('trang', String(p));
    else next.delete('trang');
    setParams(next);
  }

  async function exportCsv() {
    setCsvBusy(true);
    setCsvError(null);
    try {
      const all: PaymentLedgerEntry[] = [];
      for (let p = 1; ; p++) {
        const res = await listPayments(orgId, { ...query, page: p, pageSize: CSV_PAGE_SIZE });
        all.push(...res.items);
        if (all.length >= res.total || res.items.length === 0) break;
      }
      const parts = [period.key, method?.toLowerCase(), kind?.toLowerCase()].filter(Boolean).join('-');
      downloadText(`so-thu-${parts}.csv`, ledgerCsv(all));
    } catch (err) {
      setCsvError(`Chưa tải được CSV: ${userMessage(err)}`);
    } finally {
      setCsvBusy(false);
    }
  }

  const title = useMemo(
    () => (
      <>
        Sổ thu <span className="rp-ph-sub">{period.label} · theo ngày thu</span>
      </>
    ),
    [period.label],
  );
  const csvButton = (
    <Button onClick={() => void exportCsv()} loading={csvBusy} disabled={state.status !== 'ready'}>
      Tải CSV
    </Button>
  );

  const filters = (
    <PeriodFilter period={period} onChange={setPeriod}>
      <div className="rp-grp">Cách trả</div>
      <div className="rp-chips" role="group" aria-label="Cách trả">
        <Chip selected={!method} onClick={() => setFilter('cach-tra', undefined)}>
          Tất cả
        </Chip>
        {PAYMENT_METHODS.map((m) => (
          <Chip key={m} selected={method === m} onClick={() => setFilter('cach-tra', m)}>
            {PAYMENT_METHOD_LABELS[m]}
          </Chip>
        ))}
      </div>
      <div className="rp-grp">Loại phiếu</div>
      <div className="rp-chips" role="group" aria-label="Loại phiếu">
        <Chip selected={!kind} onClick={() => setFilter('loai', undefined)}>
          Tất cả
        </Chip>
        {KIND_OPTIONS.map((k) => (
          <Chip key={k.value} selected={kind === k.value} onClick={() => setFilter('loai', k.value)}>
            {k.label}
          </Chip>
        ))}
      </div>
    </PeriodFilter>
  );

  let detail;
  if (state.status === 'error' && errorKind(state.error) === 'forbidden') {
    detail = <ForbiddenBanner>{userMessage(state.error)}</ForbiddenBanner>;
  } else if (state.status === 'error') {
    detail = (
      <Card>
        <EmptyState message={userMessage(state.error)} action={<Button onClick={() => setAttempt((n) => n + 1)}>Thử lại</Button>} />
      </Card>
    );
  } else {
    const d = state.status === 'ready' ? state.data : null;
    const fresh = state.status === 'ready' && state.key === loadKey;
    const t = fresh ? d?.totals : undefined;
    detail = (
      <>
        {d?.totalsOverflow && (
          <div className="pm-band pm-band--warn" role="status">
            <span>Có tổng quá lớn để hiện đúng (ô hiện "—"). Kiểm lại các phiếu có số tiền bất thường trong bảng dưới.</span>
          </div>
        )}
        {csvError && (
          <div className="pm-band pm-band--danger" role="alert">
            <span>{csvError}</span>
          </div>
        )}
        <StatGrid columns={3} label={`Tổng sổ thu ${period.label}`} className="rp-tiles">
          <StatTile label="Tổng thu" loading={!t} value={<span data-so="received">{money(t?.received)}</span>} note={t ? `${t.receiptCount} phiếu` : undefined} />
          <StatTile label="Tổng hoàn" loading={!t} value={<span data-so="refunded">{money(t?.refunded)}</span>} note={t ? `${t.refundCount} phiếu` : undefined} />
          <StatTile
            label="Thực thu"
            tip="Thu trừ hoàn, không tính phiếu đã huỷ."
            variant="highlight"
            loading={!t}
            value={<span data-so="net">{money(t?.net)}</span>}
          />
        </StatGrid>
        <Card flush className="rp-table-card" aria-busy={!fresh || undefined}>
          {d ? (
            <LedgerTable orgSlug={orgSlug} items={d.items} page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
          ) : (
            <div className="rp-pad">
              <SkeletonText lines={5} widths={['90%', '75%', '85%', '60%', '80%']} label="Đang tải sổ thu" />
            </div>
          )}
        </Card>
      </>
    );
  }

  return (
    <div className="rp-page">
      <PageHeader title={title} actions={csvButton} />
      <div className="rp-phone-actions">{csvButton}</div>
      <ListDetail variant="narrow" className="rp-ld" list={filters} detail={detail} listLabel="Bộ lọc" detailLabel="Sổ thu" />
    </div>
  );
}
