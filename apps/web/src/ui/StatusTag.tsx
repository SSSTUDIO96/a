import type { ReactNode } from 'react';
import {
  CONTRACT_STATUS_LABELS,
  WORK_STATUS_LABELS,
  type ContractStatus,
  type WorkStatus,
} from '@makeup/shared';
import { cx } from './cx';
import './ui.css';

export type TagTone = 'draft' | 'ok' | 'danger' | 'warn' | 'accent' | 'neutral';

export interface StatusTagProps {
  tone?: TagTone;
  children: ReactNode;
  className?: string;
  title?: string;
}

/** Nhãn nhỏ — đệm 2 8, bo 999, chữ 11.5/600. */
export function StatusTag({ tone = 'neutral', children, className, title }: StatusTagProps) {
  return (
    <span className={cx('ui-tag', `ui-tag--${tone}`, className)} title={title}>
      {children}
    </span>
  );
}

// Bảng màu bản vẽ C mục 3 (StatusTag). Nhãn tiếng Việt lấy từ @makeup/shared.
export const CONTRACT_STATUS_TONES: Record<ContractStatus, TagTone> = {
  DRAFT: 'draft',
  CONFIRMED: 'ok',
  COMPLETED: 'ok',
  CANCELLED: 'danger',
};

export const WORK_STATUS_TONES: Record<WorkStatus, TagTone> = {
  DRAFT: 'draft',
  PENDING_CONFIRMATION: 'warn',
  CONFIRMED: 'ok',
  IN_PROGRESS: 'accent',
  COMPLETED: 'ok',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
};

export function ContractStatusTag({ status }: { status: ContractStatus }) {
  return <StatusTag tone={CONTRACT_STATUS_TONES[status]}>{CONTRACT_STATUS_LABELS[status]}</StatusTag>;
}

export function WorkStatusTag({ status }: { status: WorkStatus }) {
  return <StatusTag tone={WORK_STATUS_TONES[status]}>{WORK_STATUS_LABELS[status]}</StatusTag>;
}
