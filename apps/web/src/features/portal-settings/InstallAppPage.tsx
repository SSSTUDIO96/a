import { PageHeader } from '../../layout/PageHeader';
import { isStandalone } from '../../pwa/platform';
import { InstallGuide } from '../../pwa/InstallGuide';
import './portal-settings.css';

// Cài đặt → Cài app lên điện thoại (bản vẽ E 5.2, quyền org.read): hướng dẫn của W1 cho app nhân viên.
export function InstallAppPage() {
  return (
    <>
      <PageHeader title="Cài app lên điện thoại" />
      <div className="ps-install">
        {isStandalone() ? <p className="ps-muted">Bạn đang mở bằng app đã cài trên màn hình chính.</p> : <InstallGuide variant="staff" />}
      </div>
    </>
  );
}
