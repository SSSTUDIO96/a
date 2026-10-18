import { useEffect, useState } from 'react';
import { Button, StatusTag, WithTooltip } from '../../ui';
import { shareUrl, siteLink } from './publicLink';

export interface PublishBarProps {
  slug: string;
  published: boolean;
  publishedAt: string | null;
  timezone: string | null;
  // Hồ sơ đã lưu có tên thương hiệu → xuất bản được.
  canPublish: boolean;
  publishing: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  // Không có org.update → chỉ xem trạng thái.
  readOnly: boolean;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function formatPublishedDate(iso: string, timezone: string | null): string {
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
  try {
    return new Intl.DateTimeFormat('vi-VN', { ...opts, timeZone: timezone ?? undefined }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat('vi-VN', opts).format(new Date(iso));
  }
}

// Thanh xuất bản trên cùng (bản vẽ C2 mục 4.2): trạng thái · đường dẫn · Sao chép liên kết · Mở trang + Gỡ trang / Xuất bản.
export function PublishBar({ slug, published, publishedAt, timezone, canPublish, publishing, onPublish, onUnpublish, readOnly }: PublishBarProps) {
  const link = siteLink(slug);
  const [copy, setCopy] = useState<'idle' | 'done' | 'failed'>('idle');

  useEffect(() => {
    if (copy !== 'done') return undefined;
    const t = window.setTimeout(() => setCopy('idle'), 2000);
    return () => window.clearTimeout(t);
  }, [copy]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl(slug));
      setCopy('done');
    } catch {
      setCopy('failed');
    }
  }

  const publishButton = (
    <Button size="sm" variant="primary" onClick={onPublish} loading={publishing} disabled={!canPublish || readOnly}>
      Xuất bản
    </Button>
  );

  return (
    <section className="ui-card br-pub" aria-label="Trạng thái trang giới thiệu">
      {published ? (
        <StatusTag tone="ok">Đang công khai{publishedAt ? ` từ ${formatPublishedDate(publishedAt, timezone)}` : ''}</StatusTag>
      ) : (
        <StatusTag tone="draft">Chưa xuất bản</StatusTag>
      )}
      <span className="br-pub__url">
        {link.prefix}
        <b>{link.slug}</b>
      </span>
      <span className="br-pub__actions">
        <Button size="sm" onClick={() => void copyLink()}>
          {copy === 'done' ? 'Đã sao chép' : 'Sao chép liên kết'}
        </Button>
        {published ? (
          <>
            <a className="ui-btn ui-btn--sm br-pub__open" href={link.href} target="_blank" rel="noopener noreferrer">
              <EyeIcon />
              <span className="ui-btn__text">Mở trang</span>
            </a>
            {!readOnly && (
              <Button size="sm" className="br-btn-danger-line" onClick={onUnpublish} loading={publishing}>
                Gỡ trang
              </Button>
            )}
          </>
        ) : canPublish ? (
          publishButton
        ) : (
          <WithTooltip text="Lưu tên thương hiệu trước">{publishButton}</WithTooltip>
        )}
      </span>
      {copy === 'failed' && (
        <span className="br-err br-pub__msg" role="alert">
          Trình duyệt không cho sao chép — chọn đường dẫn ở trên và sao chép tay.
        </span>
      )}
    </section>
  );
}
