import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { CourseGroup, CourseListItem } from '../../api/courses';
import { Button, Chip, EmptyState, formatVnd, IconPlus, ListGroupHeader, ListRow, ListRowSkeleton, TextInput } from '../../ui';
import { IconSearch } from './icons';
import { courseListSub } from './logic';
import { ModeTag } from './ModeTag';

// Cột trái (bản vẽ C3 mục 2.1): thẻ "Khoá học" — ô tìm, chip nhóm (đếm số khoá), danh sách theo nhóm.
// Khoá Một lớp và Nhiều lớp nằm xen nhau trong cùng nhóm; mỗi dòng: tên, nhãn kiểu, dòng phụ, học phí.

export const NO_GROUP = '__none__';

export interface CourseSection {
  key: string;
  name: string;
  items: CourseListItem[];
}

// Chia khoá theo nhóm (thứ tự nhóm của trung tâm), khoá chưa xếp nhóm ở cuối.
export function groupCourses(courses: readonly CourseListItem[], groups: readonly CourseGroup[]): CourseSection[] {
  const sections: CourseSection[] = [];
  for (const g of groups) {
    const items = courses.filter((c) => c.groupId === g.id);
    if (items.length) sections.push({ key: g.id, name: g.name, items });
  }
  const known = new Set(groups.map((g) => g.id));
  const rest = courses.filter((c) => !c.groupId || !known.has(c.groupId));
  if (rest.length) sections.push({ key: NO_GROUP, name: 'Chưa xếp nhóm', items: rest });
  return sections;
}

function matches(c: CourseListItem, q: string): boolean {
  const s = q.trim().toLocaleLowerCase('vi');
  if (!s) return true;
  return c.name.toLocaleLowerCase('vi').includes(s) || c.code.toLocaleLowerCase('vi').includes(s);
}

export interface CourseListProps {
  slug: string;
  courses: CourseListItem[] | null;
  groups: CourseGroup[];
  loading: boolean;
  error: ReactNode;
  q: string;
  onQ: (q: string) => void;
  filter: string | null;
  onFilter: (groupKey: string | null) => void;
  selectedId: string | null;
  canWrite: boolean;
  onAdd: () => void;
  // Điện thoại: nút "Cài đặt nhóm" nằm ở đầu thẻ (máy tính nằm ở đầu trang).
  groupsButton?: ReactNode;
}

export function CourseList({ slug, courses, groups, loading, error, q, onQ, filter, onFilter, selectedId, canWrite, onAdd, groupsButton }: CourseListProps) {
  const all = useMemo(() => courses ?? [], [courses]);
  const chips = useMemo(() => {
    const out = groups.filter((g) => g.isActive || all.some((c) => c.groupId === g.id)).map((g) => ({ key: g.id, name: g.name, count: all.filter((c) => c.groupId === g.id).length }));
    const none = all.filter((c) => !c.groupId || !groups.some((g) => g.id === c.groupId)).length;
    if (none > 0) out.push({ key: NO_GROUP, name: 'Chưa xếp nhóm', count: none });
    return out;
  }, [all, groups]);
  const shown = all.filter((c) => matches(c, q) && (filter === null || (filter === NO_GROUP ? !c.groupId || !groups.some((g) => g.id === c.groupId) : c.groupId === filter)));
  const sections = groupCourses(shown, groups);

  let body;
  if (loading && courses === null) body = <ListRowSkeleton rows={6} amount label="Đang tải danh sách khoá" />;
  else if (courses === null) body = error;
  else if (all.length === 0)
    body = (
      <EmptyState
        message="Chưa có khoá học"
        action={
          canWrite ? (
            <Button variant="primary" size="sm" icon={<IconPlus />} onClick={onAdd}>
              Thêm khoá
            </Button>
          ) : undefined
        }
      />
    );
  else if (shown.length === 0) body = <EmptyState message={q.trim() ? `Không có khoá nào khớp "${q.trim()}".` : 'Nhóm này chưa có khoá.'} />;
  else
    body = (
      <nav aria-label="Danh sách khoá học">
        {sections.map((s) => (
          <div key={s.key}>
            <ListGroupHeader>{s.name}</ListGroupHeader>
            {s.items.map((c) => (
              <ListRow
                key={c.id}
                as={Link}
                linkProps={{ to: `/${slug}/dao-tao/${c.id}` }}
                title={c.name}
                subtitle={
                  <span className="kc-sub">
                    <ModeTag mode={c.mode} />
                    <span>{courseListSub(c)}</span>
                  </span>
                }
                amount={formatVnd(c.tuitionFee)}
                selected={c.id === selectedId}
              />
            ))}
          </div>
        ))}
      </nav>
    );

  return (
    <section className="ui-card kc-list">
      <header className="ui-card__head">
        <h2 className="ui-card__title">
          Khoá học{courses !== null && <span className="ui-card__sub">{all.length} khoá</span>}
        </h2>
        {groupsButton}
      </header>
      <div className="kc-list__search">
        <div className="kc-search">
          <IconSearch />
          <TextInput type="search" enterKeyHint="search" value={q} onChange={(e) => onQ(e.target.value)} placeholder="Tìm khoá học" aria-label="Tìm khoá học theo tên hoặc mã" />
        </div>
      </div>
      {courses !== null && all.length > 0 && (
        <div className="kc-chips" role="group" aria-label="Lọc theo nhóm khoá">
          <Chip selected={filter === null} count={all.length} onClick={() => onFilter(null)}>
            Tất cả
          </Chip>
          {chips.map((g) => (
            <Chip key={g.key} selected={filter === g.key} count={g.count} onClick={() => onFilter(filter === g.key ? null : g.key)}>
              {g.name}
            </Chip>
          ))}
        </div>
      )}
      <div className="ui-ld__scroll">
        {courses !== null && error}
        {body}
      </div>
    </section>
  );
}
