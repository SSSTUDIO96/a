import type { Mailer, MailMessage } from './types';

export interface HttpMailerConfig {
  // Địa chỉ API gửi thư của nhà cung cấp, ví dụ https://api.resend.com/emails.
  url: string;
  apiKey: string;
  from: string;
  timeoutMs?: number;
  // Thay được trong bài thử (máy chủ giả trên máy) — không bao giờ gửi thư thật khi chạy thử.
  fetchImpl?: typeof fetch;
}

// KHUNG SẴN, CHƯA BẬT ở môi trường nào: gửi thư bằng một lời gọi HTTPS (không cần thư viện npm).
// Thân JSON { from, to: [..], subject, text, html } + header "Authorization: Bearer <khoá>" — đúng dạng của Resend;
// nhà cung cấp khác (Postmark, Brevo, SendGrid…) đổi tên trường thì sửa hàm body() bên dưới.
// Bật: MAIL_DRIVER=http, MAIL_HTTP_URL, MAIL_HTTP_API_KEY, MAIL_FROM (docs/DEPLOYMENT.md).
export class HttpApiMailer implements Mailer {
  readonly driver = 'http';
  constructor(private readonly cfg: HttpMailerConfig) {}

  private body(message: MailMessage) {
    return {
      from: this.cfg.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    };
  }

  async send(message: MailMessage): Promise<void> {
    const doFetch = this.cfg.fetchImpl ?? fetch;
    let res: Response;
    try {
      res = await doFetch(this.cfg.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify(this.body(message)),
        signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 10_000),
      });
    } catch (err) {
      // Không đưa nội dung thư (có đường dẫn bí mật) hay khoá API vào lời lỗi.
      throw new Error(`Không gọi được dịch vụ gửi thư (${err instanceof Error ? err.name : 'lỗi mạng'})`);
    }
    if (!res.ok) {
      // Không chép thân trả về: có nhà cung cấp lặp lại nội dung thư trong lời lỗi.
      await res.body?.cancel().catch(() => undefined);
      throw new Error(`Dịch vụ gửi thư từ chối (HTTP ${res.status})`);
    }
    await res.body?.cancel().catch(() => undefined);
  }
}
