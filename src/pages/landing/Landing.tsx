import { useState } from 'react';

const systems = [
  {
    n: '01',
    name: 'COMPASS',
    title: 'Market context',
    body: 'Reads regime, structure, momentum, VWAP, volatility, positioning and setup conditions into one decision surface.',
  },
  {
    n: '02',
    name: 'PINPOINT',
    title: 'Dealer positioning',
    body: 'Surfaces the strikes, pressure zones and scenario levels where positioning can matter.',
  },
  {
    n: '03',
    name: 'TERRAIN',
    title: 'Gamma structure',
    body: 'Maps option exposure across price so the market structure is visible without turning it into a heatmap.',
  },
  {
    n: '04',
    name: 'TRACE',
    title: 'Flow & footprints',
    body: 'Follows options activity, dark-pool prints and time-linked flow without treating every print as a prediction.',
  },
];

const bars = Array.from({ length: 24 }, (_, i) => 34 + ((i * 29) % 130));

function Chart() {
  return (
    <svg viewBox="0 0 700 245" width="100%" height="100%" preserveAspectRatio="none" aria-label="SPX structure preview">
      <g stroke="#212936" strokeWidth="1">
        {[40, 90, 140, 190].map((y) => <path key={`y-${y}`} d={`M0 ${y}H700`} />)}
        {[80, 170, 260, 350, 440, 530, 620].map((x) => <path key={`x-${x}`} d={`M${x} 0V245`} />)}
      </g>
      <path
        d="M0 208 C60 196 70 180 110 187 S170 150 208 164 S245 140 270 145 S318 113 352 121 S405 104 438 95 S495 107 526 87 S580 55 610 71 S650 48 700 31"
        fill="none"
        stroke="#dce4ef"
        strokeWidth="2"
      />
      <path
        d="M0 210 C50 198 90 193 130 177 S210 165 260 147 S350 129 420 118 S560 92 700 73"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1"
      />
      <path d="M0 179H700" stroke="#089981" strokeDasharray="6 6" />
      <path d="M0 125H700" stroke="#f23645" strokeDasharray="5 8" />
      <circle cx="610" cy="71" r="4" fill="#e8edf5" />
    </svg>
  );
}

