import pino from 'pino';

// Không bao giờ ghi mật khẩu, thẻ đăng nhập hay cookie vào log.
export function createLogger(level: string) {
  return pino({
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.refreshToken',
        '*.accessToken',
      ],
      censor: '[ẩn]',
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
