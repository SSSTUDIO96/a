// Phần hiển thị trang giới thiệu — MỘT nguồn cho trang công khai /trang/:slug và khung "Xem trước" ở màn sửa hồ sơ.
// Chỉ nhận dữ liệu (không gọi API). Bố cục theo bề rộng khung chứa (container query trong site.css): < 760px một cột.
// Bản vẽ C2 mục 4.3. Ô trống thì ẩn cả mục.
import type { ReactNode } from 'react';
import type { PublicPackage, PublicPrice, PublicProfile, PublicService } from '../../api/types';
import { formatVnd } from '../../ui';
import {
  formatDuration,
  formatKmVi,
  formatLocations,
  formatPhone,
  groupPackages,
  hoursByDay,
  telHref,
  travelsOut,
  zaloHref,
} from './format';
import './site.css';

type ImageRef = { url: string } | null;

// Chỉ các trường trang hiển thị. PublicSite (GET /public/sites/:slug) gán thẳng vào được; khung xem trước dựng từ bản nháp.
export interface SiteViewData {
  profile: Pick<
    PublicProfile,
    | 'brandName'
    | 'tagline'
    | 'bio'
    | 'experience'
    | 'styles'
    | 'serviceArea'
    | 'address'
    | 'phone'
    | 'email'
    | 'zalo'
    | 'facebook'
    | 'instagram'
    | 'tiktok'
    | 'website'
    | 'workingHours'
    | 'bookingPolicy'
    | 'cancellationPolicy'
    | 'depositPolicy'
  > & { logo: ImageRef; avatar: ImageRef; cover: ImageRef };
  services: Pick<PublicService, 'id' | 'name' | 'price'>[];
  packages: (Pick<PublicPackage, 'id' | 'name' | 'durationMinutes' | 'subject' | 'locationTypes' | 'includedKm' | 'price' | 'included'> & {
    addons: Pick<PublicPackage['addons'][number], 'serviceId' | 'name' | 'price'>[];
  })[];
  subjects: { id: string; name: string }[];
}

