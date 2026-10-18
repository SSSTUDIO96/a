import type { ContractKind } from '../../api/types';
import { Segmented } from '../../ui';

// Seg loại hợp đồng (bản vẽ C3 mục 2.3): "Khoá học / Dịch vụ makeup". Chỉ tổ chức đào tạo (ACADEMY) thấy.
// Loại đặt lúc tạo — hợp đồng đã lưu không đổi được loại (máy chủ cũng khoá).
export const KIND_LOCKED_REASON = 'Loại hợp đồng đặt lúc lập — đã lưu thì không đổi được. Lập hợp đồng mới nếu cần loại khác.';

export function KindSwitch({ value, onChange, locked }: { value: ContractKind; onChange: (k: ContractKind) => void; locked: boolean }) {
  return (
    <div className="ct-kind">
      <Segmented<ContractKind>
        block
        aria-label="Loại hợp đồng"
        options={[
          { value: 'COURSE', label: 'Khoá học', disabled: locked && value !== 'COURSE', disabledReason: KIND_LOCKED_REASON },
          { value: 'SERVICE', label: 'Dịch vụ makeup', disabled: locked && value !== 'SERVICE', disabledReason: KIND_LOCKED_REASON },
        ]}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
