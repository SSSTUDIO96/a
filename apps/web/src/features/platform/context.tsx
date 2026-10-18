// Số liệu GET /platform/stats tải ở cửa vào (PlatformGate) — dùng lại ở trang chủ và số đếm trong chip,
// không gọi thêm. Sau khi gia hạn / khoá, màn gọi reloadStats() để số khớp.
import { createContext, useContext } from 'react';
import type { PlatformStats } from '../../api/platform';

export interface PlatformStatsValue {
  stats: PlatformStats;
  reloadStats: () => void;
}

export const PlatformStatsContext = createContext<PlatformStatsValue | null>(null);

export function usePlatformStats(): PlatformStatsValue {
  const v = useContext(PlatformStatsContext);
  if (!v) throw new Error('usePlatformStats phải nằm trong PlatformGate');
  return v;
}
