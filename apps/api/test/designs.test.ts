// Module MẪU THIẾT KẾ VÀ THẺ (gói M6, bản vẽ C3 mục 1.3–1.4): danh mục mẫu, giá trị ô từ hợp đồng, câu chúc soạn sẵn,
// thẻ chào mừng / feedback / lời chúc. Khoá học, lớp, hợp đồng khoá học và tệp ảnh tạo thẳng bằng deps.db (đường API khoá học,
// hợp đồng khoá học và tải tệp DESIGN_PHOTO/DESIGN_CARD do thợ khác làm song song).
// Cuối tệp: chạy cửa gác cách ly + cửa gác sửa một phần CHỈ trên designRoutes, với mẫu đề xuất cho điều phối.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { FilePurpose } from '@prisma/client';
import { DEFAULT_GREETING_PHRASES, DESIGN_TEMPLATES } from '@makeup/shared';
import { ALL_ROUTES, createApp } from '../src/app';
import { designRoutes } from '../src/modules/designs/routes';
import { seedDefaultGreetingPhrases } from '../src/modules/designs/seed';
import { buildGateFixture, printReport, runIsolationGate, type GateFixture, type GateOrg, type GateReport, type RefSamples, type Samples } from './gate';
import { printPartialReport, runPartialPatchGate, type PartialReport, type PartialSamples } from './gate-partial';
import { addMember, bearer, createOrg, makeDeps, registerUser, type App, type TestUser } from './helpers';

const deps = makeDeps();
// designRoutes do điều phối đăng ký vào ALL_ROUTES; trước lúc đó bài thử tự gắn thêm (không gắn hai lần).
const ROUTES = ALL_ROUTES.includes(designRoutes[0] ?? ALL_ROUTES[0]!) ? ALL_ROUTES : [...ALL_ROUTES, ...designRoutes];
let app: App;

afterAll(async () => {
  await deps.db.$disconnect();
});

const idem = () => `k-${randomUUID()}`;
const url = (orgId: string, rest: string) => `/api/v1/orgs/${orgId}${rest}`;
// URL ký có hạn: driver đĩa cục bộ trả /api/v1/files/raw/<vé ký>, S3 trả https://…?X-Amz-Signature=…
const SIGNED = /\/files\/raw\/[A-Za-z0-9_.-]+|^https:\/\/.+X-Amz-Signature=/;
const strip = (body: unknown) => JSON.stringify(body).replace(/"requestId":"[^"]+"/g, '');

async function insertFile(orgId: string, userId: string, purpose: FilePurpose, status: 'READY' | 'UPLOADING' = 'READY') {
  const f = await deps.db.storedFile.create({
    data: {
      organizationId: orgId,
      purpose,
      storageKey: `org/${orgId}/${purpose.toLowerCase().replace(/_/g, '-')}/${randomUUID()}.png`,
      originalName: 'anh.png',
      mimeType: 'image/png',
      sizeBytes: 1000n,
      status,
      createdById: userId,
    },
  });
  return f.id;
}

interface World {
  orgId: string;
  owner: TestUser;
  membershipId: string;
  customerId: string;
  serviceContractId: string;
  courseContractId: string;
  classId: string;
  class2Id: string;
  photos: string[];
  cardFile: string;
  avatarFile: string;
  logoFile: string;
}

// Hợp đồng dịch vụ: dòng gói "Gói cô dâu" (nhân vật Cô dâu), ngày sự kiện 20/12/2026 01:00 giờ Việt Nam.
async function serviceContract(orgId: string, userId: string, customerId: string) {
  const pkg = await deps.db.servicePackage.create({
    data: { organizationId: orgId, code: `G${randomUUID().slice(0, 6)}`, name: 'Gói cô dâu', durationMinutes: 120 },
  });
  const c = await deps.db.contract.create({
    data: {
      organizationId: orgId,
      code: `HĐ-T${randomUUID().slice(0, 6)}`,
      customerId,
      createdById: userId,
      // 01:00 ngày 20/12 giờ Việt Nam = 18:00 ngày 19/12 UTC: ô nsk phải theo múi giờ tổ chức.
      eventDate: new Date('2026-12-19T18:00:00.000Z'),
      lines: {
        create: [
          { kind: 'CUSTOM', name: 'Phụ phí', unitPrice: 0n, lineTotal: 0n, createdById: userId, sortOrder: 0 },
          {
            kind: 'PACKAGE',
            packageId: pkg.id,
            name: 'Gói cô dâu',
            subjectName: 'Cô dâu',
            unitPrice: 0n,
            lineTotal: 0n,
            createdById: userId,
            sortOrder: 1,
          },
        ],
      },
    },
  });
  return c.id;
}

// Hợp đồng khoá học: khoá "Makeup chuyên nghiệp", lớp K12 (T3·T5·T7 18:00–21:00, giảng viên Cô Mai, cơ sở Quận 3)
// và lớp K13 thêm cho bài đổi lớp.
async function courseContract(orgId: string, userId: string, customerId: string, membershipId: string) {
  const course = await deps.db.course.create({
    data: {
      organizationId: orgId,
      code: `KH-${randomUUID().slice(0, 6)}`,
      name: 'Makeup chuyên nghiệp',
      mode: 'MULTI_CLASS',
      tuitionFee: 0n,
      defaultCapacity: 10,
      createdById: userId,
    },
  });
  const loc = await deps.db.studioLocation.create({ data: { organizationId: orgId, name: 'Cơ sở Quận 3', address: '12 Lý Chính Thắng, Q3' } });
  const mk = (name: string, start: string, end: string) =>
    deps.db.courseClass.create({
      data: {
        organizationId: orgId,
        courseId: course.id,
        name,
        startDate: new Date(`${start}T00:00:00.000Z`),
        endDate: new Date(`${end}T00:00:00.000Z`),
        weekdays: [6, 2, 4],
        startMinute: 1080,
        endMinute: 1260,
        capacity: 10,
        instructorMembershipId: membershipId,
        studioLocationId: loc.id,
        createdById: userId,
      },
    });
  const k12 = await mk('K12', '2026-11-02', '2026-12-20');
  const k13 = await mk('K13', '2027-01-05', '2027-02-20');
  const c = await deps.db.contract.create({
    data: {
      organizationId: orgId,
      code: `HĐKH-T${randomUUID().slice(0, 6)}`,
      kind: 'COURSE',
      // Hợp đồng khoá học có ghi ngày vẫn không có ô nsk (ô chỉ của hợp đồng dịch vụ).
      eventDate: new Date('2026-11-02T03:00:00.000Z'),
      customerId,
      createdById: userId,
      lines: {
        create: [
          { kind: 'COURSE', courseClassId: k12.id, name: 'Makeup chuyên nghiệp · K12', unitPrice: 0n, lineTotal: 0n, createdById: userId, sortOrder: 0 },
          { kind: 'COURSE', courseClassId: k13.id, name: 'Makeup chuyên nghiệp · K13', unitPrice: 0n, lineTotal: 0n, createdById: userId, sortOrder: 1 },
        ],
      },
    },
  });
  return { contractId: c.id, classId: k12.id, class2Id: k13.id };
}

