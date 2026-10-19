import pino from 'pino';

// Không bao giờ ghi mật khẩu, thẻ đăng nhập hay cookie vào log. Cổng học viên (bản vẽ E 4.1): chìa (`key`), 4 số cuối
// (`last4`), mã chuyển máy (`body.code`, `handoffCode`) cũng bị che. Cookie mp_portal nằm trong header cookie / set-cookie đã che sẵn.
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
        // Mã chuyển máy: chỉ che ĐÚNG đường có thể chứa nó (thân yêu cầu, trường handoffCode). KHÔNG che '*.code' —
        // làm mất err.code (mã lỗi Prisma/Postgres) trong log "Lỗi không lường trước" (quyết định điều phối, phiếu vướng E2).
        'body.code',
        '*.body.code',
        'handoffCode',
        '*.handoffCode',
      ],
      censor: '[ẩn]',
    },
  };
  return destination ? pino(options, destination) : pino(options);
}

export type Logger = ReturnType<typeof createLogger>;
