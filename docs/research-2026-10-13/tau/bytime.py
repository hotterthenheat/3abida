import json,sys,statistics as st
sys.path.insert(0,'tau'); 
from math import log,sqrt,exp,erf
from datetime import datetime
N=lambda x:0.5*(1+erf(x/sqrt(2)))
def bs(S,K,T,s,call,r,q):
    d1=(log(S/K)+(r-q+s*s/2)*T)/(s*sqrt(T)); d2=d1-s*sqrt(T)
    return S*exp(-q*T)*N(d1)-K*exp(-r*T)*N(d2) if call else K*exp(-r*T)*N(-d2)-S*exp(-q*T)*N(-d1)
def bis(f,lo,hi):
    flo=f(lo)
    if flo*f(hi)>0: return None
    for _ in range(100):
        m=(lo+hi)/2;fm=f(m)
        if flo*fm<=0: hi=m
        else: lo,flo=m,fm
    return (lo+hi)/2
rows={}
for f in sys.argv[1:]:
    for x in json.load(open(f))['data']: rows[x['id']]=x
from collections import defaultdict
o=defaultdict(list)
for x in rows.values():
    S=float(x['underlying_price']);K=float(x['strike']);p=float(x['theo']);iv=float(x['implied_volatility']);call=x['option_type']=='call'
    if not(p>=0.05 and 0.03<iv<3): continue
    intr=max(0,S-K) if call else max(0,K-S)
    if p-intr<0.02: continue
    t=datetime.fromisoformat(x['executed_at'].replace('Z','+00:00'))
    e=datetime.fromisoformat(x['expiry']+'T20:00:00+00:00')
    h=(e-t).total_seconds()/3600
    if h<=0 or x['expiry']>'2026-10-16': continue
    Ti=bis(lambda T:bs(S,K,T,iv,call,0.0415,0)-p,1e-9,1)
    if Ti: o[(x['expiry'],x['executed_at'][11:13])].append((h,Ti*8760))
print('expiry     hourZ  n  calendar h   UW implied h   implied−calendar h')
for k in sorted(o):
    v=o[k]; a=st.median(c for c,_ in v); b=st.median(i for _,i in v)
    print(k[0],k[1]+'Z',f'{len(v):4d}',f'{a:9.2f}',f'{b:12.2f}',f'{st.median(i-c for c,i in v):12.2f}')
