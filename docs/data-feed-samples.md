# Data feed: the shapes the vendors answered with (2026-10-12)

Each endpoint the feed layer reads (src/data/feed/uw.ts, massive.ts) was called once through the proxy's own client
(server/feed.ts) on Monday 2026-10-12, around 10:50 ET with the market open, with the owner's keys: Unusual Whales
API Basic and Massive Basic. What follows is each answer's **shape**: its keys, their types and, where harmless, one
example value from the first row. Ids, cursors, names and URLs are left blank. No key appears here, and no bulk data.

What the answers taught, beyond the catalogs:

- **UW sends figures as numeric strings** (`"777.9405"`, `"127725"`), and some as numbers in the same row (`iv`,
  `delta` on a flow alert; `volume`, `size`). The adapters read every figure with `num()`.
- **UW wraps rows in `data`**, except `/api/stock/{ticker}/flow-recent`, which is a **bare array** of 50 prints.
  `/api/option-trades/flow-alerts` adds `newer_than` / `older_than`; `/api/insider/transactions` adds `has_more`;
  `/api/market/market-tide` adds `date`.
- **The per-name flow-alert route** (`/api/stock/{ticker}/flow-alerts`) answers without `id`, `start_time` or
  `end_time`, so the adapter reads the market route with `ticker_symbol` instead.
- **UW times** are ISO strings (`executed_at`, `tape_time`, `created_at`), except `start_time` / `end_time` on a flow
  alert and the quote's `time`, which are epoch ms.
- **UW's earnings day routes** (`/premarket`, `/afterhours`) are empty without a `date` on a day with no reports.
- **Massive's Basic plans refuse the indices**: both `/v3/snapshot/indices` and `I:SPX` bars answered **403
  `NOT_AUTHORIZED`** ("You are not entitled to this data. Please upgrade your plan"). Everything else read answered 200.
- **Massive's minute bars** for the session before (2026-10-09) were there on the 12th; `t` is epoch ms.
- **Massive's `next_url`** is an absolute `https://api.massive.com/…` address with a cursor; the client follows it
  through the proxy (`viaProxy`).
- **Listed expiries in one Massive call**: the contracts route with `strike_price` set to one round strike near spot and
  `contract_type=call` answered every expiry on one page (SPY at 700: 32 dates, 2026-10-12 to 2029-01-19), the same 32
  UW's `/api/stock/{ticker}/expiry-breakdown` lists.
- **Rate**: the eight Massive calls took 40 s through the bucket (five at once, then one every 12 s), no 429.

## Unusual Whales (API Basic) — base `https://api.unusualwhales.com`, `Authorization: Bearer`

### `GET /api/stock/SPY/stock-state` — 200
```
data: object
  close: numeric string  "777.9405"
  high: numeric string  "779.397"
  low: numeric string  "777.602"
  open: numeric string  "778.78"
  volume: number  3889814
  total_volume: number  4277612
  market_time: string  "regular"
  tape_time: string  "2026-10-12T14:50:02Z"
  prev_close: numeric string  "778.57"
```

### `GET /api/stock/SPY/quote` — 200
```
data: object
  last_trade: object
    price: numeric string  "777.97"
    time: number  1791816603913
    vol: number  4277931
  market_time: string  "regular"
  quote: object
    ask: object
      price: numeric string  "777.980"
      size: number  1217
    bid: object
      price: numeric string  "777.950"
      size: number  105
    time: number  1791816604027
  quote_statistics: object
    postmarket: object
      midpoint_changes: number  0
      quote_changes: number  0
      size_only_changes: number  0
      spread_tightened: number  0
      spread_unchanged: number  0
      spread_widened: number  0
    premarket: object
      midpoint_changes: number  71218
      quote_changes: number  161913
      size_only_changes: number  90695
      spread_tightened: number  36286
      spread_unchanged: number  90695
      spread_widened: number  34932
    regular: object
      midpoint_changes: number  74466
      quote_changes: number  497547
      size_only_changes: number  423081
      spread_tightened: number  38165
      spread_unchanged: number  423081
      spread_widened: number  36301
  quote_values: object
    midpoint: numeric string  "777.965"
    quote_age_ms: number  153
    size_imbalance: number  -0.8411497730711044
    size_weighted_midpoint: number  777.952382753404
    spread: numeric string  "0.030"
    spread_bps: number  0.3856214611193654
```

### `GET /api/option-trades/flow-alerts?limit=3` — 200
```
data: array[3]
  total_bid_side_prem: numeric string  "2126"
  total_ask_side_prem: numeric string  "21726"
  strike: numeric string  "746"
  theta: number  -2.523472516046993
  gamma: number  0.1435235379331107
  has_floor: boolean  false
  total_premium: numeric string  "23852"
  expiry: string  "2026-10-12"
  ticker: string  "QQQ"
  volume_oi_ratio: numeric string  "39.1323035594359"
  start_time: number  1791816594814
  delta: number  -0.4735764133443388
  all_opening_trades: boolean  false
  price: numeric string  "1.02"
  iv: number  0.15303542788690574
  total_size: number  234
  issue_type: string  "ETF"
  created_at: string  "2026-10-12T14:50:03.041370Z"
  end_time: number  1791816596560
  trade_count: number  22
  open_interest: number  2978
  sector: null
  volume: number  116536
  bid: numeric string  "1.01"
  iv_end: numeric string  "0.151716132044137"
  expiry_count: number  1
  rho: number  -0.00209072416892832
  er_time: null
  ask: numeric string  "1.03"
  marketcap: numeric string  "506066972519"
  alert_rule: string  "RepeatedHits"
  has_singleleg: boolean  true
  vega: number  0.0721439262800155
  has_multileg: boolean  false
  id: string
  rule_id: string
  next_earnings_date: null
  type: string  "put"
  has_sweep: boolean  true
  iv_start: numeric string  "0.154593191506113"
  underlying_price: numeric string  "746.16"
  option_chain: string
  theo: number  1.0193162393161732
newer_than: string  "2026-08-12T14:50:04.262444Z"
older_than: string  "2026-10-12T14:50:04.262444Z"
```

