# The clock and carry behind UW's vols (measured 2026-10-13)

**The question** (the second review of the exposure research, problem 2). An implied vol is meaningful only with the
time to expiry τ it was inverted under, because a price pins only the total variance σ²τ. Terrain's field prices UW's
vols. So which τ, and which rate and dividend, did UW solve them with? The research had said "consistent with calendar
time" on an after-hours check. That was a mixed result, not a test that tells the conventions apart.

**The answer, measured.** UW's vols, and the greeks it prints beside them, are European Black–Scholes:

- **rate 4.15%, no dividend**, the same figures for every name tested;
- **a contract expiring today: calendar time** from the print to its 16:00 New York close;
- **a contract expiring on a later day: whole calendar days**, its date less today's, over 365. This τ is the same at
  09:30 as at 15:59: it does not run down through the session.

The field now prices every contract on that clock and carry (`src/data/feed/trailField.ts`, `UW_VOL_CONVENTION`,
`uwYears`; model `trail-2026-10-13.3`). Black–Scholes gamma at UW's vol then reproduces UW's own gamma to a median
0.001–0.03% through 60 days. Before the change, the old pricer was off by:

- 1.5–4.3% on next-day contracts (8% at the open);
- 0.9–2.1% for 2–4 days;
- 0.6–1.8% beyond that.

## How it was measured

**Data.** UW `/option-trades` for Monday 2026-10-12 (the latest trading day, walked back with `older_than`):

- SPY: 500 prints at each of five moments of the session (09:59, 11:29, 12:59, 14:29 and 15:44 New York);
- QQQ, IWM, AAPL, NVDA and TSLA: 500 prints at each of three moments.

Kept: in-session prints with a price of $0.05 or more, a vol between 3% and 300%, positive gamma and at least $0.02 of
time value. That leaves 8,096 prints within 60 days across the six names.

**Why it discriminates.** UW's `theo` equals the print's price on 484 of 500 SPY prints, to 1e-13, so UW solved each
vol from the price. Re-inverting the vol from the same price under a candidate clock and carry gives UW's vol back only
under UW's own convention. UW's gamma is a second, independent check: it does not depend on price ticks.

The scripts are in `tau/` (README there).

### Per expiry, SPY, three clocks side by side (r 4.15%, q 0)

The table gives the median (p90) of |IV re-inverted − UW's IV| in vol points, and the median of
|BS gamma at UW's IV ÷ UW's gamma − 1|.

| Expiry | n | Calendar IV | Trading IV | UW clock IV | Calendar γ | Trading γ | UW clock γ |
|---|---|---|---|---|---|---|---|
| Oct 12 (today) | 1,337 | 0.001 (0.00) | 5.50 (8.04) | 0.001 (0.00) | 0.00% | 53.3% | 0.00% |
| Oct 13 | 413 | 0.533 (1.34) | 2.89 (5.05) | 0.001 (0.00) | 2.65% | 18.4% | 0.01% |
| Oct 14 | 89 | 0.476 (2.88) | 2.84 (4.52) | 0.002 (0.01) | 2.97% | 22.1% | 0.01% |
| Oct 15 | 38 | 0.253 (2.01) | 2.83 (30.3) | 0.002 (0.02) | 1.69% | 20.7% | 0.00% |
| Oct 16 | 95 | 0.202 (0.38) | 2.51 (3.27) | 0.002 (0.00) | 1.12% | 18.8% | 0.01% |
| Oct 19 | 22 | 0.099 (0.25) | 0.66 (1.54) | 0.003 (0.02) | 0.32% | 4.06% | 0.03% |
| Oct 23 | 33 | 0.087 (0.11) | 1.15 (1.47) | 0.002 (0.00) | 0.29% | 7.60% | 0.03% |
| Oct 30 | 43 | 0.044 (0.16) | 0.92 (2.54) | 0.003 (0.00) | 0.18% | 4.05% | 0.03% |
| Nov 6 | 10 | 0.021 (0.05) | 1.00 (2.76) | 0.003 (0.01) | 0.12% | 6.25% | 0.03% |
| Nov 20 | 63 | 0.037 (0.04) | 0.66 (0.72) | 0.006 (0.01) | 0.16% | 3.90% | 0.02% |

The full table, every expiry to 2029, is in `tau/conv3.py`'s output with `GROUP=expiry`. Beyond the field's 60 days the
UW clock's error grows to 0.03–0.15 vol points by 2027 (a term rate, perhaps; it is not measured). The 2029 LEAP is one
print, and it does not fit.

- **Trading time** (session minutes ÷ 252 sessions of 390) is wrong everywhere: 5.5 vol points on today's contracts and
  53% in gamma.
- **Calendar time to the close** is right for today's contracts and wrong for every later one.
- The p90 calendar errors on Oct 14 and 15 (2.9 and 2.0 vol points) are the opening prints, where the calendar clock
  and UW's differ most.

