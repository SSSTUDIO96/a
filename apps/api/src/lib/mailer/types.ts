// Người gửi thư thay được: mã nghiệp vụ chỉ biết giao diện Mailer, không biết thư đi bằng đường nào.
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  // 'console' | 'http' — ghi vào nhật ký audit để biết thư đi bằng đường nào (không chứa bí mật).
  readonly driver: string;
  send(message: MailMessage): Promise<void>;
}

// Không dựng được người gửi thư cho môi trường này. reason là MÃ có tên (vào details của lỗi 503), hint chỉ vào log.
export interface MailerUnavailable {
  reason: 'MAIL_NOT_CONFIGURED' | 'MAIL_CONSOLE_IN_PRODUCTION' | 'WEB_APP_URL_NOT_CONFIGURED';
  hint: string;
}
