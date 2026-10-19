// Bản vẽ E mục 6.1 — bài thử GHI THẲNG database cho cổng học viên (đi vòng qua máy chủ, sổ lỗi 24).
// Mỗi chốt (CHECK, khoá ngoại kép theo tổ chức / theo học viên, chỉ mục duy nhất / có điều kiện, NOT NULL, trigger) có:
//   - ca VI PHẠM: phải bị chặn đúng mã Postgres VÀ đúng tên chốt (hoặc đúng lời của trigger). Chốt bị bỏ thì ca này ghi
//     được hoặc bị chốt khác chặn → đỏ;
//   - ca HỢP LỆ: phải ghi được (chốt viết quá tay chặn nhầm → đỏ).
// Có ca ghi thẳng NULL cho từng cột không được NULL, ca trỏ sang bản ghi của tổ chức KHÁC và của học viên KHÁC cùng tổ chức,
// và một ca đua: 5 lần thêm máy đồng thời cho cùng một đường dẫn → đúng 2 lần thành công.
// Dùng SQL thô (không qua mô hình Prisma của bảng mới) để bài thử không phụ thuộc lúc nào bộ đọc database được dựng lại.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgErrorCode } from '../src/http/middleware';
import { createOrg, makeApp, makeDeps, registerUser, type TestUser } from './helpers';

const deps = makeDeps();
const db = deps.db;

interface Org {
  id: string;
  c1: string; // học viên 1
  c2: string; // học viên 2 (cùng tổ chức)
  link1: string; // đường dẫn sống của c1
  link2: string; // đường dẫn sống của c2
  dev1: string; // máy sống của c1 (qua link1)
  dev2: string; // máy sống của c2 (qua link2)
}

let owner: TestUser;
let A: Org;
let B: Org;

// ---------- Ghi SQL thô + đếm ca ----------
type Outcome = { ok: true } | { ok: false; code: string | null; text: string };

const str = (s: string) => `'${s.replace(/'/g, "''")}'`;
const uuid = (s: string) => `${str(s)}::uuid`;
const sha = () => createHash('sha256').update(randomBytes(32)).digest('hex');
const hex = () => str(sha());
// Chìa dạng base64url 43 ký tự (đúng dạng chìa bản rõ) — database phải từ chối lưu.
const base64urlKey = () => str(randomBytes(32).toString('base64url'));

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

// Ca vi phạm: phải bị chặn đúng mã và đúng chốt.
//   - 'Key (…)=' : chốt duy nhất (Postgres qua Prisma không kèm tên chỉ mục, chỉ kèm cột);
//   - 'msg:…'    : lời của RAISE EXCEPTION trong trigger;
//   - còn lại    : tên chốt CHECK / khoá ngoại.
function expectBlocked(label: string, out: Outcome, code: string, constraint?: string) {
  tally.blockedTotal++;
  const needle = !constraint
    ? ''
    : constraint.startsWith('Key (')
      ? constraint
      : constraint.startsWith('msg:')
        ? constraint.slice(4)
        : `"${constraint}"`;
  const hit = !out.ok && out.code === code && out.text.includes(needle);
  if (hit) tally.blocked++;
  expect(hit, `${label}: mong bị chặn ${code}${constraint ? ` bởi ${constraint}` : ''}, nhận ${out.ok ? 'GHI ĐƯỢC' : `${out.code} ${out.text.slice(0, 300)}`}`).toBe(true);
}

function expectAllowed(label: string, out: Outcome) {
  tally.allowedTotal++;
  if (out.ok) tally.allowed++;
  expect(out.ok, `${label}: mong ghi được, nhận ${out.ok ? '' : `${out.code} ${out.text.slice(0, 300)}`}`).toBe(true);
}

// ---------- Dựng bản ghi ----------
async function insertLink(org: { id: string }, customerId: string, over: Record<string, string> = {}) {
  const id = randomUUID();
  const out = await run(
    insertSql('portal_links', {
      id: uuid(id),
      organization_id: uuid(org.id),
      customer_id: uuid(customerId),
      key_hash: hex(),
      created_by_id: uuid(owner.id),
      expires_at: `now() + interval '7 days'`,
      revoked_at: 'NULL',
      revoke_reason: 'NULL',
      ...over,
    }),
  );
  return { id, out };
}
// Đường dẫn đã thu hồi (không chiếm chỗ "một đường dẫn sống mỗi học viên").
const revoked = { revoked_at: 'now()', revoke_reason: `'REPLACED'` };

async function insertDevice(org: { id: string }, customerId: string, linkId: string, over: Record<string, string> = {}) {
  const id = randomUUID();
  const out = await run(
    insertSql('portal_devices', {
      id: uuid(id),
      organization_id: uuid(org.id),
      customer_id: uuid(customerId),
      link_id: uuid(linkId),
      label: `'iPhone · Safari'`,
      ...over,
    }),
  );
  return { id, out };
}

async function insertSession(org: { id: string }, customerId: string, deviceId: string, over: Record<string, string> = {}) {
  const id = randomUUID();
  const out = await run(
    insertSql('portal_sessions', {
      id: uuid(id),
      organization_id: uuid(org.id),
      customer_id: uuid(customerId),
      device_id: uuid(deviceId),
      token_hash: hex(),
      expires_at: `now() + interval '90 days'`,
      ...over,
    }),
  );
  return { id, out };
}

