# Launch costs — the notebook's twin

Started 2026-09-17. Walked page by page in the sidebar's order, then the
cross-cutting chapters (servers, accounts, payments, the name, keeping it
running, legal, launch, the buffer). Rules: a price is written only after it
was read off the vendor's page that day (the date and URL sit beside it); a
number we cannot read is a pointer to where it lives, never a guess; sizes
are arithmetic over things we control, with the measurement that replaces
them named.

---

> **2026-09-20 — THE VENDOR CHANGED (Noah: "our data vendor for stocks, futures, options and indices will be
> polygon/massive").** One vendor for all four. Every chapter below that is priced on ThetaData's quote (the running
> total, 1a, 1c, 2, 11, 12) was true for the plan it was written for and is **stale until it is re-walked on Massive's
> numbers** — chapter 13 holds what Massive's business page read that day, what it does to the totals, and what to get
> from their sales desk in writing before anything else is recomputed. Unusual Whales (chapter 3) is untouched.

---

## Running total (every chapter priced on ThetaData's actual quote of 8 July — the three-product bundle at $1,250 for months 1–6, $2,000 for months 7–12; the buffer is chapter 11 — hold three months of the fixed floor, $13,176 delayed or $30,096 real-time; payments is a share of revenue, 4.1% + 30¢ per charge, not a fixed line; the name adds $14/mo for two mail seats and about $11 a year for the domain; keeping it running adds $16.80/mo for the box's weekly backup; legal adds $52/mo (books $38 + terms $14) and Wyoming's $259 in year one then $219 a year, plus three quotes (lawyer, insurance, CPA) and the home-state registration still to read; launch adds $2,200/mo (X Verified Organizations $200 + ads $2,000) — every launch row below carries the $14, the $16.80, the $52 and the $2,200)

Monthly, USD. Only the lines read so far: Compass (chapter 1), market data
(chapter 2), Trace and the Record through Unusual Whales (chapter 3),
servers (chapter 4 — adds $0 at launch: the frontend is free on
Cloudflare, the serving box is the loop's box, the cache sits on it; the
second box +$84 and a managed cache +$20 arrive only when the boxes split),
accounts (chapter 5 — adds $0 at launch: sign-in is inside Supabase Pro,
email is free to about 600 users, then Resend Pro $20/mo — so +$20 on the
1,000-user column). NOT yet in these totals: payments (Stripe's cut is a
share of revenue), the domain, monitoring, legal and the company, launch
tools, the buffer, the optional indices feed ($250 startup / $400 list), any
professional users ($60 each in exchange fees, real-time), and Unusual
Whales' redistribution licence (custom-priced by their sales team — sits on
top of every launch row below).

| Phase | Fixed per month | + 100 users | + 1,000 users |
|---|---|---|---|
| **Backtesting, now** | $129 + Stocks Standard (read the tab) — options history $80, database $25, R2 free tier, small box $24 | — | — |
| **Launch, 15-min delayed, ThetaData's quote months 1–6** | **$4,392** — ThetaData's quoted bundle (options + stocks + indices) $1,250, Unusual Whales Startup $750, OPRA $0, database $25, R2 ≈ $0, loop box $84, mail $14, the box's weekly backup $16.80, books $38, terms $14, X $200, ads $2,000; Nasdaq's delayed-feed rule still to read; + the UW redistribution licence | $4,392 | $4,412 (+$20 email) |
| **Launch, delayed, quote months 7–12** ($2,000 bundle) | $5,142 | $5,142 | $5,162 |
| **Launch, delayed, if month 13 is list** ($3,200 for the three) | $6,342 | $6,342 | $6,362 |
| **Launch, REAL-TIME THROUGH THE MARKET VALUE BUNDLE** (ThetaData's penny-adjusted bid/ask and live quotes — a derived value, not OPRA's own quote — so the exchange lines fall away; per ThetaData sales, 2026-09-17, TO BE WRITTEN INTO THE CONTRACT) | **$4,392** months 1–6 · $5,142 months 7–12 · $6,342 if month 13 is list | the same — no per-user exchange fee | +$20 email: $4,412 · $5,162 · $6,362 |
| Launch, real-time UNADJUSTED, quote months 1–6 — the fallback if the exchanges do not agree | **$9,182 to $10,032** — the delayed floor $4,392 + OPRA redistribution $650 (query-only) or $1,500 + OPRA non-display $2,000 + Nasdaq external distributor $2,140 | $9,407 to $10,257 (+$2.25 a user) | $11,452 to $12,302 |
| **Launch, real-time, quote months 7–12** | $9,932 to $10,782 | $10,157 to $11,007 | $12,202 to $13,052 |
| **Launch, real-time, if month 13 is list** | $11,132 to $11,982 | $11,357 to $12,207 | $13,402 to $14,252 |

Two of the real-time lines (OPRA non-display $2,000, Nasdaq distributor
$2,140) may be carried inside ThetaData's commercial licence — the sales
question in chapter 2. If they are, the real-time floor drops to $2,509 to
$3,359 at startup rates. Unusual Whales' annual billing takes $125 off the
Startup line ($625/mo) on every launch row.

---

## 1. Compass

**What Compass needs money for.** Two things, and they are different
purchases: the HISTORY to backtest against (bought once, kept), and the
STORAGE for the loop's own records (grows every session, forever).

### 1a. The history to backtest against

