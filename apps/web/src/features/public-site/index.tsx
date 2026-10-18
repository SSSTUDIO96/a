// Cửa vào trang công khai của tổ chức (bản vẽ C2 mục 4.3). routes.tsx chỉ nhập từ tệp này.
// Đường: /trang/:slug — NGOÀI đăng nhập, không có khung.
// SiteView (phần hiển thị) dùng lại làm khung "Xem trước" ở màn Hồ sơ thương hiệu — một nguồn, không vẽ hai lần.
export { PublicSitePage } from './PublicSitePage';
export { SiteView, type SiteViewData, type SiteViewProps } from './SiteView';