### The day-after contract's τ does not move through the session

The τ UW's vol implies (solved from the price at UW's vol, r 4.15%, q 0), in hours, against the calendar hours to the
close:

| Expiry | 09:59 | 11:29 | 12:59 | 14:29 | 15:44 |
|---|---|---|---|---|---|
| Oct 12 (today), calendar | 6.00 | 4.50 | 3.00 | 1.50 | 0.25 |
| Oct 12, UW | 6.00 | 4.50 | 3.00 | 1.50 | 0.25 |
| Oct 13, calendar | 30.00 | 28.50 | 27.00 | 25.50 | 24.25 |
| Oct 13, UW | 24.00 | 24.00 | 24.00 | 24.00 | 24.00 |
| Oct 14, UW | 47.99 | 47.98 | 48.02 | 47.99 | 48.00 |
| Oct 15, UW | 71.99 | 71.98 | 72.01 | 72.02 | 71.97 |
| Oct 16, UW | 96.01 | 96.01 | 95.97 | 96.00 | 95.97 |

Whole days, held all session. Today's contract alone runs down on the clock.

### The carry: one rate, no dividend, every name

The carry was fitted on gamma for 5–60 days, with q held at 0 and r on a 0.05% grid. All six names give
**r = 4.15%**. With q free, the fit gives q of 0–0.4% at r − q of 4.1–4.2%: the dividend is not separately
identifiable, and 0 fits.

Median |γ error|, by days to expiry. "Old build" is calendar time with the house's carry (r 4.2%, q 1.2%); "now" is
UW's clock and carry.

| Name | n | Today: old / now | 1 day | 2–4 days | 5–11 days | 12–60 days |
|---|---|---|---|---|---|---|
| SPY | 2,226 | 0.08% / 0.003% | 2.46% / 0.005% | 1.90% / 0.006% | 1.40% / 0.021% | 1.85% / 0.032% |
| QQQ | 1,372 | 0.05% / 0.002% | 4.27% / 0.002% | 1.37% / 0.004% | 0.89% / 0.014% | 0.59% / 0.012% |
| IWM | 1,164 | 0.06% / 0.002% | 1.55% / 0.003% | 1.33% / 0.005% | 0.83% / 0.013% | 0.78% / 0.016% |
| AAPL | 1,163 | 0.04% / 0.002% | — | 0.88% / 0.004% | 0.86% / 0.010% | 0.82% / 0.016% |
| NVDA | 943 | 0.07% / 0.001% | — | 1.18% / 0.004% | 0.56% / 0.011% | 0.76% / 0.012% |
| TSLA | 1,228 | 0.03% / 0.002% | — | 0.92% / 0.002% | 0.42% / 0.004% | 0.59% / 0.009% |

AAPL, NVDA and TSLA list no Tuesday expiry, so they have no 1-day contracts on a Monday.

## The chain's vol and its time stamp

The field's vols come from the chain reads (`/option-contracts`, `implied_volatility`, which UW's spec calls "Last
Transaction IV"). Checked on 16 SPY contracts against `/option-contract/{id}/flow`, the chain's vol equals the
contract's last print's vol exactly, 16 of 16. So the chain's vol carries the same convention, solved at that print's
moment.

Its time stamp does not. `last_tape_time`, the spec's "Last Transaction Time", read 17:10–17:42 New York on all 16
contracts after the close. The prints themselves were at 10:40–16:14, and a regular session holds no print after 16:15.
So after the close the stamp is a later batch time, not the print's.

The field now keeps such a stamp as a bound: the print was at or before 16:15 on that date (`tradeTimeOf`). The bead
card says "oldest vol from a print at or before 16:15 Fri", never a time the print could not have had.

**In session the stamp is the print's own, to UW's two-second tape tick** (checked 2026-10-13 at 12:12 New York): on
twelve SPY contracts that had printed 112–119 times that day, `last_tape_time` stood 0.4–2.0 s AFTER the contract's
newest print in `/option-contract/{id}/flow`, always on an even second (15:33:38Z for a print at 15:33:36.23Z,
16:05:00Z for 16:04:59.59Z) — the tape tick that processed the print; on six contracts printing every second, the
stamp's second held a print of theirs on the tape in five, the sixth one second after its last. So a vol's time in
session is its print's within two seconds, and the field uses the stamp as that time (`tradeTimeOf`); only a stamp
after the close is a batch time, kept as the bound above.

## American exercise (review problem 4)

