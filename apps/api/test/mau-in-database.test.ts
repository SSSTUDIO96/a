// Bản vẽ G mục 2.3, 2.4, 5.1 (gói G-M1) — bài thử GHI THẲNG database cho mẫu in hợp đồng (đi vòng qua máy chủ, sổ lỗi 24).
// Migration 20261019220000_mau_in_hop_dong. Mỗi chốt (CHECK, khoá ngoại kép theo tổ chức / theo hợp đồng, chỉ mục duy nhất
// và chỉ mục một phần, trigger) có:
//   - ca VI PHẠM: phải bị chặn đúng mã Postgres VÀ đúng tên chốt (hoặc đúng lời của trigger). Chốt bị bỏ thì ca này ghi
//     được hoặc bị chốt khác chặn → đỏ;
//   - ca HỢP LỆ (vế GIỮ): phải ghi được (chốt viết quá tay chặn nhầm → đỏ).
// Cột cho phép NULL nào nằm trong CHECK cũng có ca ghi thẳng NULL (bảng 2.4). Trigger print_templates_version_guard là
// BEFORE UPDATE, nên các ca CHECK của bảng mẫu in đi bằng INSERT.
// Tổ chức, người dùng, khách, hợp đồng dựng thẳng bằng Prisma (KHÔNG qua POST /orgs): khi gói G-M3 thêm "tạo tổ chức thì
// có mẫu mặc định", các ca về chỉ mục một phần ở đây vẫn tự chủ (tổ chức của bài không có sẵn mẫu nào).
// Các chốt là lưới thứ hai (khi các chốt khác còn thì không ca ghi nào chạm tới chúng trước): contract_prints_organization_id_fkey
// (khoá kép hợp đồng bắt trước), contract_prints_id_organization_id_key (đã có khoá chính id), và hai chỉ mục đích của khoá kép
// (print_templates_id_organization_id_key, contract_prints_id_contract_id_key — không bỏ được khi khoá ngoại còn).
// Chúng được kiểm bằng danh mục (pg_constraint / pg_indexes) ở khối cuối.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgErrorCode } from '../src/http/middleware';
import { makeDeps } from './helpers';

const deps = makeDeps();
const db = deps.db;
const MIGRATION = new URL('../prisma/migrations/20261019220000_mau_in_hop_dong/migration.sql', import.meta.url);

// ---------- Ghi SQL thô + đếm ca ----------
type Outcome = { ok: true; n: number } | { ok: false; code: string | null; text: string };

const str = (s: string) => `'${s.replace(/'/g, "''")}'`;
const uuid = (s: string) => `${str(s)}::uuid`;
const json = (s: string) => `${str(s)}::jsonb`;

const errText = (err: unknown) => `${String((err as Error).message)} ${JSON.stringify((err as { meta?: unknown }).meta ?? {})}`;

async function run(sql: string): Promise<Outcome> {
  try {
    const n = await db.$executeRawUnsafe(sql);
    return { ok: true, n };
  } catch (err) {
    const code = pgErrorCode(err);
    let text = errText(err);
    // Lời 23505 qua Prisma chỉ có "Key (…)=(…)", không có tên chỉ mục — mà hai chỉ mục một phần mặc định cùng khoá
    // (organization_id). Chạy lại đúng câu đó trong khối DO (câu vừa trượt nên không để lại gì) để lấy CONSTRAINT_NAME.
    if (code === '23505') {
      try {
        await db.$executeRawUnsafe(
          `DO $mau_in_g$ DECLARE c text; BEGIN EXECUTE $mau_in_q$${sql}$mau_in_q$;
             EXCEPTION WHEN unique_violation THEN GET STACKED DIAGNOSTICS c = CONSTRAINT_NAME; RAISE EXCEPTION 'chốt duy nhất "%"', c; END $mau_in_g$`,
        );
        text += ' [chạy lại KHÔNG trượt]';
      } catch (again) {
        text += ` ${errText(again)}`;
      }
    }
    return { ok: false, code, text };
  }
}

const tally = { blocked: 0, blockedTotal: 0, allowed: 0, allowedTotal: 0 };

// Ca vi phạm: đúng mã + đúng chốt ('msg:…' = lời RAISE EXCEPTION của trigger; còn lại = tên chốt, có ngoặc kép hai đầu).
function expectBlocked(label: string, out: Outcome, code: string, constraint: string) {
  tally.blockedTotal++;
  const needle = constraint.startsWith('msg:') ? constraint.slice(4) : `"${constraint}"`;
  const hit = !out.ok && out.code === code && out.text.includes(needle);
  if (hit) tally.blocked++;
  expect(hit, `${label}: mong bị chặn ${code} bởi ${constraint}, nhận ${out.ok ? `GHI ĐƯỢC ${out.n} dòng` : `${out.code} ${out.text.slice(0, 400)}`}`).toBe(true);
}

// Ca hợp lệ: ghi được đúng `rows` dòng.
function expectAllowed(label: string, out: Outcome, rows = 1) {
  tally.allowedTotal++;
  const hit = out.ok && out.n === rows;
  if (hit) tally.allowed++;
  expect(hit, `${label}: mong ghi được ${rows} dòng, nhận ${out.ok ? `${out.n} dòng` : `${out.code} ${out.text.slice(0, 400)}`}`).toBe(true);
}

// Lời của trigger (khớp đúng chữ trong migration).
const V_ORG = 'msg:Mẫu in không được đổi tổ chức';
const V_DOWN = 'msg:Mẫu in không được giảm phiên bản';
const V_BUMP = 'msg:Mẫu in đổi nội dung in thì phiên bản phải tăng';
const P_UPDATE = 'msg:contract_prints chỉ được ghi thêm, không được UPDATE';
const P_DELETE = 'msg:contract_prints chỉ được ghi thêm, không được DELETE';

// ---------- Dựng bản ghi ----------
interface Org {
  id: string;
  contract1: string;
  contract2: string;
  template: string; // mẫu thường (không mặc định), dùng cho cả hai loại
}

let userId: string;
let A: Org;
let B: Org;

let counter = 0;
const tag = () => `${++counter}-${randomUUID().slice(0, 8)}`;

async function newOrg(kind: 'INDIVIDUAL' | 'TEAM' | 'ACADEMY' = 'ACADEMY'): Promise<string> {
  const t = tag();
  return (await db.organization.create({ data: { slug: `g-m1-${t}`, name: `Tổ chức G-M1 ${t}`, kind } })).id;
}

async function newContract(orgId: string): Promise<string> {
  const t = tag();
  const customer = await db.customer.create({ data: { organizationId: orgId, fullName: `Khách ${t}` } });
  return (await db.contract.create({ data: { organizationId: orgId, code: `HĐ-G-${t}`, customerId: customer.id, createdById: userId } })).id;
}

