// Cửa vào gói W5 Hợp đồng (bản vẽ C mục 4.3). Thợ W5 giữ toàn bộ thư mục này; routes.tsx chỉ nhập từ tệp này.
// Đường: /:orgSlug/hop-dong (danh sách) · /:orgSlug/hop-dong/moi (lập mới) · /:orgSlug/hop-dong/:id (id = UUID hợp đồng).
import { useParams } from 'react-router';
import { useSession } from '../../app/session';
import { usePermissionsContext } from '../../layout/usePermissions';
import { ContractEditor } from './ContractEditor';
import { ContractList } from './ContractList';

export const NEW_CONTRACT_SEGMENT = 'moi';
const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';

function useOrgContext() {
  const { orgSlug } = useParams();
  const { organizations, currentOrg } = useSession();
  const perms = usePermissionsContext();
  const org = organizations.find((o) => o.slug === orgSlug) ?? currentOrg;
  // Múi giờ của tổ chức (GET /orgs/:orgId) để ghép giờ làm với ngày sự kiện; khung chỉ hiện màn khi quyền đã tải xong.
  const tz = perms.state.status === 'ready' ? perms.state.org.timezone : DEFAULT_TZ;
  return { org, tz, has: perms.has };
}

export function ContractListPage() {
  const { org, tz, has } = useOrgContext();
  if (!org) return null;
  return <ContractList orgId={org.id} slug={org.slug} tz={tz} canCreate={has('contracts.write')} />;
}

export function ContractEditorPage() {
  const { id } = useParams();
  const { org, tz, has } = useOrgContext();
  if (!org) return null;
  const contractId = !id || id === NEW_CONTRACT_SEGMENT ? null : id;
  // Không đặt key theo id: đổi "moi" → id sau lần lưu đầu phải giữ nguyên dữ liệu đang nhập (ContractEditor tự nạp/xoá khi cần).
  return <ContractEditor orgId={org.id} slug={org.slug} tz={tz} has={has} contractId={contractId} />;
}