async function world(label: string): Promise<World> {
  const owner = await registerUser(app, `tk-chu-${label}`);
  const orgId = await createOrg(app, owner, `tk-${label}`);
  const m = await deps.db.membership.findFirstOrThrow({ where: { organizationId: orgId, userId: owner.id } });
  await deps.db.staffProfile.create({ data: { membershipId: m.id, organizationId: orgId, displayName: 'Cô Mai' } });
  const avatarFile = await insertFile(orgId, owner.id, 'CUSTOMER_AVATAR');
  const logoFile = await insertFile(orgId, owner.id, 'ORG_LOGO');
  const customer = await deps.db.customer.create({
    data: { organizationId: orgId, fullName: `Nguyễn Thị Hoa ${label}`, phone: '0912345678', avatarFileId: avatarFile },
  });
  await request(app)
    .put(url(orgId, '/profile'))
    .set(bearer(owner))
    .send({
      brandName: `Thương hiệu ${label}`,
      address: '1 Lê Lợi, Q1',
      phone: '0901234567',
      website: 'https://thuonghieu.vn',
      logoFileId: logoFile,
    })
    .expect(200);
  const serviceContractId = await serviceContract(orgId, owner.id, customer.id);
  const course = await courseContract(orgId, owner.id, customer.id, m.id);
  const photos = [];
  for (let i = 0; i < 4; i++) photos.push(await insertFile(orgId, owner.id, 'DESIGN_PHOTO'));
  return {
    orgId,
    owner,
    membershipId: m.id,
    customerId: customer.id,
    serviceContractId,
    courseContractId: course.contractId,
    classId: course.classId,
    class2Id: course.class2Id,
    photos,
    cardFile: await insertFile(orgId, owner.id, 'DESIGN_CARD'),
    avatarFile,
    logoFile,
  };
}

let A: World;
let B: World;

beforeAll(async () => {
  app = createApp(deps, ROUTES);
  A = await world('a');
  B = await world('b');
});

function createCard(u: TestUser, orgId: string, body: object, key = idem()) {
  return request(app).post(url(orgId, '/design-cards')).set(bearer(u)).set('idempotency-key', key).send(body);
}

const feedback = (w: World, extra: object = {}) => ({
  kind: 'FEEDBACK',
  templateCode: 'fb-01',
  contractId: w.serviceContractId,
  body: 'Makeup đẹp, giữ lớp cả ngày',
  photoFileIds: [w.photos[0]],
  size: '1080x1350',
  ...extra,
});

const issuePaths = (res: request.Response) => (res.body.error.details.issues as { path: string }[]).map((i) => i.path);

describe('danh mục mẫu (GET /design-templates)', () => {
  it('trả đủ 26 mẫu; lọc theo loại thẻ và loại hợp đồng', async () => {
    const all = await request(app).get(url(A.orgId, '/design-templates')).set(bearer(A.owner)).expect(200);
    expect(all.body).toHaveLength(DESIGN_TEMPLATES.length);
    expect(all.body).toHaveLength(26);
    const welcome = await request(app).get(url(A.orgId, '/design-templates')).query({ kind: 'WELCOME' }).set(bearer(A.owner)).expect(200);
    expect(welcome.body.map((t: { code: string }) => t.code)).toEqual(['shd-01', 'shd-02', 'shd-03', 'shd-04', 'shd-05', 'shd-06', 'shd-07', 'shd-08', 'shd-09', 'shd-10']);
    const svc = await request(app).get(url(A.orgId, '/design-templates')).query({ contractKind: 'SERVICE' }).set(bearer(A.owner)).expect(200);
    const codes = svc.body.map((t: { code: string }) => t.code);
    expect(codes).not.toContain('shd-01');
    expect(codes).not.toContain('lc-05');
    expect(codes).toContain('fb-09');
    await request(app).get(url(A.orgId, '/design-templates')).query({ kind: 'KHAC' }).set(bearer(A.owner)).expect(400);
  });
});

