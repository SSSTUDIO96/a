import { GroupTitle, TextRow, type GroupProps } from './common';

// Nhóm "Liên hệ". Mạng xã hội / website: máy chủ chỉ nhận https://… đầy đủ; SĐT được chuẩn hoá ở máy chủ.
export function ContactGroup(props: GroupProps) {
  return (
    <div className="br-group" data-group="lien-he">
      <GroupTitle>Liên hệ</GroupTitle>
      <TextRow {...props} field="address" label="Địa chỉ" />
      <TextRow {...props} field="phone" label="Số điện thoại" type="tel" inputMode="tel" />
      <TextRow {...props} field="zalo" label="Zalo" tip="Số điện thoại hoặc liên kết https://zalo.me/…" />
      <TextRow {...props} field="email" label="Email" type="email" inputMode="email" />
      <TextRow {...props} field="facebook" label="Facebook" type="url" inputMode="url" placeholder="https://" />
      <TextRow {...props} field="tiktok" label="TikTok" type="url" inputMode="url" placeholder="https://" />
      <TextRow {...props} field="instagram" label="Instagram" type="url" inputMode="url" placeholder="https://" />
      <TextRow {...props} field="website" label="Website" type="url" inputMode="url" placeholder="https://" />
    </div>
  );
}
