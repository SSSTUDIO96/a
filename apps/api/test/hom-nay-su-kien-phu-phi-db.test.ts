// Bản vẽ D mục 1.4 — bài thử GHI THẲNG database (đi vòng qua máy chủ, sổ lỗi 24).
// Mỗi chốt (CHECK, khoá ngoại kép, chỉ mục duy nhất / có điều kiện, NOT NULL) có:
//   - ca VI PHẠM: phải bị chặn đúng mã Postgres VÀ đúng tên chốt (chốt bị bỏ thì ca này ghi được hoặc bị chốt khác chặn → đỏ);
//   - ca HỢP LỆ: phải ghi được (chốt viết quá tay chặn nhầm → đỏ).
// Có ca ghi thẳng NULL cho từng cột không được NULL, và ca trỏ sang bản ghi của tổ chức KHÁC (khoá ngoại kép).
// Dùng SQL thô (không qua mô hình Prisma của bảng mới) để bài thử không phụ thuộc lúc nào bộ đọc database được dựng lại.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgErrorCode } from '../src/http/middleware';
import { createOrg, makeApp, makeDeps, registerUser, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;

interface Org {
  id: string;
  surchargeServiceId: string; // dịch vụ loại SURCHARGE
  mainServiceId: string; // dịch vụ loại MAIN (dòng SERVICE)
  packageId: string;
  subjectId: string;
  contractId: string;
  occasionId: string; // loại sự kiện hợp lệ dựng sẵn
  ruleId: string; // luật hợp lệ dựng sẵn
}

let owner: TestUser;
let A: Org;
let B: Org;

// ---------- Ghi SQL thô + đếm ca ----------
type Outcome = { ok: true } | { ok: false; code: string | null; text: string };

const str = (s: string) => `'${s.replace(/'/g, "''")}'`;
const uuid = (s: string) => `${str(s)}::uuid`;
const kind = (k: string) => `'${k}'::"ContractLineKind"`;

function insertSql(table: string, cols: Record<string, string>): string {
  const names = Object.keys(cols).map((c) => `"${c}"`).join(', ');
  return `INSERT INTO "${table}" (${names}) VALUES (${Object.values(cols).join(', ')})`;
}

async function run(sql: string): Promise<Outcome> {
  try {
    await db.$executeRawUnsafe(sql);
    return { ok: true };
  } catch (err) {
    const meta = (err as { meta?: unknown }).meta;
    return { ok: false, code: pgErrorCode(err), text: `${String((err as Error).message)} ${JSON.stringify(meta ?? {})}` };
  }
}

const tally = { blocked: 0, blockedTotal: 0, allowed: 0, allowedTotal: 0 };

// Ca vi phạm: phải bị chặn đúng mã (và đúng chốt nếu có). Lỗi trùng khoá (23505) của Postgres qua Prisma không kèm tên
// chỉ mục, chỉ kèm "Key (cột…)=" → với chốt duy nhất truyền đúng chuỗi đó (chỉ mục bị bỏ thì lần ghi thứ hai lọt → đỏ).
function expectBlocked(label: string, out: Outcome, code: string, constraint?: string) {
  tally.blockedTotal++;
  const needle = constraint?.startsWith('Key (') ? constraint : `"${constraint}"`;
  const hit = !out.ok && out.code === code && (!constraint || out.text.includes(needle));
  if (hit) tally.blocked++;
  expect(hit, `${label}: mong bị chặn ${code}${constraint ? ` bởi ${constraint}` : ''}, nhận ${out.ok ? 'GHI ĐƯỢC' : `${out.code} ${out.text.slice(0, 300)}`}`).toBe(true);
}

// Ca hợp lệ: phải ghi được.
function expectAllowed(label: string, out: Outcome) {
  tally.allowedTotal++;
  if (out.ok) tally.allowed++;
  expect(out.ok, `${label}: mong ghi được, nhận ${out.ok ? '' : `${out.code} ${out.text.slice(0, 300)}`}`).toBe(true);
}

// ---------- Dựng bản ghi ----------
async function insertOccasion(org: Org | { id: string }, over: Record<string, string> = {}) {
  const id = randomUUID();
  const out = await run(
    insertSql('occasions', {
      id: uuid(id),
      organization_id: uuid(org.id),
      name: str(`Sự kiện ${id.slice(0, 8)}`),
      color: `'rose'`,
      sort_order: '0',
      is_active: 'true',
      updated_at: 'now()',
      ...over,
    }),
  );
  return { id, out };
}

async function insertRule(org: Org, over: Record<string, string> = {}) {
  const id = randomUUID();
  const out = await run(
    insertSql('surcharge_rules', {
      id: uuid(id),
      organization_id: uuid(org.id),
      name: str(`Luật ${id.slice(0, 8)}`),
      service_id: uuid(org.surchargeServiceId),
      start_minute: 'NULL',
      end_minute: 'NULL',
      weekdays: 'DEFAULT',
      per_quantity: 'DEFAULT',
      note: 'NULL',
      sort_order: '0',
      is_active: 'true',
      created_by_id: uuid(owner.id),
      updated_at: 'now()',
      ...over,
    }),
  );
  return { id, out };
}

async function insertTarget(org: Org, ruleId: string, over: Record<string, string> = {}) {
  const id = randomUUID();
  const out = await run(
    insertSql('surcharge_rule_targets', {
      id: uuid(id),
      organization_id: uuid(org.id),
      rule_id: uuid(ruleId),
      occasion_id: 'NULL',
      package_id: 'NULL',
      subject_id: 'NULL',
      ...over,
    }),
  );
  return { id, out };
}

async function insertDate(org: Org, ruleId: string, day: string, over: Record<string, string> = {}) {
  return run(insertSql('surcharge_rule_dates', { organization_id: uuid(org.id), rule_id: uuid(ruleId), day: `'${day}'::date`, ...over }));
}

// Dòng hợp đồng giá 0 (tổng hợp đồng = 0 luôn khớp trigger contract_totals_consistent).
async function insertLine(org: Org, over: Record<string, string>, contractId = org.contractId) {
  const id = randomUUID();
  const out = await run(
    insertSql('contract_lines', {
      id: uuid(id),
      organization_id: uuid(org.id),
      contract_id: uuid(contractId),
      name: `'Dòng thử'`,
      unit_price: '0',
      line_total: '0',
      created_by_id: uuid(owner.id),
      ...over,
    }),
  );
  return { id, out };
}
const packageLine = (org: Org, over: Record<string, string> = {}, contractId?: string) =>
  insertLine(org, { kind: kind('PACKAGE'), package_id: uuid(org.packageId), ...over }, contractId);
const serviceLine = (org: Org, over: Record<string, string> = {}) =>
  insertLine(org, { kind: kind('SERVICE'), service_id: uuid(org.mainServiceId), ...over });
const surchargeLine = (org: Org, parentId: string | null, over: Record<string, string> = {}) =>
  insertLine(org, {
    kind: kind('SURCHARGE'),
    service_id: uuid(org.surchargeServiceId),
    parent_line_id: parentId ? uuid(parentId) : 'NULL',
    ...over,
  });

async function mustOk<T extends { out: Outcome }>(label: string, p: Promise<T>): Promise<T> {
  const r = await p;
  if (!r.out.ok) throw new Error(`Dựng dữ liệu "${label}" thất bại: ${r.out.code} ${r.out.text}`);
  return r;
}

async function buildOrg(app: ReturnType<typeof makeApp>, label: string): Promise<Org> {
  const orgId = await createOrg(app, owner, label);
  const tag = randomUUID().slice(0, 6);
  const sur = await db.service.create({ data: { organizationId: orgId, kind: 'SURCHARGE', code: `PP-${tag}`, name: `Phụ phí ${tag}`, durationMinutes: null } });
  const main = await db.service.create({ data: { organizationId: orgId, kind: 'MAIN', code: `DV-${tag}`, name: `Dịch vụ ${tag}`, durationMinutes: 60 } });
  const pkg = await db.servicePackage.create({ data: { organizationId: orgId, code: `GOI-${tag}`, name: `Gói ${tag}`, durationMinutes: 60 } });
  const subject = await db.makeupSubject.create({ data: { organizationId: orgId, name: `Nhân vật ${tag}` } });
  const customer = await db.customer.create({ data: { organizationId: orgId, fullName: `Khách ${tag}` } });
  const contract = await db.contract.create({ data: { organizationId: orgId, code: `HD-D-${tag}`, customerId: customer.id, createdById: owner.id } });
  const org: Org = {
    id: orgId,
    surchargeServiceId: sur.id,
    mainServiceId: main.id,
    packageId: pkg.id,
    subjectId: subject.id,
    contractId: contract.id,
    occasionId: '',
    ruleId: '',
  };
  org.occasionId = (await mustOk('loại sự kiện', insertOccasion(org))).id;
  org.ruleId = (await mustOk('luật', insertRule(org))).id;
  return org;
}

beforeAll(async () => {
  const app = makeApp(deps);
  owner = await registerUser(app, 'd-m1');
  A = await buildOrg(app, 'd-m1-a');
  B = await buildOrg(app, 'd-m1-b');
});

afterAll(async () => {
  console.log(
    `[bản vẽ D — database] ca vi phạm bị chặn ${tally.blocked}/${tally.blockedTotal}; ca hợp lệ ghi được ${tally.allowed}/${tally.allowedTotal}`,
  );
  await db.$disconnect();
});

// ======================================================================================================
describe('occasions — loại sự kiện', () => {
  it('occasions_name: rỗng / thừa khoảng trắng / quá 60 ký tự bị chặn; 1 và 60 ký tự (có dấu) ghi được', async () => {
    expectBlocked('tên rỗng', (await insertOccasion(A, { name: `''` })).out, '23514', 'occasions_name');
    expectBlocked('tên thừa khoảng trắng', (await insertOccasion(A, { name: `' Tiệc '` })).out, '23514', 'occasions_name');
    expectBlocked('tên 61 ký tự', (await insertOccasion(A, { name: str('ễ'.repeat(61)) })).out, '23514', 'occasions_name');
    expectAllowed('tên 60 ký tự có dấu', (await insertOccasion(A, { name: str('ễ'.repeat(60)) })).out);
    expectAllowed('tên 1 ký tự', (await insertOccasion(A, { name: `'X'` })).out);
  });

  it('occasions_color: ngoài 12 màu Lịch bị chặn; đủ 12 màu ghi được', async () => {
    expectBlocked('màu red', (await insertOccasion(A, { color: `'red'` })).out, '23514', 'occasions_color');
    expectBlocked('màu viết hoa', (await insertOccasion(A, { color: `'Rose'` })).out, '23514', 'occasions_color');
    expectBlocked('màu rỗng', (await insertOccasion(A, { color: `''` })).out, '23514', 'occasions_color');
    for (const c of ['rose', 'violet', 'amber', 'green', 'blue', 'taupe', 'brick', 'petrol', 'olive', 'plum', 'forest', 'brown']) {
      expectAllowed(`màu ${c}`, (await insertOccasion(A, { color: str(c) })).out);
    }
  });

  it('occasions_sort_order: âm bị chặn; 0 ghi được', async () => {
    expectBlocked('thứ tự -1', (await insertOccasion(A, { sort_order: '-1' })).out, '23514', 'occasions_sort_order');
    expectAllowed('thứ tự 0', (await insertOccasion(A, { sort_order: '0' })).out);
  });

  it('NOT NULL: ghi thẳng NULL vào từng cột bắt buộc bị chặn', async () => {
    for (const col of ['organization_id', 'name', 'color', 'sort_order', 'is_active', 'updated_at']) {
      expectBlocked(`occasions.${col} NULL`, (await insertOccasion(A, { [col]: 'NULL' })).out, '23502');
    }
  });

  it('tên trùng trong CÙNG tổ chức bị chặn; cùng tên ở tổ chức khác ghi được; tổ chức không có thật bị chặn', async () => {
    const name = str(`Lễ cưới ${randomUUID().slice(0, 6)}`);
    expectAllowed('tên mới ở A', (await insertOccasion(A, { name })).out);
    expectBlocked('trùng tên ở A', (await insertOccasion(A, { name })).out, '23505', 'Key (organization_id, name)=');
    expectAllowed('cùng tên ở B', (await insertOccasion(B, { name })).out);
    expectBlocked('tổ chức không có thật', (await insertOccasion({ id: randomUUID() })).out, '23503', 'occasions_organization_id_fkey');
  });
});

// ======================================================================================================
describe('surcharge_rules — luật phụ phí', () => {
  it('surcharge_rules_name: rỗng / thừa khoảng trắng / quá 120 ký tự bị chặn; 120 ký tự ghi được', async () => {
    expectBlocked('tên rỗng', (await insertRule(A, { name: `''` })).out, '23514', 'surcharge_rules_name');
    expectBlocked('tên thừa khoảng trắng', (await insertRule(A, { name: `'Đêm '` })).out, '23514', 'surcharge_rules_name');
    expectBlocked('tên 121 ký tự', (await insertRule(A, { name: str('đ'.repeat(121)) })).out, '23514', 'surcharge_rules_name');
    expectAllowed('tên 120 ký tự', (await insertRule(A, { name: str('đ'.repeat(120)) })).out);
  });

  it('surcharge_rules_window: thiếu một đầu (ghi thẳng NULL) / ngoài khoảng / bằng nhau bị chặn; không giờ, cả ngày, qua nửa đêm ghi được', async () => {
    const bad: Array<[string, string, string]> = [
      ['có đầu, thiếu cuối (NULL)', '60', 'NULL'],
      ['thiếu đầu (NULL), có cuối', 'NULL', '60'],
      ['đầu âm', '-1', '60'],
      ['đầu 1440', '1440', '60'],
      ['cuối 0', '60', '0'],
      ['cuối 1441', '60', '1441'],
      ['đầu = cuối', '600', '600'],
    ];
    for (const [label, s, e] of bad) {
      expectBlocked(label, (await insertRule(A, { start_minute: s, end_minute: e })).out, '23514', 'surcharge_rules_window');
    }
    const good: Array<[string, string, string]> = [
      ['không xét giờ', 'NULL', 'NULL'],
      ['0 → 1440', '0', '1440'],
      ['22:00 → 04:00 (qua nửa đêm)', '1320', '240'],
      ['1439 → 1', '1439', '1'],
    ];
    for (const [label, s, e] of good) expectAllowed(label, (await insertRule(A, { start_minute: s, end_minute: e })).out);
  });

  it('surcharge_rules_weekdays: ngoài 1..7 / có phần tử NULL / quá 7 phần tử bị chặn; rỗng, đủ 7, cuối tuần ghi được', async () => {
    const bad: Array<[string, string]> = [
      ['thứ 0', 'ARRAY[0]::int[]'],
      ['thứ 8', 'ARRAY[8]::int[]'],
      ['phần tử NULL', 'ARRAY[1,NULL]::int[]'],
      ['chỉ một phần tử NULL', 'ARRAY[NULL]::int[]'],
      ['8 phần tử', 'ARRAY[1,2,3,4,5,6,7,1]::int[]'],
    ];
    for (const [label, w] of bad) expectBlocked(label, (await insertRule(A, { weekdays: w })).out, '23514', 'surcharge_rules_weekdays');
    for (const [label, w] of [
      ['rỗng', `'{}'::int[]`],
      ['đủ 7', 'ARRAY[1,2,3,4,5,6,7]'],
      ['thứ Bảy, Chủ nhật', 'ARRAY[6,7]'],
    ] as Array<[string, string]>) {
      expectAllowed(label, (await insertRule(A, { weekdays: w })).out);
    }
  });

  it('surcharge_rules_note: quá 500 ký tự bị chặn; NULL và 500 ký tự ghi được', async () => {
    expectBlocked('ghi chú 501', (await insertRule(A, { note: str('ư'.repeat(501)) })).out, '23514', 'surcharge_rules_note');
    expectAllowed('ghi chú 500', (await insertRule(A, { note: str('ư'.repeat(500)) })).out);
    expectAllowed('ghi chú NULL', (await insertRule(A, { note: 'NULL' })).out);
  });

  it('surcharge_rules_sort_order: âm bị chặn; 3 ghi được', async () => {
    expectBlocked('thứ tự -1', (await insertRule(A, { sort_order: '-1' })).out, '23514', 'surcharge_rules_sort_order');
    expectAllowed('thứ tự 3', (await insertRule(A, { sort_order: '3' })).out);
  });

  it('NOT NULL: ghi thẳng NULL vào từng cột bắt buộc bị chặn (kể cả mảng weekdays)', async () => {
    for (const col of ['organization_id', 'name', 'service_id', 'weekdays', 'per_quantity', 'sort_order', 'is_active', 'created_by_id', 'updated_at']) {
      expectBlocked(`surcharge_rules.${col} NULL`, (await insertRule(A, { [col]: 'NULL' })).out, '23502');
    }
  });

  it('khoá ngoại kép: dịch vụ của tổ chức KHÁC bị chặn; người tạo / tổ chức không có thật bị chặn; dịch vụ của chính mình ghi được', async () => {
    expectBlocked('dịch vụ của B', (await insertRule(A, { service_id: uuid(B.surchargeServiceId) })).out, '23503', 'surcharge_rules_service_id_organization_id_fkey');
    expectBlocked('người tạo không có thật', (await insertRule(A, { created_by_id: uuid(randomUUID()) })).out, '23503', 'surcharge_rules_created_by_id_fkey');
    expectBlocked(
      'tổ chức không có thật',
      (await insertRule({ ...A, id: randomUUID() })).out,
      '23503',
    );
    expectAllowed('dịch vụ của A', (await insertRule(A, { service_id: uuid(A.surchargeServiceId) })).out);
  });

  it('tên trùng trong cùng tổ chức bị chặn; cùng tên ở tổ chức khác ghi được', async () => {
    const name = str(`Phụ phí đêm ${randomUUID().slice(0, 6)}`);
    expectAllowed('tên mới ở A', (await insertRule(A, { name })).out);
    expectBlocked('trùng tên ở A', (await insertRule(A, { name })).out, '23505', 'Key (organization_id, name)=');
    expectAllowed('cùng tên ở B', (await insertRule(B, { name })).out);
  });
});

// ======================================================================================================
describe('surcharge_rule_targets — điều kiện "thuộc tập" của luật', () => {
  it('surcharge_rule_targets_one: không mã nào / hai mã / ba mã bị chặn; đúng một mã (mỗi loại) ghi được', async () => {
    const { id: ruleId } = await mustOk('luật', insertRule(A));
    const occ = uuid(A.occasionId);
    const pkg = uuid(A.packageId);
    const sub = uuid(A.subjectId);
    expectBlocked('không mã nào', (await insertTarget(A, ruleId)).out, '23514', 'surcharge_rule_targets_one');
    expectBlocked('sự kiện + gói', (await insertTarget(A, ruleId, { occasion_id: occ, package_id: pkg })).out, '23514', 'surcharge_rule_targets_one');
    expectBlocked('gói + nhân vật', (await insertTarget(A, ruleId, { package_id: pkg, subject_id: sub })).out, '23514', 'surcharge_rule_targets_one');
    expectBlocked('cả ba', (await insertTarget(A, ruleId, { occasion_id: occ, package_id: pkg, subject_id: sub })).out, '23514', 'surcharge_rule_targets_one');
    expectAllowed('chỉ sự kiện', (await insertTarget(A, ruleId, { occasion_id: occ })).out);
    expectAllowed('chỉ gói', (await insertTarget(A, ruleId, { package_id: pkg })).out);
    expectAllowed('chỉ nhân vật', (await insertTarget(A, ruleId, { subject_id: sub })).out);
  });

  it('khoá ngoại kép: luật / sự kiện / gói / nhân vật của tổ chức KHÁC bị chặn', async () => {
    const { id: ruleId } = await mustOk('luật', insertRule(A));
    expectBlocked('luật của B', (await insertTarget(A, B.ruleId, { occasion_id: uuid(A.occasionId) })).out, '23503', 'surcharge_rule_targets_rule_id_organization_id_fkey');
    expectBlocked('sự kiện của B', (await insertTarget(A, ruleId, { occasion_id: uuid(B.occasionId) })).out, '23503', 'surcharge_rule_targets_occasion_id_organization_id_fkey');
    expectBlocked('gói của B', (await insertTarget(A, ruleId, { package_id: uuid(B.packageId) })).out, '23503', 'surcharge_rule_targets_package_id_organization_id_fkey');
    expectBlocked('nhân vật của B', (await insertTarget(A, ruleId, { subject_id: uuid(B.subjectId) })).out, '23503', 'surcharge_rule_targets_subject_id_organization_id_fkey');
    expectBlocked('tổ chức không có thật', (await insertTarget({ ...A, id: randomUUID() }, ruleId, { occasion_id: uuid(A.occasionId) })).out, '23503');
  });

  it('một mã chỉ một lần mỗi luật (3 khoá duy nhất); luật khác thì ghi được', async () => {
    const { id: r1 } = await mustOk('luật 1', insertRule(A));
    const { id: r2 } = await mustOk('luật 2', insertRule(A));
    const cases: Array<[string, string, string]> = [
      ['occasion_id', A.occasionId, 'Key (rule_id, occasion_id)='],
      ['package_id', A.packageId, 'Key (rule_id, package_id)='],
      ['subject_id', A.subjectId, 'Key (rule_id, subject_id)='],
    ];
    for (const [col, ref, key] of cases) {
      expectAllowed(`${col} lần 1`, (await insertTarget(A, r1, { [col]: uuid(ref) })).out);
      expectBlocked(`${col} lần 2 cùng luật`, (await insertTarget(A, r1, { [col]: uuid(ref) })).out, '23505', key);
      expectAllowed(`${col} ở luật khác`, (await insertTarget(A, r2, { [col]: uuid(ref) })).out);
    }
  });

  it('NOT NULL: tổ chức / luật NULL bị chặn', async () => {
    const { id: ruleId } = await mustOk('luật', insertRule(A));
    for (const col of ['organization_id', 'rule_id']) {
      expectBlocked(`surcharge_rule_targets.${col} NULL`, (await insertTarget(A, ruleId, { occasion_id: uuid(A.occasionId), [col]: 'NULL' })).out, '23502');
    }
  });
});

// ======================================================================================================
describe('surcharge_rule_dates — ngày cụ thể của luật', () => {
  it('luật của tổ chức KHÁC bị chặn; ngày trùng cùng luật bị chặn; NULL bị chặn; ngày khác / luật khác ghi được', async () => {
    const { id: r1 } = await mustOk('luật 1', insertRule(A));
    const { id: r2 } = await mustOk('luật 2', insertRule(A));
    expectBlocked('luật của B', await insertDate(A, B.ruleId, '2027-02-14'), '23503', 'surcharge_rule_dates_rule_id_organization_id_fkey');
    expectBlocked('tổ chức không có thật', await insertDate({ ...A, id: randomUUID() }, r1, '2027-02-14'), '23503');
    expectAllowed('14/02 ở luật 1', await insertDate(A, r1, '2027-02-14'));
    expectBlocked('14/02 lần 2 ở luật 1', await insertDate(A, r1, '2027-02-14'), '23505', 'Key (rule_id, day)=');
    expectAllowed('14/02 ở luật 2', await insertDate(A, r2, '2027-02-14'));
    expectAllowed('01/01 ở luật 1', await insertDate(A, r1, '2027-01-01'));
    for (const col of ['organization_id', 'rule_id', 'day']) {
      expectBlocked(`surcharge_rule_dates.${col} NULL`, await insertDate(A, r1, '2027-03-08', { [col]: 'NULL' }), '23502');
    }
  });

  it('xoá luật chưa dùng: điều kiện và ngày của luật tự xoá theo (ON DELETE CASCADE); xoá sự kiện còn được luật dùng bị chặn', async () => {
    const { id: occ } = await mustOk('sự kiện', insertOccasion(A));
    const { id: ruleId } = await mustOk('luật', insertRule(A));
    await mustOk('điều kiện', insertTarget(A, ruleId, { occasion_id: uuid(occ) }));
    expectAllowed('ngày', await insertDate(A, ruleId, '2027-04-30'));
    expectBlocked('xoá sự kiện còn được luật dùng', await run(`DELETE FROM occasions WHERE id = ${uuid(occ)}`), '23503', 'surcharge_rule_targets_occasion_id_organization_id_fkey');
    expectAllowed('xoá luật chưa dùng', await run(`DELETE FROM surcharge_rules WHERE id = ${uuid(ruleId)}`));
    const left = await db.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT (SELECT count(*) FROM surcharge_rule_targets WHERE rule_id = ${uuid(ruleId)})
            + (SELECT count(*) FROM surcharge_rule_dates WHERE rule_id = ${uuid(ruleId)}) AS n`,
    );
    expect(Number(left[0]!.n)).toBe(0);
  });
});

// ======================================================================================================
describe('contract_lines — 5 cột mới', () => {
  it('contract_lines_occasion: có mã thiếu tên / có tên thiếu mã (ghi thẳng NULL) / dòng không phải đặt chỗ bị chặn; PACKAGE và SERVICE ghi được', async () => {
    const occ = uuid(A.occasionId);
    expectBlocked('có mã, tên NULL', (await packageLine(A, { occasion_id: occ, occasion_name: 'NULL' })).out, '23514', 'contract_lines_occasion');
    expectBlocked('mã NULL, có tên', (await packageLine(A, { occasion_id: 'NULL', occasion_name: `'Lễ cưới'` })).out, '23514', 'contract_lines_occasion');
    const { id: parent } = await mustOk('dòng gói', packageLine(A));
    expectBlocked('dòng SURCHARGE có sự kiện', (await surchargeLine(A, parent, { occasion_id: occ, occasion_name: `'Lễ cưới'` })).out, '23514', 'contract_lines_occasion');
    expectBlocked('dòng CUSTOM có sự kiện', (await insertLine(A, { kind: kind('CUSTOM'), occasion_id: occ, occasion_name: `'Lễ cưới'` })).out, '23514', 'contract_lines_occasion');
    expectAllowed('dòng PACKAGE có sự kiện', (await packageLine(A, { occasion_id: occ, occasion_name: `'Lễ cưới'` })).out);
    expectAllowed('dòng SERVICE có sự kiện', (await serviceLine(A, { occasion_id: occ, occasion_name: `'Ăn hỏi'` })).out);
    expectAllowed('dòng PACKAGE chưa chọn sự kiện', (await packageLine(A, { occasion_id: 'NULL', occasion_name: 'NULL' })).out);
  });

  it('khoá ngoại kép: sự kiện / luật của tổ chức KHÁC bị chặn', async () => {
    expectBlocked(
      'sự kiện của B',
      (await packageLine(A, { occasion_id: uuid(B.occasionId), occasion_name: `'Lễ cưới'` })).out,
      '23503',
      'contract_lines_occasion_id_organization_id_fkey',
    );
    const { id: parent } = await mustOk('dòng gói', packageLine(A));
    expectBlocked(
      'luật của B',
      (await surchargeLine(A, parent, { surcharge_rule_id: uuid(B.ruleId), surcharge_rule_name: `'Luật B'` })).out,
      '23503',
      'contract_lines_surcharge_rule_id_organization_id_fkey',
    );
  });

  it('contract_lines_auto_surcharge: thiếu tên / thiếu mã / không phải SURCHARGE / không phải dòng con bị chặn; dòng con SURCHARGE ghi được', async () => {
    const { id: parent } = await mustOk('dòng gói', packageLine(A));
    const { id: ruleId } = await mustOk('luật', insertRule(A));
    const rule = uuid(ruleId);
    expectBlocked('có mã luật, tên NULL', (await surchargeLine(A, parent, { surcharge_rule_id: rule, surcharge_rule_name: 'NULL' })).out, '23514', 'contract_lines_auto_surcharge');
    expectBlocked('mã luật NULL, có tên', (await surchargeLine(A, parent, { surcharge_rule_id: 'NULL', surcharge_rule_name: `'Đêm'` })).out, '23514', 'contract_lines_auto_surcharge');
    expectBlocked('dòng PACKAGE mang luật', (await packageLine(A, { surcharge_rule_id: rule, surcharge_rule_name: `'Đêm'` })).out, '23514', 'contract_lines_auto_surcharge');
    expectBlocked('SURCHARGE không có dòng cha (NULL)', (await surchargeLine(A, null, { surcharge_rule_id: rule, surcharge_rule_name: `'Đêm'` })).out, '23514', 'contract_lines_auto_surcharge');
    expectAllowed('dòng con SURCHARGE theo luật', (await surchargeLine(A, parent, { surcharge_rule_id: rule, surcharge_rule_name: `'Đêm'` })).out);
    expectAllowed('dòng SURCHARGE nhập tay (không luật)', (await surchargeLine(A, parent)).out);
  });

  it('contract_lines_dismissed_rules: quá 50 / phần tử NULL / ở dòng không phải đặt chỗ bị chặn; NULL cả mảng bị chặn; 0 và 50 mã ghi được', async () => {
    const ids = (n: number) => `ARRAY[${Array.from({ length: n }, () => str(randomUUID())).join(',')}]::uuid[]`;
    expectBlocked('51 mã', (await packageLine(A, { dismissed_surcharge_rule_ids: ids(51) })).out, '23514', 'contract_lines_dismissed_rules');
    expectBlocked('có phần tử NULL', (await packageLine(A, { dismissed_surcharge_rule_ids: `ARRAY[${str(randomUUID())}, NULL]::uuid[]` })).out, '23514', 'contract_lines_dismissed_rules');
    const { id: parent } = await mustOk('dòng gói', packageLine(A));
    expectBlocked('dòng SURCHARGE có luật đã bỏ', (await surchargeLine(A, parent, { dismissed_surcharge_rule_ids: ids(1) })).out, '23514', 'contract_lines_dismissed_rules');
    expectBlocked('dòng CUSTOM có luật đã bỏ', (await insertLine(A, { kind: kind('CUSTOM'), dismissed_surcharge_rule_ids: ids(1) })).out, '23514', 'contract_lines_dismissed_rules');
    expectBlocked('cả mảng NULL', (await packageLine(A, { dismissed_surcharge_rule_ids: 'NULL' })).out, '23502');
    expectAllowed('50 mã ở dòng PACKAGE', (await packageLine(A, { dismissed_surcharge_rule_ids: ids(50) })).out);
    expectAllowed('1 mã ở dòng SERVICE', (await serviceLine(A, { dismissed_surcharge_rule_ids: ids(1) })).out);
    expectAllowed('mảng rỗng ở dòng SURCHARGE', (await surchargeLine(A, parent, { dismissed_surcharge_rule_ids: `'{}'::uuid[]` })).out);
    // Bỏ trống cột → mặc định {} (dòng cũ / dòng nhập tay).
    const { id: plain } = await mustOk('dòng mặc định', packageLine(A));
    const row = await db.$queryRawUnsafe<Array<{ n: number }>>(`SELECT cardinality(dismissed_surcharge_rule_ids) AS n FROM contract_lines WHERE id = ${uuid(plain)}`);
    expect(Number(row[0]!.n)).toBe(0);
  });

  it('contract_lines_one_auto_per_rule: hai dòng tự thêm chưa huỷ cùng (dòng cha, luật) bị chặn; huỷ dòng cũ / dòng cha khác / dòng nhập tay ghi được', async () => {
    const { id: p1 } = await mustOk('dòng gói 1', packageLine(A));
    const { id: p2 } = await mustOk('dòng gói 2', packageLine(A));
    const { id: ruleId } = await mustOk('luật', insertRule(A));
    const auto = { surcharge_rule_id: uuid(ruleId), surcharge_rule_name: `'Đêm'` };
    const first = await surchargeLine(A, p1, auto);
    expectAllowed('dòng tự thêm 1', first.out);
    expectBlocked('dòng tự thêm 2 cùng cha, cùng luật', (await surchargeLine(A, p1, auto)).out, '23505', 'Key (parent_line_id, surcharge_rule_id)=');
    expectAllowed('cùng luật, dòng cha khác', (await surchargeLine(A, p2, auto)).out);
    expectAllowed('nhập tay 1 dưới cùng cha', (await surchargeLine(A, p1)).out);
    expectAllowed('nhập tay 2 dưới cùng cha', (await surchargeLine(A, p1)).out);
    expectAllowed('huỷ dòng tự thêm 1', await run(`UPDATE contract_lines SET voided_at = now(), void_reason = 'bỏ' WHERE id = ${uuid(first.id)}`));
    expectAllowed('dòng tự thêm mới sau khi huỷ dòng cũ', (await surchargeLine(A, p1, auto)).out);
  });

  it('xoá sự kiện / luật đang được dòng hợp đồng dùng bị chặn (ON DELETE RESTRICT)', async () => {
    const { id: occ } = await mustOk('sự kiện', insertOccasion(A));
    await mustOk('dòng có sự kiện', packageLine(A, { occasion_id: uuid(occ), occasion_name: `'Tiệc'` }));
    expectBlocked('xoá sự kiện đang dùng', await run(`DELETE FROM occasions WHERE id = ${uuid(occ)}`), '23503', 'contract_lines_occasion_id_organization_id_fkey');
    const { id: parent } = await mustOk('dòng gói', packageLine(A));
    const { id: ruleId } = await mustOk('luật', insertRule(A));
    await mustOk('dòng tự thêm', surchargeLine(A, parent, { surcharge_rule_id: uuid(ruleId), surcharge_rule_name: `'Đêm'` }));
    expectBlocked('xoá luật đang dùng', await run(`DELETE FROM surcharge_rules WHERE id = ${uuid(ruleId)}`), '23503', 'contract_lines_surcharge_rule_id_organization_id_fkey');
  });

  it('hợp đồng đã xác nhận: 5 cột mới nằm trong diện khoá dòng (trigger cũ, không sửa)', async () => {
    const customer = await db.customer.create({ data: { organizationId: A.id, fullName: 'Khách khoá dòng' } });
    const c = await db.contract.create({ data: { organizationId: A.id, code: `HD-DK-${randomUUID().slice(0, 6)}`, customerId: customer.id, createdById: owner.id } });
    const { id: line } = await mustOk('dòng có sự kiện', packageLine(A, { occasion_id: uuid(A.occasionId), occasion_name: `'Lễ cưới'` }, c.id));
    await db.contract.update({ where: { id: c.id }, data: { status: 'CONFIRMED' } });
    for (const [label, set] of [
      ['đổi tên sự kiện', `occasion_name = 'Khác'`],
      ['bỏ sự kiện', 'occasion_id = NULL, occasion_name = NULL'],
      ['thêm luật đã bỏ', `dismissed_surcharge_rule_ids = ARRAY[${str(randomUUID())}]::uuid[]`],
    ] as Array<[string, string]>) {
      const out = await run(`UPDATE contract_lines SET ${set} WHERE id = ${uuid(line)}`);
      expectBlocked(label, out, 'P0001');
      expect(out.ok ? '' : out.text).toMatch(/không được sửa/);
    }
  });
});

// ======================================================================================================
describe('chỉ mục', () => {
  it('đủ chỉ mục của bản vẽ D, chỉ mục có điều kiện đúng điều kiện', async () => {
    const want: Record<string, RegExp> = {
      contract_lines_one_auto_per_rule:
        /^CREATE UNIQUE INDEX contract_lines_one_auto_per_rule ON public\.contract_lines USING btree \(parent_line_id, surcharge_rule_id\) WHERE \(\(surcharge_rule_id IS NOT NULL\) AND \(voided_at IS NULL\)\)$/,
      contract_lines_occasion_id_idx: /\(occasion_id\)$/,
      contract_lines_surcharge_rule_id_idx: /\(surcharge_rule_id\)$/,
      surcharge_rules_organization_id_is_active_sort_order_idx: /\(organization_id, is_active, sort_order\)$/,
      payment_installments_organization_id_due_date_idx: /ON public\.payment_installments USING btree \(organization_id, due_date\)$/,
      contracts_organization_id_confirmed_at_idx: /ON public\.contracts USING btree \(organization_id, confirmed_at\)$/,
      enrollments_organization_id_enrolled_at_idx: /ON public\.enrollments USING btree \(organization_id, enrolled_at\)$/,
    };
    const rows = await db.$queryRawUnsafe<Array<{ indexname: string; indexdef: string }>>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      Object.keys(want),
    );
    const byName = new Map(rows.map((r) => [r.indexname, r.indexdef]));
    const ok = Object.entries(want).filter(([n, re]) => re.test(byName.get(n) ?? ''));
    const missing = Object.keys(want).filter((n) => !ok.some(([m]) => m === n));
    console.log(`[bản vẽ D — chỉ mục] đúng ${ok.length}/${Object.keys(want).length}${missing.length ? `; THIẾU/SAI: ${missing.join(', ')}` : ''}`);
    expect(missing).toEqual([]);
  });
});