export default function Landing() {
  const [tab, setTab] = useState('Structure');

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="slayer-landing">
      <style>{`
        .slayer-landing{--bg:#0b0e14;--surface:#12161f;--surface2:#181d28;--line:#252d3a;--text:#e8edf5;--muted:#8e98a9;--blue:#3b82f6;--green:#089981;--red:#f23645;background:var(--bg);color:var(--text);min-height:100vh;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",Segoe UI,sans-serif}
        .slayer-landing *{box-sizing:border-box}.slayer-landing a{color:inherit;text-decoration:none}.slayer-landing button{font:inherit}
        .slayer-wrap{width:min(1240px,calc(100% - 40px));margin:0 auto}.slayer-nav{position:sticky;top:0;z-index:20;background:rgba(11,14,20,.94);backdrop-filter:blur(8px);border-bottom:1px solid rgba(37,45,58,.8)}
        .slayer-navin{height:64px;display:flex;align-items:center;justify-content:space-between}.slayer-brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:-.02em;font-size:14px}.slayer-mark{width:22px;height:22px;display:grid;place-items:center;border:1px solid #465062;font-size:10px}.slayer-links{display:flex;gap:26px;color:#a9b2c1;font-size:13px}.slayer-links a:hover{color:#fff}.slayer-navcta{border:1px solid #3b4657;background:#141a23;color:#fff;padding:9px 13px;font-size:12px;cursor:pointer}
        .slayer-hero{padding:86px 0 56px;border-bottom:1px solid var(--line);overflow:hidden}.slayer-hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}.slayer-eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6f7b8f;margin-bottom:20px}.slayer-hero h1{font-size:clamp(42px,6.4vw,82px);line-height:.98;letter-spacing:-.055em;margin:0 0 22px;font-weight:700}.slayer-hero h1 em{font-style:normal;color:#8f9aaa}.slayer-lede{max-width:620px;color:#a4aebe;font-size:18px;line-height:1.6;margin:0 0 28px}.slayer-actions{display:flex;gap:10px;flex-wrap:wrap}.slayer-btn{padding:12px 16px;font-size:13px;border:1px solid #354052;background:#111720;color:#fff;cursor:pointer}.slayer-btnprimary{background:#e7ebf2;color:#0b0e14;border-color:#e7ebf2}.slayer-micro{display:flex;gap:18px;margin-top:22px;color:#687489;font-size:11px}.slayer-micro span:before{content:"•";margin-right:7px;color:#566174}
        .slayer-terminal{background:#0d1118;border:1px solid #2b3443;box-shadow:0 22px 60px rgba(0,0,0,.34)}.slayer-termtop{height:38px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid #252d3a;color:#778397;font-size:10px}.slayer-dots{display:flex;gap:5px}.slayer-dots i{width:6px;height:6px;border-radius:50%;background:#3c4656}.slayer-termmain{padding:14px}.slayer-termhead{display:flex;justify-content:space-between;align-items:end;border-bottom:1px solid #232b38;padding:6px 0 12px}.slayer-ticker{font-size:18px;font-weight:700}.slayer-price{font-size:21px}.slayer-up{color:var(--green)}.slayer-grid{display:grid;grid-template-columns:1.35fr .65fr;gap:10px;margin-top:12px}.slayer-panel{border:1px solid #232c39;background:#10151d}.slayer-panelhead{padding:9px 10px;border-bottom:1px solid #232c39;display:flex;justify-content:space-between;font-size:9px;color:#78849a;letter-spacing:.08em;text-transform:uppercase}.slayer-chart{height:245px;padding:10px}.slayer-levels{padding:8px 10px}.slayer-level{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #1e2632;font-size:11px}.slayer-level:last-child{border-bottom:0}.slayer-signal{display:flex;gap:8px;align-items:center;color:#9ea8b8}.slayer-dot{width:6px;height:6px;border-radius:50%}.slayer-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px}.slayer-stat{border-top:1px solid #26303e;padding-top:9px}.slayer-stat b{display:block;font-size:15px;margin-bottom:3px}.slayer-stat span{font-size:9px;color:#778397}
        .slayer-section{padding:92px 0;border-bottom:1px solid var(--line)}.slayer-section h2{font-size:40px;letter-spacing:-.035em;margin:0 0 13px}.slayer-sectionlede{color:#8f99aa;max-width:720px;font-size:16px;margin:0}.slayer-proof{display:grid;grid-template-columns:.7fr 1.3fr;gap:36px;margin-top:34px}.slayer-proofpanel{border:1px solid var(--line);background:#10151c}.slayer-proofleft{padding:28px}.slayer-big{font-size:46px;letter-spacing:-.05em;margin:6px 0}.slayer-label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#667287}.slayer-note{font-size:12px;color:#8994a7;margin-top:10px;max-width:320px}.slayer-profright{padding:14px}.slayer-bars{display:grid;grid-template-columns:repeat(24,1fr);gap:4px;align-items:end;height:210px;padding:20px 8px 8px}.slayer-bars i{display:block;background:#273141}.slayer-bars i:nth-child(3n){background:#35445b}.slayer-bars i:nth-child(5n){background:#315b57}.slayer-eventline{display:flex;justify-content:space-between;font-size:10px;color:#6e7a8f;border-top:1px solid #27303c;padding:10px}.slayer-provenance{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:28px}.slayer-tag{border:1px solid var(--line);padding:18px;background:#0f141b}.slayer-tag b{font-size:11px;letter-spacing:.1em;text-transform:uppercase}.slayer-tag p{font-size:12px;color:#818b9d;margin:8px 0 0}
        .slayer-products{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:32px}.slayer-product{border-top:2px solid #293342;padding:18px 2px 10px}.slayer-product .n{font-size:10px;color:#59667a}.slayer-product h3{font-size:19px;margin:20px 0 8px}.slayer-product p{font-size:12px;color:#828da0;line-height:1.65}.slayer-product button{font-size:11px;color:#b8c1cf;background:none;border:0;padding:0;cursor:pointer}
        .slayer-split{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start}.slayer-checklist{margin-top:25px;border-top:1px solid var(--line)}.slayer-check{display:flex;gap:12px;padding:13px 0;border-bottom:1px solid var(--line);font-size:13px}.slayer-check i{width:7px;height:7px;border-radius:50%;background:#6e7a8d;margin-top:7px;flex:0 0 auto}.slayer-quote{border-left:2px solid #566174;padding-left:18px;color:#b4bdca;font-size:24px;line-height:1.4;max-width:510px}
        .slayer-cta{padding:90px 0}.slayer-ctabox{border:1px solid #303a49;background:#10151d;padding:54px;text-align:center}.slayer-ctabox h2{margin:0 0 12px;font-size:54px;letter-spacing:-.05em}.slayer-ctabox p{margin:0 auto 26px;color:#8f99aa;max-width:600px}.slayer-footer{padding:25px 0 50px;color:#626e82;font-size:11px;display:flex;justify-content:space-between}.slayer-footerlinks{display:flex;gap:18px}
        @media(max-width:900px){.slayer-hero-grid,.slayer-proof,.slayer-split{grid-template-columns:1fr}.slayer-products{grid-template-columns:1fr 1fr}.slayer-links{display:none}.slayer-hero{padding-top:50px}.slayer-grid{grid-template-columns:1fr}}
        @media(max-width:560px){.slayer-wrap{width:min(100% - 24px,1240px)}.slayer-products{grid-template-columns:1fr}.slayer-section{padding:65px 0}.slayer-ctabox{padding:35px 22px}.slayer-ctabox h2{font-size:40px}.slayer-hero h1{font-size:43px}.slayer-lede{font-size:16px}.slayer-micro{flex-direction:column;gap:6px}}
      `}</style>

      <header className="slayer-nav">
        <div className="slayer-wrap slayer-navin">
          <a className="slayer-brand" href="#top"><span className="slayer-mark">S</span><span>SLAYER TERMINAL</span></a>
          <div className="slayer-links">
            <a href="#terminal">Terminal</a><a href="#proof">Proof</a><a href="#systems">Systems</a><a href="#method">Method</a>
          </div>
          <button className="slayer-navcta" onClick={() => scrollTo('launch')}>Enter Terminal</button>
        </div>
      </header>

      <main id="top">
        <section className="slayer-hero">
          <div className="slayer-wrap slayer-hero-grid">
            <div>
              <div className="slayer-eyebrow">MARKET INTELLIGENCE / 01</div>
              <h1>Trade what<br /><em>you can see.</em></h1>
              <p className="slayer-lede">The market is public. The problem is that the useful pieces are scattered. Slayer Terminal brings positioning, structure, volatility, flow, and levels into one trading workspace.</p>
              <div className="slayer-actions">
                <button className="slayer-btn slayer-btnprimary" onClick={() => scrollTo('terminal')}>Explore the terminal</button>
                <button className="slayer-btn" onClick={() => scrollTo('systems')}>View systems</button>
              </div>
              <div className="slayer-micro"><span>Real market data</span><span>Deterministic calculations</span><span>Evidence before claims</span></div>
            </div>

            <div id="terminal">
              <div className="slayer-terminal">
                <div className="slayer-termtop"><div className="slayer-dots"><i/><i/><i/></div><span>SLAYER / COMPASS / SPX</span><span>LIVE CONTEXT</span></div>
                <div className="slayer-termmain">
                  <div className="slayer-termhead">
                    <div><div className="slayer-ticker">SPX</div><div className="slayer-signal"><span className="slayer-dot" style={{ background: '#089981' }}/>{'Dealer regime / constructive'}</div></div>
                    <div style={{ textAlign: 'right' }}><div className="slayer-price">5,742.18</div><div className="slayer-up">+28.44 &nbsp; +0.50%</div></div>
                  </div>
                  <div className="slayer-grid">
                    <div className="slayer-panel">
                      <div className="slayer-panelhead"><span>{tab}</span><span>1D / 5M</span></div>
                      <div className="slayer-chart"><Chart /></div>
                    </div>
                    <div className="slayer-panel">
                      <div className="slayer-panelhead"><span>Key levels</span><span>SPX</span></div>
                      <div className="slayer-levels">
                        {[
                          ['5,760','upper','#3b82f6'],['5,742','spot','#089981'],['5,725','gamma wall','#f23645'],['5,698','support','#3b82f6'],['5,680','lower','#f23645']
                        ].map(([price,label,fill]) => (
                          <button key={price} className="slayer-level" style={{ width:'100%', background:'transparent', borderLeft:0,borderRight:0,borderTop:0,cursor:'pointer',color:'inherit',textAlign:'left' }} onClick={() => setTab(label === 'gamma wall' ? 'Positioning' : 'Structure')}>
                            <strong>{price}</strong><span className="slayer-signal"><span className="slayer-dot" style={{ background: fill }}/>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="slayer-stats">
                    <div className="slayer-stat"><b>+1.28</b><span>GEX regime</span></div>
                    <div className="slayer-stat"><b>62.4%</b><span>Call-side control</span></div>
                    <div className="slayer-stat"><b>5,725</b><span>Primary wall</span></div>
                    <div className="slayer-stat"><b>11:42:06</b><span>Snapshot</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="slayer-section" id="proof">
          <div className="slayer-wrap">
            <h2>See the market before you act.</h2>
            <p className="slayer-sectionlede">Slayer is built around evidence: observed market inputs, explicit calculations, and clearly labeled modeled context. No mystery score hiding behind a polished dashboard.</p>
            <div className="slayer-proof">
              <div className="slayer-proofpanel slayer-proofleft"><div className="slayer-label">Historical snapshot</div><div className="slayer-big">SPX 5,713</div><div className="slayer-label">13 Sep / 10:35 ET</div><p className="slayer-note">Positioning concentrated above spot. The terminal surfaces the levels and the state change; the trader decides what to do with them.</p></div>
              <div className="slayer-proofpanel slayer-profright">
                <div className="slayer-label" style={{ padding:'4px 8px 0' }}>Positioning by price</div>
                <div className="slayer-bars">{bars.map((h,i)=><i key={i} style={{height:`${h}px`}} />)}</div>
                <div className="slayer-eventline"><span>5,680</span><span>spot</span><span>5,713</span><span>wall</span><span>5,760</span></div>
              </div>
            </div>
            <div className="slayer-provenance">
              {[
                ['Observed','Prices, prints, open interest, volatility and market inputs.'],
                ['Calculated','Deterministic transformations and derived positioning measures.'],
                ['Modeled','Scenarios are separated from facts and labeled as such.'],
              ].map(([title,body])=> <div className="slayer-tag" key={title}><b>{title}</b><p>{body}</p></div>)}
            </div>
          </div>
        </section>

        <section className="slayer-section" id="systems">
          <div className="slayer-wrap">
            <h2>One terminal. Separate systems.</h2>
            <p className="slayer-sectionlede">Each module has one job. The terminal keeps the workflow connected without turning every concept into another card or another acronym wall.</p>
            <div className="slayer-products">
              {systems.map(s => (
                <div className="slayer-product" key={s.name}>
                  <div className="n">{s.n} / {s.name}</div><h3>{s.title}</h3><p>{s.body}</p>
                  <button onClick={() => scrollTo('launch')}>Open {s.name} →</button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="slayer-section" id="method">
          <div className="slayer-wrap slayer-split">
            <div>
              <h2>Built for traders who inspect the data.</h2>
              <p className="slayer-sectionlede">Slayer should tell you what it knows, how it got there, and where the uncertainty begins.</p>
              <div className="slayer-checklist">
                {[
                  ['Deterministic engine','Same inputs, same result. Versioned calculations.'],
                  ['Source provenance','Data origin and calculation state remain visible.'],
                  ['No silent defaults','Unavailable inputs stay unavailable.'],
                  ['Trader-controlled execution','The terminal informs a decision; it does not make it for you.'],
                ].map(([title,body]) => <div className="slayer-check" key={title}><i/><div><b>{title}</b><br/><span style={{color:'#7f899b'}}>{body}</span></div></div>)}
              </div>
            </div>
            <div><div className="slayer-quote">“The interface should make the market's structure easier to inspect — not make the product sound smarter than the data.”</div><div style={{marginTop:30,color:'#6f7b8e',fontSize:11}}>SLAYER TERMINAL / PRODUCT PRINCIPLE</div></div>
          </div>
        </section>

        <section className="slayer-cta" id="launch">
          <div className="slayer-wrap">
            <div className="slayer-ctabox">
              <div className="slayer-eyebrow">ENTER SLAYER</div>
              <h2>See the market.<br />Then trade it.</h2>
              <p>Explore the terminal, inspect the systems, and build your read from the same market context every session.</p>
              <button className="slayer-btn slayer-btnprimary" onClick={() => window.alert('Preview only — launch flow is not connected yet.')}>Enter Slayer Terminal</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="slayer-wrap slayer-footer"><span>© 2026 Slayer Terminal</span><div className="slayer-footerlinks"><a href="/status">Status</a><a href="/legal">Legal</a><a href="https://x.com/JoinSlayer">X</a></div></footer>
    </div>
  );
}
