import { useCallback, useEffect, useState } from 'react';
import { listClasses, listCourseGroups, listCourses, type ClassListItem, type CourseGroup, type CourseListItem } from '../../api/courses';

// Danh mục khoá cho hợp đồng khoá học: nhóm khoá (trung tâm tự đặt), khoá chưa lưu trữ, mọi lớp (kể cả lớp đã huỷ /
// khoá đã lưu trữ — để mở lại hợp đồng cũ vẫn biết dòng thuộc khoá nào). Số chỗ là số máy chủ trả; reload() sau 409.
export interface CourseCatalog {
  groups: CourseGroup[];
  courses: CourseListItem[];
  classes: ClassListItem[];
}

export type CourseCatalogState =
  | { status: 'loading'; data: CourseCatalog | null }
  | { status: 'error'; error: unknown; data: CourseCatalog | null }
  | { status: 'ready'; data: CourseCatalog };

export function useCourseCatalog(orgId: string, enabled: boolean) {
  const [state, setState] = useState<CourseCatalogState>({ status: 'loading', data: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState((s) => ({ status: 'loading', data: s.data }));
    Promise.all([
      listCourseGroups(orgId, controller.signal),
      listCourses(orgId, undefined, controller.signal),
      listClasses(orgId, { includeCancelled: true, includeArchived: true }, controller.signal),
    ])
      .then(([g, c, k]) => {
        if (controller.signal.aborted) return;
        setState({ status: 'ready', data: { groups: g.items, courses: c.items, classes: k.items } });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState((s) => ({ status: 'error', error, data: s.data }));
      });
    return () => controller.abort();
  }, [orgId, enabled, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, reload };
}
