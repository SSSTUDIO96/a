import type { ServicePackage } from '../../api/types';
import { ContactGroup } from './groups/ContactGroup';
import type { GroupProps } from './groups/common';
import { IdentityGroup } from './groups/IdentityGroup';
import { ImagesGroup } from './groups/ImagesGroup';
import { PoliciesGroup } from './groups/PoliciesGroup';
import { PublicPackagesGroup } from './groups/PublicPackagesGroup';
import { WorkingHoursGroup } from './groups/WorkingHoursGroup';
import type { CatalogState } from './useProfileDraft';

export interface BrandFormProps extends GroupProps {
  orgId: string;
  canUpload: boolean;
  // catalog.read: có nhóm "Gói hiện trên trang"; catalog.write: bật/tắt được.
  catalog: { state: CatalogState; reload: () => void; canWrite: boolean; onChanged: (pkg: ServicePackage) => void } | null;
}

// Thẻ form bên trái — 6 nhóm (bản vẽ C2 mục 4.2).
export function BrandForm({ orgId, canUpload, catalog, ...group }: BrandFormProps) {
  return (
    <section className="ui-card br-form" aria-label="Sửa hồ sơ thương hiệu">
      <div className="br-form__body">
        <IdentityGroup {...group} />
        <ImagesGroup {...group} orgId={orgId} canUpload={canUpload} />
        <ContactGroup {...group} />
        <WorkingHoursGroup {...group} />
        <PoliciesGroup {...group} />
        {catalog && <PublicPackagesGroup orgId={orgId} {...catalog} />}
      </div>
    </section>
  );
}
