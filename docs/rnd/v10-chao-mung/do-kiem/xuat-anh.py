# Nén ảnh PNG thật (đã xuất bằng MAU_XUAT_PNG) về ≤ 600 KB: giảm số màu dần (256 → 96) cho tới khi đủ nhẹ. Dùng: python3 -I xuat-anh.py <thư-mục-goc> <thư-mục-đích>
import sys,io,os,glob
from PIL import Image,ImageFilter
src,dst=sys.argv[1],sys.argv[2]
os.makedirs(dst,exist_ok=True)
MAP={'doc':'doc','vuong':'vuong','dai':'ten-dai','vuongdai':'vuong-ten-dai'}
LIM=585*1024
for p in sorted(glob.glob(f'{src}/cm-*.png')):
    b=os.path.basename(p)[:-4]; n,_,bien=b.partition('-'); 
    parts=b.split('-'); ma=parts[0]+'-'+parts[1]; bien='-'.join(parts[2:])
    if bien not in MAP: continue
    im0=Image.open(p).convert('RGB'); out=None
    # Bước 1: chỉ giảm số màu. Bước 2 (nếu vẫn > 585 KB, giấy vân quá nhiều hạt): lọc trung vị 3×3 bỏ hạt lẻ (nét chữ giữ nguyên) rồi giảm màu lại.
    for loc in (False,True):
        im=im0.filter(ImageFilter.MedianFilter(3)) if loc else im0
        for col in (256,224,192,160,128,112,96,80):
            q=im.quantize(colors=col,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
            buf=io.BytesIO(); q.save(buf,'PNG',optimize=True)
            if buf.tell()<=LIM: out=(col,buf.getvalue(),loc); break
        if out: break
    if out is None: out=(col,buf.getvalue(),loc)
    f=f'{dst}/{ma}-{MAP[bien]}.png'; open(f,'wb').write(out[1]); print(f'{os.path.basename(f):28s} {len(out[1])//1024:4d} KB  {out[0]} màu'+(' + lọc hạt' if out[2] else ''))