async function insertSettings(orgId: string, over: Record<string, string> = {}) {
  return run(
    insertSql('portal_settings', {
      organization_id: uuid(orgId),
      bank_name: `'Vietcombank'`,
      bank_account_no: `'0123456789'`,
      bank_account_name: `'NGUYEN VAN A'`,
      updated_by_id: uuid(owner.id),
      updated_at: 'now()',
      ...over,
    }),
  );
}

async function mustOk<T extends { out: Outcome }>(label: string, p: Promise<T>): Promise<T> {
  const r = await p;
  if (!r.out.ok) throw new Error(`Dựng dữ liệu "${label}" thất bại: ${r.out.code} ${r.out.text}`);
  return r;
}

// Đường dẫn MỚI (đã thu hồi để không đụng chỉ mục "một sống") cho học viên — dùng khi cần một link riêng chưa có máy.
const freshLink = async (org: Org, customerId: string) => (await mustOk('đường dẫn riêng', insertLink(org, customerId, revoked))).id;

async function newCustomer(orgId: string, label: string) {
  return (await db.customer.create({ data: { organizationId: orgId, fullName: `Học viên ${label}`, phone: '0901234567' } })).id;
}

async function buildOrg(app: ReturnType<typeof makeApp>, label: string): Promise<Org> {
  const orgId = await createOrg(app, owner, label);
  const c1 = await newCustomer(orgId, `${label}-1`);
  const c2 = await newCustomer(orgId, `${label}-2`);
  const org: Org = { id: orgId, c1, c2, link1: '', link2: '', dev1: '', dev2: '' };
  org.link1 = (await mustOk('link1', insertLink(org, c1))).id;
  org.link2 = (await mustOk('link2', insertLink(org, c2))).id;
  org.dev1 = (await mustOk('dev1', insertDevice(org, c1, org.link1))).id;
  org.dev2 = (await mustOk('dev2', insertDevice(org, c2, org.link2))).id;
  return org;
}

const count = async (sql: string) => Number((await db.$queryRawUnsafe<Array<{ n: bigint }>>(sql))[0]!.n);

beforeAll(async () => {
  const app = makeApp(deps);
  owner = await registerUser(app, 'e1');
  A = await buildOrg(app, 'e1-a');
  B = await buildOrg(app, 'e1-b');
});

afterAll(async () => {
  console.log(
    `[bản vẽ E — database] ca vi phạm bị chặn ${tally.blocked}/${tally.blockedTotal}; ca hợp lệ ghi được ${tally.allowed}/${tally.allowedTotal}`,
  );
  await db.$disconnect();
});

