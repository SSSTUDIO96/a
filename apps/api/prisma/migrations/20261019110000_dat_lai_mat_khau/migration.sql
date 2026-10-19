-- Đặt lại mật khẩu qua email (thợ K1).

-- Lý do thu hồi phiên mới: đặt lại mật khẩu thu hồi MỌI refresh token của người đó.
-- (Thêm giá trị enum trong transaction được phép từ PostgreSQL 12; migration này không dùng giá trị mới ngay.)
ALTER TYPE "RevokeReason" ADD VALUE 'PASSWORD_RESET';

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
    -- Lưới cuối: chỉ nhận bản băm sha256 (64 ký tự hex thường). Lỡ tay ghi thẻ thật (base64url 43 ký tự) → database từ chối.
    CONSTRAINT "password_reset_tokens_token_hash_sha256" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "password_reset_tokens_expires_after_created" CHECK ("expires_at" > "created_at")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_created_at_idx" ON "password_reset_tokens"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