describe('giá trị ô từ dữ liệu (GET /contracts/:id/design-data)', () => {
  it('hợp đồng dịch vụ: khoa/lop/ngay/nkt/lich/gv = null; nv, goi, nsk có giá trị; ảnh là URL ký', async () => {
    const res = await request(app).get(url(A.orgId, `/contracts/${A.serviceContractId}/design-data`)).set(bearer(A.owner)).expect(200);
    expect(res.body).toMatchObject({
      contractKind: 'SERVICE',
      courseClassId: null,
      th: 'Thương hiệu a',
      diachi: '1 Lê Lợi, Q1',
      sdt: '0901234567',
      web: 'https://thuonghieu.vn',
      ten: 'Nguyễn Thị Hoa a',
      khoa: null,
      lop: null,
      ngay: null,
      nkt: null,
      lich: null,
      gv: null,
      nv: 'Cô dâu',
      goi: 'Gói cô dâu',
      nsk: '2026-12-20',
    });
    expect(res.body.logoUrl).toMatch(SIGNED);
    expect(res.body.anhUrl).toMatch(SIGNED);
    expect(typeof res.body.signedUrlExpiresAt).toBe('string');
  });

  it('hợp đồng khoá học: khoa, lop, ngay, nkt, lich, gv, địa chỉ cơ sở; nv/goi/nsk = null; chọn lớp khác bằng courseClassId', async () => {
    const res = await request(app).get(url(A.orgId, `/contracts/${A.courseContractId}/design-data`)).set(bearer(A.owner)).expect(200);
    expect(res.body).toMatchObject({
      contractKind: 'COURSE',
      courseClassId: A.classId,
      khoa: 'Makeup chuyên nghiệp',
      lop: 'K12',
      ngay: '2026-11-02',
      nkt: '2026-12-20',
      lich: 'T3 · T5 · T7, 18:00–21:00',
      gv: 'Cô Mai',
      diachi: '12 Lý Chính Thắng, Q3',
      nv: null,
      goi: null,
      nsk: null,
    });
    const k13 = await request(app)
      .get(url(A.orgId, `/contracts/${A.courseContractId}/design-data`))
      .query({ courseClassId: A.class2Id })
      .set(bearer(A.owner))
      .expect(200);
    expect(k13.body).toMatchObject({ lop: 'K13', ngay: '2027-01-05' });
  });

  it('lớp không thuộc hợp đồng → 400 ở courseClassId; lớp của tổ chức khác trả y hệt lớp bịa', async () => {
    const other = await request(app).get(url(A.orgId, `/contracts/${A.courseContractId}/design-data`)).query({ courseClassId: B.classId }).set(bearer(A.owner));
    const fake = await request(app).get(url(A.orgId, `/contracts/${A.courseContractId}/design-data`)).query({ courseClassId: randomUUID() }).set(bearer(A.owner));
    expect(other.status).toBe(400);
    expect(issuePaths(other)).toEqual(['courseClassId']);
    expect(strip(other.body)).toBe(strip(fake.body));
  });

  it('hợp đồng của tổ chức khác → 404 giống hệt mã bịa', async () => {
    const other = await request(app).get(url(A.orgId, `/contracts/${B.serviceContractId}/design-data`)).set(bearer(A.owner));
    const fake = await request(app).get(url(A.orgId, `/contracts/${randomUUID()}/design-data`)).set(bearer(A.owner));
    expect(other.status).toBe(404);
    expect(strip(other.body)).toBe(strip(fake.body));
  });
});

