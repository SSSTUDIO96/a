import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app/routes';
import type { PublicSite } from '../../api/types';

// Trang giới thiệu công khai /trang/:slug — máy chủ giả lập qua fetch, KHÔNG có phiên đăng nhập.
configure({ asyncUtilTimeout: 5000 });

const T = '2026-10-12T03:00:00.000Z';
const pr = (listPrice: number, salePrice: number | null = null) => ({ listPrice, salePrice, unitPrice: salePrice ?? listPrice });

const FULL: PublicSite = {
  site: { name: 'Studio Chiến', slug: 'studio-chien', timezone: 'Asia/Ho_Chi_Minh' },
  profile: {
    brandName: 'Studio Chiến Makeup',
    tagline: 'Trang điểm cô dâu tự nhiên, bền đẹp suốt ngày cưới',
    bio: 'Studio Chiến chuyên trang điểm cô dâu.',
    experience: 'Hơn 9 năm trang điểm cưới.',
    styles: ['Tự nhiên', 'Hàn Quốc'],
    serviceArea: 'Nội thành Hà Nội',
    address: '25 Hoàng Quốc Việt, Cầu Giấy, Hà Nội',
    phone: '0903112233',
    email: 'studiochien@gmail.com',
    zalo: '0903112233',
    facebook: 'https://facebook.com/studiochien',
    instagram: null,
    tiktok: 'https://tiktok.com/@studiochien',
    website: null,
    workingHours: [
      { weekday: 1, open: '08:00', close: '12:00' },
      { weekday: 1, open: '13:30', close: '20:00' },
      { weekday: 6, open: '04:00', close: '21:00' },
    ],
    bookingPolicy: 'Đặt lịch trước ít nhất 7 ngày.',
    cancellationPolicy: null,
    depositPolicy: 'Cọc 30% khi chốt lịch.',
    publishedAt: T,
    logo: { url: 'data:image/png;base64,iVBORw0KGgo=', expiresAt: T },
    avatar: null,
    cover: { url: 'data:image/png;base64,iVBORw0KGgo=', expiresAt: T },
  },
  services: [{ id: 'sv1', kind: 'MAIN', name: 'Makeup dự tiệc', description: null, durationMinutes: 60, category: null, price: pr(450_000) }],
  packages: [
    {
      id: 'p1',
      name: 'Cô dâu – Ngày cưới',
      description: null,
      durationMinutes: 150,
      staffCount: 1,
      subject: { id: 's1', name: 'Cô dâu' },
      locationTypes: ['STUDIO', 'CUSTOMER_HOME', 'OTHER'],
      includedKm: 3,
      terms: null,
      price: pr(3_000_000, 2_700_000),
      included: [{ name: 'Makeup cô dâu', quantity: 1 }],
      addons: [{ serviceId: 'nail', name: 'Làm nail', durationMinutes: 30, quantity: 1, price: pr(250_000) }],
    },
    {
      id: 'p2',
      name: 'Phù dâu',
      description: null,
      durationMinutes: 40,
      staffCount: 1,
      subject: null,
      locationTypes: ['STUDIO'],
      includedKm: 3,
      terms: null,
      price: null,
      included: [],
      addons: [],
    },
  ],
  subjects: [{ id: 's1', name: 'Cô dâu' }],
  travel: { freeKm: 3 },
};

const MINIMAL: PublicSite = {
  ...FULL,
  profile: {
    ...FULL.profile,
    tagline: null,
    bio: null,
    experience: null,
    styles: [],
    serviceArea: null,
    address: null,
    phone: null,
    email: null,
    zalo: null,
    facebook: null,
    tiktok: null,
    workingHours: [],
    bookingPolicy: null,
    depositPolicy: null,
    logo: null,
    cover: null,
  },
  services: [],
  packages: [],
};

interface Seen {
  path: string;
  headers: Record<string, string>;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function setup(respond: (slug: string) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://localhost');
      const path = url.pathname.replace('/api/v1', '');
      seen.push({ path, headers: { ...(init?.headers as Record<string, string>) } });
      const m = /^\/public\/sites\/([^/]+)$/.exec(path);
      if (m && m[1]) return respond(decodeURIComponent(m[1]));
      return json(404, { error: { code: 'NOT_FOUND', message: `Không có đường ${path}`, requestId: 'r' } });
    }),
  );
  return seen;
}

const NOT_FOUND = () => json(404, { error: { code: 'NOT_FOUND', message: 'Không tìm thấy trang giới thiệu', requestId: 'r' } });

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.title = '';
  document.querySelector('meta[name="description"]')?.remove();
});

