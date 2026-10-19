// Thẻ truy cập (access token) gắn với MỐC ĐỔI MẬT KHẨU (thợ K6).
//
// Vấn đề: đặt lại mật khẩu thu hồi mọi refresh token, nhưng thẻ truy cập đang cầm (sống ACCESS_TOKEN_TTL_SECONDS, mặc định
// 15 phút) vẫn dùng được tới lúc hết hạn.
//
// Cách làm: cột users.password_changed_at (NULL = chưa đổi lần nào). Lúc cấp thẻ, ghi mốc hiện hành vào claim "pca"
// (mili-giây kể từ 1970; 0 khi mốc NULL). authenticate đọc mốc hiện hành TRONG CÙNG câu tra user sẵn có (không thêm truy
// vấn) và chỉ nhận thẻ có pca BẰNG mốc hiện hành.
//
// Vì sao so BẰNG mốc thay vì so iat < mốc: iat của JWT tính bằng GIÂY (làm tròn xuống), mốc tính bằng mili-giây. Thẻ cấp
// cùng một giây với lần đổi — trước hay sau — có cùng iat, không phân biệt được bằng iat. So iat theo giây làm tròn xuống thì
// thẻ cấp NGAY TRƯỚC lần đổi (cùng giây) sống sót; kẻ giữ refresh token đánh cắp đổi thẻ liên tục (vài lần mỗi giây, dưới
// trần /auth/refresh) gần như chắc chắn có một thẻ như thế. Làm tròn lên thì thẻ cấp NGAY SAU lần đổi (cùng giây) bị từ chối
// oan. So bằng mốc thì chính xác tới mili-giây ở cả hai phía, không phụ thuộc đồng hồ của từng máy chủ (giá trị so đều đọc
// từ database).
//
// Thẻ không có claim pca (cấp bởi bản trước bản này, còn sống tối đa một TTL sau khi triển khai): so iat với mốc làm tròn
// xuống giây và từ chối CẢ giây trùng — sau bản này không còn chỗ nào cấp thẻ thiếu pca, nên thẻ thiếu pca không thể là thẻ
// cấp sau một lần đổi mật khẩu; từ chối giây trùng chỉ có thể chặn thẻ cũ, không chặn oan thẻ mới.
import jwt from 'jsonwebtoken';
import { AppError } from '../../lib/errors';

export const PASSWORD_MARK_CLAIM = 'pca';

export interface AccessTokenClaims {
  sub: string;
  // Giây kể từ 1970 (chuẩn JWT). 0 khi thẻ thiếu iat.
  iat: number;
  // Mốc đổi mật khẩu lúc cấp thẻ (ms); undefined = thẻ đời cũ không mang mốc.
  pca: number | undefined;
}

export const passwordMarkOf = (changedAt: Date | null): number => (changedAt ? changedAt.getTime() : 0);

export function signAccessToken(userId: string, passwordChangedAt: Date | null, secret: string, ttlSeconds: number): string {
  return jwt.sign({ [PASSWORD_MARK_CLAIM]: passwordMarkOf(passwordChangedAt) }, secret, {
    subject: userId,
    expiresIn: ttlSeconds,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string, secret: string): AccessTokenClaims {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch {
    throw new AppError('UNAUTHENTICATED', 'Thẻ đăng nhập không hợp lệ hoặc đã hết hạn');
  }
  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    throw new AppError('UNAUTHENTICATED', 'Thẻ đăng nhập không hợp lệ');
  }
  const raw: unknown = payload[PASSWORD_MARK_CLAIM];
  // Có claim mà sai kiểu (thẻ đã ký đúng khoá nên chỉ có thể do lỗi lập trình) → không tin, từ chối.
  if (raw !== undefined && !(typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0)) {
    throw new AppError('UNAUTHENTICATED', 'Thẻ đăng nhập không hợp lệ');
  }
  return { sub: payload.sub, iat: typeof payload.iat === 'number' ? payload.iat : 0, pca: raw as number | undefined };
}

// Thẻ còn được nhận với mốc đổi mật khẩu HIỆN HÀNH trong database không.
export function tokenSurvivesPasswordChange(claims: Pick<AccessTokenClaims, 'iat' | 'pca'>, changedAt: Date | null): boolean {
  if (changedAt === null) return true; // chưa đổi mật khẩu lần nào: mọi thẻ hợp lệ như trước
  const mark = changedAt.getTime();
  if (claims.pca !== undefined) return claims.iat * 1000 >= mark;
  // Thẻ đời cũ: chỉ nhận khi cấp ở giây SAU giây của mốc (iat làm tròn xuống nên iat > ⌊mốc/1000⌋ ⇒ cấp sau mốc).
  return claims.iat > Math.floor(mark / 1000);
}

export const PASSWORD_CHANGED_MESSAGE = 'Mật khẩu tài khoản vừa được đổi, vui lòng đăng nhập lại';