// ======================================================================================================
describe('portal_links — đường dẫn', () => {
  it('key_hash: chìa base64url 43 ký tự / hex hoa / 63 / 65 ký tự / rỗng bị chặn; sha256 hex thường ghi được', async () => {
    const bad: Array<[string, string]> = [
      ['chìa bản rõ base64url 43 ký tự', base64urlKey()],
      ['hex viết hoa', str(sha().toUpperCase())],
      ['63 ký tự', str(sha().slice(0, 63))],
      ['65 ký tự', str(`${sha()}0`)],
      ['rỗng', `''`],
    ];
    for (const [label, h] of bad) {
      expectBlocked(label, (await insertLink(A, A.c1, { key_hash: h, ...revoked })).out, '23514', 'portal_links_key_hash_sha256');
    }
    expectAllowed('sha256 hex', (await insertLink(A, A.c1, revoked)).out);
  });

  it('key_hash trùng bị chặn (chỉ mục duy nhất)', async () => {
    const h = hex();
    expectAllowed('chìa lần 1', (await insertLink(A, A.c1, { key_hash: h, ...revoked })).out);
    expectBlocked('chìa lần 2 (học viên khác, tổ chức khác)', (await insertLink(B, B.c2, { key_hash: h, ...revoked })).out, '23505', 'Key (key_hash)=');
  });

  it('expires_at phải sau created_at; first_opened_at không trước created_at', async () => {
    expectBlocked('hết hạn = lúc tạo', (await insertLink(A, A.c1, { created_at: `'2026-10-01T00:00:00Z'`, expires_at: `'2026-10-01T00:00:00Z'`, ...revoked })).out, '23514', 'portal_links_expires_after_created');
    expectBlocked('hết hạn trước lúc tạo', (await insertLink(A, A.c1, { created_at: `'2026-10-01T00:00:00Z'`, expires_at: `'2026-09-30T00:00:00Z'`, ...revoked })).out, '23514', 'portal_links_expires_after_created');
    expectBlocked('mở trước lúc tạo', (await insertLink(A, A.c1, { created_at: `'2026-10-01T00:00:00Z'`, expires_at: `'2026-10-08T00:00:00Z'`, first_opened_at: `'2026-09-30T23:59:59Z'`, ...revoked })).out, '23514', 'portal_links_opened_after_created');
    expectAllowed('mở đúng lúc tạo', (await insertLink(A, A.c1, { created_at: `'2026-10-01T00:00:00Z'`, expires_at: `'2026-10-08T00:00:00Z'`, first_opened_at: `'2026-10-01T00:00:00Z'`, ...revoked })).out);
    expectAllowed('giả "đã hết hạn": lùi cả created_at lẫn expires_at', (await insertLink(A, A.c1, { created_at: `now() - interval '8 days'`, expires_at: `now() - interval '1 day'`, ...revoked })).out);
  });

  it('failed_attempts ngoài 0..5 bị chặn; khoá khi và chỉ khi đủ 5 lần sai (bẫy NULL: ghi thẳng locked_at NULL)', async () => {
    expectBlocked('sai 6 lần (chưa khoá)', (await insertLink(A, A.c1, { failed_attempts: '6', ...revoked })).out, '23514', 'portal_links_failed_range');
    expectBlocked('sai 6 lần (đã khoá)', (await insertLink(A, A.c1, { failed_attempts: '6', locked_at: 'now()', ...revoked })).out, '23514', 'portal_links_failed_range');
    expectBlocked('sai -1 lần', (await insertLink(A, A.c1, { failed_attempts: '-1', ...revoked })).out, '23514', 'portal_links_failed_range');
    expectBlocked('khoá mà mới sai 3 lần', (await insertLink(A, A.c1, { failed_attempts: '3', locked_at: 'now()', ...revoked })).out, '23514', 'portal_links_lock_pair');
    expectBlocked('khoá mà sai 0 lần', (await insertLink(A, A.c1, { failed_attempts: '0', locked_at: 'now()', ...revoked })).out, '23514', 'portal_links_lock_pair');
    expectBlocked('sai 5 lần mà locked_at NULL', (await insertLink(A, A.c1, { failed_attempts: '5', locked_at: 'NULL', ...revoked })).out, '23514', 'portal_links_lock_pair');
    expectAllowed('sai 4 lần, chưa khoá', (await insertLink(A, A.c1, { failed_attempts: '4', ...revoked })).out);
    expectAllowed('sai 5 lần, đã khoá', (await insertLink(A, A.c1, { failed_attempts: '5', locked_at: 'now()', ...revoked })).out);
  });

  it('thu hồi: revoked_at và revoke_reason đi cặp; revoked_by_id cần revoked_at', async () => {
    expectBlocked('revoked_at có, revoke_reason NULL', (await insertLink(A, A.c1, { revoked_at: 'now()', revoke_reason: 'NULL' })).out, '23514', 'portal_links_revoke_pair');
    expectBlocked('revoke_reason có, revoked_at NULL', (await insertLink(A, A.c1, { revoked_at: 'NULL', revoke_reason: `'REVOKED'` })).out, '23514', 'portal_links_revoke_pair');
    expectBlocked('revoked_by_id có, revoked_at NULL', (await insertLink(A, A.c1, { revoked_by_id: uuid(owner.id), revoked_at: 'NULL', revoke_reason: 'NULL' })).out, '23514', 'portal_links_revoked_by_needs_revoked');
    expectAllowed('thu hồi đủ cặp + người làm', (await insertLink(A, A.c1, { revoked_at: 'now()', revoke_reason: `'REVOKED'`, revoked_by_id: uuid(owner.id) })).out);
    expectAllowed('thu hồi không người làm', (await insertLink(A, A.c1, { revoked_at: 'now()', revoke_reason: `'REPLACED'` })).out);
  });

  it('mỗi học viên tối đa MỘT đường dẫn chưa thu hồi (chỉ mục có điều kiện); đã thu hồi / học viên khác ghi được', async () => {
    const c = await newCustomer(A.id, 'một-sống');
    expectAllowed('đường dẫn sống 1', (await insertLink(A, c)).out);
    expectBlocked('đường dẫn sống 2 cùng học viên', (await insertLink(A, c)).out, '23505', 'Key (customer_id)=');
    expectAllowed('đường dẫn đã thu hồi cùng học viên', (await insertLink(A, c, revoked)).out);
    expectAllowed('đường dẫn sống của học viên khác', (await insertLink(A, await newCustomer(A.id, 'khác'))).out);
    // Thu hồi cái đang sống → tạo cái mới được.
    await run(`UPDATE portal_links SET revoked_at = now(), revoke_reason = 'REPLACED' WHERE customer_id = ${uuid(c)} AND revoked_at IS NULL`);
    expectAllowed('đường dẫn sống mới sau khi thu hồi', (await insertLink(A, c)).out);
  });

  it('khoá ngoại kép: học viên của tổ chức KHÁC bị chặn; người tạo / người thu hồi / tổ chức không có thật bị chặn', async () => {
    expectBlocked('học viên của B trong tổ chức A', (await insertLink(A, B.c1, revoked)).out, '23503', 'portal_links_customer_id_organization_id_fkey');
    expectBlocked('người tạo không có thật', (await insertLink(A, A.c1, { created_by_id: uuid(randomUUID()), ...revoked })).out, '23503', 'portal_links_created_by_id_fkey');
    expectBlocked('người thu hồi không có thật', (await insertLink(A, A.c1, { revoked_by_id: uuid(randomUUID()), ...revoked })).out, '23503', 'portal_links_revoked_by_id_fkey');
    expectBlocked('tổ chức không có thật', (await insertLink({ id: randomUUID() }, A.c1, revoked)).out, '23503');
  });

  it('NOT NULL: ghi thẳng NULL vào từng cột bắt buộc bị chặn', async () => {
    for (const col of ['id', 'organization_id', 'customer_id', 'key_hash', 'created_by_id', 'created_at', 'expires_at', 'failed_attempts']) {
      expectBlocked(`portal_links.${col} NULL`, (await insertLink(A, A.c1, { ...revoked, [col]: 'NULL' })).out, '23502');
    }
  });

  it('trigger portal_links_guard: không đổi học viên / tổ chức / chìa, không gỡ thu hồi, không gỡ khoá; khoá và thu hồi thì được', async () => {
    const { id } = await mustOk('đường dẫn', insertLink(A, A.c1, revoked));
    const upd = (set: string) => run(`UPDATE portal_links SET ${set} WHERE id = ${uuid(id)}`);
    const owner_ = 'msg:Không đổi được học viên hoặc chìa của đường dẫn cổng';
    expectBlocked('đổi customer_id (cùng tổ chức)', await upd(`customer_id = ${uuid(A.c2)}`), '23514', owner_);
    expectBlocked('đổi organization_id + customer_id sang B', await upd(`organization_id = ${uuid(B.id)}, customer_id = ${uuid(B.c1)}`), '23514', owner_);
    expectBlocked('đổi key_hash', await upd(`key_hash = ${hex()}`), '23514', owner_);
    expectBlocked('gỡ thu hồi', await upd(`revoked_at = NULL, revoke_reason = NULL`), '23514', 'msg:Đường dẫn đã thu hồi không mở lại được');
    expectAllowed('sai 5 lần → khoá', await upd(`failed_attempts = 5, locked_at = now()`));
    expectBlocked('gỡ khoá', await upd(`failed_attempts = 0, locked_at = NULL`), '23514', 'msg:Đường dẫn đã khoá không mở khoá được');
    const { id: live } = await mustOk('đường dẫn sống', insertLink(A, await newCustomer(A.id, 'guard')));
    expectAllowed('mở lần đầu + về 0 lần sai', await run(`UPDATE portal_links SET first_opened_at = now(), failed_attempts = 0 WHERE id = ${uuid(live)}`));
    expectAllowed('thu hồi', await run(`UPDATE portal_links SET revoked_at = now(), revoke_reason = 'REVOKED', revoked_by_id = ${uuid(owner.id)} WHERE id = ${uuid(live)}`));
  });

  it('ON DELETE RESTRICT: xoá học viên còn đường dẫn bị chặn; xoá đường dẫn còn máy bị chặn', async () => {
    const c = await newCustomer(A.id, 'xoá');
    await mustOk('đường dẫn', insertLink(A, c, revoked));
    expectBlocked('xoá học viên còn đường dẫn', await run(`DELETE FROM customers WHERE id = ${uuid(c)}`), '23503', 'portal_links_customer_id_organization_id_fkey');
    expectBlocked('xoá đường dẫn còn máy', await run(`DELETE FROM portal_links WHERE id = ${uuid(A.link1)}`), '23503', 'portal_devices_link_id_organization_id_fkey');
  });
});

