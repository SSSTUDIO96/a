// Thợ chấm: dựng người và tổ chức qua API thật (cổng 4120). Bảng giá, khách, hợp đồng làm bằng giao diện.
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const API = 'http://localhost:4120/api/v1';
const PW = 'ChamWeb2#2026';
async function call(method, path, body, token, idem) {
  const h = { 'content-type': 'application/json' };
  if (token) h.authorization = `Bearer ${token}`;
  if (idem) h['idempotency-key'] = randomUUID();
  const r = await fetch(API + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}
const tag = Date.now().toString(36);
const people = [
  ['owner', 'Chiến Chủ Studio', 'owner'],
  ['ha', 'Nguyễn Thu Hà', 'artist'],
  ['linh', 'Trần Khánh Linh', 'artist'],
  ['my', 'Lê Hoàng Diễm My', 'artist'],
  ['tu', 'Phạm Thanh Tú', 'assistant'],
  ['letan', 'Đỗ Lễ Tân', 'receptionist'],
  ['ketoan', 'Vũ Kế Toán', 'accountant'],
];
const out = { tag, password: PW, users: {} };
for (const [k, name] of people) {
  const email = `${k}.${tag}@cham.vn`;
  const r = await call('POST', '/auth/register', { email, password: PW, fullName: name });
  out.users[k] = { email, name, token: r.accessToken };
}
const org = await call('POST', '/orgs', { name: 'Studio Chấm Web 2', slug: `cham-${tag}`, kind: 'TEAM' }, out.users.owner.token, true);
out.org = { id: org.id ?? org.organization?.id, slug: org.slug ?? org.organization?.slug };
const oid = out.org.id;
const tok = out.users.owner.token;
for (const [k, , role] of people.slice(1)) {
  const m = await call('POST', `/orgs/${oid}/members`, { email: out.users[k].email, roleKeys: [role] }, tok);
  out.users[k].membershipId = m.id ?? m.membershipId;
}
const tiers = {};
for (const n of ['Thợ chính bậc 1', 'Thợ chính bậc 2', 'Thợ phụ']) {
  const t = await call('POST', `/orgs/${oid}/staff-tiers`, { name: n }, tok, true);
  tiers[n] = t.id;
}
out.tiers = tiers;
const staff = await call('GET', `/orgs/${oid}/staff`, null, tok);
out.staff = staff.items.map((s) => ({ membershipId: s.membershipId, name: s.displayName ?? s.fullName }));
const assign = { ha: 'Thợ chính bậc 1', linh: 'Thợ chính bậc 1', my: 'Thợ chính bậc 2', tu: 'Thợ phụ' };
for (const [k, t] of Object.entries(assign)) {
  await call('PATCH', `/orgs/${oid}/staff/${out.users[k].membershipId}`, { tierId: tiers[t] }, tok);
}
writeFileSync(new URL('./seed.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ org: out.org, staff: out.staff, users: Object.fromEntries(Object.entries(out.users).map(([k, v]) => [k, v.email])) }, null, 2));
