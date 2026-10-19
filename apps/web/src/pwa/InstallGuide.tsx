import { Button } from '../ui/Button';
import { IconUpload, IconWarn } from '../ui/icons';
import { isIOS, isStandalone, isZaloInApp } from './platform';
import { useInstallPrompt } from './useInstallPrompt';
import './pwa.css';

export interface InstallGuideProps {
  /** staff: app nhân viên ("/"). portal: cổng học viên ("/hv"), thêm bước nhập mã chuyển sang app. */
  variant: 'staff' | 'portal';
  /** Chỉ variant portal: bấm "Lấy mã chuyển sang app" (W2 gọi máy chủ cấp mã rồi hiện mã). */
  onGetHandoffCode?: () => void;
}

/**
 * Hướng dẫn cài lên màn hình chính — bản vẽ E mục 5.3, bám ảnh ip-1-huong-dan-cai-390.png.
 *   Đã chạy như app (standalone): không hiện gì.
 *   Trong Zalo: chỉ dải vàng "Mở bằng trình duyệt trước" (Zalo không cài được).
 *   Android/Chrome có beforeinstallprompt: nút "Cài app".
 *   Còn lại (iPhone Safari...): 4 bước; portal thêm bước nhập mã chuyển sang app.
 */
export function InstallGuide({ variant, onGetHandoffCode }: InstallGuideProps) {
  const { canInstall, promptInstall } = useInstallPrompt();

  if (isStandalone()) return null;

  if (isZaloInApp()) {
    return (
      <div className="pwa-guide" data-testid="install-guide">
        <div className="pwa-banner" role="note">
          <IconWarn />
          <p>
            <strong>Đang mở trong Zalo?</strong> Bấm nút <strong>•••</strong> góc phải trên → <strong>Mở bằng trình duyệt</strong>. Trong Zalo không cài được.
          </p>
        </div>
        <p className="pwa-guide__note">Mở bằng trình duyệt trước, rồi quay lại đây để xem cách cài.</p>
      </div>
    );
  }

  const portal = variant === 'portal';
  const host = typeof location === 'undefined' ? '' : location.host;
  const ios = isIOS();

  return (
    <div className="pwa-guide" data-testid="install-guide">
      {canInstall && (
        <div className="pwa-card pwa-card--row">
          <div className="pwa-card__text">
            <strong>Cài {portal ? 'trang học viên' : 'Makeup Pro'} lên điện thoại</strong>
            <span>Mở toàn màn hình, không có thanh địa chỉ.</span>
          </div>
          <Button variant="primary" onClick={() => void promptInstall()}>
            Cài app
          </Button>
        </div>
      )}

      <ol className="pwa-card pwa-steps" aria-label={ios || !canInstall ? 'Các bước cài lên màn hình chính' : undefined}>
        <li>
          <span className="pwa-steps__n" aria-hidden="true">1</span>
          <div>
            <strong>Mở trang bằng Safari</strong>
            <span>Địa chỉ: {host || 'địa chỉ trang này'}</span>
          </div>
        </li>
        <li>
          <span className="pwa-steps__n" aria-hidden="true">2</span>
          <div>
            <strong>
              Bấm nút Chia sẻ <IconUpload className="pwa-inline-ico" />
            </strong>
            <span>Ô vuông có mũi tên lên, ở thanh dưới của Safari.</span>
          </div>
        </li>
        <li>
          <span className="pwa-steps__n" aria-hidden="true">3</span>
          <div>
            <strong>Chọn “Thêm vào MH chính”</strong>
            <span>
              Kéo danh sách xuống nếu chưa thấy, rồi bấm <b>Thêm</b>.
            </span>
          </div>
        </li>
        <li>
          <span className="pwa-steps__n" aria-hidden="true">4</span>
          <div>
            <strong>Mở bằng biểu tượng mới</strong>
            <span>{portal ? 'Tên dưới biểu tượng là tên trung tâm. Mở ra là toàn màn hình, không có thanh địa chỉ.' : 'Tên “Makeup Pro”, mở toàn màn hình, không có thanh địa chỉ. Đăng nhập một lần là dùng tiếp được.'}</span>
          </div>
        </li>
        {portal && (
          <li>
            <span className="pwa-steps__n" aria-hidden="true">5</span>
            <div>
              <strong>Chuyển phiên sang app</strong>
              <span>
                Mở app, bấm <b>Tôi có mã chuyển sang app</b>, nhập mã.
              </span>
              {onGetHandoffCode && (
                <Button size="sm" onClick={onGetHandoffCode}>
                  Lấy mã chuyển sang app
                </Button>
              )}
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}
