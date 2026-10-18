import type { CourseMode } from '../../api/courses';
import { MODE_LABEL } from './logic';

// Nhãn kiểu khoá: "Một lớp" (viền xám) · "Nhiều lớp" (nền --accent-soft) — như bản mẫu C3.
export function ModeTag({ mode }: { mode: CourseMode }) {
  return <span className={mode === 'MULTI_CLASS' ? 'kc-mode kc-mode--multi' : 'kc-mode'}>{MODE_LABEL[mode]}</span>;
}
