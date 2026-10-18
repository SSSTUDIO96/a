import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { listContracts } from '../../api/contracts';
import { userMessage } from '../../api/errors';
import type { ContractKind, ContractListQuery, ContractSummary, Page } from '../../api/types';
import { Button, Card, Chip, EmptyState, ListGroupHeader, ListRow, ListRowSkeleton, Segmented, StatusTag, TextInput } from '../../ui';
import { money } from './money';
import { addDays, endOfDayIso, fmtDayMonth, fmtIsoDay, startOfDayIso, todayVn } from './vnTime';

// Cột trái màn Thu tiền — "Hợp đồng cần thu" (bản vẽ C2 mục 3.2).
// Máy chủ CHƯA có đường liệt kê đợt chưa thu của mọi hợp đồng (hàng đợi "Quá hạn / 7 ngày tới"), nên tạm nhóm theo
// NGÀY SỰ KIỆN — dữ liệu có thật. Mỗi nhóm một lần gọi GET /contracts với cùng status, q, pageSize=50.

export type QueueStatus = 'CONFIRMED' | 'DRAFT' | 'COMPLETED';

const STATUS_OPTIONS: { value: QueueStatus; label: string; empty: string }[] = [
  { value: 'CONFIRMED', label: 'Đã xác nhận', empty: 'đã xác nhận' },
  { value: 'DRAFT', label: 'Nháp', empty: 'nháp' },
  { value: 'COMPLETED', label: 'Hoàn thành', empty: 'hoàn thành' },
];

const PAGE_SIZE = 50;

interface Group {
  key: 'week' | 'later' | 'past' | 'course';
  title: string;
  range: Pick<ContractListQuery, 'eventFrom' | 'eventTo' | 'kind'>;
  /** Xếp theo ngày sự kiện: gần nhất trước (nhóm đã qua: vừa qua trước). Khoá học: lập gần nhất trước. */
  order: 1 | -1;
}

export function queueGroups(today: string): Group[] {
  return [
    { key: 'week', title: 'Sự kiện 7 ngày tới', range: { eventFrom: startOfDayIso(today), eventTo: endOfDayIso(addDays(today, 7)) }, order: 1 },
    { key: 'later', title: 'Sự kiện sau đó', range: { eventFrom: startOfDayIso(addDays(today, 8)) }, order: 1 },
    { key: 'past', title: 'Đã qua ngày sự kiện', range: { eventTo: endOfDayIso(addDays(today, -1)) }, order: -1 },
  ];
}

// Tổ chức đào tạo (bản vẽ C3 mục 2.4): ba nhóm theo ngày sự kiện chỉ lấy hợp đồng DỊCH VỤ (kind=SERVICE); hợp đồng khoá
// học không có ngày sự kiện nên thành một nhóm riêng (kind=COURSE). Chip "Tất cả / Dịch vụ / Khoá học" lọc theo kind máy chủ.
export function academyGroups(today: string): Group[] {
  return [
    ...queueGroups(today).map((g) => ({ ...g, range: { ...g.range, kind: 'SERVICE' as const } })),
    { key: 'course', title: 'Hợp đồng khoá học', range: { kind: 'COURSE' }, order: -1 },
  ];
}

export type KindChip = 'ALL' | ContractKind;
const KIND_CHIPS: { value: KindChip; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'COURSE', label: 'Khoá học' },
  { value: 'SERVICE', label: 'Dịch vụ makeup' },
];

type GroupState = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'ready'; page: Page<ContractSummary> };

export interface ContractQueueProps {
  orgId: string;
  orgSlug: string;
  selectedId: string | null;
  /** Báo hợp đồng đầu danh sách (máy tính: mở sẵn khi chưa chọn), null khi danh sách rỗng. */
  onFirst?: (id: string | null) => void;
  /** Tổ chức đào tạo: chip loại hợp đồng + nhóm "Hợp đồng khoá học". */
  academy?: boolean;
}

function sortByEvent(items: ContractSummary[], order: 1 | -1) {
  return [...items].sort((a, b) => order * ((a.eventDate ? Date.parse(a.eventDate) : 0) - (b.eventDate ? Date.parse(b.eventDate) : 0)));
}

function sortByCreated(items: ContractSummary[]) {
  return [...items].sort((a, b) => Date.parse(b.confirmedAt ?? b.createdAt) - Date.parse(a.confirmedAt ?? a.createdAt));
}

