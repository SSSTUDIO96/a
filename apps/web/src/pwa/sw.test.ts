// Bài thử service worker public/sw.js: nạp tệp THẬT trong node:vm với self/caches/fetch giả (bản vẽ E mục 6.4).
// Chứng minh chiến lược đệm: /api/** không bao giờ bị chạm, HTML không bị đệm, chỉ /assets/** (mã có mã băm) và /offline.html nằm trong cache.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

const SW_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'sw.js');
const SW_SOURCE = readFileSync(SW_PATH, 'utf8');
const ORIGIN = 'https://app.example.test';

type Handler = (e: unknown) => void;
interface FakeResponse { ok: boolean; body: string; clone: () => FakeResponse }
const resp = (body: string, ok = true): FakeResponse => {
  const r: FakeResponse = { ok, body, clone: () => resp(body, ok) };
  return r;
};

function setup(online = true) {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, FakeResponse>>(); // tên cache → (url → phản hồi)
  const log = { fetches: [] as string[], puts: [] as string[], opened: [] as string[], deleted: [] as string[], skipWaiting: 0, claim: 0 };
  const state = { online, ok: true };

  const keyOf = (req: string | { url: string }) => (typeof req === 'string' ? new URL(req, ORIGIN).href : req.url);
  const makeCache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      add: async (url: string) => { store.set(keyOf(url), resp('OFFLINE-PAGE')); },
      put: async (req: { url: string }, res: FakeResponse) => { log.puts.push(req.url); store.set(req.url, res); },
      match: async (req: string | { url: string }) => store.get(keyOf(req)),
    };
  };
  const caches = {
    open: async (name: string) => { log.opened.push(name); return makeCache(name); },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => { log.deleted.push(name); return stores.delete(name); },
    match: async (req: string | { url: string }) => {
      for (const s of stores.values()) { const hit = s.get(keyOf(req)); if (hit) return hit; }
      return undefined;
    },
  };
  const fakeFetch = async (req: { url: string }) => {
    log.fetches.push(req.url);
    if (!state.online) throw new TypeError('Failed to fetch');
    return resp(`NET:${req.url}`, state.ok);
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => { handlers[type] = fn; },
    skipWaiting: () => { log.skipWaiting += 1; },
    clients: { claim: () => { log.claim += 1; } },
  };
  vm.runInNewContext(SW_SOURCE, { self, caches, fetch: fakeFetch, URL, Promise, TypeError }, { filename: SW_PATH });

  /** Bắn sự kiện fetch; trả null nếu service worker KHÔNG gọi respondWith (trình duyệt tự xử lý như bình thường). */
  async function fire(path: string, init: { method?: string; mode?: string; origin?: string } = {}) {
    let responded: Promise<FakeResponse> | null = null;
    const request = { url: new URL(path, init.origin ?? ORIGIN).href, method: init.method ?? 'GET', mode: init.mode ?? 'cors' };
    handlers.fetch!({ request, respondWith: (p: Promise<FakeResponse>) => { responded = Promise.resolve(p); } });
    return responded ? await responded : null;
  }
  async function lifecycle(type: 'install' | 'activate') {
    const waits: Promise<unknown>[] = [];
    handlers[type]!({ waitUntil: (p: Promise<unknown>) => waits.push(Promise.resolve(p)) });
    await Promise.all(waits);
  }
  const cachedUrls = () => [...stores.values()].flatMap((s) => [...s.keys()]);
  return { handlers, stores, log, state, fire, lifecycle, cachedUrls };
}

