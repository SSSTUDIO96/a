import { useNavigate } from 'react-router';
import { Segmented } from '../../ui';

// Điện thoại: đầu màn danh sách có nút chuyển 2 ô "Thợ & bậc lương · Tiền công theo gói" (C2 1.1).
// Thiếu payroll.read thì chỉ còn một màn → không bày nút chuyển.
export function StaffSegmented({ slug, active, payrollRead }: { slug: string; active: 'tho' | 'tien'; payrollRead: boolean }) {
  const navigate = useNavigate();
  if (!payrollRead) return null;
  return (
    <Segmented
      className="st-seg"
      block
      aria-label="Mục thợ makeup"
      value={active}
      options={[
        { value: 'tho', label: 'Thợ & bậc lương' },
        { value: 'tien', label: 'Tiền công theo gói' },
      ]}
      onChange={(v) => navigate(v === 'tho' ? `/${slug}/nhan-su` : `/${slug}/nhan-su/tien-cong`)}
    />
  );
}