export interface SiteViewProps {
  data: SiteViewData;
  // Nằm trong màn khác (khung xem trước): tên thương hiệu là h2, các mục h3 — trang không có hai h1.
  embedded?: boolean;
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ps-ico">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ps-ico">
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function hasText(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

function Price({ price }: { price: PublicPrice | null }) {
  if (!price) return <div className="ps-price">Liên hệ</div>;
  const discounted = price.salePrice !== null && price.salePrice < price.listPrice;
  return (
    <div className="ps-price num">
      {formatVnd(price.unitPrice)}
      {discounted && <del>{formatVnd(price.listPrice)}</del>}
    </div>
  );
}

function PackageCard({ pkg, H }: { pkg: SiteViewData['packages'][number]; H: 'h3' | 'h4' | 'h5' }) {
  const where = formatLocations(pkg.locationTypes);
  const showKm = pkg.includedKm !== null && pkg.includedKm > 0 && travelsOut(pkg.locationTypes);
  return (
    <article className="ps-pkg">
      <div className="ps-pkg__top">
        <H className="ps-pkg__name">{pkg.name}</H>
        <Price price={pkg.price} />
      </div>
      <ul className="ps-pkg__lines">
        <li>
          {formatDuration(pkg.durationMinutes)}
          {where ? ` · ${where}` : ''}
        </li>
        {pkg.included.map((i, n) => (
          <li key={`${i.name}-${n}`}>
            ✓ {i.name} × {i.quantity}
          </li>
        ))}
        {showKm && <li>Miễn phí di chuyển trong {formatKmVi(pkg.includedKm as number)} km</li>}
      </ul>
      {pkg.addons.length > 0 && (
        <div className="ps-pkg__addons">
          {pkg.addons.map((a) => (
            <span key={a.serviceId} className="ps-addon">
              + {a.name}
              {a.price ? <span className="num"> {formatVnd(a.price.unitPrice)}</span> : null}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function Section({ title, H, children, className }: { title: string; H: 'h2' | 'h3'; children: ReactNode; className?: string }) {
  return (
    <section className={className ? `ps-sec ${className}` : 'ps-sec'}>
      <H className="ps-sec__title">{title}</H>
      {children}
    </section>
  );
}

export function SiteView({ data, embedded = false }: SiteViewProps) {
  const p = data.profile;
  const Name = embedded ? 'h2' : 'h1';
  const Sec = embedded ? 'h3' : 'h2';
  const Grp = embedded ? 'h4' : 'h3';
  const Card = embedded ? 'h5' : 'h4';
  const mark = p.logo ?? p.avatar;
  const groups = groupPackages(data.packages, data.subjects);
  const services = data.services;
  const styles = p.styles.filter(hasText);
  const hasIntro = hasText(p.bio) || hasText(p.experience) || styles.length > 0 || hasText(p.serviceArea);
  const policies = [
    ['Đặt lịch', p.bookingPolicy],
    ['Đặt cọc', p.depositPolicy],
    ['Huỷ lịch', p.cancellationPolicy],
  ].filter((x): x is [string, string] => hasText(x[1]));
  const socials = [
    ['Facebook', p.facebook],
    ['TikTok', p.tiktok],
    ['Instagram', p.instagram],
    ['Website', p.website],
  ].filter((x): x is [string, string] => hasText(x[1]));
  const hasContact = hasText(p.address) || hasText(p.email) || socials.length > 0;
  const days = hoursByDay(p.workingHours);
  const hasPrices = groups.length > 0 || services.length > 0;

  return (
    <div className={`ps-site${p.cover ? '' : ' ps-site--nocover'}`}>
      {p.cover && <div className="ps-cover" style={{ backgroundImage: `url("${p.cover.url}")` }} role="img" aria-label={`Ảnh bìa ${p.brandName}`} />}
      <header className={`ps-hdr${mark ? '' : ' ps-hdr--nomark'}`}>
        {mark && <img className="ps-mark" src={mark.url} alt={`Logo ${p.brandName}`} />}
        <div className="ps-hdr__tx">
          <Name className="ps-name">{p.brandName}</Name>
          {hasText(p.tagline) && <p className="ps-tagline">{p.tagline}</p>}
        </div>
        {(hasText(p.phone) || hasText(p.zalo)) && (
          <div className="ps-cta">
            {hasText(p.phone) && (
              <a className="ui-btn ui-btn--primary" href={telHref(p.phone)}>
                <PhoneIcon />
                <span className="ui-btn__text">Gọi {formatPhone(p.phone)}</span>
              </a>
            )}
            {hasText(p.zalo) && (
              <a className="ui-btn" href={zaloHref(p.zalo)} target="_blank" rel="noopener noreferrer">
                <span className="ui-btn__text">Nhắn Zalo</span>
              </a>
            )}
          </div>
        )}
      </header>
      <div className="ps-body">
        <div className="ps-main">
          {hasPrices && (
            <Section title="Bảng giá" H={Sec}>
              {groups.map((g) => (
                <div key={g.key} className="ps-group">
                  <Grp className="ps-group__title">{g.title}</Grp>
                  <div className="ps-pkgs">
                    {g.packages.map((pkg) => (
                      <PackageCard key={pkg.id} pkg={pkg} H={Card} />
                    ))}
                  </div>
                </div>
              ))}
              {services.length > 0 && (
                <div className="ps-group">
                  <Grp className="ps-group__title">Dịch vụ lẻ</Grp>
                  <ul className="ps-services">
                    {services.map((s) => (
                      <li key={s.id}>
                        <span>{s.name}</span>
                        <span className="num ps-services__price">{s.price ? formatVnd(s.price.unitPrice) : 'Liên hệ'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}
          {hasIntro && (
            <Section title="Giới thiệu" H={Sec}>
              {hasText(p.bio) && <p className="ps-bio">{p.bio}</p>}
              {hasText(p.experience) && <p className="ps-small ps-muted ps-gap">{p.experience}</p>}
              {styles.length > 0 && (
                <div className="ps-styles">
                  {styles.map((s) => (
                    <span key={s} className="ui-tag ui-tag--accent">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {hasText(p.serviceArea) && <p className="ps-small ps-muted ps-gap">Phục vụ: {p.serviceArea}</p>}
            </Section>
          )}
        </div>
        <div className="ps-side">
          {p.workingHours.length > 0 && (
            <Section title="Giờ làm việc" H={Sec}>
              <dl className="ps-hours">
                {days.map((d) => (
                  <div key={d.weekday} className="ps-hours__row">
                    <dt>{d.label}</dt>
                    <dd className={d.text ? 'ps-hours__t' : 'ps-hours__off'}>{d.text ?? 'Nghỉ'}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}
          {policies.length > 0 && (
            <Section title="Chính sách" H={Sec}>
              {policies.map(([label, text]) => (
                <div key={label} className="ps-policy">
                  <b>{label}</b>
                  <p>{text}</p>
                </div>
              ))}
            </Section>
          )}
          {hasContact && (
            <Section title="Liên hệ" H={Sec}>
              {hasText(p.address) && (
                <p className="ps-small ps-addr">
                  <PinIcon />
                  <span>{p.address}</span>
                </p>
              )}
              {hasText(p.email) && (
                <p className="ps-small ps-gap">
                  <a className="ps-link" href={`mailto:${p.email}`}>
                    {p.email}
                  </a>
                </p>
              )}
              {socials.length > 0 && (
                <div className="ps-socials">
                  {socials.map(([label, url]) => (
                    <a key={label} className="ui-chip" href={url} target="_blank" rel="noopener noreferrer">
                      {label}
                    </a>
                  ))}
                </div>
              )}
            </Section>
          )}
        </div>
      </div>
      <footer className="ps-foot">Trang tạo bằng Makeup Pro</footer>
    </div>
  );
}
