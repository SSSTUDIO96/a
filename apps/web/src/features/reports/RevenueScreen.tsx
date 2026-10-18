import { useEffect, useMemo, useState } from 'react';
import { getRevenueReport } from '../../api/payments';
import { errorKind, userMessage } from '../../api/errors';
import type { RevenueContractRow, RevenueMonthRow, RevenueReport } from '../../api/types';
import { ForbiddenBanner } from '../../layout/ErrorStates';
import { PageHeader } from '../../layout/PageHeader';
import { Button, Card, EmptyState, ListDetail, SkeletonText, StatGrid, StatTile } from '../../ui';
import { money } from '../payments/money';
import { sixMonthsTo } from './period';
import { PeriodFilter } from './PeriodFilter';
import { RevenueByContractTable } from './RevenueByContractTable';
import { RevenueChart } from './RevenueChart';
import { usePeriodParam } from './usePeriodParam';
import '../payments/payments.css';
import './reports.css';

type ContractReport = Extract<RevenueReport, { groupBy: 'contract' }> & { totalsOverflow?: boolean };
type Load<T> = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

// Báo cáo › Doanh thu (bản vẽ C2 mục 3.4) — khuôn thống kê C của v3. Mọi số lấy nguyên GET /reports/revenue;
// chữ trong 4 tooltip lấy nguyên `basis` máy chủ trả.
export function RevenueScreen({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const [period, setPeriod] = usePeriodParam();
  const [report, setReport] = useState<Load<ContractReport>>({ status: 'loading' });
  const [months, setMonths] = useState<Load<RevenueMonthRow[]>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const chartRange = useMemo(() => sixMonthsTo(period), [period]);

  useEffect(() => {
    const controller = new AbortController();
    setReport({ status: 'loading' });
    getRevenueReport(orgId, { from: period.from, to: period.to, groupBy: 'contract' }, controller.signal)
      .then((r) => {
        if (r.groupBy === 'contract') setReport({ status: 'ready', data: r });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setReport({ status: 'error', error });
      });
    return () => controller.abort();
  }, [orgId, period.from, period.to, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    setMonths({ status: 'loading' });
    getRevenueReport(orgId, { ...chartRange, groupBy: 'month' }, controller.signal)
      .then((r) => {
        if (r.groupBy === 'month') setMonths({ status: 'ready', data: r.rows });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setMonths({ status: 'error', error });
      });
    return () => controller.abort();
  }, [orgId, chartRange, attempt]);

  const title = useMemo(
    () => (
      <>
        Doanh thu <span className="rp-ph-sub">{period.label} · mốc tính: ngày xác nhận hợp đồng</span>
      </>
    ),
    [period.label],
  );

  let detail;
  if (report.status === 'error' && errorKind(report.error) === 'forbidden') {
    detail = <ForbiddenBanner>{userMessage(report.error)}</ForbiddenBanner>;
  } else if (report.status === 'error') {
    detail = (
      <Card>
        <EmptyState message={userMessage(report.error)} action={<Button onClick={() => setAttempt((n) => n + 1)}>Thử lại</Button>} />
      </Card>
    );
  } else {
    const r = report.status === 'ready' ? report.data : null;
    const t = r?.totals;
    const loading = r === null;
    detail = (
      <>
        {r?.totalsOverflow && (
          <div className="pm-band pm-band--warn" role="status">
            <span>Có tổng quá lớn để hiện đúng (ô hiện "—"). Kiểm lại các phiếu có số tiền bất thường trong Sổ thu.</span>
          </div>
        )}
        <StatGrid label={`Số liệu ${period.label}`} className="rp-tiles">
          <StatTile
            label="Doanh số"
            tip={r?.basis.sales}
            loading={loading}
            value={<span data-so="sales">{money(t?.sales)}</span>}
            note={t ? `${t.contractCount} hợp đồng` : undefined}
          />
          <StatTile
            label="Cọc phải thu"
            tip={r?.basis.depositRequired}
            loading={loading}
            value={<span data-so="depositRequired">{money(t?.depositRequired)}</span>}
            note={t && (t.depositOutstanding ?? 0) > 0 ? `còn thiếu ${money(t.depositOutstanding)}` : undefined}
            noteTone="warn"
          />
          <StatTile
            label="Đã thu thực tế"
            tip={r?.basis.collected}
            loading={loading}
            value={<span data-so="collected">{money(t?.collected)}</span>}
          />
          <StatTile
            label="Còn lại"
            tip={r?.basis.outstanding}
            variant="highlight"
            loading={loading}
            value={<span data-so="outstanding">{money(t?.outstanding)}</span>}
          />
        </StatGrid>
        <RevenueChart
          rows={months.status === 'ready' ? months.data : null}
          error={months.status === 'error' ? userMessage(months.error) : null}
        />
        {r ? (
          <RevenueByContractTable orgSlug={orgSlug} rows={r.rows as RevenueContractRow[]} />
        ) : (
          <Card title="Theo hợp đồng">
            <SkeletonText lines={4} widths={['90%', '75%', '85%', '60%']} label="Đang tải bảng theo hợp đồng" />
          </Card>
        )}
      </>
    );
  }

  return (
    <div className="rp-page">
      <PageHeader title={title} />
      <ListDetail
        variant="narrow"
        className="rp-ld"
        list={<PeriodFilter period={period} onChange={setPeriod} />}
        detail={detail}
        listLabel="Bộ lọc"
        detailLabel="Số liệu doanh thu"
      />
    </div>
  );
}
