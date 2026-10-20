// Máy khách API của cổng học viên (bản vẽ E mục 5.1). Chỉ gọi /api/v1/portal/…, cookie phiên (mp_portal) do máy chủ đặt
// kiểu HttpOnly nên mã ở đây không đọc, không lưu thẻ ở đâu cả. Mọi yêu cầu có X-Client: portal.
// Cổng KHÔNG dùng src/api/client.ts của app nhân viên (cửa gác check-portal-bundle chặn).
import type { PortalMe } from '@makeup/shared';

const BASE = '/api/v1/portal';

export class PortalHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = 'PortalHttpError';
    this.status = status;
  }
}

/** Không tới được máy chủ (mất mạng, máy chủ tắt). */
export class PortalNetworkError extends Error {
  constructor() {
    super('Không kết nối được');
    this.name = 'PortalNetworkError';
  }
}

async function call(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { 'X-Client': 'portal', Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new PortalNetworkError();
  }
  if (!res.ok) throw new PortalHttpError(res.status);
  return res;
}

export const portalApi = {
  /** 200 → dữ liệu trang. 401 → PortalHttpError(401). 403 → trang tạm đóng. */
  async me(): Promise<PortalMe> {
    const res = await call('GET', '/me');
    return (await res.json()) as PortalMe;
  },
  /** Mở bằng chìa + 4 số. Hỏng vì bất cứ lý do gì: 401 một lời chung (máy chủ không cho biết lý do). */
  async open(key: string, last4: string): Promise<void> {
    await call('POST', '/session', { key, last4 });
  },
  /** Nhận phiên bằng mã chuyển sang app. */
  async claim(code: string): Promise<void> {
    await call('POST', '/session/claim', { code });
  },
  /** Tạo mã chuyển sang app đã cài lên màn hình chính. */
  async handoff(): Promise<{ code: string; expiresAt: string }> {
    const res = await call('POST', '/session/handoff');
    return (await res.json()) as { code: string; expiresAt: string };
  },
  /** Thoát khỏi máy này (204). */
  async signOut(): Promise<void> {
    await call('DELETE', '/session');
  },
};
