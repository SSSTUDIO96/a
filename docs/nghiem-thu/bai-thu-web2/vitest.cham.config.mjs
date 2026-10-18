// Thợ chấm: chạy 2 bộ bài không nạp được vì thiếu platform.css / staff.css ở commit 193d6aa, thay tệp thiếu bằng rỗng.
import { defineConfig } from 'vitest/config';
const STUB = '\0cham-stub:';
export default defineConfig({
  root: new URL('..', import.meta.url).pathname,
  esbuild: { jsx: 'automatic' },
  plugins: [{ name: 'cham-stub', enforce: 'pre',
    resolveId(id, imp) { if (!imp) return null; if ((id === './PayRatesScreen' || id === './staff.css') && imp.includes('/features/staff/')) return STUB + id; if (id === './platform.css' && imp.includes('/features/platform/')) return STUB + id; return null; },
    load(id) { if (!id.startsWith(STUB)) return null; return id.endsWith('PayRatesScreen') ? 'export function PayRatesScreen(){return null}' : ''; } }],
  test: { environment: 'jsdom', globals: true, include: ['src/layout/AppShell.test.tsx', 'src/features/pricing/PricingPage.test.tsx'], testTimeout: 60000 },
});
