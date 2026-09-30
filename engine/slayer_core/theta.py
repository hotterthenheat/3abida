"""
THETADATA v3 (read 2026-09-17 from docs.thetadata.us; the REST API v3 of Theta
Terminal 3, the only terminal ThetaData now documents).

What is here is the SEAM between their wire and our tape: the request URLs, the
column names of their answers, and the parsing of those answers into the
tape's tables. Nothing here computes; nothing here decides. The pull job at
the bottom strings the three together for one symbol on one session day, with
the fetch injectable so the tests never touch the network.

THE FACTS THIS FILE RESTS ON, each read off the named page that day:
  - the terminal listens at http://127.0.0.1:25503; every answer is CSV by
    default (format=csv|json|ndjson|html) with named columns
    (operations/option_history_quote.html)
  - /v3/option/history/quote  symbol, expiration (YYYYMMDD | *), strike (dollars
    | *), right (call|put|both), date | start_date+end_date, interval
    (tick..1h), max_dte, strike_range; columns symbol, expiration, strike,
    right, timestamp, bid_size, bid_exchange, bid, bid_condition, ask_size,
    ask_exchange, ask, ask_condition; "the quote for each interval represents
    the last quote at the interval's timestamp"; a multi-day request must
    name one expiration and spans at most a month, so a whole chain
    (expiration=*) is one request per day
  - /v3/option/history/open_interest  the same shape; columns ..., timestamp,
    open_interest; "reported once per day by OPRA at approximately 06:30 ET"
    and "the open interest at the end of the previous trading day"
  - /v3/option/history/trade  columns ..., timestamp, sequence, price, size,
    exchange, condition (Standard and Pro)
  - /v3/option/snapshot/quote and /v3/stock/snapshot/quote  the live poller's
    calls, same columns without the date parameters
  - /v3/stock/history/ohlc  symbol, date, interval, venue (nqb | utp_cta);
    columns timestamp, open, high, low, close, volume, count, vwap
  - /v3/stock/history/quote  the underlying's NBBO at each interval, "the last
    quote prior to the interval's timestamp"
  - /v3/option/list/expirations (and list/strikes, list/dates, list/symbols,
    list/contracts)  columns symbol, expiration
  - errors come back as text with their own codes: 472 NO_DATA, 473
    INVALID_PARAMS, 474 DISCONNECTED, 570 LARGE_REQUEST, 571 SERVER_STARTING
    (Articles/Data-And-Requests/Making-Requests.html)

TWO THINGS TO VERIFY WITH ONE LIVE REQUEST before the first real pull, because
the pages do not say them: (1) the zone of `timestamp` - taken here as New York
local time, ThetaData's convention in v2, and converted to UTC on the tape;
(2) whether the migration guide's "history endpoints return one day" or the
endpoint pages' start_date/end_date (a month at most) is current. Both are
one request against the terminal; neither is guessed at here.
"""

from __future__ import annotations

import csv
import io
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Callable, Iterable, Mapping
from zoneinfo import ZoneInfo

import pyarrow as pa

from . import tape

BASE = "http://127.0.0.1:25503"
NEW_YORK = ZoneInfo("America/New_York")

NO_DATA = 472
INVALID_PARAMS = 473
DISCONNECTED = 474
LARGE_REQUEST = 570
SERVER_STARTING = 571

RIGHT = {"call": "C", "put": "P", "C": "C", "P": "P"}


class ThetaError(RuntimeError):
    def __init__(self, status: int, text: str, url: str):
        super().__init__(f"{status} from {url}: {text.strip()[:200]}")
        self.status = status
        self.text = text
        self.url = url


# ---- the requests, in the documented parameter order ---------------------------------------

def _ymd(d: date | str) -> str:
    return d if isinstance(d, str) else d.strftime("%Y%m%d")


def _url(path: str, params: list[tuple[str, object]], base: str) -> str:
    query = "&".join(f"{k}={v}" for k, v in params if v is not None)
    return f"{base}{path}?{query}"