describe('tạo thẻ — kiểm mẫu, ảnh, hợp đồng (POST /design-cards)', () => {
  it('mẫu sai loại hợp đồng → 400 VALIDATION_FAILED, details.issues chỉ đúng templateCode', async () => {
    const res = await createCard(A.owner, A.orgId, {
      kind: 'GREETING',
      templateCode: 'lc-05',
      contractId: A.serviceContractId,
      title: 'Chúc mừng em',
      body: 'Chúc mừng em đã hoàn thành khoá học',
      size: '1080x1350',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(issuePaths(res)).toEqual(['templateCode']);
    expect(res.body.error.message).toBe('Mẫu lc-05 chỉ dùng cho hợp đồng khoá học');
    // Chiều ngược lại: mẫu chỉ dịch vụ trên hợp đồng khoá học.
    const rev = await createCard(A.owner, A.orgId, { ...feedback(A), templateCode: 'fb-09', contractId: A.courseContractId, photoFileIds: A.photos.slice(0, 2) });
    expect(rev.status).toBe(400);
    expect(issuePaths(rev)).toEqual(['templateCode']);
    expect(rev.body.error.message).toBe('Mẫu fb-09 chỉ dùng cho hợp đồng dịch vụ');
  });

  it('mã mẫu bịa và mẫu khác loại thẻ → 400 ở templateCode', async () => {
    const bia = await createCard(A.owner, A.orgId, feedback(A, { templateCode: 'fb-99' }));
    expect(bia.status).toBe(400);
    expect(issuePaths(bia)).toEqual(['templateCode']);
    const wrongKind = await createCard(A.owner, A.orgId, feedback(A, { templateCode: 'lc-01' }));
    expect(wrongKind.status).toBe(400);
    expect(issuePaths(wrongKind)).toEqual(['templateCode']);
  });

  it('quá 3 ảnh → 400 ở photoFileIds; số ảnh khác số ô của mẫu → 400 ở photoFileIds', async () => {
    const four = await createCard(A.owner, A.orgId, feedback(A, { templateCode: 'fb-04', photoFileIds: A.photos }));
    expect(four.status).toBe(400);
    expect(four.body.error.code).toBe('VALIDATION_FAILED');
    expect(issuePaths(four)).toEqual(['photoFileIds']);
    expect(four.body.error.details.issues[0].message).toBe('Tối đa 3 ảnh mỗi thẻ');
    const two = await createCard(A.owner, A.orgId, feedback(A, { templateCode: 'fb-04', photoFileIds: A.photos.slice(0, 2) }));
    expect(two.status).toBe(400);
    expect(issuePaths(two)).toEqual(['photoFileIds']);
    expect(two.body.error.message).toBe('Mẫu fb-04 cần đúng 3 ảnh tải lên (đang có 2)');
  });

  it('ảnh của tổ chức khác → 400 ở photoFileIds.N, phản hồi giống hệt mã ảnh bịa', async () => {
    const other = await createCard(A.owner, A.orgId, feedback(A, { photoFileIds: [B.photos[0]] }));
    const fake = await createCard(A.owner, A.orgId, feedback(A, { photoFileIds: [randomUUID()] }));
    expect(other.status).toBe(400);
    expect(issuePaths(other)).toEqual(['photoFileIds.0']);
    expect(strip(other.body)).toBe(strip(fake.body));
  });

  it('ảnh sai mục đích / chưa tải xong → 400 ở đúng ô ảnh', async () => {
    const wrongPurpose = await createCard(A.owner, A.orgId, feedback(A, { photoFileIds: [A.avatarFile] }));
    expect(wrongPurpose.status).toBe(400);
    expect(issuePaths(wrongPurpose)).toEqual(['photoFileIds.0']);
    const uploading = await insertFile(A.orgId, A.owner.id, 'DESIGN_PHOTO', 'UPLOADING');
    const notReady = await createCard(A.owner, A.orgId, feedback(A, { templateCode: 'fb-05', photoFileIds: [A.photos[0], uploading] }));
    expect(notReady.status).toBe(400);
    expect(issuePaths(notReady)).toEqual(['photoFileIds.1']);
  });

  it('hợp đồng của tổ chức khác → 404 giống hệt mã bịa', async () => {
    const other = await createCard(A.owner, A.orgId, feedback(A, { contractId: B.serviceContractId }));
    const fake = await createCard(A.owner, A.orgId, feedback(A, { contractId: randomUUID() }));
    expect(other.status).toBe(404);
    expect(strip(other.body)).toBe(strip(fake.body));
  });

  it('luật trường theo loại thẻ: feedback thiếu lời khen, số sao ở thẻ lời chúc → 400 đúng trường', async () => {
    const noBody = await createCard(A.owner, A.orgId, feedback(A, { body: null }));
    expect(noBody.status).toBe(400);
    expect(issuePaths(noBody)).toEqual(['body']);
    const star = await createCard(A.owner, A.orgId, {
      kind: 'GREETING',
      templateCode: 'lc-01',
      contractId: A.serviceContractId,
      body: 'Trăm năm hạnh phúc',
      rating: 5,
      photoFileIds: [A.photos[0]],
      size: '1080x1350',
    });
    expect(star.status).toBe(400);
    expect(issuePaths(star)).toEqual(['rating']);
  });

  it('ghi đè snapshot chỉ nhận ô chữ của mẫu: ô lạ / ô ảnh / ô của loại hợp đồng kia → 400 đúng khoá', async () => {
    const res = await createCard(A.owner, A.orgId, feedback(A, { snapshot: { khong_co: 'x', a1: 'y', khoa: 'z' } }));
    expect(res.status).toBe(400);
    expect(issuePaths(res).sort()).toEqual(['snapshot.a1', 'snapshot.khoa', 'snapshot.khong_co']);
  });

  it('tạo thẻ feedback dịch vụ: chép khách từ hợp đồng, snapshot = giá trị đã điền, ảnh ký có hạn, chống gửi trùng', async () => {
    const key = idem();
    const res = await createCard(A.owner, A.orgId, feedback(A, { snapshot: { ten: 'Chị Hoa' } }), key);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      kind: 'FEEDBACK',
      templateCode: 'fb-01',
      templateVersion: 1,
      contractId: A.serviceContractId,
      customerId: A.customerId,
      courseClassId: null,
      body: 'Makeup đẹp, giữ lớp cả ngày',
      size: '1080x1350',
      outputUrl: null,
    });
    // fb-01 ở hợp đồng dịch vụ: logo, th, nd, a1, ten, nv, goi, nsk (không có khoa/lop).
    expect(res.body.snapshot).toEqual({
      logo: A.logoFile,
      th: 'Thương hiệu a',
      nd: 'Makeup đẹp, giữ lớp cả ngày',
      a1: A.photos[0],
      ten: 'Chị Hoa',
      nv: 'Cô dâu',
      goi: 'Gói cô dâu',
      nsk: '2026-12-20',
    });
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos[0]).toMatchObject({ sortOrder: 0, fileId: A.photos[0] });
    expect(res.body.photos[0].signedUrl).toMatch(SIGNED);
    const again = await createCard(A.owner, A.orgId, feedback(A, { snapshot: { ten: 'Chị Hoa' } }), key);
    expect(again.status).toBe(201);
    expect(again.body.id).toBe(res.body.id);
    expect(await deps.db.designCard.count({ where: { organizationId: A.orgId, id: res.body.id } })).toBe(1);
    const audit = await deps.db.auditLog.count({ where: { organizationId: A.orgId, entityId: res.body.id, action: 'design_card.created' } });
    expect(audit).toBe(1);
  });

  it('thẻ chào mừng khoá học: lớp mặc định = lớp của dòng đầu, ảnh học viên lấy từ khách (anh)', async () => {
    const res = await createCard(A.owner, A.orgId, { kind: 'WELCOME', templateCode: 'shd-02', contractId: A.courseContractId, size: '1080x1080' });
    expect(res.status).toBe(201);
    expect(res.body.courseClassId).toBe(A.classId);
    expect(res.body.snapshot).toEqual({
      logo: A.logoFile,
      th: 'Thương hiệu a',
      anh: A.avatarFile,
      ten: 'Nguyễn Thị Hoa a',
      khoa: 'Makeup chuyên nghiệp',
      lop: 'K12',
      ngay: '2026-11-02',
    });
    // Hợp đồng dịch vụ không nhận lớp.
    const svc = await createCard(A.owner, A.orgId, feedback(A, { courseClassId: A.classId }));
    expect(svc.status).toBe(400);
    expect(issuePaths(svc)).toEqual(['courseClassId']);
  });
});

