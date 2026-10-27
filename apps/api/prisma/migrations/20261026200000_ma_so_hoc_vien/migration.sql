-- Bản vẽ H — mã số học viên trong lớp (docs/rnd/BAN-VE-H-MA-SO-CHAO-MUNG.md mục 2.3).
-- Thứ tự trong tệp là bắt buộc: đổ số trước, tạo CHECK và trigger sau (tạo CHECK enrollments_active_seat trước khi đổ
-- số thì migration hỏng trên database đã có học viên). Bài thử: apps/api/test/ma-so-database.test.ts.
ALTER TABLE "course_classes" ADD COLUMN "seat_counter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "enrollments" ADD COLUMN "seat_no" INTEGER;

-- BACKFILL BEGIN (bài thử đọc đoạn này và chạy lại trên dữ liệu tự dựng)
-- Học viên ĐANG HỌC: cấp 1..N theo thứ tự ghi danh (enrolled_at, id) trong từng lớp. Ghi danh đã huỷ trước ngày có tính
-- năng: không cấp (NULL), không chiếm số.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "course_class_id" ORDER BY "enrolled_at", "id") AS n
  FROM "enrollments" WHERE "status" = 'ACTIVE'
)
UPDATE "enrollments" e SET "seat_no" = r.n FROM ranked r WHERE e."id" = r."id";
UPDATE "course_classes" k SET "seat_counter" = COALESCE(
  (SELECT MAX(e."seat_no") FROM "enrollments" e WHERE e."course_class_id" = k."id"), 0);
-- BACKFILL END

-- Chốt (mỗi chốt có ca ghi thẳng database ở bảng 2.4)
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_seat_range"
  CHECK ("seat_no" IS NULL OR ("seat_no" >= 1 AND "seat_no" <= 999));
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_active_seat"
  CHECK ("status" <> 'ACTIVE' OR "seat_no" IS NOT NULL);
ALTER TABLE "course_classes" ADD CONSTRAINT "course_classes_seat_counter_range"
  CHECK ("seat_counter" >= 0 AND "seat_counter" <= 999);
CREATE UNIQUE INDEX "enrollments_seat_active" ON "enrollments" ("course_class_id", "seat_no") WHERE "status" = 'ACTIVE';

-- Lưới cuối cho MỌI đường ghi (kể cả bài thử ghi thẳng): ghi danh ACTIVE chưa có số thì tự cấp seat_counter + 1;
-- có số thì nâng seat_counter lên ít nhất bằng số đó (số tự cấp sau này không đụng số sửa tay).
CREATE FUNCTION enrollments_seat_guard() RETURNS trigger AS $$
DECLARE n integer;
BEGIN
  IF TG_OP = 'INSERT' AND NEW."seat_no" IS NULL AND NEW."status" = 'ACTIVE' THEN
    UPDATE "course_classes" SET "seat_counter" = "seat_counter" + 1
      WHERE "id" = NEW."course_class_id" RETURNING "seat_counter" INTO n;
    NEW."seat_no" := n;
  ELSIF NEW."seat_no" IS NOT NULL THEN
    UPDATE "course_classes" SET "seat_counter" = NEW."seat_no"
      WHERE "id" = NEW."course_class_id" AND "seat_counter" < NEW."seat_no";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER enrollments_seat_guard BEFORE INSERT OR UPDATE OF "seat_no" ON "enrollments"
  FOR EACH ROW EXECUTE FUNCTION enrollments_seat_guard();

-- Bộ đếm không lùi.
CREATE FUNCTION course_classes_seat_counter_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."seat_counter" < OLD."seat_counter" THEN
    RAISE EXCEPTION 'Bộ đếm mã số của lớp không được lùi (% → %)', OLD."seat_counter", NEW."seat_counter"
      USING ERRCODE = '23514', CONSTRAINT = 'course_classes_seat_counter_guard';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER course_classes_seat_counter_guard BEFORE UPDATE OF "seat_counter" ON "course_classes"
  FOR EACH ROW EXECUTE FUNCTION course_classes_seat_counter_guard();
