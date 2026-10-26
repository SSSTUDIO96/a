import { Link } from 'react-router';
import type { Customer } from '../../api/types';
import { Avatar, ListRow } from '../../ui';
import { highlightPhone, initialsOf } from './logic';

// Một dòng khách (C2 2.2): ảnh chữ viết tắt (màu theo id) · họ tên (xuống dòng, không cắt) · số điện thoại. Đúng 3 thông tin.
export function CustomerRow({ slug, c, q, selected }: { slug: string; c: Customer; q: string; selected: boolean }) {
  return (
    <ListRow
      as={Link}
      linkProps={{ to: `/${slug}/khach-hang/${c.id}` }}
      leading={<Avatar name={c.fullName} initials={initialsOf(c.fullName)} avatarUrl={c.avatarUrl} colorKey={c.id} />}
      title={c.fullName}
      trailing={
        c.phone ? (
          <span className="kh-phone">
            {highlightPhone(c.phone, q).map((p, i) => (p.match ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>))}
          </span>
        ) : undefined
      }
      selected={selected}
    />
  );
}
