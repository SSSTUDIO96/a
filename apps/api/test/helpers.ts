import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app';
import { loadEnv } from '../src/env';
import { createLogger } from '../src/lib/logger';
import { createPrisma } from '../src/lib/prisma';
import type { Deps } from '../src/http/route';

export function makeDeps(overrides: Record<string, string> = {}): Deps {
  const env = loadEnv({ ...process.env, ...overrides });
  return { env, db: createPrisma(env.DATABASE_URL), logger: createLogger('silent') };
}

export function makeApp(deps: Deps) {
  return createApp(deps);
}

export type App = ReturnType<typeof makeApp>;

export interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(app: App, label = 'user'): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@thu.local`;
  const password = 'mat-khau-thu-123';
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, fullName: `Người thử ${label}` })
    .expect(201);
  return { id: res.body.user.id, email, password, accessToken: res.body.accessToken, refreshToken: res.body.refreshToken };
}

export async function createOrg(app: App, owner: TestUser, label = 'org'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/orgs')
    .set('authorization', `Bearer ${owner.accessToken}`)
    .send({ name: `Tổ chức ${label}`, slug: `${label}-${randomUUID().slice(0, 8)}`, kind: 'TEAM' })
    .expect(201);
  return res.body.id as string;
}

export async function addMember(app: App, actor: TestUser, orgId: string, user: TestUser, roleKeys: string[]) {
  const res = await request(app)
    .post(`/api/v1/orgs/${orgId}/members`)
    .set('authorization', `Bearer ${actor.accessToken}`)
    .send({ email: user.email, roleKeys });
  if (res.status !== 201) throw new Error(`Thêm thành viên thất bại ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}

export function bearer(u: TestUser) {
  return { authorization: `Bearer ${u.accessToken}` };
}