// ======================================================================================================
describe('portal_devices — máy đã mở', () => {
  it('label: rỗng / 81 ký tự bị chặn; 80 ký tự có dấu ghi được', async () => {
    const link = await freshLink(A, A.c1);
    expectBlocked('tên máy rỗng', (await insertDevice(A, A.c1, link, { label: `''` })).out, '23514', 'portal_devices_label_len');
    expectBlocked('tên máy 81 ký tự', (await insertDevice(A, A.c1, link, { label: str('ễ'.repeat(81)) })).out, '23514', 'portal_devices_label_len');
    expectAllowed('tên máy 80 ký tự có dấu', (await insertDevice(A, A.c1, link, { label: str('ễ'.repeat(80)) })).out);
  });

  it('kết thúc: ended_at và end_reason đi cặp (ghi thẳng NULL từng vế)', async () => {
    const link = await freshLink(A, A.c1);
    expectBlocked('ended_at có, end_reason NULL', (await insertDevice(A, A.c1, link, { ended_at: 'now()', end_reason: 'NULL' })).out, '23514', 'portal_devices_end_pair');
    expectBlocked('end_reason có, ended_at NULL', (await insertDevice(A, A.c1, link, { ended_at: 'NULL', end_reason: `'SIGNED_OUT'` })).out, '23514', 'portal_devices_end_pair');
  });

  it('người làm: BLOCKED / LINK_REVOKED phải có ended_by_id; SIGNED_OUT và máy sống không được có (bẫy sổ lỗi 24)', async () => {
    const link = await freshLink(A, A.c1);
    expectBlocked('BLOCKED không người làm', (await insertDevice(A, A.c1, link, { ended_at: 'now()', end_reason: `'BLOCKED'` })).out, '23514', 'portal_devices_staff_end_has_actor');
    expectBlocked('LINK_REVOKED không người làm', (await insertDevice(A, A.c1, link, { ended_at: 'now()', end_reason: `'LINK_REVOKED'` })).out, '23514', 'portal_devices_staff_end_has_actor');
    expectBlocked('ended_by_id có mà end_reason NULL (máy sống)', (await insertDevice(A, A.c1, link, { ended_by_id: uuid(owner.id) })).out, '23514', 'portal_devices_actor_only_staff_end');
    expectBlocked('ended_by_id có với SIGNED_OUT', (await insertDevice(A, A.c1, link, { ended_at: 'now()', end_reason: `'SIGNED_OUT'`, ended_by_id: uuid(owner.id) })).out, '23514', 'portal_devices_actor_only_staff_end');
    expectAllowed('SIGNED_OUT không người làm', (await insertDevice(A, A.c1, link, { ended_at: 'now()', end_reason: `'SIGNED_OUT'` })).out);
    const link2 = await freshLink(A, A.c1);
    expectAllowed('BLOCKED có người làm', (await insertDevice(A, A.c1, link2, { ended_at: 'now()', end_reason: `'BLOCKED'`, ended_by_id: uuid(owner.id) })).out);
    expectAllowed('LINK_REVOKED có người làm', (await insertDevice(A, A.c1, link2, { ended_at: 'now()', end_reason: `'LINK_REVOKED'`, ended_by_id: uuid(owner.id) })).out);
  });

  it('end_note: chỉ khi đã kết thúc, tối đa 200 ký tự', async () => {
    const link = await freshLink(A, A.c1);
    const blocked = { ended_at: 'now()', end_reason: `'BLOCKED'`, ended_by_id: uuid(owner.id) };
    expectBlocked('ghi chú trên máy sống', (await insertDevice(A, A.c1, link, { end_note: `'mất máy'` })).out, '23514', 'portal_devices_note_only_ended');
    expectBlocked('ghi chú 201 ký tự', (await insertDevice(A, A.c1, link, { ...blocked, end_note: str('ư'.repeat(201)) })).out, '23514', 'portal_devices_note_only_ended');
    expectAllowed('ghi chú 200 ký tự', (await insertDevice(A, A.c1, link, { ...blocked, end_note: str('ư'.repeat(200)) })).out);
  });

  it('mã chuyển máy: đi cặp với hạn, phải là sha256, chỉ trên máy sống', async () => {
    const link = await freshLink(A, A.c1);
    expectBlocked('handoff_hash có, hạn NULL', (await insertDevice(A, A.c1, link, { handoff_hash: hex(), handoff_expires_at: 'NULL' })).out, '23514', 'portal_devices_handoff_pair');
    expectBlocked('hạn có, handoff_hash NULL', (await insertDevice(A, A.c1, link, { handoff_hash: 'NULL', handoff_expires_at: `now() + interval '10 minutes'` })).out, '23514', 'portal_devices_handoff_pair');
    expectBlocked('mã bản rõ 8 ký tự', (await insertDevice(A, A.c1, link, { handoff_hash: `'ABCDEFGH'`, handoff_expires_at: `now() + interval '10 minutes'` })).out, '23514', 'portal_devices_handoff_sha256');
    expectBlocked('base64url 43 ký tự', (await insertDevice(A, A.c1, link, { handoff_hash: base64urlKey(), handoff_expires_at: `now() + interval '10 minutes'` })).out, '23514', 'portal_devices_handoff_sha256');
    expectBlocked('mã chuyển trên máy đã kết thúc', (await insertDevice(A, A.c1, link, { ended_at: 'now()', end_reason: `'SIGNED_OUT'`, handoff_hash: hex(), handoff_expires_at: `now() + interval '10 minutes'` })).out, '23514', 'portal_devices_handoff_only_live');
    expectAllowed('mã chuyển trên máy sống', (await insertDevice(A, A.c1, link, { handoff_hash: hex(), handoff_expires_at: `now() + interval '10 minutes'` })).out);
  });

  it('trigger portal_devices_max_per_link: máy thứ 3 cho cùng đường dẫn bị chặn, kể cả khi 2 máy trước đã kết thúc', async () => {
    const link = await freshLink(A, A.c1);
    expectAllowed('máy 1', (await insertDevice(A, A.c1, link)).out);
    expectAllowed('máy 2 (đã thoát)', (await insertDevice(A, A.c1, link, { ended_at: 'now()', end_reason: `'SIGNED_OUT'` })).out);
    expectBlocked('máy 3', (await insertDevice(A, A.c1, link)).out, '23514', 'msg:Mỗi đường dẫn cổng học viên mở tối đa 2 máy');
    await run(`UPDATE portal_devices SET ended_at = now(), end_reason = 'SIGNED_OUT' WHERE link_id = ${uuid(link)} AND ended_at IS NULL`);
    expectBlocked('máy 3 sau khi cả 2 đã thoát', (await insertDevice(A, A.c1, link)).out, '23514', 'msg:Mỗi đường dẫn cổng học viên mở tối đa 2 máy');
    expectAllowed('máy 1 của đường dẫn khác', (await insertDevice(A, A.c1, await freshLink(A, A.c1))).out);
  });

  it('ca đua: 5 lần thêm máy ĐỒNG THỜI cho cùng đường dẫn → đúng 2 lần thành công', async () => {
    const link = await freshLink(A, A.c1);
    // Mỗi lần thêm nằm trong một transaction giữ thêm 300 ms sau INSERT: thiếu khoá dòng đường dẫn thì cả 5 cùng đếm 0.
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        db.$transaction(
          async (tx) => {
            await tx.$executeRawUnsafe(
              insertSql('portal_devices', {
                id: uuid(randomUUID()),
                organization_id: uuid(A.id),
                customer_id: uuid(A.c1),
                link_id: uuid(link),
                label: `'Android · Chrome'`,
              }),
            );
            await tx.$executeRawUnsafe('SELECT pg_sleep(0.3)');
          },
          { maxWait: 20_000, timeout: 20_000 },
        ),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const rejectedByTrigger = results.filter(
      (r) => r.status === 'rejected' && pgErrorCode(r.reason) === '23514' && String((r.reason as Error).message).includes('tối đa 2 máy'),
    ).length;
    const rows = await count(`SELECT count(*) AS n FROM portal_devices WHERE link_id = ${uuid(link)}`);
    console.log(`[bản vẽ E — ca đua] thành công ${ok}/5, trigger chặn ${rejectedByTrigger}/5, dòng trong database ${rows}`);
    expect({ ok, rejectedByTrigger, rows }).toEqual({ ok: 2, rejectedByTrigger: 3, rows: 2 });
  });

  it('khoá ngoại kép: đường dẫn của học viên KHÁC cùng tổ chức bị chặn; tổ chức KHÁC bị chặn; người làm không có thật bị chặn', async () => {
    expectBlocked('máy của c1 trỏ đường dẫn của c2 (cùng tổ chức)', (await insertDevice(A, A.c1, await freshLink(A, A.c2))).out, '23503', 'portal_devices_link_id_customer_id_fkey');
    expectBlocked('máy trong A trỏ đường dẫn của B', (await insertDevice(A, A.c1, await freshLink(B, B.c1))).out, '23503', 'portal_devices_link_id_organization_id_fkey');
    expectBlocked('máy ghi tổ chức B cho học viên + đường dẫn của A', (await insertDevice(B, A.c1, await freshLink(A, A.c1))).out, '23503', 'portal_devices_customer_id_organization_id_fkey');
    expectBlocked('người kết thúc không có thật', (await insertDevice(A, A.c1, await freshLink(A, A.c1), { ended_at: 'now()', end_reason: `'BLOCKED'`, ended_by_id: uuid(randomUUID()) })).out, '23503', 'portal_devices_ended_by_id_fkey');
    expectBlocked('tổ chức không có thật', (await insertDevice({ id: randomUUID() }, A.c1, await freshLink(A, A.c1))).out, '23503');
    expectAllowed('máy của c2 trỏ đường dẫn của c2', (await insertDevice(A, A.c2, await freshLink(A, A.c2))).out);
  });

  it('NOT NULL: ghi thẳng NULL vào từng cột bắt buộc bị chặn', async () => {
    const link = await freshLink(A, A.c1);
    for (const col of ['id', 'organization_id', 'customer_id', 'label', 'created_at', 'last_seen_at']) {
      expectBlocked(`portal_devices.${col} NULL`, (await insertDevice(A, A.c1, link, { [col]: 'NULL' })).out, '23502');
    }
    // link_id NULL: trigger đếm theo NULL (0 máy) rồi NOT NULL chặn.
    expectBlocked('portal_devices.link_id NULL', (await insertDevice(A, A.c1, link, { link_id: 'NULL' })).out, '23502');
  });

  it('trigger portal_devices_guard: không đổi học viên / đường dẫn / tổ chức, máy đã kết thúc không sống lại', async () => {
    const link = await freshLink(A, A.c1);
    const { id } = await mustOk('máy', insertDevice(A, A.c1, link));
    const upd = (set: string) => run(`UPDATE portal_devices SET ${set} WHERE id = ${uuid(id)}`);
    const owner_ = 'msg:Không đổi được học viên hoặc đường dẫn của máy';
    expectBlocked('đổi link_id (cùng học viên)', await upd(`link_id = ${uuid(await freshLink(A, A.c1))}`), '23514', owner_);
    const linkC2 = await freshLink(A, A.c2);
    expectBlocked('đổi customer_id + link_id sang c2', await upd(`customer_id = ${uuid(A.c2)}, link_id = ${uuid(linkC2)}`), '23514', owner_);
    expectBlocked('đổi sang tổ chức B', await upd(`organization_id = ${uuid(B.id)}, customer_id = ${uuid(B.c1)}, link_id = ${uuid(B.link1)}`), '23514', owner_);
    expectAllowed('cập nhật last_seen_at', await upd(`last_seen_at = now()`));
    expectAllowed('chặn máy', await upd(`ended_at = now(), end_reason = 'BLOCKED', ended_by_id = ${uuid(owner.id)}, end_note = 'mất máy'`));
    expectBlocked('gỡ chặn', await upd(`ended_at = NULL, end_reason = NULL, ended_by_id = NULL, end_note = NULL`), '23514', 'msg:Máy đã chặn / đã thoát không mở lại được');
  });
});