function insertSql(table: string, cols: Record<string, string>): string {
  const names = Object.keys(cols).map((c) => `"${c}"`).join(', ');
  return `INSERT INTO "${table}" (${names}) VALUES (${Object.values(cols).join(', ')})`;
}

// Một mẫu in hợp lệ (không mặc định); `over` ghi đè từng cột bằng mảnh SQL.
async function insertTemplate(orgId: string, over: Record<string, string> = {}) {
  const id = randomUUID();
  const out = await run(
    insertSql('print_templates', {
      id: uuid(id),
      organization_id: uuid(orgId),
      name: str('Mẫu thử'),
      layout: '2',
      for_service: 'true',
      for_course: 'true',
      default_service: 'false',
      default_course: 'false',
      blocks: json('{}'),
      title: 'NULL',
      opening_text: 'NULL',
      closing_text: 'NULL',
      version: '1',
      is_active: 'true',
      updated_by_id: 'NULL',
      created_at: 'now()',
      updated_at: 'now()',
      ...over,
    }),
  );
  return { id, out };
}

async function mustOk<T extends { out: Outcome }>(label: string, p: Promise<T>): Promise<T> {
  const r = await p;
  if (!r.out.ok) throw new Error(`Dựng dữ liệu "${label}" thất bại: ${r.out.code} ${r.out.text}`);
  return r;
}

const HASH = 'a'.repeat(64);
const CONFIG = '{"layout":2,"blocks":{"quoc-hieu":false}}';
const DATA = '{"kind":"SERVICE","version":1}';
const nextNo = new Map<string, number>();
const takeNo = (contractId: string) => {
  const n = (nextNo.get(contractId) ?? 0) + 1;
  nextNo.set(contractId, n);
  return n;
};

// Một dòng nhật ký in hợp lệ (TEMPLATE, lần in kế tiếp của hợp đồng); `over` ghi đè từng cột bằng mảnh SQL.
async function insertPrint(org: Org, contractId: string, over: Record<string, string> = {}, id = randomUUID()) {
  const out = await run(
    insertSql('contract_prints', {
      id: uuid(id),
      organization_id: uuid(org.id),
      contract_id: uuid(contractId),
      print_no: over.print_no ?? String(takeNo(contractId)),
      source: `'TEMPLATE'`,
      based_on_print_id: 'NULL',
      template_id: uuid(org.template),
      template_version: '1',
      config: json(CONFIG),
      data: json(DATA),
      data_version: '1',
      data_hash: str(HASH),
      contract_status: `'DRAFT'`,
      printed_by_id: uuid(userId),
      printed_at: 'now()',
      ...over,
    }),
  );
  return { id, out };
}

const count = async (sql: string) => Number((await db.$queryRawUnsafe<Array<{ n: bigint }>>(sql))[0]!.n);

async function buildOrg(): Promise<Org> {
  const id = await newOrg('ACADEMY');
  const contract1 = await newContract(id);
  const contract2 = await newContract(id);
  const { id: template } = await mustOk('mẫu thường', insertTemplate(id));
  await db.organizationProfile.create({ data: { organizationId: id, brandName: 'Studio thử G-M1' } });
  return { id, contract1, contract2, template };
}

beforeAll(async () => {
  const t = tag();
  userId = (await db.user.create({ data: { email: `g-m1-${t}@thu.local`, passwordHash: 'khong-dang-nhap', fullName: 'Người thử G-M1' } })).id;
  A = await buildOrg();
  B = await buildOrg();
});

afterAll(async () => {
  console.log(
    `[bản vẽ G — database] ca vi phạm bị chặn ${tally.blocked}/${tally.blockedTotal}; ca hợp lệ ghi được ${tally.allowed}/${tally.allowedTotal}`,
  );
  await db.$disconnect();
});

// ======================================================================================================
// Hồ sơ thương hiệu — 5 cột "thông tin trên hợp đồng"
// ======================================================================================================
const PROFILE_COLS = ['representative_name', 'representative_title', 'bank_name', 'bank_account_number', 'bank_account_name'] as const;
type ProfileVals = Partial<Record<(typeof PROFILE_COLS)[number], string>>;
const BANK: ProfileVals = { bank_name: 'Vietcombank', bank_account_number: '0123456789', bank_account_name: 'NGUYEN THI HOA' };

// Ghi ĐỦ 5 cột (cột vắng = NULL) để mỗi ca không phụ thuộc ca trước.
const setProfile = (vals: ProfileVals, orgId = A.id) =>
  run(
    `UPDATE "organization_profiles" SET ${PROFILE_COLS.map((c) => `"${c}" = ${vals[c] === undefined ? 'NULL' : str(vals[c]!)}`).join(', ')}
      WHERE "organization_id" = ${uuid(orgId)}`,
  );

describe('organization_profiles — người đại diện', () => {
  it('representative_name_len: rỗng / toàn khoảng trắng / quá 120 bị chặn; NULL và 1..120 ký tự ghi được', async () => {
    expectAllowed('cả 5 cột NULL', await setProfile({}));
    expectAllowed('chỉ tên người đại diện', await setProfile({ representative_name: 'Nguyễn Thị Hoa' }));
    expectAllowed('tên 120 ký tự', await setProfile({ representative_name: 'ễ'.repeat(120) }));
    for (const [label, v] of [
      ['tên rỗng', ''],
      ['tên toàn khoảng trắng', '   '],
      ['tên 121 ký tự', 'ễ'.repeat(121)],
    ] as const) {
      expectBlocked(label, await setProfile({ representative_name: v }), '23514', 'organization_profiles_representative_name_len');
    }
  });

  it('representative_title: có chức vụ mà tên NULL bị chặn (bẫy NULL); chức vụ rỗng / quá 80 bị chặn', async () => {
    expectBlocked('chức vụ có, tên NULL', await setProfile({ representative_title: 'Giám đốc' }), '23514', 'organization_profiles_representative_title');
    expectBlocked('chức vụ "   "', await setProfile({ representative_name: 'Hoa', representative_title: '   ' }), '23514', 'organization_profiles_representative_title');
    expectBlocked('chức vụ 81 ký tự', await setProfile({ representative_name: 'Hoa', representative_title: 'ễ'.repeat(81) }), '23514', 'organization_profiles_representative_title');
    expectAllowed('tên + chức vụ 80 ký tự', await setProfile({ representative_name: 'Hoa', representative_title: 'ễ'.repeat(80) }));
  });
});