describe('Trang giới thiệu công khai', () => {
  it('đủ dữ liệu: tên, thẻ title + mô tả theo thương hiệu, bảng giá nhóm theo nhân vật, giá gạch, "Liên hệ", km miễn phí', async () => {
    const seen = setup((slug) => (slug === 'studio-chien' ? json(200, FULL) : NOT_FOUND()));
    renderAt('/trang/studio-chien');
    expect(await screen.findByRole('heading', { level: 1, name: 'Studio Chiến Makeup' })).toBeTruthy();
    // Tiêu đề và mô tả được đặt trong useEffect, chạy SAU khi chữ đã hiện (React dồn effect sang nhịp sau) → phải chờ.
    await waitFor(() => expect(document.title).toBe('Studio Chiến Makeup'));
    await waitFor(() =>
      expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Trang điểm cô dâu tự nhiên, bền đẹp suốt ngày cưới'),
    );
    // Không gửi thẻ đăng nhập, không gọi /auth.
    expect(seen.every((s) => !s.path.startsWith('/auth'))).toBe(true);
    expect(seen[0]?.headers.Authorization).toBeUndefined();

    const call = screen.getByRole('link', { name: 'Gọi 0903 112 233' });
    expect(call.getAttribute('href')).toBe('tel:0903112233');
    expect(screen.getByRole('link', { name: 'Nhắn Zalo' }).getAttribute('href')).toBe('https://zalo.me/0903112233');

    const card = screen.getByRole('heading', { name: 'Cô dâu – Ngày cưới' }).closest('article')!;
    expect(within(card).getByText('2.700.000 ₫', { exact: false })).toBeTruthy();
    expect(within(card).getByText('3.000.000 ₫').tagName).toBe('DEL');
    expect(card.textContent).toContain('2 giờ 30 phút · Studio · Tại nhà · Nơi khác');
    expect(card.textContent).toContain('✓ Makeup cô dâu × 1');
    expect(card.textContent).toContain('Miễn phí di chuyển trong 3 km');
    expect(card.textContent).toContain('+ Làm nail 250.000 ₫');
    // Gói chỉ làm ở studio: không có dòng km; chưa có giá → "Liên hệ"; không nhân vật → "Gói khác" cuối.
    const pd = screen.getByRole('heading', { name: 'Phù dâu' }).closest('article')!;
    expect(pd.textContent).not.toContain('km');
    expect(within(pd).getByText('Liên hệ')).toBeTruthy();
    const groups = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(groups).toEqual(['Cô dâu', 'Gói khác', 'Dịch vụ lẻ']);
    expect(screen.getByText('Makeup dự tiệc')).toBeTruthy();

    // Giờ làm việc: thứ không có ca → "Nghỉ".
    expect(screen.getByText('08:00–12:00, 13:30–20:00')).toBeTruthy();
    expect(screen.getAllByText('Nghỉ')).toHaveLength(5);
    expect(screen.getByRole('heading', { name: 'Chính sách' })).toBeTruthy();
    expect(screen.queryByText('Huỷ lịch')).toBeNull();
    expect(screen.getByRole('link', { name: 'Facebook' }).getAttribute('href')).toBe('https://facebook.com/studiochien');
    expect(screen.queryByRole('link', { name: 'Instagram' })).toBeNull();
    // Không lộ dữ liệu nội bộ.
    expect(document.body.textContent).not.toMatch(/G-CD|publishedAt|depositAmount|12\/10\/2026/);
  });

  it('ít dữ liệu: ô trống thì ẩn cả mục (không Bảng giá, Giờ làm việc, Chính sách, Liên hệ, nút Gọi)', async () => {
    setup(() => json(200, MINIMAL));
    renderAt('/trang/studio-chien');
    expect(await screen.findByRole('heading', { level: 1, name: 'Studio Chiến Makeup' })).toBeTruthy();
    for (const h of ['Bảng giá', 'Giới thiệu', 'Giờ làm việc', 'Chính sách', 'Liên hệ']) expect(screen.queryByRole('heading', { name: h })).toBeNull();
    expect(screen.queryByRole('link', { name: /Gọi/ })).toBeNull();
    expect(screen.getByText('Trang tạo bằng Makeup Pro')).toBeTruthy();
    expect(document.querySelector('meta[name="description"]')).toBeNull();
  });

  it('404 (slug bịa / chưa xuất bản / bị khoá — máy chủ trả cùng một lỗi) → cùng một màn "Không tìm thấy trang giới thiệu"', async () => {
    setup(NOT_FOUND);
    renderAt('/trang/khong-co-that');
    expect(await screen.findByRole('heading', { name: 'Không tìm thấy trang giới thiệu' })).toBeTruthy();
    expect(screen.getByText('Liên kết có thể sai, hoặc studio đã gỡ trang.')).toBeTruthy();
    // Từng chập chờn (biên bản cuối L10): findByRole trả về ngay khi chữ vừa vào DOM, còn useDocumentMeta đổi tiêu đề trong
    // useEffect — React chạy effect ở nhịp sau; máy bận thì nhịp đó tới sau lần kiểm → '' . Chờ đúng điều kiện, không nới.
    await waitFor(() => expect(document.title).toBe('Không tìm thấy trang giới thiệu'));
    // Không có nút đăng nhập hay khung app.
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('mất mạng → báo lỗi + Thử lại (không giả là "Không tìm thấy")', async () => {
    let n = 0;
    setup(() => {
      n += 1;
      if (n === 1) throw new TypeError('Failed to fetch');
      return json(200, FULL);
    });
    renderAt('/trang/studio-chien');
    expect(await screen.findByRole('heading', { name: 'Không tải được trang giới thiệu' })).toBeTruthy();
    expect(screen.queryByText('Không tìm thấy trang giới thiệu')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Studio Chiến Makeup' })).toBeTruthy());
  });
});
