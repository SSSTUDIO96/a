// Cửa vào màn Báo cáo (bản vẽ C2 mục 3.4, 3.5). routes.tsx chỉ nhập từ tệp này.
// Đường: /bao-cao/doanh-thu (RevenuePage, quyền reports.read), /bao-cao/so-thu (CashbookPage, quyền payments.read)
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { PageSkeleton } from '../../layout/ErrorStates';
import { useSession } from '../../app/session';
import { LedgerScreen } from './LedgerScreen';
import { RevenueScreen } from './RevenueScreen';

export { LedgerScreen } from './LedgerScreen';
export { RevenueScreen } from './RevenueScreen';

// Lần vẽ đầu chỉ có khối chờ, màn thật vẽ ngay sau đó: lượt chuyển đường (react-router chạy trong startTransition)
// xong nhanh nên khung (mục con đang chọn, tiêu đề) cập nhật ngay, không phải chờ cả màn báo cáo dựng xong.
function useAfterFirstPaint(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

function useOrg() {
  const { orgSlug } = useParams();
  const { organizations, currentOrg } = useSession();
  return organizations.find((o) => o.slug === orgSlug) ?? currentOrg;
}

export function RevenuePage() {
  const org = useOrg();
  const ready = useAfterFirstPaint();
  if (!org) return null;
  if (!ready) return <PageSkeleton />;
  return <RevenueScreen orgId={org.id} orgSlug={org.slug} />;
}

export function CashbookPage() {
  const org = useOrg();
  const ready = useAfterFirstPaint();
  if (!org) return null;
  if (!ready) return <PageSkeleton />;
  return <LedgerScreen orgId={org.id} orgSlug={org.slug} />;
}
