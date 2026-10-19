# Đo tương phản trên ảnh "chỉ nền" (chữ trong suốt, bố cục y nguyên). Dùng: python3 -I do.py <thư-mục-làm-việc> [tiền tố]
import json,glob,os,re,sys
import numpy as np
from PIL import Image
WD=sys.argv[1]; PRE=sys.argv[2] if len(sys.argv)>2 else ''
def lin(v):
    v=v/255.0; return np.where(v<=0.04045,v/12.92,((v+0.055)/1.055)**2.4)
def L(a): a=lin(np.asarray(a,dtype=np.float64)); return 0.2126*a[...,0]+0.7152*a[...,1]+0.0722*a[...,2]
def rgb(s):
    s=s.strip()
    if s.startswith('#'): return np.array([int(s[i:i+2],16) for i in (1,3,5)],float)
    return np.array([float(x) for x in re.findall(r'[\d.]+',s)[:3]])
out={}
for jf in sorted(glob.glob(f'{WD}/nen/{PRE}*.json')):
    ten=os.path.basename(jf)[:-5]; info=json.load(open(jf))
    im=np.asarray(Image.open(f'{WD}/nen/{ten}.png').convert('RGB')).astype(np.int16); H,W,_=im.shape; Lim=L(im); rows=[]
    for t in info['do']:
        if not t['hop']: continue
        m=np.zeros((H,W),bool)
        for b in t['hop']:
            x0,y0=max(0,int(b['x'])),max(0,int(b['y'])); x1,y1=min(W,int(b['x']+b['w']+1)),min(H,int(b['y']+b['h']+1)); m[y0:y1,x0:x1]=True
        lb=Lim[m]
        cols=[rgb(c) for c in t['mau'].split(',')] if t['vang'] else [rgb(t['mau'])]
        p1=[];md=[]
        for c in cols:
            Lt=float(L(c[None,:])[0]); cr=(np.maximum(lb,Lt)+0.05)/(np.minimum(lb,Lt)+0.05)
            p1.append(float(np.percentile(cr,1))); md.append(float(np.median(cr)))
        lon=t['co']>=24 or (t['co']>=18.66 and t['dam']>=700)
        rows.append(dict(lop=t['lop'],chu=t['chu'],co=round(t['co'],1),lon=lon,nguong=3.0 if lon else 4.5,xau=round(min(p1),2),giua=round(min(md),2)))
    out[ten]=dict(chu=rows,loi=info['loi'],ds=info['ds'])
json.dump(out,open(f'{WD}/ket-qua-{PRE or "tat-ca"}.json','w'),ensure_ascii=False,indent=1)
for k,v in out.items():
    w=min(v['chu'],key=lambda r:r['xau']/r['nguong'])
    bad=[r for r in v['chu'] if r['xau']<r['nguong']]
    print(f"{k:24s} kem nhat: {w['lop']:6s} {w['xau']:6.2f} (nguong {w['nguong']})  {'KHONG DAT: '+', '.join(r['lop']+'='+str(r['xau']) for r in bad) if bad else 'dat'} | "+' '.join(f"{r['lop']}={r['xau']}" for r in v['chu']))