What the four kinds read (from `docs/compass-backtest-spec.md` and the
partner's rulings of 2026-08-02):

| Kind | Reads at the moment it fires | History product it needs |
|---|---|---|
| Quick scalp | intraday chain quotes (bid/ask, sizes), intraday trades for flow pressure, 1-minute bars, time left in the session | options QUOTES + TRADES, tick level, intraday; stock 1-minute bars |
| Discounted | the chain's IV, Greeks and open interest; bid/ask for the costs; bars for the physical forecast | options quotes + IV/Greeks/OI; stock bars |
| Rebound | bars for ATR, VWAP and displacement; trades for flow reversal and absorption; open interest for dealer support | stock 1-minute bars with volume; options OI + quotes + trades |
| Big orders (whale sweeps) | every trade with its size and conditions, and the NBBO at the moment of the trade | options TRADE-WITH-QUOTE, tick level |
| Top picks · All | views over the four above | nothing extra |

Ruling already on file: intraday from day one (Noah, 2026-08-02), so
end-of-day products are out.

**Prices read 2026-09-17:**

| Vendor · plan | Price | What it gives | Source |
|---|---|---|---|
| ThetaData · Options Standard | **$80/month** | tick-level quotes (every OPRA NBBO) and trades, chain snapshots, 8 years of history (docs: from 2016-01-01), IV / first-order Greeks / OI endpoints, 15K trade streams, 4 concurrent requests (was 2 on 2026-08-02) | thetadata.net/pricing · docs.thetadata.us Subscriptions |
| ThetaData · Options Pro | $160/month | adds every option trade streamed live, 12 years, 8 concurrent requests | same |
| ThetaData · Options Value | $40/month | 1-minute intervals only, 4 years — too coarse for Quick scalp and Big orders | same |
| ThetaData · Stocks Standard | **price sits on the pricing page's Stocks tab — read it there** (the page loads the Options tab first; the fetcher could not switch tabs). Docs: 1-minute bars from 2016-01-01, real time, 4 concurrent requests, Splits endpoint included | thetadata.net/pricing (Stocks tab) |
| Massive (the company formerly Polygon.io; polygon.io/pricing redirects there) · Options Advanced | $199/month | trades AND quotes, "5+ years", real time | massive.com/options |
| Massive · Options Developer | $79/month | trades only, 4 years, 15-minute delayed — no quotes, so no costs or spreads | massive.com/options |
| Databento · OPRA.PILLAR historical | **pay per GB; the exact rate appears only in their Batch download tool once you specify symbols, dates and schemas** — $125 free credit on sign-up, no subscription | databento.com/pricing → Data catalog → Batch download |

**Pick for backtesting:** ThetaData Options Standard + Stocks Standard. It is
the only plan under $200 with tick quotes AND trades AND open interest back
to 2016, which is every column the four kinds read. Massive Advanced costs
more for less history. Databento is the right tool if we ever want one
exact slice (a month of one name) rather than a subscription.

Licence: the retail plans are "Individual Personal use only, no
redistribution or business use". Backtesting and development are personal
use. The day the boards show vendor-derived numbers to paying users is the
commercial tier — see the note at the foot of this chapter.

**Notebook line, 1a:** ThetaData Options Standard $80 + Stocks Standard
(read the tab) per month, from the month backtesting starts. One-off, no
setup fee.

### 1b. Where the loop's records live

**What "the loop" stores, in plain words.** Four kinds of record, all
defined in `src/types/journal.ts`:

1. **The photograph** (`FeatureSnapshot`): what the engine saw for one name
   at one instant — spot, IV, RSI, the walls and the flip, dark pool
   posture, the news lean, the nine factor scores. One per name per scan.
2. **The choice** (`DecisionEvent`): one contract, the marks it was priced
   at, the score, the verdict, the targets, the invalidation. One per
   candidate per scan — and the spec says write one for EVERY scored
   candidate, not only the ones shown, or the loop learns from a biased
   sample.
3. **The verdict** (`OutcomeEvent`): what the market then did — real
   crossings only, exit reason, path stats, P/L. One per choice, written
   when it resolves.
4. **The lesson** (`EvaluationRun`, `WeightsRevision`): a pass over a
   window of verdicts, and the one door through which weights change. A
   handful per month.

Photographs and choices are append-only and never edited. That shape
decides the store: they belong in cheap object storage as files, and only
the recent window plus every verdict and lesson belong in a database the app
queries.

**Measured sizes of our records** (2026-09-17, one sample of each shape
serialised as JSON): a choice 684 bytes, a photograph 762 bytes, a verdict
491 bytes.

**Growth, as arithmetic** (names in the point-in-time universe × candidates
scored per name × scans per session; the spec's universe is about the top
1,000 optionable names + index ETFs):

| Cadence | Choices per day | Photographs per day | Per day | Per year (252 sessions) |
|---|---|---|---|---|
| 1,000 names × 10 candidates × 26 scans (every 15 min) | 260,000 | 26,000 | 325 MB | 82 GB |
| 1,000 × 10 × 78 (every 5 min) | 780,000 | 78,000 | 976 MB | 246 GB |
| 1,000 × 25 × 78 | 1,950,000 | 78,000 | 2.35 GB | 592 GB |

Those are JSON bytes, the ceiling. Columnar files compress them several
times over; the exact factor is measured on the first week of real records,
not assumed. The three parameters are ours to set; the one true unknown is
the size of the VENDOR history we pull (quotes for 1,000 names, tick level),
which only a one-week pull through the plan above can measure.

**Prices read 2026-09-17:**

| Store | Price | Notes | Source |
|---|---|---|---|
| Cloudflare R2 (object storage) | **$0.015 per GB-month**, egress **free**, Class A ops $4.50/million, Class B $0.36/million; free tier 10 GB-month, 1M Class A, 10M Class B | Infrequent Access tier $0.01/GB-month + $0.01/GB retrieval | developers.cloudflare.com/r2/pricing |
| Backblaze B2 (object storage) | **$6.95 per TB-month** ($0.00695/GB), first 10 GB free, egress free up to 3× stored then $0.01/GB, A/B/C API calls free | cheapest per GB; egress capped | backblaze.com/cloud-storage/pricing |
| Amazon S3 | the page shows region tables behind a selector; the fetcher surfaced only S3 Tables rates ($0.0265/GB first 50 TB) — **read the S3 Standard row for us-east-1 on the page** | not needed if R2 or B2 is chosen | aws.amazon.com/s3/pricing |
| Supabase Pro (Postgres + auth + storage) | **$25/month**: 8 GB database then $0.125/GB, 100 GB file storage then $0.0213/GB, 250 GB egress then $0.09/GB, 100,000 monthly active users then $0.00325/MAU | Free plan: 500 MB database, 50,000 MAU | supabase.com/pricing |
| Neon (Postgres) | Launch plan pay-as-you-go: **$0.35 per GB-month** storage, **$0.106 per compute-hour**; Free: 0.5 GB and 100 compute-hours per project | no flat fee | neon.com/pricing |

**Pick for the loop:**
- **The archive** — every photograph and choice, and the vendor history the
  backtester reads — on Cloudflare R2. At the middle cadence above the
  journal adds 246 GB a year; at $0.015 that is $3.69 a month after a full
  year, and the backtester reads it for free (no egress). B2 is cheaper per
  gigabyte but charges egress past 3× what is stored, and a backtester
  re-reads its history many times over.
- **The database** — the last few weeks of choices, every verdict, every
  evaluation and weights revision, and what the app queries — Supabase Pro
  at $25/month. Its 8 GB holds about 3 weeks of the middle cadence's
  choices plus all verdicts; older choices roll to R2. (Supabase's Postgres
  also carries the accounts chapter later, one bill.) Neon is the
  alternative if we want a database with no flat fee; at 8 GB it would be
  $2.80/month storage plus compute hours.

**Notebook line, 1b:** R2 $0 to start (free tier), rising with the archive
at $0.015 per GB-month; Supabase Pro $25/month.

### 1c. Flagged for the market-data chapter, not paid yet

ThetaData's commercial tier, for the day the boards show vendor-derived
numbers to paying users (read 2026-09-17, thetadata.net/commercial-use,
billed annually): **Options $1,600/month, "startup rate as low as
$500/mo"; Stocks $1,200/month, startup as low as $500; Indices $400,
startup $250; up to 75% startup discount, contact sales.** No per-user or
exchange fees are stated on that page; whether OPRA's own fees apply per
subscriber is a question for their sales team and for the market-data
chapter. Massive's Stocks business plan reads $2,499/month with "No
Exchange Fees or Approvals"; its options business price is not shown.

### 1d. The loop's machine

**What it is.** One rented Linux server that never sleeps, running the loop
on a schedule: every five minutes in the session it asks ThetaData for the
chains (through ThetaData's own Theta Terminal program, which must run on a
machine we control, so a spin-up-and-die function is out), builds the
photographs, scores every candidate, writes the choices, and resolves open
choices into verdicts; once a night it rolls old choices to the archive and
runs the evaluation. The frontend does not live on it.

**How it is sized.** Time one whole-market scan on the dev machine once the
snapshot builder exists: seconds per scan × scans per day gives the cores;
the journal's write rate gives the memory. The three sizes below bracket
the three cadences in 1b — small for a 15-minute cadence, medium for the
5-minute cadence, large for 25 candidates a name. The box needs no big disk:
the archive is on R2, the database is Supabase.

**Prices read 2026-09-17 (USD per month):**

| Host | Small · 2 vCPU / 4 GB | Medium · 4 vCPU / 8 GB, dedicated | Large · 8 vCPU / 16 GB, dedicated | Source |
|---|---|---|---|---|
| DigitalOcean | Premium Intel $24 (2 vCPU, 4 GiB, 80 GiB SSD, 4 TB transfer) | CPU-Optimized $84 (4 vCPU, 8 GiB) · or General Purpose 4 vCPU / 16 GiB $126 | CPU-Optimized $168 (8 vCPU, 16 GiB) | digitalocean.com/pricing/droplets |
| Fly.io | shared-cpu-2x 4 GB $22.22 | performance-2x 4 GB $64.39 + extra RAM "about $5 per 30 days per GB" → 8 GB ≈ $84 | performance-4x 8 GB $128.77 + 8 GB RAM ≈ $169 | fly.io/docs/about/pricing (volumes $0.15/GB-month, egress $0.02/GB) |
| AWS Lightsail | $24 (4 GB, 2 vCPU, 80 GB SSD, 4 TB transfer) | $84 (16 GB, 4 vCPU, 320 GB SSD) | $164 (32 GB, 8 vCPU, 640 GB SSD) | aws.amazon.com/lightsail/pricing |
| Hetzner | **prices render only in the browser — read the Regular Performance and General Purpose tables at hetzner.com/cloud** (usually the cheapest of the four; EUR, VAT by country) | | | hetzner.com/cloud |
| Vultr | **page refused the fetch (403) — read vultr.com/pricing yourself** | | | vultr.com/pricing |

**Pick:** the medium box — 4 dedicated cores, 8 GB — at whichever of
DigitalOcean, Lightsail or Hetzner reads cheapest the day it is bought; all
three land at about $84/month for that shape, and Hetzner is expected under
it. Fly.io's shared small box is the right home for the loop DURING
backtesting development, when the scan runs by hand.

**Notebook line, 1d:** backtesting phase $22 to $24/month (a small shared
box); loop live at the 5-minute cadence about $84/month (a medium dedicated
box), read again on the day of purchase; sized for real after the first
timed scan.

**Compass total to write down:** backtesting phase $80 + Stocks Standard +
$25 + R2 (free tier at first) + a small box $22–24, per month. When the
loop runs live at the 5-minute cadence, the box becomes about $84. Launch
adds the commercial data licence above, which is the market-data chapter's
line, not Compass's.

---

## 2. Market data at launch — ThetaData's commercial rates and what sits on top

Read 2026-09-17 from thetadata.net/commercial-use. "For commercial
applications and business use cases only." Billed annually, monthly
billing also offered, "Bundle Discounts available", "Startups: Up to 75%
discount — Contact Sales", "Flat Files Only? Contact Sales".

| Product | List | Startup rate | Includes |
|---|---|---|---|
| Options | **$1,600/mo** | "as low as $500/mo" | every US option ticker; tick, 1-second, 1-minute and EOD; every NBBO quote reported by OPRA; the full real-time trade stream; unlimited API calls; 40 ms average latency; 14 years of history; Greeks 1st, 2nd and 3rd order |
| Stocks | **$1,200/mo** | "as low as $500/mo" | every US stock ticker; real-time Nasdaq Basic; 15-minute delayed CTA/UTP; tick to EOD; 14 years UTP, 9 years CTA; real-time streaming and snapshots |
| Indices | **$400/mo** | "as low as $250/mo" | Cboe Global Indices Feed, SPX, VIX, RUT, 1-second price reports, history from 2017-01-01, real-time streaming |
| Interest rates | **$200/mo** | "as low as $125/mo" | SOFR and Treasury datasets, history to 1970 |

Licence facts from the subscriber agreement (thetadata.net/subscriber-
agreement): the retail plan is one individual; data and derived works may
not be redistributed; no third party may be shown the data without written
consent. Business use is the commercial tier above, and ThetaData's own
guide says a firm using OPRA data commercially must "register your firm
with OPRA".

**ThetaData's actual quote to Noah (Mark Friend, mark.friend@thetadata.net,
8 July 2026, by email):** "the pricing is the same regardless if you choose
to go with the Market Value Options, Stocks, Indices bundle or standard
offering (unadjusted). Months 1 - 6: $1,250 per month. Months 7 - 12:
$2,000 per month." Read: the three-product bundle — options, stocks,
indices — at $1,250 for six months, then $2,000; the "Market Value"
(penny-adjusted bid/ask) and the unadjusted offering cost the same. $1,250
is exactly the page's three startup rates ($500 + $500 + $250).