def option_history_quote_url(symbol: str, day: date | str, *, expiration: str = "*", strike: str | None = None, right: str | None = None, interval: str = "5m", max_dte: int | None = None, strike_range: int | None = None, fmt: str | None = None, base: str = BASE) -> str:
    return _url("/v3/option/history/quote", [("symbol", symbol), ("expiration", expiration), ("strike", strike), ("right", right), ("date", _ymd(day)), ("interval", interval), ("max_dte", max_dte), ("strike_range", strike_range), ("format", fmt)], base)


def option_history_open_interest_url(symbol: str, day: date | str, *, expiration: str = "*", strike: str | None = None, right: str | None = None, max_dte: int | None = None, strike_range: int | None = None, fmt: str | None = None, base: str = BASE) -> str:
    return _url("/v3/option/history/open_interest", [("symbol", symbol), ("expiration", expiration), ("strike", strike), ("right", right), ("date", _ymd(day)), ("max_dte", max_dte), ("strike_range", strike_range), ("format", fmt)], base)


def option_history_trade_url(symbol: str, day: date | str, *, expiration: str = "*", strike: str | None = None, right: str | None = None, max_dte: int | None = None, strike_range: int | None = None, fmt: str | None = None, base: str = BASE) -> str:
    return _url("/v3/option/history/trade", [("symbol", symbol), ("expiration", expiration), ("strike", strike), ("right", right), ("date", _ymd(day)), ("max_dte", max_dte), ("strike_range", strike_range), ("format", fmt)], base)


def option_snapshot_quote_url(symbol: str, *, expiration: str = "*", strike: str | None = None, right: str | None = None, max_dte: int | None = None, strike_range: int | None = None, fmt: str | None = None, base: str = BASE) -> str:
    return _url("/v3/option/snapshot/quote", [("symbol", symbol), ("expiration", expiration), ("strike", strike), ("right", right), ("max_dte", max_dte), ("strike_range", strike_range), ("format", fmt)], base)


def stock_history_ohlc_url(symbol: str, day: date | str, *, interval: str = "1m", venue: str | None = None, fmt: str | None = None, base: str = BASE) -> str:
    return _url("/v3/stock/history/ohlc", [("symbol", symbol), ("date", _ymd(day)), ("interval", interval), ("venue", venue), ("format", fmt)], base)


def stock_history_quote_url(symbol: str, day: date | str, *, interval: str = "1m", venue: str | None = None, fmt: str | None = None, base: str = BASE) -> str:
    return _url("/v3/stock/history/quote", [("symbol", symbol), ("date", _ymd(day)), ("interval", interval), ("venue", venue), ("format", fmt)], base)


def stock_snapshot_quote_url(symbol: str, *, venue: str | None = None, fmt: str | None = None, base: str = BASE) -> str:
    return _url("/v3/stock/snapshot/quote", [("symbol", symbol), ("venue", venue), ("format", fmt)], base)


def option_list_expirations_url(symbol: str, *, fmt: str | None = None, base: str = BASE) -> str:
    return _url("/v3/option/list/expirations", [("symbol", symbol), ("format", fmt)], base)


# ---- the answers -------------------------------------------------------------------------------

