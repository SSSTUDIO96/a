import sys,os,io
from PIL import Image
src,dst=sys.argv[1],sys.argv[2]
im=Image.open(src).convert('RGB'); raw=open(src,'rb').read()
if len(raw)<=600*1024: open(dst,'wb').write(raw); print(os.path.basename(dst),len(raw)//1024,'KB (giữ nguyên PNG xuất từ app)'); sys.exit()
for meth in [getattr(Image.Quantize,'LIBIMAGEQUANT',None),Image.Quantize.MEDIANCUT]:
    try:
        q=im.quantize(colors=256,method=meth,dither=Image.Dither.FLOYDSTEINBERG) if meth is not None else None
        if q is None: continue
        b=io.BytesIO(); q.save(b,'PNG',optimize=True); break
    except Exception as e: continue
open(dst,'wb').write(b.getvalue()); print(os.path.basename(dst),len(b.getvalue())//1024,'KB (nén 256 màu)',meth)
