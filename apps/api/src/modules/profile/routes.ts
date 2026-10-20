import type { Prisma } from '@prisma/client';
import type { AnyRoute } from '../../http/route';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { assertUsableImage, signImages } from './images';
import { publicRoutes } from './public';
import { CertificateSignerBody, ProfileBody, parseStoredHours, type ProfileInput } from './schemas';
import { DEFAULT_SIGNER_TITLE } from '@makeup/shared';

type ProfileRow = Prisma.OrganizationProfileGetPayload<object>;

// Giá trị ghi vào database: PUT ghi toàn bộ, trường không gửi thành rỗng.
function toData(b: ProfileInput) {
  return {
    brandName: b.brandName,
    tagline: b.tagline ?? null,
    bio: b.bio ?? null,
    experience: b.experience ?? null,
    styles: b.styles ?? [],
    serviceArea: b.serviceArea ?? null,
    address: b.address ?? null,
    phone: b.phone ?? null,
    email: b.email ?? null,
    zalo: b.zalo ?? null,
    facebook: b.facebook ?? null,
    instagram: b.instagram ?? null,
    tiktok: b.tiktok ?? null,
    website: b.website ?? null,
    logoFileId: b.logoFileId ?? null,
    avatarFileId: b.avatarFileId ?? null,
    coverFileId: b.coverFileId ?? null,
    workingHours: b.workingHours ?? [],
    bookingPolicy: b.bookingPolicy ?? null,
    cancellationPolicy: b.cancellationPolicy ?? null,
    depositPolicy: b.depositPolicy ?? null,
  };
}

function auditValues(p: ProfileRow) {
  const { organizationId: _o, updatedAt: _u, publishedAt, workingHours, ...rest } = p;
  return { ...rest, workingHours: parseStoredHours(workingHours), publishedAt: publishedAt?.toISOString() ?? null };
}

async function presentProfile(db: Prisma.TransactionClient, organizationId: string, p: ProfileRow | null) {
  if (!p) return { hasProfile: false, profile: null };
  const image = await signImages(db, organizationId, [p.logoFileId, p.avatarFileId, p.coverFileId]);
  // Người ký giấy chứng nhận có đường riêng (GET/PUT /profile/certificate): không trả ở đây (kiểu BrandProfile của web
  // không có hai trường này — bài khớp hai đầu báo "thừa trường"). Nhật ký PUT hồ sơ (auditValues) vẫn ghi hai cột.
  const { organizationId: _o, workingHours, certSignerName: _sn, certSignerTitle: _st, ...rest } = p;
  return {
    hasProfile: true,
    profile: {
      ...rest,
      workingHours: parseStoredHours(workingHours),
      logo: image(p.logoFileId),
      avatar: image(p.avatarFileId),
      cover: image(p.coverFileId),
    },
  };
}

async function lockProfile(tx: Prisma.TransactionClient, organizationId: string) {
  await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
  return tx.organizationProfile.findUnique({ where: { organizationId } });
}

function signerValues(p: { certSignerName: string | null; certSignerTitle: string | null }) {
  return { signerName: p.certSignerName, signerTitle: p.certSignerTitle };
}

function presentSigner(p: { certSignerName: string | null; certSignerTitle: string | null } | null) {
  return {
    hasProfile: p !== null,
    signerName: p?.certSignerName ?? null,
    signerTitle: p?.certSignerTitle ?? null,
    defaultTitle: DEFAULT_SIGNER_TITLE,
  };
}

// Người ký thứ hai trên giấy chứng nhận (BAN-VE-F mục 4.8). Hồ sơ thương hiệu có ở MỌI loại tổ chức nên không đòi ACADEMY
// (web chỉ hiện thẻ ở tổ chức ACADEMY). Sửa: org.update — chỉ Chủ và Quản trị (KY-DUYET-F câu 4).
const certificateSignerRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/profile/certificate',
    scope: 'org',
    permission: 'org.read',
    tag: 'Hồ sơ thương hiệu',
    summary: 'Người ký giấy chứng nhận đang đặt (tên, chức danh; trống chức danh = "Giám đốc trung tâm")',
    handler: async ({ deps, org }) => {
      const o = mustOrg(org);
      const p = await deps.db.organizationProfile.findUnique({
        where: { organizationId: o.id },
        select: { certSignerName: true, certSignerTitle: true },
      });
      return { body: presentSigner(p) };
    },
  }),

  defineRoute({
    method: 'put',
    path: '/orgs/:orgId/profile/certificate',
    scope: 'org',
    permission: 'org.update',
    tag: 'Hồ sơ thương hiệu',
    summary: 'Đặt người ký giấy chứng nhận (cần đã lưu hồ sơ thương hiệu)',
    body: CertificateSignerBody,
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const saved = await deps.db.$transaction(async (tx) => {
        const before = await lockProfile(tx, o.id);
        if (!before) {
          throw new AppError('CONFLICT', 'Lưu Hồ sơ thương hiệu (tên thương hiệu) trước', { reason: 'PROFILE_REQUIRED' });
        }
        const after = await tx.organizationProfile.update({
          where: { organizationId: o.id },
          data: { certSignerName: body.signerName, certSignerTitle: body.signerTitle },
          select: { certSignerName: true, certSignerTitle: true },
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'profile.certificate_signer_updated',
          entityType: 'organization_profile',
          entityId: o.id,
          data: { before: signerValues(before), after: signerValues(after) },
          requestId,
        });
        return after;
      });
      return { body: presentSigner(saved) };
    },
  }),
];

