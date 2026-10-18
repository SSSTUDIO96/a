/** Gộp tên class, bỏ giá trị rỗng. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