describe('organization_profiles — tài khoản ngân hàng', () => {
  it('bank_all_or_none: thiếu bất kỳ trường nào trong ba bị chặn (chỉ IS NULL / IS NOT NULL); đủ ba ghi được', async () => {
    expectAllowed('đủ ba trường', await setProfile({ ...BANK }));
    const partial: Array<[string, ProfileVals]> = [
      ['chỉ bank_name', { bank_name: BANK.bank_name }],
      ['chỉ số tài khoản', { bank_account_number: BANK.bank_account_number }],
      ['chỉ chủ tài khoản', { bank_account_name: BANK.bank_account_name }],
      ['thiếu chủ tài khoản', { bank_name: BANK.bank_name, bank_account_number: BANK.bank_account_number }],
      ['thiếu số tài khoản', { bank_name: BANK.bank_name, bank_account_name: BANK.bank_account_name }],
      ['thiếu tên ngân hàng', { bank_account_number: BANK.bank_account_number, bank_account_name: BANK.bank_account_name }],
    ];
    for (const [label, vals] of partial) expectBlocked(label, await setProfile(vals), '23514', 'organization_profiles_bank_all_or_none');
  });

  it('bank_name_len / bank_account_name_len: 1 ký tự, toàn khoảng trắng, quá 120 bị chặn', async () => {
    for (const [label, v] of [
      ['tên ngân hàng 1 ký tự', 'V'],
      ['tên ngân hàng "   "', '   '],
      ['tên ngân hàng 121 ký tự', 'ễ'.repeat(121)],
    ] as const) {
      expectBlocked(label, await setProfile({ ...BANK, bank_name: v }), '23514', 'organization_profiles_bank_name_len');
    }
    for (const [label, v] of [
      ['chủ tài khoản 1 ký tự', 'A'],
      ['chủ tài khoản "  "', '  '],
      ['chủ tài khoản 121 ký tự', 'A'.repeat(121)],
    ] as const) {
      expectBlocked(label, await setProfile({ ...BANK, bank_account_name: v }), '23514', 'organization_profiles_bank_account_name_len');
    }
    expectAllowed('tên ngân hàng 2 ký tự, chủ tài khoản 120 ký tự', await setProfile({ ...BANK, bank_name: 'VB', bank_account_name: 'A'.repeat(120) }));
  });

  it('bank_account_number_format: khoảng trắng, chữ thường, gạch, quá ngắn / dài bị chặn; 4..30 ký tự [0-9A-Z] ghi được', async () => {
    for (const [label, v] of [
      ['có khoảng trắng', '0123 456789'],
      ['chữ thường', 'abc123456'],
      ['có gạch', '0123-456789'],
      ['3 ký tự', '123'],
      ['31 ký tự', '1'.repeat(31)],
      ['rỗng', ''],
      ['có dấu', 'ĐÂ123456'],
    ] as const) {
      expectBlocked(`số tài khoản ${label}`, await setProfile({ ...BANK, bank_account_number: v }), '23514', 'organization_profiles_bank_account_number_format');
    }
    expectAllowed('số tài khoản 4 ký tự', await setProfile({ ...BANK, bank_account_number: '1234' }));
    expectAllowed('số tài khoản 30 ký tự chữ hoa + số', await setProfile({ ...BANK, bank_account_number: 'AB'.repeat(10) + '0'.repeat(10) }));
    expectAllowed('xoá cả 5 cột (về NULL)', await setProfile({}));
  });
});

// ======================================================================================================
// Mẫu in — CHECK
// ======================================================================================================
describe('print_templates — CHECK (ghi thẳng INSERT)', () => {
  it('vế GIỮ: bố cục 1 và 5, blocks đủ true/false, chữ đầu/cuối, mặc định hợp lệ', async () => {
    expectAllowed('bố cục 1', (await insertTemplate(A.id, { layout: '1' })).out);
    expectAllowed('bố cục 5, chỉ dịch vụ', (await insertTemplate(A.id, { layout: '5', for_course: 'false' })).out);
    expectAllowed('chỉ khoá học', (await insertTemplate(A.id, { for_service: 'false' })).out);
    expectAllowed('blocks true/false', (await insertTemplate(A.id, { blocks: json('{"quoc-hieu": true, "ky-nhay": false, "giay-to": true}') })).out);
    expectAllowed(
      'tiêu đề 160, mở đầu 2000, kết thúc 2000 ký tự',
      (await insertTemplate(A.id, { title: str('Ợ'.repeat(160)), opening_text: str('ễ'.repeat(2000)), closing_text: str('ễ'.repeat(2000)) })).out,
    );
    expectAllowed('tên 120 ký tự, phiên bản 7, ngừng dùng', (await insertTemplate(A.id, { name: str('ễ'.repeat(120)), version: '7', is_active: 'false' })).out);
    expectAllowed('người sửa là người dùng có thật', (await insertTemplate(A.id, { updated_by_id: uuid(userId) })).out);
  });

  it('print_templates_layout: 0, 6, -1 bị chặn', async () => {
    for (const v of ['0', '6', '-1']) expectBlocked(`layout ${v}`, (await insertTemplate(A.id, { layout: v })).out, '23514', 'print_templates_layout');
  });

  it('print_templates_applies: không dùng cho loại nào bị chặn', async () => {
    expectBlocked('for_service = for_course = false', (await insertTemplate(A.id, { for_service: 'false', for_course: 'false' })).out, '23514', 'print_templates_applies');
  });

  it('print_templates_default_service / _course: mặc định của loại không dùng được / đã ngừng dùng bị chặn', async () => {
    const org = await newOrg();
    expectBlocked('mặc định dịch vụ, chỉ dùng khoá học', (await insertTemplate(org, { for_service: 'false', default_service: 'true' })).out, '23514', 'print_templates_default_service');
    expectBlocked('mặc định dịch vụ, ngừng dùng', (await insertTemplate(org, { default_service: 'true', is_active: 'false' })).out, '23514', 'print_templates_default_service');
    expectBlocked('mặc định khoá học, chỉ dùng dịch vụ', (await insertTemplate(org, { for_course: 'false', default_course: 'true' })).out, '23514', 'print_templates_default_course');
    expectBlocked('mặc định khoá học, ngừng dùng', (await insertTemplate(org, { default_course: 'true', is_active: 'false' })).out, '23514', 'print_templates_default_course');
    expectAllowed('một mẫu mặc định cho CẢ HAI loại', (await insertTemplate(org, { default_service: 'true', default_course: 'true' })).out);
  });

  it('print_templates_name_len: rỗng, toàn khoảng trắng, 121 ký tự bị chặn', async () => {
    for (const [label, v] of [
      ['tên rỗng', ''],
      ['tên "   "', '   '],
      ['tên 121 ký tự', 'ễ'.repeat(121)],
    ] as const) {
      expectBlocked(label, (await insertTemplate(A.id, { name: str(v) })).out, '23514', 'print_templates_name_len');
    }
  });

  it('print_templates_title_len / _opening_len / _closing_len: toàn khoảng trắng (btrim), rỗng, quá dài bị chặn', async () => {
    const cases: Array<[string, string, number]> = [
      ['title', 'print_templates_title_len', 160],
      ['opening_text', 'print_templates_opening_len', 2000],
      ['closing_text', 'print_templates_closing_len', 2000],
    ];
    for (const [col, con, max] of cases) {
      for (const [label, v] of [
        ['"   "', '   '],
        ['rỗng', ''],
        [`${max + 1} ký tự`, 'ễ'.repeat(max + 1)],
      ] as const) {
        expectBlocked(`${col} ${label}`, (await insertTemplate(A.id, { [col]: str(v) })).out, '23514', con);
      }
    }
  });

  it('print_templates_version: 0 và âm bị chặn', async () => {
    for (const v of ['0', '-1']) expectBlocked(`version ${v}`, (await insertTemplate(A.id, { version: v })).out, '23514', 'print_templates_version');
  });

  it('print_templates_blocks_shape: null, chuỗi, số, object lồng, mảng, JSON null / chuỗi bị chặn', async () => {
    for (const v of [
      '{"tho": null}',
      '{"tho": "yes"}',
      '{"tho": 1}',
      '{"tho": {"a": true}}',
      '{"a": true, "b": "false"}',
      '[]',
      '[true]',
      'null',
      '"x"',
      'true',
    ]) {
      expectBlocked(`blocks ${v}`, (await insertTemplate(A.id, { blocks: json(v) })).out, '23514', 'print_templates_blocks_shape');
    }
  });

  it('khoá ngoại: tổ chức bịa, người sửa bịa bị chặn', async () => {
    expectBlocked('tổ chức không tồn tại', (await insertTemplate(randomUUID())).out, '23503', 'print_templates_organization_id_fkey');
    expectBlocked('người sửa không tồn tại', (await insertTemplate(A.id, { updated_by_id: uuid(randomUUID()) })).out, '23503', 'print_templates_updated_by_id_fkey');
  });
});

