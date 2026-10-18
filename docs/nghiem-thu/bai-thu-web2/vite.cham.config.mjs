// CẤU HÌNH CỦA THỢ CHẤM — không phải mã sản phẩm.
// Commit 193d6aa không build được vì thiếu 3 tệp ngoài phạm vi chấm (staff/PayRatesScreen.tsx, staff/staff.css,
// platform/platform.css). Để chấm được 3 màn Bảng giá / Hợp đồng / Lịch, ta thay 3 tệp thiếu bằng mô-đun rỗng
// ngay lúc build, KHÔNG sửa tệp nào của sản phẩm.
import { defineConfig, mergeConfig } from 'vite';
import base from '../vite.config.ts';

const STUB = '\0cham-stub:';
const stubs = {
  './PayRatesScreen': 'export function PayRatesScreen(){ return null; }',
  './staff.css': '',
  './platform.css': '',
};
export default mergeConfig(base, defineConfig({
  root: new URL('..', import.meta.url).pathname,
  plugins: [{
    name: 'cham-stub-missing',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!importer) return null;
      if ((id === './PayRatesScreen' || id === './staff.css') && importer.includes('/features/staff/')) return STUB + id;
      if (id === './platform.css' && importer.includes('/features/platform/')) return STUB + id;
      return null;
    },
    load(id) {
      if (id.startsWith(STUB)) return stubs[id.slice(STUB.length)];
      return null;
    },
  }],
  build: { outDir: new URL('../cham-nt/dist', import.meta.url).pathname, emptyOutDir: true },
}));
