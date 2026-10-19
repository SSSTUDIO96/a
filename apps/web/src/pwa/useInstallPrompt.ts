import { useCallback, useEffect, useState } from 'react';

// Sự kiện chưa có trong lib.dom: Chromium (Android Chrome, Edge, Chrome máy tính) bắn khi app đủ điều kiện cài.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface InstallPrompt {
  /** Trình duyệt đã cho phép hiện hộp thoại cài (chỉ Chromium; iOS Safari không có). */
  canInstall: boolean;
  /** Hiện hộp thoại cài của trình duyệt. Trả true nếu người dùng đồng ý. */
  promptInstall: () => Promise<boolean>;
}

export function useInstallPrompt(): InstallPrompt {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBefore = (e: Event) => {
      e.preventDefault(); // giữ lại để bấm nút của mình mới hiện
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    setEvent(null); // mỗi sự kiện chỉ dùng được một lần
    return outcome === 'accepted';
  }, [event]);

  return { canInstall: event !== null, promptInstall };
}