describe('print_templates — mỗi tổ chức tối đa MỘT mặc định cho mỗi loại (chỉ mục một phần)', () => {
  it('dịch vụ: trùng cùng tổ chức bị chặn (INSERT và UPDATE); khác tổ chức ghi được; mẫu không mặc định thì bao nhiêu cũng được', async () => {
    const x = await newOrg();
    const y = await newOrg();
    expectAllowed('X mặc định dịch vụ thứ nhất', (await insertTemplate(x, { default_service: 'true' })).out);
    expectBlocked('X mặc định dịch vụ thứ hai', (await insertTemplate(x, { default_service: 'true' })).out, '23505', 'print_templates_one_default_service');
    expectAllowed('Y mặc định dịch vụ (tổ chức khác)', (await insertTemplate(y, { default_service: 'true' })).out);
    const { id: plain } = await mustOk('X mẫu thường', insertTemplate(x));
    expectAllowed('X thêm mẫu thường nữa', (await insertTemplate(x)).out);
    expectBlocked(
      'X UPDATE mẫu thường thành mặc định dịch vụ',
      await run(`UPDATE "print_templates" SET "default_service" = true WHERE "id" = ${uuid(plain)}`),
      '23505',
      'print_templates_one_default_service',
    );
  });

  it('khoá học: trùng cùng tổ chức bị chặn; khác tổ chức ghi được', async () => {
    const x = await newOrg();
    const y = await newOrg();
    expectAllowed('X mặc định khoá học thứ nhất', (await insertTemplate(x, { default_course: 'true', layout: '1' })).out);
    expectBlocked('X mặc định khoá học thứ hai', (await insertTemplate(x, { default_course: 'true' })).out, '23505', 'print_templates_one_default_course');
    expectAllowed('Y mặc định khoá học (tổ chức khác)', (await insertTemplate(y, { default_course: 'true' })).out);
    expectAllowed('X mặc định DỊCH VỤ không đụng chỉ mục khoá học', (await insertTemplate(x, { default_service: 'true' })).out);
  });
});

// ======================================================================================================
// Trigger print_templates_version_guard
// ======================================================================================================
describe('trigger print_templates_version_guard', () => {
  const upd = (id: string, set: string) => run(`UPDATE "print_templates" SET ${set} WHERE "id" = ${uuid(id)}`);

  it('đổi từng cột nội dung in (layout, blocks, title, opening_text, closing_text) mà không tăng phiên bản → chặn, kể cả NULL ↔ giá trị', async () => {
    const { id } = await mustOk('mẫu cho trigger', insertTemplate(A.id, { title: str('HỢP ĐỒNG') }));
    const bad: Array<[string, string]> = [
      ['layout 2 → 3', `"layout" = 3`],
      ['blocks {} → {"ky-nhay": true}', `"blocks" = ${json('{"ky-nhay": true}')}`],
      ['title giá trị → NULL', `"title" = NULL`],
      ['title đổi chữ', `"title" = 'HỢP ĐỒNG MỚI'`],
      ['opening_text NULL → giá trị', `"opening_text" = 'Mở đầu'`],
      ['closing_text NULL → giá trị', `"closing_text" = 'Kết thúc'`],
      ['layout đổi, version giữ nguyên ghi rõ', `"layout" = 4, "version" = 1`],
    ];
    for (const [label, set] of bad) expectBlocked(label, await upd(id, set), 'P0001', V_BUMP);
  });

  it('vế GIỮ: chỉ đổi tên / cờ mặc định / ngừng dùng không tăng bản → được; đổi nội dung + tăng bản → được; ghi lại đúng giá trị cũ → được', async () => {
    const org = await newOrg();
    const { id } = await mustOk('mẫu cho trigger (giữ)', insertTemplate(org));
    expectAllowed('chỉ đổi tên', await upd(id, `"name" = 'Tên mới'`));
    expectAllowed('đặt mặc định dịch vụ', await upd(id, `"default_service" = true`));
    expectAllowed('bỏ mặc định + ngừng dùng', await upd(id, `"default_service" = false, "is_active" = false`));
    expectAllowed('ghi lại blocks y hệt (jsonb bằng nhau)', await upd(id, `"blocks" = ${json('{}')}, "layout" = 2`));
    expectAllowed('đổi layout + version 2', await upd(id, `"layout" = 3, "version" = 2`));
    expectAllowed('đổi blocks + chữ + version 5 (nhảy bản)', await upd(id, `"blocks" = ${json('{"quoc-hieu": true}')}, "title" = 'TIÊU ĐỀ', "version" = 5`));
    expectAllowed('chỉ tăng bản', await upd(id, `"version" = 6`));
    expect(await count(`SELECT count(*) AS n FROM "print_templates" WHERE "id" = ${uuid(id)} AND "version" = 6 AND "layout" = 3`)).toBe(1);
  });

  it('giảm phiên bản → chặn (kể cả không đổi nội dung)', async () => {
    const { id } = await mustOk('mẫu bản 3', insertTemplate(A.id, { version: '3' }));
    expectBlocked('version 3 → 2', await upd(id, `"version" = 2`), 'P0001', V_DOWN);
    expectBlocked('version 3 → 1 kèm đổi layout', await upd(id, `"version" = 1, "layout" = 5`), 'P0001', V_DOWN);
  });

  it('đổi tổ chức → chặn (mẫu chưa in lần nào, không khoá ngoại nào cản)', async () => {
    const { id } = await mustOk('mẫu để đổi tổ chức', insertTemplate(A.id));
    expectBlocked('organization_id A → B', await upd(id, `"organization_id" = ${uuid(B.id)}`), 'P0001', V_ORG);
    expect(await count(`SELECT count(*) AS n FROM "print_templates" WHERE "id" = ${uuid(id)} AND "organization_id" = ${uuid(A.id)}`)).toBe(1);
  });
});

