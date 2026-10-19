# Giữ nguyên PNG xuất từ app nếu ≤ 600 KB; nếu không, nén bảng màu (thử lần lượt tới khi ≤ 600 KB). Số đo luôn lấy trên bản gốc.
import sys,os,io
from PIL import Image
src,dst=sys.argv[1],sys.argv[2];GH=600*1024
raw=open(src,'rb').read()
if len(raw)<=GH: open(dst,'wb').write(raw); print(os.path.basename(dst),len(raw)//1024,'KB nguyên PNG'); sys.exit()
im=Image.open(src).convert('RGB')
for n,d in [(256,1),(256,0),(192,0),(128,0),(96,0),(64,0),(48,0),(32,0),(24,0),(16,0)]:
    q=im.quantize(colors=n,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.FLOYDSTEINBERG if d else Image.Dither.NONE)
    b=io.BytesIO(); q.save(b,'PNG',optimize=True)
    if b.tell()<=GH: break
open(dst,'wb').write(b.getvalue()); print(os.path.basename(dst),b.tell()//1024,f'KB nén {n} màu', 'dither' if d else 'không dither')
