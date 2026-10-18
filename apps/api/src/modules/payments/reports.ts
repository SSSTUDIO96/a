import type { ContractStatus } from '@makeup/shared';
import { defineRoute, mustOrg, type AnyRoute } from '../../http/route';
import type { Db } from '../../lib/prisma';
import { vnd } from './common';
import { RevenueQuery } from './schemas';

// Tháng tính theo giờ Việt Nam (UTC+7, không đổi giờ mùa hè).
const VN_TZ = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// Mốc tính doanh số: confirmed_at (ngày xác nhận hợp đồng). Lý do: luôn có ở hợp đồng xác nhận/hoàn thành và database
// cấm sửa sau xác nhận (kỳ đã chốt không tự đổi số); event_date có thể trống và hợp đồng khoá học không có một ngày sự kiện.
const BASIS = {
  sales: 'Doanh số: tổng tiền các hợp đồng đã xác nhận hoặc hoàn thành có ngày xác nhận trong kỳ',
  depositRequired: 'Cọc phải thu: tổng tiền cọc của chính các hợp đồng đó',
  collected: 'Đã thu thực tế: phiếu thu trừ phiếu hoàn có ngày thu trong kỳ (mọi hợp đồng, kể cả đã huỷ), không tính phiếu đã huỷ',
  outstanding: 'Còn lại: tổng tiền chưa thu của các hợp đồng tính vào doanh số, tính đến hiện tại',
} as const;

function periodsBetween(from: Date, to: Date): string[] {
  const key = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 7);
  const last = key(new Date(to.getTime() - 1));
  const out: string[] = [];
  let [y, m] = key(from).split('-').map(Number) as [number, number];
  for (;;) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    out.push(k);
    if (k >= last) return out;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
}

interface BookedRow {
  period: string;
  contract_count: number;
  sales: bigint;
  deposit_required: bigint;
  paid_to_date: bigint;
  deposit_outstanding: bigint;
}

interface CashRow {
  period: string;
  received: bigint;
  refunded: bigint;
}

interface ContractRow {
  id: string;
  code: string;
  status: ContractStatus;
  total: bigint;
  deposit_required: bigint;
  confirmed_at: Date | null;
  event_date: Date | null;
  customer_id: string;
  customer_name: string;
  booked: boolean;
  paid: bigint;
  paid_in_period: bigint;
}

async function bookedByMonth(db: Db, orgId: string, from: string, to: string) {
  return db.$queryRaw<BookedRow[]>`
    WITH booked AS (
      SELECT c.id, c.total, c.deposit_required, to_char(c.confirmed_at AT TIME ZONE ${VN_TZ}, 'YYYY-MM') AS period
      FROM contracts c
      WHERE c.organization_id = ${orgId}::uuid AND c.status IN ('CONFIRMED', 'COMPLETED')
        AND c.confirmed_at >= ${from}::timestamptz AND c.confirmed_at < ${to}::timestamptz
    ), paid AS (
      SELECT p.contract_id, SUM(CASE WHEN p.kind = 'RECEIPT' THEN p.amount ELSE -p.amount END) AS paid
      FROM payments p JOIN booked b ON b.id = p.contract_id
      WHERE p.organization_id = ${orgId}::uuid AND p.voided_at IS NULL
      GROUP BY p.contract_id
    )
    SELECT b.period,
      COUNT(*)::int AS contract_count,
      SUM(b.total)::bigint AS sales,
      SUM(b.deposit_required)::bigint AS deposit_required,
      SUM(COALESCE(pd.paid, 0))::bigint AS paid_to_date,
      SUM(GREATEST(b.deposit_required - COALESCE(pd.paid, 0), 0))::bigint AS deposit_outstanding
    FROM booked b LEFT JOIN paid pd ON pd.contract_id = b.id
    GROUP BY b.period`;
}

async function cashByMonth(db: Db, orgId: string, from: string, to: string) {
  return db.$queryRaw<CashRow[]>`
    SELECT to_char(received_at AT TIME ZONE ${VN_TZ}, 'YYYY-MM') AS period,
      COALESCE(SUM(amount) FILTER (WHERE kind = 'RECEIPT'), 0)::bigint AS received,
      COALESCE(SUM(amount) FILTER (WHERE kind = 'REFUND'), 0)::bigint AS refunded
    FROM payments
    WHERE organization_id = ${orgId}::uuid AND voided_at IS NULL
      AND received_at >= ${from}::timestamptz AND received_at < ${to}::timestamptz
    GROUP BY 1`;
}