### `GET /api/stock/SPY/flow-alerts?limit=3` — 200
```
data: array[3]
  type: string  "call"
  ticker: string  "SPY"
  iv: number  0.1085270148263625
  created_at: string  "2026-10-12T14:49:59.235371Z"
  delta: number  0.32287138000340876
  theta: number  -0.5890691603623601
  gamma: number  0.05743589258970459
  price: numeric string  "1.31"
  open_interest: number  961
  volume: number  3465
  expiry: string  "2026-10-14"
  strike: numeric string  "781"
  option_chain: string
  rho: number  0.013690855009986404
  theo: number  1.310000000000031
  underlying_price: numeric string  "777.92"
  vega: number  0.20669417496242196
  total_premium: numeric string  "127725"
  trade_count: number  33
  iv_end: numeric string  "0.108527014826362"
  iv_start: numeric string  "0.108527014826362"
  has_floor: boolean  false
  has_multileg: boolean  false
  has_sweep: boolean  false
  all_opening_trades: boolean  false
  total_size: number  975
  alert_rule: string  "RepeatedHits"
  total_bid_side_prem: numeric string  "127725"
  total_ask_side_prem: numeric string  "0"
  volume_oi_ratio: numeric string  "3.60561914672216"
  has_singleleg: boolean  true
  expiry_count: number  1
```

### `GET /api/stock/SPY/flow-recent` — 200
```
(bare array)[50]
  rule_id: null
  gamma: numeric string  "0.02841660680367145"
  canceled: boolean  false
  report_flags: array[0]
  rho: numeric string  "0.0818609216841155"
  nbbo_bid: numeric string  "3.08"
  size: number  1
  delta: numeric string  "0.3531234134373278"
  ewma_nbbo_bid: numeric string  "3.08"
  option_chain_id: string
  theo: numeric string  "3.090000000000032"
  full_name: string
  no_side_vol: number  0
  upstream_condition_detail: string  "mlet"
  next_earnings_date: null
  theta: numeric string  "-0.2516024718558045"
  volume: number  400
  implied_volatility: numeric string  "0.0968229469203647"
  tags: array[3] of string  "bid_side"
  nbbo_ask: numeric string  "3.11"
  premium: numeric string  "309.00"
  industry_type: null
  vega: numeric string  "0.501852435013512"
  open_interest: number  1457
  er_time: null
  price: numeric string  "3.09"
  trading_hours: string  "rth"
  nbbo_bid_size: number  349
  flow_alert_id: null
  expiry: string  "2026-10-23"
  nbbo_bid_time: string  "2026-10-12T14:50:03.925680Z"
  ewma_nbbo_ask: numeric string  "3.11"
  underlying_symbol: string  "SPY"
  multi_vol: number  212
  stock_multi_vol: number  0
  ask_vol: number  15
  marketcap: numeric string  "821678532946"
  id: string
  mid_vol: number  109
  sector: null
  nbbo_ask_size: number  349
  bid_vol: number  276
  executed_at: string  "2026-10-12T14:50:04.332422Z"
  strike: numeric string  "784"
  nbbo_ask_time: string  "2026-10-12T14:50:03.925680Z"
  option_type: string  "call"
  exchange: string  "C2OX"
  underlying_price: numeric string  "777.97"
```

### `GET /api/option-trades?limit=3` — 200
```
data: array[3]
  rule_id: null
  gamma: numeric string  "0.04326034668615044"
  canceled: boolean  false
  report_flags: array[0]
  rho: numeric string  "0.0667162679696235"
  nbbo_bid: numeric string  "3.65"
  size: number  1
  delta: numeric string  "0.538395486879769"
  ewma_nbbo_bid: numeric string  "3.650"
  option_chain_id: string
  theo: numeric string  "3.710000000000001"
  full_name: string
  no_side_vol: number  0
  upstream_condition_detail: string  "mlet"
  next_earnings_date: null
  theta: numeric string  "-0.02219686050901733"
  volume: number  842
  implied_volatility: numeric string  "0.3301281906887746"
  tags: array[3] of string  "ask_side"
  nbbo_ask: numeric string  "3.70"
  premium: numeric string  "371.00"
  matched_noti_configs: array[0]
  industry_type: null
  vega: numeric string  "0.1104109864089187"
  open_interest: number  30885
  er_time: null
  price: numeric string  "3.71"
  issue_type: string  "ETF"
  nbbo_bid_size: number  832
  flow_alert_id: null
  expiry: string  "2027-01-15"
  nbbo_bid_time: string  "2026-10-12T14:50:03.781000Z"
  ewma_nbbo_ask: numeric string  "3.700"
  underlying_symbol: string  "SLV"
  multi_vol: number  802
  stock_multi_vol: number  0
  ask_vol: number  697
  marketcap: numeric string  "29732025327"
  id: string
  mid_vol: number  35
  sector: null
  nbbo_ask_size: number  61
  bid_vol: number  110
  executed_at: string  "2026-10-12T14:50:04.437000Z"
  strike: numeric string  "55"
  nbbo_ask_time: string  "2026-10-12T14:50:03.742000Z"
  option_type: string  "call"
  exchange: string  "XISX"
  underlying_price: numeric string  "54.501"
```

