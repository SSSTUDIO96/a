# Tạo hai trang bảng (bang-xem-nhanh.html, truoc-sau.html) từ ảnh thật trong ../../anh-rnd10 và vị trí ô mã số đo ở nen/*.json.
# Dùng: python3 -I tao-bang.py <thư-mục-làm-việc có nen/>
import json,sys,os
WD=sys.argv[1]; OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
M=[('cm-01','Giấy dấu sáp','(a) giấy + dấu sáp trên nền hoa lá khắc','huy hiệu tròn viền kép, bên phải ảnh'),
   ('cm-02','Panel viên thuốc','(b) panel góc lõm · ảnh viên thuốc','phiếu "Mã số" cột phải, dưới lớp / khai giảng'),
   ('cm-03','Tem răng cưa','(c) tem nền xanh rêu đậm','"mệnh giá" tem, góc trên bên phải'),
   ('cm-04','Thư giấy vân','(d) giấy vân tràn trang, lá thư căn trái','vé nâu khuyết hai bên, hàng đầu bên phải'),
   ('cm-05','Bằng khen cổ điển','(e) khung vàng nâu, hoa huệ góc','huy hiệu hình thoi, bên phải ảnh'),
   ('cm-06','Tờ tiền xanh','(f) tiền giấy guilloche, dải tên','huy hiệu hoa thị, góc trên bên phải'),
   ('cm-07','Thảm Ba Tư','(g) thảm xanh chàm, medallion răng sò','huy hiệu tròn bám mép medallion, dưới phải ảnh'),
   ('cm-08','Giấy xé + washi','MỚI · giấy xé mép, băng dính washi','mẩu washi vàng nghệ, góc trên bên phải'),
   ('cm-09','Thiệp gập ruy băng','MỚI · thiệp gập đôi, ruy băng satin thắt nơ','thẻ treo kraft buộc dây, góc trên bên phải'),
   ('cm-10','Gương oval cổ điển','MỚI · khung gương vàng đồng baroque','bảng đồng dưới chân khung gương')]
def vitri(ma):
    j=json.load(open(f'{WD}/nen/{ma}-doc.json'))
    r=[h for t in j['do'] if t['lop'] in('seat-l','seat-n') for h in t['hop']]
    x0=min(h['x'] for h in r)-26;y0=min(h['y'] for h in r)-22;x1=max(h['x']+h['w'] for h in r)+26;y1=max(h['y']+h['h'] for h in r)+22
    return dict(l=x0/1080*100,t=y0/1350*100,w=(x1-x0)/1080*100,h=(y1-y0)/1350*100,cx=(x0+x1)/2,cy=(y0+y1)/2,px=[round(x0),round(y0),round(x1-x0),round(y1-y0)])
V={m[0]:vitri(m[0]) for m in M}
json.dump(V,open(f'{OUT}/vi-tri-ma-so.json','w'),indent=1)
def ann(ma,small=False):
    v=V[ma];return f'<i class="an" style="left:{v["l"]:.2f}%;top:{v["t"]:.2f}%;width:{v["w"]:.2f}%;height:{v["h"]:.2f}%"></i>'
