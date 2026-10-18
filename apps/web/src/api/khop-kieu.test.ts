import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { napKieu, soKieu } from './khop-kieu';

// Bộ so kiểu của bài "khớp hai đầu" phải bắt được lệch KIỂU, không chỉ lệch tên trường. Chạy không cần máy chủ:
// khuôn đọc từ types.ts thật, dữ liệu là một bản ghi đúng dạng máy chủ trả rồi làm hỏng từng chỗ.

const HERE = dirname(fileURLToPath(import.meta.url));
const S = napKieu(join(HERE, 'types.ts'), join(HERE, '..', '..', 'tsconfig.json'), {
  summary: 'ContractSummary',
  page: 'Page<ContractSummary>',
  quoteLine: 'GroupedContractLine<null>',
  profile: 'BrandProfileResult',
});

const goodSummary = {
  id: '3f1c0a52-0000-4000-8000-000000000001',
  code: 'HD-000001',
  status: 'DRAFT',
  eventDate: null,
  subtotal: 1_500_000,
  discount: 0,
  total: 1_500_000,
  depositRequired: 500_000,
  confirmedAt: null,
  createdAt: '2026-10-18T10:00:00.000Z',
  customer: { id: 'c1', fullName: 'Lan', phone: null },
};

describe('khop-kieu: so kiểu theo khai báo trong types.ts', () => {
  it('bản ghi đúng dạng → không lỗi', () => {
    expect(soKieu(goodSummary, S.summary, 'summary')).toEqual([]);
    expect(soKieu({ items: [goodSummary], page: 1, pageSize: 20, total: 1 }, S.page, 'page')).toEqual([]);
    expect(soKieu({ hasProfile: false, profile: null }, S.profile, 'profile')).toEqual([]);
  });

  it('sai kiểu giá trị (string ↔ number, null, mảng, đối tượng) → lỗi nêu đúng đường dẫn', () => {
    expect(soKieu({ ...goodSummary, code: 1 }, S.summary, 's')).toEqual(['s.code: cần string, nhận number 1']);
    expect(soKieu({ ...goodSummary, total: '1500000' }, S.summary, 's')[0]).toMatch(/^s\.total: cần number/);
    expect(soKieu({ ...goodSummary, customer: null }, S.summary, 's')[0]).toMatch(/^s\.customer: cần object/);
    expect(soKieu({ ...goodSummary, customer: { id: 'c1', fullName: 'Lan', phone: 912 } }, S.summary, 's')[0]).toMatch(
      /^s\.customer\.phone: không khớp/,
    );
    expect(soKieu({ items: goodSummary, page: 1, pageSize: 20, total: 1 }, S.page, 'p')).toEqual(['p.items: cần array, nhận object']);
    expect(soKieu({ items: [{ ...goodSummary, discount: true }], page: 1, pageSize: 20, total: 1 }, S.page, 'p')[0]).toMatch(
      /^p\.items\[0\]\.discount: cần number/,
    );
  });

  it('thiếu hoặc thừa trường → lỗi', () => {
    const { code: _code, ...missing } = goodSummary;
    expect(soKieu(missing, S.summary, 's')).toEqual(['s: thiếu trường "code" (types.ts khai string)']);
    expect(soKieu({ ...goodSummary, travelTotal: 0 }, S.summary, 's')).toEqual(['s: thừa trường "travelTotal" (máy chủ trả number, types.ts không khai)']);
  });

  it('giá trị liệt kê, chuỗi ISO, số nguyên đồng', () => {
    expect(soKieu({ ...goodSummary, status: 'OPEN' }, S.summary, 's')[0]).toMatch(/^s\.status: giá trị "OPEN" không thuộc/);
    expect(soKieu({ ...goodSummary, createdAt: 'hôm qua' }, S.summary, 's')).toEqual(['s.createdAt: cần chuỗi ngày giờ ISO 8601, nhận "hôm qua"']);
    expect(soKieu({ ...goodSummary, total: 1.5 }, S.summary, 's')).toEqual(['s.total: cần số nguyên đồng, nhận 1.5']);
    expect(soKieu({ ...goodSummary, eventDate: 'x' }, S.summary, 's')[0]).toMatch(/^s\.eventDate: không khớp/);
  });

  it('kiểu tổng hợp: union theo nhánh, generic (id null ở bảng tính)', () => {
    expect(soKieu({ hasProfile: true, profile: null }, S.profile, 'r')[0]).toMatch(/^r: không khớp kiểu nào/);
    const line = S.quoteLine;
    if (line.k !== 'object') throw new Error('GroupedContractLine phải là object');
    expect(line.props.id?.kieu).toEqual({ k: 'null' });
    expect(Object.keys(line.props)).toEqual(expect.arrayContaining(['staff', 'staffWarnings', 'travelBreakdown', 'addons', 'travel']));
  });

  it('biểu thức sai tên kiểu → báo lỗi, không lặng lẽ coi là any', () => {
    expect(() => napKieu(join(HERE, 'types.ts'), join(HERE, '..', '..', 'tsconfig.json'), { x: 'KhongCoKieuNay' })).toThrow(/KhongCoKieuNay/);
  });
});