describe('snapshot, sửa thẻ, ảnh đã xuất, danh sách, xoá', () => {
  let greetingId: string;

  beforeAll(async () => {
    const res = await createCard(A.owner, A.orgId, {
      kind: 'GREETING',
      templateCode: 'lc-01',
      contractId: A.serviceContractId,
      title: 'Trăm năm hạnh phúc',
      body: 'Chúc hai bạn trăm năm hạnh phúc',
      photoFileIds: [A.photos[1]],
      fontOverride: 'ky-2',
      size: '1080x1350',
    });
    expect(res.status).toBe(201);
    greetingId = res.body.id;
  });

  const getCard = async (id: string) => {
    const list = await request(app).get(url(A.orgId, '/design-cards')).set(bearer(A.owner)).expect(200);
    return (list.body as { id: string }[]).find((c) => c.id === id) as Record<string, unknown> | undefined;
  };

  it('snapshot giữ nguyên khi hồ sơ thương hiệu đổi sau; design-data thì theo hồ sơ mới', async () => {
    const before = await getCard(greetingId);
    expect((before?.snapshot as Record<string, unknown>).th).toBe('Thương hiệu a');
    await request(app)
      .put(url(A.orgId, '/profile'))
      .set(bearer(A.owner))
      .send({ brandName: 'Thương hiệu a đổi tên', address: '99 Hai Bà Trưng', logoFileId: A.logoFile })
      .expect(200);
    const after = await getCard(greetingId);
    expect(after?.snapshot).toEqual(before?.snapshot);
    const data = await request(app).get(url(A.orgId, `/contracts/${A.serviceContractId}/design-data`)).set(bearer(A.owner)).expect(200);
    expect(data.body.th).toBe('Thương hiệu a đổi tên');
    // Sửa một trường của thẻ cũng không kéo hồ sơ mới vào snapshot.
    const patched = await request(app).patch(url(A.orgId, `/design-cards/${greetingId}`)).set(bearer(A.owner)).send({ fontOverride: 'ky-3' }).expect(200);
    expect(patched.body.snapshot.th).toBe('Thương hiệu a');
  });

  it('PATCH một trường (title) không đổi trường khác; ô td trong snapshot theo title', async () => {
    const before = await getCard(greetingId);
    const res = await request(app).patch(url(A.orgId, `/design-cards/${greetingId}`)).set(bearer(A.owner)).send({ title: 'Hạnh phúc trọn đời' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Hạnh phúc trọn đời');
    for (const k of ['kind', 'templateCode', 'templateVersion', 'contractId', 'customerId', 'courseClassId', 'body', 'rating', 'receivedAt', 'fontOverride', 'size', 'outputFileId']) {
      expect(res.body[k], k).toEqual(before?.[k]);
    }
    expect(res.body.photos.map((p: { fileId: string }) => p.fileId)).toEqual([A.photos[1]]);
    expect(res.body.snapshot).toEqual({ ...(before?.snapshot as object), td: 'Hạnh phúc trọn đời' });
    const audit = await deps.db.auditLog.findFirst({ where: { entityId: greetingId, action: 'design_card.updated' }, orderBy: { createdAt: 'desc' } });
    expect((audit?.data as { after: { title: string } }).after.title).toBe('Hạnh phúc trọn đời');
  });

  it('PATCH không nhận kind / contractId; thân rỗng → 400; đổi mẫu kiểm lại loại hợp đồng và số ảnh', async () => {
    const kind = await request(app).patch(url(A.orgId, `/design-cards/${greetingId}`)).set(bearer(A.owner)).send({ kind: 'FEEDBACK' });
    expect(kind.status).toBe(400);
    const empty = await request(app).patch(url(A.orgId, `/design-cards/${greetingId}`)).set(bearer(A.owner)).send({});
    expect(empty.status).toBe(400);
    const course = await request(app).patch(url(A.orgId, `/design-cards/${greetingId}`)).set(bearer(A.owner)).send({ templateCode: 'lc-05' });
    expect(course.status).toBe(400);
    expect(issuePaths(course)).toEqual(['templateCode']);
    const lc04 = await request(app).patch(url(A.orgId, `/design-cards/${greetingId}`)).set(bearer(A.owner)).send({ templateCode: 'lc-04' });
    expect(lc04.status).toBe(400);
    expect(issuePaths(lc04)).toEqual(['photoFileIds']);
    const ok = await request(app)
      .patch(url(A.orgId, `/design-cards/${greetingId}`))
      .set(bearer(A.owner))
      .send({ templateCode: 'lc-04', photoFileIds: [A.photos[2], A.photos[3]] });
    expect(ok.status).toBe(200);
    expect(ok.body.photos.map((p: { fileId: string }) => p.fileId)).toEqual([A.photos[2], A.photos[3]]);
    // lc-04: a1, a2, td, ten, cc, goi, nsk, logo, th — giữ th cũ, bỏ ô không thuộc mẫu (nv, a1 cũ).
    expect(ok.body.snapshot).toMatchObject({ a1: A.photos[2], a2: A.photos[3], th: 'Thương hiệu a', goi: 'Gói cô dâu' });
    expect(ok.body.snapshot).not.toHaveProperty('nv');
    const four = await request(app).patch(url(A.orgId, `/design-cards/${greetingId}`)).set(bearer(A.owner)).send({ photoFileIds: A.photos });
    expect(four.status).toBe(400);
    expect(issuePaths(four)).toEqual(['photoFileIds']);
  });

  it('đổi lớp của thẻ khoá học lấy lại các ô theo lớp', async () => {
    const created = await createCard(A.owner, A.orgId, { kind: 'WELCOME', templateCode: 'shd-01', contractId: A.courseContractId, size: '1080x1350' });
    expect(created.status).toBe(201);
    const res = await request(app).patch(url(A.orgId, `/design-cards/${created.body.id}`)).set(bearer(A.owner)).send({ courseClassId: A.class2Id });
    expect(res.status).toBe(200);
    expect(res.body.courseClassId).toBe(A.class2Id);
    expect(res.body.snapshot).toMatchObject({ lop: 'K13', ngay: '2027-01-05', th: created.body.snapshot.th });
    const other = await request(app).patch(url(A.orgId, `/design-cards/${created.body.id}`)).set(bearer(A.owner)).send({ courseClassId: B.classId });
    expect(other.status).toBe(400);
    expect(issuePaths(other)).toEqual(['courseClassId']);
  });

  it('PUT output: tệp DESIGN_CARD → outputUrl ký có hạn; tệp sai mục đích / của tổ chức khác → 400 ở fileId', async () => {
    const wrong = await request(app).put(url(A.orgId, `/design-cards/${greetingId}/output`)).set(bearer(A.owner)).send({ fileId: A.photos[0] });
    expect(wrong.status).toBe(400);
    expect(issuePaths(wrong)).toEqual(['fileId']);
    const other = await request(app).put(url(A.orgId, `/design-cards/${greetingId}/output`)).set(bearer(A.owner)).send({ fileId: B.cardFile });
    const fake = await request(app).put(url(A.orgId, `/design-cards/${greetingId}/output`)).set(bearer(A.owner)).send({ fileId: randomUUID() });
    expect(other.status).toBe(400);
    expect(strip(other.body)).toBe(strip(fake.body));
    const ok = await request(app).put(url(A.orgId, `/design-cards/${greetingId}/output`)).set(bearer(A.owner)).send({ fileId: A.cardFile });
    expect(ok.status).toBe(200);
    expect(ok.body.outputFileId).toBe(A.cardFile);
    expect(ok.body.outputUrl).toMatch(SIGNED);
    expect(typeof ok.body.outputUrlExpiresAt).toBe('string');
    const listed = await getCard(greetingId);
    expect(listed?.outputUrl).toMatch(SIGNED);
  });

  it('danh sách lọc theo loại thẻ, hợp đồng, khách, thời gian; không lộ thẻ tổ chức khác', async () => {
    const bCard = await createCard(B.owner, B.orgId, feedback(B));
    expect(bCard.status).toBe(201);
    const q = (query: object) => request(app).get(url(A.orgId, '/design-cards')).query(query).set(bearer(A.owner)).expect(200);
    const greet = await q({ kind: 'GREETING' });
    expect(greet.body.length).toBeGreaterThan(0);
    expect(greet.body.every((c: { kind: string }) => c.kind === 'GREETING')).toBe(true);
    const byContract = await q({ contractId: A.courseContractId });
    expect(byContract.body.length).toBeGreaterThan(0);
    expect(byContract.body.every((c: { contractId: string }) => c.contractId === A.courseContractId)).toBe(true);
    const byCustomer = await q({ customerId: A.customerId });
    expect(byCustomer.body.length).toBe((await q({})).body.length);
    expect((await q({ customerId: B.customerId })).body).toEqual([]);
    expect((await q({ contractId: B.serviceContractId })).body).toEqual([]);
    const future = await q({ from: '2099-01-01T00:00:00.000Z' });
    expect(future.body).toEqual([]);
    const past = await q({ to: '2000-01-01T00:00:00.000Z' });
    expect(past.body).toEqual([]);
    const all = await q({});
    expect(JSON.stringify(all.body)).not.toContain(bCard.body.id);
    await request(app).get(url(A.orgId, '/design-cards')).query({ from: '2026-12-01T00:00:00Z', to: '2026-11-01T00:00:00Z' }).set(bearer(A.owner)).expect(400);
  });

  it('thẻ đã xoá không hiện trong danh sách; xoá lại / sửa thẻ đã xoá → 404', async () => {
    const created = await createCard(A.owner, A.orgId, feedback(A));
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect(await getCard(id)).toBeDefined();
    await request(app).delete(url(A.orgId, `/design-cards/${id}`)).set(bearer(A.owner)).expect(204);
    expect(await getCard(id)).toBeUndefined();
    const filtered = await request(app).get(url(A.orgId, '/design-cards')).query({ contractId: A.serviceContractId }).set(bearer(A.owner)).expect(200);
    expect(filtered.body.map((c: { id: string }) => c.id)).not.toContain(id);
    const row = await deps.db.designCard.findUniqueOrThrow({ where: { id } });
    expect(row.deletedAt).not.toBeNull();
    await request(app).delete(url(A.orgId, `/design-cards/${id}`)).set(bearer(A.owner)).expect(404);
    await request(app).patch(url(A.orgId, `/design-cards/${id}`)).set(bearer(A.owner)).send({ title: 'x' }).expect(404);
    await request(app).put(url(A.orgId, `/design-cards/${id}/output`)).set(bearer(A.owner)).send({ fileId: A.cardFile }).expect(404);
    expect(await deps.db.auditLog.count({ where: { entityId: id, action: 'design_card.deleted' } })).toBe(1);
  });

  it('thẻ của tổ chức khác: xem/sửa/xoá → 404 giống hệt mã bịa', async () => {
    const bCard = await createCard(B.owner, B.orgId, feedback(B));
    const id = bCard.body.id as string;
    const fake = randomUUID();
    for (const [method, suffix, body] of [
      ['patch', '', { title: 'x' }],
      ['put', '/output', { fileId: A.cardFile }],
      ['delete', '', undefined],
    ] as const) {
      const real = await request(app)[method](url(A.orgId, `/design-cards/${id}${suffix}`)).set(bearer(A.owner)).send(body);
      const bia = await request(app)[method](url(A.orgId, `/design-cards/${fake}${suffix}`)).set(bearer(A.owner)).send(body);
      expect(real.status, `${method}${suffix}`).toBe(404);
      expect(strip(real.body)).toBe(strip(bia.body));
    }
    expect((await deps.db.designCard.findUniqueOrThrow({ where: { id } })).deletedAt).toBeNull();
  });
});

describe('câu chúc soạn sẵn', () => {
  it('seedDefaultGreetingPhrases chép đúng 6 câu mặc định, chạy lại không nhân đôi', async () => {
    const owner = await registerUser(app, 'tk-seed');
    const orgId = await createOrg(app, owner, 'tk-seed');
    // Tạo tổ chức đã tự chép 6 câu (POST /orgs gọi seedDefaultGreetingPhrases): chạy lại → 0. Xoá đi để thử như tổ chức cũ chạy bù.
    expect(await deps.db.$transaction((tx) => seedDefaultGreetingPhrases(tx, orgId))).toBe(0);
    await deps.db.greetingPhrase.deleteMany({ where: { organizationId: orgId } });
    const n1 = await deps.db.$transaction((tx) => seedDefaultGreetingPhrases(tx, orgId));
    const n2 = await deps.db.$transaction((tx) => seedDefaultGreetingPhrases(tx, orgId));
    expect([n1, n2]).toEqual([6, 0]);
    const res = await request(app).get(url(orgId, '/greeting-phrases')).set(bearer(owner)).expect(200);
    expect(res.body.map((p: { title: string; body: string; appliesTo: string[] }) => ({ title: p.title, body: p.body, appliesTo: p.appliesTo }))).toEqual(
      DEFAULT_GREETING_PHRASES.map((p) => ({ title: p.title, body: p.body, appliesTo: [...p.appliesTo] })),
    );
    const course = await request(app).get(url(orgId, '/greeting-phrases')).query({ contractKind: 'COURSE' }).set(bearer(owner)).expect(200);
    expect(course.body.map((p: { name: string }) => p.name)).toEqual(['Cảm ơn đã tin chọn', 'Hoàn thành khoá học']);
  });

  it('thêm (chống gửi trùng), sửa một trường giữ trường khác, ẩn thì chỉ hiện khi includeInactive=true', async () => {
    const key = idem();
    const body = { name: 'Sinh nhật', appliesTo: ['SERVICE'], title: 'Mừng sinh nhật', body: 'Chúc bạn tuổi mới rạng rỡ' };
    const created = await request(app).post(url(A.orgId, '/greeting-phrases')).set(bearer(A.owner)).set('idempotency-key', key).send(body);
    expect(created.status).toBe(201);
    const again = await request(app).post(url(A.orgId, '/greeting-phrases')).set(bearer(A.owner)).set('idempotency-key', key).send(body);
    expect(again.body.id).toBe(created.body.id);
    const id = created.body.id as string;
    const patched = await request(app).patch(url(A.orgId, `/greeting-phrases/${id}`)).set(bearer(A.owner)).send({ title: 'Sinh nhật vui vẻ' });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ ...body, title: 'Sinh nhật vui vẻ', isActive: true, sortOrder: created.body.sortOrder });
    await request(app).patch(url(A.orgId, `/greeting-phrases/${id}`)).set(bearer(A.owner)).send({}).expect(400);
    await request(app).patch(url(A.orgId, `/greeting-phrases/${id}`)).set(bearer(A.owner)).send({ appliesTo: ['SERVICE', 'SERVICE'] }).expect(400);
    await request(app).patch(url(A.orgId, `/greeting-phrases/${id}`)).set(bearer(A.owner)).send({ isActive: false }).expect(200);
    const visible = await request(app).get(url(A.orgId, '/greeting-phrases')).set(bearer(A.owner)).expect(200);
    expect(visible.body.map((p: { id: string }) => p.id)).not.toContain(id);
    const all = await request(app).get(url(A.orgId, '/greeting-phrases')).query({ includeInactive: 'true' }).set(bearer(A.owner)).expect(200);
    expect(all.body.map((p: { id: string }) => p.id)).toContain(id);
    // Câu chúc của tổ chức khác → 404 giống hệt mã bịa.
    const real = await request(app).patch(url(B.orgId, `/greeting-phrases/${id}`)).set(bearer(B.owner)).send({ title: 'x' });
    const bia = await request(app).patch(url(B.orgId, `/greeting-phrases/${randomUUID()}`)).set(bearer(B.owner)).send({ title: 'x' });
    expect(real.status).toBe(404);
    expect(strip(real.body)).toBe(strip(bia.body));
    expect(await deps.db.auditLog.count({ where: { entityId: id } })).toBe(3);
  });
});

