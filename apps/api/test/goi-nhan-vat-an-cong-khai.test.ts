// R1 (biên bản nghiệm thu lần 3): tắt nhân vật thì gói của nhân vật đó KHÔNG còn trên trang giới thiệu công khai,
// kể cả khi gói đang bật "hiện trên trang công khai". Studio không lập hợp đồng cho gói đó được (M1) nên khách
// không được thấy giá. Gói không gắn nhân vật và gói của nhân vật đang dùng vẫn hiện; bật lại thì hiện lại;
// tổ chức khác không bị ảnh hưởng.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, createOrg, makeApp, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
let app: App;

type Body = Record<string, unknown>;
const url = (org: string, p: string) => `/api/v1/orgs/${org}${p}`;
const idem = () => ({ 'idempotency-key': `k-${randomUUID()}` });
const uniq = () => randomUUID().slice(0, 6).toUpperCase();
const site = (slug: string) => request(app).get(`/api/v1/public/sites/${slug}`);

interface Studio {
  owner: TestUser;
  org: string;
  slug: string;
}

async function publishedStudio(label: string): Promise<Studio> {
  const owner = await registerUser(app, `chu-${label}`);
  const org = await createOrg(app, owner, `${label}-${randomUUID().slice(0, 4)}`);
  await request(app).put(url(org, '/profile')).set(bearer(owner)).send({ brandName: `Thương hiệu ${label}` }).expect(200);
  await request(app).post(url(org, '/profile/publish')).set(bearer(owner)).set(idem()).expect(200);
  const r = await request(app).get(url(org, '')).set(bearer(owner)).expect(200);
  return { owner, org, slug: r.body.slug as string };
}

async function newSubject(s: Studio, name: string): Promise<string> {
  const r = await request(app).post(url(s.org, '/makeup-subjects')).set(bearer(s.owner)).set(idem()).send({ name }).expect(201);
  return r.body.id as string;
}

async function newService(s: Studio, extra: Body) {
  const r = await request(app)
    .post(url(s.org, '/services'))
    .set(bearer(s.owner))
    .set(idem())
    .send({ code: `DV-${uniq()}`, name: `Dịch vụ ${uniq()}`, durationMinutes: 60, listPrice: 500_000, isPublic: true, ...extra })
    .expect(201);
  return r.body.id as string;
}

async function newPackage(s: Studio, name: string, extra: Body = {}): Promise<string> {
  const r = await request(app)
    .post(url(s.org, '/packages'))
    .set(bearer(s.owner))
    .set(idem())
    .send({ code: `G-${uniq()}`, name, durationMinutes: 120, listPrice: 800_000, isPublic: true, ...extra })
    .expect(201);
  return r.body.id as string;
}

const setSubject = (s: Studio, subjectId: string, isActive: boolean) =>
  request(app).patch(url(s.org, `/makeup-subjects/${subjectId}`)).set(bearer(s.owner)).send({ isActive }).expect(200);

const pkgIds = (body: { packages: { id: string }[] }) => body.packages.map((p) => p.id);

let A: Studio;
let B: Studio;
let subjA: string; // "Mẹ cô dâu" của A — sẽ tắt
let keepSubjA: string; // nhân vật khác của A — luôn bật
let addonOnlyA: string; // dịch vụ phụ CHỈ kèm gói sẽ ẩn, KHÔNG công khai riêng
let pkgHiddenA: string;
let pkgKeepA: string;
let pkgNoSubjA: string;
let subjB: string; // cùng tên với nhân vật của A nhưng thuộc B
let pkgB: string;

beforeAll(async () => {
  app = makeApp(deps);
  A = await publishedStudio('r1-a');
  B = await publishedStudio('r1-b');
  subjA = await newSubject(A, 'Mẹ cô dâu R1');
  keepSubjA = await newSubject(A, 'Phù dâu R1');
  addonOnlyA = await newService(A, { kind: 'ADDON', name: 'Tóc kèm gói mẹ', isPublic: false, listPrice: 150_000 });
  const addonPub = await newService(A, { kind: 'ADDON', name: 'Nối mi R1', listPrice: 120_000 });
  pkgHiddenA = await newPackage(A, 'Gói mẹ cô dâu R1', {
    subjectId: subjA,
    items: [
      { serviceId: addonOnlyA, isOptional: true },
      { serviceId: addonPub, isOptional: true },
    ],
  });
  pkgKeepA = await newPackage(A, 'Gói phù dâu R1', { subjectId: keepSubjA, items: [{ serviceId: addonPub, isOptional: true }] });
  pkgNoSubjA = await newPackage(A, 'Gói lẻ không nhân vật R1');
  subjB = await newSubject(B, 'Mẹ cô dâu R1');
  pkgB = await newPackage(B, 'Gói mẹ cô dâu của B', { subjectId: subjB });
});