const orgProfileRoutes = [
  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/profile',
    scope: 'org',
    permission: 'org.read',
    tag: 'Hồ sơ thương hiệu',
    summary: 'Hồ sơ thương hiệu (chưa có thì hasProfile=false, profile=null)',
    handler: async ({ deps, org }) => {
      const o = mustOrg(org);
      const p = await deps.db.organizationProfile.findUnique({ where: { organizationId: o.id } });
      return { body: await presentProfile(deps.db, o.id, p) };
    },
  }),

  defineRoute({
    method: 'put',
    path: '/orgs/:orgId/profile',
    scope: 'org',
    permission: 'org.update',
    tag: 'Hồ sơ thương hiệu',
    summary: 'Ghi toàn bộ hồ sơ thương hiệu (trường không gửi = để trống; xuất bản dùng đường riêng)',
    body: ProfileBody,
    handler: async ({ deps, org, body, userId, requestId }) => {
      const o = mustOrg(org);
      const data = toData(body);
      const saved = await deps.db.$transaction(async (tx) => {
        const before = await lockProfile(tx, o.id);
        await assertUsableImage(tx, o.id, 'logo', data.logoFileId);
        await assertUsableImage(tx, o.id, 'avatar', data.avatarFileId);
        await assertUsableImage(tx, o.id, 'cover', data.coverFileId);
        const after = await tx.organizationProfile.upsert({
          where: { organizationId: o.id },
          create: { organizationId: o.id, ...data },
          update: data,
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: before ? 'profile.updated' : 'profile.created',
          entityType: 'organization_profile',
          entityId: o.id,
          data: { before: before ? auditValues(before) : null, after: auditValues(after) },
          requestId,
        });
        return after;
      });
      return { body: await presentProfile(deps.db, o.id, saved) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/profile/publish',
    scope: 'org',
    permission: 'org.update',
    tag: 'Hồ sơ thương hiệu',
    summary: 'Xuất bản trang giới thiệu (cần hồ sơ có tên thương hiệu)',
    handler: async ({ deps, org, userId, requestId }) => {
      const o = mustOrg(org);
      const saved = await deps.db.$transaction(async (tx) => {
        const before = await lockProfile(tx, o.id);
        if (!before || before.brandName.trim() === '') {
          throw new AppError('VALIDATION_FAILED', 'Chưa có hồ sơ thương hiệu; lưu hồ sơ có tên thương hiệu trước khi xuất bản');
        }
        if (before.isPublished) return before;
        const after = await tx.organizationProfile.update({
          where: { organizationId: o.id },
          data: { isPublished: true, publishedAt: new Date() },
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'profile.published',
          entityType: 'organization_profile',
          entityId: o.id,
          data: { publishedAt: after.publishedAt?.toISOString() ?? null },
          requestId,
        });
        return after;
      });
      return { body: await presentProfile(deps.db, o.id, saved) };
    },
  }),

  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/profile/unpublish',
    scope: 'org',
    permission: 'org.update',
    tag: 'Hồ sơ thương hiệu',
    summary: 'Gỡ trang giới thiệu khỏi web công khai',
    handler: async ({ deps, org, userId, requestId }) => {
      const o = mustOrg(org);
      const saved = await deps.db.$transaction(async (tx) => {
        const before = await lockProfile(tx, o.id);
        if (!before) throw new AppError('VALIDATION_FAILED', 'Chưa có hồ sơ thương hiệu');
        if (!before.isPublished) return before;
        const after = await tx.organizationProfile.update({
          where: { organizationId: o.id },
          data: { isPublished: false, publishedAt: null },
        });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'profile.unpublished',
          entityType: 'organization_profile',
          entityId: o.id,
          data: { publishedAt: before.publishedAt?.toISOString() ?? null },
          requestId,
        });
        return after;
      });
      return { body: await presentProfile(deps.db, o.id, saved) };
    },
  }),
];

export const profileRoutes: AnyRoute[] = [...orgProfileRoutes, ...certificateSignerRoutes, ...publicRoutes];