def fetch_text(url: str, timeout: float = 120) -> str:
    """One GET against the terminal. Their error codes come back as ThetaError; NO_DATA too."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:  # noqa: S310 - localhost, our own terminal
            return r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        raise ThetaError(e.code, e.read().decode("utf-8", "replace"), url) from e


def parse_csv(text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(text)))


def to_utc(stamp: str) -> datetime:
    """Their YYYY-MM-DDTHH:mm:ss.SSS, taken as New York time (see the header), as a UTC instant."""
    return datetime.fromisoformat(stamp).replace(tzinfo=NEW_YORK).astimezone(timezone.utc)


def option_quotes_table(rows: Iterable[Mapping[str, str]]) -> pa.Table:
    """Their option quote rows (history or snapshot) as the tape's quotes table."""
    ts, exp, strike, right, bid, ask, bid_size, ask_size = [], [], [], [], [], [], [], []
    for r in rows:
        ts.append(to_utc(r["timestamp"]))
        exp.append(date.fromisoformat(r["expiration"]))
        strike.append(float(r["strike"]))
        right.append(RIGHT[r["right"]])
        bid.append(float(r["bid"]))
        ask.append(float(r["ask"]))
        bid_size.append(int(float(r["bid_size"])))
        ask_size.append(int(float(r["ask_size"])))
    return pa.table({"timestamp": ts, "expiration": exp, "strike": strike, "right": right, "bid": bid, "ask": ask, "bid_size": bid_size, "ask_size": ask_size}, schema=tape.QUOTES)


def open_interest_table(rows: Iterable[Mapping[str, str]]) -> pa.Table:
    exp, strike, right, oi = [], [], [], []
    for r in rows:
        exp.append(date.fromisoformat(r["expiration"]))
        strike.append(float(r["strike"]))
        right.append(RIGHT[r["right"]])
        oi.append(int(float(r["open_interest"])))
    return pa.table({"expiration": exp, "strike": strike, "right": right, "open_interest": oi}, schema=tape.OPEN_INTEREST)


def bars_table(rows: Iterable[Mapping[str, str]]) -> pa.Table:
    ts, o, h, l, c, v, n, w = [], [], [], [], [], [], [], []
    for r in rows:
        ts.append(to_utc(r["timestamp"]))
        o.append(float(r["open"]))
        h.append(float(r["high"]))
        l.append(float(r["low"]))
        c.append(float(r["close"]))
        v.append(int(float(r["volume"])))
        n.append(int(float(r["count"])))
        w.append(float(r["vwap"]))
    return pa.table({"timestamp": ts, "open": o, "high": h, "low": l, "close": c, "volume": v, "count": n, "vwap": w}, schema=tape.BARS)


# ---- the pull: one symbol, one session day, onto the tape ----------------------------------------

@dataclass(frozen=True)
class PullSpec:
    """What one tape version asks ThetaData for. Written into the manifest, never changed inside a version."""

    interval: str = "5m"  # the scan's own cadence
    max_dte: int | None = 95  # the ledger's calendar reaches 91 days
    strike_range: int | None = 40  # the ladder's whole book is 30 a side
    bar_interval: str = "1m"
    venue: str | None = None  # nqb by default on their side


def pull_day(symbol: str, day: date, root, version: str, spec: PullSpec = PullSpec(), *, base: str = BASE, fetch: Callable[[str], str] = fetch_text) -> tape.DayPaths:
    """
    Three requests, three tables, one day directory. A day already on the tape
    is refused (tape.write_day): the tape is immutable, a re-pull is a new version.
    NO_DATA on the quotes is an error (a session with no chain is not a session);
    NO_DATA on open interest or bars writes an empty table and the reader says so.
    """
    quotes = option_quotes_table(parse_csv(fetch(option_history_quote_url(symbol, day, interval=spec.interval, max_dte=spec.max_dte, strike_range=spec.strike_range, base=base))))

    def tolerant(url: str, table_of: Callable[[list[dict[str, str]]], pa.Table], schema: pa.Schema) -> pa.Table:
        try:
            return table_of(parse_csv(fetch(url)))
        except ThetaError as e:
            if e.status == NO_DATA:
                return schema.empty_table()
            raise

    oi = tolerant(option_history_open_interest_url(symbol, day, max_dte=spec.max_dte, strike_range=spec.strike_range, base=base), open_interest_table, tape.OPEN_INTEREST)
    bars = tolerant(stock_history_ohlc_url(symbol, day, interval=spec.bar_interval, venue=spec.venue, base=base), bars_table, tape.BARS)
    return tape.write_day(root, version, symbol, day, quotes, oi, bars)
