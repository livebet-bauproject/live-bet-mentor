import os
import sys
import site
import time
import json
import logging

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
LOG_FILE = os.path.join(BASE_DIR, 'scraper.log')

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

def create_session():
    if HAS_CURL_CFFI:
        return cffi_requests.Session(impersonate="chrome120")
    return cffi_requests.Session()

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
        except:
            pass
        return False

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
                if m.get('id') == 1 or 'full' in (m.get('marketName') or '').lower():
                    choices = m.get('choices', [])
                    break

        if len(choices) >= 3:
            home_val = choices[0].get('value') or choices[0].get('decimalValue')
            draw_val = choices[1].get('value') or choices[1].get('decimalValue')
            away_val = choices[2].get('value') or choices[2].get('decimalValue')

            current_odds[str(match_id)] = {
                'home': home_val,
                'draw': draw_val,
                'away': away_val,
                'timestamp': time.time()
            }
            atomic_write_json(ODDS_FILE, current_odds)
            logger.debug(f"[ODDS] Updated {match_id}: 1={home_val} X={draw_val} 2={away_val}")
    except Exception as e:
        logger.warning(f"[ODDS] Update failed for {match_id}: {e}")

def fetch_live_events(session):
    url = f"https://www.sofascore.com/api/v1/sport/football/events/live?_={int(time.time())}"
    try:
        resp = session.get(url, headers=HEADERS, timeout=12)
        if resp.status_code == 200:
            data = resp.json()
            events = data.get('events', [])
            atomic_write_json(DATA_FILE, data)
            logger.info(f"Live events updated: {len(events)} matches found")
            return events
        else:
            logger.warning(f"SofaScore live returned HTTP {resp.status_code}")
            return None
    except Exception as e:
        logger.error(f"Live events fetch error: {e}")
        return None

def fetch_match_details_and_stats(session, match_id):
    detail_saved = False
    stats_saved = False

    try:
        url = f"https://www.sofascore.com/api/v1/event/{match_id}?_={int(time.time())}"
        resp = session.get(url, headers=HEADERS, timeout=8)
        if resp.status_code == 200:
            detail_data = resp.json()
            if 'event' in detail_data:
                atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_detail.json"), detail_data)
                detail_saved = True
        elif resp.status_code == 404:
            atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_detail.json"), {"error": {"code": 404}})
    except Exception as e:
        logger.debug(f"Detail fetch error for {match_id}: {e}")

    try:
        url = f"https://www.sofascore.com/api/v1/event/{match_id}/statistics?_={int(time.time())}"
        resp = session.get(url, headers=HEADERS, timeout=8)
        if resp.status_code == 200:
            stats_data = resp.json()
            if 'statistics' in stats_data:
                atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_stats.json"), stats_data)
                stats_saved = True
        elif resp.status_code == 404:
            atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_stats.json"), {"error": {"code": 404}})
    except Exception as e:
        logger.debug(f"Stats fetch error for {match_id}: {e}")

    try:
        url = f"https://www.sofascore.com/api/v1/event/{match_id}/odds/1/3?_={int(time.time())}"
        resp = session.get(url, headers=HEADERS, timeout=6)
        if resp.status_code == 200:
            odds_data = resp.json()
            if 'odds' in odds_data or 'markets' in odds_data or 'choices' in odds_data:
                atomic_write_json(os.path.join(STATS_DIR, f"{match_id}_odds.json"), odds_data)
                update_central_odds(match_id, odds_data)
    except Exception:
        pass

    return detail_saved or stats_saved

def process_queue(session):
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
        fetch_match_details_and_stats(session, mid)
        time.sleep(0.3)

def run_loop():
    logger.info("Starting Cloud SofaScore Fetcher loop...")
    session = create_session()
    match_index = 0
    BATCH_SIZE = 8
    consecutive_errors = 0

    while True:
        try:
            events = fetch_live_events(session)
            if events is None:
                consecutive_errors += 1
                if consecutive_errors >= 3:
                    logger.warning("3 consecutive fetch errors. Refreshing session...")
                    session = create_session()
                    consecutive_errors = 0
                time.sleep(10)
                continue
            
            consecutive_errors = 0
            process_queue(session)

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
                        fetch_match_details_and_stats(session, mid)
                        time.sleep(0.35)

            time.sleep(15)

        except KeyboardInterrupt:
            logger.info("Stopped by user.")
            break
        except Exception as e:
            logger.error(f"Unexpected error in fetch loop: {e}", exc_info=True)
            time.sleep(10)

if __name__ == "__main__":
    run_loop()
