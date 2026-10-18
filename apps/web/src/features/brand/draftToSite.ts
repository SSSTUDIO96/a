// Dữ liệu khung "Xem trước": dựng giống GET /public/sites/:slug từ bản nháp đang sửa + GET /packages (chỉ gói đang bán
// và bật "hiện trên trang"). Có thể lệch nhẹ với trang thật: dịch vụ phụ không công khai vẫn hiện, không có dịch vụ lẻ
// (bản vẽ C2 mục 4.4). KHÔNG mang theo mã gói, tiền cọc hay dữ liệu nội bộ nào khác.
import type { CurrentPrice, PublicPrice, ServicePackage } from '../../api/types';
import type { SiteViewData } from '../public-site';
import { shiftsOf, type Draft } from './model';

const nullable = (v: string): string | null => {
  const t = v.trim();
  return t === '' ? null : t;
};

function publicPrice(p: CurrentPrice | null): PublicPrice | null {
  return p ? { listPrice: p.listPrice, salePrice: p.salePrice, unitPrice: p.unitPrice } : null;
}

export interface PreviewCatalog {
  packages: ServicePackage[];
  subjects: { id: string; name: string }[];
  // freeKm của tổ chức (null = chưa đặt chính sách phí di chuyển).
  freeKm: number | null;
}

export function previewPackages(packages: readonly ServicePackage[], freeKm: number | null): SiteViewData['packages'] {
  return packages
    .filter((p) => p.isActive && p.isPublic)
    .map((p) => ({
      id: p.id,
      name: p.name,
      durationMinutes: p.durationMinutes,
      subject: p.subject ? { id: p.subject.id, name: p.subject.name } : null,
      locationTypes: p.locationTypes,
      includedKm: p.includedKm ?? freeKm,
      price: publicPrice(p.currentPrice),
      included: p.items.filter((i) => !i.isOptional && i.service.isActive).map((i) => ({ name: i.service.name, quantity: i.quantity })),
      addons: p.items
        .filter((i) => i.isOptional && i.service.isActive)
        .map((i) => ({ serviceId: i.serviceId, name: i.service.name, price: publicPrice(i.currentPrice) })),
    }));
}

export function draftToSite(d: Draft, catalog: PreviewCatalog | null): SiteViewData {
  const img = (slot: keyof Draft['images']) => {
    const url = d.images[slot]?.url;
    return url ? { url } : null;
  };
  return {
    profile: {
      brandName: d.brandName.trim(),
      tagline: nullable(d.tagline),
      bio: nullable(d.bio),
      experience: nullable(d.experience),
      styles: d.styles,
      serviceArea: nullable(d.serviceArea),
      address: nullable(d.address),
      phone: nullable(d.phone),
      email: nullable(d.email),
      zalo: nullable(d.zalo),
      facebook: nullable(d.facebook),
      instagram: nullable(d.instagram),
      tiktok: nullable(d.tiktok),
      website: nullable(d.website),
      workingHours: shiftsOf(d.days).shifts,
      bookingPolicy: nullable(d.bookingPolicy),
      cancellationPolicy: nullable(d.cancellationPolicy),
      depositPolicy: nullable(d.depositPolicy),
      logo: img('logo'),
      avatar: img('avatar'),
      cover: img('cover'),
    },
    services: [],
    packages: catalog ? previewPackages(catalog.packages, catalog.freeKm) : [],
    subjects: catalog?.subjects ?? [],
  };
}