### `GET /api/darkpool/recent?limit=3` — 200
```
data: array[3]
  size: number  4600
  ticker: string  "CCI"
  price: numeric string  "80.015"
  volume: number  1589665
  executed_at: string  "2026-10-12T14:50:04Z"
  canceled: boolean  false
  premium: numeric string  "368069.000"
  sale_cond_codes: null
  nbbo_ask: numeric string  "80.09"
  nbbo_bid: numeric string  "79.95"
  ext_hour_sold_codes: null
  market_center: string  "L"
  nbbo_ask_quantity: number  119
  nbbo_bid_quantity: number  20
  tracking_id: number
  trade_code: null
  trade_settlement: string  "regular"
  trf_executed_at: string  "2026-10-12T14:50:04Z"
```

### `GET /api/darkpool/SPY?limit=3` — 200
```
data: array[3]
  size: number  200
  ticker: string  "SPY"
  price: numeric string  "777.97"
  volume: number  4275347
  executed_at: string  "2026-10-12T14:49:52Z"
  canceled: boolean  false
  premium: numeric string  "155594.00"
  sale_cond_codes: null
  nbbo_ask: numeric string  "777.98"
  nbbo_bid: numeric string  "777.96"
  ext_hour_sold_codes: null
  market_center: string  "L"
  nbbo_ask_quantity: number  20
  nbbo_bid_quantity: number  65
  tracking_id: number
  trade_code: null
  trade_settlement: string  "regular"
  trf_executed_at: string  "2026-10-12T14:49:52Z"
```

### `GET /api/stock/SPY/net-prem-ticks` — 200
```
data: array[81]
  date: string  "2026-10-12"
  call_volume: number  27958
  put_volume: number  28098
  call_volume_ask_side: number  15917
  call_volume_bid_side: number  10937
  put_volume_ask_side: number  12331
  put_volume_bid_side: number  14793
  net_call_premium: numeric string  "-104772.00"
  net_call_volume: number  4980
  net_put_premium: numeric string  "-192997.00"
  net_put_volume: number  -2462
  tape_time: string  "2026-10-12T13:30:00.000000Z"
  net_delta: numeric string  "21342.4429938733172443600"
```

### `GET /api/market/market-tide` — 200
```
data: array[17]
  timestamp: string  "2026-10-12T09:30:00-04:00"
  date: string  "2026-10-12"
  net_call_premium: numeric string  "-17790938.0000"
  net_put_premium: numeric string  "9489911.0000"
  net_volume: number  -42218
date: string  "2026-10-12"
```

### `GET /api/stock/SPY/spot-exposures/strike` — 200
```
data: array[491]
  put_charm_vol: numeric string  "0"
  call_charm_ask: numeric string  "0"
  put_vanna_oi: numeric string  "3761.24"
  call_vanna_vol: numeric string  "0"
  call_gamma_vol: numeric string  "0"
  call_gamma_oi: numeric string  "1.33"
  put_delta_vol: numeric string  "0"
  date: string  "2026-10-12"
  call_vanna_bid: numeric string  "0"
  put_delta_oi: numeric string  "-1943891.21"
  call_gamma_bid: numeric string  "0"
  put_vanna_ask: numeric string  "0"
  call_charm_bid: numeric string  "0"
  call_delta_bid: numeric string  "0"
  time: string  "2026-10-12T14:49:22.000000Z"
  call_delta_ask: numeric string  "0"
  put_gamma_ask: numeric string  "0"
  put_delta_ask: numeric string  "0"
  put_gamma_oi: numeric string  "-10727.2"
  call_vanna_oi: numeric string  "-0.29"
  call_delta_vol: numeric string  "0"
  put_charm_oi: numeric string  "-2307753.25"
  price: numeric string  "778.05"
  call_delta_oi: numeric string  "23608943.38"
  put_gamma_vol: numeric string  "0"
  put_gamma_bid: numeric string  "0"
  call_vanna_ask: numeric string  "0"
  put_charm_bid: numeric string  "0"
  ticker: string  "SPY"
  strike: numeric string  "50"
  put_vanna_bid: numeric string  "0"
  call_charm_vol: numeric string  "0"
  put_vanna_vol: numeric string  "0"
  put_delta_bid: numeric string  "0"
  call_gamma_ask: numeric string  "0"
  call_charm_oi: numeric string  "2166.8"
  put_charm_ask: numeric string  "0"
```

### `GET /api/stock/SPY/spot-exposures` — 200
```
data: array[206]
  time: string  "2026-10-12T10:34:15.941000Z"
  ticker: string  "SPY"
  start_time: string  "2026-10-12T10:34:00.000000Z"
  price: numeric string  "778.935"
  ticker_id: number  2447
  charm_per_one_percent_move_dir: numeric string  "0"
  charm_per_one_percent_move_oi: numeric string  "-8077240482205.39"
  charm_per_one_percent_move_vol: numeric string  "0"
  gamma_per_one_percent_move_dir: numeric string  "0"
  gamma_per_one_percent_move_oi: numeric string  "2318869729.74"
  gamma_per_one_percent_move_vol: numeric string  "0"
  vanna_per_one_percent_move_dir: numeric string  "0"
  vanna_per_one_percent_move_oi: numeric string  "939966164.5"
  vanna_per_one_percent_move_vol: numeric string  "0"
```

