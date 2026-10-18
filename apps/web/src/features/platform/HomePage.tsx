// Trang chủ quản trị (bản vẽ C2 mục 5.3, bản mẫu #b): 4 ô số + hai thẻ việc cần làm.
import { useState } from 'react';
import { usePlatformStats } from './context';
import { ExpiringCard, loadExpiring } from './ExpiringCard';
import { GraceCard, loadExpired, loadNewest } from './GraceCard';
import { fmtDateTime } from './labels';
import { PlatformHeader } from './PlatformShell';
import { StatTiles } from './StatTiles';
import { renewTargetFromItem, SubscriptionDialog, type RenewTarget } from './SubscriptionDialog';
import { useLoad } from './useLoad';

export function HomePage() {
  const { stats, reloadStats } = usePlatformStats();
  const expiring = useLoad('sap-het-han', loadExpiring);
  const expired = useLoad('het-han', loadExpired);
  const newest = useLoad('moi', loadNewest);
  const [renew, setRenew] = useState<RenewTarget | null>(null);

  const reloadAll = () => {
    reloadStats();
    expiring.reload();
    expired.reload();
    newest.reload();
  };

  return (
    <>
      <PlatformHeader title="Trang chủ quản trị" phoneTitle="Trang chủ" sub={`số liệu lúc ${fmtDateTime(stats.generatedAt)}`} />
      <StatTiles stats={stats} />
      <div className="pf-g2">
        <ExpiringCard data={expiring} onRenew={(o) => setRenew(renewTargetFromItem(o))} />
        <GraceCard expired={expired} newest={newest} onRenew={(o) => setRenew(renewTargetFromItem(o))} />
      </div>
      <SubscriptionDialog target={renew} onClose={() => setRenew(null)} onSaved={reloadAll} />
    </>
  );
}
