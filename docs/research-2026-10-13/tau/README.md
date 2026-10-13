# UW's vol convention — the measurement scripts (2026-10-13)

What they measure and what they found: `../uw-vol-convention.md`. No vendor data is kept here; pull it through the
local proxy (the key stays on the server), in a folder of its own, then run the scripts with that folder's files as
arguments (`python3 -I`).

```sh
# five moments of Monday 2026-10-12's session for SPY, three for each other name, 500 prints each
for t in 14:00 15:30 17:00 18:30 19:45; do
  curl -s "http://localhost:5173/feed/uw/api/option-trades?ticker_symbol=SPY&limit=500&older_than=2026-10-12T${t}:00Z" -o sess_${t/:/}.json
done
for s in QQQ IWM AAPL NVDA TSLA; do for t in 14:30 17:30 19:30; do
  curl -s "http://localhost:5173/feed/uw/api/option-trades?ticker_symbol=$s&limit=500&older_than=2026-10-12T${t}:00Z" -o n_${s}_${t/:/}.json
done; done
```

`/option-trades` answers the latest trading day only; `older_than` walks back inside it. Each print carries UW's
`theo` (equal to the print's price — the vol is solved from it), `implied_volatility`, `gamma`, `delta`,
`underlying_price` and `executed_at`.

| Script | Run | Prints |
|---|---|---|
| `conv3.py` | `python3 -I conv3.py 0.0415,0 sess_*.json` (`GROUP=expiry` for one row an expiry) | per DTE bucket and print hour: IV re-inverted from the print under calendar, trading and UW's whole-day clock against UW's IV, and BS gamma at UW's IV against UW's gamma |
| `bytime.py` | `python3 -I bytime.py sess_*.json` | the τ UW's IV implies, in hours, against the calendar hours, by expiry and print hour |
| `pername.py` | `R=0.0415 Q=0 python3 -I pername.py SPY sess_*.json` | one name's gamma error by DTE under each clock, at UW's carry and at the house's (r 4.2%, q 1.2%) |
| `amer.py` | `python3 -I amer.py sess_*.json` (about 80 s) | American against European gamma on near-the-money SPY prints, each style's vol inverted from the same price on the same CRR tree |
| `bookshare.py` | `python3 -I bookshare.py chain.jsonl` (a recorded day's SPY chain, gunzipped) | each near-money strike's share of gamma in 1–11-day and 12–60-day puts, and the American gap that share implies |