### `GET /api/congress/recent-trades?limit=3` — 200
```
data: array[3]
  name: string
  ticker: string  "MSFT"
  issuer: string  "undisclosed"
  is_active: boolean  true
  transaction_date: string  "2026-09-28"
  notes: string
  txn_type: string  "Sell"
  politician_id: string
  amounts: string  "$1,001 - $15,000"
  filed_at_date: string  "2026-10-05"
  member_type: string  "house"
  reporter: string
```

### `GET /api/insider/transactions?limit=3` — 200
```
data: array[3]
  id: string
  ticker: string  "VWAV"
  amount: number  -165138
  transactions: number  1
  price: numeric string  "5.1400"
  sector: string  "Industrials"
  transaction_date: string  "2026-10-16"
  is_officer: boolean  false
  is_ten_percent_owner: boolean  true
  is_s_p_500: boolean  false
  is_director: boolean  false
  owner_name: string
  reporter_is_public_company: boolean  false
  ids: array[1] of string  
  marketcap: numeric string  "8277671"
  next_earnings_date: null
  filing_date: string  "2026-10-09"
  stock_price: numeric string  "4.725"
  formtype: numeric string  "144"
  transaction_code: string  "S"
  security_title: null
  is_10b5_1: boolean  false
  reporter_cik: numeric string
  security_ad_code: null
  shares_owned_after: null
  officer_title: string  ""
  shares_owned_before: null
  director_indirect: null
  natureofownership: null
  date_excercisable: null
  price_excercisable: null
  expiration_date: null
has_more: boolean  true
```

### `GET /api/earnings/premarket?limit=3` — 200
```
data: array[0]
```

### `GET /api/earnings/afterhours?limit=3` — 200
```
data: array[0]
```

### `GET /api/earnings/AAPL` — 200
```
data: array[125]
  source: string  "company"
  report_date: string  "2026-11-02"
  report_time: string  "postmarket"
  expected_move_perc: numeric string  "0.04923047619047619048"
  ending_fiscal_quarter: string  "2026-09-30"
  expected_move: numeric string  "16.80"
  street_mean_est: numeric string  "1.99"
  actual_eps: null
  post_earnings_move_1d: null
  post_earnings_move_1w: null
  post_earnings_move_2w: null
  post_earnings_move_3d: null
  pre_earnings_move_1d: null
  pre_earnings_move_1w: null
  pre_earnings_move_2w: null
  pre_earnings_move_3d: null
  short_straddle_1w: null
  short_straddle_1d: null
  long_straddle_1w: null
  long_straddle_1d: null
```

### `GET /api/stock/SPY/ohlc/1m?limit=3` — 200
```
data: array[3]
  close: numeric string  "777.97"
  high: numeric string  "777.97"
  low: numeric string  "777.9405"
  open: numeric string  "777.95"
  start_time: string  "2026-10-12T14:50:00Z"
  volume: number  1286
  end_time: string  "2026-10-12T14:51:00Z"
  total_volume: number  4277931
  market_time: string  "r"
```

### `GET /api/earnings/premarket?date=2026-10-14&limit=2` — 200
```
data: array[2]
  source: string  "company"
  symbol: string  "ASML"
  country_code: string  "NL"
  full_name: string
  sector: string  "Technology"
  is_s_p_500: boolean  false
  reaction: null
  has_options: boolean  true
  marketcap: numeric string  "686174485706"
  report_date: string  "2026-10-14"
  report_time: string  "premarket"
  expected_move_perc: numeric string  "0.04883860587382160986"
  ending_fiscal_quarter: string  "2026-09-30"
  country_name: string  "NETHERLANDS"
  continent: string  "Europe"
  expected_move: numeric string  "86.21"
  street_mean_est: numeric string  "12.47"
  actual_eps: null
  pre_earnings_date: string  "2026-10-12"
  pre_earnings_close: numeric string  "1765.12"
  post_earnings_date: null
  post_earnings_close: null
```

### `GET /api/earnings/afterhours?date=2026-10-14&limit=2` — 200
```
data: array[2]
  source: string  "company"
  symbol: string  "HOMB"
  country_code: string  "US"
  full_name: string
  sector: string  "Financial Services"
  is_s_p_500: boolean  false
  reaction: null
  has_options: boolean  true
  marketcap: numeric string  "5651402048"
  report_date: string  "2026-10-14"
  report_time: string  "postmarket"
  expected_move_perc: numeric string  "0.06622409553916403231"
  country_name: string  "UNITED STATES"
  continent: string  "North America"
  ending_fiscal_quarter: string  "2026-09-30"
  expected_move: numeric string  "1.89"
  street_mean_est: numeric string  "0.64"
  actual_eps: null
  pre_earnings_date: string  "2026-10-12"
  pre_earnings_close: numeric string  "28.47"
  post_earnings_date: null
  post_earnings_close: null
```

### `GET /api/stock/SPY/expiry-breakdown` — 200
```
data: array[32]
  expires: string  "2026-10-12"
  open_interest: number  565863
  volume: number  1689029
  chains: number  302
```

### `GET /api/news/headlines?limit=3` — 200 (checked for the Dossier, 2026-10-12, 11:16 ET)
```
data: array[3]
  headline: string
  source: string  "Tradex"
  created_at: string  "2026-10-12T15:16:14Z"
  tickers: array of string  ["PM"]
  tags: array  []
  is_major: boolean  true
  sentiment: string  "neutral"
  meta: object, keyed by ticker
    PM: object
      curr: object  { c: numeric string, date: string, mt: string, v: number }
      prev: object  { c: numeric string, date: string, mt: string, v: number }
```
100 headlines reached back 80 minutes of the morning; every `sentiment` read "neutral".

