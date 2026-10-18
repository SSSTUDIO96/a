import { z } from 'zod';
import { defineRoute, mustOrg, mustUser } from '../../http/route';
import { AppError } from '../../lib/errors';
import { writeAudit } from '../../lib/audit';
import { getStorage } from '../../lib/storage';
import { checkContent, newStorageKey, presentFile, PURPOSE_POLICY, readLimitedBody } from './service';

const OrgParams = z.object({ orgId: z.uuid() });
const FileParams = OrgParams.extend({ fileId: z.uuid() });
const Purpose = z.enum(['STAFF_AVATAR', 'CUSTOMER_AVATAR', 'ORG_LOGO', 'ALBUM_IMAGE', 'COURSE_RESOURCE', 'SUBMISSION', 'WELCOME_CARD', 'OTHER']);
// Tên tệp chỉ để hiển thị; bỏ ký tự điều khiển và dấu gạch đường dẫn.
const FileName = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .transform((s) => s.replace(/[\u0000-\u001f\u007f/\\]/g, '_'));

export const fileRoutes = [
  defineRoute({
    method: 'post',
    path: '/orgs/:orgId/files',
    scope: 'org',
    permission: 'files.write',
    tag: 'Tệp',
    summary:
      'Tải một tệp lên: THÂN là nội dung nhị phân của tệp (không multipart), ?purpose=&name=. Kiểm chữ ký đầu tệp, giới hạn dung lượng theo mục đích. Bắt buộc header Idempotency-Key',
    idempotent: true,
    params: OrgParams,
    query: z.object({ purpose: Purpose, name: FileName }),
    handler: async ({ deps, org, req, query, userId, requestId }) => {
      const o = mustOrg(org);
      const uid = mustUser(userId);
      const data = await readLimitedBody(req, PURPOSE_POLICY[query.purpose].maxBytes);
      const declared = req.header('x-content-sha256');
      const checked = checkContent(query.purpose, data, declared);
      const storageKey = newStorageKey(o.id, query.purpose, checked.mimeType);
      const storage = getStorage();
      // Ghi tệp trước, ghi database sau: database lỗi thì xoá tệp vừa ghi rồi báo lỗi (không để bản ghi trỏ vào tệp không có).
      await storage.put(storageKey, data, checked.mimeType);
      try {
        const file = await deps.db.$transaction(async (tx) => {
          const created = await tx.storedFile.create({
            data: {
              organizationId: o.id,
              purpose: query.purpose,
              storageKey,
              originalName: query.name,
              mimeType: checked.mimeType,
              sizeBytes: BigInt(data.length),
              sha256: checked.sha256,
              width: checked.width,
              height: checked.height,
              status: 'READY',
              createdById: uid,
            },
          });
          await writeAudit(tx, {
            organizationId: o.id,
            actorUserId: uid,
            action: 'file.uploaded',
            entityType: 'stored_file',
            entityId: created.id,
            data: { purpose: created.purpose, mimeType: created.mimeType, sizeBytes: data.length, sha256: checked.sha256 },
            requestId,
          });
          return created;
        });
        return { status: 201, body: await presentFile(file) };
      } catch (err) {
        await storage.delete(storageKey);
        throw err;
      }
    },
  }),

  defineRoute({
    method: 'get',
    path: '/orgs/:orgId/files/:fileId',
    scope: 'org',
    permission: 'files.read',
    tag: 'Tệp',
    summary: 'Thông tin tệp kèm URL đọc có hạn 10 phút',
    params: FileParams,
    handler: async ({ deps, org, params }) => {
      const o = mustOrg(org);
      const file = await deps.db.storedFile.findFirst({
        where: { id: params.fileId, organizationId: o.id, status: { not: 'DELETED' } },
      });
      if (!file) throw new AppError('NOT_FOUND', 'Không tìm thấy tệp');
      return { body: await presentFile(file) };
    },
  }),

  defineRoute({
    method: 'delete',
    path: '/orgs/:orgId/files/:fileId',
    scope: 'org',
    permission: 'files.write',
    tag: 'Tệp',
    summary: 'Xoá tệp (xoá mềm: đánh dấu DELETED, URL cũ thôi đọc được; xoá vật lý làm sau)',
    params: FileParams,
    handler: async ({ deps, org, params, userId, requestId }) => {
      const o = mustOrg(org);
      await deps.db.$transaction(async (tx) => {
        const file = await tx.storedFile.findFirst({
          where: { id: params.fileId, organizationId: o.id, status: { not: 'DELETED' } },
        });
        if (!file) throw new AppError('NOT_FOUND', 'Không tìm thấy tệp');
        await tx.storedFile.update({ where: { id: file.id }, data: { status: 'DELETED', deletedAt: new Date() } });
        await writeAudit(tx, {
          organizationId: o.id,
          actorUserId: mustUser(userId),
          action: 'file.deleted',
          entityType: 'stored_file',
          entityId: file.id,
          data: { purpose: file.purpose, originalName: file.originalName },
          requestId,
        });
      });
      return { status: 204 };
    },
  }),
];
