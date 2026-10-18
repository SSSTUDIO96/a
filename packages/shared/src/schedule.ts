// Trạng thái THỰC HIỆN của lịch — khớp enum WorkStatus trong database.
export const WORK_STATUSES = [
  'DRAFT',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  DRAFT: 'Nháp',
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã huỷ',
  NO_SHOW: 'Khách không đến',
};

// Bảng chuyển trạng thái là nguồn sự thật duy nhất: máy chủ và giao diện cùng đọc bảng này.
export const STATUS_TRANSITIONS: Record<WorkStatus, readonly WorkStatus[]> = {
  DRAFT: ['PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED'],
  PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

// Trạng thái được phép khi tạo lịch mới.
export const INITIAL_STATUSES = ['DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED'] as const satisfies readonly WorkStatus[];

const NON_BLOCKING: readonly WorkStatus[] = ['DRAFT', 'CANCELLED', 'NO_SHOW'];

export function canTransition(from: WorkStatus, to: WorkStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export function isTerminalStatus(status: WorkStatus): boolean {
  return STATUS_TRANSITIONS[status].length === 0;
}

// Lịch nháp, đã huỷ, khách không đến thì không chiếm giờ của thợ.
export function isBlockingStatus(status: WorkStatus): boolean {
  return !NON_BLOCKING.includes(status);
}

export const MAX_APPOINTMENT_MS = 24 * 60 * 60 * 1000;
export const MAX_TRAVEL_MIN = 600;

export interface BlockInput {
  startsAt: Date;
  endsAt: Date;
  travelBeforeMin: number;
  travelAfterMin: number;
}

// Khoảng bận của thợ = giờ bắt đầu − di chuyển trước → giờ kết thúc + di chuyển sau.
export function computeBlock(input: BlockInput): { blockStart: Date; blockEnd: Date } {
  return {
    blockStart: new Date(input.startsAt.getTime() - input.travelBeforeMin * 60_000),
    blockEnd: new Date(input.endsAt.getTime() + input.travelAfterMin * 60_000),
  };
}

// Hai khoảng nửa mở [a, b) và [c, d) chồng nhau — cùng quy ước '[)' với ràng buộc database.
export function blocksOverlap(a: { blockStart: Date; blockEnd: Date }, b: { blockStart: Date; blockEnd: Date }): boolean {
  return a.blockStart.getTime() < b.blockEnd.getTime() && b.blockStart.getTime() < a.blockEnd.getTime();
}

// Chuẩn hoá số điện thoại Việt Nam về dạng 0xxxxxxxxx.
// Nhận "+84 912 345 678", "84912345678", "0912.345.678", "(028) 3822 1234"... Sai định dạng → null.
export function normalizeVnPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\+?[\d\s.\-()]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    if (!digits.startsWith('84')) return null;
    digits = `0${digits.slice(2)}`;
  } else if (digits.startsWith('84') && (digits.length === 11 || digits.length === 12)) {
    digits = `0${digits.slice(2)}`;
  }
  // Di động: 10 số, đầu 03/05/07/08/09. Cố định: 11 số, đầu 02.
  if (/^0[35789]\d{8}$/.test(digits) || /^02\d{9}$/.test(digits)) return digits;
  return null;
}
