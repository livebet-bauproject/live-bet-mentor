import os
import sys
import site
import time
import json
import logging
import threading
import urllib.request
import concurrent.futures
from collections import deque

# Ensure user site-packages are accessible
try:
    user_site = site.getusersitepackages()
    if user_site and user_site not in sys.path:
        sys.path.insert(0, user_site)
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'sofascore_live.json')
STATS_DIR = os.path.join(BASE_DIR, 'stats')
ODDS_FILE = os.path.join(BASE_DIR, 'live_odds.json')
REQUEST_QUEUE = os.path.join(BASE_DIR, 'stats_request.json')
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

LOG_FILE = os.path.join(BASE_DIR, 'scraper.log')
STATUS_FILE = os.path.join(BASE_DIR, 'cloud_fetcher_status.json')

if not os.path.exists(STATS_DIR):
    os.makedirs(STATS_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] [CLOUD_FETCHER] %(message)s',
    datefmt='%H:%M:%S',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8', mode='a'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("CloudFetcher")

try:
    from curl_cffi import requests as cffi_requests
    HAS_CURL_CFFI = True
    logger.info("curl_cffi is available. Using Chrome 120 TLS impersonation.")
except ImportError:
    logger.error("curl_cffi NOT found! Cannot bypass SofaScore Cloudflare without curl_cffi. Exiting...")
    sys.exit(1)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.sofascore.com/",
    "Origin": "https://www.sofascore.com"
}

PROXY_SOURCES = [
    "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=3000&country=all&ssl=yes&anonymity=elite",
    "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
    "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt"
]

def atomic_write_json(filepath, data):
    temp_path = f"{filepath}.tmp"
    try:
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        os.replace(temp_path, filepath)
        return True
    except Exception as e:
        logger.error(f"Error saving {filepath}: {e}")
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
        return False

