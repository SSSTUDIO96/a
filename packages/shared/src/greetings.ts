import type { ContractKindKey } from './design-templates';

// Câu chúc soạn sẵn cho thẻ Lời chúc (bảng GreetingPhrase). Lúc tạo tổ chức, máy chủ chép bộ này vào tổ chức,
// giống DEFAULT_MAKEUP_SUBJECTS; sau đó tổ chức tự sửa, ẩn, thêm.
// Nội dung lấy NGUYÊN VĂN từ R&D: docs/rnd/v3-bay-mau.html (mục "Câu chúc soạn sẵn"), trùng với MAC_DINH của
// các tệp mẫu docs/rnd/v3-mau-loi-chuc/lc-0N.html và bảng ở BAO-CAO-RND-03 mục 13.2.
export interface GreetingPhraseSeed {
  name: string;
  // Rỗng = dùng cho cả hai loại hợp đồng.
  appliesTo: readonly ContractKindKey[];
  title: string;
  body: string;
}

export const DEFAULT_GREETING_PHRASES: readonly GreetingPhraseSeed[] = [
  {
    name: 'Ngày cưới',
    appliesTo: ['SERVICE'],
    title: 'Trăm năm hạnh phúc',
    body: 'Chúc hai bạn trăm năm hạnh phúc, luôn giữ trọn yêu thương như ngày hôm nay. Cảm ơn bạn đã tin tưởng để chúng tôi được góp một phần nhỏ vào ngày trọng đại.',
  },
  {
    name: 'Cảm ơn đã tin chọn',
    appliesTo: [],
    title: 'Cảm ơn bạn đã tin chọn',
    body: 'Cảm ơn bạn đã dành cho chúng tôi sự tin tưởng. Mong rằng mỗi khoảnh khắc trong ngày đặc biệt đều rạng rỡ như chính bạn.',
  },
  {
    name: 'Mẹ cô dâu',
    appliesTo: ['SERVICE'],
    title: 'Chúc mừng gia đình',
    body: 'Chúc mừng gia đình đón thêm niềm vui lớn. Cảm ơn cô đã cho chúng con được chăm chút cho cô trong ngày đặc biệt này. Chúc cô luôn mạnh khoẻ và an vui.',
  },
  {
    name: 'Lễ ăn hỏi',
    appliesTo: ['SERVICE'],
    title: 'Chúc mừng lễ ăn hỏi',
    body: 'Chúc mừng lễ ăn hỏi của hai bạn. Chúc chặng đường phía trước luôn ngập tràn yêu thương, thấu hiểu và bình an.',
  },
  {
    name: 'Sự kiện, dự tiệc',
    appliesTo: ['SERVICE'],
    title: 'Luôn toả sáng',
    body: 'Cảm ơn bạn đã chọn chúng tôi cho ngày đặc biệt. Chúc bạn luôn tự tin và toả sáng theo cách riêng của mình.',
  },
  {
    name: 'Hoàn thành khoá học',
    appliesTo: ['COURSE'],
    title: 'Chúc mừng em',
    body: 'Chúc mừng em đã hoàn thành khoá học. Chúc em vững tay nghề, tự tin trên con đường trở thành chuyên viên trang điểm.',
  },
];

// Câu chúc có dùng được cho loại hợp đồng này không (appliesTo rỗng = cả hai).
export function phraseAppliesTo(appliesTo: readonly ContractKindKey[], contractKind: ContractKindKey): boolean {
  return appliesTo.length === 0 || appliesTo.includes(contractKind);
}
