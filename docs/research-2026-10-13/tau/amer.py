# American vs European gamma on real SPY prints near the money: invert each style's vol from the same print price on
# the same CRR tree (r 4.15%, no dividend before expiry within 60 days), then compare the two gammas at their own vols.
import json,glob,sys,statistics as st,random
from math import exp,sqrt,log
from datetime import datetime,date
R=0.0415
def crr(S,K,T,s,put,amer,N):
    dt=T/N; u=exp(s*sqrt(dt)); d=1/u; a=exp(R*dt); p=(a-d)/(u-d); disc=1/a
    v=[max(0.0,(K-S*u**(N-2*j)) if put else (S*u**(N-2*j)-K)) for j in range(N+1)]
    for i in range(N-1,-1,-1):
        v=[disc*(p*v[j]+(1-p)*v[j+1]) for j in range(i+1)]
        if amer:
            v=[max(v[j],(K-S*u**(i-2*j)) if put else (S*u**(i-2*j)-K)) for j in range(i+1)]
    return v[0]
def px(S,K,T,s,put,amer): return (crr(S,K,T,s,put,amer,300)+crr(S,K,T,s,put,amer,301))/2
def iv(S,K,T,p,put,amer):
    lo,hi=0.01,2.0
    for _ in range(40):
        m=(lo+hi)/2
        if px(S,K,T,m,put,amer)>p: hi=m
        else: lo=m
    return (lo+hi)/2
def gam(S,K,T,s,put,amer):
    h=S*0.004
    return (px(S+h,K,T,s,put,amer)-2*px(S,K,T,s,put,amer)+px(S-h,K,T,s,put,amer))/(h*h)
rows={}
for f in sys.argv[1:]:
    for x in json.load(open(f))['data']: rows[x['id']]=x
c=[]
for x in rows.values():
    S=float(x['underlying_price']);K=float(x['strike']);p=float(x['price'])
    t=datetime.fromisoformat(x['executed_at'].replace('Z','+00:00'))
    if not(13.5<=t.hour+t.minute/60<20): continue
    dd=(date.fromisoformat(x['expiry'])-t.date()).days
    if not(1<=dd<=60) or abs(log(S/K))>0.02 or p<0.10: continue
    T=(datetime.fromisoformat(x['expiry']+'T20:00:00+00:00')-t).total_seconds()/(365*86400)
    c.append((dd,S,K,T,p,x['option_type']=='put',x['option_chain_id']))
random.seed(7)
by={}
for z in c: by.setdefault((z[0]>=12, z[5]),[]).append(z)
pick=[]
for k,v in by.items(): pick+=random.sample(v,min(len(v),12))
out=[]
for dd,S,K,T,p,put,sym in sorted(pick):
    ia=iv(S,K,T,p,put,True); ie=iv(S,K,T,p,put,False)
    ga=gam(S,K,T,ia,put,True); ge=gam(S,K,T,ie,put,False)
    out.append((dd,put,(ga/ge-1)*100,(ia-ie)*100))
    print(f'{sym} {dd:3d}d S {S:.2f} K {K:.0f} price {p:.2f}  IV am {ia*100:.2f} eu {ie*100:.2f}  γ am/eu−1 {(ga/ge-1)*100:+.2f}%')
for lab,f in (('puts 1-11d',lambda o:o[1] and o[0]<12),('puts 12-60d',lambda o:o[1] and o[0]>=12),('calls 1-11d',lambda o:not o[1] and o[0]<12),('calls 12-60d',lambda o:not o[1] and o[0]>=12)):
    v=[o for o in out if f(o)]
    if v: print(f'{lab}: n={len(v)}  median |γ gap| {st.median(abs(o[2]) for o in v):.2f}%  max {max(abs(o[2]) for o in v):.2f}%  median IV gap {st.median(o[3] for o in v):+.3f} pts')