SPY's options are American; UW's vols and the field's pricer are European. The gap was measured on 48 near-the-money
SPY prints (|ln S/K| ≤ 2%, 1–60 days). Each print's vol was inverted twice from the same price on the same CRR tree:
American, then European (300/301 steps averaged, r 4.15%, no dividend: SPY's next ex-date falls after 60 days). The two
gammas were then compared, each at its own vol.

| | n | Median \|γ American ÷ γ European − 1\| | Max | Median vol gap |
|---|---|---|---|---|
| Calls, 1–11 days | 12 | 0.00% | 0.00% | 0.000 pts |
| Calls, 12–60 days | 12 | 0.00% | 0.00% | 0.000 pts |
| Puts, 1–11 days | 12 | 0.59% | 3.61% | −0.014 pts |
| Puts, 12–60 days | 12 | 5.42% | 7.64% | −0.190 pts |

With no dividend before expiry, a call is never exercised early, so the two are the same. A put's American gamma is
higher, by about 5% at 2–8 weeks. On SPY's book of 2026-10-12, with the share of each near-money strike's gamma that
sits in puts of each age, the gap moves a strike's gamma by an estimated **0.1–1.3%** (largest at strikes below the
price, where the 2–8-week puts gather). This is an estimate from 48 contracts' gaps applied to one day's book, not a
repricing of the book.

The field stays European, as UW's own vols and gammas are. The gap is a known bias, stated here. Pricing American would
mean re-inverting every vol under an American model each minute.

For single names, an ex-dividend date inside 60 days makes a call's early exercise possible, which this test does not
cover (AAPL goes ex around early November). That is **not measured**.

## The live check, Tuesday 2026-10-13, in session (pulled 10:00–12:11 New York)

The same measurement on a second day, inside the session: SPY at five moments (`older_than` 14:00, 14:45, 15:30,
16:05 and 16:11 UTC; 500 prints each) and QQQ at three. UW's clock and carry hold, per expiry and per hour:

| SPY expiry | n | Calendar IV | UW clock IV | Calendar γ | UW clock γ |
|---|---|---|---|---|---|
| Oct 13 (today) | 1,733 | 0.001 (0.00) | 0.001 (0.00) | 0.00% | 0.00% |
| Oct 14 | 355 | 1.090 (1.38) | 0.001 (0.00) | 6.97% | 0.00% |
| Oct 15 | 53 | 0.598 (0.74) | 0.002 (0.00) | 3.93% | 0.00% |
| Oct 16 | 67 | 0.373 (0.56) | 0.002 (0.01) | 2.90% | 0.00% |
| Oct 19 | 33 | 0.162 (0.38) | 0.003 (0.02) | 1.42% | 0.01% |
| Oct 23 | 24 | 0.129 (0.19) | 0.002 (0.00) | 0.96% | 0.02% |
| Oct 30 | 18 | 0.080 (0.12) | 0.004 (0.01) | 0.49% | 0.02% |
| Nov 13 | 16 | 0.041 (0.08) | 0.005 (0.01) | 0.27% | 0.03% |
| Nov 20 | 13 | 0.044 (0.09) | 0.006 (0.02) | 0.18% | 0.03% |

QQQ the same (1,150 today's prints at 0.001; Oct 14 at 0.001 against calendar's 1.790 and 7.10% in gamma; Nov 20 at
0.004). Calendar time misses the next-day contract by MORE in session than it did after hours (1.09 vol points and
7.0% in gamma at midday against 0.53 and 2.65% on Oct 12's prints), as it must: the gap between calendar time to the
close and UW's whole day is widest in the morning. The implied τ of the Oct 14 contract is 24.00 hours at 13Z, 14Z,
15Z and 16Z while calendar time runs 30.00 → 27.92; Oct 15 is 48.0, Oct 16 72.0 at every hour. Trading time is wrong
by 5.9 vol points on today's contracts and 53% in gamma. Nothing differs from the first day's finding.

**The field against UW's books, 12:13 New York** (model `trail-2026-10-13.4`, the count as received): against the
every-expiry per-strike book the newest column differs by 12.0% of the book's size over the 60 strikes both hold,
the same sign on 60 of 60 — a different universe, as expected larger; against the 60-day books (the like-for-like
reference, fifteen read today) the per-strike gap is 7.1% at the median (4.7–11.4), the summed net has the same sign in
11 of 15, and the model's net stands below UW's by $1.2–1.9B across the 60 strikes all morning (model −4.05B against
UW's −1.86B at 10:40; −1.36B against +0.35B at 11:58, the model crossing zero later than UW's book). That is a
residual of the model stated in How sure, not calibrated away; the per-strike figure is the robust one.

## What is still open

- **The summed net's bias:** the model's 60-strike net sits $1–2B below UW's 60-day book's through the morning while
  the per-strike gap is 5–11%; which strikes carry it, and whether it is the American put gap (above) or the vols
  carried from the session before on untraded contracts, is not measured.
- **A half day** (13:00 close): today's τ is taken to the 13:00 close, unverified against UW.
- **UW's rate is a constant here.** It is re-measured by the scripts in `tau/` and changed in `UW_VOL_CONVENTION` with a
  new model version if UW moves it.
