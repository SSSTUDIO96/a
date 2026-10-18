import { describe, expect, it } from 'vitest';
import {
  DESIGN_TEMPLATES,
  findDesignTemplate,
  listDesignTemplates,
  PHOTO_SLOTS,
  SLOT_SOURCES,
  slotsForContract,
  templateSupportsContract,
} from './design-templates';
import { DEFAULT_GREETING_PHRASES, phraseAppliesTo } from './greetings';

const codes = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);

describe('danh mục mẫu thiết kế', () => {
  it('đủ 26 mẫu đợt đầu: shd-01..10, fb-01..10, lc-01..06', () => {
    expect(DESIGN_TEMPLATES.map((t) => t.code).sort()).toEqual(
      [...codes('shd', 10), ...codes('fb', 10), ...codes('lc', 6)].sort(),
    );
  });
  it('mã mẫu không trùng', () => {
    const all = DESIGN_TEMPLATES.map((t) => t.code);
    expect(new Set(all).size).toBe(all.length);
  });
  it('mọi mẫu chỉ dùng khoá có trong SLOT_SOURCES, không lặp ô', () => {
    for (const t of DESIGN_TEMPLATES) {
      const unknown = t.slots.filter((s) => !Object.prototype.hasOwnProperty.call(SLOT_SOURCES, s));
      expect(unknown, t.code).toEqual([]);
      expect(new Set(t.slots).size, t.code).toBe(t.slots.length);
    }
  });
  it('mẫu chỉ cho khoá học không có ô chỉ của dịch vụ, và ngược lại', () => {
    for (const t of DESIGN_TEMPLATES) {
      expect(t.contractKinds.length, t.code).toBeGreaterThan(0);
      if (t.contractKinds.length === 1) {
        const other = t.contractKinds[0] === 'COURSE' ? 'SERVICE' : 'COURSE';
        const wrong = t.slots.filter((s) => SLOT_SOURCES[s].contract === other);
        expect(wrong, t.code).toEqual([]);
      }
    }
  });
  it('số ảnh khớp ô a1..a3 và bảng "Danh mục đợt đầu"', () => {
    const want: Record<string, number> = {
      ...Object.fromEntries(codes('shd', 10).map((c) => [c, 0])),
      'fb-01': 1, 'fb-02': 1, 'fb-03': 1, 'fb-04': 3, 'fb-05': 2, 'fb-06': 3, 'fb-07': 1, 'fb-08': 1, 'fb-09': 2, 'fb-10': 1,
      'lc-01': 1, 'lc-02': 1, 'lc-03': 1, 'lc-04': 2, 'lc-05': 0, 'lc-06': 1,
    };
    for (const t of DESIGN_TEMPLATES) {
      const photoSlots = t.slots.filter((s) => (PHOTO_SLOTS as readonly string[]).includes(s));
      expect(t.photos.max, t.code).toBe(want[t.code]);
      expect(photoSlots.length, t.code).toBe(t.photos.max);
      // Ảnh dùng ô liền nhau từ a1.
      expect(photoSlots.sort(), t.code).toEqual(PHOTO_SLOTS.slice(0, t.photos.max));
      expect(t.photos.min).toBeGreaterThanOrEqual(0);
      expect(t.photos.min).toBeLessThanOrEqual(t.photos.max);
      expect(t.photos.max).toBeLessThanOrEqual(3);
    }
  });
  it('loại hợp đồng theo bảng "Danh mục đợt đầu"', () => {
    const kinds = (code: string) => [...findDesignTemplate(code)!.contractKinds].sort().join('+');
    for (const c of codes('shd', 10)) expect(kinds(c), c).toBe('COURSE');
    for (const c of codes('fb', 10)) expect(kinds(c), c).toBe(c === 'fb-09' ? 'SERVICE' : 'COURSE+SERVICE');
    for (const c of ['lc-01', 'lc-03', 'lc-04', 'lc-06']) expect(kinds(c), c).toBe('SERVICE');
    expect(kinds('lc-02')).toBe('COURSE+SERVICE');
    expect(kinds('lc-05')).toBe('COURSE');
  });
  it('loại thẻ theo tiền tố mã; chỉ fb-02, fb-03 có sao; mẫu feedback có lời khen, mẫu lời chúc có tiêu đề + câu chúc', () => {
    for (const t of DESIGN_TEMPLATES) {
      const kind = t.code.startsWith('shd-') ? 'WELCOME' : t.code.startsWith('fb-') ? 'FEEDBACK' : 'GREETING';
      expect(t.kind, t.code).toBe(kind);
      expect(t.slots.includes('sao'), t.code).toBe(t.code === 'fb-02' || t.code === 'fb-03');
      if (t.kind === 'FEEDBACK') expect(t.slots, t.code).toContain('nd');
      if (t.kind === 'GREETING') expect(t.slots, t.code).toEqual(expect.arrayContaining(['td', 'cc']));
      expect(t.sizes, t.code).toEqual(['1080x1350', '1080x1080']);
      expect(t.version, t.code).toBeGreaterThanOrEqual(1);
      expect(t.fonts.length, t.code).toBeGreaterThan(0);
    }
  });
  it('tra mã lạ trả undefined, không trả mẫu đầu tiên', () => {
    expect(findDesignTemplate('shd-99')).toBeUndefined();
    expect(findDesignTemplate('')).toBeUndefined();
    expect(findDesignTemplate('SHD-01')).toBeUndefined();
    expect(findDesignTemplate('toString')).toBeUndefined();
    expect(findDesignTemplate('__proto__')).toBeUndefined();
    expect(findDesignTemplate('fb-09')?.name).toBe('Trước – sau');
  });
  it('lọc theo loại thẻ và loại hợp đồng', () => {
    expect(listDesignTemplates().length).toBe(26);
    expect(listDesignTemplates({ kind: 'WELCOME' }).length).toBe(10);
    expect(listDesignTemplates({ contractKind: 'SERVICE', kind: 'WELCOME' })).toEqual([]);
    expect(listDesignTemplates({ contractKind: 'COURSE', kind: 'FEEDBACK' }).map((t) => t.code)).not.toContain('fb-09');
    expect(listDesignTemplates({ contractKind: 'COURSE', kind: 'GREETING' }).map((t) => t.code).sort()).toEqual(['lc-02', 'lc-05']);
    expect(templateSupportsContract(findDesignTemplate('lc-05')!, 'SERVICE')).toBe(false);
  });
  it('mẫu cả hai loại: bản khoá học bỏ ô dịch vụ và ngược lại', () => {
    const fb01 = findDesignTemplate('fb-01')!;
    expect(slotsForContract(fb01, 'COURSE')).not.toEqual(expect.arrayContaining(['nv']));
    expect(slotsForContract(fb01, 'COURSE')).toEqual(expect.arrayContaining(['khoa', 'lop']));
    expect(slotsForContract(fb01, 'SERVICE')).toEqual(expect.arrayContaining(['nv', 'goi', 'nsk']));
    expect(slotsForContract(fb01, 'SERVICE')).not.toContain('khoa');
  });
});