describe('quyền designs.read / designs.write', () => {
  it('giảng viên (designs.read, không designs.write) xem được, không tạo/sửa được', async () => {
    const teacher = await registerUser(app, 'tk-gv');
    await addMember(app, A.owner, A.orgId, teacher, ['instructor']);
    await request(app).get(url(A.orgId, '/design-cards')).set(bearer(teacher)).expect(200);
    await request(app).get(url(A.orgId, `/contracts/${A.serviceContractId}/design-data`)).set(bearer(teacher)).expect(200);
    const res = await createCard(teacher, A.orgId, feedback(A));
    expect(res.status).toBe(403);
    await request(app).post(url(A.orgId, '/greeting-phrases')).set(bearer(teacher)).set('idempotency-key', idem()).send({ name: 'x', appliesTo: [], title: 'x', body: 'x' }).expect(403);
  });
});

// ---------- Cửa gác chạy trên designRoutes: mẫu đề xuất cho test/gate-samples.ts (điều phối chép vào khi đăng ký) ----------

// Thêm vào fixture của cửa gác: hợp đồng khoá học + lớp (thay ids.contractId để đường design-data đo được courseClassId),
// ảnh DESIGN_PHOTO, ảnh DESIGN_CARD, một thẻ feedback trên hợp đồng khoá học, một câu chúc.
async function extendGateOrg(o: GateOrg) {
  const m = await deps.db.membership.findFirstOrThrow({ where: { organizationId: o.orgId, userId: o.owner.id } });
  const course = await courseContract(o.orgId, o.owner.id, o.ids.customerId ?? '', m.id);
  o.ids.serviceContractId = o.ids.contractId ?? '';
  o.ids.contractId = course.contractId;
  o.ids.classId = course.classId;
  o.ids.designPhotoId = await insertFile(o.orgId, o.owner.id, 'DESIGN_PHOTO');
  o.ids.designCardFileId = await insertFile(o.orgId, o.owner.id, 'DESIGN_CARD');
  const card = await createCard(o.owner, o.orgId, {
    kind: 'FEEDBACK',
    templateCode: 'fb-01',
    contractId: course.contractId,
    body: 'Lời khen mẫu',
    photoFileIds: [o.ids.designPhotoId],
    size: '1080x1350',
  });
  if (card.status !== 201) throw new Error(`Cửa gác thẻ: tạo thẻ mẫu ${card.status} ${JSON.stringify(card.body)}`);
  o.ids.cardId = card.body.id;
  const phrase = await request(app)
    .post(url(o.orgId, '/greeting-phrases'))
    .set(bearer(o.owner))
    .set('idempotency-key', idem())
    .send({ name: 'Mẫu', appliesTo: [], title: 'Tiêu đề mẫu', body: 'Câu chúc mẫu' });
  if (phrase.status !== 201) throw new Error(`Cửa gác thẻ: tạo câu chúc mẫu ${phrase.status}`);
  o.ids.phraseId = phrase.body.id;
}