// ======================================================================================================
describe('portal_sessions — phiên cổng', () => {
  it('token_hash: base64url / hex hoa bị chặn; trùng bị chặn; sha256 ghi được', async () => {
    expectBlocked('thẻ bản rõ base64url', (await insertSession(A, A.c1, A.dev1, { token_hash: base64urlKey() })).out, '23514', 'portal_sessions_token_hash_sha256');
    expectBlocked('thẻ "mpp_…" bản rõ', (await insertSession(A, A.c1, A.dev1, { token_hash: str(`mpp_${sha()}`) })).out, '23514', 'portal_sessions_token_hash_sha256');
    expectBlocked('hex hoa', (await insertSession(A, A.c1, A.dev1, { token_hash: str(sha().toUpperCase()) })).out, '23514', 'portal_sessions_token_hash_sha256');
    const h = hex();
    expectAllowed('phiên 1', (await insertSession(A, A.c1, A.dev1, { token_hash: h })).out);
    expectBlocked('phiên trùng thẻ (máy khác, tổ chức khác)', (await insertSession(B, B.c1, B.dev1, { token_hash: h })).out, '23505', 'Key (token_hash)=');
  });

  it('expires_at phải sau created_at', async () => {
    expectBlocked('hết hạn = lúc tạo', (await insertSession(A, A.c1, A.dev1, { created_at: `'2026-10-01T00:00:00Z'`, expires_at: `'2026-10-01T00:00:00Z'` })).out, '23514', 'portal_sessions_expires_after_created');
    expectAllowed('hết hạn sau lúc tạo 1 ms', (await insertSession(A, A.c1, A.dev1, { created_at: `'2026-10-01T00:00:00Z'`, expires_at: `'2026-10-01T00:00:00.001Z'` })).out);
  });

  it('khoá ngoại kép: máy của học viên KHÁC bị chặn; máy / học viên của tổ chức KHÁC bị chặn', async () => {
    expectBlocked('phiên của c1 trỏ máy của c2 (cùng tổ chức)', (await insertSession(A, A.c1, A.dev2)).out, '23503', 'portal_sessions_device_id_customer_id_fkey');
    expectBlocked('phiên trong A trỏ máy của B', (await insertSession(A, A.c1, B.dev1)).out, '23503', 'portal_sessions_device_id_organization_id_fkey');
    expectBlocked('phiên ghi tổ chức B cho học viên + máy của A', (await insertSession(B, A.c1, A.dev1)).out, '23503', 'portal_sessions_customer_id_organization_id_fkey');
    expectBlocked('tổ chức không có thật', (await insertSession({ id: randomUUID() }, A.c1, A.dev1)).out, '23503');
    expectAllowed('phiên của c2 trên máy của c2', (await insertSession(A, A.c2, A.dev2)).out);
  });

  it('trigger: không tạo phiên cho máy đã kết thúc', async () => {
    const link = await freshLink(A, A.c1);
    const { id: dev } = await mustOk('máy', insertDevice(A, A.c1, link));
    expectAllowed('phiên trên máy sống', (await insertSession(A, A.c1, dev)).out);
    await mustOk('thoát máy', Promise.resolve({ out: await run(`UPDATE portal_devices SET ended_at = now(), end_reason = 'SIGNED_OUT' WHERE id = ${uuid(dev)}`) }));
    const out = (await insertSession(A, A.c1, dev)).out;
    expectBlocked('phiên trên máy đã thoát', out, '23514', 'msg:Máy đã chặn / đã thoát');
    // Lời của trigger phiên, không phải lời trigger máy.
    expect(out.ok ? '' : out.text).not.toMatch(/không mở lại được/);
  });

  it('NOT NULL: ghi thẳng NULL vào từng cột bắt buộc bị chặn', async () => {
    for (const col of ['id', 'organization_id', 'customer_id', 'device_id', 'token_hash', 'created_at', 'last_used_at', 'expires_at']) {
      expectBlocked(`portal_sessions.${col} NULL`, (await insertSession(A, A.c1, A.dev1, { [col]: 'NULL' })).out, '23502');
    }
  });

  it('trigger portal_sessions_guard: không đổi chủ / máy / thẻ, phiên đã thu hồi không sống lại', async () => {
    const { id } = await mustOk('phiên', insertSession(A, A.c1, A.dev1));
    const upd = (set: string) => run(`UPDATE portal_sessions SET ${set} WHERE id = ${uuid(id)}`);
    const owner_ = 'msg:Không đổi được chủ của phiên cổng';
    const link = await freshLink(A, A.c1);
    const { id: dev3 } = await mustOk('máy khác của c1', insertDevice(A, A.c1, link));
    expectBlocked('đổi device_id (cùng học viên)', await upd(`device_id = ${uuid(dev3)}`), '23514', owner_);
    expectBlocked('đổi sang c2 + máy của c2', await upd(`customer_id = ${uuid(A.c2)}, device_id = ${uuid(A.dev2)}`), '23514', owner_);
    expectBlocked('đổi sang tổ chức B', await upd(`organization_id = ${uuid(B.id)}, customer_id = ${uuid(B.c1)}, device_id = ${uuid(B.dev1)}`), '23514', owner_);
    expectBlocked('đổi token_hash', await upd(`token_hash = ${hex()}`), '23514', owner_);
    expectAllowed('trượt hạn', await upd(`last_used_at = now(), expires_at = now() + interval '90 days'`));
    expectAllowed('thu hồi', await upd(`revoked_at = now()`));
    expectBlocked('gỡ thu hồi', await upd(`revoked_at = NULL`), '23514', 'msg:Phiên đã thu hồi không mở lại được');
  });
});

