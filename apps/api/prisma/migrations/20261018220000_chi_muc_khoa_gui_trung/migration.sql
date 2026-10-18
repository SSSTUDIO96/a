-- CreateIndex
CREATE INDEX "idempotency_keys_user_id_key_idx" ON "idempotency_keys"("user_id", "key");

