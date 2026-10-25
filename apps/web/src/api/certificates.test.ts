import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from './client';
import * as certificates from './certificates';

// Kiểm từng hàm gọi của giấy chứng nhận đúng đường, phương thức, thân, query và header (Idempotency-Key chỉ ở hai POST
// tạo dữ liệu: cấp hàng loạt và cấp lại; thu hồi KHÔNG khai chống gửi trùng — lần hai ra 409).

interface Seen {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

let seen: Seen[] = [];

beforeEach(() => {
  seen = [];
  setAccessToken('tok');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({
        url: String(input),
        method: init?.method ?? 'GET',
        headers: { ...(init?.headers as Record<string, string>) },
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    }),
  );
});

afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
});

const ORG = 'org-1';
const P = '/api/v1/orgs/org-1';
const KEY = 'khoa-bam-nut-0001';
const CLASS = '11111111-1111-4111-8111-111111111111';
const CERT = '22222222-2222-4222-8222-222222222222';
const CERT2 = '33333333-3333-4333-8333-333333333333';

interface Case {
  name: string;
  call: () => Promise<unknown>;
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  body?: unknown;
  idem?: boolean;
}

const cases: Case[] = [
  { name: 'getClassCertificateRoster', call: () => certificates.getClassCertificateRoster(ORG, CLASS), method: 'GET', url: `${P}/classes/${CLASS}/certificates` },
  {
    name: 'getClassCertificateRoster (ngày cấp để tính số dự kiến)',
    call: () => certificates.getClassCertificateRoster(ORG, CLASS, { issuedOn: '2027-01-02' }),
    method: 'GET',
    url: `${P}/classes/${CLASS}/certificates?issuedOn=2027-01-02`,
  },
  {
    name: 'issueCertificates',
    call: () => certificates.issueCertificates(ORG, CLASS, { enrollmentIds: [CERT], templateCode: 'cc-01', issuedOn: '2026-12-20', fontOverride: null }, KEY),
    method: 'POST',
    url: `${P}/classes/${CLASS}/certificates`,
    body: { enrollmentIds: [CERT], templateCode: 'cc-01', issuedOn: '2026-12-20', fontOverride: null },
    idem: true,
  },
  { name: 'listCertificates', call: () => certificates.listCertificates(ORG), method: 'GET', url: `${P}/certificates` },
  {
    name: 'listCertificates (đủ bộ lọc, ids nối bằng dấu phẩy)',
    call: () => certificates.listCertificates(ORG, { year: 2026, q: 'Lan', classId: CLASS, customerId: CERT, status: 'REVOKED', ids: [CERT, CERT2], page: 2, pageSize: 20 }),
    method: 'GET',
    url: `${P}/certificates?year=2026&q=Lan&classId=${CLASS}&customerId=${CERT}&status=REVOKED&page=2&pageSize=20&ids=${encodeURIComponent(`${CERT},${CERT2}`)}`,
  },
  { name: 'getCertificate', call: () => certificates.getCertificate(ORG, CERT), method: 'GET', url: `${P}/certificates/${CERT}` },
  {
    name: 'reissueCertificate',
    call: () => certificates.reissueCertificate(ORG, CERT, { reason: 'Sai tên / sai dấu', studentName: 'Nguyễn Thị Lan' }, KEY),
    method: 'POST',
    url: `${P}/certificates/${CERT}/reissue`,
    body: { reason: 'Sai tên / sai dấu', studentName: 'Nguyễn Thị Lan' },
    idem: true,
  },
  {
    name: 'revokeCertificate',
    call: () => certificates.revokeCertificate(ORG, CERT, { reason: 'Cấp nhầm' }),
    method: 'POST',
    url: `${P}/certificates/${CERT}/revoke`,
    body: { reason: 'Cấp nhầm' },
  },
  { name: 'getCertificateSigner', call: () => certificates.getCertificateSigner(ORG), method: 'GET', url: `${P}/profile/certificate` },
  {
    name: 'putCertificateSigner',
    call: () => certificates.putCertificateSigner(ORG, { signerName: 'Nguyễn Trọng Chiến', signerTitle: null }),
    method: 'PUT',
    url: `${P}/profile/certificate`,
    body: { signerName: 'Nguyễn Trọng Chiến', signerTitle: null },
  },
];

describe('certificates.ts: mỗi hàm gọi đúng đường API', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', async (_name, c) => {
    await c.call();
    expect(seen).toHaveLength(1);
    const s = seen[0];
    expect(s?.method).toBe(c.method);
    expect(s?.url).toBe(c.url);
    expect(s?.body).toEqual(c.body);
    expect(s?.headers.Authorization).toBe('Bearer tok');
    expect(s?.headers['X-Client']).toBe('web');
    if (c.idem) expect(s?.headers['Idempotency-Key']).toBe(KEY);
    else expect(s?.headers['Idempotency-Key']).toBeUndefined();
  });

  it('đủ mọi hàm xuất ra của certificates.ts đều có bài thử', () => {
    const exported = Object.keys(certificates).sort();
    const tested = [...new Set(cases.map((c) => c.name.replace(/ \(.*\)$/, '')))].sort();
    expect(tested).toEqual(exported);
  });

  it('thiếu orgId thì báo lỗi ngay, không gọi máy chủ', () => {
    expect(() => certificates.listCertificates('')).toThrow('Thiếu orgId');
    expect(seen).toHaveLength(0);
  });

  it('id có ký tự lạ được mã hoá trong đường dẫn', async () => {
    await certificates.getCertificate('org/x', 'a b');
    expect(seen[0]?.url).toBe('/api/v1/orgs/org%2Fx/certificates/a%20b');
  });

  it('bỏ query rỗng: không có ids thì không gửi tham số ids', async () => {
    await certificates.listCertificates(ORG, { q: 'Mai' });
    expect(seen[0]?.url).toBe(`${P}/certificates?q=Mai`);
  });
});