// ======================================================================================================
// Nhật ký in
// ======================================================================================================
describe('contract_prints — CHECK', () => {
  let p1: string;

  beforeAll(async () => {
    p1 = (await mustOk('lần in 1', insertPrint(A, A.contract1))).id;
  });

  it('vế GIỮ: TEMPLATE, PRIOR_CONFIG và REPRINT có gốc cùng hợp đồng; khoá học; trạng thái khác', async () => {
    expectAllowed('PRIOR_CONFIG gốc = lần 1', (await insertPrint(A, A.contract1, { source: `'PRIOR_CONFIG'`, based_on_print_id: uuid(p1) })).out);
    expectAllowed('REPRINT gốc = lần 1', (await insertPrint(A, A.contract1, { source: `'REPRINT'`, based_on_print_id: uuid(p1) })).out);
    expectAllowed(
      'khoá học, bố cục 1, CONFIRMED, data_version 2',
      (await insertPrint(A, A.contract1, { config: json('{"layout":1,"blocks":{}}'), data: json('{"kind":"COURSE"}'), contract_status: `'CONFIRMED'`, data_version: '2' })).out,
    );
    expectAllowed('layout dạng chuỗi "5"', (await insertPrint(A, A.contract1, { config: json('{"layout":"5","blocks":{}}') })).out);
  });

  it('print_no / template_version / data_version < 1 bị chặn', async () => {
    expectBlocked('print_no 0', (await insertPrint(A, A.contract1, { print_no: '0' })).out, '23514', 'contract_prints_print_no');
    expectBlocked('print_no -1', (await insertPrint(A, A.contract1, { print_no: '-1' })).out, '23514', 'contract_prints_print_no');
    expectBlocked('template_version 0', (await insertPrint(A, A.contract1, { template_version: '0' })).out, '23514', 'contract_prints_template_version');
    expectBlocked('data_version 0', (await insertPrint(A, A.contract1, { data_version: '0' })).out, '23514', 'contract_prints_data_version');
  });

  it('contract_prints_data_hash: không đúng 64 hex thường bị chặn', async () => {
    for (const [label, v] of [
      ['chữ hoa', 'A'.repeat(64)],
      ['63 ký tự', 'a'.repeat(63)],
      ['65 ký tự', 'a'.repeat(65)],
      ['ký tự ngoài hex', 'g'.repeat(64)],
      ['rỗng', ''],
    ] as const) {
      expectBlocked(`data_hash ${label}`, (await insertPrint(A, A.contract1, { data_hash: str(v) })).out, '23514', 'contract_prints_data_hash');
    }
  });

  it('contract_prints_source_base: REPRINT / PRIOR_CONFIG thiếu gốc (bẫy NULL) và TEMPLATE có gốc bị chặn', async () => {
    expectBlocked('REPRINT, gốc NULL', (await insertPrint(A, A.contract1, { source: `'REPRINT'` })).out, '23514', 'contract_prints_source_base');
    expectBlocked('PRIOR_CONFIG, gốc NULL', (await insertPrint(A, A.contract1, { source: `'PRIOR_CONFIG'` })).out, '23514', 'contract_prints_source_base');
    expectBlocked('TEMPLATE có gốc', (await insertPrint(A, A.contract1, { based_on_print_id: uuid(p1) })).out, '23514', 'contract_prints_source_base');
  });

  it('contract_prints_not_self: lần in tự trỏ vào chính mình bị chặn (khoá ngoại kiểm cuối câu lệnh nên tự trỏ lọt khoá ngoại)', async () => {
    const self = randomUUID();
    expectBlocked('REPRINT gốc = chính nó', (await insertPrint(A, A.contract1, { source: `'REPRINT'`, based_on_print_id: uuid(self) }, self)).out, '23514', 'contract_prints_not_self');
    expectBlocked('PRIOR_CONFIG gốc = chính nó', (await insertPrint(A, A.contract1, { source: `'PRIOR_CONFIG'`, based_on_print_id: uuid(self) }, self)).out, '23514', 'contract_prints_not_self');
  });

  it('contract_prints_snapshot_shape: thiếu khoá (->> ra NULL), sai kiểu, sai giá trị bị chặn', async () => {
    const cases: Array<[string, Record<string, string>]> = [
      ['config {} (thiếu layout)', { config: json('{}') }],
      ['config {"layout":2} (thiếu blocks)', { config: json('{"layout":2}') }],
      ['config {"blocks":{}} (thiếu layout)', { config: json('{"blocks":{}}') }],
      ['config layout null', { config: json('{"layout":null,"blocks":{}}') }],
      ['config layout 6', { config: json('{"layout":6,"blocks":{}}') }],
      ['config layout 0', { config: json('{"layout":0,"blocks":{}}') }],
      ['config blocks là mảng', { config: json('{"layout":2,"blocks":[]}') }],
      ['config blocks null', { config: json('{"layout":2,"blocks":null}') }],
      ['config là mảng', { config: json('[]') }],
      ['data {} (thiếu kind)', { data: json('{}') }],
      ['data kind lạ', { data: json('{"kind":"OTHER"}') }],
      ['data kind null', { data: json('{"kind":null}') }],
      ['data là mảng', { data: json('[{"kind":"SERVICE"}]') }],
      ['data JSON null', { data: json('null') }],
    ];
    for (const [label, over] of cases) expectBlocked(label, (await insertPrint(A, A.contract1, over)).out, '23514', 'contract_prints_snapshot_shape');
  });

  it('enum: nguồn lạ, trạng thái lạ bị chặn (22P02)', async () => {
    expectBlocked('source BOGUS', (await insertPrint(A, A.contract1, { source: `'BOGUS'` })).out, '22P02', 'PrintSource');
    expectBlocked('contract_status BOGUS', (await insertPrint(A, A.contract1, { contract_status: `'BOGUS'` })).out, '22P02', 'ContractStatus');
  });
});