// ======================================================================================================
describe('portal_settings — số tài khoản', () => {
  it('đủ cả 3 hoặc trống cả 3 (ghi thẳng NULL từng vế); số tài khoản chỉ chữ số 6–20; tên 2–80 ký tự', async () => {
    const app = makeApp(deps);
    const org = await createOrg(app, owner, 'e1-st');
    const bad: Array<[string, Record<string, string>, string]> = [
      ['thiếu ngân hàng', { bank_name: 'NULL' }, 'portal_settings_bank_all_or_none'],
      ['thiếu số tài khoản', { bank_account_no: 'NULL' }, 'portal_settings_bank_all_or_none'],
      ['thiếu chủ tài khoản', { bank_account_name: 'NULL' }, 'portal_settings_bank_all_or_none'],
      ['chỉ có ngân hàng', { bank_account_no: 'NULL', bank_account_name: 'NULL' }, 'portal_settings_bank_all_or_none'],
      ['số tài khoản có chữ', { bank_account_no: `'0123ABC789'` }, 'portal_settings_account_no_digits'],
      ['số tài khoản có dấu cách', { bank_account_no: `'0123 456 789'` }, 'portal_settings_account_no_digits'],
      ['số tài khoản 5 chữ số', { bank_account_no: `'12345'` }, 'portal_settings_account_no_digits'],
      ['số tài khoản 21 chữ số', { bank_account_no: str('1'.repeat(21)) }, 'portal_settings_account_no_digits'],
      ['ngân hàng 1 ký tự', { bank_name: `'V'` }, 'portal_settings_bank_name_len'],
      ['ngân hàng 81 ký tự', { bank_name: str('Ạ'.repeat(81)) }, 'portal_settings_bank_name_len'],
      ['chủ tài khoản 1 ký tự', { bank_account_name: `'A'` }, 'portal_settings_account_name_len'],
      ['chủ tài khoản 81 ký tự', { bank_account_name: str('A'.repeat(81)) }, 'portal_settings_account_name_len'],
    ];
    for (const [label, over, name] of bad) expectBlocked(label, await insertSettings(org, over), '23514', name);
    for (const col of ['organization_id', 'updated_by_id', 'updated_at']) {
      expectBlocked(`portal_settings.${col} NULL`, await insertSettings(org, { [col]: 'NULL' }), '23502');
    }
    expectBlocked('người sửa không có thật', await insertSettings(org, { updated_by_id: uuid(randomUUID()) }), '23503', 'portal_settings_updated_by_id_fkey');
    expectBlocked('tổ chức không có thật', await insertSettings(randomUUID()), '23503', 'portal_settings_organization_id_fkey');
    expectAllowed('đủ cả 3 (6 chữ số, tên 2 ký tự)', await insertSettings(org, { bank_name: `'VP'`, bank_account_no: `'123456'`, bank_account_name: `'AN'` }));
    expectBlocked('dòng thứ 2 cùng tổ chức', await insertSettings(org), '23505', 'Key (organization_id)=');
    const upd = (set: string) => run(`UPDATE portal_settings SET ${set} WHERE organization_id = ${uuid(org)}`);
    expectAllowed('trống cả 3', await upd('bank_name = NULL, bank_account_no = NULL, bank_account_name = NULL'));
    expectBlocked('sửa còn 1 trên 3', await upd(`bank_name = 'Vietcombank'`), '23514', 'portal_settings_bank_all_or_none');
    expectAllowed('đủ cả 3 (20 chữ số, tên 80 ký tự)', await upd(`bank_name = ${str('Ạ'.repeat(80))}, bank_account_no = ${str('9'.repeat(20))}, bank_account_name = ${str('B'.repeat(80))}`));
  });
});

