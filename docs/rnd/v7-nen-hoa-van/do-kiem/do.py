# Đo trên ảnh "chỉ nền" (chữ trong suốt, bố cục y nguyên) xuất bằng html-to-image.
import json,glob,os,re
import numpy as np
from PIL import Image
def lin(v):
    v=v/255.0; return np.where(v<=0.04045,v/12.92,((v+0.055)/1.055)**2.4)
def L(a): a=lin(a.astype(np.float64)); return 0.2126*a[...,0]+0.7152*a[...,1]+0.0722*a[...,2]
def rgb(s): return np.array([float(x) for x in re.findall(r'[\d.]+',s)[:3]])
out={}
for jf in sorted(glob.glob('nen/*.json')):
    ten=os.path.basename(jf)[:-5]; info=json.load(open(jf))
    im=np.asarray(Image.open(f'nen/{ten}.png').convert('RGB')).astype(np.int16)
    H,W,_=im.shape; base=rgb(info['nen']); Lim=L(im)
    rows=[]
    for t in info['chu']:
        if not t['hop']: continue
        Lt=float(L(rgb(t['mau'])[None,:])[0]); m=np.zeros((H,W),bool)
        for b in t['hop']:
            x0,y0=max(0,int(b['x'])),max(0,int(b['y'])); x1,y1=min(W,int(b['x']+b['w']+1)),min(H,int(b['y']+b['h']+1)); m[y0:y1,x0:x1]=True
        lb=Lim[m]; cr=(np.maximum(lb,Lt)+0.05)/(np.minimum(lb,Lt)+0.05)
        lon=t['co']>=24 or (t['co']>=18.66 and t['dam']>=700)
        dev=np.abs(im[m]-base).max(axis=1)
        rows.append(dict(lop=t['lop'],chu=t['chu'][:40],co=t['co'],nguong=4.5,wcag=3.0 if lon else 4.5,xau=round(float(np.percentile(cr,1)),2),giua=round(float(np.median(cr)),2),
                         lech_max=int(dev.max()),lech_p99=int(np.percentile(dev,99))))
    a=info['anh']; yy,xx=np.mgrid[0:H,0:W]
    cx,cy=a['x']+a['w']/2,a['y']+a['h']/2; r=min(a['w'],a['h'])/2
    hx,hy=a['w']/2-r,a['h']/2-r
    qx=np.maximum(np.abs(xx+0.5-cx)-hx,0); qy=np.maximum(np.abs(yy+0.5-cy)-hy,0); d=np.hypot(qx,qy)-r
    ring=(d>=3)&(d<=24); dv=np.abs(im[ring]-base).max(axis=1)
    out[ten]=dict(ds=info['ds'],chu=rows,vong_anh=dict(lech_max=int(dv.max()),lech_p99=int(np.percentile(dv,99))),
                  kich_thuoc=f'{W}x{H}')
json.dump(out,open('ket-qua.json','w'),ensure_ascii=False,indent=1)
for k,v in out.items():
    ten=[r for r in v['chu'] if r['lop']=='ten'][0]
    worst=min(v['chu'],key=lambda r:r['xau']/r['nguong'])
    print(f"{k:28s} ten:lech_max={ten['lech_max']:3d} p99={ten['lech_p99']:3d} | vong anh lech_max={v['vong_anh']['lech_max']:3d} | kem nhat {worst['lop']}: {worst['xau']} (nguong {worst['nguong']}) | ", ' '.join(f"{r['lop']}={r['xau']}/{r['giua']}" for r in v['chu']))
