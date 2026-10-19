import pino from 'pino';

// Không bao giờ ghi mật khẩu, thẻ đăng nhập hay cookie vào log. Cổng học viên (bản vẽ E 4.1): chìa (`key`), 4 số cuối
// (`last4`), mã chuyển máy (`code`) cũng bị che. Cookie mp_portal nằm trong header cookie / set-cookie đã che sẵn.
// destination: chỉ để bài thử bắt log vào bộ nhớ (quét chuỗi bí mật); máy chủ thật ghi ra stdout như cũ.
export function createLogger(level: string, destination?: pino.DestinationStream) {
  const options: pino.LoggerOptions = {
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.refreshToken',
        '*.accessToken',
        '*.key',
        '*.last4',
        '*.code',
      ],
      censor: '[ẩn]',
    },
  };
  return destination ? pino(options, destination) : pino(options);
}

export type Logger = ReturnType<typeof createLogger>;
