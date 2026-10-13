# Three conventions side by side, by expiry and by hour: calendar to 16:00 ET, trading time,
# and "days": today's expiry in exact hours, a later one in whole calendar days (date difference).
import json,sys,statistics as st
from math import log,sqrt,exp,erf,pi
from datetime import datetime,timedelta,timezone,date
from collections import defaultdict
N=lambda x:0.5*(1+erf(x/sqrt(2))); n=lambda x:exp(-x*x/2)/sqrt(2*pi)
def bs(S,K,T,s,call,r,q):
    d1=(log(S/K)+(r-q+s*s/2)*T)/(s*sqrt(T)); d2=d1-s*sqrt(T)
    return S*exp(-q*T)*N(d1)-K*exp(-r*T)*N(d2) if call else K*exp(-r*T)*N(-d2)-S*exp(-q*T)*N(-d1)
def gam(S,K,T,s,r,q):
    d1=(log(S/K)+(r-q+s*s/2)*T)/(s*sqrt(T)); return exp(-q*T)*n(d1)/(S*s*sqrt(T))
def bis(f,lo,hi):
    flo=f(lo)
    if flo*f(hi)>0: return None
    for _ in range(100):
        m=(lo+hi)/2;fm=f(m)
        if flo*fm<=0: hi=m
        else: lo,flo=m,fm
    return (lo+hi)/2
Y=365*86400
def cal(t,e): return (datetime.fromisoformat(e+'T20:00:00+00:00')-t).total_seconds()/Y
def trd(t,e):
    end=datetime.fromisoformat(e+'T20:00:00+00:00'); d=t.date()
    op=datetime.combine(d,datetime.min.time(),timezone.utc)+timedelta(hours=13,minutes=30); cl=op+timedelta(minutes=390)
    m=max(0,(min(cl,end)-max(t,op)).total_seconds()/60); d+=timedelta(days=1)
    while d<=end.date():
        if d.weekday()<5: m+=390
        d+=timedelta(days=1)
    return m/(390*252)
def days(t,e):
    dd=(date.fromisoformat(e)-t.date()).days
    return cal(t,e) if dd==0 else dd/365
CONV=(('calendar',cal),('trading',trd),('days',days))
rows={}
for f in sys.argv[2:]:
    for x in json.load(open(f))['data']: rows[x['id']]=x
r,q=[float(v) for v in sys.argv[1].split(',')]
by=defaultdict(lambda: defaultdict(list))
for x in rows.values():
    S=float(x['underlying_price']);K=float(x['strike']);p=float(x['theo']);iv=float(x['implied_volatility']);g=float(x['gamma']);call=x['option_type']=='call'
    t=datetime.fromisoformat(x['executed_at'].replace('Z','+00:00'))
    if not(13.5<=t.hour+t.minute/60<20) or not(p>=0.05 and 0.03<iv<3) or g<=0: continue
    intr=max(0,S-K) if call else max(0,K-S)
    if p-intr<0.02: continue
    e=x['expiry']; dd=(date.fromisoformat(e)-t.date()).days
    if cal(t,e)<=0: continue
    b='0' if dd==0 else '1' if dd==1 else '2-4' if dd<=4 else '5-11' if dd<=11 else '12-45' if dd<=45 else '46+'
    import os
    keys=(e,) if os.environ.get('GROUP')=='expiry' else (b, b+' @'+x['executed_at'][11:13]+'Z')
    for k in keys:
        o=by[k]; o['n'].append(1)
        for nm,fn in CONV:
            T=fn(t,e)
            v=bis(lambda s:bs(S,K,T,s,call,r,q)-p,1e-4,5)
            if v is not None: o[nm+'iv'].append(abs(v-iv)*100)
            o[nm+'g'].append(abs(gam(S,K,T,iv,r,q)/g-1)*100)
def md(v): return st.median(v) if v else float('nan')
def p90(v): v=sorted(v); return v[int(0.9*(len(v)-1))] if v else float('nan')
print(f'r={r} q={q}.  Median (p90) |IV re-inverted − UW IV| in vol points, and median |BS gamma at UW IV ÷ UW gamma − 1| in %')
print(f"{'DTE bucket':16s}{'n':>5s} | {'calendar IV':>14s} {'trading IV':>14s} {'days IV':>14s} | {'cal γ%':>7s} {'trd γ%':>7s} {'days γ%':>7s}")
import os
order=sorted(by) if os.environ.get('GROUP')=='expiry' else sorted(by, key=lambda k:(['0','1','2-4','5-11','12-45','46+'].index(k.split(' ')[0]),k))
for k in order:
    o=by[k]
    print(f"{k:16s}{len(o['n']):5d} | "+' '.join(f"{md(o[c+'iv']):6.3f} ({p90(o[c+'iv']):5.2f})" for c,_ in CONV)+' | '+' '.join(f"{md(o[c+'g']):7.2f}" for c,_ in CONV))