export function ContractQueue({ orgId, orgSlug, selectedId, onFirst, academy = false }: ContractQueueProps) {
  const today = todayVn();
  const groups = useMemo(() => (academy ? academyGroups(today) : queueGroups(today)), [today, academy]);
  const [kind, setKind] = useState<KindChip>('ALL');
  const [status, setStatus] = useState<QueueStatus>('CONFIRMED');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [states, setStates] = useState<Record<Group['key'], GroupState>>({
    week: { status: 'loading' },
    later: { status: 'loading' },
    past: { status: 'loading' },
    course: { status: 'loading' },
  });

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const controller = new AbortController();
    setStates({ week: { status: 'loading' }, later: { status: 'loading' }, past: { status: 'loading' }, course: { status: 'loading' } });
    for (const g of groups) {
      listContracts(orgId, { status, pageSize: PAGE_SIZE, ...(term ? { q: term } : {}), ...g.range }, controller.signal)
        .then((page) => setStates((s) => ({ ...s, [g.key]: { status: 'ready', page } })))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setStates((s) => ({ ...s, [g.key]: { status: 'error', error } }));
        });
    }
    return () => controller.abort();
  }, [orgId, status, term, groups, attempt]);

  const allReady = groups.every((g) => states[g.key].status === 'ready');
  const sorted = useMemo(() => {
    const out: Partial<Record<Group['key'], ContractSummary[]>> = {};
    for (const g of groups) {
      const st = states[g.key];
      if (st.status === 'ready') out[g.key] = g.key === 'course' ? sortByCreated(st.page.items) : sortByEvent(st.page.items, g.order);
    }
    return out;
  }, [groups, states]);

  // Nhóm đang hiện theo chip loại (chỉ tổ chức đào tạo).
  const shownGroups = groups.filter((g) => kind === 'ALL' || (kind === 'COURSE') === (g.key === 'course'));
  const totalOf = (keys: Group['key'][]) =>
    keys.reduce((n, k) => {
      const st = states[k];
      return st.status === 'ready' ? n + st.page.total : n;
    }, 0);
  const counts: Record<KindChip, number> = {
    ALL: totalOf(groups.map((g) => g.key)),
    COURSE: totalOf(['course']),
    SERVICE: totalOf(groups.filter((g) => g.key !== 'course').map((g) => g.key)),
  };

  const firstId = allReady ? (shownGroups.map((g) => sorted[g.key]?.[0]?.id).find(Boolean) ?? null) : undefined;
  useEffect(() => {
    if (firstId !== undefined) onFirst?.(firstId);
  }, [firstId, onFirst]);

  const loading = groups.some((g) => states[g.key].status === 'loading');
  const errors = groups.map((g) => states[g.key]).filter((s): s is { status: 'error'; error: unknown } => s.status === 'error');
  const nothing = allReady && shownGroups.every((g) => (sorted[g.key]?.length ?? 0) === 0);
  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.empty ?? '';

  return (
    <Card title="Hợp đồng cần thu" subtitle={`hôm nay ${fmtIsoDay(today)}`} flush className="pm-queue">
      <div className="pm-queue__tools">
        <TextInput
          type="search"
          aria-label="Tìm hợp đồng cần thu"
          placeholder="Tìm mã HĐ, tên khách, số điện thoại"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Segmented<QueueStatus>
          size="sm"
          aria-label="Trạng thái hợp đồng"
          options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={status}
          onChange={setStatus}
        />
        {academy && (
          <div className="pm-kind" role="group" aria-label="Loại hợp đồng">
            {KIND_CHIPS.map((o) => (
              <Chip key={o.value} selected={kind === o.value} count={allReady ? counts[o.value] : undefined} onClick={() => setKind(o.value)}>
                {o.label}
              </Chip>
            ))}
          </div>
        )}
      </div>
      {errors.length > 0 && (
        <EmptyState message={userMessage(errors[0]?.error)} action={<Button onClick={() => setAttempt((n) => n + 1)}>Thử lại</Button>} />
      )}
      {loading && errors.length === 0 && <ListRowSkeleton rows={4} amount label="Đang tải hợp đồng cần thu" />}
      {!loading && errors.length === 0 && nothing && (
        <EmptyState message={term ? `Không có hợp đồng ${statusLabel} nào khớp "${term}".` : `Không có hợp đồng ${statusLabel} nào.`} />
      )}
      {!loading &&
        errors.length === 0 &&
        shownGroups.map((g) => {
          const st = states[g.key];
          const items = sorted[g.key] ?? [];
          if (st.status !== 'ready' || items.length === 0) return null;
          const more = st.page.total - items.length;
          return (
            <section key={g.key} aria-labelledby={`pm-q-${g.key}`}>
              <ListGroupHeader id={`pm-q-${g.key}`} aside={st.page.total}>
                {g.title}
              </ListGroupHeader>
              {items.map((c) => (
                <ListRow
                  key={c.id}
                  as={Link}
                  linkProps={{ to: `/${orgSlug}/thu-tien/${c.id}` }}
                  selected={c.id === selectedId}
                  title={c.customer.fullName}
                  subtitle={academy ? `${c.code} · ${c.kind === 'COURSE' ? 'Khoá học' : 'Dịch vụ'}` : c.code}
                  amount={money(c.total)}
                  trailing={
                    c.eventDate ? (
                      <StatusTag>Sự kiện {fmtDayMonth(c.eventDate)}</StatusTag>
                    ) : c.kind === 'COURSE' && c.confirmedAt ? (
                      <StatusTag tone="accent">Ghi danh {fmtDayMonth(c.confirmedAt)}</StatusTag>
                    ) : undefined
                  }
                />
              ))}
              {more > 0 && <p className="pm-queue__more">Còn {more} hợp đồng nữa. Gõ tìm để thu hẹp.</p>}
            </section>
          );
        })}
    </Card>
  );
}