### `GET /api/stock/SPY/spot-exposures/expiry-strike?expirations[]=2026-10-12&expirations[]=2026-10-13&min_strike=770&max_strike=785&limit=500` — 200
```
data: array[32]
  call_vanna_oi: numeric string  "-98109.49"
  call_vanna_vol: numeric string  "-257518.16"
  call_gamma_bid: numeric string  "25794308.74"
  call_charm_bid: numeric string  "15074274692.46"
  put_delta_bid: numeric string  "88446736.34"
  expiry: string  "2026-10-13"
  date: string  "2026-10-12"
  call_charm_vol: numeric string  "16559912802.76"
  put_delta_oi: numeric string  "-110692322.43"
  put_delta_vol: numeric string  "-271624676.37"
  call_delta_bid: numeric string  "-839413909.65"
  ticker: string  "SPY"
  call_vanna_bid: numeric string  "-234415.45"
  put_vanna_ask: numeric string  "769007.77"
  put_gamma_bid: numeric string  "35788627.94"
  put_gamma_vol: numeric string  "-109908798.04"
  put_delta_ask: numeric string  "-182892282.42"
  time: string  "2026-10-12T18:07:58.000000Z"
  call_delta_oi: numeric string  "351318436.56"
  put_charm_oi: numeric string  "-25939570407.81"
  call_delta_vol: numeric string  "922141955.93"
  call_charm_ask: numeric string  "-1416308331.81"
  put_gamma_ask: numeric string  "-74004583.09"
  call_gamma_vol: numeric string  "28336454.8"
  put_vanna_bid: numeric string  "-371892.28"
  price: numeric string  "777.51"
  put_charm_ask: numeric string  "-42858864396.38"
  strike: numeric string  "770"
  put_gamma_oi: numeric string  "-44789966.34"
  call_gamma_oi: numeric string  "10795646.95"
  put_vanna_oi: numeric string  "465428.37"
  call_gamma_ask: numeric string  "-2423512.58"
  call_vanna_ask: numeric string  "22024.58"
  put_charm_vol: numeric string  "-63652358739.42"
  put_charm_bid: numeric string  "20726553516.17"
  call_charm_oi: numeric string  "6309009841.72"
  call_delta_ask: numeric string  "78867404.13"
  put_vanna_vol: numeric string  "1142101.16"
```

### `GET /api/stock/SPY/oi-per-strike` — 200
```
data: array[491]
  date: string  "2026-10-12"
  strike: numeric string  "50"
  call_oi: number  39
  put_oi: number  72422
```

### `GET /api/stock/SPY/oi-per-strike?date=2026-10-09` — 200
```
data: array[491]
  date: string  "2026-10-09"
  strike: numeric string  "50"
  call_oi: number  36
  put_oi: number  72420
```

### `GET /api/stock/SPY/max-pain` — 200
```
data: array[32]
  close: numeric string  "777.51"
  open: numeric string  "778.78"
  expiry: string  "2026-10-12"
  max_pain: numeric string  "776"
  next_upper_strike: numeric string  "777"
  next_lower_strike: numeric string  "775"
date: string  "2026-10-12"
```

### `GET /api/stock/SPY/interpolated-iv` — 200
```
data: array[9]
  date: string  "2026-10-12"
  days: number  1
  percentile: numeric string  "0.073"
  volatility: numeric string  "0.087"
  implied_move_perc: numeric string  "0.003"
```

### `GET /api/stock/SPX/spot-exposures/strike?limit=1` — 200
```
data: array[1]
  call_vanna_ask: numeric string  "0.04"
  call_delta_ask: numeric string  "607050766.33"
  date: string  "2026-10-12"
  put_vanna_ask: numeric string  "0"
  put_vanna_oi: numeric string  "34.33"
  call_charm_oi: numeric string  "63865.95"
  call_gamma_ask: numeric string  "-0.11"
  ticker: string  "SPX"
  call_delta_oi: numeric string  "835367737144.69"
  call_gamma_bid: numeric string  "0"
  put_delta_bid: numeric string  "0"
  put_charm_oi: numeric string  "-84534.9"
  call_gamma_vol: numeric string  "0.11"
  time: string  "2026-10-12T18:06:20.695000Z"
  price: numeric string  "7800"
  put_vanna_vol: numeric string  "0"
  call_vanna_oi: numeric string  "-26.92"
  call_vanna_bid: numeric string  "0"
  put_delta_oi: numeric string  "-152830.33"
  call_vanna_vol: numeric string  "-0.04"
  call_delta_bid: numeric string  "-60725469.3"
  call_charm_bid: numeric string  "0"
  put_charm_vol: numeric string  "0"
  put_gamma_ask: numeric string  "0"
  put_charm_ask: numeric string  "0"
  put_gamma_bid: numeric string  "0"
  put_delta_ask: numeric string  "0"
  call_delta_vol: numeric string  "667776235.63"
  put_delta_vol: numeric string  "0"
  put_charm_bid: numeric string  "0"
  put_gamma_vol: numeric string  "0"
  put_gamma_oi: numeric string  "-96.74"
  call_gamma_oi: numeric string  "71.78"
  call_charm_ask: numeric string  "-92.35"
  put_vanna_bid: numeric string  "0"
  strike: numeric string  "200"
  call_charm_vol: numeric string  "92.35"
```