describe('contract_prints — khoá ngoại kép theo tổ chức / theo hợp đồng, số lần in duy nhất', () => {
  let pA1: string;
  let pB1: string;

  beforeAll(async () => {
    pA1 = (await mustOk('A lần in 1 (hợp đồng 2)', insertPrint(A, A.contract2))).id;
    pB1 = (await mustOk('B lần in 1', insertPrint(B, B.contract1))).id;
  });

  it('mẫu của tổ chức B gắn vào hợp đồng của A → chặn (khoá kép mẫu)', async () => {
    expectBlocked('org A, hợp đồng A, mẫu B', (await insertPrint(A, A.contract2, { template_id: uuid(B.template) })).out, '23503', 'contract_prints_template_id_organization_id_fkey');
    expectBlocked('mẫu bịa', (await insertPrint(A, A.contract2, { template_id: uuid(randomUUID()) })).out, '23503', 'contract_prints_template_id_organization_id_fkey');
  });

  it('hợp đồng của tổ chức B ghi dưới tổ chức A → chặn (khoá kép hợp đồng)', async () => {
    expectBlocked('org A, hợp đồng B, mẫu A', (await insertPrint(A, B.contract2)).out, '23503', 'contract_prints_contract_id_organization_id_fkey');
    expectBlocked('hợp đồng bịa', (await insertPrint(A, randomUUID())).out, '23503', 'contract_prints_contract_id_organization_id_fkey');
  });

  it('based_on_print_id của hợp đồng khác → chặn (khoá kép theo hợp đồng), kể cả hợp đồng cùng tổ chức', async () => {
    expectBlocked(
      'REPRINT hợp đồng A1, gốc = lần in của hợp đồng A2',
      (await insertPrint(A, A.contract1, { source: `'REPRINT'`, based_on_print_id: uuid(pA1) })).out,
      '23503',
      'contract_prints_based_on_print_id_contract_id_fkey',
    );
    expectBlocked(
      'PRIOR_CONFIG hợp đồng A2, gốc = lần in của tổ chức B',
      (await insertPrint(A, A.contract2, { source: `'PRIOR_CONFIG'`, based_on_print_id: uuid(pB1) })).out,
      '23503',
      'contract_prints_based_on_print_id_contract_id_fkey',
    );
    expectBlocked(
      'REPRINT gốc bịa',
      (await insertPrint(A, A.contract2, { source: `'REPRINT'`, based_on_print_id: uuid(randomUUID()) })).out,
      '23503',
      'contract_prints_based_on_print_id_contract_id_fkey',
    );
    expectAllowed('REPRINT hợp đồng A2, gốc cùng hợp đồng', (await insertPrint(A, A.contract2, { source: `'REPRINT'`, based_on_print_id: uuid(pA1) })).out);
  });

  it('người in bịa → chặn', async () => {
    expectBlocked('printed_by_id bịa', (await insertPrint(A, A.contract2, { printed_by_id: uuid(randomUUID()) })).out, '23503', 'contract_prints_printed_by_id_fkey');
  });

  it('trùng (contract_id, print_no) → chặn; cùng số ở hợp đồng khác → được', async () => {
    expectBlocked('hợp đồng A2 lần in 1 lần nữa', (await insertPrint(A, A.contract2, { print_no: '1' })).out, '23505', 'contract_prints_contract_id_print_no_key');
    expectAllowed('hợp đồng B2 lần in 1', (await insertPrint(B, B.contract2, { print_no: '1' })).out);
  });

  it('xoá mẫu đã có lần in → chặn (RESTRICT)', async () => {
    expectBlocked('DELETE mẫu B', await run(`DELETE FROM "print_templates" WHERE "id" = ${uuid(B.template)}`), '23503', 'contract_prints_template_id_organization_id_fkey');
  });
});

describe('contract_prints — chỉ ghi thêm (trigger contract_prints_append_only)', () => {
  it('UPDATE (kể cả không đổi gì) và DELETE → chặn; dòng còn nguyên', async () => {
    const { id } = await mustOk('lần in để thử bất biến', insertPrint(B, B.contract1));
    const before = await db.$queryRawUnsafe<Array<{ j: string }>>(`SELECT to_jsonb(p)::text AS j FROM "contract_prints" p WHERE "id" = ${uuid(id)}`);
    const sets = [
      `"data_hash" = ${str('b'.repeat(64))}`,
      `"data" = ${json('{"kind":"COURSE"}')}`,
      `"config" = ${json('{"layout":4,"blocks":{}}')}`,
      `"printed_at" = now() - interval '1 day'`,
      `"print_no" = "print_no"`,
    ];
    for (const set of sets) expectBlocked(`UPDATE ${set}`, await run(`UPDATE "contract_prints" SET ${set} WHERE "id" = ${uuid(id)}`), 'P0001', P_UPDATE);
    expectBlocked('DELETE một dòng', await run(`DELETE FROM "contract_prints" WHERE "id" = ${uuid(id)}`), 'P0001', P_DELETE);
    expectBlocked('DELETE cả hợp đồng', await run(`DELETE FROM "contract_prints" WHERE "contract_id" = ${uuid(B.contract1)}`), 'P0001', P_DELETE);
    const after = await db.$queryRawUnsafe<Array<{ j: string }>>(`SELECT to_jsonb(p)::text AS j FROM "contract_prints" p WHERE "id" = ${uuid(id)}`);
    expect(after).toEqual(before);
  });

  it('đổi tổ chức của mẫu đã in → chặn (trigger mẫu in chặn trước khi khoá ngoại dây chuyền chạm nhật ký)', async () => {
    expectBlocked('mẫu A đã in → tổ chức B', await run(`UPDATE "print_templates" SET "organization_id" = ${uuid(B.id)} WHERE "id" = ${uuid(A.template)}`), 'P0001', V_ORG);
  });
});