// ======================================================================================================
describe('chỉ mục và trigger', () => {
  it('đủ chỉ mục của bản vẽ E, chỉ mục có điều kiện đúng điều kiện; đủ 4 trigger', async () => {
    const want: Record<string, RegExp> = {
      portal_links_one_live_per_customer:
        /^CREATE UNIQUE INDEX portal_links_one_live_per_customer ON public\.portal_links USING btree \(customer_id\) WHERE \(revoked_at IS NULL\)$/,
      portal_links_key_hash_key: /^CREATE UNIQUE INDEX \S+ ON public\.portal_links USING btree \(key_hash\)$/,
      portal_links_id_organization_id_key: /^CREATE UNIQUE INDEX \S+ ON public\.portal_links USING btree \(id, organization_id\)$/,
      portal_links_id_customer_id_key: /^CREATE UNIQUE INDEX \S+ ON public\.portal_links USING btree \(id, customer_id\)$/,
      portal_links_organization_id_customer_id_created_at_idx: /ON public\.portal_links USING btree \(organization_id, customer_id, created_at\)$/,
      portal_devices_id_organization_id_key: /^CREATE UNIQUE INDEX \S+ ON public\.portal_devices USING btree \(id, organization_id\)$/,
      portal_devices_id_customer_id_key: /^CREATE UNIQUE INDEX \S+ ON public\.portal_devices USING btree \(id, customer_id\)$/,
      portal_devices_link_id_idx: /ON public\.portal_devices USING btree \(link_id\)$/,
      portal_devices_organization_id_customer_id_created_at_idx: /ON public\.portal_devices USING btree \(organization_id, customer_id, created_at\)$/,
      portal_sessions_token_hash_key: /^CREATE UNIQUE INDEX \S+ ON public\.portal_sessions USING btree \(token_hash\)$/,
      portal_sessions_device_id_idx: /ON public\.portal_sessions USING btree \(device_id\)$/,
    };
    const rows = await db.$queryRawUnsafe<Array<{ indexname: string; indexdef: string }>>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      Object.keys(want),
    );
    const byName = new Map(rows.map((r) => [r.indexname, r.indexdef]));
    const missing = Object.keys(want).filter((n) => !want[n]!.test(byName.get(n) ?? ''));
    console.log(`[bản vẽ E — chỉ mục] đúng ${Object.keys(want).length - missing.length}/${Object.keys(want).length}${missing.length ? `; THIẾU/SAI: ${missing.join(', ')}` : ''}`);
    expect(missing).toEqual([]);

    const triggers = await db.$queryRawUnsafe<Array<{ tgname: string; rel: string }>>(
      `SELECT t.tgname, c.relname AS rel FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE NOT t.tgisinternal AND c.relname LIKE 'portal\\_%' ORDER BY t.tgname`,
    );
    expect(triggers.map((t) => `${t.rel}.${t.tgname}`)).toEqual([
      'portal_devices.portal_devices_guard',
      'portal_devices.portal_devices_max_per_link',
      'portal_links.portal_links_guard',
      'portal_sessions.portal_sessions_guard',
    ]);
  });
});
