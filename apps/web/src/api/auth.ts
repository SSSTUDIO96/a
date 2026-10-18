import { api, setAccessToken } from './client';
import { ApiError } from './errors';

// Kiểu khớp apps/api/src/modules/auth/routes.ts và orgs/routes.ts (POST /orgs).
export type OrgKind = 'INDIVIDUAL' | 'TEAM' | 'ACADEMY';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
}

export interface MyOrganization {
  membershipId: string;
  id: string;
  name: string;
  slug: string;
  kind: OrgKind;
  roles: { key: string; name: string }[];
}

export interface Me extends AuthUser {
  organizations: MyOrganization[];
}

// Web (X-Client: web) không nhận refreshToken trong thân — nó nằm trong cookie httpOnly.
interface AuthResult {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export interface CreateOrgInput {
  name: string;
  slug: string;
  kind: OrgKind;
}

// POST /orgs trả nguyên dòng tổ chức vừa tạo.
export interface CreatedOrganization {
  id: string;
  name: string;
  slug: string;
  kind: OrgKind;
  timezone: string;
  currency: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export { refreshSession } from './client';

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await api.post<AuthResult>('/auth/login', { email, password }, { auth: false });
  setAccessToken(res.accessToken);
  return res.user;
}

export async function register(input: RegisterInput, idempotencyKey: string): Promise<AuthUser> {
  const res = await api.create<AuthResult>('/auth/register', input, idempotencyKey, { auth: false });
  setAccessToken(res.accessToken);
  return res.user;
}

// Máy chủ thu hồi họ refresh token và xoá cookie. Phiên vốn đã không còn (401) cũng coi là đã đăng xuất;
// lỗi khác (mất mạng...) thì ném lên, không giả vờ thành công.
export async function logout(): Promise<void> {
  try {
    await api.post<undefined>('/auth/logout', {}, { auth: false });
  } catch (err) {
    if (!(err instanceof ApiError && err.code === 'UNAUTHENTICATED')) throw err;
  }
  setAccessToken(null);
}

export function getMe(signal?: AbortSignal): Promise<Me> {
  return api.get<Me>('/auth/me', signal);
}

export function createOrganization(input: CreateOrgInput, idempotencyKey: string): Promise<CreatedOrganization> {
  return api.create<CreatedOrganization>('/orgs', input, idempotencyKey);
}
