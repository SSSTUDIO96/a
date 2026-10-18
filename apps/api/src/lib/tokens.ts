import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { AppError } from './errors';

export interface AccessClaims {
  sub: string;
}

export function signAccessToken(userId: string, secret: string, ttlSeconds: number): string {
  return jwt.sign({}, secret, { subject: userId, expiresIn: ttlSeconds, algorithm: 'HS256' });
}

export function verifyAccessToken(token: string, secret: string): AccessClaims {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new AppError('UNAUTHENTICATED', 'Thẻ đăng nhập không hợp lệ');
    }
    return { sub: payload.sub };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('UNAUTHENTICATED', 'Thẻ đăng nhập không hợp lệ hoặc đã hết hạn');
  }
}

// Refresh token là chuỗi ngẫu nhiên; database chỉ giữ bản băm để lộ database không lộ thẻ.
export function newRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newFamilyId(): string {
  return randomUUID();
}