### `GET /api/stock/SPY/flow-per-strike` — 200 (read by Pinpoint for the contracts traded today at each strike)
```
(a bare array): array[359]
  timestamp: string  "2026-10-12T17:55:18.467000Z"
  date: string  "2026-10-12"
  ticker: string  "SPY"
  call_volume: number  1
  put_volume: number  0
  call_volume_ask_side: number  0
  call_volume_bid_side: number  1
  put_volume_ask_side: number  0
  put_volume_bid_side: number  0
  strike: numeric string  "50"
  put_premium: numeric string  "0"
  call_premium: numeric string  "72802.0000"
  call_premium_bid_side: numeric string  "72802.0000"
  put_premium_bid_side: numeric string  "0"
  call_premium_ask_side: numeric string  "0"
  put_premium_ask_side: numeric string  "0"
  call_trades: number  1
  put_trades: number  0
  call_otm_premium: numeric string  "0"
  call_otm_trades: number  0
  call_otm_volume: number  0
  put_otm_premium: numeric string  "0"
  put_otm_trades: number  0
  put_otm_volume: number  0
```

### `GET /api/stock/SPX/stock-state` — 422, `GET /api/stock/SPX/ohlc/1m` — 422
```
{ "msg": "Stock state data is not available for index ticker SPX", … }
{ "code": "cboe_index_access_missing", "msg": "Prices for the CBOE index SPX require provisioned access and CBOE approval. …", … }
```

### What Pinpoint's and Terrain's wiring learnt (2026-10-12, 13:20–14:10 ET)

- **The signs, read against the strikes either side of SPY's spot**: gamma, vanna and charm come with the calls as
  they are and the puts turned negative (`put_gamma_oi` −, `put_vanna_oi` + below spot and − above it, the reverse of a
  put's own vanna); delta comes as the contracts' own (`call_delta_oi` +, `put_delta_oi` −). The house's sign is the
  other way round (core/walls.ts: negative call-dominant), so data/feed/levels.ts negates gamma, delta and the calls'
  vanna and charm, and keeps the puts' vanna and charm as they come.
- **The walls match a hand computation**: SPY at 777.65 (13:44 ET), 30 strikes each side — call wall 785, put wall 772,
  supreme 785, flip 777.50, net −$3.9B — from both the page and a Python pass over the same answer. UW's own
  `/gex-levels` named 780 and 774 that minute, but it reads `source: "vol"` (today's volume), not open interest.
- **Every exposure row carries `price` and `time`**: `limit=1` is the cheap way to learn the price a name's book is
  figured at — an index too, which has no day state (`/stock-state` 422) and no bars (`/ohlc` 422, a CBOE grant).
- **`/spot-exposures/expiry-strike` pages at 50 rows** unless `limit` is asked (500 is the most; `limit=1000` came back
  as the 50-row page): seven dates × 61 strikes is 419 rows, 430 KB.
- **`/oi-per-strike`'s `date` is the day the count is published**: the count dated Oct 12 is the positions at Oct 9's
  close (`/oi-change` pairs `curr_date` 2026-10-12 with `last_date` 2026-10-09 and Oct 9's volumes). Two dates'
  counts give the change by strike; contracts that expired between them drop out of the later count.
- **`/oi-change` is ordered by the change** (`order=desc`, the default, the most added; `order=asc` the most closed);
  not read — two `/oi-per-strike` counts give every strike.
- **`/max-pain`** lists every listed date (32 for SPY, the same as `/expiry-breakdown`); an index's rows carry no
  `close` / `open` and add `missing_periscope: true`.
- **`/ohlc/1m?limit=2500`** reaches about four sessions back with the extended hours (`market_time` `pr`, `r`, `po`);
  `/ohlc/5m?limit=2500` about fourteen.

### `GET /api/stock/SPY/greek-exposure/strike?date=2026-10-09` — 200
```
data: array[491]
  date: string  "2026-10-09"
  strike: numeric string  "50"
  call_gex: numeric string  "0.0001"
  put_gex: numeric string  "-1.9541"
  call_delta: numeric string  "3599.9889"
  put_delta: numeric string  "-349.7235"
  call_charm: numeric string  "11.7905"
  put_charm: numeric string  "6397.5801"
  call_vanna: numeric string  "-19.5270"
  put_vanna: numeric string  "-54723.3563"
```

### `GET /api/stock/SPY/volatility/term-structure` — 200
```
data: array[33]
  date: string  "2026-10-12"
  ticker: string  "SPY"
  volatility: numeric string  "0.1104826156936956"
  expiry: string  "2026-10-12"
  implied_move: numeric string  "0.3230655408285557"
  dte: number  0
  implied_move_perc: numeric string  "0.0004152833648206233"
```

### `GET /api/stock/SPY/ohlc/1d?limit=40` — 200
```
data: array[40]
  close: numeric string  "778.77"
  high: numeric string  "781"
  low: numeric string  "778.28"
  open: numeric string  "780.49"
  date: string  "2026-10-12"
  volume: number  387798
  total_volume: number  387798
  market_time: string  "pr"
```

### What Pinpoint's rewiring learnt (2026-10-12, after the close)
- **`/greek-exposure/strike?date=`** answered every date asked on Basic, back to 2025-10-10: the book as UW figured it
  at that session's open (it "updates once per day at market open"), 491 strikes for SPY, `call_gex` + / `put_gex` −
  as `/spot-exposures/strike` states them. Its units are not `/spot-exposures/strike`'s (770: 126,136 against
  812,802,219 the same evening), so it is read within one day's rows only — each past session's walls at its open.
- **`/spot-exposures/strike?date=D`** is D's book as it closed (`time` 20:00Z, `price` the close) — the last closes'
  books. **`/spot-exposures?date=D`** is D's whole book a minute (527 rows for Oct 9, from 06:35 ET).
- **`/ohlc/1m?date=D&limit=1000`**: D's whole tape, pre-market to after hours (746 bars for Oct 9; `market_time` `r` for
  the regular session). **`/ohlc/1d`**: a bar a session, 600 back; the day under way is `market_time` `pr`.
- **`/volatility/term-structure`**: each listed date's at-the-money vol (SPY's Oct 12 0.110, Oct 13 0.088); an index's
  rows carry `missing_periscope: true` and no dollar move, and list only the index's own root (SPX: the monthlies).