**The Market Value bundle IS the answer to the exchange fees (ThetaData
sales to Noah, 2026-09-17):** they add a random digit in the cents place to
the bid, the ask and the live quotes, so what Slayer shows its users is a
derived value and not OPRA's own quote — the OPRA redistribution licence
and the per-user fees below fall away; ThetaData's own licence ($1,250 then
$2,000) is still required. FOUR THINGS TO HAVE IN THE CONTRACT, not an
email, before the exchange lines are struck from the totals: (1) the bundle
is licensed for display to subscribers with no OPRA or Nasdaq per-user,
distributor or non-display fees on Slayer's side; (2) the TRADE prints are
adjusted too, not only the quotes — the Live Tape shows trades, and a raw
last-sale is still OPRA's data; (3) what month 13 costs (list for the three
is $3,200); (4) the history includes delisted underlyings and expired
contracts as they were on the day, not reconstructed — a backtest on a
universe that only contains today's survivors is survivorship bias by
construction (the spec's point-in-time membership rule, §41).

**Going direct instead of ThetaData (Noah's question, 2026-09-17).** OPRA
sells the tape, not an API; a licensed feed handler delivers it raw. Read
2026-09-17 from databento.com/pricing and the OPRA.PILLAR catalog page:
Databento Standard **$199 per month** ("Live data", "No license fees" of
Databento's own), Plus "$1,750 license fees per month" (annual), Unlimited
"$4,500" (annual); and "In addition to pass-through license fees, live data
is billed for usage per message" — the per-message rate and the historical
per-GB rate appear only in their calculator after login; history from
2013-04-01; "A license is needed to access live data for this dataset per
exchange requirements", Databento as "vendor of record". So direct =
$199 + OPRA's own schedule below in full (redistribution $1,500,
non-display $2,000, $1.25 per user) + per-message usage + the stock tapes
on their own contracts + building the feed handler, the storage, the chain
assembly and the Greeks yourself. ThetaData's $1,250 with the fees inside
is the price of not doing that. Ruled out.

**The exchanges' fees sit on top of the vendor.** Two exchanges bill for
what the users see: OPRA for options, Nasdaq for the real-time stock feed.

OPRA, from ThetaData's OPRA fee guide (thetadata.net/articles/2026-05-29-
opra-fee-guide-for-options-market-data):

| Fee | Amount | Who pays |
|---|---|---|
| Non-professional subscriber | **$1.25 per user per month** | "Theta Data pays this fee on the user's behalf" |
| Professional subscriber | **$31.50 per user per month** | the firm, registered directly |
| Non-display (systems reading real-time data to compute, not to show — the loop's machine) | **$2,000 per month per category** | the firm, registered directly |
| Redistribution licence (a vendor showing OPRA data to its own users) | **$1,500 per month, or $650 per month for a query-only service** | the firm |
| Redistribution to non-professional users | $1.25 per user per month | the firm |
| Anything more than 15 minutes delayed | **no OPRA fees** "for using or redistributing" — vendor registration "may" still be required | — |

Nasdaq Basic (the real-time stock feed inside ThetaData's stock product),
from Nasdaq's US Equities Price List 2025–2027 (nasdaqtrader.com, the PDF;
2026 column):

| Fee | 2026 amount |
|---|---|
| Per subscriber per month, Nasdaq-listed names | Professional $14.10 · Non-professional $0.50 |
| Per subscriber per month, NYSE-listed names | Professional $7.20 · Non-professional $0.25 |
| Per subscriber per month, other regional names | Professional $7.20 · Non-professional $0.25 |
| So one user seeing every listing | non-professional **$1.00** · professional **$28.50** |
| External distributor fee (a firm showing the feed to outside users) | **$2,140 per firm per month** (internal use only: $1,680) |
| Usage-based alternative, per query | Nasdaq-listed $0.0025 · NYSE and regional $0.0015 |

Whether ThetaData's commercial licence carries the Nasdaq distributor fee
or Nasdaq bills us directly is not on either page — a sales question, the
same one as OPRA's non-display fee. The 15-minute delayed CTA/UTP feed's own
fee rules are not on ThetaData's pages; read the SIP price lists before
assuming delayed stock data is free the way delayed OPRA data is.

**The fork this creates.** Real-time to users is a fixed floor of vendor +
exchange licences before the first subscriber, plus a per-user toll; delayed
by 15 minutes removes every OPRA fee and most of the exchange floor.

| | Real-time to users | 15-minute delayed to users |
|---|---|---|
| ThetaData options + stocks | $1,000 (startup) to $2,800 (list) | the same licence (business use is business use) |
| OPRA redistribution | $650 to $1,500 | $0 |
| OPRA non-display, the loop's machine | $2,000 per category, if it consumes real-time | $0 if the loop reads delayed |
| Nasdaq external distributor | $2,140 | to read |
| Per non-professional user | $1.25 OPRA + $1.00 Nasdaq = **$2.25** | $0 OPRA |
| Per professional user | $31.50 + $28.50 = **$60.00** | $0 OPRA |

Which pages need real time: the Live Tape, Pulse's live chart and the
Weigher's chain sell the present tense. Which tolerate a delay: Compass's
boards run on five-minute scans of levels that move slowly, Pinpoint's
levels are built from open interest that is daily, the Record is dated
facts. A common launch shape is delayed data at the base price and real
time as the paid step, with the professional-status question asked at
sign-up because a professional costs $60 a month in exchange fees alone.

**Notebook line, chapter 2:** vendor $1,000 to $2,800 a month; exchange
floor $0 delayed, $4,790 to $5,640 real-time; per user $0 delayed, $2.25
real-time non-professional, $60 professional. Two questions for ThetaData
sales before any of it is signed: does the commercial licence carry the
Nasdaq distributor fee and OPRA's non-display fee, or do we register and
pay both directly.

---

## 3. Trace and the Record — Unusual Whales

Noah's ruling (2026-09-17): the eleven Trace pages and the five Record pages
are sourced through Unusual Whales. Our own rule stands: never their
derived Greek exposure — the walls and the flip are computed from ThetaData's
chains by our engine.

**Their plans, read 2026-09-17 (unusualwhales.com/public-api and
/enterprise):**

| Plan | Price | Requests | Lookback | Use permitted |
|---|---|---|---|---|
| Weekly Starter | $50/week | 30,000/day | 90 days | personal |
| API Basic | $125/mo ("$150 regular"), $1,500/yr | 80,000/day | 2 years | personal — "strictly for personal use. Redistribution is not allowed" |
| API Advanced | $315/mo ("$375 regular"), $3,780/yr | unlimited | 2 years | personal; adds CME futures with the live tape over WebSocket |
| **Startup** | **$750/mo, or $625/mo billed annually ($7,500/yr)** | 160,000/day | 2 years | "Personal or commercial use"; options flow, stocks, congressional and insider trades, market data, WebSocket, premium endpoints, email and Discord support |
| Startup + Kafka | $3,000/mo, or $2,500/mo annually ($30,000/yr) | as Startup | 2 years | adds a Kafka cluster (option trades, level-1 equities, CME futures, insiders) and a custom S3 pipeline |
| Professional & Enterprise | **custom pricing, contact sales** | custom | custom | "Redistribution licensing upon approval", a delayed-data option "at reduced pricing", compliance packaging |
| Historical option trades | $250/mo for the full market, 10% off past one year | — | — | a separate dataset |

**The licence line that matters.** Showing their data to our paying users
is redistribution. Their public-API page bans it outright on the personal
plans; the Startup plan permits commercial use; the redistribution licence
itself sits under Professional & Enterprise at a price only their sales
team gives. Their FAQ and terms pages render only in a browser — read
unusualwhales.com/faq and unusualwhales.com/terms for the exact clause
before signing. Exchange fees (OPRA for the options tape, Nasdaq for the
equities feed) are "not specified" on the enterprise page: the same
per-user real-time fees from chapter 2 apply to any vendor's real-time
feed, and who pays them is the second sales question.

**Our pages against their endpoints** (api.unusualwhales.com/docs):

| Our page | Their endpoint group |
|---|---|
| Trace · Live Tape | option-trade: Option Trades, Flow Alerts, Full Tape; lit-flow: real-time exchange trades |
| Trace · Dark Pool | darkpool: Recent Darkpool Trades, Ticker Darkpool Trades, Darkpool Price Levels |
| Trace · Screener | screener: Unusual Options Activity, Hottest Chains, Stock Screener |
| Trace · Net Flow | market: Market Tide, Top Net Impact; option-contract: Flow Data |
| Trace · Footprints | market: OI Change; stock: Option Chains; option-contract: Historic Data |
| Trace · Watchers | option-trade: Flow Alerts |
| Trace · Windows | option-contract: Intraday Data; Full Tape cut by time |
| Trace · 0DTE | Full Tape and Option Trades filtered to the session's expiry |
| Trace · Multi-Leg | option-trade: Multi-Leg Option Trades |
| Trace · Compare | the same groups, two names |
| Trace · Tracker | our own journal; option-contract: Historic Data for the marks |
| Record · News | news: News Headlines — one endpoint; whether it carries source, first-publication time and enough to place a story on our map is a schema question, read the endpoint's fields before assuming |
| Record · Earnings | earnings: Afterhours, Premarket, historical per ticker |
| Record · Insiders | insiders: Transactions, Sector Flow, Ticker Flow |
| Record · Congress | congress and politician_portfolios: recent reports, late reports, trades, holdings |
| Record · Stocks | stock: Stock Quote, OHLC; premium endpoints: extended fundamentals |

**How 160,000 requests a day is enough.** Our server fetches each feed
once per interval and fans it out to every user from its own cache; users'
browsers never call Unusual Whales. 160,000 a day over a 6.5-hour session
is about seven requests a second for the whole site, whatever the user
count. Per-user fetching would break that ceiling by the hundredth user.

**Notebook line, chapter 3:** Startup $750/mo ($625 annual) as the floor
for commercial use of the feeds inside the product, from the month Trace
goes live; the redistribution licence on top at a price from their sales
team; $250/mo more only if a Trace page needs the full historical tape.

---

## 4. Servers — where the site lives

Four parts: the static site the browser downloads, the box that serves
users what the loop and the feeds produce, the cache between them, and the
bandwidth. The loop's own box is chapter 1d.

**The static site.** Slayer's frontend is a built bundle of files (Vite);
a host serves them from its edge and never runs our code. Read 2026-09-17:

| Host | Price | What it says | Source |
|---|---|---|---|
| **Cloudflare Workers / Pages** | **$0** — "Requests to static assets are free and unlimited"; "There are no additional charges for data transfer (egress) or throughput (bandwidth)"; Workers Paid $5/mo only if we run code at the edge (10M requests and 30M CPU-ms included, +$0.30 per million requests) | developers.cloudflare.com/workers/platform/pricing |
| Vercel Pro | $20/mo per developer seat; 1 TB data transfer and 10M edge requests included, then "starting at $0.15 per GB" and "$2 per 1M"; Hobby is "for personal, non-commercial use" | vercel.com/pricing |
| Netlify Pro | "$20//month with unlimited members"; bandwidth allowances not stated on the page — read them in the plan's fine print before choosing | netlify.com/pricing |

Pick: Cloudflare. The site is static, its bandwidth is free there, and the
domain chapter lands on Cloudflare anyway.

**The box that serves users.** One always-on server that (a) fetches each
feed once per interval from ThetaData and Unusual Whales, (b) keeps the
latest of everything in a cache, (c) fans it out to browsers over
WebSockets, and (d) answers the app's queries against Supabase. At launch
this is the same medium box as the loop (chapter 1d, about $84/mo); when
serving and scanning fight for the same cores, it splits into two medium
boxes (+$84). The Theta Terminal runs on the loop's box either way.

**The cache.** Redis on the box itself costs nothing at launch. A managed
cache when the boxes split — Upstash, read 2026-09-17 (upstash.com/pricing/
redis): free tier 256 MB and 500K commands a month; pay-as-you-go $0.20 per
100K commands and $0.25 per GB; fixed 1 GB $20/mo with unlimited commands
and 100 GB bandwidth; fixed 5 GB $100/mo.

**Bandwidth, as arithmetic.** The static site's bandwidth is free on
Cloudflare. The box's outbound traffic is the live updates: a tape message
every 5 seconds to each open tape. At 5 KB a message that is 1 KB/s per
open tape, 6.5 hours a session, 21 sessions a month = about 0.5 GB per
always-open user per month; 1,000 such users = 500 GB, inside the medium
droplet's included 5 TB (DigitalOcean) or Lightsail's 5 TB. The per-message
size is the one number to measure on the real feed; the rest is
multiplication.

**Notebook line, chapter 4:** frontend $0 (Cloudflare); the serving box $0
extra at launch (it is the loop's box), +$84 when it splits; cache $0 on
the box, $20 managed later; bandwidth $0 at launch inside the box's
included transfer.

---

## 5. Accounts — sign-in, sessions, the emails around them

**Sign-in and sessions.** Who a user is, that they are signed in on this
browser, and which plan they hold. Read 2026-09-17:

| Service | Price | Users included | Then | Source |
|---|---|---|---|---|
| **Supabase Auth** (inside the Pro plan already in chapter 1) | $0 extra | 100,000 monthly active users | $0.00325 per MAU | supabase.com/pricing |
| Clerk | Free, or Pro $25/mo ($20 annual) | 50,000 monthly retained users per app ("a user only counts as retained if they return to your app at least 24 hours after signing up") | $0.02 per user per month | clerk.com/pricing |

Pick: Supabase Auth. The database is already there, the users table sits
beside the positions and watchlists it owns, and at 5,000 users it costs
nothing over the $25 already counted. Clerk buys a nicer sign-in UI for $25
plus $0.02 a user past 50,000, which Slayer does not need at launch.

**The emails.** Sign-up confirmation, magic links, password resets,
receipts. Alert emails, if the Alerts rule ever adds email to "hear it
everywhere", are their own line and their own volume. Read 2026-09-17:

| Sender | Price | Emails a month | Then | Source |
|---|---|---|---|---|
| **Resend** | Free $0 · Pro $20 · Pro $35 | 3,000 · 50,000 · 100,000 | $0.90 per 1,000 | resend.com/pricing |
| Postmark | Basic $15 · Pro $16.50 · Platform $18 | 10,000 each | $1.80 · $1.30 · $1.20 per 1,000 | postmarkapp.com/pricing |

Volume, as arithmetic: about 5 account emails per user per month
(sign-in links, a receipt, the odd reset). 1,000 users = 5,000 a month,
5,000 users = 25,000 — both inside Resend Pro's 50,000; the free 3,000
covers the first 600 users.

**Notebook line, chapter 5:** sign-in $0 (inside Supabase Pro); email $0 at
launch, $20/mo from about 600 users.

---

## 6. Payments — Stripe

Ruling (Noah, 2026-09-17): no refunds. Chargebacks are not a policy choice:
a cardholder disputes with their bank, Stripe charges the fee either way,
and it stays here as a cost of doing business.

Read 2026-09-17 from stripe.com/pricing (US):

| Fee | Amount |
|---|---|
| Domestic card | **2.9% + 30¢ per successful transaction** |
| International card | + 1.5% |
| Currency conversion | + 1% |
| Billing (subscriptions), pay-as-you-go | **0.7% of Billing volume** (or "Starting at $620.00 per month, 1-year contract") |
| Stripe Tax, Basic | **0.5% per transaction** (or Tax Complete "Starting at $90.00 per month, 1-year contract") |
| Dispute | **$15.00 for each dispute you receive**; "You get this fee back for won disputes. You don't get this fee back for lost disputes." |
| Payouts | rolling, weekly or monthly, no fee stated on this page |

**Per subscriber per month, as a formula** (P = the plan price the user
pays, domestic card, Stripe Billing and Tax Basic both on):

cost = 2.9% × P + $0.30 + 0.7% × P + 0.5% × P = **4.1% × P + $0.30**

| If the plan is | Stripe's cut per subscriber | Per 1,000 subscribers | Per 5,000 |
|---|---|---|---|
| $29 | $1.49 | $1,489 | $7,445 |
| $49 | $2.31 | $2,309 | $11,545 |
| $99 | $4.36 | $4,359 | $21,795 |

These are the exact fees at those prices, not estimates; swap in the real
plan price. Annual plans cut the 30¢ to once a year. A dispute costs $15
each; how many arrive is the one figure nobody can read off a page.

**Notebook line, chapter 6:** 4.1% of every subscription plus 30¢ per
charge, plus $15 per dispute; nothing fixed, nothing before the first sale.

---

## 7. The name — domain, DNS, mail on the domain, a status page

Read 2026-09-17.

| Piece | Price | Notes | Source |
|---|---|---|---|
| **A .com domain**, one year | **$10.26 wholesale today; $10.97 from 1 November 2026**, plus ICANN's per-registration fee shown at checkout | Verisign: "from $10.26 to $10.97 effective Nov. 1, 2026". Cloudflare Registrar sells at cost: "Cloudflare Registrar does not mark up domain prices at all"; renewals "at or below what registries and ICANN charge us"; WHOIS privacy free | verisign.com (Q1 2026 results release) · cloudflare.com/products/registrar |
| **DNS, CDN, SSL certificate** | $0 | "Every domain integrates with free DNS, CDN, SSL, and one-click DNSSEC" | cloudflare.com/products/registrar |
| **Mail on the domain** (hello@, support@) | Google Workspace Business Starter **$7.00 per user per month** (an introductory "$3.50" shown, annual commitment); Business Standard $14 ($7 intro) | "Secure custom business email you@your-company.com"; 30 GB pooled storage per person on Starter | workspace.google.com/pricing |
| **Status page** | Better Stack free: "10 monitors & heartbeats, 1 status page", 30-second checks; paid "50 monitors" for "$25 per month" with "1,000 subscribers included" and custom domains; Instatus free: 15 monitors, 200 subscribers, no custom domain; Instatus Pro $99/mo | the free Better Stack page carries the launch; its monitors also serve chapter 8 | betterstack.com/pricing · instatus.com/pricing |

Pick: the domain on Cloudflare at cost, DNS and SSL free there, two mail
seats on Google Workspace Starter (you and a shared support address), the
free Better Stack status page.

**Notebook line, chapter 7:** domain $10.26 a year now ($10.97 after
1 November) plus ICANN's fee; DNS and certificate $0; mail $14/mo for two
seats ($7 during the intro); status page $0.

---

## 8. Keeping it running — errors, logs, uptime, backups

Read 2026-09-17.

| Piece | Price | What it gives | Source |
|---|---|---|---|
| **Error tracking** — Sentry | Developer **$0** ("Limited to one user", "5k errors", "5M spans") · Team **$26/mo** (unlimited users, 50k errors) · Business $80/mo | every crash in the browser or on the box, with the stack and the user's path to it | sentry.io/pricing |
| **Logs** — Axiom | Personal **$0** ("500 GB/mo data loading", "25 GB storage", 30-day retention) · Axiom Cloud $25/mo platform fee + usage (1 TB/mo ingest) | what the box did, searchable; the free 500 GB a month is far past what one box writes | axiom.co/pricing |
| Logs — Better Stack (alternative) | ingest "$0.15 per GB" (US), retention "$0.08 per GB per month" (US) | pay per gigabyte, no free allowance stated for logs | betterstack.com/pricing |
| **Uptime alerts** — Better Stack | **$0** — "10 monitors & heartbeats, 1 status page", 30-second checks; 50 monitors $25/mo | pings the site, the API and the loop's heartbeat; pages you when one stops | betterstack.com/pricing |
| **Database backups** — Supabase Pro | **$0** — "Daily backups stored for 7 days" · Point-in-Time Recovery **"$100 per month per 7 days retention"** | daily is enough while the journal's archive also lives on R2; PITR only if a day of lost verdicts becomes intolerable | supabase.com/pricing |
| **The box's backups** — DigitalOcean | weekly **"20.0% of the Droplet's cost per month"** · daily "30.0%" | the loop's box rebuilt from an image; on the $84 box, $16.80/mo weekly, $25.20 daily | docs.digitalocean.com/products/backups |
| The archive — R2 | $0 extra | object storage is replicated by the provider; nothing to add | chapter 1b |

Pick: Sentry free — one seat is enough, Noah is the only engineer (the
partner's work is the math and the advertising, not the code); Team $26
only if a second engineer is ever hired;
Axiom free for logs; Better Stack free for uptime and the heartbeat of the
loop; Supabase's included daily backups; weekly backups of the box.

**Notebook line, chapter 8:** $16.80/mo at launch (the box's weekly
backup); $26 more when a second Sentry seat is needed; $100 more only if
point-in-time recovery is wanted.

---

## 9. Legal and the company — Delaware or Wyoming

Read 2026-09-17 from the states' own pages and the vendors' pages. Not
legal advice; the numbers are the states' filing fees.

**The company, one LLC:**

| | Delaware | Wyoming |
|---|---|---|
| Form it | the Certificate of Formation fee is in the Division's fee schedule PDF, which their site redirects into a dead link — **read it at corp.delaware.gov/fee** ("Corporate Fee Schedule") | **$100.00** Articles of Organization (sos.wyo.gov, businessfees.pdf); online card fee 2.4%, minimum $1 |
| Every year | **$300.00 annual tax**, "to be received no later than June 1st of each year" (corp.delaware.gov/howtoform) | **$60** annual report licence tax, "or two-tenths of one mill on the dollar ($.0002) whichever is greater" on assets in Wyoming; due the first day of the anniversary month; dissolution if 60 days late |
| Registered agent, required in both | "Delaware law requires that every business entity have and maintain a Registered Agent in the State of Delaware" | required |
| Registered agent price | Harbor Compliance **"$99/year"** new, "Renews at $159 annually", flat across states (Northwest's page refused the fetch — read northwestregisteredagent.com yourself; it is the other common pick) | same |
| **Year one** | formation fee + $300 + $99 | $100 + $60 + $99 = **$259** |
| **Every year after** | $300 + $159 = **$459** | $60 + $159 = **$219** |

Which: Wyoming is $240 a year cheaper and asks less every year. Delaware
is the default the day outside investors are involved, because their
lawyers know its courts. For a two-founder software company selling
subscriptions with no investors in sight, Wyoming; convert later if a
round ever needs Delaware. One thing the state choice does not remove:
the LLC must also register in the state where you actually work from
(a "foreign qualification", its own fee), and that state may want sales
tax collected on software subscriptions — Stripe Tax computes it (chapter
6), the registration is yours. Tell me the home state and I will read its
fee.

**The rest of the chapter:**

| Piece | Price | Source |
|---|---|---|
| EIN (the company's tax number) | $0, from the IRS directly | irs.gov |
| Business bank account — Mercury | **"$0/mo."**, "no minimum account balance requirements", ACH and domestic wires "free to send and receive"; Plus $29.90/mo, Pro $299/mo | mercury.com/pricing |
| Books — QuickBooks Online | Simple Start **"$38" per month** (intro "$19/mo" for 3 months); Essentials $85; Plus $140 | quickbooks.intuit.com/pricing |
| Terms of service, privacy policy, cookie banner — Termly | Free: 1 policy + cookie banner; Starter **$14/mo per website** ($10 annual); Pro+ $20/mo ($15 annual), "Unlimited legal policies" | termly.io/pricing |
| A lawyer's review of the terms, the no-refund line, and the two data agreements (ThetaData commercial, Unusual Whales enterprise) | quoted per engagement — **ask two firms for a flat fee**; no page prices it | — |
| The data subscriber agreements themselves | $0 to sign; their cost is the licences in chapters 2 and 3 | — |
| Insurance (technology errors and omissions, cyber) | quoted per application — Vouch, Embroker or a broker; no page prices it before an application | — |
| Accounting at tax time | a CPA's flat fee for the return, quoted per firm | — |

**Notebook line, chapter 9:** Wyoming: $259 in year one, $219 a year
after, plus the home-state registration to read; bank $0; books $38/mo;
terms $14/mo; the lawyer, insurance and the CPA are three quotes to
collect, not pages to read.

---

## 10. Launch — the X account and the ads

Noah's two lines (2026-09-17):

| Piece | Price | Source |
|---|---|---|
| **X Verified Organizations, Basic** | **$200 per month, or $2,000 per year**, "plus any applicable tax and fees"; ad credits and priority support included; affiliations only on the Full tier at $1,000/mo | help.x.com/en/using-x/premium-organizations (the help page refused a direct fetch; the price is X's own published figure, matched to Noah's) |
| **Ads** | **$2,000 per month** — Noah's budget, not a vendor price | — |

Not priced yet in this chapter, if wanted later: analytics (PostHog or
Plausible), a support inbox, an email list tool.

**Notebook line, chapter 10:** $2,200/mo from launch.

---

## 11. The buffer

Sized from the lines above, not from a percentage. Two parts: the
step-ups that can land in one month, and the reserve.

**The step-ups already priced** — every one of these is a line in a chapter
above, and any of them can arrive in the same month:

| Step-up | Amount | Where it is |
|---|---|---|
| The serving box splits from the loop's box | +$84 | chapter 4 |
| A managed cache with the split | +$20 | chapter 4 |
| The loop's box to the large size | +$84 | chapter 1d |
| A second engineer's Sentry seat (a future hire — the partner does not code) | +$26 | chapter 8 |
| Email past 600 users | +$20 | chapter 5 |
| Point-in-time recovery, if wanted | +$100 | chapter 8 |
| ThetaData's startup discount smaller than "as low as" — the gap to list | up to +$1,800 | chapter 2 |
| Exchange fees billed to us rather than carried by the vendor (real-time only) | up to +$4,140 | chapter 2 |
| Disputes | $15 each | chapter 6 |
| Annual bills landing in one month: Wyoming $219, the domain $11, the home-state registration | about $230 + the home state's fee | chapters 7 and 9 |

Delayed path, everything but the exchange fees landing at once: +$2,364 on
a $4,392 month = **$6,756**. Real-time path, everything landing: up to
+$6,504 on a $10,032 month = **$16,536**. (The "gap to list" step-up is
now the quote's own steps: +$750 at month 7, +$1,200 more at month 13 if
it goes to list.)

**The reserve.** Hold three months of the fixed floor in the business
account before launch day, so a bad quarter never touches the product:

| Path | Fixed floor | Three-month reserve |
|---|---|---|
| Delayed, quote months 1–6 | $4,392 | **$13,176** |
| Delayed, quote months 7–12 | $5,142 | $15,426 |
| Real-time through the Market Value bundle, months 1–6 (the exchange lines struck, once the contract says so) | $4,392 | **$13,176** |
| Real-time through the Market Value bundle, months 7–12 | $5,142 | $15,426 |
| Real-time unadjusted, months 1–6 — the fallback | $10,032 (the higher end) | $30,096 |
| Real-time unadjusted, months 7–12 | $10,782 | $32,346 |

**The one-time pile, before launch day:** Wyoming year one $259, the domain
$11, the home-state registration (to read), and the three quotes — the
lawyer's pass over the terms and the two data agreements, the insurance
application, the CPA — which are the only numbers in this document nobody
can read off a page.

**Notebook line, chapter 11:** hold $13,176 for the delayed launch (three
months), or $30,096 for real-time; expect one month a year to run about
$2,400 over the floor on the delayed path.

---

## 12. The tape — what to pull from ThetaData, and where it lives

Written 2026-09-17, after the engine's tape reader and photograph builder
landed (`engine/slayer_core/tape.py`, `theta.py`, `snapshot.py`). No new
monthly line: the running total above does not move. What this chapter fixes
is the shape of the pull, so the backtest and the live loop read one tape.

**The API, read 2026-09-17 from docs.thetadata.us (Theta Terminal v3 — the
only terminal ThetaData now documents; v2 stays only for streaming, per their
2025-07-21 post).** The terminal is a jar (`java -jar ThetaTerminalv3.jar`,
Java 21 or higher, an email and a password on two lines of `creds.txt`) that
answers at `http://127.0.0.1:25503`, CSV by default, named columns, no paging.

| Endpoint | What it answers | Parameters that matter |
|---|---|---|
| `/v3/option/history/quote` | every contract's NBBO at each interval: "the quote for each interval represents the last quote at the interval's timestamp" | `symbol`, `expiration=*` (all), `date`, `interval` (`1m`, `5m` …), `max_dte`, `strike_range` (n strikes above and below spot plus the ATM); a multi-day request must name one expiration and spans at most a month — so a whole chain is **one request per name per day** |
| `/v3/option/history/open_interest` | one row per contract, "the open interest at the end of the previous trading day", reported "once per day by OPRA at approximately 06:30 ET" | the same, without `interval` |
| `/v3/stock/history/ohlc` | the underlying's bars: open, high, low, close, volume, count, vwap | `symbol`, `date`, `interval` (`1m`), `venue` (`nqb` default) |
| `/v3/option/history/trade` | every print: price, size, exchange, condition, sequence | the same as quotes; Standard and Pro only |
| `/v3/option/snapshot/quote` · `/v3/stock/snapshot/quote` | the live poller's calls: the same columns, now | `symbol`, `expiration=*` |
| `/v3/option/list/expirations` (and `list/strikes`, `list/dates`, `list/symbols`, `list/contracts`) | the universe's shape on a day | `symbol` |

Column facts the tape rests on: strikes in dollars (`220.000`), expirations
`YYYY-MM-DD`, rights `call`/`put`, timestamps `YYYY-MM-DDTHH:mm:ss.SSS`. Errors
are text with their own codes (472 no data, 473 bad parameters, 474
disconnected, 570 request too large, 571 server starting).

**Two facts to verify with one request each, before the first real pull,
because no page states them:** (1) the zone of `timestamp` — the tape takes it
as New York time and stores UTC; confirm a 1-minute quote requested for
09:30:00 comes back stamped 09:30; (2) the migration guide says history
endpoints "return one day of data", the endpoint pages show `start_date` and
`end_date` with a one-month cap — the pull is written one day per request
either way, so only the reading of the guide needs settling.

**The plans (docs.thetadata.us, Subscriptions and Concurrent Requests, read
2026-09-17).** Noah chose Pro for both.

| | Options | Stocks |
|---|---|---|
| VALUE | 1-minute, history from 2020-01-01, 2 concurrent; quotes and open interest | 1-minute from 2021-01-01, 2 concurrent, 15-minute delayed |
| STANDARD | tick, from 2016-01-01, 4 concurrent; adds OHLC and implied vol | 1-minute from 2016-01-01, 4 concurrent, real time; adds quotes |
| PRO | tick, from **2012-06-01**, **8 concurrent**; adds Greeks and trades | tick from **2012-06-01**, **8 concurrent**, real time; adds trades |

The concurrency limit is "account-wide and set by your highest subscription
tier across asset classes"; requests past it queue (16 by default, up to 128),
then 429. Their advice: "leverage a semaphore". The pull runs eight at a time.

**What the tape holds.** One directory per name per session day, three
Parquet files, written once and never rewritten; a bad pull is a new version:

```
tape/<version>/manifest.json                            the pull's parameters, once
tape/<version>/<SYMBOL>/<YYYY>/<YYYY-MM-DD>/quotes.parquet          NBBO per contract per interval: timestamp, expiration, strike, right, bid, ask, bid_size, ask_size
tape/<version>/<SYMBOL>/<YYYY>/<YYYY-MM-DD>/open_interest.parquet   per contract, as of the prior close
tape/<version>/<SYMBOL>/<YYYY>/<YYYY-MM-DD>/underlying.parquet      1-minute bars: open, high, low, close, volume, count, vwap
tape/<version>/<SYMBOL>/derived/daily.parquet           one row per session: the builder's base IV and the close (append-only; the IV rank's history)
```

Exchange and condition codes are not kept (the engine does not read them; a
quote-age or condition filter later is a new tape version with the columns
added). The `tape/` bucket's key on the loop's box is read-only after the
pull; `runs/<engineVersion>/` is the other bucket (chapter 1b). One writer,
in Python (`slayer_core.theta.pull_day` → `tape.write_day`): the historical
pull and the live poller are the same code, the poller reading
`snapshot/quote` every five minutes and appending one interval; Node serves
users and never writes the tape. (Proposed here as the ruling; the team-roles
note left the poller's language open.)

**The parameters of version 1**, from the engine's own reach: interval
**5m** (the scan's cadence: 390 session minutes ÷ 5 = **78 frames a day**);
`max_dte` **95** (the ledger's calendar reaches 91 days); `strike_range`
**40** (the ladder's whole book is 30 a side); bars **1m**. All four kinds
read the same frame:

| Kind | From the frame | Not on version 1 |
|---|---|---|
| Quick scalp | bid, ask, sizes (quote stability, displayed depth, expected slippage), the book, 1-minute bars (intraday RV, time left) | its horizons run 5 to 120 minutes: a 5-minute tape floors the shortest; a 1-minute tape is the same pull with `interval=1m` at five times the rows — the partner's call |
| Discounted | the chain's implied vols and open interest (the surface), bars | — |
| Rebound | 1-minute bars with **vwap** (the ruling's VWAP deviation) and ATR, the book (dealer support) | — |
| Big orders | — | `option/history/trade` (Pro): a `trades.parquet` per day in version 2, with the sweep and cluster reads of the Trace math |

**The universe and the range.** 36 names in `src/data/universe.ts` plus SPY
and QQQ from the watchlist (neither is in the universe file): **38 names**,
re-counted from the file on the pull day. Two years back from 2026-09-16 is
**501 sessions** by the engine's calendar (one year 251; back to 2016-01-04,
Standard's floor, 2,691). Pro reaches 2012-06-01, but the calendar module's
holiday table starts at 2016 — a pull before it adds 2012–2015's holidays
first (v3's Market Calendar endpoints, named in the migration guide, are a
source to check the table against). Start with the two years; extend by a
year at a time if the loop's pools stay under the partner's 200 matured
outcomes (ruling 7) — the count is arithmetic, the range is his call.

**The requests:** 3 per name per day (quotes, open interest, bars) → 3 × 38 ×
501 = **57,114**, plus one `list/expirations` per name. Wall time = 57,114 ÷
8 concurrent × the seconds one request takes — **measure the first hundred**
and write the number here; no page states a rate.

**The size:** rows in a day's quotes file = E × 81 × 2 × 78, where E is the
expirations inside 95 days (read from `option/list/expirations` on the pull
day; 81 = 2 × 40 + 1 strikes; 2 rights; 78 frames). Bytes per row after
Parquet's zstd — **measure on the first day pulled**; then GB = rows × bytes
÷ 10⁹ × 501 × 38.

**What it costs (Cloudflare R2, chapter 1b's rates):** storage $0.015 per
GB-month after the 10 GB-month free tier; writing the two years is 57,114
Class A operations = 0.057 million × $4.50 = **$0.26 once**; each full replay
reads 57,114 files = 0.057 million Class B × $0.36 = **$0.02 a pass**; egress
free. The only number missing is the GB, which the first day's measurement
fills.

**Before the first pull, in order:** (1) the Pro subscriptions on; the
terminal running with `creds.txt`; (2) the two verifications above; (3)
`list/expirations` and `list/strikes` for SPY on the day → E, and the size
formula filled; (4) one day for one name (`pull_day`), the bytes and the
seconds written here; (5) the manifest, then the two years, eight at a time.

**Notebook line, chapter 12:** no new monthly money — R2 storage by the
formula (fill the GB after day one), $0.26 to write the two years, $0.02 per
replay pass; one-time: the pull's hours, measured on the first hundred
requests.

---

## 13. The vendor decision — Massive for stocks, options, indices and futures (2026-09-20)

Noah's decision, 2026-09-20. Massive is the company formerly Polygon.io. What follows was read off
**massive.com/business** that day, tab by tab, monthly billing (the page says the annual plan saves 20%).

| Plan | Price | What the card says |
| --- | --- | --- |
| Stocks Business | $2,499/month | US coverage, 20+ years of trades and quotes, real-time Fair Market Value, minute aggregates, flat files, "No Exchange Fees or Approvals", business use |
| Options Business | $1,999/month | all US options tickers, 10+ years of trades, **2.5 years of historical quotes**, real-time Fair Market Value, real-time Greeks and IV, daily open interest, flat files, "No Exchange Fees or Approvals", business use |
| Indices Business | $2,500/month | "Tickers Licensed by Feed", 1+ year of history, real-time, "Exchange Assistance", business use |
| Futures CME | $999/month | equity-index futures (ES · MES · NQ · MNQ): 7+ years, minute and second aggregates, trades, top-of-book quotes, "Exchange Assistance", business use |
| Futures NYMEX | $999/month | energy (CL): the same card |
| Futures COMEX | $999/month | metals (GC · SI): the same card |
| Futures CBOT | $999/month | agricultural — not needed for the seven products Review trades |
| Enterprise (each asset) | Custom | exchange feeds, SLAs, a Slack channel |

**Startup pricing, the same page:** "Qualifying startups can get 25% or more off their first year, with the largest
reductions going to pre-launch companies" — by email to sales@massive.com with the company, the use and the data needed.

**The arithmetic, at list:** stocks $2,499 + options $1,999 + indices $2,500 + three futures feeds $2,997 =
**$9,995 a month**; about $7,996 billed annually (−20%); about $7,496 monthly with the 25% startup cut in year one
(whether the two stack is a question for sales). The plan this replaces was ThetaData's quote of 8 July: **$1,250 a
month for months 1–6, $2,000 for 7–12**, for stocks + options + indices — so the market-data line goes from $1,250 to
roughly **five to eight times** that before any discount, and chapter 11's reserve (three months of the fixed floor) grows
with it. Futures were never in ThetaData's bundle; they are $2,997 of the difference, and Review's futures desk needs
them from someone. None of the totals above are recomputed until sales has answered — a list price is not the price.

**What it changes in what is built:**

- **The options backtest replays QUOTES** (a fill is the bid or the ask as it stood). Options Business holds **2.5 years**
  of them; ThetaData's quote was 14. Chapter 12's first pull was two years of sessions, so launch fits — with half a year
  to spare and no deeper history to grow into. Ask sales whether Enterprise carries more.
- **Historical greeks are not sold** (the card says "Real-time Greeks and IV"). Nothing is lost: decay is inside the price,
  and the engine computes its own IV from the quotes (`snapshot.py`).
- **"Fair Market Value" is Massive's derived price**, the counterpart of ThetaData's "Market Value" bundle, and the reason
  the stocks and options cards say "No Exchange Fees or Approvals". The contract lines to get in writing are the same
  four as before, asked of a new vendor: may derived values be shown to paying subscribers; may HISTORICAL quotes be shown
  in a replay; is there a per-subscriber fee; and the same for the futures and index feeds, whose cards say "Exchange
  Assistance" and "Licensed by Feed" — CME's and the index owners' own licences sit on top of the vendor's fee.
- **Chapter 12's pull plan is written against ThetaData's v3 endpoints.** The tape's layout, the sizes and the R2
  arithmetic hold; the requests do not. The engine's vendor seam is one file (`engine/slayer_core/theta.py`) — it is the
  only file that changes, and it stays as it is until Noah un-pins the engine.
- **Review's two seams** (`data/review/tape.ts` + `quotes.ts`, `futuresTape.ts`) are unchanged: they were written to be
  replaced by a tape, whoever sells it.

_Source read 2026-09-20: https://massive.com/business (Stocks · Options · Indices · Futures tabs, monthly billing)._

---

_Sources read 2026-09-17: https://docs.thetadata.us/operations/option_history_quote.html ·
https://docs.thetadata.us/operations/option_history_open_interest.html ·
https://docs.thetadata.us/operations/option_history_trade.html ·
https://docs.thetadata.us/operations/option_snapshot_quote.html ·
https://docs.thetadata.us/operations/stock_history_ohlc.html ·
https://docs.thetadata.us/operations/stock_history_quote.html ·
https://docs.thetadata.us/operations/stock_snapshot_quote.html ·
https://docs.thetadata.us/operations/option_list_expirations.html ·
https://docs.thetadata.us/Articles/Getting-Started/Subscriptions.html ·
https://docs.thetadata.us/Articles/Data-And-Requests/Concurrent-Requests.html ·
https://docs.thetadata.us/Articles/Data-And-Requests/Making-Requests.html ·
https://docs.thetadata.us/Articles/Getting-Started/Getting-Started.html ·
https://docs.thetadata.us/Articles/Getting-Started/v2-migration-guide.html ·
https://www.thetadata.net/blog/2025-07-21-rest-api-v3-beta_

_Sources read 2026-09-17: https://help.x.com/en/using-x/premium-organizations ·
https://corp.delaware.gov/howtoform/ ·
https://corp.delaware.gov/fee/ · https://sos.wyo.gov/business/docs/businessfees.pdf ·
https://www.harborcompliance.com/registered-agent-service · https://mercury.com/pricing ·
https://quickbooks.intuit.com/pricing/ · https://termly.io/pricing/ ·
https://sentry.io/pricing/ · https://axiom.co/pricing ·
https://docs.digitalocean.com/products/backups/details/pricing/ ·
https://investor.verisign.com/news-releases/news-release-details/verisign-reports-first-quarter-2026-results ·
https://www.cloudflare.com/products/registrar/ · https://workspace.google.com/pricing ·
https://betterstack.com/pricing · https://instatus.com/pricing ·
https://stripe.com/pricing · https://clerk.com/pricing · https://resend.com/pricing ·
https://postmarkapp.com/pricing ·
https://developers.cloudflare.com/workers/platform/pricing/ ·
https://vercel.com/pricing · https://www.netlify.com/pricing/ ·
https://upstash.com/pricing/redis · https://unusualwhales.com/public-api ·
https://unusualwhales.com/enterprise · https://api.unusualwhales.com/docs ·
https://www.thetadata.net/subscriber-agreement ·
https://www.thetadata.net/articles/2026-05-29-opra-fee-guide-for-options-market-data ·
https://www.nasdaqtrader.com/content/ProductsServices/PriceList/Nasdaq_US_Equities_Price_List_2025_2026_2027.pdf ·
https://http-docs.thetadata.us/Articles/Data-And-Requests/The-SIPs.html ·
https://www.thetadata.net/pricing ·
https://www.thetadata.net/commercial-use ·
https://docs.thetadata.us/Articles/Getting-Started/Subscriptions.html ·
https://massive.com/options · https://massive.com/pricing ·
https://massive.com/business · https://databento.com/pricing ·
https://developers.cloudflare.com/r2/pricing/ ·
https://www.backblaze.com/cloud-storage/pricing · https://neon.com/pricing ·
https://supabase.com/pricing · https://aws.amazon.com/s3/pricing/_
