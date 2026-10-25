import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PRINT_LAYOUTS, TOGGLE_BLOCKS, formatVnd, type ContractPrintData, type PrintLayout, type ToggleBlockKey } from '@makeup/shared';
import { PrintPaper } from './PrintPaper';
import { cssString } from './pageCss';
import { SAMPLE, SAMPLE_LOGO, sampleConfig } from './sampleData';

// Bố cục: 5 × 2 loại dựng được; tắt từng khối thì chữ đặc trưng biến mất; khối luôn có luôn có; che theo quyền; biến được thay;
// không dangerouslySetInnerHTML (L10); phụ phí in tên + tiền; BẢN NHÁP.

// Thư mục paper (bài chạy ở apps/web — lệnh vitest của gói luôn đặt cwd ở đó).
const PAPER_DIR = join(process.cwd(), 'src/features/contract-print/paper');
const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ');
function paper(layout: PrintLayout, data: ContractPrintData, off: ToggleBlockKey[] = [], on: ToggleBlockKey[] = []) {
  const overrides: Partial<Record<ToggleBlockKey, boolean>> = {};
  for (const k of off) overrides[k] = false;
  for (const k of on) overrides[k] = true;
  const config = sampleConfig(layout, data.kind, overrides);
  const r = render(<PrintPaper data={data} config={config} logoUrl={SAMPLE_LOGO} />);
  const art = r.container.querySelector('article.hdin-giay')!;
  return { ...r, art, txt: text(art), css: r.container.querySelector('style')!.textContent ?? '' };
}

describe('PrintPaper: 5 bố cục × 2 loại dựng được', () => {
  for (const layout of PRINT_LAYOUTS) {
    for (const [kind, key] of [['SERVICE', 'long'], ['SERVICE', 'short'], ['COURSE', 'long'], ['COURSE', 'short']] as const) {
      const data = SAMPLE[kind][key];
      it(`bố cục ${layout} · ${kind} · ${key}: có tiêu đề, bảng, tổng tiền (đúng số trong dữ liệu), tiền bằng chữ, chỗ ký`, () => {
        const { art, txt } = paper(layout, data);
        expect(art.className).toContain(`hdin-g${layout}`);
        expect(art.querySelectorAll('h1')).toHaveLength(1);
        expect(txt).toContain(sampleConfig(layout, kind).title.charAt(0) === 'H' ? '' : '');
        expect(txt).toContain(formatVnd(data.money.total));
        expect(txt).toContain(data.money.totalInWords);
        for (const l of data.lines) expect(txt).toContain(l.name);
        expect(art.querySelector('.hdin-ky')).not.toBeNull();
        expect(txt).toContain(data.contract.code);
      });
    }
  }
});

