// Cửa vào màn Thu tiền (bản vẽ C2 mục 3). routes.tsx chỉ nhập từ tệp này.
// Đường: /:orgSlug/thu-tien, /:orgSlug/thu-tien/:contractId
import { useParams } from 'react-router';
import { useSession } from '../../app/session';
import { usePermissionsContext } from '../../layout/usePermissions';
import { PaymentsScreen } from './PaymentsScreen';

export { PaymentPanel, type PaymentAccess, type PaymentPanelProps } from './PaymentPanel';
export { PaymentsScreen } from './PaymentsScreen';

export function PaymentsPage() {
  const { orgSlug, contractId } = useParams();
  const { organizations, currentOrg } = useSession();
  const perms = usePermissionsContext();
  const org = organizations.find((o) => o.slug === orgSlug) ?? currentOrg;
  if (!org) return null;
  return (
    <PaymentsScreen
      orgId={org.id}
      orgSlug={org.slug}
      contractId={contractId ?? null}
      access={{ write: perms.has('payments.write'), void: perms.has('payments.void'), contractsRead: perms.has('contracts.read') }}
    />
  );
}