- **An index's dailies are another root**: `/max-pain` for SPX lists Oct 16 first (the AM monthly); SPXW's dailies are
  under `SPXW`, while `/spot-exposures/expiry-strike` for SPX answers a SPXW date (2026-10-13) with rows.
  `/max-pain` for `SPXW` and `NDXP` answers 200 from 2026-10-12 on (`max_pain` "7790", `missing_periscope: true`).
- **`/flow-per-strike-intraday`** answered 2,484 rows for SPY covering eight strikes — not read.

### What the Dossier's wiring learnt (2026-10-12)
- `/api/congress/recent-trades` caps `limit` at 200 (a 500 answers 422 "limit must be smaller than 200"). Rows come
  newest TRADE first; `date` keeps the trades made on or before it, so it pages back. 200 rows reach about three weeks
  of filings; `member_type` is also `"executive"`; `issuer` is whose holding (`self`, `spouse`, `joint`, `child`,
  `undisclosed`); `ticker` is null for bonds and private holdings (the asset is in `notes`, "[ST]", "[GS]" …).
- `/api/insider/transactions`: `page` counts from 0; `transaction_codes[]` filters (repeat the key); one day's filings
  fill 200 rows. Form 144 rows (`formtype` "144") are notices of a proposed sale, their `transaction_date` ahead.
- `/api/earnings/{ticker}`: past rows carry `post_earnings_move_1d` (a fraction) and `actual_eps`; `source` read
  "company" on every row, day routes too.
- `/api/stock/{ticker}/stock-state` for a ticker UW does not know answers 200 `{ "data": null }`; `/quote` answers 404
  `stock_quote_not_found`; Massive's `/v3/reference/tickers/{ticker}` answers 404 `NOT_FOUND`.

### What the rail and Compass's calendar learnt (2026-10-12, 13:23 ET)
- `/api/stock/{index}/stock-state` answers **422** for every index: SPX, NDX, RUT, VIX, XSP — `{ "msg": "Stock state
  data is not available for index ticker SPX" }`; `/quote` answers 404 `stock_quote_not_found`; `/ohlc/1m` answers 422
  `cboe_index_access_missing` ("Prices for the CBOE index SPX require provisioned access and CBOE approval"). No index
  price on the Basic plan; SPY's state the same minute: `close` "777.8", `prev_close` "778.57", `market_time` "regular".
- `/api/stock/{ticker}/expiry-breakdown` lists each ROOT apart, `expires` YYYY-MM-DD (not always in order — NDX's
  came out of order):

  | Root | Dates | First | Note |
  |---|---|---|---|
  | `SPX` | 20 | 2026-10-16 | the AM-settled third-Friday monthlies, out to 2031-12-19 |
  | `SPXW` | 40 | 2026-10-12 | every session, then month- and quarter-ends |
  | `XSP` | 44 | 2026-10-12 | one root (`XSPW` answers `{ "data": [] }`) |
  | `NDX` / `NDXP` | 14 / 34 | 2026-10-16 / 2026-10-12 | AM monthlies / PM dailies |
  | `RUT` / `RUTW` | 9 / 23 | 2026-10-16 / 2026-10-12 | AM monthlies / PM dailies |
  | `VIX` / `VIXW` | 9 / 4 | 2026-10-21 / 2026-10-14 | Wednesdays, the settlement morning |
  | `SPY`, `QQQ`, `IWM` | 32, 31, 33 | 2026-10-12 | |
  | `DIA` | 20 | 2026-10-16 | Fridays |
  | `AAPL` | 24 | 2026-10-12 | |
  | an unknown ticker (`ZZZZ`) | 0 | | `{ "data": [] }`, 200 |

- **UW's breakdown is read off open interest**: a date listed this morning is not in it until the session after.
  Massive's `/v3/reference/options/contracts` (one strike near spot, calls, `expiration_date.gte` today) listed
  2026-10-26 for SPY (33 dates), AAPL (25) and NVDA (26) where UW's listed 32, 24 and 25; TSLA agreed at 22. No other
  date differed. Massive's rows carry `exercise_style` ("american" on SPY).

## Massive (Basic) — base `https://api.massive.com`, `apiKey` query parameter

### `GET /v1/marketstatus/now` — 200
```
afterHours: boolean  false
currencies: object
  crypto: string  "open"
  fx: string  "open"
earlyHours: boolean  false
exchanges: object
  nasdaq: string  "open"
  nyse: string  "open"
  otc: string  "open"
indicesGroups: object
  s_and_p: string  "open"
  societe_generale: string  "open"
  msci: string  "open"
  ftse_russell: string  "open"
  mstar: string  "open"
  mstarc: string  "open"
  cccy: string  "open"
  cgi: string  "open"
  nasdaq: string  "open"
  dow_jones: string  "open"
market: string  "open"
serverTime: string  "2026-10-12T10:50:15-04:00"
```

### `GET /v3/reference/options/contracts?underlying_ticker=SPY&expiration_date.gte=2026-10-12&limit=5` — 200
```
results: array[5]
  cfi: string  "OCASPS"
  contract_type: string  "call"
  exercise_style: string  "american"
  expiration_date: string  "2026-10-12"
  primary_exchange: string  "BATO"
  shares_per_contract: number  100
  strike_price: number  550
  ticker: string  "O:SPY261012C00550000"
  underlying_ticker: string  "SPY"
status: string  "OK"
request_id: string
next_url: string
```

