# Bản nộp cho ảnh vân giấy quá nặng: giữ NGUYÊN điểm ảnh chữ/ảnh/logo (khác bản "chỉ nền" > 6), làm mịn vân giấy phần còn lại
# (Gaussian 1,6 px), rồi nén 256 màu. Số đo tương phản lấy trên bản gốc chưa nén.
import sys,io,os
import numpy as np
from PIL import Image,ImageFilter
goc,nen,dst=sys.argv[1:4]
a=Image.open(goc).convert('RGB');A=np.asarray(a).astype(int);B=np.asarray(Image.open(nen).convert('RGB')).astype(int)
m=(np.abs(A-B).max(2)>6)
m=np.asarray(Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.MaxFilter(5)))>0
for r in [1.6,2.4,3.5]:
  M=np.asarray(a.filter(ImageFilter.GaussianBlur(r)));C=np.where(m[...,None],A,M).astype('uint8')
  q=Image.fromarray(C).quantize(colors=256,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE);b=io.BytesIO();q.save(b,'PNG',optimize=True)
  if b.tell()<=600*1024:break
open(dst,'wb').write(b.getvalue());print(os.path.basename(dst),b.tell()//1024,'KB, mịn vân',r,'px')