// Mỗi hợp đồng một dòng: hợp đồng tính vào doanh số trong kỳ HOẶC có tiền thu/hoàn trong kỳ —
// nhờ vậy cộng cột "thu trong kỳ" của mọi dòng khớp đúng từng đồng với tổng đã thu thực tế.
async function byContract(db: Db, orgId: string, from: string, to: string) {
  return db.$queryRaw<ContractRow[]>`
    WITH cand AS (
      SELECT c.id FROM contracts c
      WHERE c.organization_id = ${orgId}::uuid AND c.status IN ('CONFIRMED', 'COMPLETED')
        AND c.confirmed_at >= ${from}::timestamptz AND c.confirmed_at < ${to}::timestamptz
      UNION
      SELECT p.contract_id FROM payments p
      WHERE p.organization_id = ${orgId}::uuid AND p.voided_at IS NULL
        AND p.received_at >= ${from}::timestamptz AND p.received_at < ${to}::timestamptz
    ), pay AS (
      SELECT p.contract_id,
        SUM(CASE WHEN p.kind = 'RECEIPT' THEN p.amount ELSE -p.amount END) AS paid,
        SUM(CASE WHEN p.received_at >= ${from}::timestamptz AND p.received_at < ${to}::timestamptz
                 THEN (CASE WHEN p.kind = 'RECEIPT' THEN p.amount ELSE -p.amount END) ELSE 0 END) AS paid_in_period
      FROM payments p JOIN cand ON cand.id = p.contract_id
      WHERE p.organization_id = ${orgId}::uuid AND p.voided_at IS NULL
      GROUP BY p.contract_id
    )
    SELECT c.id, c.code, c.status::text AS status, c.total, c.deposit_required, c.confirmed_at, c.event_date,
      cu.id AS customer_id, cu.full_name AS customer_name,
      (c.status IN ('CONFIRMED', 'COMPLETED') AND c.confirmed_at >= ${from}::timestamptz AND c.confirmed_at < ${to}::timestamptz) AS booked,
      COALESCE(pay.paid, 0)::bigint AS paid,
      COALESCE(pay.paid_in_period, 0)::bigint AS paid_in_period
    FROM contracts c
    JOIN cand ON cand.id = c.id
    JOIN customers cu ON cu.id = c.customer_id AND cu.organization_id = c.organization_id
    LEFT JOIN pay ON pay.contract_id = c.id
    WHERE c.organization_id = ${orgId}::uuid
    ORDER BY c.confirmed_at ASC NULLS LAST, c.code ASC`;
}

interface Bucket {
  contractCount: number;
  sales: bigint;
  depositRequired: bigint;
  depositOutstanding: bigint;
  paidToDate: bigint;
  received: bigint;
  refunded: bigint;
}

const emptyBucket = (): Bucket => ({
  contractCount: 0,
  sales: 0n,
  depositRequired: 0n,
  depositOutstanding: 0n,
  paidToDate: 0n,
  received: 0n,
  refunded: 0n,
});

function presentBucket(b: Bucket) {
  return {
    contractCount: b.contractCount,
    sales: vnd(b.sales, 'doanh số'),
    depositRequired: vnd(b.depositRequired, 'cọc phải thu'),
    depositOutstanding: vnd(b.depositOutstanding, 'cọc còn thiếu'),
    outstanding: vnd(b.sales - b.paidToDate, 'còn lại'),
    received: vnd(b.received, 'tổng thu'),
    refunded: vnd(b.refunded, 'tổng hoàn'),
    collected: vnd(b.received - b.refunded, 'đã thu thực tế'),
  };
}

export const reportRoutes: AnyRoute[] = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/reports/revenue',
    scope: 'org',
    permission: 'reports.read',
    tag: 'Báo cáo',
    summary: 'Doanh số – cọc phải thu – đã thu thực tế – còn lại theo kỳ [from, to), nhóm theo tháng hoặc theo hợp đồng',
    query: RevenueQuery,
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const from = new Date(query.from).toISOString();
      const to = new Date(query.to).toISOString();
      const [booked, cash] = await Promise.all([bookedByMonth(deps.db, o.id, from, to), cashByMonth(deps.db, o.id, from, to)]);
      const months = new Map(periodsBetween(new Date(from), new Date(to)).map((p) => [p, emptyBucket()]));
      const bucket = (period: string) => {
        const b = months.get(period);
        if (!b) throw new Error(`Báo cáo: tháng ${period} nằm ngoài kỳ ${from} – ${to}`);
        return b;
      };
      for (const r of booked) {
        const b = bucket(r.period);
        b.contractCount = r.contract_count;
        b.sales = r.sales;
        b.depositRequired = r.deposit_required;
        b.depositOutstanding = r.deposit_outstanding;
        b.paidToDate = r.paid_to_date;
      }
      for (const r of cash) {
        const b = bucket(r.period);
        b.received = r.received;
        b.refunded = r.refunded;
      }
      const all = emptyBucket();
      for (const b of months.values()) {
        all.contractCount += b.contractCount;
        all.sales += b.sales;
        all.depositRequired += b.depositRequired;
        all.depositOutstanding += b.depositOutstanding;
        all.paidToDate += b.paidToDate;
        all.received += b.received;
        all.refunded += b.refunded;
      }
      const common = { from: query.from, to: query.to, groupBy: query.groupBy, basis: BASIS, totals: presentBucket(all) };
      if (query.groupBy === 'month') {
        return { body: { ...common, rows: [...months].map(([period, b]) => ({ period, ...presentBucket(b) })) } };
      }
      const rows = await byContract(deps.db, o.id, from, to);
      return {
        body: {
          ...common,
          rows: rows.map((r) => {
            const total = vnd(r.total, 'tổng hợp đồng');
            const depositRequired = vnd(r.deposit_required, 'tiền cọc');
            const paid = vnd(r.paid, 'đã thu');
            const cancelled = r.status === 'CANCELLED';
            return {
              contractId: r.id,
              code: r.code,
              status: r.status,
              customer: { id: r.customer_id, fullName: r.customer_name },
              confirmedAt: r.confirmed_at,
              eventDate: r.event_date,
              // true = tính vào doanh số của kỳ; false = chỉ có tiền thu/hoàn trong kỳ (nháp, đã huỷ, hoặc chốt kỳ khác).
              bookedInPeriod: r.booked,
              total,
              depositRequired,
              paid,
              paidInPeriod: vnd(r.paid_in_period, 'thu trong kỳ'),
              // Hợp đồng đã huỷ không còn phải thu: null thay vì một con số dễ hiểu lầm.
              remaining: cancelled ? null : total - paid,
              depositOutstanding: cancelled ? null : Math.max(0, depositRequired - paid),
            };
          }),
        },
      };
    },
  }),
];
