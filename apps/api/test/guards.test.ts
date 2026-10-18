import { describe, expect, it } from 'vitest';
import { defineRoute } from '../src/http/route';

describe('khai báo đường API sai thì máy chủ không khởi động', () => {
  it('đường thuộc tổ chức mà không khai quyền → ném lỗi', () => {
    expect(() =>
      defineRoute({ method: 'get', path: '/orgs/:orgId/x', scope: 'org', tag: 't', summary: 's', handler: async () => ({}) }),
    ).toThrow(/không khai quyền/);
  });
  it('đường thuộc tổ chức không nằm dưới /orgs/:orgId → ném lỗi', () => {
    expect(() =>
      defineRoute({ method: 'get', path: '/x', scope: 'org', permission: 'org.read', tag: 't', summary: 's', handler: async () => ({}) }),
    ).toThrow(/phải bắt đầu/);
  });
  it('đường công khai mà khai quyền → ném lỗi', () => {
    expect(() =>
      defineRoute({ method: 'get', path: '/x', scope: 'public', permission: 'org.read', tag: 't', summary: 's', handler: async () => ({}) }),
    ).toThrow(/không thuộc tổ chức/);
  });
});

describe('đường quản trị nền tảng', () => {
  it('đường dưới /platform/ phải khai scope "platform"; scope platform không nhận quyền tổ chức', () => {
    expect(() =>
      defineRoute({ method: 'get', path: '/platform/x', scope: 'auth', tag: 't', summary: 's', handler: async () => ({}) }),
    ).toThrow(/phải khai scope "platform"/);
    expect(() =>
      defineRoute({ method: 'get', path: '/platform/x', scope: 'platform', permission: 'org.read', tag: 't', summary: 's', handler: async () => ({}) }),
    ).toThrow(/không khai quyền tổ chức/);
    expect(() =>
      defineRoute({ method: 'get', path: '/khac', scope: 'platform', tag: 't', summary: 's', handler: async () => ({}) }),
    ).toThrow(/phải bắt đầu bằng \/platform\//);
  });
});
