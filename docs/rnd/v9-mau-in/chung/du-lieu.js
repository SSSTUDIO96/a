/* R&D 09 — DỮ LIỆU MẪU cho 5 mẫu in hợp đồng (chỉ để dựng bản mẫu; mọi tên người, số điện thoại, số tài khoản là giả).
   Hình dạng dữ liệu bám đúng những gì máy chủ đang trả (apps/api/src/modules/contracts/present.ts loadContractDetail,
   apps/api/prisma/schema.prisma). Trường đánh dấu "MỚI" là CHƯA có trong schema — xem BAO-CAO-RND-09-MAU-IN-HOP-DONG.md
   mục "Đề xuất trường mới". Số tiền tính tay ở đây; trang in tự cộng lại và báo đỏ nếu lệch (window.__kiem). */
(function () {
  const STUDIO = {
    brandName: 'Chiến Makeup Studio', // OrganizationProfile.brandName
    tagline: 'Trang điểm cô dâu · Đào tạo makeup chuyên nghiệp', // OrganizationProfile.tagline
    address: '25 Thái Hà, phường Trung Liệt, Đống Đa, Hà Nội', // OrganizationProfile.address
    phone: '0988 123 456', // OrganizationProfile.phone
    email: 'lienhe@chienmakeup.vn', // OrganizationProfile.email
    website: 'chienmakeup.vn', // OrganizationProfile.website
    zalo: '0988 123 456', // OrganizationProfile.zalo
    logo: 'chung/logo-mau.svg', // OrganizationProfile.logoFileId → StoredFile
    // ===== MỚI (chưa có trong schema) =====
    representative: 'Nguyễn Trọng Chiến', // MỚI: người đại diện ký hợp đồng
    representativeTitle: 'Chủ studio', // MỚI: chức danh người đại diện
    bank: { bankName: 'Vietcombank — CN Thành Công', accountNumber: '0011 0045 67890', accountName: 'NGUYEN TRONG CHIEN' }, // MỚI
  };

  const SERVICE_TERMS = [
    'Bên B đặt cọc theo tiến độ thanh toán để Bên A giữ lịch và thợ. Tiền cọc không hoàn lại nếu Bên B huỷ dịch vụ trong vòng 30 ngày trước ngày sự kiện.',
    'Bên B được đổi ngày sự kiện một lần, báo trước ít nhất 15 ngày và còn lịch trống; tiền cọc được chuyển sang ngày mới.',
    'Bên A có mặt đúng giờ đã ghi trong hợp đồng. Bên B chuẩn bị chỗ ngồi đủ ánh sáng, có ổ điện và gương.',
    'Nếu Bên B chậm quá 30 phút so với giờ hẹn, thời gian trang điểm có thể rút ngắn tương ứng; Bên A không chịu trách nhiệm việc trễ lịch chụp hoặc lễ.',
    'Phí di chuyển tính theo quãng đường thực tế từ studio đến địa điểm (đã ghi trong bảng dịch vụ). Đổi địa điểm thì tính lại phí.',
    'Thêm người trang điểm, thêm dịch vụ hoặc làm ngoài giờ trong ngày sự kiện được tính theo bảng giá hiện hành và ghi vào phiếu phát sinh.',
    'Bên A dùng mỹ phẩm chính hãng, còn hạn sử dụng. Bên B báo trước tình trạng da, tiền sử dị ứng (nếu có).',
    'Bên A được dùng hình ảnh trang điểm của Bên B để giới thiệu dịch vụ khi Bên B đồng ý. Bên B có thể từ chối bằng cách báo cho Bên A.',
    'Bên B thanh toán phần còn lại trước khi bắt đầu trang điểm ngày sự kiện, bằng tiền mặt hoặc chuyển khoản vào tài khoản ghi trong hợp đồng.',
    'Thiên tai, dịch bệnh hoặc sự kiện bất khả kháng khiến một bên không thực hiện được hợp đồng thì hai bên thoả thuận dời lịch, không phạt cọc.',
    'Nếu Bên A không thực hiện được dịch vụ vì lý do của Bên A, Bên A hoàn lại toàn bộ tiền đã nhận và bồi thường bằng số tiền cọc.',
    'Mọi tranh chấp được hai bên thương lượng trên tinh thần hợp tác; không thương lượng được thì đưa ra toà án có thẩm quyền.',
  ];

  // 45 điều khoản khoá học — nội dung khác nhau thật (không lặp một câu), để kiểm chảy trang và không trùng điều.
  const COURSE_TERMS = [
    'Học phí ghi trong hợp đồng là học phí trọn khoá, đã gồm giáo trình điện tử và buổi thi cuối khoá.',
    'Học viên đóng tiền cọc để giữ chỗ; lớp chỉ giữ chỗ khi hợp đồng đã được trung tâm xác nhận.',
    'Học viên đóng các đợt còn lại đúng hạn ghi trong tiến độ thanh toán; quá hạn 7 ngày trung tâm được tạm ngừng xếp buổi học.',
    'Trung tâm xuất phiếu thu cho mỗi lần học viên đóng tiền; học viên giữ phiếu thu để đối chiếu.',
    'Học phí đã đóng không chuyển nhượng cho người khác, trừ khi trung tâm đồng ý bằng văn bản.',
    'Ưu đãi giảm giá chỉ áp dụng cho khoá ghi trong hợp đồng, không quy đổi thành tiền mặt.',
    'Học viên đóng tiền bằng chuyển khoản ghi rõ mã hợp đồng trong nội dung chuyển khoản.',
    'Trung tâm không thu thêm khoản nào ngoài hợp đồng, trừ dụng cụ học viên tự chọn mua thêm.',
    'Lịch học theo lớp ghi trong hợp đồng; trung tâm thông báo trước ít nhất 48 giờ nếu đổi giờ học.',
    'Học viên có mặt trước giờ học 10 phút để chuẩn bị dụng cụ và mẫu.',
    'Học viên nghỉ học phải báo giảng viên trước 24 giờ qua Zalo hoặc điện thoại của trung tâm.',
    'Nghỉ không báo trước quá ba buổi thì trung tâm được xếp học bù vào lớp sau, không hoàn học phí phần đã nghỉ.',
    'Mỗi học viên được học bù tối đa bốn buổi trong thời gian khoá học.',
    'Buổi học bù xếp theo lớp đang mở có cùng nội dung, tuỳ chỗ trống.',
    'Đi muộn quá 30 phút tính là vắng nửa buổi khi xét điều kiện thi cuối khoá.',
    'Học viên vắng quá 20% số buổi không đủ điều kiện thi cuối khoá, được học lại một phần ở lớp sau.',
    'Học viên được bảo lưu khoá học một lần, tối đa 6 tháng, báo trước ít nhất 7 ngày.',
    'Thời gian bảo lưu tính từ buổi học tiếp theo sau ngày báo bảo lưu.',
    'Hết hạn bảo lưu mà học viên không quay lại học thì phần học phí còn lại không được hoàn.',
    'Học viên được chuyển sang lớp khác cùng khoá một lần, nếu lớp mới còn chỗ.',
    'Chuyển sang khoá có học phí cao hơn thì học viên đóng thêm phần chênh lệch.',
    'Chuyển sang khoá có học phí thấp hơn thì trung tâm không hoàn phần chênh lệch.',
    'Trung tâm được gộp lớp hoặc dời ngày khai giảng tối đa 14 ngày nếu lớp chưa đủ học viên.',
    'Trung tâm chuẩn bị mỹ phẩm dùng chung trong buổi học; học viên tự chuẩn bị bộ cọ cá nhân hoặc mua bộ cọ của trung tâm.',
    'Học viên giữ gìn dụng cụ chung; làm hỏng hoặc mất thì bồi thường theo giá mua.',
    'Học viên tự mời mẫu cho các buổi thực hành có ghi "mẫu ngoài"; buổi khác trung tâm bố trí mẫu.',
    'Học viên không tự ý mang mỹ phẩm của trung tâm ra khỏi lớp.',
    'Học viên báo cho giảng viên nếu mẫu có tiền sử dị ứng mỹ phẩm trước khi thực hành.',
    'Trung tâm không chịu trách nhiệm tài sản cá nhân học viên để quên tại lớp.',
    'Giáo trình, video bài giảng là tài sản của trung tâm; học viên không sao chép, chia sẻ cho người khác.',
    'Học viên không quay phim toàn bộ buổi học; được chụp ảnh, quay đoạn ngắn để ôn bài.',
    'Ảnh thực hành của học viên có thể được trung tâm đăng giới thiệu khoá học khi học viên đồng ý.',
    'Học viên được dùng ảnh sản phẩm của chính mình để làm hồ sơ cá nhân, ghi tên trung tâm đào tạo.',
    'Học viên không dùng tên, logo trung tâm để quảng cáo dịch vụ riêng khi chưa được trung tâm đồng ý.',
    'Học viên đủ điều kiện và đạt bài thi cuối khoá được cấp chứng nhận tốt nghiệp của trung tâm.',
    'Học viên chưa đạt được thi lại một lần miễn phí trong vòng 30 ngày.',
    'Chứng nhận ghi họ tên theo hợp đồng; sai thông tin do học viên cung cấp thì học viên chịu phí in lại.',
    'Chứng nhận tốt nghiệp không thay thế văn bằng, chứng chỉ do cơ quan nhà nước cấp.',
    'Học viên huỷ hợp đồng trước ngày khai giảng 7 ngày được hoàn 70% số tiền đã đóng ngoài tiền cọc.',
    'Học viên huỷ hợp đồng sau ngày khai giảng không được hoàn học phí.',
    'Trung tâm huỷ lớp thì hoàn toàn bộ học phí đã đóng trong vòng 7 ngày làm việc.',
    'Học viên vi phạm nội quy nhiều lần, đã nhắc nhở bằng văn bản, trung tâm được chấm dứt hợp đồng và không hoàn học phí.',
    'Hoàn tiền thực hiện bằng chuyển khoản vào tài khoản đứng tên học viên.',
    'Hai bên cam kết thực hiện đúng các điều khoản; sửa đổi, bổ sung phải lập phụ lục có chữ ký hai bên.',
    'Mọi tranh chấp được giải quyết bằng thương lượng; không thương lượng được thì đưa ra toà án có thẩm quyền tại Hà Nội.',
  ];

  const COURSE_RULES = [
    'Đến lớp đúng giờ, ký tên vào sổ điểm danh.',
    'Mặc trang phục gọn gàng, buộc tóc khi thực hành.',
    'Tắt chuông điện thoại trong giờ học.',
    'Giữ vệ sinh bàn trang điểm, rửa cọ chung sau mỗi buổi.',
    'Không ăn uống tại bàn trang điểm.',
    'Không quay phim khi chưa được giảng viên cho phép.',
    'Báo nghỉ trước 24 giờ.',
    'Tôn trọng giảng viên, mẫu và các học viên khác.',
  ];

  const D = (s) => s; // ngày dạng ISO, giữ nguyên chuỗi

  // ===== HỢP ĐỒNG DỊCH VỤ — bản dài (nhiều dòng: Cô dâu + Phù dâu × 2 + phụ phí + phí di chuyển) =====
  const DV_DAI = {
    kind: 'SERVICE',
    code: 'HĐDV-000128',
    status: 'CONFIRMED',
    createdAt: D('2026-10-19'),
    confirmedAt: D('2026-10-20'),
    eventDate: D('2026-12-12'),
    owner: 'Lê Minh Anh', // Contract.ownerMembershipId → người phụ trách
    customer: {
      fullName: 'Nguyễn Thu Trang',
      phone: '0903 456 789',
      email: 'thutrang.ng@gmail.com',
      address: 'Số 8 ngõ 102 Trường Chinh, Đống Đa, Hà Nội', // MỚI: Customer.address
      idNumber: '001196 012 345', // MỚI: Customer.idNumber (CCCD)
    },
    lines: [
      {
        kind: 'PACKAGE', name: 'Gói makeup cô dâu cao cấp', subjectName: 'Cô dâu',
        quantity: 1, unitPrice: 4500000, lineDiscount: 0, lineTotal: 4500000,
        start: '2026-12-12T05:00', end: '2026-12-12T07:30',
        locationType: 'CUSTOMER_HOME', address: 'Số 8 ngõ 102 Trường Chinh, Đống Đa, Hà Nội',
        staff: [{ name: 'Chiến', role: 'PRIMARY' }, { name: 'Lan', role: 'ASSIST' }],
        note: 'Gồm makeup, làm tóc, 1 lần dặm lại trước lễ',
        addons: [{ kind: 'ADDON', name: 'Nối mi tơ', quantity: 1, unitPrice: 200000, lineDiscount: 0, lineTotal: 200000 }],
        travel: {
          kind: 'TRAVEL', name: 'Phí di chuyển', quantity: 1, unitPrice: 252000, lineDiscount: 0, lineTotal: 252000,
          travelMode: 'PER_KM', distanceKm: 18.4, perKmAmount: 15000,
          travelBreakdown: { includedKm: 10, includedFrom: 'PACKAGE', excessKm: 8.4, chargedKm: 16.8, roundTrip: true, tier: null },
        },
      },
      {
        kind: 'SERVICE', name: 'Makeup tiệc', subjectName: 'Phù dâu',
        quantity: 2, unitPrice: 1200000, lineDiscount: 0, lineTotal: 2400000,
        start: '2026-12-12T06:00', end: '2026-12-12T07:30',
        locationType: 'CUSTOMER_HOME', address: 'Số 8 ngõ 102 Trường Chinh, Đống Đa, Hà Nội',
        staff: [{ name: 'Hà', role: 'PRIMARY' }],
        note: null, addons: [], travel: null,
      },
      {
        kind: 'SURCHARGE', name: 'Phụ phí ca sớm (bắt đầu trước 5:30)', subjectName: null,
        quantity: 1, unitPrice: 300000, lineDiscount: 0, lineTotal: 300000,
        start: null, end: null, locationType: null, address: null, staff: [], note: null, addons: [], travel: null,
      },
    ],
    subtotal: 7652000,
    discount: 500000,
    total: 7152000,
    depositRequired: 2000000,
    installments: [
      { name: 'Đặt cọc giữ lịch', dueDate: '2026-10-20', amount: 2000000, isDeposit: true },
      { name: 'Thanh toán phần còn lại', dueDate: '2026-12-12', amount: 5152000, isDeposit: false },
    ],
    payments: [{ code: 'PT-000341', receivedAt: '2026-10-20', method: 'BANK_TRANSFER', amount: 2000000 }],
    notes: 'Cô dâu muốn tông trang điểm Hàn Quốc nhẹ; chụp ngoại cảnh lúc 9:00 sau lễ gia tiên.',
    terms: { name: 'Điều khoản dịch vụ trang điểm', version: 4, items: SERVICE_TERMS },
    rules: null,
  };

  // ===== HỢP ĐỒNG DỊCH VỤ — bản ngắn (phải ra đúng 1 trang ở mọi mẫu) =====
  const DV_NGAN = {
    kind: 'SERVICE',
    code: 'HĐDV-000129',
    status: 'CONFIRMED',
    createdAt: D('2026-10-19'),
    confirmedAt: D('2026-10-19'),
    eventDate: D('2026-11-18'),
    owner: 'Lê Minh Anh',
    customer: { fullName: 'Phạm Hải Yến', phone: '0977 210 456', email: null, address: null, idNumber: null },
    lines: [
      {
        kind: 'PACKAGE', name: 'Makeup chụp ảnh cưới', subjectName: 'Cô dâu',
        quantity: 1, unitPrice: 2500000, lineDiscount: 0, lineTotal: 2500000,
        start: '2026-11-18T08:00', end: '2026-11-18T10:00',
        locationType: 'STUDIO', address: '25 Thái Hà, Đống Đa, Hà Nội',
        staff: [{ name: 'Chiến', role: 'PRIMARY' }], note: null, addons: [], travel: null,
      },
    ],
    subtotal: 2500000,
    discount: 0,
    total: 2500000,
    depositRequired: 1000000,
    installments: [
      { name: 'Đặt cọc giữ lịch', dueDate: '2026-10-19', amount: 1000000, isDeposit: true },
      { name: 'Thanh toán phần còn lại', dueDate: '2026-11-18', amount: 1500000, isDeposit: false },
    ],
    payments: [],
    notes: null,
    terms: { name: 'Điều khoản dịch vụ trang điểm', version: 4, items: SERVICE_TERMS.slice(0, 4) },
    rules: null,
  };

  // ===== HỢP ĐỒNG KHOÁ HỌC — bản dài (45 điều khoản + 8 nội quy) =====
  const KH_DAI = {
    kind: 'COURSE',
    code: 'HĐKH-000046',
    status: 'CONFIRMED',
    createdAt: D('2026-10-19'),
    confirmedAt: D('2026-10-25'),
    eventDate: null,
    owner: 'Lê Minh Anh',
    customer: {
      fullName: 'Vũ Thị Hồng Nhung', phone: '0912 345 678', email: 'hongnhung.vu@gmail.com',
      address: 'Số 12 Nguyễn Trãi, Thanh Xuân, Hà Nội', idNumber: '001199 054 321',
    },
    lines: [
      {
        kind: 'COURSE', name: 'Khoá makeup cá nhân chuyên nghiệp', subjectName: null,
        quantity: 1, unitPrice: 15000000, lineDiscount: 0, lineTotal: 15000000,
        klass: {
          name: 'K12', startDate: '2026-11-03', endDate: '2026-12-26', weekdays: [2, 4, 6],
          startMinute: 1080, endMinute: 1260, sessionCount: 24, instructor: 'Nguyễn Trọng Chiến',
          location: '25 Thái Hà, Đống Đa, Hà Nội',
        },
        staff: [], addons: [], travel: null,
      },
      {
        kind: 'CUSTOM', name: 'Bộ cọ & dụng cụ học viên (12 món)', subjectName: null,
        quantity: 1, unitPrice: 1200000, lineDiscount: 0, lineTotal: 1200000, staff: [], addons: [], travel: null,
      },
    ],
    subtotal: 16200000,
    discount: 1000000,
    total: 15200000,
    depositRequired: 5000000,
    installments: [
      { name: 'Đặt cọc giữ chỗ', dueDate: '2026-10-25', amount: 5000000, isDeposit: true },
      { name: 'Đợt 2', dueDate: '2026-11-15', amount: 5100000, isDeposit: false },
      { name: 'Đợt 3', dueDate: '2026-12-06', amount: 5100000, isDeposit: false },
    ],
    payments: [{ code: 'PT-000355', receivedAt: '2026-10-25', method: 'CASH', amount: 5000000 }],
    notes: null,
    terms: { name: 'Điều khoản khoá học', version: 3, items: COURSE_TERMS },
    rules: { name: 'Nội quy lớp học', version: 2, items: COURSE_RULES },
  };

  // ===== HỢP ĐỒNG KHOÁ HỌC — bản ngắn =====
  const KH_NGAN = {
    kind: 'COURSE',
    code: 'HĐKH-000047',
    status: 'DRAFT',
    createdAt: D('2026-10-19'),
    confirmedAt: null,
    eventDate: null,
    owner: 'Lê Minh Anh',
    customer: { fullName: 'Trần Mai Anh', phone: '0936 777 120', email: null, address: null, idNumber: null },
    lines: [
      {
        kind: 'COURSE', name: 'Khoá makeup cá nhân cơ bản', subjectName: null,
        quantity: 1, unitPrice: 6000000, lineDiscount: 0, lineTotal: 6000000,
        klass: {
          name: 'CB05', startDate: '2026-11-09', endDate: '2026-11-27', weekdays: [1, 3, 5],
          startMinute: 540, endMinute: 690, sessionCount: 9, instructor: 'Nguyễn Thu Hà', location: '25 Thái Hà, Đống Đa, Hà Nội',
        },
        staff: [], addons: [], travel: null,
      },
    ],
    subtotal: 6000000,
    discount: 0,
    total: 6000000,
    depositRequired: 2000000,
    installments: [
      { name: 'Đặt cọc giữ chỗ', dueDate: '2026-10-22', amount: 2000000, isDeposit: true },
      { name: 'Đợt 2', dueDate: '2026-11-09', amount: 4000000, isDeposit: false },
    ],
    payments: [],
    notes: null,
    terms: { name: 'Điều khoản khoá học', version: 3, items: COURSE_TERMS.slice(0, 4) },
    rules: { name: 'Nội quy lớp học', version: 2, items: COURSE_RULES.slice(0, 3) },
  };

  window.MP_DATA = { STUDIO, HOP_DONG: { 'dich-vu': { dai: DV_DAI, ngan: DV_NGAN }, 'khoa-hoc': { dai: KH_DAI, ngan: KH_NGAN } } };
})();