describe('câu chúc soạn sẵn', () => {
  it('đủ 6 câu, tên không trùng, độ dài trong giới hạn bảng GreetingPhrase', () => {
    expect(DEFAULT_GREETING_PHRASES.length).toBe(6);
    expect(new Set(DEFAULT_GREETING_PHRASES.map((p) => p.name)).size).toBe(6);
    for (const p of DEFAULT_GREETING_PHRASES) {
      expect(p.title.length).toBeLessThanOrEqual(120);
      expect(p.body.length).toBeLessThanOrEqual(1000);
    }
  });
  it('nguyên văn R&D (đối chiếu hai câu đầu, cuối)', () => {
    expect(DEFAULT_GREETING_PHRASES[0]).toEqual({
      name: 'Ngày cưới',
      appliesTo: ['SERVICE'],
      title: 'Trăm năm hạnh phúc',
      body: 'Chúc hai bạn trăm năm hạnh phúc, luôn giữ trọn yêu thương như ngày hôm nay. Cảm ơn bạn đã tin tưởng để chúng tôi được góp một phần nhỏ vào ngày trọng đại.',
    });
    expect(DEFAULT_GREETING_PHRASES[5]?.body).toBe(
      'Chúc mừng em đã hoàn thành khoá học. Chúc em vững tay nghề, tự tin trên con đường trở thành chuyên viên trang điểm.',
    );
  });
  it('appliesTo rỗng = cả hai loại hợp đồng', () => {
    const both = DEFAULT_GREETING_PHRASES.find((p) => p.name === 'Cảm ơn đã tin chọn')!;
    expect(phraseAppliesTo(both.appliesTo, 'COURSE')).toBe(true);
    expect(phraseAppliesTo(both.appliesTo, 'SERVICE')).toBe(true);
    expect(DEFAULT_GREETING_PHRASES.filter((p) => phraseAppliesTo(p.appliesTo, 'COURSE')).map((p) => p.name)).toEqual([
      'Cảm ơn đã tin chọn',
      'Hoàn thành khoá học',
    ]);
  });
});