### `GET /v2/aggs/ticker/SPY/range/1/day/2026-10-01/2026-10-09?adjusted=true&sort=asc&limit=3` — 200
```
ticker: string  "SPY"
queryCount: number  3
resultsCount: number  3
adjusted: boolean  true
results: array[3]
  v: number  47708058.813089
  vw: number  762.7837
  o: number  764.36
  c: number  763.99
  h: number  765.65
  l: number  758.7901
  t: number  1790827200000
  n: number  1434649
status: string  "OK"
request_id: string
count: number  3
next_url: string
```

### `GET /v2/aggs/ticker/SPY/range/1/minute/2026-10-09/2026-10-09?adjusted=true&sort=asc&limit=3` — 200
```
ticker: string  "SPY"
queryCount: number  3
resultsCount: number  3
adjusted: boolean  true
results: array[3]
  v: number  5967.495636
  vw: number  776.8871
  o: number  776.62
  c: number  777.1
  h: number  777.19
  l: number  775.79
  t: number  1791532800000
  n: number  1728
status: string  "OK"
request_id: string
count: number  3
next_url: string
```

### `GET /v3/snapshot/indices?ticker.any_of=I:SPX,I:VIX` — 403 (plan)
```
status: string  "NOT_AUTHORIZED"
request_id: string
message: string  "You are not entitled to this…"
```

### `GET /v2/aggs/ticker/I:SPX/range/1/day/2026-10-01/2026-10-09?sort=asc&limit=3` — 403 (plan)
```
status: string  "NOT_AUTHORIZED"
request_id: string
message: string  "You are not entitled to this…"
```

### `GET /v3/reference/tickers?ticker=AAPL&limit=1` — 200
```
results: array[1]
  ticker: string  "AAPL"
  name: string
  market: string  "stocks"
  locale: string  "us"
  primary_exchange: string  "XNAS"
  type: string  "CS"
  active: boolean  true
  currency_name: string  "usd"
  cik: numeric string
  composite_figi: string
  share_class_figi: string
  last_updated_utc: string  "2026-10-12T06:11:02.955498061Z"
status: string  "OK"
request_id: string
count: number  1
```

### `GET /v3/reference/tickers/AAPL` — 200
```
request_id: string
results: object
  ticker: string  "AAPL"
  name: string
  market: string  "stocks"
  locale: string  "us"
  primary_exchange: string  "XNAS"
  type: string  "CS"
  active: boolean  true
  currency_name: string  "usd"
  cik: numeric string
  composite_figi: string
  share_class_figi: string
  market_cap: number  4912984755200
  phone_number: string
  address: object
    address1: string
    city: string  "CUPERTINO"
    state: string  "CA"
    postal_code: numeric string
  description: string
  sic_code: numeric string  "3571"
  sic_description: string  "ELECTRONIC COMPUTERS"
  ticker_root: string  "AAPL"
  homepage_url: string
  total_employees: number  166000
  list_date: string  "1980-12-12"
  branding: object
    logo_url: string
    icon_url: string
  share_class_shares_outstanding: number  14594180000
  weighted_shares_outstanding: number  14594180000
  round_lot: number  40
status: string  "OK"
```

### `GET /v3/reference/options/contracts?underlying_ticker=SPY&contract_type=call&strike_price=700&sort=expiration_date&order=asc&limit=1000` — 200
```
results: array[32]
  cfi: string  "OCASPS"
  contract_type: string  "call"
  exercise_style: string  "american"
  expiration_date: string  "2026-10-12"
  primary_exchange: string  "BATO"
  shares_per_contract: number  100
  strike_price: number  700
  ticker: string  "O:SPY261012C00700000"
  underlying_ticker: string  "SPY"
status: string  "OK"
request_id: string
```

### What the Backtest's real days learnt (2026-10-12)
- `GET /v3/reference/options/contracts?underlying_ticker=SPY&contract_type=call&strike_price=760&as_of=2026-09-14&sort=expiration_date&order=asc&limit=1000`
  — 200, 34 rows, 2026-09-14 to 2029-01-19: `as_of` lists what was listed that day, the since-expired among them. The
  same with `expiration_date=2026-09-18` and no strike: 321 strikes, 300 to 1000, every dollar from 740 to 790.
- `GET /v2/aggs/ticker/O:SPY260918C00762000/range/1/minute/2026-09-14/2026-09-18` — 200, 1,841 rows of the usual bar keys
  (`v`, `vw`, `o`, `c`, `h`, `l`, `t`, `n`): an expired contract's own minutes; up to 402 a day (the funds' options trade
  to 16:15), a minute nothing traded has no row. `O:AAPL241115C00225000` in November 2024: 1,925 rows.
- `GET /v2/aggs/ticker/SPY/range/1/day/2024-10-01/2026-10-11` — 200, 499 rows, the first 2024-10-14: two years back. A
  day bar's `t` is New York's midnight. `GET /v2/aggs/ticker/AAPL/range/1/minute/2024-10-14/2024-10-14` — 200, 706 rows.
- `GET /v2/aggs/ticker/SPY/range/1/minute/2026-09-14/2026-09-18` — 200, 4,448 rows, 390 a day inside 09:30–16:00.
- A burst from another holder of the key answered `{"status":"ERROR","error":"You've exceeded the maximum requests per
  minute…"}` with 429.

