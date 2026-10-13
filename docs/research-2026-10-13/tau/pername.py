import json,sys,statistics as st
from math import log,sqrt,exp,erf,pi
from datetime import datetime,date,timedelta,timezone
n=lambda x:exp(-x*x/2)/sqrt(2*pi); N=lambda x:0.5*(1+erf(x/sqrt(2)))
def load(files):
    rows={}
    for f in files:
        for x in json.load(open(f))['data']: rows[x['id']]=x
    P=[]
    for x in rows.values():
        try: S=float(x['underlying_price']);K=float(x['strike']);p=float(x['theo']);iv=float(x['implied_volatility']);g=float(x['gamma']);d=float(x['delta'])
        except: continue
        call=x['option_type']=='call'
        t=datetime.fromisoformat(x['executed_at'].replace('Z','+00:00'))
        if not(13.5<=t.hour+t.minute/60<20) or not(p>=0.05 and 0.03<iv<3) or g<=0: continue
        dd=(date.fromisoformat(x['expiry'])-t.date()).days
        if dd<0 or dd>60: continue
        Tc=(datetime.fromisoformat(x['expiry']+'T20:00:00+00:00')-t).total_seconds()/(365*86400)
        if Tc<=0: continue
        end=datetime.fromisoformat(x['expiry']+'T20:00:00+00:00'); day=t.date()
        op=datetime.combine(day,datetime.min.time(),timezone.utc)+timedelta(hours=13,minutes=30); cl=op+timedelta(minutes=390)
        m=max(0,(min(cl,end)-max(t,op)).total_seconds()/60); day+=timedelta(days=1)
        while day<=end.date():
            if day.weekday()<5: m+=390
            day+=timedelta(days=1)
        Tt=m/(390*252)
        Td=Tc if dd==0 else dd/365
        P.append(dict(S=S,K=K,iv=iv,g=g,d=d,call=call,dd=dd,T={'calendar':Tc,'trading':Tt,'days':Td}))
    return P
def gerr(P,r,q,conv,sel=lambda dd:True):
    e=[]
    for z in P:
        if not sel(z['dd']): continue
        T=z['T'][conv]; S,K,iv=z['S'],z['K'],z['iv']
        if T<=0: continue
        d1=(log(S/K)+(r-q+iv*iv/2)*T)/(iv*sqrt(T))
        e.append(abs(exp(-q*T)*n(d1)/(S*iv*sqrt(T))/z['g']-1)*100)
    return (st.median(e),len(e)) if e else (float('nan'),0)
if __name__=="__main__":
    name=sys.argv[1]; P=load(sys.argv[2:])
    import os
    r,q=float(os.environ.get('R','0.0415')),float(os.environ.get('Q','0'))
    B=(('0',lambda d:d==0),('1',lambda d:d==1),('2-4',lambda d:2<=d<=4),('5-11',lambda d:5<=d<=11),('12-60',lambda d:12<=d<=60))
    print(f'{name}: n={len(P)} r={r:.4f} q={q:.3f} (UW measured carry)')
    print('  DTE    n  | median |γ err| %: days@fit  calendar@fit  trading@fit | days@house(4.2%,1.2%)  calendar@house')
    for lab,sel in B:
        a=gerr(P,r,q,'days',sel)
        if not a[1]: continue
        print(f'  {lab:5s}{a[1]:4d}  | {a[0]:9.3f} {gerr(P,r,q,"calendar",sel)[0]:12.3f} {gerr(P,r,q,"trading",sel)[0]:12.3f} | {gerr(P,0.042,0.012,"days",sel)[0]:12.3f} {gerr(P,0.042,0.012,"calendar",sel)[0]:16.3f}')