const DESIGN_SAMPLES: Samples = {
  'PATCH /orgs/:orgId/greeting-phrases/:phraseId': () => ({ title: 'Đổi tiêu đề thử' }),
  'PATCH /orgs/:orgId/design-cards/:cardId': () => ({ title: 'Đổi tiêu đề thử' }),
  'PUT /orgs/:orgId/design-cards/:cardId/output': (o) => ({ fileId: o.ids.designCardFileId }),
};

const DESIGN_REF_SAMPLES: RefSamples = {
  'GET /orgs/:orgId/contracts/:contractId/design-data': [(o) => ({ courseClassId: o.ids.classId })],
  'GET /orgs/:orgId/design-cards': [(o) => ({ contractId: o.ids.contractId, customerId: o.ids.customerId })],
  'POST /orgs/:orgId/design-cards': [
    (o) => ({ kind: 'WELCOME', templateCode: 'shd-01', contractId: o.ids.contractId, courseClassId: o.ids.classId, size: '1080x1350' }),
    (o) => ({
      kind: 'FEEDBACK',
      templateCode: 'fb-01',
      contractId: o.ids.serviceContractId,
      body: 'Lời khen mẫu',
      photoFileIds: [o.ids.designPhotoId],
      size: '1080x1350',
    }),
  ],
  'PATCH /orgs/:orgId/design-cards/:cardId': [(o) => ({ courseClassId: o.ids.classId }), (o) => ({ photoFileIds: [o.ids.designPhotoId] })],
  'PUT /orgs/:orgId/design-cards/:cardId/output': [(o) => ({ fileId: o.ids.designCardFileId })],
};