// ======================================================================================================
// Đoạn SEED của migration — đọc đúng chữ trong migration.sql, chạy trong transaction rồi bỏ.
// ======================================================================================================
describe('đoạn SEED: mẫu mặc định cho tổ chức đã có', () => {
  it('ACADEMY ra 2 mẫu (dịch vụ bố cục 2 + khoá học bố cục 1), INDIVIDUAL / TEAM ra 1; chạy lần hai vẫn vậy; tổ chức đã có mặc định không nhân đôi', async () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    expect(sql.split('-- SEED BEGIN').length - 1, 'đúng một dấu SEED BEGIN').toBe(1);
    expect(sql.split('-- SEED END').length - 1, 'đúng một dấu SEED END').toBe(1);
    const seed = sql.slice(sql.indexOf('-- SEED BEGIN') + '-- SEED BEGIN'.length, sql.indexOf('-- SEED END'));
    const statements = seed
      .split(/;\s*(?:\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s.replace(/--[^\n]*/g, '').trim() !== '');
    expect(statements.length, 'đoạn SEED có hai câu INSERT').toBe(2);

    const academy = randomUUID();
    const individual = randomUUID();
    const team = randomUUID();
    const academyHasService = randomUUID(); // ACADEMY đã có sẵn mặc định dịch vụ (bố cục 4) → chỉ thêm khoá học
    const orgs = [academy, individual, team, academyHasService];
    const kinds = ['ACADEMY', 'INDIVIDUAL', 'TEAM', 'ACADEMY'];
    const list = orgs.map((o) => uuid(o)).join(', ');

    class Rollback extends Error {}
    const snapshots: Array<Record<string, string>> = [];
    const snap = async (tx: { $queryRawUnsafe: typeof db.$queryRawUnsafe }) => {
      const rows = await tx.$queryRawUnsafe<Array<{ org: string; s: string }>>(
        `SELECT o.id::text AS org,
                coalesce(string_agg(p.name || '|' || p.layout || '|' || p.for_service || '|' || p.for_course || '|' ||
                                    p.default_service || '|' || p.default_course || '|' || p.blocks::text || '|' ||
                                    coalesce(p.title, '∅') || coalesce(p.opening_text, '∅') || coalesce(p.closing_text, '∅') || '|' ||
                                    p.version || '|' || p.is_active || '|' || coalesce(p.updated_by_id::text, '∅'),
                                    ' ; ' ORDER BY p.layout DESC, p.name), '') AS s
           FROM organizations o LEFT JOIN print_templates p ON p.organization_id = o.id
          WHERE o.id IN (${list}) GROUP BY o.id`,
      );
      snapshots.push(Object.fromEntries(rows.map((r) => [r.org, r.s])));
    };

    await db
      .$transaction(async (tx) => {
        for (let i = 0; i < orgs.length; i++) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "organizations" ("id", "slug", "name", "kind", "updated_at")
             VALUES (${uuid(orgs[i]!)}, ${str(`g-m1-seed-${tag()}`)}, 'Tổ chức seed', '${kinds[i]}', now())`,
          );
        }
        await tx.$executeRawUnsafe(
          insertSql('print_templates', {
            id: 'gen_random_uuid()',
            organization_id: uuid(academyHasService),
            name: str('Của studio'),
            layout: '4',
            for_service: 'true',
            for_course: 'false',
            default_service: 'true',
            updated_at: 'now()',
          }),
        );
        for (const s of statements) await tx.$executeRawUnsafe(s);
        await snap(tx);
        for (const s of statements) await tx.$executeRawUnsafe(s);
        await snap(tx);
        throw new Rollback();
      })
      .catch((err) => {
        if (!(err instanceof Rollback)) throw err;
      });

    const SERVICE = 'Hiện đại|2|true|false|true|false|{}|∅∅∅|1|true|∅';
    const COURSE = 'Cổ điển có quốc hiệu|1|false|true|false|true|{}|∅∅∅|1|true|∅';
    const want = {
      [academy]: `${SERVICE} ; ${COURSE}`,
      [individual]: SERVICE,
      [team]: SERVICE,
      [academyHasService]: `Của studio|4|true|false|true|false|{}|∅∅∅|1|true|∅ ; ${COURSE}`,
    };
    const rows = (s: string) => (s === '' ? 0 : s.split(' ; ').length);
    console.log(
      `[bản vẽ G — SEED] lần 1: ACADEMY ${rows(snapshots[0]![academy]!)}, INDIVIDUAL ${rows(snapshots[0]![individual]!)}, TEAM ${rows(snapshots[0]![team]!)}, ` +
        `ACADEMY có sẵn mặc định ${rows(snapshots[0]![academyHasService]!)}; lần 2: ${[academy, individual, team, academyHasService].map((o) => rows(snapshots[1]![o]!)).join('/')}`,
    );
    expect(snapshots[0]).toEqual(want);
    expect(snapshots[1]).toEqual(want);
    // Transaction đã bỏ: không còn dấu vết.
    expect(await count(`SELECT count(*) AS n FROM organizations WHERE id IN (${list})`)).toBe(0);
  });
});

// ======================================================================================================
// Danh mục — đủ chốt, đúng định nghĩa (bắt cả chốt lưới thứ hai)
// ======================================================================================================
describe('danh mục — đủ chốt, đúng định nghĩa', () => {
  it('23 CHECK, 7 khoá ngoại, 10 chỉ mục, 2 trigger, enum PrintSource của bản vẽ G', async () => {
    const cons = await db.$queryRawUnsafe<Array<{ conname: string; def: string }>>(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid IN ('print_templates'::regclass, 'contract_prints'::regclass, 'organization_profiles'::regclass) AND contype IN ('c', 'f')`,
    );
    const byCon = new Map(cons.map((c) => [c.conname, c.def]));
    const fk = (cols: string, ref: string) => new RegExp(`^FOREIGN KEY \\(${cols}\\) REFERENCES ${ref} ON UPDATE CASCADE ON DELETE RESTRICT$`);
    const wantCon: Record<string, RegExp> = {
      organization_profiles_representative_name_len: /^CHECK /,
      organization_profiles_representative_title: /^CHECK /,
      organization_profiles_bank_all_or_none: /^CHECK /,
      organization_profiles_bank_name_len: /^CHECK /,
      organization_profiles_bank_account_number_format: /^CHECK /,
      organization_profiles_bank_account_name_len: /^CHECK /,
      print_templates_layout: /^CHECK /,
      print_templates_applies: /^CHECK /,
      print_templates_default_service: /^CHECK /,
      print_templates_default_course: /^CHECK /,
      print_templates_name_len: /^CHECK /,
      print_templates_title_len: /^CHECK /,
      print_templates_opening_len: /^CHECK /,
      print_templates_closing_len: /^CHECK /,
      print_templates_version: /^CHECK /,
      print_templates_blocks_shape: /^CHECK /,
      contract_prints_print_no: /^CHECK /,
      contract_prints_template_version: /^CHECK /,
      contract_prints_data_version: /^CHECK /,
      contract_prints_data_hash: /^CHECK /,
      contract_prints_source_base: /^CHECK /,
      contract_prints_not_self: /^CHECK /,
      contract_prints_snapshot_shape: /^CHECK /,
      print_templates_organization_id_fkey: fk('organization_id', 'organizations\\(id\\)'),
      print_templates_updated_by_id_fkey: fk('updated_by_id', 'users\\(id\\)'),
      contract_prints_organization_id_fkey: fk('organization_id', 'organizations\\(id\\)'),
      contract_prints_contract_id_organization_id_fkey: fk('contract_id, organization_id', 'contracts\\(id, organization_id\\)'),
      contract_prints_template_id_organization_id_fkey: fk('template_id, organization_id', 'print_templates\\(id, organization_id\\)'),
      contract_prints_based_on_print_id_contract_id_fkey: fk('based_on_print_id, contract_id', 'contract_prints\\(id, contract_id\\)'),
      contract_prints_printed_by_id_fkey: fk('printed_by_id', 'users\\(id\\)'),
    };
    const badCon = Object.keys(wantCon).filter((n) => !wantCon[n]!.test(byCon.get(n) ?? ''));
    // Chốt NULL (sổ lỗi 24): CHECK đọc cột cho phép NULL phải viết rõ IS NULL / IS NOT NULL; biểu thức JSON phải bọc COALESCE.
    const nullGuards: Record<string, string[]> = {
      organization_profiles_representative_name_len: ['representative_name IS NULL'],
      organization_profiles_representative_title: ['representative_title IS NULL', 'representative_name IS NOT NULL'],
      organization_profiles_bank_all_or_none: [
        'bank_name IS NULL',
        'bank_account_number IS NULL',
        'bank_account_name IS NULL',
        'bank_name IS NOT NULL',
        'bank_account_number IS NOT NULL',
        'bank_account_name IS NOT NULL',
      ],
      organization_profiles_bank_name_len: ['bank_name IS NULL'],
      organization_profiles_bank_account_number_format: ['bank_account_number IS NULL'],
      organization_profiles_bank_account_name_len: ['bank_account_name IS NULL'],
      print_templates_title_len: ['title IS NULL'],
      print_templates_opening_len: ['opening_text IS NULL'],
      print_templates_closing_len: ['closing_text IS NULL'],
      contract_prints_source_base: ['based_on_print_id IS NULL', 'based_on_print_id IS NOT NULL'],
      contract_prints_not_self: ['based_on_print_id IS NULL'],
      contract_prints_snapshot_shape: ["COALESCE((config ->> 'layout'::text), ''::text)", "COALESCE(jsonb_typeof((config -> 'blocks'::text)), ''::text)", "COALESCE((data ->> 'kind'::text), ''::text)"],
    };
    const missingGuards = Object.entries(nullGuards).flatMap(([n, gs]) => gs.filter((g) => !(byCon.get(n) ?? '').includes(g)).map((g) => `${n}: ${g}`));

    const wantIdx: Record<string, RegExp> = {
      print_templates_pkey: /^CREATE UNIQUE INDEX print_templates_pkey ON public\.print_templates USING btree \(id\)$/,
      print_templates_id_organization_id_key: /^CREATE UNIQUE INDEX print_templates_id_organization_id_key ON public\.print_templates USING btree \(id, organization_id\)$/,
      print_templates_organization_id_idx: /^CREATE INDEX print_templates_organization_id_idx ON public\.print_templates USING btree \(organization_id\)$/,
      print_templates_one_default_service: /^CREATE UNIQUE INDEX print_templates_one_default_service ON public\.print_templates USING btree \(organization_id\) WHERE default_service$/,
      print_templates_one_default_course: /^CREATE UNIQUE INDEX print_templates_one_default_course ON public\.print_templates USING btree \(organization_id\) WHERE default_course$/,
      contract_prints_pkey: /^CREATE UNIQUE INDEX contract_prints_pkey ON public\.contract_prints USING btree \(id\)$/,
      contract_prints_id_organization_id_key: /^CREATE UNIQUE INDEX contract_prints_id_organization_id_key ON public\.contract_prints USING btree \(id, organization_id\)$/,
      contract_prints_id_contract_id_key: /^CREATE UNIQUE INDEX contract_prints_id_contract_id_key ON public\.contract_prints USING btree \(id, contract_id\)$/,
      contract_prints_contract_id_print_no_key: /^CREATE UNIQUE INDEX contract_prints_contract_id_print_no_key ON public\.contract_prints USING btree \(contract_id, print_no\)$/,
      contract_prints_organization_id_template_id_idx:
        /^CREATE INDEX contract_prints_organization_id_template_id_idx ON public\.contract_prints USING btree \(organization_id, template_id\)$/,
    };
    const idx = await db.$queryRawUnsafe<Array<{ indexname: string; indexdef: string }>>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('print_templates', 'contract_prints')`,
    );
    const byIdx = new Map(idx.map((r) => [r.indexname, r.indexdef]));
    const badIdx = Object.keys(wantIdx).filter((n) => !wantIdx[n]!.test(byIdx.get(n) ?? ''));
    const extraIdx = [...byIdx.keys()].filter((n) => !(n in wantIdx));

    const triggers = await db.$queryRawUnsafe<Array<{ t: string }>>(
      `SELECT c.relname || '.' || t.tgname || ' ' ||
              CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END || ' ' ||
              concat_ws('/', CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' END, CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE' END,
                             CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE' END) ||
              CASE WHEN t.tgtype & 1 = 1 THEN ' ROW' ELSE ' STATEMENT' END ||
              CASE WHEN t.tgenabled = 'O' THEN '' ELSE ' (TẮT)' END AS t
         FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        WHERE NOT t.tgisinternal AND c.relname IN ('print_templates', 'contract_prints') ORDER BY 1`,
    );
    const enumVals = await db.$queryRawUnsafe<Array<{ v: string }>>(
      `SELECT e.enumlabel AS v FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'PrintSource' ORDER BY e.enumsortorder`,
    );

    const total = Object.keys(wantCon).length + Object.keys(wantIdx).length;
    const bad = [...badCon, ...badIdx];
    const guards = Object.values(nullGuards).flat().length;
    console.log(
      `[bản vẽ G — danh mục] chốt + chỉ mục đúng ${total - bad.length}/${total}${bad.length ? `; THIẾU/SAI: ${bad.join(', ')}` : ''}; ` +
        `vế NULL / COALESCE viết rõ ${guards - missingGuards.length}/${guards}; trigger ${triggers.length}/2`,
    );
    expect(bad).toEqual([]);
    expect(extraIdx).toEqual([]);
    expect(missingGuards).toEqual([]);
    expect(triggers.map((t) => t.t)).toEqual([
      'contract_prints.contract_prints_append_only BEFORE DELETE/UPDATE ROW',
      'print_templates.print_templates_version_guard BEFORE UPDATE ROW',
    ]);
    expect(enumVals.map((e) => e.v)).toEqual(['TEMPLATE', 'PRIOR_CONFIG', 'REPRINT']);
  });
});
