# Bản nộp cho ảnh vân giấy quá nặng: giữ NGUYÊN điểm ảnh chữ/ảnh/logo (khác bản "chỉ nền" > 6), làm mịn vân giấy phần còn lại
# (Gaussian 1,6 px), rồi nén 256 màu. Số đo tương phản lấy trên bản gốc chưa nén.
import sys,io,os
import numpy as np
from PIL import Image,ImageFilter
goc,nen,dst=sys.argv[1:4]
a=Image.open(goc).convert('RGB');A=np.asarray(a).astype(int);B=np.asarray(Image.open(nen).convert('RGB')).astype(int)
m=(np.abs(A-B).max(2)>6)
import json
info=json.load(open(nen[:-4]+'.json'))
Y,X=np.mgrid[0:A.shape[0],0:A.shape[1]]
q=info['anh'];cx,cy,rx,ry=q['x']+q['w']/2,q['y']+q['h']/2,q['w']/2+3,q['h']/2+3;m|=((X-cx)/rx)**2+((Y-cy)/ry)**2<=1   # ô ảnh (bầu dục bám sát)
th=[r for r in info['chu'] if r['lop']=='th']
if th and th[0]['hop']:
  b=th[0]['hop'][0];ngang=A.shape[1]>A.shape[0]
  lx,ly=(b['x']-34,b['y']+b['h']/2) if ngang else (b['x']+b['w']/2,b['y']-58)   # chứng nhận: logo bên trái tên; thẻ: logo phía trên
  m|=((X-lx)**2+(Y-ly)**2)<=(28 if ngang else 40)**2
md=np.asarray(a.filter(ImageFilter.MedianFilter(7))).astype(int);m|=np.abs(A-md).max(2)>28   # nét mảnh: đường viền, gạch
m=np.asarray(Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.MaxFilter(5)))>0
for r,k in [(1.6,0),(2.4,0),(2.4,24),(2.4,16)]:
  M=a.filter(ImageFilter.GaussianBlur(r))
  if k:M=M.quantize(colors=k,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert('RGB')  # vân giấy còn k màu
  M=np.asarray(M);C=np.where(m[...,None],A,M).astype('uint8')
  q=Image.fromarray(C).quantize(colors=256,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE);b=io.BytesIO();q.save(b,'PNG',optimize=True)
  if b.tell()<=600*1024:break
open(dst,'wb').write(b.getvalue());print(os.path.basename(dst),b.tell()//1024,'KB, mịn vân',r,'px', f'nền {k} màu' if k else '')
