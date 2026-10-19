import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { BrandProfile, ServicePackage } from '../../api/types';
import { draftToSite } from '../brand/draftToSite';
import { draftFromProfile } from '../brand/model';
import { groupPackages } from './format';
import { SiteView, type SiteViewData } from './SiteView';

// R1 (biên bản nghiệm thu lần 3): gói của nhân vật đang ẩn KHÔNG hiện trên trang giới thiệu — không ở nhóm nhân vật,
// cũng KHÔNG rơi vào "Gói khác". "Gói khác" chỉ dành cho gói không gắn nhân vật. Cùng luật cho trang thật
// (/trang/:slug) và khung "Xem trước" ở màn Thương hiệu (draftToSite, dựng từ GET /packages có cả gói của nhân vật ẩn).

afterEach(cleanup);

const T = '2026-10-18T00:00:00.000Z';
const ACTIVE = [
  { id: 's1', name: 'Cô dâu' },
  { id: 's3', name: 'Phù dâu' },
];

describe('groupPackages — nhóm gói trên trang', () => {
  const pk = (id: string, subject: { id: string; name: string } | null) => ({ id, subject });

  it('BẮT: gói có nhân vật không trong danh sách nhân vật đang dùng → bỏ hẳn, không vào "Gói khác"', () => {
    const groups = groupPackages([pk('p1', { id: 's1', name: 'Cô dâu' }), pk('pAn', { id: 's2', name: 'Mẹ cô dâu' })], ACTIVE);
    expect(groups.map((g) => g.title)).toEqual(['Cô dâu']);
    expect(groups.flatMap((g) => g.packages.map((p) => p.id))).toEqual(['p1']);
  });

  it('GIỮ: gói không gắn nhân vật vẫn vào "Gói khác" cuối; thứ tự nhóm theo danh sách nhân vật', () => {
    const groups = groupPackages(
      [pk('pLe', null), pk('pPhu', { id: 's3', name: 'Phù dâu' }), pk('pAn', { id: 's2', name: 'Mẹ cô dâu' }), pk('pCd', { id: 's1', name: 'Cô dâu' })],
      ACTIVE,
    );
    expect(groups.map((g) => [g.title, g.packages.map((p) => p.id)])).toEqual([
      ['Cô dâu', ['pCd']],
      ['Phù dâu', ['pPhu']],
      ['Gói khác', ['pLe']],
    ]);
  });
});

// ---- Trang thật: SiteView nhận đúng dữ liệu GET /public/sites/:slug (PublicSitePage gán thẳng state.site) ----
const pr = (listPrice: number) => ({ listPrice, salePrice: null, unitPrice: listPrice });
const basePkg = { durationMinutes: 60, locationTypes: ['STUDIO' as const], includedKm: null, included: [], addons: [] };
const PROFILE_VIEW: SiteViewData['profile'] = {
  brandName: 'Studio Chiến Makeup',
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
  instagram: null,
  tiktok: null,
  website: null,
  workingHours: [],
  bookingPolicy: null,
  cancellationPolicy: null,
  depositPolicy: null,
  logo: null,
  avatar: null,
  cover: null,
};

describe('Trang công khai — gói của nhân vật ẩn', () => {
  it('BẮT: dữ liệu có gói của nhân vật không còn trong danh sách (bản lưu đệm cũ) → không thẻ, không giá, không "Gói khác"', () => {
    const data: SiteViewData = {
      profile: PROFILE_VIEW,
      services: [],
      subjects: [{ id: 's1', name: 'Cô dâu' }],
      packages: [
        { ...basePkg, id: 'p1', name: 'Cô dâu – Ngày cưới', subject: { id: 's1', name: 'Cô dâu' }, price: pr(3_000_000) },
        { ...basePkg, id: 'pAn', name: 'Mẹ cô dâu', subject: { id: 's2', name: 'Mẹ cô dâu' }, price: pr(800_000) },
      ],
    };
    render(<SiteView data={data} />);
    expect(screen.getByRole('heading', { name: 'Cô dâu – Ngày cưới' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Mẹ cô dâu' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Gói khác' })).toBeNull();
    expect(document.body.textContent).not.toContain('800.000');
  });

  it('BẮT: chỉ còn gói của nhân vật ẩn → không hiện mục "Bảng giá" rỗng', () => {
    const data: SiteViewData = {
      profile: PROFILE_VIEW,
      services: [],
      subjects: [],
      packages: [{ ...basePkg, id: 'pAn', name: 'Mẹ cô dâu', subject: { id: 's2', name: 'Mẹ cô dâu' }, price: pr(800_000) }],
    };
    render(<SiteView data={data} />);
    expect(screen.queryByRole('heading', { name: 'Bảng giá' })).toBeNull();
    expect(document.body.textContent).not.toContain('800.000');
  });
});

// ---- Khung "Xem trước" ở màn Thương hiệu: dựng bằng draftToSite từ GET /packages + nhân vật đang dùng ----
const PROFILE: BrandProfile = {
  ...PROFILE_VIEW,
  brandName: 'Studio Chiến Makeup',
  logoFileId: null,
  avatarFileId: null,
  coverFileId: null,
  isPublished: true,
  publishedAt: T,
  updatedAt: T,
  logo: null,
  avatar: null,
  cover: null,
};
const price = (l: number) => ({ priceVersionId: 'v', listPrice: l, salePrice: null, unitPrice: l, effectiveFrom: T });
const mkPkg = (id: string, name: string, subject: { id: string; name: string; isActive: boolean } | null, l: number) =>
  ({
    id,
    code: `G-${id}`,
    name,
    description: null,
    durationMinutes: 60,
    staffCount: 1,
    depositAmount: 0,
    subjectId: subject?.id ?? null,
    locationTypes: ['STUDIO'],
    includedKm: null,
    terms: null,
    isActive: true,
    isPublic: true,
    sortOrder: 0,
    createdAt: T,
    updatedAt: T,
    subject,
    items: [],
    currentPrice: price(l),
  }) as unknown as ServicePackage;

describe('Xem trước (draftToSite) — cùng luật với trang thật', () => {
  const packages = [
    mkPkg('p1', 'Cô dâu – Ngày cưới', { id: 's1', name: 'Cô dâu', isActive: true }, 3_000_000),
    // GET /packages trả cả gói của nhân vật đã ẩn (gói vẫn "đang bán" + "hiện trên trang").
    mkPkg('pAn', 'Mẹ cô dâu', { id: 's2', name: 'Mẹ cô dâu', isActive: false }, 800_000),
    mkPkg('pLe', 'Makeup kỷ yếu', null, 500_000),
  ];

  it('BẮT + GIỮ: gói của nhân vật ẩn không hiện; gói không nhân vật vẫn ở "Gói khác"; gói nhân vật đang dùng ở nhóm của nó', () => {
    // useProfileDraft gọi listMakeupSubjects({ isActive: true }) → danh sách chỉ có nhân vật đang dùng.
    const site = draftToSite(draftFromProfile(PROFILE), { packages, subjects: [{ id: 's1', name: 'Cô dâu' }], freeKm: null });
    render(<SiteView data={site} embedded />);
    const groups = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
    expect(groups).toEqual(['Cô dâu', 'Gói khác']);
    expect(screen.queryByRole('heading', { name: 'Mẹ cô dâu' })).toBeNull();
    expect(document.body.textContent).not.toContain('800.000');
    const other = screen.getByRole('heading', { name: 'Makeup kỷ yếu' }).closest('article')!;
    expect(within(other).getByText('500.000 ₫', { exact: false })).toBeTruthy();
  });
});