CSS='''<link rel="stylesheet" href="chung/phong.css"><style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#EFEBE2;font-family:'MP Chữ không chân',sans-serif;color:#2A2420}
.bg{background:#fff;border-radius:22px;padding:34px 40px 40px;margin:0}h1{font:700 30px 'MP Chữ không chân';letter-spacing:.01em}.sub{font:400 17px/1.5 'MP Chữ không chân';color:#5B5248;margin-top:8px}
.ln{height:2px;background:#A6405F;margin:18px 0 26px;opacity:.85}
.t{position:relative;display:block;line-height:0}.t img{width:100%;display:block;border-radius:6px;box-shadow:0 2px 8px rgba(40,30,20,.28)}
.an{position:absolute;border:3px dashed #E0245E;border-radius:14px;box-shadow:0 0 0 2px rgba(255,255,255,.85)}
.cap b{display:block;font:700 18px 'MP Chữ không chân'}.cap span{display:block;font:400 14px/1.4 'MP Chữ không chân';color:#5B5248;margin-top:3px}.cap em{font-style:normal;color:#C2185B;font-weight:600}
</style>'''
# ---- bảng xem nhanh ----
cards=''
for ma,ten,y,vt in M:
    cards+=f'''<div class="cd"><div class="rw"><div class="t tv"><img src="../anh-rnd10/{ma}-doc.png">{ann(ma)}</div><div class="t ts"><img src="../anh-rnd10/{ma}-vuong.png"></div></div>
<div class="cap"><b>{ma} · {ten}</b><span>{y}</span><span><em>Mã số:</em> {vt}</span></div></div>'''
html=f'''<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Bảng xem nhanh 10 mẫu chào mừng</title>{CSS}<style>
body{{width:2080px;padding:30px}}.g{{display:grid;grid-template-columns:repeat(5,1fr);gap:34px 30px}}.rw{{display:flex;align-items:flex-end;gap:12px}}.tv{{flex:0 0 63%}}.ts{{flex:1}}.cap{{margin-top:18px}}
</style></head><body><div class="bg"><h1>10 mẫu chào mừng mới · phong cách giấy, khung và họa tiết khắc (R&amp;D-10)</h1>
<div class="sub">Mỗi mẫu có khổ dọc 1080×1350 và khổ vuông 1080×1080 (ảnh vuông nhỏ bên cạnh), ảnh học viên khung tròn (cm-02 dùng viên thuốc), tên học viên chữ ký nét mảnh TO. Khung đỏ nét đứt = <b>ô mã số</b> (số ghế / vị trí, trường đề xuất seatCode). Mọi dòng chữ đo tương phản ≥ 4,5:1 (chữ lớn ≥ 3:1).</div><div class="ln"></div>
<div class="g">{cards}</div></div></body></html>'''
open(f'{OUT}/bang-xem-nhanh.html','w',encoding='utf8').write(html)
# ---- trước – sau ----
P=[('shd-01','Thư mời kem','cm-05'),('shd-02','Đen vàng khung tròn','cm-10'),('shd-04','Ruy băng tên','cm-09'),('shd-07','Vé vào lớp','cm-03'),('shd-09','Thiệp vàng hồng khung tròn','cm-08'),
   ('shd-08','Chữ ký trên nền trắng','cm-04'),('shd-03','Ngày khai giảng lớn','cm-06'),('shd-05','Tạp chí tối giản','cm-02'),('shd-06','Xanh rêu khung lệch','cm-07'),('shd-11','Chữ ký mảnh nền đá','cm-01')]
D={m[0]:m for m in M}
rows=''
for old,ton,new in P:
    m=D[new]
    rows+=f'''<div class="pr"><div class="o"><div class="t"><img src="chung/cu/{old}.png"></div><div class="cap"><b>{old} · {ton}</b><span>mẫu cũ — phẳng, nền trơn, không có mã số</span></div></div>
<div class="ar">&#10142;</div><div class="n"><div class="t"><img src="../anh-rnd10/{new}-doc.png">{ann(new)}</div><div class="cap"><b>{new} · {m[1]}</b><span>{m[2]}</span><span><em>Mã số:</em> {m[3]}</span></div></div></div>'''
html=f'''<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Trước – sau mẫu chào mừng</title>{CSS}<style>
body{{width:1500px;padding:30px}}.g{{display:grid;grid-template-columns:1fr 1fr;gap:34px 34px}}.pr{{display:flex;align-items:flex-start;gap:14px}}.o,.n{{width:300px;flex:none}}.ar{{font:400 44px/1 serif;color:#A6405F;align-self:center;width:54px;text-align:center;margin-top:-60px}}
.o .t img{{filter:saturate(.9)}}.cap{{margin-top:12px}}.hd{{display:flex;gap:14px;font:700 15px 'MP Chữ không chân';letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px}}.hd div{{padding:6px 14px;border-radius:999px}}.hd .a{{background:#EEE;color:#555}}.hd .b{{background:#F9E3EA;color:#A6205A}}
</style></head><body><div class="bg"><h1>Trước ↔ sau: mẫu cũ anh chê → mẫu mới theo phong cách ảnh số 2</h1>
<div class="sub">Trái: các mẫu chào mừng hiện tại (phẳng, nền trơn — ảnh anh Chiến gửi). Phải: mẫu mới dựng bằng bộ máy R&amp;D-07 (giấy vân, khung, họa tiết khắc, dấu sáp, tem…) và hai kiểu mới cùng tinh thần. Khung đỏ nét đứt = ô mã số mới.</div><div class="ln"></div>
<div class="g">{rows}</div></div></body></html>'''
open(f'{OUT}/truoc-sau.html','w',encoding='utf8').write(html)
print('ok',len(V))
