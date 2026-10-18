// 36 ca trong tuần 23–29/11/2026 (4 thợ + chưa có thợ) để thử lịch dày.
import { seed } from './h.mjs';
import { api } from './api.mjs';
const thos = ['ha', 'linh', 'my', 'tu'].map((k) => seed.users[k].membershipId);
const titles = ['Cô dâu – Ngày cưới', 'Ăn hỏi', 'Tiệc kỷ yếu lớp 12A1 trường THPT Chu Văn An rất dài', 'Mẹ cô dâu', 'Phù dâu'];
let n = 0, fail = 0;
for (let d = 23; d <= 29; d++) {
  for (let i = 0; i < 5; i++) {
    const h = 5 + i * 2 + (d % 2);
    const staff = i === 4 && d % 3 === 0 ? [] : [{ membershipId: thos[(i + d) % 4], role: 'PRIMARY' }];
    const r = await api('POST', '/appointments', { startsAt: `2026-11-${d}T${String(h).padStart(2, '0')}:00:00+07:00`, endsAt: `2026-11-${d}T${String(h + 1).padStart(2, '0')}:30:00+07:00`, title: titles[i], newCustomer: { fullName: `Khách thử lịch ${d}-${i} Nguyễn Thị Phương Anh` }, locationType: 'STUDIO', staff, status: 'CONFIRMED' });
    if (r.status === 201) n++; else { fail++; if (fail < 4) console.log(r.status, JSON.stringify(r.body).slice(0, 200)); }
  }
}
// thêm vài ca cùng thợ một ngày cho ô dày
for (const h of [17, 18, 19]) { const r = await api('POST', '/appointments', { startsAt: `2026-11-28T${h}:00:00+07:00`, endsAt: `2026-11-28T${h}:45:00+07:00`, title: 'Tiệc tối', newCustomer: { fullName: `Khách tối ${h}` }, locationType: 'STUDIO', staff: [{ membershipId: thos[0], role: 'PRIMARY' }], status: 'CONFIRMED' }); if (r.status === 201) n++; else console.log(r.status, JSON.stringify(r.body).slice(0,200)); }
console.log('tạo', n, 'ca, lỗi', fail);
