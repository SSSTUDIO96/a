// Tên đường dẫn tổ chức giữ chỗ cho trang của web (thợ K6, phiếu vướng 2 của K1).
// Web dùng /:orgSlug/... nên tên trang web không được thành đường dẫn tổ chức. Web chặn sớm (validate.ts), máy chủ là cửa
// thật — tổ chức tạo thẳng qua API cũng không được chiếm tên trang. Bài thử nạp CẢ HAI danh sách và đối chiếu.
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { RESERVED_SLUGS as WEB_RESERVED } from '../../web/src/features/auth/validate';
import { RESERVED_SLUGS as API_RESERVED } from '../src/modules/orgs/routes';
import { makeApp, makeDeps, registerUser } from './helpers';

const deps = makeDeps();
const app = makeApp(deps);
afterAll(async () => {
  await deps.db.$disconnect();
});

// Máy chủ chặn thêm những tên này mà web CHƯA chặn sớm (web chỉ báo lỗi muộn — sau khi máy chủ trả 400, không phải lỗ).
// Ghim cứng để lệch thêm ở BẤT KỲ phía nào cũng đỏ. Web bổ sung các tên này vào validate.ts thì xoá khỏi đây.
const SERVER_ONLY = ['admin', 'quan-tri', 'www', 'app', 'static', 'assets', 'trang'];

describe('danh sách tên giữ chỗ: web và máy chủ', () => {
  it('máy chủ giữ chỗ quen-mat-khau và dat-lai-mat-khau', () => {
    expect(API_RESERVED.has('quen-mat-khau')).toBe(true);
    expect(API_RESERVED.has('dat-lai-mat-khau')).toBe(true);
  });

  it('MỌI tên web chặn thì máy chủ cũng chặn (web ⊆ máy chủ)', () => {
    expect([...WEB_RESERVED].filter((s) => !API_RESERVED.has(s))).toEqual([]);
  });

  it('phần máy chủ chặn thêm đúng bằng danh sách đã ghim', () => {
    expect([...API_RESERVED].filter((s) => !WEB_RESERVED.has(s)).sort()).toEqual([...SERVER_ONLY].sort());
  });

  it('tạo tổ chức với tên trang quên / đặt lại mật khẩu → 400 (kể cả viết hoa, có khoảng trắng)', async () => {
    const u = await registerUser(app, 'k6-slug');
    for (const slug of ['quen-mat-khau', 'dat-lai-mat-khau', ' Quen-Mat-Khau ']) {
      const res = await request(app)
        .post('/api/v1/orgs')
        .set('authorization', `Bearer ${u.accessToken}`)
        .send({ name: 'Tổ chức thử', slug, kind: 'TEAM' });
      expect(res.status, slug).toBe(400);
      expect(JSON.stringify(res.body.error.details)).toMatch(/trùng tên trang/);
    }
  });
});
