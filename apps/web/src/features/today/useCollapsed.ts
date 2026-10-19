import { useCallback, useState } from 'react';

// Thu gọn / mở rộng một thẻ, nhớ trên máy (localStorage khoá `hom-nay:thu-gon:{key}`). Mọi lần đọc/ghi bọc try/catch:
// trình duyệt chặn lưu trữ (cửa sổ riêng tư, xoá dữ liệu) thì thẻ vẫn vẽ và vẫn thu gọn được trong phiên này.
const PREFIX = 'hom-nay:thu-gon:';

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(PREFIX + key) === '1';
  } catch {
    return false;
  }
}

function write(key: string, collapsed: boolean): void {
  try {
    if (collapsed) window.localStorage.setItem(PREFIX + key, '1');
    else window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Không lưu được: bỏ qua, lần sau mở lại sẽ mở rộng.
  }
}

export function useCollapsed(key: string): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => read(key));
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      write(key, !c);
      return !c;
    });
  }, [key]);
  return [collapsed, toggle];
}