afterAll(async () => {
  await deps.db.$disconnect();
});

describe('R1 — gói của nhân vật đang ẩn không lên trang công khai', () => {
  it('trước khi tắt: đủ ba gói công khai (đúng nền để bài sau có nghĩa)', async () => {
    const s = (await site(A.slug).expect(200)).body;
    expect(pkgIds(s)).toEqual(expect.arrayContaining([pkgHiddenA, pkgKeepA, pkgNoSubjA]));
    expect(s.subjects.map((x: { id: string }) => x.id)).toContain(subjA);
  });

  it('BẮT: tắt nhân vật → gói của nó biến mất khỏi trang (không id, không tên, không giá, không dịch vụ phụ riêng của gói)', async () => {
    await setSubject(A, subjA, false);
    const r = await site(A.slug).expect(200);
    const s = r.body;
    expect(pkgIds(s)).not.toContain(pkgHiddenA);
    const text = JSON.stringify(s);
    expect(text).not.toContain(pkgHiddenA);
    expect(text).not.toContain('Gói mẹ cô dâu R1');
    expect(text).not.toContain(subjA);
    // Dịch vụ phụ chỉ có trong gói bị ẩn (không công khai riêng) cũng không còn bất kỳ dấu vết nào.
    expect(text).not.toContain(addonOnlyA);
    expect(text).not.toContain('Tóc kèm gói mẹ');
    // Mọi gói còn lại đều có nhân vật đang hiện, hoặc không có nhân vật — không gói nào rơi vào nhóm "lạ".
    const shown = new Set(s.subjects.map((x: { id: string }) => x.id));
    for (const p of s.packages as { subject: { id: string } | null }[]) {
      if (p.subject) expect(shown.has(p.subject.id)).toBe(true);
    }
  });

  it('GIỮ: gói của nhân vật khác và gói không nhân vật vẫn hiện, giữ nguyên dịch vụ phụ công khai', async () => {
    const s = (await site(A.slug).expect(200)).body;
    expect(pkgIds(s)).toEqual(expect.arrayContaining([pkgKeepA, pkgNoSubjA]));
    const keep = s.packages.find((p: { id: string }) => p.id === pkgKeepA);
    expect(keep.subject).toEqual({ id: keepSubjA, name: 'Phù dâu R1' });
    expect(keep.addons.map((a: { name: string }) => a.name)).toEqual(['Nối mi R1']);
    expect(keep.price).toMatchObject({ listPrice: 800_000 });
    expect(s.packages.find((p: { id: string }) => p.id === pkgNoSubjA).subject).toBeNull();
  });

  it('GIỮ (cách ly): tổ chức B có nhân vật cùng tên vẫn hiện gói của mình; B không tắt được nhân vật của A', async () => {
    const sb = (await site(B.slug).expect(200)).body;
    expect(pkgIds(sb)).toContain(pkgB);
    expect(sb.subjects.map((x: { id: string }) => x.id)).toContain(subjB);
    // B cố bật lại nhân vật của A qua tổ chức của B → không thấy (cửa gác), A vẫn ẩn gói.
    const cross = await request(app).patch(url(B.org, `/makeup-subjects/${subjA}`)).set(bearer(B.owner)).send({ isActive: true });
    expect(cross.status).toBe(404);
    const crossA = await request(app).patch(url(A.org, `/makeup-subjects/${subjA}`)).set(bearer(B.owner)).send({ isActive: true });
    expect([403, 404]).toContain(crossA.status);
    expect(pkgIds((await site(A.slug).expect(200)).body)).not.toContain(pkgHiddenA);
    // Tắt nhân vật của B không đụng tới trang của A.
    await setSubject(B, subjB, false);
    expect(pkgIds((await site(B.slug).expect(200)).body)).not.toContain(pkgB);
    expect(pkgIds((await site(A.slug).expect(200)).body)).toEqual(expect.arrayContaining([pkgKeepA, pkgNoSubjA]));
    await setSubject(B, subjB, true);
    expect(pkgIds((await site(B.slug).expect(200)).body)).toContain(pkgB);
  });

  it('GIỮ: bật lại nhân vật → gói hiện lại đủ giá và dịch vụ phụ công khai', async () => {
    await setSubject(A, subjA, true);
    const s = (await site(A.slug).expect(200)).body;
    const back = s.packages.find((p: { id: string }) => p.id === pkgHiddenA);
    expect(back).toBeTruthy();
    expect(back.subject).toEqual({ id: subjA, name: 'Mẹ cô dâu R1' });
    expect(back.price).toMatchObject({ listPrice: 800_000 });
    expect(back.addons.map((a: { name: string }) => a.name)).toEqual(['Nối mi R1']);
  });
});
