import { seed } from './h.mjs';
export async function api(method, path, body, user = 'owner') {
  // thẻ trong seed có thể hết hạn → đăng nhập lại lấy thẻ mới
  const login = await fetch('http://localhost:4120/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: seed.users[user].email, password: seed.password }) }).then((r) => r.json());
  const r = await fetch(`http://localhost:4120/api/v1/orgs/${seed.org.id}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${login.accessToken}`, 'idempotency-key': crypto.randomUUID() }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  return { status: r.status, body: t ? JSON.parse(t) : null };
}
export const vnd = (n) => n == null ? '—' : new Intl.NumberFormat('vi-VN').format(n).replace(/,/g, '.') + ' ₫';
