# What share of each near-money strike's gamma (OI-weighted, European, UW's convention) sits in 12–60 DTE puts and in
# 1–11 DTE puts, on SPY's recorded chain — to size the American-exercise gap measured on single contracts.
import json,sys
from math import log,sqrt,exp,pi
from datetime import date
# argv[1]: a recorded day's SPY chain.jsonl from .feed-cache/field/SPY/<day>/, gunzipped
ch=json.loads(open(sys.argv[1]).read().splitlines()[-1])['rows']
S=777.5; today=date(2026,10,13); R=0.0415   # Tuesday's open, Monday's close price
n=lambda x:exp(-x*x/2)/sqrt(2*pi)
from collections import defaultdict
tot=defaultdict(float); p12=defaultdict(float); p1=defaultdict(float)
for sym,oi,iv,_ in ch:
    if not iv or oi<=0: continue
    e=date(2000+int(sym[3:5]),int(sym[5:7]),int(sym[7:9])); dd=(e-today).days
    if dd<0 or dd>60: continue
    K=int(sym[-8:])/1000; T=(6.5/24/365) if dd==0 else dd/365
    d1=(log(S/K)+(R+iv*iv/2)*T)/(iv*sqrt(T)); g=n(d1)/(S*iv*sqrt(T))*oi
    tot[K]+=g
    if sym[9]=='P' and dd>=12: p12[K]+=g
    if sym[9]=='P' and 1<=dd<=11: p1[K]+=g
print('strike  share of gamma in 12–60d puts  in 1–11d puts   est. strike gap (×5.4% / ×0.6%)')
for K in sorted(k for k in tot if abs(k-S)<=8):
    a=p12[K]/tot[K]; b=p1[K]/tot[K]
    print(f'{K:6.0f}  {a*100:6.1f}%  {b*100:6.1f}%   {(a*5.4+b*0.6):.2f}%')
