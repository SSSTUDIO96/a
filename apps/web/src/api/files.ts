import { apiRequest, api } from './client';
import { idSeg, orgPath, withQuery } from './org';
import type { FileUploadInput, StoredFileView } from './types';

// Tệp (ảnh đại diện thợ, logo, album, tài liệu): apps/api/src/modules/files/*.

async function sha256Hex(data: Blob | ArrayBuffer): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const buf = data instanceof Blob ? await data.arrayBuffer() : data;
  const digest = await subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Tải một tệp lên: thân là nội dung nhị phân, ?purpose=&name=. Kèm X-Content-SHA256 (khi trình duyệt tính được)
// để máy chủ phát hiện tệp hỏng trên đường truyền và để thử lại cùng khoá + cùng tệp nhận lại đúng kết quả cũ.
// idempotencyKey sinh MỘT lần cho mỗi lần chọn tệp.
export async function uploadFile(orgId: string, input: FileUploadInput, idempotencyKey: string) {
  const sha = await sha256Hex(input.data);
  return apiRequest<StoredFileView>('POST', withQuery(orgPath(orgId, '/files'), { purpose: input.purpose, name: input.name }), {
    rawBody: input.data,
    idempotencyKey,
    ...(sha ? { headers: { 'X-Content-SHA256': sha } } : {}),
  });
}

// Thông tin tệp kèm URL đọc mới (hạn 10 phút).
export function getFile(orgId: string, fileId: string, signal?: AbortSignal) {
  return api.get<StoredFileView>(orgPath(orgId, `/files/${idSeg(fileId)}`), signal);
}

// Xoá mềm: URL cũ thôi đọc được. Máy chủ trả 204 (không có thân).
export function deleteFile(orgId: string, fileId: string) {
  return api.delete<void>(orgPath(orgId, `/files/${idSeg(fileId)}`));
}
