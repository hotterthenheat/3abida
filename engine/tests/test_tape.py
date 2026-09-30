"""
THE TAPE AND THE THETADATA SEAM. The tape is written once and read as a filter;
the request URLs are held to the examples on ThetaData's own pages, read
2026-09-17; the parsers are tried on rows in the documented column order.
"""

from datetime import date, datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

import numpy as np
import pyarrow as pa
import pytest

from slayer_core import tape, theta
from slayer_core.tape import BARS, OPEN_INTEREST, QUOTES, Manifest, TapeError

SESSION = date(2026, 9, 17)
T0 = datetime(2026, 9, 17, 14, 30, tzinfo=timezone.utc)
T1 = T0 + timedelta(minutes=5)
EXP_A = date(2026, 9, 18)
EXP_B = date(2026, 10, 16)


def a_day():
    q = {k: [] for k in QUOTES.names}
    for stamp in (T0, T1):
        for exp in (EXP_A, EXP_B):
            for k in (99.0, 100.0, 101.0):
                for right in ("P", "C"):
                    if exp == EXP_B and k == 101.0 and right == "P":
                        continue  # one side missing on purpose
                    q["timestamp"].append(stamp)
                    q["expiration"].append(exp)
                    q["strike"].append(k)
                    q["right"].append(right)
                    q["bid"].append(1.0 + (0.1 if stamp == T1 else 0.0))
                    q["ask"].append(1.1 + (0.1 if stamp == T1 else 0.0))
                    q["bid_size"].append(5)
                    q["ask_size"].append(7)
    oi = pa.table({"expiration": [EXP_A, EXP_A, EXP_B], "strike": [99.0, 100.0, 100.0], "right": ["P", "C", "C"], "open_interest": [100, 200, 300]}, schema=OPEN_INTEREST)
    bars = pa.table({"timestamp": [T0 - timedelta(minutes=1), T1 - timedelta(minutes=1)], "open": [100.0, 100.5], "high": [100.2, 100.9], "low": [99.8, 100.4], "close": [100.1, 100.7], "volume": [1000, 1200], "count": [30, 40], "vwap": [100.05, 100.6]}, schema=BARS)
    return pa.table(q, schema=QUOTES), oi, bars


def test_write_once_read_as_a_filter(tmp_path):
    quotes, oi, bars = a_day()
    paths = tape.write_day(tmp_path, "v1", "test", SESSION, quotes, oi, bars)
    assert paths.quotes.exists() and paths.open_interest.exists() and paths.underlying.exists()
    assert tape.frame_times(tmp_path, "v1", "TEST", SESSION) == [T0, T1]
    late = tape.read_frame(tmp_path, "v1", "TEST", T1 + timedelta(minutes=1))
    assert late.stamp == T1 and late.spot == 100.7 and late.bar_stamp == T1 - timedelta(minutes=1)
    assert late.quotes.num_rows == 11
    early = tape.read_frame(tmp_path, "v1", "TEST", T0 + timedelta(minutes=2))
    assert early.stamp == T0 and early.spot == 100.1
    with pytest.raises(TapeError):
        tape.read_frame(tmp_path, "v1", "TEST", T0 - timedelta(hours=1))
    with pytest.raises(TapeError):
        tape.write_day(tmp_path, "v1", "TEST", SESSION, quotes, oi, bars)
    closes = tape.bars_until(tmp_path, "v1", "TEST", T1)
    assert closes.tolist() == [100.1, 100.7]


