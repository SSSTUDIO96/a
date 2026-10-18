// Cửa vào màn Báo cáo (bản vẽ C2 mục 3.4, 3.5). routes.tsx chỉ nhập từ tệp này.
// Đường: /bao-cao/doanh-thu (RevenuePage, quyền reports.read), /bao-cao/so-thu (CashbookPage, quyền payments.read)
import { useParams } from 'react-router';
import { useSession } from '../../app/session';
import { LedgerScreen } from './LedgerScreen';
import { RevenueScreen } from './RevenueScreen';

export { LedgerScreen } from './LedgerScreen';
export { RevenueScreen } from './RevenueScreen';

function useOrg() {
  const { orgSlug } = useParams();
  const { organizations, currentOrg } = useSession();
  return organizations.find((o) => o.slug === orgSlug) ?? currentOrg;
}

export function RevenuePage() {
  const org = useOrg();
  if (!org) return null;
  return <RevenueScreen orgId={org.id} orgSlug={org.slug} />;
}

export function CashbookPage() {
  const org = useOrg();
  if (!org) return null;
  return <LedgerScreen orgId={org.id} orgSlug={org.slug} />;
}
