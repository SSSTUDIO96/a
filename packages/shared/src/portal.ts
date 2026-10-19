// CỔNG HỌC VIÊN (bản vẽ E mục 3.4): hằng số và kiểu dùng chung cho máy chủ (modules/portal) và web (/hv, thẻ Cổng học viên).
// Các con số 7 / 2 / 5 / 90 là hằng dùng chung, không chỉnh theo từng trung tâm (bản vẽ E mục 8).

export const PORTAL_LINK_TTL_DAYS = 7; // đường dẫn chưa mở
export const PORTAL_MAX_DEVICES = 2; // mỗi đường dẫn (trigger portal_devices_max_per_link là lưới cuối)
export const PORTAL_MAX_FAILED = 5; // sai 4 số (CHECK portal_links_failed_range / portal_links_lock_pair)
export const PORTAL_SESSION_DAYS = 90; // nhớ máy, trượt
export const PORTAL_SESSION_TOUCH_MINUTES = 60; // cập nhật last_used_at tối đa mỗi 60 phút
export const PORTAL_HANDOFF_MINUTES = 10;
export const PORTAL_MAX_SESSIONS_PER_DEVICE = 3;
export const PORTAL_MIN_RESPONSE_MS = 300;
export const PORTAL_WEB_PATH = '/hv'; // đường dẫn: <origin>/hv#k=<chìa>
export const PORTAL_DENIED_MESSAGE =
  'Không mở được trang. Kiểm tra lại 4 số cuối số điện thoại, hoặc nhắn trung tâm gửi đường dẫn mới.';
export const PORTAL_SESSION_INVALID_MESSAGE = 'Phiên đã hết. Mở lại đường dẫn trung tâm gửi qua Zalo.';

const TRANSFER_NOTE_MAX = 50;
const DEVICE_LABEL_MAX = 80;

function words(fullName: string): string[] {
  return fullName.normalize('NFC').trim().split(/\s+/).filter(Boolean);
}

// Tên gọi: chữ cuối của họ tên ("Tôn Nữ … Phương Thảo" → "Thảo"). Hai chữ cuối nếu chữ cuối chỉ 1–2 ký tự
// ("Nguyễn Thị Mỹ Lệ" → "Mỹ Lệ"). Họ tên trống → ném lỗi (không trả chuỗi rỗng im lặng).
export function callName(fullName: string): string {
  const w = words(fullName);
  const last = w[w.length - 1];
  if (last === undefined) throw new Error('callName: họ tên trống');
  const prev = w[w.length - 2];
  return [...last].length <= 2 && prev !== undefined ? `${prev} ${last}` : last;
}