def test_frame_groups_by_expiry_with_sides_aligned(tmp_path):
    quotes, oi, bars = a_day()
    tape.write_day(tmp_path, "v1", "TEST", SESSION, quotes, oi, bars)
    frame = tape.read_frame(tmp_path, "v1", "TEST", T1)
    exps = frame.expiries()
    assert [e.expiration for e in exps] == [EXP_A, EXP_B]
    a, b = exps
    assert a.dte == 1 and a.sessions == 1 and b.sessions == tape.sessions_between(SESSION, EXP_B)
    assert a.strikes.tolist() == [99.0, 100.0, 101.0]
    assert a.put_oi.tolist() == [100.0, 0.0, 0.0] and a.call_oi.tolist() == [0.0, 200.0, 0.0]
    assert np.isnan(b.put_bid[2]) and np.isfinite(b.call_bid[2])  # the missing side
    assert b.call_oi.tolist() == [0.0, 300.0, 0.0]
    assert abs(a.put_ask[0] - 1.2) < 1e-12


def test_manifest_and_daily_series(tmp_path):
    m = Manifest("v1", "2026-09-17T20:00:00Z", "thetadata v3", "5m", 95, 40, "1m", ["SPY"], note="the first pull")
    tape.write_manifest(tmp_path, m)
    assert tape.read_manifest(tmp_path, "v1") == m
    with pytest.raises(TapeError):
        tape.write_manifest(tmp_path, m)
    tape.append_daily(tmp_path, "v1", "SPY", date(2026, 9, 15), 15.2, 500.0)
    tape.append_daily(tmp_path, "v1", "SPY", date(2026, 9, 16), 15.9, 501.0)
    with pytest.raises(TapeError):
        tape.append_daily(tmp_path, "v1", "SPY", date(2026, 9, 16), 16.0, 502.0)
    assert tape.read_daily(tmp_path, "v1", "SPY")["base_iv_pct"].to_pylist() == [15.2, 15.9]
    assert tape.read_daily(tmp_path, "v1", "SPY", before=date(2026, 9, 16))["base_iv_pct"].to_pylist() == [15.2]
    assert tape.read_daily(tmp_path, "v1", "QQQ").num_rows == 0


def test_session_of_needs_a_zone():
    with pytest.raises(TapeError):
        tape.session_of(datetime(2026, 9, 17, 14, 30))
    assert tape.session_of(datetime(2026, 9, 18, 2, 0, tzinfo=timezone.utc)) == date(2026, 9, 17)  # 22:00 New York


# ---- the ThetaData seam --------------------------------------------------------------------------

def same(url: str, documented: str) -> bool:
    a, b = urlsplit(url), urlsplit(documented)
    return (a.scheme, a.netloc, a.path) == (b.scheme, b.netloc, b.path) and parse_qs(a.query) == parse_qs(b.query)


def test_urls_match_the_documented_examples():
    assert same(theta.option_history_quote_url("AAPL", "20241104", interval="1m"), "http://127.0.0.1:25503/v3/option/history/quote?symbol=AAPL&expiration=*&date=20241104&interval=1m")
    assert same(
        theta.option_history_quote_url("AAPL", "20241104", expiration="20241108", strike="220.000", right="call", interval="1m"),
        "http://127.0.0.1:25503/v3/option/history/quote?symbol=AAPL&expiration=20241108&strike=220.000&right=call&date=20241104&interval=1m",
    )
    assert same(theta.option_history_open_interest_url("AAPL", "20241104"), "http://127.0.0.1:25503/v3/option/history/open_interest?symbol=AAPL&expiration=*&date=20241104")
    assert same(theta.option_history_trade_url("AAPL", "20241104"), "http://127.0.0.1:25503/v3/option/history/trade?symbol=AAPL&expiration=*&date=20241104")
    assert same(theta.option_snapshot_quote_url("AAPL"), "http://127.0.0.1:25503/v3/option/snapshot/quote?symbol=AAPL&expiration=*")
    assert same(theta.option_snapshot_quote_url("AAPL", expiration="20270115", right="call", strike="270.000"), "http://127.0.0.1:25503/v3/option/snapshot/quote?symbol=AAPL&expiration=20270115&right=call&strike=270.000")
    assert same(theta.stock_history_ohlc_url("AAPL", "20240102", interval="1m"), "http://127.0.0.1:25503/v3/stock/history/ohlc?symbol=AAPL&date=20240102&interval=1m")
    assert same(theta.stock_history_quote_url("AAPL", "20240102", interval="1m"), "http://127.0.0.1:25503/v3/stock/history/quote?symbol=AAPL&date=20240102&interval=1m")
    assert same(theta.stock_snapshot_quote_url("AAPL", venue="nqb"), "http://127.0.0.1:25503/v3/stock/snapshot/quote?symbol=AAPL&venue=nqb")
    assert same(theta.option_list_expirations_url("AAPL"), "http://127.0.0.1:25503/v3/option/list/expirations?symbol=AAPL")
    assert same(theta.option_history_quote_url("SPY", date(2026, 9, 17), max_dte=95, strike_range=40), "http://127.0.0.1:25503/v3/option/history/quote?symbol=SPY&expiration=*&date=20260917&interval=5m&max_dte=95&strike_range=40")


