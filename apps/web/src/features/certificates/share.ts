import { downloadBlob } from '../designs/exportPng';

// Chia sẻ / tải tệp PDF giấy chứng nhận (bản vẽ F mục 7.3). In trên điện thoại = mở PDF qua bảng Chia sẻ của máy (In / Zalo / Lưu).
//
// ĐIỀU KIỆN SỐNG CÒN: navigator.share phải được gọi NGAY trong lượt bấm, không có `await` nào đứng trước (Safari iPhone chỉ cho
// mở bảng Chia sẻ trong lượt bấm của người dùng; làm PDF mất vài giây sẽ làm mất lượt bấm và share báo NotAllowedError).
// Vì vậy PDF phải làm XONG trước (bước "Đang vẽ"), tệp File dựng sẵn bằng makePdfFile, và nút chỉ hiện khi tệp đã sẵn.
// shareFile KHÔNG phải hàm async: phần đồng bộ của nó là lời gọi navigator.share.

export type ShareOutcome =
  | { kind: 'shared' }
  // Người dùng tự đóng bảng Chia sẻ (AbortError): im lặng.
  | { kind: 'cancelled' }
  | { kind: 'unsupported' }
  // NotAllowedError hay lỗi khác.
  | { kind: 'failed'; message: string };

export const SHARE_FAILED_MESSAGE = 'Không mở được bảng Chia sẻ — bấm Tải PDF';

export function makePdfFile(bytes: Uint8Array, fileName: string): File {
  return new File([new Uint8Array(bytes)], fileName, { type: 'application/pdf' });
}

export function makePngFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: 'image/png' });
}

// Máy có chia sẻ được TỆP không (Safari iPhone, Chrome Android: có; Chrome máy tính phần lớn: không).
export function canShareFile(file: File): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function shareFile(file: File, title: string): Promise<ShareOutcome> {
  if (!canShareFile(file)) return Promise.resolve({ kind: 'unsupported' });
  // Lời gọi đồng bộ: không có await trước dòng này.
  return navigator.share({ files: [file], title }).then(
    (): ShareOutcome => ({ kind: 'shared' }),
    (err: unknown): ShareOutcome => {
      if (err instanceof DOMException && err.name === 'AbortError') return { kind: 'cancelled' };
      return { kind: 'failed', message: SHARE_FAILED_MESSAGE };
    },
  );
}

// Tải tệp về máy (PDF hay PNG).
export function downloadFile(file: File): void {
  downloadBlob(file, file.name);
}