describe('public/sw.js — service worker tối thiểu', () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => { t = setup(); });

  it('chỉ có ba listener: install, activate, fetch — KHÔNG có push / notificationclick (thông báo đẩy để giai đoạn sau)', () => {
    expect(Object.keys(t.handlers).sort()).toEqual(['activate', 'fetch', 'install']);
    expect(SW_SOURCE).not.toMatch(/addEventListener\(\s*['"](push|notificationclick|sync|periodicsync)['"]/);
  });

  it('install: đệm đúng /offline.html rồi skipWaiting; activate: xoá cache khác phiên bản hiện tại, claim', async () => {
    await t.lifecycle('install');
    expect(t.cachedUrls()).toEqual([`${ORIGIN}/offline.html`]);
    expect(t.log.skipWaiting).toBe(1);
    // cache cũ của phiên bản trước phải bị xoá khi kích hoạt
    t.stores.set('assets-mp-sw-0', new Map([[`${ORIGIN}/assets/cu.js`, resp('cu')]]));
    t.stores.set('du-lieu-khach', new Map([[`${ORIGIN}/api/v1/x`, resp('khach')]]));
    await t.lifecycle('activate');
    expect([...t.stores.keys()]).toEqual(['assets-mp-sw-1']);
    expect(t.log.claim).toBe(1);
  });

  describe('/api/** — KHÔNG BAO GIỜ chạm dữ liệu', () => {
    const apiCases: [string, { method?: string; mode?: string }][] = [
      ['/api/v1/portal/me', {}],
      ['/api/v1/portal/me', { mode: 'navigate' }], // điều hướng thẳng vào địa chỉ API cũng không được đệm/thay bằng trang ngoại tuyến
      ['/api/v1/auth/me', {}],
      ['/api/v1/orgs/abc/customers?search=Lan', {}],
      ['/api/v1/orgs/abc/payments', {}],
      ['/api/v1/portal/session', { method: 'POST' }],
      ['/api/v1/portal/designs/1/image', {}],
      ['/api/', {}],
    ];
    for (const [path, init] of apiCases) {
      it(`${init.method ?? 'GET'} ${path}${init.mode ? ` (${init.mode})` : ''} → không respondWith, không fetch, không mở cache`, async () => {
        await t.lifecycle('install');
        const before = { ...t.log, fetches: [...t.log.fetches], opened: [...t.log.opened] };
        expect(await t.fire(path, init)).toBeNull();
        expect(t.log.fetches).toEqual(before.fetches);
        expect(t.log.opened).toEqual(before.opened);
        expect(t.log.puts).toEqual([]);
      });
    }

    it('cả khi đang mất mạng, /api/** vẫn để trình duyệt tự lỗi (không trả trang ngoại tuyến thay cho JSON)', async () => {
      await t.lifecycle('install');
      t.state.online = false;
      expect(await t.fire('/api/v1/portal/me')).toBeNull();
    });

    it('cả phiên làm việc (API + HTML + mã) xong thì cache chỉ có /offline.html và /assets/**, không có dấu vết /api', async () => {
      await t.lifecycle('install');
      for (const p of ['/api/v1/portal/me', '/api/v1/orgs/o1/customers', '/api/v1/orgs/o1/payments?x=1']) await t.fire(p);
      await t.fire('/api/v1/portal/session', { method: 'POST' });
      await t.fire('/hv', { mode: 'navigate' });
      await t.fire('/o1/khach-hang', { mode: 'navigate' });
      await t.fire('/assets/main-abc.js');
      await t.fire('/assets/main-abc.css');
      const urls = t.cachedUrls().sort();
      expect(urls).toEqual([`${ORIGIN}/assets/main-abc.css`, `${ORIGIN}/assets/main-abc.js`, `${ORIGIN}/offline.html`].sort());
      expect(urls.some((u) => u.includes('/api/'))).toBe(false);
      expect(t.log.fetches.some((u) => u.includes('/api/'))).toBe(false);
    });
  });

  describe('điều hướng (HTML): mạng trước, KHÔNG đệm trang', () => {
    it('có mạng → trả phản hồi mạng, không ghi cache', async () => {
      await t.lifecycle('install');
      const r = await t.fire('/hv', { mode: 'navigate' });
      expect(r?.body).toBe(`NET:${ORIGIN}/hv`);
      expect(t.log.puts).toEqual([]);
      expect(t.cachedUrls()).toEqual([`${ORIGIN}/offline.html`]);
    });
    it('mất mạng → trả /offline.html', async () => {
      await t.lifecycle('install');
      t.state.online = false;
      const r = await t.fire('/o1/lich', { mode: 'navigate' });
      expect(r?.body).toBe('OFFLINE-PAGE');
    });
  });

  describe('/assets/** — cache-first (tệp có mã băm, không đổi)', () => {
    it('lần đầu: lấy mạng và ghi cache; lần sau: lấy từ cache, không gọi mạng nữa (kể cả mất mạng)', async () => {
      await t.lifecycle('install');
      const first = await t.fire('/assets/x-1a2b3c.js');
      expect(first?.body).toBe(`NET:${ORIGIN}/assets/x-1a2b3c.js`);
      expect(t.log.puts).toEqual([`${ORIGIN}/assets/x-1a2b3c.js`]);
      t.log.fetches.length = 0;
      t.state.online = false;
      const second = await t.fire('/assets/x-1a2b3c.js');
      expect(second?.body).toBe(`NET:${ORIGIN}/assets/x-1a2b3c.js`);
      expect(t.log.fetches).toEqual([]);
    });
    it('phản hồi lỗi (404/500) trả về nguyên trạng và không bị ghi vào cache', async () => {
      await t.lifecycle('install');
      t.state.ok = false;
      const r = await t.fire('/assets/khong-co-9z.js');
      expect(r?.ok).toBe(false);
      expect(t.log.puts).toEqual([]);
      expect(t.cachedUrls()).toEqual([`${ORIGIN}/offline.html`]);
    });
  });

  describe('mọi thứ khác → bỏ qua (không respondWith)', () => {
    const ignored: [string, { method?: string; mode?: string; origin?: string }][] = [
      ['/assets/x.js', { method: 'POST' }],
      ['/o1/khach-hang', { method: 'POST', mode: 'navigate' }],
      ['/assets/x.js', { method: 'PUT' }],
      ['/assets/x.js', { origin: 'https://cdn.khac.test' }],
      ['/api/v1/portal/me', { origin: 'https://api.khac.test' }],
      ['/mau/fb-01.html', {}],
      ['/fonts/be-vietnam-pro/be-vietnam-pro-latin-400-normal.woff2', {}],
      ['/icons/icon-192.png', {}],
      ['/manifest.webmanifest', {}],
    ];
    for (const [path, init] of ignored) {
      it(`${init.method ?? 'GET'} ${init.origin ?? ''}${path}`, async () => {
        await t.lifecycle('install');
        expect(await t.fire(path, init)).toBeNull();
        expect(t.log.puts).toEqual([]);
      });
    }
  });
});
