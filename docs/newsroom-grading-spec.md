# News Room grading spec — v0.1 (2026-08-29)

The News Room's grading is a MODEL, and models get backtested (Noah's
standing rule for the news surface: it "will be backtested thoroughly...
flawless / informational / not over the top"). This file freezes what the
grades mean so the future journal can score them. Code of record:
`src/data/newsroom.ts` (derives from `src/data/news.ts` — one generator).

## The grade (states, never orders)

| Grade | Meaning | Cut |
|---|---|---|
| ALLY | the story lifts what it touches | sentiment > +0.12 |
| THREAT | the story presses on what it touches | sentiment < −0.12 |
| WATCH | the wire spoke, the model has no lean | in between |

±0.12 is inherited from News v1 (tape ticks, tones, lean counts) so history
reads continuously. Grades color everything (bear/bull/white ink, arcs,
heat ramps) and are ALWAYS accompanied by the word.

## Severity (internal 1–10 — never rendered as a number)

`severity = clamp(1, 10, round(|expMove1dPct| × 1.6 + magnitude × 5))`

Rendered only as meters and words: ≥8 "heavy", ≥5 "firm", else "light"
(`severityWord`). Scales: ping radius, impact-zone weights, heat.

## Lifecycle (`freshnessOf`)

| State | Age | Effect |
|---|---|---|
| fresh | ≤ 45 min | ripples on the planet, full weight |
| developing | ≤ 180 min | no ripple, weight × 0.72 |
| faded | beyond | dimmed ping and wire row, weight × 0.45 |

## Geography

- Origin = HQ registry (ticker → coords + cluster) → macro regex
  (Fed→DC, BOJ→Tokyo, ECB→Frankfurt, China→Beijing, OPEC→Vienna,
  BoE→London) → NYC listing venue as final fallback.
- Impact zones = the origin cluster's map (chips → Taipei/Seoul/Eindhoven/
  Shenzhen; banks → NYC/London/HK; …), zone weight = rel × severity.
- One ping per CITY (`clusterByCity`): count, pressing/lifting split,
  dominant grade by count (top-severity event breaks ties), click selects
  the city's loudest story.

## What the journal must record (when the backtest phase reaches news)

Per event, at grade time: id, ticker, grade, severity, sentiment,
expMove1dPct/5dPct, confidencePct, provenance SIM|LIVE, engine version
(bump on ANY change to the cuts above). Outcomes: realized next-session and
5-session move vs prediction sign; a grade is "right" when sign(realized)
agrees with the grade's lean (WATCH scores on |realized| staying under the
median). Same discipline as `types/journal.ts` — reuse its shapes when
wired.

## Open questions (decide before LIVE data)

- Dedup/clustering of one story from many outlets (fingerprint on
  ticker+category+quantized time?).
- Severity from real feeds (no `magnitude` field — derive from source
  count + option-market reaction?).
- Whether WATCH events ping at all once volume is real.
