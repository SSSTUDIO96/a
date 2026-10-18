import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Băm sẵn để so sánh khi email không tồn tại — thời gian trả lời như nhau, không lộ email nào đã đăng ký.
export const DUMMY_HASH = bcrypt.hashSync('khong-ai-co-mat-khau-nay', ROUNDS);
