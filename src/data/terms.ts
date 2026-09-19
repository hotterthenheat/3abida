/*
==================================================
  SLAYER TERMINAL - TERM DICTIONARY
  One-line plain-English definitions behind the
  dotted-underline Term explainer (Noah, 2026-08-19:
  "what is revision? what is options vs history?
  these things just sound so abstract"). Keys read
  as the label they explain; definitions say what
  the number means to a person, never how the
  engine computes it.
==================================================
*/

export const TERMS = {
  'Expected move': 'The move options are charging for this report — the market’s own guess, as a ± percent.',
  'Typical move': 'How far the stock actually moved after each of its last 8 reports, averaged.',
  'Priced vs typical':
    'Today’s expected move divided by the typical one. Above 1.00×, the market charges more than this name usually delivers; below it, less.',
  'Last 8 reports': 'Each square is one past report — green beat earnings estimates, red missed. The percent is the beat rate.',
  'Up vs down': 'The odds the post-earnings move is up rather than down, read from options flow and analyst revisions.',
  'IV rank':
    'Where this name’s option prices sit against their own past year, 0–100. Toward 100, they’re about as expensive as they ever get.',
  'Straddle cost':
    'What it costs to own the move in both directions at once — the market’s price tag on the event, in dollars per share.',
  Revisions: 'Which way analysts have been nudging their estimates into the report. Drifting up = quiet upgrades.',
  // ---- earnings hub ----
  'Implied vs realized': 'What options charge for this print, drawn against what the stock actually did after past reports.',
  'Beat rate': 'How often the company beat earnings estimates across its last 8 reports.',
  Pricing: 'Our verdict on the price of the move — overpriced, fair, or underpriced against the name’s own history.',
  // ---- tape ----
  'Exp · DTE': 'The contract’s expiry date and the days until it — an orange 0d expires today.',
  OTM: 'How far the strike sits out of the money. The stock must move this far for the contract to have value at expiry.',
  Spread: 'The bid and ask at print time — the dot marks where between them the order filled.',
  Prem: 'The print’s total dollars: size × fill price × 100.',
  Flow: 'Which side the print leaned — BUY paid the offer, SELL hit the bid, MID negotiated in between.',
  'Day ratio': 'Where the day’s fills on this contract sat between bid and ask. Bid-heavy reads as selling, ask-heavy as buying.',
  Sentiment: 'The direction the money implies. Calls bought or puts sold read bullish; calls sold or puts bought read bearish.',
  'ΔOI': 'The overnight change in open interest — positions opened (▲) or closed (▼) since yesterday’s close.',
  'V/OI': 'Today’s volume against open interest. Above 1×, the contract traded more today than every position that existed this morning.',
  IV: 'Implied volatility — the size of move the option’s price is betting on, stated annualized.',
  Tag: 'How the order executed. A SWEEP raced across exchanges at once — the aggressive fingerprint; custom and ratio prints are parts of structures.',
  /* ---- the two exposure panels ----
     Noah, 2026-08-30: "what is the difference between these 2 sections... if
     they are the same thing please let me know". They are not, but they DO
     overlap in exactly one column, which is why they read alike — so each
     definition names the other. A term that only describes itself would have
     left the same question unanswered. */
  'Exposure ledger':
    'The book across the calendar as a grid of capsules: strikes down the rows, expiries across the columns, one greek at a time or all five side by side. Every capsule is the net exposure at that strike and expiry on the house ramp — gold where dealer hedging amplifies a move, ice where it absorbs one, dark where it is balanced — with its figure inside. The supreme is the largest cell on the whole calendar, ringed in magenta with a star; spot runs through the rows as a rule. Hover a capsule and it lights with its row and column while the read line above carries put, call, net, OI and the verdict; click to pin it, click empty space to let go.',
  'Exposure matrix':
    'Every strike broken out three ways — gamma, delta and vega — each split into the put and call side behind it. The ladder shows you where the pressure sits; this says what it is made of.',
  // ---- strikes & levels ----
  GEX: 'Gamma exposure — the dealer hedging weight at a strike. It decides whether moves get absorbed there or amplified.',
  'Net GEX': 'Call and put gamma netted at a strike. Negative = call-heavy = dealers absorb moves there; positive = put-heavy = dealers amplify.',
  'Net DEX': 'Net delta exposure — the directional share risk dealers carry from the options at that strike.',
  'Net VEX': 'Net vega exposure — how much dealer books swing as implied volatility moves.',
  BPS: 'Distance from the current price in basis points — 100 bps = 1%.',
  NBR: 'Neighbor ratio — this strike’s volume against the strikes beside it. High means the activity is concentrated here, not spread out.',
  Priority:
    'The strike’s structural weight today, and WHY: the bar is split into its reasons, always in this order — net GEX, open interest, volume, neighbor ratio, distance from spot. A longer segment is a bigger reason. The scale behind the bar is internal.',
  'Ranked by': 'The lens the ladder is ordered through — the composite priority, or one of its reasons alone. Rank numbers follow the lens; the bar stays the composite.',
  Class: 'What dealer hedging does at this strike — a cushion under price, resistance above it, or a magnet that pins.',
  'Call wall': 'The heaviest call-gamma strike above price. Dealer hedging supplies stock there, so rallies often stall at it.',
  'Put wall': 'The heaviest put-gamma strike below price. Dealer hedging bids stock there, so dips often hold it.',
  'Gamma flip': 'The price where dealer hedging switches sides — above it moves get absorbed, below it they get amplified.',
  Pin: 'The max-open-interest strike that price tends to gravitate toward into expiry.',
  Supreme: 'The single largest gamma strike on the whole book — the level that matters most today.',
  // ---- the Map's profile panel ----
  'Size at a strike': 'How much dealer hedging sits at this one strike. The longer the capsule, the more. Blue pushes back against a move here; orange pushes it along.',
  'What a move forces':
    'What dealers would have to buy or sell for price to get from here to this strike, adding up every strike crossed on the way. Orange speeds the move up; blue slows it down. Always from gamma: the size lane can show delta or vega, but only gamma turns a price move into forced buying or selling.',
  // ---- contracts driving the setup ----
  'Gamma share': 'This contract’s slice of the whole book’s gamma, as a percent. The bigger the slice, the more dealer hedging this one strike commands.',
  'From spot': 'How far the strike sits from the current price — plus above it, minus below. The nearer, the more its hedging bears on today’s tape.',
  Exposure: 'The dealer gamma this one contract carries, in dollars. Negative = dealers absorb moves at it; positive = they amplify them.',
  'In the path': 'A heavy strike between the current price and the campaign’s final target — hedging the move has to get through on its way.',
  // ---- strike pressure ladder ----
  'Open interest': 'Contracts outstanding at this strike, calls and puts together — the positions that exist, whether or not they traded today.',
  Volume: 'Contracts that traded at this strike today. Volume near open interest means the strike is being actively repositioned.',
  Tail: 'A strike far from the current price carrying far more gamma than its neighbours — protective positioning. Quiet until price gets there, or until it builds fast on a news day.',
  Puts: 'The dealer gamma from the put side at this strike, in gold. In this book the put side amplifies moves — dealers chase price through it.',
  Calls: 'The dealer gamma from the call side at this strike, in steel. In this book the call side absorbs moves — dealers lean against price there.',
  Charm: 'The pull of the clock on dealer hedges — as options decay toward the close, hedges unwind where gamma sits heaviest.',
  Vanna: 'How dealer hedges re-price when implied volatility moves — a vol crush or spike forces mechanical buying or selling with spot unchanged.',
  // ---- weigher desk chain ----
  Mark: 'The contract’s modeled mid price — halfway between what buyers bid and sellers ask.',
  'ITM odds': 'The market’s own implied odds this contract finishes in the money at expiry, read from its pricing.',
  'OTM odds': 'The implied odds this contract finishes out of the money — worthless — at expiry. The mirror of ITM odds.',
  'Touch odds': 'The implied odds the stock trades AT this strike at least once before expiry — roughly double the odds of finishing beyond it.',
  'Profit odds': 'The implied odds the contract is worth more than its mark at expiry (long), or less (short) — finishing-past-breakeven odds, not a recommendation.',
  Breakeven: 'The stock price where owning this contract stops losing money at expiry — strike plus the premium for calls, minus for puts.',
  'To breakeven': 'The move the stock needs, in percent from here, to reach this contract’s breakeven by expiry.',
  'Intrinsic value': 'What the contract would be worth exercised right now — the amount it is already in the money, or zero.',
  'Extrinsic value': 'The rest of the premium — what the market pays for time and volatility on top of intrinsic value.',
  // ---- greeks ----
  Delta: 'How much the option’s price moves for a $1 move in the stock.',
  Gamma: 'How fast delta itself changes as the stock moves — the curvature.',
  Theta: 'What one day costs — the premium the option loses to time overnight.',
  Vega: 'How much the option’s price moves for a 1-point change in implied volatility.',
  Rho: 'How much the option’s price moves for a 1-point change in interest rates — small on short-dated contracts.',
  'Prior day': 'Yesterday’s high, low and close. Price opening away from them and coming back is the most-watched move of the morning.',
  'Opening range': 'The high and low of the session’s first 5, 15 or 30 minutes — the day’s first agreed boundary. Breaking out of it is where most intraday setups start.',
  'Initial balance': 'The high and low of the first hour. A day that stays inside it is a range day; a day that leaves it usually keeps going.',
  'Expected move cone':
    'The band options priced for today, drawn on the chart: the envelope since the open, and the cone still left from here to the bell. Price leaving the band means the move has already beaten what the options charged; the cone shrinking into the close is normal — less day left, less move left.',
  'Model error':
    'How far the textbook GEX computation \u2014 open interest \u00d7 a sign assumption, the one every vendor uses \u2014 sits from actualized dealer gamma. Positive error means the textbook overstates. A desk holding the actualized reference can audit the whole category; one inferring from OI cannot even ask the question.',
  'Time machine':
    'Any past session in the buffer, replayed: where the walls and the flip actually sat through that day, which strikes were building, and the book as it stood at any recorded moment. Nothing is interpolated \u2014 a scrub lands on a reading that happened.',
  'Structural divergence':
    'Two correlated names positioned differently. Both books are placed on percent-from-spot and normalized to a share of their own gamma, so what is compared is the SHAPE of the positioning \u2014 a bucket where one is call-heavy and the other put-heavy is the two books disagreeing about where the level is.',
  'Cost basis':
    'The volume-weighted price today\u2019s aggressive buyers actually paid, expressed as the SPOT that would put them back at break-even. When price crosses it, every one of those holders flips from red to green at once \u2014 a supply event you can watch approaching.',
  'Charm clock':
    'How much of today\u2019s delta decay has actually been paid, against how much of the session has passed. The two are not the same: charm accelerates into the bell, so at lunchtime half the day is gone but only a third of the decay has happened.',
  'Map stability':
    'Whether these levels survive a change in vol. Every GEX product shows its walls as fixed; they are a function of implied volatility, and a two-point move can relocate the flip or hand the wall to a different strike. This says which of the two you are looking at.',
  '\u0394OI heat':
    'Which strikes are being BUILT and UNWOUND through the session. Every other exposure surface here is a snapshot of a stock; this is the flow \u2014 it answers whether a wall is growing or dying, which the static map cannot.',
  'Spot scenario':
    'The book re-read at a price it has not reached yet. Open interest is held exactly as it stands \u2014 this answers where the LEVELS would be if price were there, not how the book would have re-formed on the way.',
  'Expected hedging flow':
    'The dollars of stock dealers must trade to stay hedged as price crosses the gamma between here and there. Positive is buying. It assumes continuous hedging at the modelled dealer sign \u2014 real desks hedge in bands.',
  'Air pocket':
    'A run of strikes between two shelves with almost no dealer gamma in them. A wall says where price stops; this says where it does NOT \u2014 there is no hedging flow in the gap to slow anything down, which is why price can cross it in seconds.',
  'Wall conviction':
    'How much the level deserves to be leaned on: how far it dominates the runner-up shelf on its side, how many sessions it has held the title, and how it has been tested today. A 2.4\u00d7 shelf unbroken for four days and a marginal winner look identical on a map \u2014 they are not the same object.',
  'Expiry ladder':
    'The same strikes read through each expiry at once. A wall built almost entirely of 0DTE gamma disappears at the bell; one spread across dated expiries is real structure that will still be there tomorrow \u2014 the same level on screen, opposite trades.',
  'Event markers':
    'The calendar drawn on the chart: this name\u2019s next earnings, FOMC/CPI/NFP, and the session\u2019s biggest option prints, each marked at its bar. Hover a mark for the details.',
  'RSI 14':
    'Wilder\u2019s momentum gauge, 0\u2013100. Above 70 the move is stretched, below 30 it\u2019s washed out \u2014 and staying pinned there is itself the signal on a trend day.',
  'VWAP bands':
    '\u00b11\u03c3 and \u00b12\u03c3 around the session VWAP, volume-weighted \u2014 how far price sits from where the day\u2019s money actually traded.',
  'Distance unit':
    'The ruler every distance on the desk is measured with. Dollars and percent are literal; ATR is average true range, so 0.4 ATR means the same size of move on SPY as on NVDA; \u03c3 is implied one-day moves \u2014 how many the options are pricing.',
  '\u03c3 distance':
    'The move in implied one-day \u03c3 \u2014 how many of the moves the options are charging for. Past 1\u03c3, price has beaten what the options priced for the day.',
  'Bar clock':
    'What makes a bar close. Time bars close on the timeframe; range bars close when price has spanned a set distance; volume bars close when enough shares have traded. Rule bars are built from the live 15-second tape, so they start at connect and carry no history — and a violent quarter can overshoot the rule, which is what building from aggregates means.',
  'Range bars':
    'Bars that close on movement, not minutes — each one spans the same price distance. A quiet hour is one bar; a violent minute is several. The chop that smears across time bars becomes visible structure.',
  'Volume bars':
    'Bars that close on participation — each one holds the same traded volume. Time disappears from the axis: a bar is a unit of activity, wherever the clock was.',
  'Alert kinds':
    'What a pane can watch besides a typed price: a named level being crossed (the alert follows the wall, flip or supreme as the book moves them), price crossing VWAP or an EMA, RSI crossing a threshold, net GEX flipping sign, a new supreme, a wall migrating N strikes, or an option print over a premium floor. All of it in-session only — nothing runs when the tab is closed.',
  'Armed rail':
    'The list at a pane’s top-left of every alert armed on its symbol, so what’s watching is visible without opening a menu. A row lights orange when its alert fires.',
  'Value area': 'The band holding 70% of the session\u2019s volume, VAL to VAH. Inside it the market is trading acceptance; outside it, discovery.',
  'Timeframe trend':
    'Where price sits on each interval against its own EMA21 and VWAP. Above both reads up, below both reads down, and between them reads flat — the timeframes disagreeing is itself the signal.',
  'Max pain':
    'The settlement price that pays option holders the least in total — the OI-weighted pin. The theory: the price with the least to pay out is the one the book drifts toward into expiry.',
  'Gamma pin':
    'Where the book’s hedging mass centres — every strike’s gamma dollars, magnitude-weighted, averaged into one price. Different from max pain because gamma and open interest can sit on different strikes.',
  'GEX percentile':
    'Where today’s whole-book net gamma ranks against this name’s own history — toward 0 the book is about as call-heavy (absorbing) as it gets, toward 100 as put-heavy (amplifying). The label says how much history the rank is against.',
  'Price scale':
    'How the vertical axis is spaced. Linear gives equal dollars equal height; logarithmic gives equal percentages equal height, which is what you want comparing moves at different prices.',
  Attribution:
    'The prints that built the exposure at a strike today. It answers whether the level is one institution\u2019s single order or four hundred small ones \u2014 the same wall on the map, a different thing to trade against.',
  Provenance:
    'What a number on this page is standing on: measured came from a feed as-is, derived was computed here from measured inputs, modelled came from the simulator with no market consulted.',
  MACD:
    'Two EMAs\u2019 distance (12 vs 26) with its own 9-EMA signal. The histogram is the gap between them \u2014 momentum building or fading before price shows it.',
  Bollinger:
    'A 20-bar average with bands 2\u03c3 out. Tight bands mean the tape is coiling; a close outside them means it\u2019s stretched.',
  ATR:
    'Average true range \u2014 how far this name typically travels in a session, gaps included. A wall 0.4 ATR away is the same distance on SPY and on NVDA.',
  Globex: 'The overnight futures session — Sunday 18:00 to Friday 17:00 New York, with a daily 17:00\u201318:00 break. The equity open is usually decided out here, while the cash tape this desk draws is closed.',
  VPOC: 'The price where the session traded the most volume — the tape\u2019s own centre of gravity today. Price tends to return to it while value is being accepted.',
  Measure:
    'Drag across the tape for the move it covers: dollars, percent, bars, elapsed, and the same move stated at an annual rate so it can be read against implied volatility.',
  Annualized:
    'A move restated as the yearly rate it implies, so a 20-minute move and a two-day one can be compared — and both compared against implied volatility, which is quoted the same way. Measured in trading time, so a weekend does not count against it.',
  MAE: 'Maximum adverse excursion — the deepest a position was ever under while it was open, in dollars. A winner with a heavy MAE was nearly a loser; a stop placed inside it would have taken you out of a trade that worked.',
  MFE: 'Maximum favourable excursion — the most a position was ever worth while it was open. The gap between it and what was realised is what was handed back, and it is the figure that says whether the exit, not the entry, is the problem.',
} as const;

export type TermKey = keyof typeof TERMS;