class ParallelProxyManager:
    """Manages an active, pre-validated pool of elite proxies for SofaScore."""
    def __init__(self):
        self.lock = threading.Lock()
        self.verified_pool = deque()
        self.tested_dead = set()
        self.current_proxy = None
        self.active_session = None
        self.direct_mode = False
        self.direct_checked = False
        self.last_pool_refresh = 0
        self.is_refreshing = False
        self.status = {
            "mode": "initializing",
            "active_proxy": None,
            "verified_pool_count": 0,
            "last_success": None,
            "last_events_count": 0,
            "errors_on_current": 0
        }
        self.save_status()

    def save_status(self):
        self.status["verified_pool_count"] = len(self.verified_pool)
        self.status["active_proxy"] = self.current_proxy
        atomic_write_json(STATUS_FILE, self.status)

    def check_proxy_single(self, proxy_str):
        """Quickly tests if a proxy can query SofaScore live API."""
        if not proxy_str or proxy_str in self.tested_dead:
            return None
        protocol = "socks5" if proxy_str.startswith("socks5://") else "http"
        clean_addr = proxy_str.replace("socks5://", "").replace("http://", "").strip()
        proxy_url = f"{protocol}://{clean_addr}"

        try:
            s = cffi_requests.Session(
                impersonate="chrome120",
                proxies={"http": proxy_url, "https": proxy_url}
            )
            r = s.get("https://api.sofascore.com/api/v1/sport/football/events/live", headers=HEADERS, timeout=4.5)
            if r.status_code == 200 and 'events' in r.text:
                return proxy_str
        except Exception:
            pass
        self.tested_dead.add(proxy_str)
        return None

    def refresh_proxy_pool(self, max_candidates=150):
        """Scrapes candidate proxies and validates them concurrently."""
        with self.lock:
            if self.is_refreshing:
                return
            self.is_refreshing = True

        try:
            candidates = set()
            for src in PROXY_SOURCES:
                try:
                    req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        lines = resp.read().decode('utf-8', errors='ignore').splitlines()
                        for line in lines:
                            p = line.strip()
                            if ':' in p and not p.startswith('#'):
                                if src.endswith('socks5.txt') or 'socks5' in src:
                                    candidates.add(f"socks5://{p}")
                                else:
                                    candidates.add(p)
                except Exception as e:
                    logger.debug(f"Source fetch error {src}: {e}")

            logger.info(f"Gathered {len(candidates)} raw proxy candidates. Validating top {max_candidates}...")
            to_test = [c for c in list(candidates) if c not in self.tested_dead][:max_candidates]

            found = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
                futures = {executor.submit(self.check_proxy_single, p): p for p in to_test}
                for f in concurrent.futures.as_completed(futures):
                    res = f.result()
                    if res:
                        found.append(res)
                        with self.lock:
                            if res not in self.verified_pool and res != self.current_proxy:
                                self.verified_pool.append(res)
                        logger.info(f"[POOL] Validated working proxy: {res} (Pool size: {len(self.verified_pool)})")
                        if len(self.verified_pool) >= 10:
                            break

            self.last_pool_refresh = time.time()
            self.save_status()
        finally:
            with self.lock:
                self.is_refreshing = False

    def test_direct_connection(self):
        """Tests if direct connection is unblocked (e.g. residential local IP)."""
        try:
            s = cffi_requests.Session(impersonate="chrome120")
            r = s.get("https://api.sofascore.com/api/v1/sport/football/events/live", headers=HEADERS, timeout=5)
            if r.status_code == 200 and 'events' in r.text:
                logger.info("Direct connection to SofaScore SUCCESS (No proxy required).")
                self.direct_mode = True
                self.status["mode"] = "direct"
                self.current_proxy = "DIRECT"
                self.active_session = s
                self.save_status()
                return True
        except Exception:
            pass
        self.direct_mode = False
        return False

    def get_session(self):
        """Returns the current healthy session, auto-rotating if needed."""
        if not self.direct_checked:
            self.direct_checked = True
            if self.test_direct_connection():
                return self.active_session

        if self.direct_mode and self.active_session:
            return self.active_session

        if self.active_session and self.current_proxy:
            return self.active_session

        # Needs a working proxy
        with self.lock:
            if self.verified_pool:
                self.current_proxy = self.verified_pool.popleft()
                protocol = "socks5" if self.current_proxy.startswith("socks5://") else "http"
                clean_addr = self.current_proxy.replace("socks5://", "").replace("http://", "").strip()
                p_url = f"{protocol}://{clean_addr}"
                self.active_session = cffi_requests.Session(
                    impersonate="chrome120",
                    proxies={"http": p_url, "https": p_url}
                )
                self.status["mode"] = "proxy"
                self.status["active_proxy"] = self.current_proxy
                self.status["errors_on_current"] = 0
                self.save_status()
                logger.info(f"Switched active session to verified proxy: {self.current_proxy}")
                return self.active_session

        # No proxy in pool, trigger synchronous quick discovery
        logger.warning("No verified proxy available in pool! Triggering immediate discovery...")
        self.refresh_proxy_pool(max_candidates=100)

        with self.lock:
            if self.verified_pool:
                self.current_proxy = self.verified_pool.popleft()
                protocol = "socks5" if self.current_proxy.startswith("socks5://") else "http"
                clean_addr = self.current_proxy.replace("socks5://", "").replace("http://", "").strip()
                p_url = f"{protocol}://{clean_addr}"
                self.active_session = cffi_requests.Session(
                    impersonate="chrome120",
                    proxies={"http": p_url, "https": p_url}
                )
                self.status["mode"] = "proxy"
                self.status["active_proxy"] = self.current_proxy
                self.save_status()
                return self.active_session

        return None

    def report_error(self):
        """Reports a failure on the current proxy and triggers zero-delay rotation."""
        if self.direct_mode:
            logger.warning("Direct connection failed. Switching to proxy pool mode...")
            self.direct_mode = False
            self.active_session = None
            return

        self.status["errors_on_current"] = self.status.get("errors_on_current", 0) + 1
        if self.status["errors_on_current"] >= 2:
            logger.warning(f"Proxy {self.current_proxy} failed repeatedly. Discarding and rotating...")
            if self.current_proxy:
                self.tested_dead.add(self.current_proxy)
            self.current_proxy = None
            self.active_session = None

        # If pool is running low, trigger background top-up
        if len(self.verified_pool) < 4 and not self.is_refreshing:
            threading.Thread(target=self.refresh_proxy_pool, kwargs={"max_candidates": 100}, daemon=True).start()

    def report_success(self, events_count):
        self.status["errors_on_current"] = 0
        self.status["last_success"] = time.strftime("%Y-%m-%d %H:%M:%S")
        self.status["last_events_count"] = events_count
        self.save_status()

# Initialize global proxy manager
proxy_mgr = ParallelProxyManager()

def parse_odds_value(choice):
    """Parses decimal or fractional odds (e.g. '1/10' -> 1.10, '16/5' -> 4.20) into a float."""
    if not choice or not isinstance(choice, dict):
        return None
    for k in ('decimalValue', 'value'):
        val = choice.get(k)
        if val is not None:
            try:
                v = float(val)
                if v > 0:
                    return v
            except:
                pass
    frac = choice.get('fractionalValue') or choice.get('initialFractionalValue')
    if frac:
        try:
            parts = str(frac).strip().split('/')
            if len(parts) == 2:
                num = float(parts[0])
                den = float(parts[1])
                if den > 0:
                    return round((num / den) + 1.0, 2)
            else:
                v = float(frac)
                if v > 0:
                    return v
        except:
            pass
    return None

