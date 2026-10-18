import { z } from 'zod';
import { defineRoute } from '../../http/route';
import { AppError } from '../../lib/errors';
import { presentPrice, resolveCurrentPrices, type CurrentPrice } from '../catalog/prices';
import { signImages } from './images';
import { parseStoredHours } from './schemas';

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,46})[a-z0-9]$/;

// Slug sai dạng, không có, chưa xuất bản, tổ chức bị khoá: cùng MỘT lỗi — không lộ trang nào có thật.
function siteNotFound(): AppError {
  return new AppError('NOT_FOUND', 'Không tìm thấy trang giới thiệu');
}

// Giá công khai: chỉ số tiền, không lộ mã phiên bản giá nội bộ.
function publicPrice(p: CurrentPrice | undefined) {
  const v = presentPrice(p ?? null);
  return v ? { listPrice: v.listPrice, salePrice: v.salePrice, unitPrice: v.unitPrice } : null;
}

// Website giới thiệu được đọc rất nhiều lần; cho trình duyệt/CDN giữ 60 giây để đỡ tải database.
// Đổi giá/xuất bản sẽ hiện chậm tối đa 60 giây; URL ảnh ký sống 10 phút nên bản lưu đệm vẫn mở được ảnh.
const CACHE_CONTROL = 'public, max-age=60';

export const publicRoutes = [
  defineRoute({
    method: 'get',
    path: '/public/sites/:slug',
    scope: 'public',
    tag: 'Website công khai',
    summary: 'Dữ liệu trang giới thiệu đã xuất bản: hồ sơ, dịch vụ/gói công khai kèm giá hiện hành',
    params: z.object({ slug: z.string() }),
    handler: async ({ req, deps, params }) => {
      const slug = params.slug.toLowerCase();
      if (!SLUG_RE.test(slug)) throw siteNotFound();
      const org = await deps.db.organization.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true, timezone: true, status: true, profile: true },
      });
      if (!org || org.status !== 'ACTIVE' || !org.profile || !org.profile.isPublished) throw siteNotFound();
      const p = org.profile;
      const orgId = org.id;

      const [services, packages, subjects, policy] = await Promise.all([
        deps.db.service.findMany({
          where: { organizationId: orgId, isActive: true, isPublic: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            kind: true,
            name: true,
            description: true,
            durationMinutes: true,
            category: { select: { name: true } },
          },
        }),
        deps.db.servicePackage.findMany({
          where: { organizationId: orgId, isActive: true, isPublic: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            durationMinutes: true,
            staffCount: true,
            locationTypes: true,
            includedKm: true,
            terms: true,
            subject: { select: { id: true, name: true } },
            items: {
              where: { service: { isActive: true } },
              orderBy: [{ service: { sortOrder: 'asc' } }, { service: { name: 'asc' } }],
              select: {
                quantity: true,
                isOptional: true,
                service: { select: { id: true, name: true, durationMinutes: true, isPublic: true } },
              },
            },
          },
        }),
        deps.db.makeupSubject.findMany({
          where: { organizationId: orgId, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
          select: { id: true, name: true },
        }),
        deps.db.travelFeePolicy.findUnique({ where: { organizationId: orgId }, select: { freeKm: true } }),
      ]);

      // Dịch vụ phụ tick thêm chỉ hiện khi bản thân dịch vụ cũng công khai (cùng luật isActive && isPublic).
      const addonIds = packages.flatMap((pk) => pk.items.filter((i) => i.isOptional && i.service.isPublic).map((i) => i.service.id));
      const [servicePrices, packagePrices, image] = await Promise.all([
        resolveCurrentPrices(deps.db, orgId, 'service', [...new Set([...services.map((s) => s.id), ...addonIds])]),
        resolveCurrentPrices(
          deps.db,
          orgId,
          'package',
          packages.map((pk) => pk.id),
        ),
        signImages(deps.db, orgId, [p.logoFileId, p.avatarFileId, p.coverFileId]),
      ]);
      const freeKm = policy ? policy.freeKm.toNumber() : null;

      const res = req.res;
      if (!res) throw new Error('Thiếu đối tượng response trên request — lỗi lắp ráp Express');
      res.setHeader('Cache-Control', CACHE_CONTROL);

      return {
        body: {
          site: { name: org.name, slug: org.slug, timezone: org.timezone },
          profile: {
            brandName: p.brandName,
            tagline: p.tagline,
            bio: p.bio,
            experience: p.experience,
            styles: p.styles,
            serviceArea: p.serviceArea,
            address: p.address,
            phone: p.phone,
            email: p.email,
            zalo: p.zalo,
            facebook: p.facebook,
            instagram: p.instagram,
            tiktok: p.tiktok,
            website: p.website,
            workingHours: parseStoredHours(p.workingHours),
            bookingPolicy: p.bookingPolicy,
            cancellationPolicy: p.cancellationPolicy,
            depositPolicy: p.depositPolicy,
            publishedAt: p.publishedAt,
            logo: image(p.logoFileId),
            avatar: image(p.avatarFileId),
            cover: image(p.coverFileId),
          },
          services: services.map((s) => ({
            id: s.id,
            kind: s.kind,
            name: s.name,
            description: s.description,
            durationMinutes: s.durationMinutes,
            category: s.category?.name ?? null,
            price: publicPrice(servicePrices.get(s.id)),
          })),
          packages: packages.map((pk) => ({
            id: pk.id,
            name: pk.name,
            description: pk.description,
            durationMinutes: pk.durationMinutes,
            staffCount: pk.staffCount,
            subject: pk.subject,
            locationTypes: pk.locationTypes,
            // Số km miễn phí khi làm tại nhà/địa điểm khác: riêng của gói, không có thì theo tổ chức.
            includedKm: pk.includedKm !== null ? pk.includedKm.toNumber() : freeKm,
            terms: pk.terms,
            price: publicPrice(packagePrices.get(pk.id)),
            included: pk.items
              .filter((i) => !i.isOptional)
              .map((i) => ({ name: i.service.name, quantity: i.quantity })),
            addons: pk.items
              .filter((i) => i.isOptional && i.service.isPublic)
              .map((i) => ({
                serviceId: i.service.id,
                name: i.service.name,
                durationMinutes: i.service.durationMinutes,
                quantity: i.quantity,
                price: publicPrice(servicePrices.get(i.service.id)),
              })),
          })),
          subjects,
          travel: { freeKm },
        },
      };
    },
  }),
];
