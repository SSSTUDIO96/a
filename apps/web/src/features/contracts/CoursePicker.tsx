import { useMemo, useState } from 'react';
import type { CourseListItem } from '../../api/courses';
import { Button, Chip, IconCheck, IconPlus, TextInput, WithTooltip, formatVnd } from '../../ui';
import { classChoice, courseSeatsText } from './courseModel';
import type { CourseCatalog } from './useCourseCatalog';

// Cột trái hợp đồng khoá học (bản vẽ C3 mục 2.3): tìm khoá, chip theo NHÓM THỰC TẾ của trung tâm (đếm số khoá),
// danh sách theo nhóm. Khoá không còn lớp nào nhận ghi danh → nút "Hết chỗ" tắt kèm lý do.
export interface CoursePickerProps {
  catalog: CourseCatalog;
  usedCourseIds: ReadonlySet<string>;
  onAdd: (course: CourseListItem) => void;
}

const ALL = 'tat-ca';
const NONE = 'chua-xep-nhom';

function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function CoursePicker({ catalog, usedCourseIds, onAdd }: CoursePickerProps) {
  const [q, setQ] = useState('');
  const [chip, setChip] = useState(ALL);
  const classesOf = useMemo(() => {
    const m = new Map<string, CourseCatalog['classes']>();
    for (const c of catalog.classes) m.set(c.courseId, [...(m.get(c.courseId) ?? []), c]);
    return m;
  }, [catalog.classes]);
  const groups = useMemo(() => [...catalog.groups].filter((g) => g.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'vi')), [catalog.groups]);
  const count = (gid: string | null) => catalog.courses.filter((c) => c.groupId === gid).length;
  const hasNone = catalog.courses.some((c) => c.groupId === null || !groups.some((g) => g.id === c.groupId));
  const needle = fold(q.trim());
  const visible = catalog.courses.filter((c) => needle === '' || fold(c.name).includes(needle) || fold(c.code).includes(needle));
  const sections = [
    ...groups.map((g) => ({ id: g.id, name: g.name, courses: visible.filter((c) => c.groupId === g.id) })),
    { id: NONE, name: 'Chưa xếp nhóm', courses: visible.filter((c) => c.groupId === null || !groups.some((g) => g.id === c.groupId)) },
  ].filter((s) => (chip === ALL || chip === s.id) && s.courses.length > 0);

  return (
    <div className="ct-cat">
      <div className="ct-cat__sch">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm khoá học" aria-label="Tìm khoá học" />
        <div className="ct-cat__chips" role="group" aria-label="Lọc theo nhóm khoá">
          <Chip selected={chip === ALL} count={catalog.courses.length} onClick={() => setChip(ALL)}>
            Tất cả
          </Chip>
          {groups
            .filter((g) => count(g.id) > 0)
            .map((g) => (
              <Chip key={g.id} selected={chip === g.id} count={count(g.id)} onClick={() => setChip(g.id)}>
                {g.name}
              </Chip>
            ))}
          {hasNone && (
            <Chip selected={chip === NONE} onClick={() => setChip(NONE)}>
              Chưa xếp nhóm
            </Chip>
          )}
        </div>
      </div>
      <div className="ct-cat__ls">
        {catalog.courses.length === 0 && <div className="ct-cat__empty">Chưa có khoá học. Thêm khoá ở mục Đào tạo.</div>}
        {catalog.courses.length > 0 && sections.length === 0 && <div className="ct-cat__empty">Không có khoá phù hợp.</div>}
        {sections.map((s) => (
          <section key={s.id} aria-label={s.name}>
            <div className="ct-lbl">{s.name}</div>
            {s.courses.map((c) => {
              const classes = classesOf.get(c.id) ?? [];
              const open = classes.some((k) => !classChoice(k).disabled);
              return (
                <div className="ct-pk" key={c.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="ct-pk__n">{c.name}</div>
                    <div className="ct-pk__m">{courseSeatsText(classes)}</div>
                  </div>
                  {open ? (
                    <Button size="sm" icon={<IconPlus />} onClick={() => onAdd(c)} aria-label={`Thêm ${c.name}`}>
                      <span className="ct-num">{formatVnd(c.tuitionFee)}</span>
                    </Button>
                  ) : (
                    <WithTooltip text={classes.length === 0 ? 'Khoá chưa mở lớp nào' : 'Mọi lớp của khoá đã đủ chỗ hoặc ngừng nhận ghi danh'}>
                      <Button size="sm" disabled aria-label={`${c.name}: hết chỗ`}>
                        {classes.length === 0 ? 'Chưa mở lớp' : 'Hết chỗ'}
                      </Button>
                    </WithTooltip>
                  )}
                  {usedCourseIds.has(c.id) && (
                    <div className="ct-pk__in">
                      <IconCheck /> Đã có trong hợp đồng
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
