import { useEffect, useMemo, useState } from 'react';
import { getRevenueReport } from '../../api/payments';
import { errorKind, userMessage } from '../../api/errors';
import type { ContractKind, RevenueContractRow, RevenueCourseGroupRow, RevenueMonthRow, RevenueReport } from '../../api/types';
import { ForbiddenBanner } from '../../layout/ErrorStates';
import { PageHeader } from '../../layout/PageHeader';
import { Button, Card, Chip, EmptyState, ListDetail, Segmented, SkeletonText, StatGrid, StatTile } from '../../ui';
import { money } from '../payments/money';
import { sixMonthsTo } from './period';
import { PeriodFilter } from './PeriodFilter';
import { RevenueByContractTable } from './RevenueByContractTable';
import { RevenueByCourseTable } from './RevenueByCourseTable';
import { RevenueChart } from './RevenueChart';
import { usePeriodParam } from './usePeriodParam';
import '../payments/payments.css';
import './reports.css';

type ContractReport = Extract<RevenueReport, { groupBy: 'contract' }>;
type CourseReport = Extract<RevenueReport, { groupBy: 'courseGroup' | 'course' }>;
type Load<T> = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; data: T };

// Lọc loại hợp đồng và cách nhóm nằm trên đường dẫn (?loai=khoa-hoc&nhom=khoa) để gửi link xem đúng bảng.
type KindKey = 'ALL' | ContractKind;
type GroupKey = 'contract' | 'courseGroup' | 'course';
const KIND_PARAM: Record<string, ContractKind> = { 'khoa-hoc': 'COURSE', 'dich-vu': 'SERVICE' };
const KIND_SLUG: Record<ContractKind, string> = { COURSE: 'khoa-hoc', SERVICE: 'dich-vu' };
const GROUP_PARAM: Record<string, GroupKey> = { 'nhom-khoa': 'courseGroup', khoa: 'course' };
const GROUP_SLUG: Record<GroupKey, string | null> = { contract: null, courseGroup: 'nhom-khoa', course: 'khoa' };
const KIND_CHIPS: { value: KindKey; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'SERVICE', label: 'Dịch vụ' },
  { value: 'COURSE', label: 'Khoá học' },
];
const GROUPS: { value: GroupKey; label: string }[] = [
  { value: 'contract', label: 'Hợp đồng' },
  { value: 'courseGroup', label: 'Nhóm khoá' },
  { value: 'course', label: 'Khoá' },
];
const KIND_TEXT: Record<KindKey, string> = { ALL: 'khoá học + dịch vụ makeup', COURSE: 'hợp đồng khoá học', SERVICE: 'hợp đồng dịch vụ makeup' };