const DESIGN_PARTIAL_SAMPLES: PartialSamples = {
  'PATCH /orgs/:orgId/greeting-phrases/:phraseId': {
    full: () => ({ name: 'Câu đủ', appliesTo: ['COURSE'], title: 'Tiêu đề đủ', body: 'Câu chúc đủ', sortOrder: 7, isActive: false }),
    one: () => ({ name: 'Câu đổi tên' }),
  },
  'PATCH /orgs/:orgId/design-cards/:cardId': {
    full: (c) => ({
      templateCode: 'fb-03',
      courseClassId: c.o.ids.classId,
      title: 'Tiêu đề đủ',
      body: 'Lời khen đủ',
      rating: 4,
      receivedAt: '2026-11-05',
      photoFileIds: [c.o.ids.designPhotoId],
      fontOverride: 'ky-2',
      size: '1080x1080',
      snapshot: { ten: 'Tên sửa tay' },
    }),
    one: () => ({ fontOverride: 'ky-3' }),
    derived: { outputUrl: 'URL ký đổi mỗi lần đọc', outputUrlExpiresAt: 'hạn URL ký đổi mỗi lần đọc' },
  },
};

// Cửa gác hiện hành chỉ thay mã ở trường CHUỖI; trường mảng mã (photoFileIds) bị báo "chưa có mẫu tham chiếu chéo".
// Tham chiếu chéo của photoFileIds đã đo riêng ở bài "ảnh của tổ chức khác" phía trên. Phiếu vướng gửi thợ giữ test/gate.ts.
const KNOWN_GATE_GAPS = [
  'POST /orgs/:orgId/design-cards: trường photoFileIds chưa có mẫu tham chiếu chéo',
  'PATCH /orgs/:orgId/design-cards/:cardId: trường photoFileIds chưa có mẫu tham chiếu chéo',
];

describe('cửa gác trên designRoutes (mẫu đề xuất)', () => {
  let fx: GateFixture;
  let gate: GateReport;
  let partial: PartialReport;

  beforeAll(async () => {
    fx = await buildGateFixture(app);
    await extendGateOrg(fx.a);
    await extendGateOrg(fx.b);
    partial = await runPartialPatchGate(app, deps.db, designRoutes, fx, DESIGN_PARTIAL_SAMPLES);
    printPartialReport(' (thẻ)', partial);
    gate = await runIsolationGate(app, designRoutes, fx, DESIGN_SAMPLES, DESIGN_REF_SAMPLES);
    printReport(' (thẻ)', gate);
  }, 180_000);

  it('cách ly: mọi phép đạt trên 10 đường thẻ (trừ chỗ cửa gác chưa đo được mảng mã)', () => {
    expect(designRoutes).toHaveLength(10);
    for (const [name, c] of Object.entries(gate)) {
      const violations = name === 'crossRef' ? c.violations.filter((v) => !KNOWN_GATE_GAPS.includes(v)) : c.violations;
      expect(violations, name).toEqual([]);
    }
    expect(gate.crossRef.violations.sort()).toEqual([...KNOWN_GATE_GAPS].sort());
    expect(gate.outsider.total).toBe(10);
    expect(gate.keep.total).toBe(10);
    expect(gate.refBase.total).toBe(7);
  });

  it('sửa một phần: 2/2 đường PATCH giữ nguyên trường không gửi', () => {
    expect(partial.partialStatic.violations).toEqual([]);
    expect(partial.partialKeep.violations).toEqual([]);
    expect(partial.covered).toBe(2);
  });
});
