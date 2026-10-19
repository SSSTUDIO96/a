-- Buổi học lên Lịch (việc tồn 6, quyết định điều phối 19/10): lịch kind = COURSE_SESSION trỏ về lớp + ngày học.
ALTER TABLE "appointments"
  ADD COLUMN "course_class_id" UUID,
  ADD COLUMN "session_date" DATE;

-- Khoá ngoại kép: buổi học chỉ trỏ được tới lớp của CHÍNH tổ chức (cách ly do database chặn).
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_course_class_id_organization_id_fkey"
  FOREIGN KEY ("course_class_id", "organization_id") REFERENCES "course_classes"("id", "organization_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Có lớp thì phải có ngày buổi học, và chỉ loại COURSE_SESSION mới gắn lớp.
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_class_session_pair" CHECK (
  ("course_class_id" IS NULL) = ("session_date" IS NULL)
  AND ("course_class_id" IS NULL OR "kind" = 'COURSE_SESSION')
);

-- Không sinh trùng: mỗi lớp mỗi ngày tối đa 1 buổi chưa huỷ (buổi đã huỷ không chặn ngày đó sinh lại).
-- Chỉ mục có điều kiện — Prisma không ghi được trong schema.prisma (xem chú thích ở model Appointment).
CREATE UNIQUE INDEX "appointments_class_session_live_key"
  ON "appointments"("course_class_id", "session_date") WHERE "status" <> 'CANCELLED';

-- CreateIndex
CREATE INDEX "appointments_course_class_id_session_date_idx" ON "appointments"("course_class_id", "session_date");
