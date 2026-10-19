import type { Logger } from '../logger';
import type { Mailer, MailMessage } from './types';

// Dấu nhận biết dòng nhật ký của thư chạy thử — tìm bằng chuỗi này để lấy đường dẫn đặt lại khi chạy trên máy.
export const CONSOLE_MAIL_MARK = '[THƯ CHẠY THỬ — KHÔNG GỬI THẬT]';

// CHỈ cho development/test: không gửi đi đâu cả, in nguyên thư ra nhật ký máy chủ ở mức warn (LOG_LEVEL=warn vẫn thấy).
// Thư có thể chứa đường dẫn đặt lại mật khẩu (bí mật) — vì vậy lib/mailer/index.ts KHÔNG BAO GIỜ dựng driver này ở production.
export class ConsoleMailer implements Mailer {
  readonly driver = 'console';
  constructor(private readonly logger: Logger) {}

  async send(message: MailMessage): Promise<void> {
    // Ghi ĐỒNG BỘ ngay trong lần gọi (trước await đầu tiên): khi máy chủ trả lời, dòng nhật ký đã có.
    this.logger.warn(
      { mail: { driver: this.driver, to: message.to, subject: message.subject, text: message.text } },
      `Thư tới ${message.to}: ${message.subject}`,
    );
  }
}
