import { describe, expect, it } from 'vitest';
import {
  DESIGN_TEMPLATES,
  FRAME_SHAPES,
  FRAME_SLOTS,
  findDesignTemplate,
  listDesignTemplates,
  PHOTO_SLOTS,
  SLOT_SOURCES,
  slotsForContract,
  templateSupportsContract,
} from './design-templates';
import { CERTIFICATE_IMAGE, CERTIFICATE_TEMPLATE_CODES, CERTIFICATE_TEMPLATES } from './certificates';
import { DEFAULT_GREETING_PHRASES, phraseAppliesTo } from './greetings';

const codes = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`);

describe('danh mục mẫu thiết kế', () => {
  it('đủ 53 mẫu: cm-01..10, shd-01..11, fb-01..10, lc-01..06, cc-01..16', () => {
    expect(DESIGN_TEMPLATES.map((t) => t.code).sort()).toEqual(
      [...codes('cm', 10), ...codes('shd', 11), ...codes('fb', 10), ...codes('lc', 6), ...codes('cc', 16)].sort(),
    );
  });
  it('BẮT: mẫu chào mừng thứ 20 (shd-11) — khoá học, chữ ký nét mảnh, đủ ô, không ô ảnh tải lên', () => {
    const t = findDesignTemplate('shd-11');
    expect(t).toBeDefined();
    expect(t).toMatchObject({ kind: 'WELCOME', name: 'Chữ ký mảnh nền đá', contractKinds: ['COURSE'], origin: 'TU_SANG_TAC', version: 2, frameShape: 'pill', photoFrames: 1 });
    expect([...t!.slots].sort()).toEqual(['anh', 'diachi', 'gv', 'khoa', 'lich', 'logo', 'lop', 'ma', 'ngay', 'ten', 'th'].sort());
    expect(t!.fonts).toEqual(['MP Chữ ký 1', 'MP Chữ có chân', 'MP Chữ không chân']);
    expect(t!.photos).toEqual({ min: 0, max: 0 });
    // Mẫu mới nằm cuối nhóm chào mừng (lưới mẫu xếp theo thứ tự danh mục).
    expect(listDesignTemplates({ kind: 'WELCOME' }).at(-1)?.code).toBe('shd-11');
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
      ...Object.fromEntries([...codes('cm', 10), ...codes('shd', 11)].map((c) => [c, 0])),
      'fb-01': 1, 'fb-02': 1, 'fb-03': 1, 'fb-04': 3, 'fb-05': 2, 'fb-06': 3, 'fb-07': 1, 'fb-08': 1, 'fb-09': 2, 'fb-10': 1,
      'lc-01': 1, 'lc-02': 1, 'lc-03': 1, 'lc-04': 2, 'lc-05': 0, 'lc-06': 1,
      ...Object.fromEntries(codes('cc', 16).map((c) => [c, 0])),
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
  it('BẮT: mẫu nào cũng có ảnh — số khung ảnh (ảnh học viên + ảnh tải lên) đúng từng mẫu, tổng 60 khung (44 + 16 giấy chứng nhận)', () => {
    const want: Record<string, number> = {
      ...Object.fromEntries([...codes('cm', 10), ...codes('shd', 11)].map((c) => [c, 1])),
      'fb-01': 1, 'fb-02': 1, 'fb-03': 1, 'fb-04': 3, 'fb-05': 2, 'fb-06': 3, 'fb-07': 1, 'fb-08': 1, 'fb-09': 2, 'fb-10': 1,
      'lc-01': 1, 'lc-02': 1, 'lc-03': 1, 'lc-04': 2, 'lc-05': 1, 'lc-06': 1,
      ...Object.fromEntries(codes('cc', 16).map((c) => [c, 1])),
    };
    for (const t of DESIGN_TEMPLATES) {
      const frames = t.slots.filter((s) => (FRAME_SLOTS as readonly string[]).includes(s));
      expect(t.photoFrames, t.code).toBeGreaterThanOrEqual(1);
      expect(t.photoFrames, t.code).toBe(frames.length);
      expect(t.photoFrames, t.code).toBe(want[t.code]);
      // Ảnh học viên (dữ liệu) không tính vào số ảnh tải lên.
      expect(t.photos.max, t.code).toBe(frames.filter((s) => s !== 'anh').length);
    }
    expect(DESIGN_TEMPLATES.reduce((n, t) => n + t.photoFrames, 0)).toBe(60);
    // shd-01 "Thư mời kem" trước đây là mẫu duy nhất không có ảnh.
    expect(findDesignTemplate('shd-01')!.slots).toContain('anh');
  });
  it('BẮT: khung ảnh mặc định tròn; đúng 1 mẫu khung viên thuốc (shd-11) — cm-02 "Panel viên thuốc" đã đổi khung tròn (ký duyệt H, quyết định 1)', () => {
    expect(DESIGN_TEMPLATES.filter((t) => t.frameShape === 'pill').map((t) => t.code)).toEqual(['shd-11']);
    expect(findDesignTemplate('cm-02')?.frameShape).toBe('circle');
    expect(DESIGN_TEMPLATES.filter((t) => t.frameShape === 'circle')).toHaveLength(DESIGN_TEMPLATES.length - 1);
    for (const t of DESIGN_TEMPLATES) expect(FRAME_SHAPES, t.code).toContain(t.frameShape);
  });
  it('loại hợp đồng theo bảng "Danh mục đợt đầu"', () => {
    const kinds = (code: string) => [...findDesignTemplate(code)!.contractKinds].sort().join('+');
    for (const c of [...codes('cm', 10), ...codes('shd', 11)]) expect(kinds(c), c).toBe('COURSE');
    for (const c of codes('fb', 10)) expect(kinds(c), c).toBe(c === 'fb-09' ? 'SERVICE' : 'COURSE+SERVICE');
    for (const c of codes('cc', 16)) expect(kinds(c), c).toBe('COURSE');
    for (const c of ['lc-01', 'lc-03', 'lc-04', 'lc-06']) expect(kinds(c), c).toBe('SERVICE');
    expect(kinds('lc-02')).toBe('COURSE+SERVICE');
    expect(kinds('lc-05')).toBe('COURSE');
  });
  it('loại thẻ theo tiền tố mã; chỉ fb-02, fb-03 có sao; mẫu feedback có lời khen, mẫu lời chúc có tiêu đề + câu chúc', () => {
    for (const t of DESIGN_TEMPLATES) {
      const kind = t.code.startsWith('shd-') || t.code.startsWith('cm-') ? 'WELCOME' : t.code.startsWith('fb-') ? 'FEEDBACK' : t.code.startsWith('cc-') ? 'CERTIFICATE' : 'GREETING';
      expect(t.kind, t.code).toBe(kind);
      expect(t.slots.includes('sao'), t.code).toBe(t.code === 'fb-02' || t.code === 'fb-03');
      if (t.kind === 'FEEDBACK') expect(t.slots, t.code).toContain('nd');
      if (t.kind === 'GREETING') expect(t.slots, t.code).toEqual(expect.arrayContaining(['td', 'cc']));
      expect(t.sizes, t.code).toEqual(t.kind === 'CERTIFICATE' ? ['1754x1240'] : ['1080x1350', '1080x1080']);
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
    expect(listDesignTemplates().length).toBe(53);
    expect(listDesignTemplates({ kind: 'CERTIFICATE' }).length).toBe(16);
    expect(listDesignTemplates({ kind: 'CERTIFICATE', contractKind: 'SERVICE' })).toEqual([]);
    expect(listDesignTemplates({ kind: 'WELCOME' }).length).toBe(21);
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

describe('bản vẽ H — 21 mẫu chào mừng có ô mã số', () => {
  const welcome = () => listDesignTemplates({ kind: 'WELCOME' });
  it('BẮT: 21 mẫu chào mừng — 10 mẫu cm đứng TRƯỚC 11 mẫu shd, đúng thứ tự', () => {
    expect(welcome().map((t) => t.code)).toEqual([...codes('cm', 10), ...codes('shd', 11)]);
  });
  it('BẮT: mọi mẫu chào mừng có ô `ma` (mã số trong lớp, chỉ hợp đồng khoá học); mẫu loại khác không có', () => {
    expect(SLOT_SOURCES.ma).toMatchObject({ label: 'Mã số trong lớp', contract: 'COURSE' });
    expect(SLOT_SOURCES.ma.from).toContain('Enrollment.seatNo');
    expect(welcome().filter((t) => !t.slots.includes('ma')).map((t) => t.code)).toEqual([]);
    expect(DESIGN_TEMPLATES.filter((t) => t.kind !== 'WELCOME' && t.slots.includes('ma')).map((t) => t.code)).toEqual([]);
  });
  it('BẮT: 11 mẫu shd đổi bố cục (thêm khối mã) → version 2; 10 mẫu cm version 1', () => {
    for (const t of welcome()) expect(t.version, t.code).toBe(t.code.startsWith('shd-') ? 2 : 1);
  });
  it('BẮT: cờ isNew chỉ ở 10 mẫu cm (ô chọn mẫu vẽ nhãn "Mới")', () => {
    expect(DESIGN_TEMPLATES.filter((t) => t.isNew).map((t) => t.code)).toEqual(codes('cm', 10));
    for (const t of DESIGN_TEMPLATES) if (!t.code.startsWith('cm-')) expect(Object.prototype.hasOwnProperty.call(t, 'isNew'), t.code).toBe(false);
  });
  it('BẮT: tên 10 mẫu cm theo R&D-10, phông chữ ký có sẵn trong app (MonteCarlo = Chữ ký 5, Ephesis = Chữ ký 6), học từ ảnh anh gửi', () => {
    const want: [string, string, number][] = [
      ['cm-01', 'Giấy dấu sáp', 5], ['cm-02', 'Panel viên thuốc', 6], ['cm-03', 'Tem răng cưa', 5], ['cm-04', 'Thư giấy vân', 5],
      ['cm-05', 'Bằng khen cổ điển', 6], ['cm-06', 'Tờ tiền xanh', 5], ['cm-07', 'Thảm Ba Tư', 5], ['cm-08', 'Giấy xé + washi', 6],
      ['cm-09', 'Thiệp gập ruy băng', 5], ['cm-10', 'Gương oval cổ điển', 5],
    ];
    for (const [code, name, ky] of want) {
      const t = findDesignTemplate(code)!;
      expect(t, code).toMatchObject({ kind: 'WELCOME', name, contractKinds: ['COURSE'], origin: 'HOC_TU_ANH', frameShape: 'circle', photoFrames: 1, photos: { min: 0, max: 0 } });
      expect(t.fonts, code).toEqual([`MP Chữ ký ${ky}`, 'MP Chữ có chân', 'MP Chữ đậm có chân', 'MP Chữ không chân']);
      expect([...t.slots].sort(), code).toEqual(['anh', 'diachi', 'khoa', 'logo', 'lop', 'ma', 'ngay', 'ten', 'th']);
    }
    // Không dùng phông viết tay "MP Viết tay N" (trong app là Imperial Script…, KHÔNG phải MonteCarlo/Ephesis của R&D).
    for (const t of welcome().filter((x) => x.code.startsWith('cm-'))) expect(t.fonts.some((f) => f.startsWith('MP Viết tay')), t.code).toBe(false);
    expect(new Set(welcome().map((t) => t.name)).size).toBe(21);
  });
});

describe('giấy chứng nhận cc-01..cc-16 (bản vẽ F, đính chính 19/10/2026 tối)', () => {
  const certs = () => listDesignTemplates({ kind: 'CERTIFICATE' });
  it('BẮT: danh mục CERTIFICATE đúng 16 mã, khớp CERTIFICATE_TEMPLATE_CODES (hai nơi không lệch)', () => {
    expect(certs().map((t) => t.code)).toEqual(codes('cc', 16));
    expect(certs().map((t) => t.code)).toEqual([...CERTIFICATE_TEMPLATE_CODES]);
    for (const t of certs()) expect(t.version, t.code).toBe(CERTIFICATE_TEMPLATES[t.code as keyof typeof CERTIFICATE_TEMPLATES].version);
    // Mã cc-* không nằm ngoài loại CERTIFICATE.
    expect(DESIGN_TEMPLATES.filter((t) => t.code.startsWith('cc-') !== (t.kind === 'CERTIFICATE'))).toEqual([]);
  });
  it('BẮT: mọi mẫu giấy chỉ khổ A4 ngang 1754x1240 (= CERTIFICATE_IMAGE), khung ảnh tròn, một khung (ảnh học viên), không ảnh tải lên', () => {
    expect(`${CERTIFICATE_IMAGE.width}x${CERTIFICATE_IMAGE.height}`).toBe('1754x1240');
    for (const t of certs()) {
      expect(t.sizes, t.code).toEqual(['1754x1240']);
      expect(t.frameShape, t.code).toBe('circle');
      expect(t.photoFrames, t.code).toBe(1);
      expect(t.photos, t.code).toEqual({ min: 0, max: 0 });
      expect(t.contractKinds, t.code).toEqual(['COURSE']);
    }
  });
  it('BẮT: 12 ô chung đủ khoá, ô riêng của giấy (so, ncap, lai, gd, gdcv) chỉ thuộc khoá học; mẫu thẻ cũ không có ô nào trong số đó', () => {
    const want = ['logo', 'th', 'anh', 'ten', 'khoa', 'lop', 'so', 'ncap', 'lai', 'gv', 'gd', 'gdcv'].sort();
    for (const t of certs()) expect([...t.slots].sort(), t.code).toEqual(want);
    for (const k of ['so', 'ncap', 'lai', 'gd', 'gdcv'] as const) {
      expect(SLOT_SOURCES[k].contract, k).toBe('COURSE');
      expect(DESIGN_TEMPLATES.filter((t) => t.kind !== 'CERTIFICATE' && t.slots.includes(k)), k).toEqual([]);
    }
  });
  it('BẮT: nguồn gốc 01–05 và 16 học từ ảnh anh Chiến gửi, 06–15 tự sáng tạo; tên mẫu không trùng', () => {
    for (const t of certs()) {
      const n = Number(t.code.slice(3));
      expect(t.origin, t.code).toBe(n <= 5 || n === 16 ? 'HOC_TU_ANH' : 'TU_SANG_TAC');
    }
    expect(new Set(certs().map((t) => t.name)).size).toBe(16);
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