// Báo cáo › Doanh thu (bản vẽ C2 mục 3.4) — khuôn thống kê C của v3. Mọi số lấy nguyên GET /reports/revenue;
// chữ trong 4 tooltip lấy nguyên `basis` máy chủ trả.
export function RevenueScreen({ orgId, orgSlug, academy = false }: { orgId: string; orgSlug: string; academy?: boolean }) {
  const [period, setPeriod, params, setParams] = usePeriodParam();
  // Chỉ tổ chức đào tạo mới có hợp đồng khoá học — tổ chức khác không có chip loại, không gửi kind.
  const kind: KindKey = academy ? (KIND_PARAM[params.get('loai') ?? ''] ?? 'ALL') : 'ALL';
  const group: GroupKey = kind === 'COURSE' ? (GROUP_PARAM[params.get('nhom') ?? ''] ?? 'contract') : 'contract';
  const setFilter = (k: KindKey, g: GroupKey) => {
    const next = new URLSearchParams(params);
    if (k === 'ALL') next.delete('loai');
    else next.set('loai', KIND_SLUG[k]);
    const slug = k === 'COURSE' ? GROUP_SLUG[g] : null;
    if (slug) next.set('nhom', slug);
    else next.delete('nhom');
    setParams(next);
  };
  const [report, setReport] = useState<Load<ContractReport>>({ status: 'loading' });
  const [byCourse, setByCourse] = useState<Load<CourseReport> | null>(null);
  const [months, setMonths] = useState<Load<RevenueMonthRow[]>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const chartRange = useMemo(() => sixMonthsTo(period), [period]);

  useEffect(() => {
    const controller = new AbortController();
    setReport({ status: 'loading' });
    getRevenueReport(orgId, { from: period.from, to: period.to, ...(kind === 'ALL' ? {} : { kind }), groupBy: 'contract' }, controller.signal)
      .then((r) => {
        if (r.groupBy === 'contract') setReport({ status: 'ready', data: r });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setReport({ status: 'error', error });
      });
    return () => controller.abort();
  }, [orgId, period.from, period.to, kind, attempt]);

  useEffect(() => {
    if (group === 'contract') {
      setByCourse(null);
      return undefined;
    }
    const controller = new AbortController();
    setByCourse({ status: 'loading' });
    getRevenueReport(orgId, { from: period.from, to: period.to, kind: 'COURSE', groupBy: group }, controller.signal)
      .then((r) => {
        if (r.groupBy === 'course' || r.groupBy === 'courseGroup') setByCourse({ status: 'ready', data: r });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setByCourse({ status: 'error', error });
      });
    return () => controller.abort();
  }, [orgId, period.from, period.to, group, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    setMonths({ status: 'loading' });
    getRevenueReport(orgId, { ...chartRange, ...(kind === 'ALL' ? {} : { kind }), groupBy: 'month' }, controller.signal)
      .then((r) => {
        if (r.groupBy === 'month') setMonths({ status: 'ready', data: r.rows });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setMonths({ status: 'error', error });
      });
    return () => controller.abort();
  }, [orgId, chartRange, kind, attempt]);


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
        {group !== 'contract' &&
          (byCourse?.status === 'ready' ? (
            <RevenueByCourseTable
              level={byCourse.data.groupBy}
              rows={byCourse.data.rows as RevenueCourseGroupRow[]}
              totals={byCourse.data.totals}
              allocation={byCourse.data.allocation}
            />
          ) : byCourse?.status === 'error' ? (
            <Card title={group === 'course' ? 'Theo khoá' : 'Theo nhóm khoá'}>
              <EmptyState message={userMessage(byCourse.error)} action={<Button onClick={() => setAttempt((n) => n + 1)}>Thử lại</Button>} />
            </Card>
          ) : (
            <Card title={group === 'course' ? 'Theo khoá' : 'Theo nhóm khoá'}>
              <SkeletonText lines={4} label="Đang tải bảng theo khoá" />
            </Card>
          ))}
        {r ? (
          <RevenueByContractTable orgSlug={orgSlug} rows={r.rows as RevenueContractRow[]} courseMode={kind === 'COURSE'} />
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
      <PageHeader
        title="Doanh thu"
        actions={<span className="rp-ph-sub">{period.label}{academy ? ` · ${KIND_TEXT[kind]}` : ''} · mốc tính: ngày xác nhận hợp đồng</span>}
      />
      <ListDetail
        variant="narrow"
        className="rp-ld"
        list={
          <PeriodFilter period={period} onChange={setPeriod}>
            {academy && (
              <>
                <div className="rp-grp" id="rp-loai">
                  Loại hợp đồng
                </div>
                <div className="rp-chips" role="group" aria-labelledby="rp-loai">
                  {KIND_CHIPS.map((o) => (
                    <Chip key={o.value} selected={kind === o.value} onClick={() => setFilter(o.value, group)}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
                {kind === 'COURSE' && (
                  <>
                    <div className="rp-grp" id="rp-nhom">
                      Nhóm theo
                    </div>
                    <Segmented<GroupKey> size="sm" block aria-labelledby="rp-nhom" options={GROUPS} value={group} onChange={(g) => setFilter('COURSE', g)} />
                  </>
                )}
              </>
            )}
          </PeriodFilter>
        }
        detail={detail}
        listLabel="Bộ lọc"
        detailLabel="Số liệu doanh thu"
      />
    </div>
  );
}
