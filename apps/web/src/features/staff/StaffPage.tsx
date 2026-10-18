import { useMemo } from 'react';
import { useLocation } from 'react-router';
import { usePermissions } from '../../layout/usePermissions';
import { PayRatesScreen } from './PayRatesScreen';
import { staffPerms } from './logic';
import { StaffTiersScreen } from './StaffTiersScreen';
import { useOrgInfo } from './useOrgInfo';
import './staff.css';

// Khung màn Thợ makeup (C2 1.1): /nhan-su… → Thợ & bậc lương; /nhan-su/tien-cong… → Tiền công theo gói.
// Quyền mục con đã chặn ở routes.tsx (RequireNavPermission: tho-bac = staff.read, tien-cong = payroll.read).
export function StaffPage() {
  const org = useOrgInfo();
  const has = usePermissions();
  const perms = useMemo(() => staffPerms(has), [has]);
  const { pathname } = useLocation();
  const payRates = pathname.replace(/\/+$/, '').split('/')[3] === 'tien-cong';
  return payRates ? <PayRatesScreen key="tien" org={org} perms={perms} /> : <StaffTiersScreen key="tho" org={org} perms={perms} />;
}