describe('PrintPaper: tắt từng khối → chữ đặc trưng của khối biến mất', () => {
  // [khối, bố cục, loại, bản, chữ đặc trưng — có khi bật, vắng khi tắt]
  const CASES: [ToggleBlockKey, PrintLayout, 'SERVICE' | 'COURSE', 'long' | 'short', string][] = [
    ['quoc-hieu', 1, 'SERVICE', 'long', 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
    ['quoc-hieu', 3, 'COURSE', 'long', 'Độc lập – Tự do – Hạnh phúc'],
    ['dau-trang', 2, 'SERVICE', 'long', 'lienhe@chienmakeup.vn'],
    ['dau-trang', 5, 'COURSE', 'long', 'Trang điểm cô dâu · Đào tạo makeup chuyên nghiệp'],
    ['hai-ben', 1, 'SERVICE', 'long', 'chúng tôi gồm'],
    ['hai-ben', 2, 'COURSE', 'long', 'Học viên · Bên B'],
    ['hai-ben', 3, 'SERVICE', 'long', 'Đại diện'],
    ['giay-to', 1, 'SERVICE', 'long', 'CCCD'],
    ['giay-to', 2, 'COURSE', 'long', 'CCCD'],
    ['chu-dau', 2, 'SERVICE', 'long', 'Hai bên thoả thuận ký hợp đồng dịch vụ'],
    ['chu-dau', 4, 'COURSE', 'long', 'Hai bên thoả thuận ký hợp đồng đào tạo'],
    ['chi-tiet', 1, 'SERVICE', 'long', '05:00–07:30'],
    ['chi-tiet', 3, 'COURSE', 'long', 'Giảng viên: Nguyễn Trọng Chiến'],
    ['tho', 2, 'SERVICE', 'long', 'Thợ chính: Chiến'],
    ['bang-chu', 1, 'SERVICE', 'long', 'Bảy triệu một trăm năm mươi hai nghìn đồng'],
    ['bang-chu', 4, 'COURSE', 'long', 'Mười lăm triệu hai trăm nghìn đồng'],
    ['tien-do', 1, 'SERVICE', 'long', 'Tiến độ thanh toán'],
    ['tien-do', 5, 'COURSE', 'long', 'Tiến độ thanh toán'],
    ['da-thu', 3, 'SERVICE', 'long', 'PT-000341'],
    ['da-thu', 2, 'COURSE', 'long', 'PT-000355'],
    ['chuyen-khoan', 1, 'SERVICE', 'long', 'NGUYEN TRONG CHIEN'],
    ['chuyen-khoan', 3, 'COURSE', 'long', '001100456789'],
    ['dieu-khoan', 1, 'SERVICE', 'long', 'Tiền cọc không hoàn lại nếu Bên B huỷ'],
    ['dieu-khoan', 3, 'COURSE', 'long', 'Học phí ghi trong hợp đồng là học phí trọn khoá'],
    ['noi-quy', 1, 'COURSE', 'long', 'Tắt chuông điện thoại trong giờ học'],
    ['noi-quy', 5, 'COURSE', 'long', 'Mặc trang phục gọn gàng'],
    ['ghi-chu', 2, 'SERVICE', 'long', 'tông trang điểm Hàn Quốc nhẹ'],
    ['chu-cuoi', 1, 'SERVICE', 'long', 'lập thành 02 bản có giá trị như nhau'],
    ['chu-cuoi', 4, 'COURSE', 'long', 'lập thành 02 bản có giá trị như nhau'],
    ['ky-nhay', 2, 'SERVICE', 'long', 'Ký nháy'],
    ['so-trang', 2, 'SERVICE', 'long', 'Trang'],
  ];
  for (const [block, layout, kind, key, marker] of CASES) {
    it(`khối "${block}" (${TOGGLE_BLOCKS[block].label}) · bố cục ${layout} · ${kind}: "${marker.slice(0, 32)}" có khi bật, mất khi tắt`, () => {
      const data = SAMPLE[kind][key];
      // Khối nằm trong chữ chân trang (CSS) được kiểm trên <style>, còn lại trên chữ của tờ.
      const forceOn: ToggleBlockKey[] = ['quoc-hieu', 'ky-nhay', 'giay-to'].includes(block) ? [block] : [];
      const where = (r: ReturnType<typeof paper>) => (block === 'ky-nhay' || block === 'so-trang' ? r.css : r.txt);
      const withBlock = paper(layout, data, [], forceOn);
      expect(where(withBlock), `${block} bật mà thiếu "${marker}"`).toContain(marker);
      withBlock.unmount();
      const without = paper(layout, data, [block]);
      expect(where(without), `${block} đã tắt mà vẫn còn "${marker}"`).not.toContain(marker);
    });
  }

  it('khối bật/tắt của loại khác không có công tắc: "noi-quy" và "tho" không bao giờ hiện ở hợp đồng không thuộc loại đó', () => {
    const a = paper(1, SAMPLE.SERVICE.long, [], ['noi-quy']);
    expect(a.txt).not.toContain('Nội quy');
    a.unmount();
    const b = paper(1, SAMPLE.COURSE.long, [], ['tho']);
    expect(b.txt).not.toContain('Thợ chính');
  });

  it('4 khối LUÔN CÓ vẫn có khi tắt hết 17 khối bật/tắt: tiêu đề, bảng dịch vụ, tổng tiền, chỗ ký', () => {
    const all = Object.keys(TOGGLE_BLOCKS) as ToggleBlockKey[];
    for (const layout of PRINT_LAYOUTS) {
      for (const kind of ['SERVICE', 'COURSE'] as const) {
        const data = SAMPLE[kind].long;
        const { art, txt, unmount } = paper(layout, data, all);
        expect(art.querySelectorAll('h1'), `bố cục ${layout} ${kind}: tiêu đề`).toHaveLength(1);
        expect(txt, `bố cục ${layout} ${kind}: bảng`).toContain(data.lines[0]!.name);
        expect(txt, `bố cục ${layout} ${kind}: tổng tiền`).toContain(formatVnd(data.money.total));
        expect(art.querySelector('.hdin-ky'), `bố cục ${layout} ${kind}: chỗ ký`).not.toBeNull();
        unmount();
      }
    }
  });
});

describe('PrintPaper: che theo quyền người xem', () => {
  const hiddenContact: ContractPrintData = { ...SAMPLE.SERVICE.long, customer: { ...SAMPLE.SERVICE.long.customer, phone: null, email: null, contactHidden: true } };
  const hiddenPay: ContractPrintData = { ...SAMPLE.SERVICE.long, payments: null, paymentsHidden: true };

  for (const layout of PRINT_LAYOUTS) {
    it(`bố cục ${layout}: contactHidden → SĐT và email in "……", không lộ số thật`, () => {
      const { txt } = paper(layout, hiddenContact);
      expect(txt).toContain('……');
      expect(txt).not.toContain('0903 456 789');
      expect(txt).not.toContain('thutrang.ng@gmail.com');
    });
    it(`bố cục ${layout}: paymentsHidden → không có "Tiến độ thanh toán", "Đã thu", phiếu thu, "Còn phải thanh toán"`, () => {
      const { txt } = paper(layout, hiddenPay);
      for (const s of ['Tiến độ thanh toán', 'Đã thu', 'Đã thanh toán', 'PT-000341', 'Còn phải thanh toán', 'Chưa thu']) expect(txt, s).not.toContain(s);
      expect(txt).toContain(formatVnd(hiddenPay.money.total));
    });
  }

  it('biến {SĐT khách}, {Đã thu}, {Còn lại} trong chữ mở đầu bị che → "……"', () => {
    const config = { ...sampleConfig(1, 'SERVICE'), openingText: 'SĐT {SĐT khách} đã thu {Đã thu} còn {Còn lại}' };
    const r = render(<PrintPaper data={{ ...hiddenContact, payments: null, paymentsHidden: true }} config={config} logoUrl={null} />);
    expect(text(r.container)).toContain('SĐT …… đã thu …… còn ……');
  });
});

describe('PrintPaper: biến được thay, tiền bằng chữ từ dữ liệu', () => {
  it('chữ mở đầu / kết thúc mang biến: giá trị thay vào thành chữ thường trong span.hdin-bien; biến lạ giữ nguyên', () => {
    const config = {
      ...sampleConfig(2, 'SERVICE'),
      openingText: 'Khách {Tên khách} · mã {Mã hợp đồng} · tổng {Tổng tiền} ({Tổng tiền bằng chữ}) · {Biến lạ}',
      closingText: 'Cọc {Tiền cọc}, ngày lập {Ngày lập}',
    };
    const d = SAMPLE.SERVICE.long;
    const r = render(<PrintPaper data={d} config={config} logoUrl={null} />);
    const t = text(r.container.querySelector('article')!);
    expect(t).toContain(`Khách ${d.customer.fullName} · mã ${d.contract.code} · tổng ${formatVnd(d.money.total)} (${d.money.totalInWords}) · {Biến lạ}`);
    expect(t).toContain('Cọc 2.000.000 ₫, ngày lập 20/10/2026');
    expect(r.container.querySelectorAll('span.hdin-bien').length).toBe(6);
  });

  it('tiền bằng chữ in đúng chuỗi trong dữ liệu (không tự đọc lại số): đổi chuỗi trong dữ liệu thì bản in đổi theo', () => {
    const d = { ...SAMPLE.SERVICE.long, money: { ...SAMPLE.SERVICE.long.money, totalInWords: 'Chuỗi do máy chủ đọc' } };
    const { txt } = paper(2, d);
    expect(txt).toContain('Chuỗi do máy chủ đọc');
    expect(txt).not.toContain('Bảy triệu');
  });

  it('tổng, giảm, tạm tính, cọc, đã thu, còn lại: in đúng số trong dữ liệu — đổi số trong dữ liệu thì bản in đổi theo, không tự cộng lại', () => {
    const base = SAMPLE.SERVICE.long;
    const d: ContractPrintData = {
      ...base,
      money: { ...base.money, subtotal: 1_111_111, discount: 222_222, total: 333_333, depositRequired: 444_444 },
      payments: { ...base.payments!, paid: 555_555, remaining: 666_666 },
    };
    for (const layout of PRINT_LAYOUTS) {
      const { txt, unmount } = paper(layout, d);
      // Mẫu 4 (gọn một trang) không in tổng "Đã thu" — chỉ các phiếu thu và "Còn lại".
      const nums = [1_111_111, 222_222, 333_333, 444_444, 666_666, ...(layout === 4 ? [] : [555_555])];
      for (const n of nums) expect(txt, `bố cục ${layout}: ${n}`).toContain(formatVnd(n));
      unmount();
    }
  });
});

describe('PrintPaper: phụ phí in tên + số lượng + tiền; ngày riêng khi nhiều ngày', () => {
  it('hợp đồng dài: cả hai phụ phí in đúng tên và thành tiền ở cả 5 bố cục', () => {
    for (const layout of PRINT_LAYOUTS) {
      const { txt, unmount } = paper(layout, SAMPLE.SERVICE.long);
      expect(txt, `bố cục ${layout}`).toContain('Phụ phí ca sớm (bắt đầu trước 5:30)');
      expect(txt).toContain('300.000 ₫');
      expect(txt).toContain('Phụ phí ca sớm — phù dâu');
      expect(txt).toContain('100.000 ₫');
      unmount();
    }
  });

  it('KHÔNG in tên luật, "tự thêm theo luật", ghi chú ghi đè dù dữ liệu có mang theo', () => {
    const base = SAMPLE.SERVICE.long;
    const d = {
      ...base,
      lines: base.lines.map((l) => ({ ...l, surcharges: l.surcharges.map((s) => ({ ...s, ruleName: 'LUAT-CA-SOM', note: 'ghi đè giá thủ công', origin: 'tự thêm theo luật' })) })),
    } as ContractPrintData;
    for (const layout of PRINT_LAYOUTS) {
      const { art, txt, unmount } = paper(layout, d);
      for (const s of ['LUAT-CA-SOM', 'ghi đè giá', 'tự thêm theo luật']) expect(txt + art.innerHTML, s).not.toContain(s);
      unmount();
    }
  });

  it('hợp đồng nhiều ngày: mỗi dòng có "dd/mm · HH:MM–HH:MM" ở cả 5 bố cục; một ngày thì không', () => {
    for (const layout of PRINT_LAYOUTS) {
      const multi = paper(layout, SAMPLE.SERVICE.multiDay);
      for (const s of ['11/12 · 06:30–08:30', '12/12 · 04:30–07:30', '13/12 · 08:00–09:30']) expect(multi.txt, `bố cục ${layout}: ${s}`).toContain(s);
      multi.unmount();
      const single = paper(layout, SAMPLE.SERVICE.long);
      expect(single.txt).not.toMatch(/\d\d\/\d\d · \d\d:\d\d–/);
      single.unmount();
    }
  });
});

describe('PrintPaper: BẢN NHÁP, dấu lần in, logo', () => {
  const draft: ContractPrintData = { ...SAMPLE.SERVICE.long, contract: { ...SAMPLE.SERVICE.long.contract, status: 'DRAFT' } };
  for (const layout of PRINT_LAYOUTS) {
    it(`bố cục ${layout}: bản nháp ghi "BẢN NHÁP" cạnh số hợp đồng VÀ ở chân trang; bản đã xác nhận thì không`, () => {
      const d = paper(layout, draft);
      expect(d.art.querySelector('.hdin-nhap')?.textContent).toBe('BẢN NHÁP');
      expect(d.css).toContain('BẢN NHÁP');
      d.unmount();
      const c = paper(layout, SAMPLE.SERVICE.long);
      expect(c.art.querySelector('.hdin-nhap')).toBeNull();
      expect(c.css).not.toContain('BẢN NHÁP');
    });
  }

  it('chân trang: số hợp đồng + "Trang x / y"; ký nháy chỉ khi bật; dấu lần in', () => {
    const r = render(
      <PrintPaper data={SAMPLE.SERVICE.long} config={sampleConfig(1, 'SERVICE')} logoUrl={null} printMark={{ printNo: 3, printedOn: '2026-10-25', source: 'TEMPLATE' }} />,
    );
    const css = r.container.querySelector('style')!.textContent!;
    expect(css).toContain('@page hdin-1');
    expect(css).toContain('HĐDV-000128 · In lần 3 · 25/10/2026');
    expect(css).toContain('counter(page)');
    expect(css).toContain('Ký nháy');
    r.unmount();
    const again = render(
      <PrintPaper data={SAMPLE.SERVICE.long} config={sampleConfig(2, 'SERVICE')} logoUrl={null} printMark={{ printNo: 2, printedOn: '2026-10-25', source: 'REPRINT' }} />,
    );
    expect(again.container.querySelector('style')!.textContent).toContain('In lại bản lần 2 · 25/10/2026');
    expect(again.container.querySelector('style')!.textContent).not.toContain('Ký nháy');
  });

  it('logo: có URL thì có <img> với alt; không URL thì không có ảnh', () => {
    const a = paper(1, SAMPLE.SERVICE.long);
    expect(a.art.querySelector('img.hdin-lg')?.getAttribute('alt')).toBe('Logo Chiến Makeup Studio');
    a.unmount();
    const r = render(<PrintPaper data={SAMPLE.SERVICE.long} config={sampleConfig(1, 'SERVICE')} logoUrl={null} />);
    expect(r.container.querySelector('img')).toBeNull();
  });

  it('dữ liệu phiên bản lạ hoặc bố cục lạ → ném lỗi, không vẽ đại', () => {
    const bad = { ...SAMPLE.SERVICE.long, version: 2 } as unknown as ContractPrintData;
    expect(() => render(<PrintPaper data={bad} config={sampleConfig(1, 'SERVICE')} logoUrl={null} />)).toThrow(/phiên bản/);
    const cfg = { ...sampleConfig(1, 'SERVICE'), layout: 9 } as unknown as ReturnType<typeof sampleConfig>;
    expect(() => render(<PrintPaper data={SAMPLE.SERVICE.long} config={cfg} logoUrl={null} />)).toThrow(/Bố cục/);
  });
});

describe('PrintPaper: L10 — không dangerouslySetInnerHTML; chuỗi đưa vào CSS đi qua cssString()', () => {
  it('tên khách "<b>x</b>" ra CHỮ, không thành phần tử', () => {
    const d: ContractPrintData = { ...SAMPLE.SERVICE.long, customer: { ...SAMPLE.SERVICE.long.customer, fullName: '<b>x</b><img src=x onerror=alert(1)>' } };
    for (const layout of PRINT_LAYOUTS) {
      const { art, txt, unmount } = paper(layout, d);
      expect(txt, `bố cục ${layout}`).toContain('<b>x</b>');
      expect(art.querySelector('b:not([class])')?.textContent ?? '').not.toBe('x');
      expect(art.querySelector('img[src="x"]')).toBeNull();
      unmount();
    }
  });

  it('tên khách, mã hợp đồng, ghi chú, điều khoản mang thẻ HTML đều ra chữ ở mọi chỗ (kể cả điều khoản / ghi chú / nội quy)', () => {
    const evil = '<script>alert(1)</script><i>nghiêng</i>';
    const base = SAMPLE.COURSE.long;
    const d: ContractPrintData = {
      ...base,
      contract: { ...base.contract, notes: evil },
      terms: { ...base.terms!, items: [evil, ...base.terms!.items] },
      rules: { ...base.rules!, items: [evil] },
    };
    for (const layout of PRINT_LAYOUTS) {
      const base = paper(layout, { ...d, contract: { ...d.contract, notes: 'ghi chú thường' }, terms: { ...d.terms!, items: ['một'] }, rules: { ...d.rules!, items: ['hai'] } });
      const own = base.art.querySelectorAll('i').length; // số <i> do bộ vẽ tự đặt (ký tên, gạch quốc hiệu)
      base.unmount();
      const { art, unmount } = paper(layout, d);
      expect(art.querySelector('script')).toBeNull();
      expect(art.querySelectorAll('i').length, 'dữ liệu không được sinh thêm thẻ <i>').toBe(own);
      expect(art.textContent).toContain(evil);
      unmount();
    }
  });

  it('cssString: bỏ xuống dòng, thoát \\ và ", bỏ <', () => {
    expect(cssString('a"b')).toBe('a\\"b');
    expect(cssString('a\\b')).toBe('a\\\\b');
    expect(cssString('a\nb\r\nc')).toBe('a b c');
    expect(cssString('x</style><script>')).toBe('x/style>script>');
    expect(cssString('\\"')).toBe('\\\\\\"');
  });

  it('mã hợp đồng có " và \\ được thoát trong <style>; không đóng được thẻ style', () => {
    const d: ContractPrintData = { ...SAMPLE.SERVICE.long, contract: { ...SAMPLE.SERVICE.long.contract, code: 'HD"}\\</style><b>x' } };
    const { css, container } = paper(2, d);
    expect(css).toContain('content: "HD\\"}\\\\/style>b>x"');
    expect(css).not.toContain('</style>');
    expect(container.querySelectorAll('style')).toHaveLength(1);
  });

  it('BẮT: mã nguồn thư mục paper không dùng dangerouslySetInnerHTML / innerHTML / document.write', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
    const files = walk(PAPER_DIR).filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThan(15);
    for (const f of files) {
      const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML|document\.write/);
    }
  });
});

describe('PrintPaper: L6 — khung viền mẫu 5 rỗng và aria-hidden', () => {
  it('.hdin-khung-trang có đúng 1, rỗng (không chữ, không con), aria-hidden; mẫu khác không có', () => {
    const five = paper(5, SAMPLE.SERVICE.long);
    const frames = five.art.querySelectorAll('.hdin-khung-trang');
    expect(frames).toHaveLength(1);
    expect(frames[0]!.textContent).toBe('');
    expect(frames[0]!.children).toHaveLength(0);
    expect(frames[0]!.getAttribute('aria-hidden')).toBe('true');
    five.unmount();
    for (const layout of [1, 2, 3, 4] as const) {
      const p = paper(layout, SAMPLE.SERVICE.long);
      expect(p.art.querySelector('.hdin-khung-trang')).toBeNull();
      p.unmount();
    }
  });
});