// Bỏ dấu tiếng Việt: NFD + bỏ dấu kết hợp, đ → d, Đ → D.
function foldVietnamese(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Nội dung chuyển khoản: "HĐKH-000042 Phương Thảo" → "HDKH-000042 Phuong Thao". Bỏ dấu, chỉ giữ [A-Za-z0-9 -]
// (ký tự khác thành dấu cách), gộp dấu cách, tối đa 50 ký tự.
export function transferNote(contractCode: string, fullName: string): string {
  const code = contractCode.trim();
  if (!code) throw new Error('transferNote: mã hợp đồng trống');
  const raw = foldVietnamese(`${code} ${fullName}`)
    .replace(/[^A-Za-z0-9 -]/g, ' ')
    .replace(/ +/g, ' ')
    .trim();
  return raw.slice(0, TRANSFER_NOTE_MAX).trimEnd();
}

// Tên máy do MÁY CHỦ đọc từ User-Agent (cột portal_devices.label, CHECK 1–80 ký tự). Không nhận tên từ máy khách.
// "iPhone · Safari", "Android · Chrome", "iPhone · Zalo", "Máy tính · Chrome", "Máy khác · Trình duyệt".
export function deviceLabelFromUserAgent(ua: string | undefined): string {
  const s = ua ?? '';
  const device = /iPhone|iPod/.test(s)
    ? 'iPhone'
    : /iPad/.test(s)
      ? 'iPad'
      : /Android/.test(s)
        ? 'Android'
        : /Windows NT|Macintosh|CrOS|X11|Linux x86_64/.test(s)
          ? 'Máy tính'
          : 'Máy khác';
  const browser = /Zalo/i.test(s)
    ? 'Zalo'
    : /FBAN|FBAV|FB_IAB/.test(s)
      ? 'Facebook'
      : /EdgA?\/|EdgiOS\//.test(s)
        ? 'Edge'
        : /SamsungBrowser\//.test(s)
          ? 'Samsung Internet'
          : /CocCoc|coc_coc/i.test(s)
            ? 'Cốc Cốc'
            : /Firefox\/|FxiOS\//.test(s)
              ? 'Firefox'
              : /Chrome\/|CriOS\//.test(s)
                ? 'Chrome'
                : /Safari\//.test(s)
                  ? 'Safari'
                  : 'Trình duyệt';
  return `${device} · ${browser}`.slice(0, DEVICE_LABEL_MAX);
}

// Tin nhắn dán Zalo (web ghép, máy chủ không gửi).
export function portalMessage(p: { callName: string; centerName: string; url: string }): string {
  return (
    `Chào ${p.callName}, đây là trang học viên của em tại ${p.centerName} (lịch học, học phí, nội quy, ảnh):\n${p.url}\n` +
    `Mở bằng điện thoại của em và nhập 4 số cuối số điện thoại đã đăng ký. Đường dẫn chưa mở sẽ hết hạn sau ${PORTAL_LINK_TTL_DAYS} ngày. ` +
    'Đường dẫn này chỉ dành cho em, đừng chuyển cho người khác nhé.'
  );
}

// ---------- GET /portal/me (bản vẽ E mục 4.2). Không có UUID nào: phần tử danh sách dùng mã hợp đồng, ngày, thứ tự. ----------
export type PortalClassStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type PortalSessionStatus = 'SCHEDULED' | 'DONE' | 'CANCELLED';
export type PortalInstallmentStatus = 'PAID' | 'PARTIAL' | 'DUE' | 'OVERDUE';

export interface PortalMe {
  center: {
    name: string; // OrganizationProfile.brandName ?? Organization.name
    logoUrl: string | null; // URL ký 10 phút
    phone: string | null;
    zalo: string | null;
    address: string | null;
  };
  bank: { bankName: string; accountNo: string; accountName: string } | null; // portal_settings, đủ 3 trường mới trả
  student: { fullName: string; callName: string; avatarUrl: string | null };
  device: { label: string; openedAt: string }; // máy của phiên
  timezone: string; // Organization.timezone
  serverTime: string;
  enrollments: {
    courseName: string;
    className: string;
    classStatus: PortalClassStatus;
    startDate: string; // 'YYYY-MM-DD'
    endDate: string;
    weekdays: number[];
    startTime: string | null; // 'HH:MM' từ startMinute/endMinute
    endTime: string | null;
    sessionCount: number | null; // Course.sessionCount
    instructor: { name: string; avatarUrl: string | null } | null; // StaffProfile.displayName — KHÔNG phone
    location: { name: string; address: string | null; latitude: number | null; longitude: number | null } | null;
    contractCode: string;
    sessions: { date: string; startsAt: string; endsAt: string; status: PortalSessionStatus }[]; // [] khi lớp chưa sinh buổi học
  }[];
  contracts: {
    code: string;
    status: 'CONFIRMED' | 'COMPLETED';
    confirmedAt: string | null;
    lines: { name: string; quantity: number; unitPrice: number; lineTotal: number }[]; // dòng chưa huỷ
    subtotal: number;
    discount: number;
    total: number;
    paid: number; // summarizePayments
    remaining: number;
    installments: {
      name: string;
      dueDate: string;
      amount: number;
      isDeposit: boolean;
      paidAmount: number;
      status: PortalInstallmentStatus;
    }[]; // allocateToInstallments
    receipts: {
      code: string;
      kind: 'RECEIPT' | 'REFUND';
      method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'OTHER';
      amount: number;
      receivedAt: string;
    }[]; // chưa huỷ
    terms: string | null; // bản chụp lúc xác nhận
    rules: string | null;
    transferNote: string; // transferNote(code, fullName)
  }[];
  cards: {
    kind: 'WELCOME' | 'FEEDBACK';
    createdAt: string;
    className: string | null;
    url: string;
    urlExpiresAt: string;
    width: number | null;
    height: number | null;
  }[];
}

// ---------- GET /orgs/:orgId/customers/:customerId/portal (bản vẽ E mục 4.3). Không bao giờ có keyHash/tokenHash/handoffHash. ----------
export type PortalLinkStatus = 'ACTIVE' | 'EXPIRED' | 'LOCKED' | 'FULL' | 'REVOKED';
export type PortalDeviceStatus = 'ACTIVE' | 'BLOCKED' | 'SIGNED_OUT' | 'LINK_REVOKED';
export type PortalIneligibleReason = 'NOT_ACADEMY' | 'NO_PHONE';

export interface PortalAdminView {
  eligible: { ok: boolean; reasons: PortalIneligibleReason[] };
  phoneLast4: string | null; // nhắc nhân viên đối chiếu
  hasCourseContract: boolean; // có hợp đồng khoá học CONFIRMED/COMPLETED
  link: null | {
    status: PortalLinkStatus; // link mới nhất; xét theo thứ tự REVOKED → LOCKED → EXPIRED → FULL → ACTIVE
    createdAt: string;
    createdByName: string;
    expiresAt: string;
    firstOpenedAt: string | null;
    failedAttempts: number;
    devicesUsed: number;
  };
  devices: {
    id: string;
    label: string;
    createdAt: string;
    lastSeenAt: string;
    status: PortalDeviceStatus;
    endedAt: string | null;
    endedByName: string | null;
  }[]; // mọi máy của học viên, mới nhất trước, tối đa 20
  // Kiểu chữ số cố định 7 / 2 / 5 / 90, lấy từ đúng hằng ở trên (một nguồn).
  limits: {
    linkTtlDays: typeof PORTAL_LINK_TTL_DAYS;
    maxDevices: typeof PORTAL_MAX_DEVICES;
    maxFailed: typeof PORTAL_MAX_FAILED;
    rememberDays: typeof PORTAL_SESSION_DAYS;
  };
}