QUOTE_CSV = """symbol,expiration,strike,right,timestamp,bid_size,bid_exchange,bid,bid_condition,ask_size,ask_exchange,ask,ask_condition
AAPL,2024-11-08,220.000,call,2024-11-04T09:30:00.000,10,5,3.10,0,12,5,3.20,0
AAPL,2024-11-08,220.000,put,2024-11-04T09:30:00.000,8,5,1.05,0,9,5,1.15,0
"""
OI_CSV = """symbol,expiration,strike,right,timestamp,open_interest
AAPL,2024-11-08,220.000,call,2024-11-04T06:30:00.000,15234
"""
OHLC_CSV = """timestamp,open,high,low,close,volume,count,vwap
2024-11-04T09:30:00.000,222.10,222.40,221.90,222.30,15000,120,222.2
2024-11-04T09:31:00.000,222.30,222.60,222.20,222.55,9000,80,222.4
"""


def test_parsers_take_the_documented_columns():
    q = theta.option_quotes_table(theta.parse_csv(QUOTE_CSV))
    assert q.schema == QUOTES and q.num_rows == 2
    assert q["right"].to_pylist() == ["C", "P"] and q["strike"].to_pylist() == [220.0, 220.0]
    assert q["timestamp"][0].as_py() == datetime(2024, 11, 4, 14, 30, tzinfo=timezone.utc)  # 09:30 New York, standard time
    oi = theta.open_interest_table(theta.parse_csv(OI_CSV))
    assert oi.schema == OPEN_INTEREST and oi["open_interest"].to_pylist() == [15234]
    bars = theta.bars_table(theta.parse_csv(OHLC_CSV))
    assert bars.schema == BARS and bars["close"].to_pylist() == [222.3, 222.55] and bars["volume"].to_pylist() == [15000, 9000]
    assert bars["count"].to_pylist() == [120, 80] and bars["vwap"].to_pylist() == [222.2, 222.4]


def test_pull_day_writes_the_three_tables_and_tolerates_no_data(tmp_path):
    seen = []

    def fetch(url: str) -> str:
        seen.append(url)
        if "/option/history/quote" in url:
            return QUOTE_CSV
        if "/option/history/open_interest" in url:
            raise theta.ThetaError(theta.NO_DATA, "No data", url)
        if "/stock/history/ohlc" in url:
            return OHLC_CSV
        raise AssertionError(url)

    paths = theta.pull_day("AAPL", date(2024, 11, 4), tmp_path, "v1", fetch=fetch)
    assert len(seen) == 3 and paths.open_interest.exists()
    frame = tape.read_frame(tmp_path, "v1", "AAPL", datetime(2024, 11, 4, 14, 35, tzinfo=timezone.utc))
    assert frame.open_interest.num_rows == 0 and frame.spot == 222.55
    (x,) = frame.expiries()
    assert x.call_oi.tolist() == [0.0] and x.call_bid.tolist() == [3.1]
    with pytest.raises(TapeError):
        theta.pull_day("AAPL", date(2024, 11, 4), tmp_path, "v1", fetch=fetch)
