import type { Request, RequestHandler, Response } from 'express';
import type { Deps } from '../../http/route';
import { getStorage, LocalDiskDriver, RAW_FILE_PATH, verifyToken } from '../../lib/storage';

// Đường phục vụ tệp của driver đĩa cục bộ: GET /api/v1/files/raw/:token.
// Không qua bảng route (bảng route chỉ trả JSON) — app.ts gắn handler này (xem PHIẾU VƯỚNG).
// Vé sai chữ ký / hết hạn → 403; tệp đã xoá hoặc không có → 404. Không bao giờ lộ đường dẫn đĩa.
export const RAW_ROUTE = `${RAW_FILE_PATH}/:token`;

function fail(res: Response, status: 403 | 404, code: string, message: string) {
  res.status(status).json({ error: { code, message, requestId: String(res.locals.requestId ?? '') } });
}

export function rawFileHandler(deps: Deps): RequestHandler {
  return async (req: Request, res: Response) => {
    const storage = getStorage();
    if (!(storage instanceof LocalDiskDriver)) return fail(res, 404, 'NOT_FOUND', 'Không có đường API này');
    const token = typeof req.params.token === 'string' ? req.params.token : '';
    const check = verifyToken(storage.signingSecret, token);
    if (!check.ok) {
      return check.reason === 'EXPIRED'
        ? fail(res, 403, 'FORBIDDEN', 'Đường dẫn tệp đã hết hạn, vui lòng tải lại trang')
        : fail(res, 403, 'FORBIDDEN', 'Đường dẫn tệp không hợp lệ');
    }
    const file = await deps.db.storedFile.findUnique({
      where: { storageKey: check.key },
      select: { status: true, mimeType: true, sizeBytes: true },
    });
    if (!file || file.status !== 'READY') return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy tệp');
    const remaining = Math.max(0, Math.floor((check.expiresAt.getTime() - Date.now()) / 1000));
    res.status(200);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.sizeBytes));
    res.setHeader('Cache-Control', `private, max-age=${remaining}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    // Web chạy khác tên miền với API vẫn hiện được ảnh trong thẻ <img>.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Disposition', 'inline');
    const stream = storage.openRead(check.key);
    stream.on('error', (err) => {
      deps.logger.error({ err, key: check.key }, 'Đọc tệp từ đĩa thất bại');
      res.destroy(err);
    });
    stream.pipe(res);
  };
}