def update_central_odds(match_id, odds_data):
    try:
        current_odds = {}
        if os.path.exists(ODDS_FILE):
            try:
                with open(ODDS_FILE, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                    if content:
                        current_odds = json.loads(content)
            except Exception:
                current_odds = {}

        choices = odds_data.get('odds', [])
        if not choices and 'markets' in odds_data:
            for m in odds_data.get('markets', []):
                m_name = (m.get('marketName') or '').lower()
                if m.get('id') == 1 or m.get('marketId') == 1 or 'full' in m_name or m.get('marketGroup') == '1X2':
                    choices = m.get('choices', [])
                    break

        if len(choices) >= 3:
            home_val = parse_odds_value(choices[0])
            draw_val = parse_odds_value(choices[1])
            away_val = parse_odds_value(choices[2])

            if home_val or draw_val or away_val:
                current_odds[str(match_id)] = {
                    'home': home_val,
                    'draw': draw_val,
                    'away': away_val,
                    'timestamp': time.time()
                }
                atomic_write_json(ODDS_FILE, current_odds)
    except Exception as e:
        logger.warning(f"[ODDS] Update failed for {match_id}: {e}")

def fetch_live_events():
    for attempt in range(3):
        session = proxy_mgr.get_session()
        if not session:
            logger.warning("Waiting for available session...")
            time.sleep(3)
            continue

        url = f"https://api.sofascore.com/api/v1/sport/football/events/live?_={int(time.time())}"
        try:
            resp = session.get(url, headers=HEADERS, timeout=6.5)
            if resp.status_code == 200:
                data = resp.json()
                raw_events = data.get('events', [])
                now_ts = time.time()
                # Anti-ghost filter: remove matches started > 3.5h ago or marked finished
                events = []
                for e in raw_events:
                    start_ts = e.get('startTimestamp') or now_ts
                    if (now_ts - start_ts) > 3.5 * 3600:
                        continue
                    st = (e.get('status', {}).get('type') or '').lower()
                    desc = (e.get('status', {}).get('description') or '').lower()
                    if st == 'finished' or 'ended' in desc or 'bitti' in desc:
                        continue
                    events.append(e)
                data['events'] = events
                atomic_write_json(DATA_FILE, data)
                proxy_mgr.report_success(len(events))
                logger.info(f"[OK] Live events updated: {len(events)} genuine live matches found (via {proxy_mgr.current_proxy})")
                return events
            else:
                logger.warning(f"Live fetch returned HTTP {resp.status_code} on {proxy_mgr.current_proxy}")
                proxy_mgr.report_error()
        except Exception as e:
            logger.warning(f"Live fetch error on {proxy_mgr.current_proxy}: {e}")
            proxy_mgr.report_error()

    return None

def fetch_match_details_and_stats(match_id):
    session = proxy_mgr.get_session()
    if not session:
        return False

    detail_saved = False
    stats_saved = False

    # 1. Detail
    try:
        url = f"https://api.sofascore.com/api/v1/event/{match_id}?_={int(time.time())}"
        resp = session.get(url, headers=HEADERS, timeout=5)
        if resp.status_code == 200:
            detail_data = resp.json()
            if 'event' in detail_data:
                atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_detail.json"), detail_data)
                detail_saved = True
        elif resp.status_code == 404:
            atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_detail.json"), {"error": {"code": 404}})
    except Exception as e:
        logger.debug(f"Detail fetch notice for {match_id}: {e}")

    # 2. Statistics
    try:
        url = f"https://api.sofascore.com/api/v1/event/{match_id}/statistics?_={int(time.time())}"
        resp = session.get(url, headers=HEADERS, timeout=5)
        if resp.status_code == 200:
            stats_data = resp.json()
            if 'statistics' in stats_data:
                atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_stats.json"), stats_data)
                stats_saved = True
        elif resp.status_code == 404:
            atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_stats.json"), {"error": {"code": 404}})
    except Exception as e:
        logger.debug(f"Stats fetch notice for {match_id}: {e}")

    # 3. Odds
    try:
        url = f"https://api.sofascore.com/api/v1/event/{match_id}/odds/1/all?_={int(time.time())}"
        resp = session.get(url, headers=HEADERS, timeout=4)
        if resp.status_code == 200:
            odds_data = resp.json()
            if 'odds' in odds_data or 'markets' in odds_data or 'choices' in odds_data:
                atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_odds.json"), odds_data)
                update_central_odds(match_id, odds_data)
    except Exception:
        pass

    # 4. Attack Momentum Graph
    try:
        url = f"https://api.sofascore.com/api/v1/event/{match_id}/graph?_={int(time.time())}"
        resp = session.get(url, headers=HEADERS, timeout=4)
        if resp.status_code == 200:
            graph_data = resp.json()
            if 'graphPoints' in graph_data or 'graphPointsV2' in graph_data:
                atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_graph.json"), graph_data)
        elif resp.status_code == 404:
            atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_graph.json"), {"graphPoints": [], "noGraph": True})
    except Exception as e:
        logger.debug(f"Graph fetch notice for {match_id}: {e}")

    # 5. Match Incidents & Events Timeline
    try:
        url = f"https://api.sofascore.com/api/v1/event/{match_id}/incidents?_={int(time.time())}"
        resp = session.get(url, headers=HEADERS, timeout=4)
        if resp.status_code == 200:
            incidents_data = resp.json()
            if 'incidents' in incidents_data:
                atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_incidents.json"), incidents_data)
        elif resp.status_code == 404:
            atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_incidents.json"), {"incidents": [], "noIncidents": True})
    except Exception as e:
        logger.debug(f"Incidents fetch notice for {match_id}: {e}")

    return detail_saved or stats_saved

def process_queue():
    if not os.path.exists(REQUEST_QUEUE):
        return

    queued_ids = []
    try:
        with open(REQUEST_QUEUE, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            if content:
                data = json.loads(content)
                queued_ids = data.get('ids', [])
    except Exception:
        return

    if not queued_ids:
        return

    batch = queued_ids[:5]
    remaining = queued_ids[5:]
    try:
        with open(REQUEST_QUEUE, 'w', encoding='utf-8') as f:
            json.dump({'ids': remaining}, f)
    except Exception:
        pass

    logger.info(f"Processing {len(batch)} queued match request(s): {batch}")
    for mid in batch:
        fetch_match_details_and_stats(mid)
        time.sleep(0.2)

def background_pool_keeper():
    """Keeps the proxy pool populated and healthy in the background 24/7."""
    while True:
        try:
            # Refresh if pool is low or every 3 minutes
            if not proxy_mgr.direct_mode:
                if len(proxy_mgr.verified_pool) < 5 or (time.time() - proxy_mgr.last_pool_refresh > 180):
                    proxy_mgr.refresh_proxy_pool(max_candidates=150)
        except Exception as e:
            logger.debug(f"Pool keeper notice: {e}")
        time.sleep(30)

def background_queue_worker():
    """Processes user on-demand requests (stats, detail, graph) rapidly every 1.5 seconds."""
    while True:
        try:
            process_queue()
        except Exception as e:
            logger.debug(f"Queue worker notice: {e}")
        time.sleep(1.5)

def run_loop():
    logger.info("==================================================")
    logger.info("   Starting Autonomous 24/7 Cloud SofaScore Fetcher")
    logger.info("==================================================")

    # 1. Check direct connection first
    if not proxy_mgr.test_direct_connection():
        logger.info("Direct connection unavailable. Starting proxy pool pre-warming...")
        proxy_mgr.refresh_proxy_pool(max_candidates=120)

    # 2. Start background proxy maintenance thread
    keeper_thread = threading.Thread(target=background_pool_keeper, daemon=True)
    keeper_thread.start()

    # 3. Start rapid queue worker thread (on-demand click processing)
    queue_thread = threading.Thread(target=background_queue_worker, daemon=True)
    queue_thread.start()

    match_index = 0
    BATCH_SIZE = 8

    while True:
        try:
            events = fetch_live_events()
            if events is None:
                logger.warning("No events returned on this cycle. Retrying in 5 seconds...")
                time.sleep(5)
                continue

            process_queue()

            in_progress = [
                e for e in events
                if e.get('status', {}).get('type') == 'inprogress'
                and (e.get('tournament', {}).get('category', {}).get('sport', {}).get('id') == 1 or not e.get('tournament', {}).get('category', {}).get('sport', {}).get('id'))
            ]

            if in_progress:
                total = len(in_progress)
                start = match_index % total
                end = min(start + BATCH_SIZE, total)
                batch = in_progress[start:end]
                match_index = (match_index + BATCH_SIZE) % total

                for ev in batch:
                    mid = ev.get('id')
                    if mid:
                        fetch_match_details_and_stats(mid)
                        time.sleep(0.3)

            # Cycle interval: 15 seconds for live matches
            time.sleep(15)

        except KeyboardInterrupt:
            logger.info("Cloud fetcher stopped by user.")
            break
        except Exception as e:
            logger.error(f"Unexpected error in cloud fetcher loop: {e}", exc_info=True)
            time.sleep(8)

if __name__ == "__main__":
    run_loop()
