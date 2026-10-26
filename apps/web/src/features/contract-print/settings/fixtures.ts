// Dữ liệu giả cho bài thử màn Mẫu in hợp đồng.
import type { BrandProfileResult, PrintTemplateView } from '../../../api/types';

export const T = '2026-10-20T03:00:00.000Z';

export function tpl(p: Partial<PrintTemplateView> & Pick<PrintTemplateView, 'id' | 'name'>): PrintTemplateView {
  return {
    layout: 2,
    appliesTo: ['SERVICE'],
    defaultFor: [],
    blocks: {},
    title: null,
    openingText: null,
    closingText: null,
    version: 1,
    isActive: true,
    createdAt: T,
    updatedAt: T,
    updatedBy: null,
    usage: { printedContracts: 0, lastPrintedAt: null },
    ...p,
  };
}

export const PROFILE_FULL: BrandProfileResult = {
  hasProfile: true,
  profile: {
    brandName: 'Chiến Makeup Studio',
    tagline: 'Trang điểm cô dâu',
    bio: null,
    experience: null,
    styles: [],
    serviceArea: null,
    address: '25 Thái Hà, Đống Đa, Hà Nội',
    phone: '0988 123 456',
    email: 'lienhe@chienmakeup.vn',
    zalo: null,
    facebook: null,
    instagram: null,
    tiktok: null,
    website: null,
    logoFileId: null,
    avatarFileId: null,
    coverFileId: null,
    workingHours: [],
    bookingPolicy: null,
    cancellationPolicy: null,
    depositPolicy: null,
    isPublished: false,
    publishedAt: null,
    updatedAt: T,
    representativeName: 'Nguyễn Trọng Chiến',
    representativeTitle: 'Chủ studio',
    bankName: 'Vietcombank',
    bankAccountNumber: '001100456789',
    bankAccountName: 'NGUYEN TRONG CHIEN',
    logo: null,
    avatar: null,
    cover: null,
  },
} as BrandProfileResult;

export const PROFILE_NO_BANK: BrandProfileResult = {
  hasProfile: true,
  profile: { ...(PROFILE_FULL as { profile: object }).profile, representativeName: null, representativeTitle: null, bankName: null, bankAccountNumber: null, bankAccountName: null },
} as BrandProfileResult;
export const PROFILE_NONE: BrandProfileResult = { hasProfile: false, profile: null };

