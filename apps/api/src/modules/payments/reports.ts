import { Prisma } from '@prisma/client';
import type { ContractKindKey, ContractStatus } from '@makeup/shared';
import { defineRoute, mustOrg, type AnyRoute } from '../../http/route';
import type { Db } from '../../lib/prisma';
import { vndOrNull } from './common';
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

// Nhóm theo khoá / nhóm khoá: mỗi đồng của một hợp đồng thuộc đúng MỘT dòng báo cáo — nên cộng các dòng bằng đúng tổng.
const COURSE_ALLOCATION =
  'Hợp đồng khoá học có nhiều khoá: mọi số tiền của hợp đồng chia cho các khoá theo thành tiền các dòng khoá học còn hiệu lực ' +
  '(làm tròn từng đồng, phần dư dồn cho khoá có phần lẻ lớn nhất, tổng không lệch). Hợp đồng khoá học không còn dòng khoá ' +
  'học nào → dòng "COURSE_UNASSIGNED"; hợp đồng dịch vụ → dòng "SERVICE". Số hợp đồng của một dòng = số hợp đồng tính vào ' +
  'doanh số có phần tiền ở dòng đó (một hợp đồng nhiều khoá được đếm ở mỗi khoá).';

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

// Lọc theo loại hợp đồng (bí danh bảng contracts truyền vào). Không lọc → câu rỗng.
function kindFilter(kind: ContractKindKey | undefined, alias: Prisma.Sql): Prisma.Sql {
  return kind ? Prisma.sql`AND ${alias}.kind = ${kind}::"ContractKind"` : Prisma.empty;
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
  kind: ContractKindKey;
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

// Số liệu của MỘT hợp đồng trong kỳ — đơn vị để chia theo loại / khoá / nhóm khoá.
interface FactRow {
  id: string;
  kind: ContractKindKey;
  booked: boolean;
  total: bigint;
  deposit_required: bigint;
  paid: bigint;
  received: bigint;
  refunded: bigint;
}

// Phần khoá học của một hợp đồng: các dòng COURSE còn hiệu lực gộp theo khoá.
interface ShareRow {
  contract_id: string;
  course_id: string;
  course_code: string;
  course_name: string;
  course_sort: number;
  group_id: string | null;
  group_name: string | null;
  group_sort: number | null;
  weight: bigint;
  line_count: number;
}

async function bookedByMonth(db: Db, orgId: string, from: string, to: string, kind: ContractKindKey | undefined) {
  return db.$queryRaw<BookedRow[]>`
    WITH booked AS (
      SELECT c.id, c.total, c.deposit_required, to_char(c.confirmed_at AT TIME ZONE ${VN_TZ}, 'YYYY-MM') AS period
      FROM contracts c
      WHERE c.organization_id = ${orgId}::uuid AND c.status IN ('CONFIRMED', 'COMPLETED')
        AND c.confirmed_at >= ${from}::timestamptz AND c.confirmed_at < ${to}::timestamptz
        ${kindFilter(kind, Prisma.sql`c`)}
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

async function cashByMonth(db: Db, orgId: string, from: string, to: string, kind: ContractKindKey | undefined) {
  return db.$queryRaw<CashRow[]>`
    SELECT to_char(p.received_at AT TIME ZONE ${VN_TZ}, 'YYYY-MM') AS period,
      COALESCE(SUM(p.amount) FILTER (WHERE p.kind = 'RECEIPT'), 0)::bigint AS received,
      COALESCE(SUM(p.amount) FILTER (WHERE p.kind = 'REFUND'), 0)::bigint AS refunded
    FROM payments p
    JOIN contracts c ON c.id = p.contract_id AND c.organization_id = p.organization_id
    WHERE p.organization_id = ${orgId}::uuid AND p.voided_at IS NULL
      AND p.received_at >= ${from}::timestamptz AND p.received_at < ${to}::timestamptz
      ${kindFilter(kind, Prisma.sql`c`)}
    GROUP BY 1`;
}

// Hợp đồng "có mặt" trong kỳ: tính vào doanh số trong kỳ HOẶC có tiền thu/hoàn trong kỳ — nhờ vậy cộng phần
// "thu trong kỳ" của mọi hợp đồng khớp đúng từng đồng với tổng đã thu thực tế.
function candidatesSql(orgId: string, from: string, to: string, kind: ContractKindKey | undefined): Prisma.Sql {
  return Prisma.sql`
      SELECT c.id FROM contracts c
      WHERE c.organization_id = ${orgId}::uuid AND c.status IN ('CONFIRMED', 'COMPLETED')
        AND c.confirmed_at >= ${from}::timestamptz AND c.confirmed_at < ${to}::timestamptz
        ${kindFilter(kind, Prisma.sql`c`)}
      UNION
      SELECT p.contract_id FROM payments p
      JOIN contracts c ON c.id = p.contract_id AND c.organization_id = p.organization_id
      WHERE p.organization_id = ${orgId}::uuid AND p.voided_at IS NULL
        AND p.received_at >= ${from}::timestamptz AND p.received_at < ${to}::timestamptz
        ${kindFilter(kind, Prisma.sql`c`)}`;
}

const bookedSql = (from: string, to: string) =>
  Prisma.sql`(c.status IN ('CONFIRMED', 'COMPLETED') AND c.confirmed_at >= ${from}::timestamptz AND c.confirmed_at < ${to}::timestamptz)`;

// Mỗi hợp đồng một dòng (nhóm theo hợp đồng).
async function byContract(db: Db, orgId: string, from: string, to: string, kind: ContractKindKey | undefined) {
  return db.$queryRaw<ContractRow[]>`
    WITH cand AS (${candidatesSql(orgId, from, to, kind)}
    ), pay AS (
      SELECT p.contract_id,
        SUM(CASE WHEN p.kind = 'RECEIPT' THEN p.amount ELSE -p.amount END) AS paid,
        SUM(CASE WHEN p.received_at >= ${from}::timestamptz AND p.received_at < ${to}::timestamptz
                 THEN (CASE WHEN p.kind = 'RECEIPT' THEN p.amount ELSE -p.amount END) ELSE 0 END) AS paid_in_period
      FROM payments p JOIN cand ON cand.id = p.contract_id
      WHERE p.organization_id = ${orgId}::uuid AND p.voided_at IS NULL
      GROUP BY p.contract_id
    )
    SELECT c.id, c.code, c.kind::text AS kind, c.status::text AS status, c.total, c.deposit_required, c.confirmed_at, c.event_date,
      cu.id AS customer_id, cu.full_name AS customer_name,
      ${bookedSql(from, to)} AS booked,
      COALESCE(pay.paid, 0)::bigint AS paid,
      COALESCE(pay.paid_in_period, 0)::bigint AS paid_in_period
    FROM contracts c
    JOIN cand ON cand.id = c.id
    JOIN customers cu ON cu.id = c.customer_id AND cu.organization_id = c.organization_id
    LEFT JOIN pay ON pay.contract_id = c.id
    WHERE c.organization_id = ${orgId}::uuid
    ORDER BY c.confirmed_at ASC NULLS LAST, c.code ASC`;
}

// Số liệu từng hợp đồng (cho nhóm theo loại / khoá / nhóm khoá): MỘT câu cho cả kỳ.
async function contractFacts(db: Db, orgId: string, from: string, to: string, kind: ContractKindKey | undefined) {
  return db.$queryRaw<FactRow[]>`
    WITH cand AS (${candidatesSql(orgId, from, to, kind)}
    ), pay AS (
      SELECT p.contract_id,
        SUM(CASE WHEN p.kind = 'RECEIPT' THEN p.amount ELSE -p.amount END) AS paid,
        COALESCE(SUM(p.amount) FILTER (WHERE p.kind = 'RECEIPT'
          AND p.received_at >= ${from}::timestamptz AND p.received_at < ${to}::timestamptz), 0) AS received,
        COALESCE(SUM(p.amount) FILTER (WHERE p.kind = 'REFUND'
          AND p.received_at >= ${from}::timestamptz AND p.received_at < ${to}::timestamptz), 0) AS refunded
      FROM payments p JOIN cand ON cand.id = p.contract_id
      WHERE p.organization_id = ${orgId}::uuid AND p.voided_at IS NULL
      GROUP BY p.contract_id
    )
    SELECT c.id, c.kind::text AS kind, ${bookedSql(from, to)} AS booked, c.total, c.deposit_required,
      COALESCE(pay.paid, 0)::bigint AS paid,
      COALESCE(pay.received, 0)::bigint AS received,
      COALESCE(pay.refunded, 0)::bigint AS refunded
    FROM contracts c
    JOIN cand ON cand.id = c.id
    LEFT JOIN pay ON pay.contract_id = c.id
    WHERE c.organization_id = ${orgId}::uuid
    ORDER BY c.id`;
}

// Khoá của các hợp đồng đã chọn: MỘT câu cho mọi hợp đồng (không N+1). Chỉ dòng COURSE chưa huỷ.
async function courseShares(db: Db, orgId: string, contractIds: string[]) {
  if (contractIds.length === 0) return [];
  return db.$queryRaw<ShareRow[]>`
    SELECT l.contract_id, co.id AS course_id, co.code AS course_code, co.name AS course_name, co.sort_order AS course_sort,
      g.id AS group_id, g.name AS group_name, g.sort_order AS group_sort,
      SUM(l.line_total)::bigint AS weight, COUNT(*)::int AS line_count
    FROM contract_lines l
    JOIN course_classes cc ON cc.id = l.course_class_id AND cc.organization_id = l.organization_id
    JOIN courses co ON co.id = cc.course_id AND co.organization_id = cc.organization_id
    LEFT JOIN course_groups g ON g.id = co.group_id AND g.organization_id = co.organization_id
    WHERE l.organization_id = ${orgId}::uuid AND l.kind = 'COURSE' AND l.voided_at IS NULL
      AND l.contract_id = ANY(${contractIds}::uuid[])
    GROUP BY l.contract_id, co.id, g.id
    ORDER BY l.contract_id, co.id`;
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

type Money = Exclude<keyof Bucket, 'contractCount'>;
const MONEY: Money[] = ['sales', 'depositRequired', 'depositOutstanding', 'paidToDate', 'received', 'refunded'];

// Phần đóng góp của MỘT hợp đồng vào báo cáo kỳ (cùng định nghĩa với bookedByMonth + cashByMonth).
function contribution(f: FactRow): Record<Money, bigint> {
  const booked = f.booked;
  const outstandingDeposit = f.deposit_required - f.paid;
  return {
    sales: booked ? f.total : 0n,
    depositRequired: booked ? f.deposit_required : 0n,
    depositOutstanding: booked && outstandingDeposit > 0n ? outstandingDeposit : 0n,
    paidToDate: booked ? f.paid : 0n,
    received: f.received,
    refunded: f.refunded,
  };
}

// Chia một số tiền nguyên đồng theo trọng số: phần nguyên theo tỷ lệ, phần dư (luôn < số phần) dồn từng đồng cho phần có
// phần lẻ lớn nhất (bằng nhau thì phần đứng trước). Tổng các phần = đúng số tiền. Trọng số đều 0 → chia đều.
export function splitByWeight(amount: bigint, weights: bigint[]): bigint[] {
  if (weights.length === 0) throw new Error('splitByWeight: không có phần nào để chia');
  if (weights.some((w) => w < 0n)) throw new Error('splitByWeight: trọng số âm');
  const ws = weights.reduce((s, w) => s + w, 0n) > 0n ? weights : weights.map(() => 1n);
  const total = ws.reduce((s, w) => s + w, 0n);
  const sign = amount < 0n ? -1n : 1n;
  const abs = amount * sign;
  const parts = ws.map((w) => (abs * w) / total);
  const rems = ws.map((w, i) => ({ i, r: (abs * w) % total }));
  let left = abs - parts.reduce((s, p) => s + p, 0n);
  rems.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (const { i } of rems) {
    if (left === 0n) break;
    parts[i] = (parts[i] as bigint) + 1n;
    left -= 1n;
  }
  return parts.map((p) => p * sign);
}

function addTo(b: Bucket, c: Record<Money, bigint>, booked: boolean) {
  if (booked) b.contractCount += 1;
  for (const k of MONEY) b[k] += c[k];
}

// Số vượt ngưỡng số nguyên an toàn (dữ liệu cũ trước trần 100 tỷ/phiếu) → null, KHÔNG ném lỗi 500 làm sập cả báo cáo
// (biên bản máy chủ lát 2, M3). Phản hồi có cờ totalsOverflow để giao diện báo "tổng quá lớn — kiểm lại phiếu".
function presentBucket(b: Bucket) {
  return {
    contractCount: b.contractCount,
    sales: vndOrNull(b.sales),
    depositRequired: vndOrNull(b.depositRequired),
    depositOutstanding: vndOrNull(b.depositOutstanding),
    outstanding: vndOrNull(b.sales - b.paidToDate),
    received: vndOrNull(b.received),
    refunded: vndOrNull(b.refunded),
    collected: vndOrNull(b.received - b.refunded),
  };
}

const hasOverflow = (x: Record<string, unknown>) => Object.values(x).some((v) => v === null);

type Segment = 'COURSE' | 'COURSE_UNASSIGNED' | 'SERVICE';
interface SegmentRow {
  segment: Segment;
  course: { id: string; code: string; name: string } | null;
  group: { id: string; name: string } | null;
  sort: [number, number, string, number, string];
  bucket: Bucket;
}

const LAST = Number.MAX_SAFE_INTEGER;
const SEGMENT_ORDER: Record<Segment, number> = { COURSE: 0, COURSE_UNASSIGNED: 1, SERVICE: 2 };

// Chia số liệu từng hợp đồng vào dòng theo khoá (level 'course') hoặc nhóm khoá (level 'courseGroup').
function bySegment(facts: FactRow[], shares: ShareRow[], level: 'course' | 'courseGroup'): SegmentRow[] {
  const sharesOf = new Map<string, ShareRow[]>();
  for (const s of shares) {
    const list = sharesOf.get(s.contract_id) ?? [];
    list.push(s);
    sharesOf.set(s.contract_id, list);
  }
  const rows = new Map<string, SegmentRow>();
  const row = (key: string, make: () => Omit<SegmentRow, 'bucket'>) => {
    let r = rows.get(key);
    if (!r) {
      r = { ...make(), bucket: emptyBucket() };
      rows.set(key, r);
    }
    return r;
  };
  for (const f of facts) {
    const c = contribution(f);
    const list = f.kind === 'COURSE' ? sharesOf.get(f.id) ?? [] : [];
    if (list.length === 0) {
      const segment: Segment = f.kind === 'COURSE' ? 'COURSE_UNASSIGNED' : 'SERVICE';
      addTo(row(segment, () => ({ segment, course: null, group: null, sort: [SEGMENT_ORDER[segment], 0, '', 0, ''] })).bucket, c, f.booked);
      continue;
    }
    // Gộp các khoá của hợp đồng về đúng mức đang xem (nhiều khoá cùng nhóm → một phần) rồi mới chia.
    const parts = new Map<string, { share: ShareRow; weight: bigint; lines: bigint }>();
    for (const s of list) {
      const key = level === 'course' ? `c:${s.course_id}` : `g:${s.group_id ?? '-'}`;
      const p = parts.get(key) ?? { share: s, weight: 0n, lines: 0n };
      p.weight += s.weight;
      p.lines += BigInt(s.line_count);
      parts.set(key, p);
    }
    const keys = [...parts.keys()].sort();
    const entries = keys.map((k) => parts.get(k) as { share: ShareRow; weight: bigint; lines: bigint });
    const anyWeight = entries.some((e) => e.weight > 0n);
    const weights = entries.map((e) => (anyWeight ? e.weight : e.lines));
    const split = Object.fromEntries(MONEY.map((m) => [m, splitByWeight(c[m], weights)])) as Record<Money, bigint[]>;
    entries.forEach((e, i) => {
      const s = e.share;
      const r = row(keys[i] as string, () => ({
        segment: 'COURSE',
        course: level === 'course' ? { id: s.course_id, code: s.course_code, name: s.course_name } : null,
        group: s.group_id ? { id: s.group_id, name: s.group_name ?? '' } : null,
        sort: [
          0,
          s.group_id ? (s.group_sort ?? 0) : LAST,
          s.group_name ?? '',
          level === 'course' ? s.course_sort : 0,
          level === 'course' ? s.course_code : '',
        ],
      }));
      addTo(r.bucket, Object.fromEntries(MONEY.map((m) => [m, split[m][i] as bigint])) as Record<Money, bigint>, f.booked);
    });
  }
  const cmp = (a: SegmentRow['sort'], b: SegmentRow['sort']) => {
    for (let i = 0; i < a.length; i++) {
      const x = a[i] as number | string;
      const y = b[i] as number | string;
      if (x !== y) return typeof x === 'number' ? (x as number) - (y as number) : String(x).localeCompare(String(y), 'vi');
    }
    return 0;
  };
  return [...rows.values()].sort((a, b) => cmp(a.sort, b.sort));
}

export const reportRoutes: AnyRoute[] = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/reports/revenue',
    scope: 'org',
    permission: 'reports.read',
    tag: 'Báo cáo',
    summary:
      'Doanh số – cọc phải thu – đã thu thực tế – còn lại theo kỳ [from, to), lọc theo loại hợp đồng; nhóm theo tháng, hợp đồng, loại hợp đồng, nhóm khoá hoặc khoá',
    query: RevenueQuery,
    handler: async ({ deps, org, query }) => {
      const o = mustOrg(org);
      const from = new Date(query.from).toISOString();
      const to = new Date(query.to).toISOString();
      const kind = query.kind;
      const [booked, cash] = await Promise.all([
        bookedByMonth(deps.db, o.id, from, to, kind),
        cashByMonth(deps.db, o.id, from, to, kind),
      ]);
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
        for (const k of MONEY) all[k] += b[k];
      }
      const totals = presentBucket(all);
      const common = { from: query.from, to: query.to, kind: kind ?? null, groupBy: query.groupBy, basis: BASIS, totals };
      if (query.groupBy === 'month') {
        const rows = [...months].map(([period, b]) => ({ period, ...presentBucket(b) }));
        return { body: { ...common, rows, totalsOverflow: hasOverflow(totals) || rows.some(hasOverflow) } };
      }
      if (query.groupBy === 'kind' || query.groupBy === 'course' || query.groupBy === 'courseGroup') {
        const facts = await contractFacts(deps.db, o.id, from, to, kind);
        if (query.groupBy === 'kind') {
          const kinds: ContractKindKey[] = kind ? [kind] : ['SERVICE', 'COURSE'];
          const byKind = new Map(kinds.map((k) => [k, emptyBucket()]));
          for (const f of facts) {
            const b = byKind.get(f.kind);
            if (!b) throw new Error(`Báo cáo: hợp đồng ${f.id} loại ${f.kind} lọt bộ lọc ${kind}`);
            addTo(b, contribution(f), f.booked);
          }
          const rows = [...byKind].map(([k, b]) => ({ kind: k, ...presentBucket(b) }));
          return { body: { ...common, rows, totalsOverflow: hasOverflow(totals) || rows.some(hasOverflow) } };
        }
        const shares = await courseShares(
          deps.db,
          o.id,
          facts.filter((f) => f.kind === 'COURSE').map((f) => f.id),
        );
        const level = query.groupBy;
        // Cờ tràn chỉ xét phần số tiền (course / group = null là "không thuộc khoá/nhóm", không phải tràn số).
        const presented = bySegment(facts, shares, level).map((r) => ({ r, money: presentBucket(r.bucket) }));
        const rows = presented.map(({ r, money }) => ({
          segment: r.segment,
          ...(level === 'course' ? { course: r.course } : {}),
          group: r.group,
          ...money,
        }));
        const overflow = hasOverflow(totals) || presented.some(({ money }) => hasOverflow(money));
        return { body: { ...common, allocation: COURSE_ALLOCATION, rows, totalsOverflow: overflow } };
      }
      const raw = await byContract(deps.db, o.id, from, to, kind);
      const shares = await courseShares(
        deps.db,
        o.id,
        raw.filter((r) => r.kind === 'COURSE').map((r) => r.id),
      );
      const coursesOf = new Map<string, { id: string; code: string; name: string; groupId: string | null }[]>();
      for (const s of shares) {
        const list = coursesOf.get(s.contract_id) ?? [];
        list.push({ id: s.course_id, code: s.course_code, name: s.course_name, groupId: s.group_id });
        coursesOf.set(s.contract_id, list);
      }
      const rows = raw.map((r) => {
        const total = vndOrNull(r.total);
        const depositRequired = vndOrNull(r.deposit_required);
        const paid = vndOrNull(r.paid);
        const cancelled = r.status === 'CANCELLED';
        const known = total !== null && depositRequired !== null && paid !== null;
        return {
          contractId: r.id,
          code: r.code,
          kind: r.kind,
          status: r.status,
          customer: { id: r.customer_id, fullName: r.customer_name },
          // Khoá của các dòng khoá học còn hiệu lực (hợp đồng dịch vụ: mảng rỗng) — để giao diện dựng bảng Nhóm → khoá → hợp đồng.
          courses: coursesOf.get(r.id) ?? [],
          confirmedAt: r.confirmed_at,
          eventDate: r.event_date,
          // true = tính vào doanh số của kỳ; false = chỉ có tiền thu/hoàn trong kỳ (nháp, đã huỷ, hoặc chốt kỳ khác).
          bookedInPeriod: r.booked,
          total,
          depositRequired,
          paid,
          paidInPeriod: vndOrNull(r.paid_in_period),
          // Hợp đồng đã huỷ không còn phải thu: null thay vì một con số dễ hiểu lầm.
          remaining: cancelled || !known ? null : total - paid,
          depositOutstanding: cancelled || !known ? null : Math.max(0, depositRequired - paid),
          overflow: !known || vndOrNull(r.paid_in_period) === null,
        };
      });
      return {
        body: {
          ...common,
          rows: rows.map(({ overflow: _o, ...row }) => row),
          totalsOverflow: hasOverflow(totals) || rows.some((r) => r.overflow),
        },
      };
    },
  }),
];
