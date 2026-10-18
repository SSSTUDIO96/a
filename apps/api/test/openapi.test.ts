import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ALL_ROUTES } from '../src/app';
import { makeApp, makeDeps } from './helpers';

const deps = makeDeps();
afterAll(async () => {
  await deps.db.$disconnect();
});

describe('tài liệu OpenAPI', () => {
  it('mọi đường API đều có trong tài liệu, kèm quyền yêu cầu', async () => {
    const res = await request(makeApp(deps)).get('/api/v1/openapi.json').expect(200);
    let found = 0;
    for (const r of ALL_ROUTES) {
      const op = res.body.paths[`/api/v1${r.path.replace(/:([A-Za-z]+)/g, '{$1}')}`]?.[r.method];
      if (op && op['x-permission'] === (r.permission ?? null)) found++;
    }
    console.log(`[openapi] có trong tài liệu: ${found}/${ALL_ROUTES.length} đường`);
    expect(found).toBe(ALL_ROUTES.length);
  });
});
