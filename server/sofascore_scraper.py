import time
import json
import os
import logging
import requests
import sys

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

# Centralized Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("server/scraper.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'sofascore_live.json')
ODDS_FILE = os.path.join(BASE_DIR, 'live_odds.json')
NETWORK_LOG_FILE = os.path.join(BASE_DIR, 'network_log.txt')
STATS_DIR = os.path.join(BASE_DIR, 'stats')
LIVE_FETCH_INTERVAL = 15  # Fetch live list every 15 seconds for fresher data
STATS_FETCH_INTERVAL = 30  # Auto-fetch stats for all live matches every 30 seconds
BATCH_SIZE = 10  # Number of matches to fetch stats for in each batch (to avoid rate limiting)

def update_central_odds(match_id, odds_data):
    """Synchronize match odds into a central file for the proxy/frontend."""
    try:
        current_odds = {}
        if os.path.exists(ODDS_FILE):
            with open(ODDS_FILE, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content:
                    try:
                        current_odds = json.loads(content)
                    except:
                        current_odds = {}
        
        # Structure the odds for the frontend (1-X-2)
        # Supports both odds_data['odds'] and odds_data['markets']
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
            
            with open(ODDS_FILE, 'w', encoding='utf-8') as f:
                json.dump(current_odds, f, indent=2)
            logger.debug(f"[ODDS] Updated {match_id} in {ODDS_FILE}")
    except Exception as e:
        logger.warning(f"[ODDS] Update failed for {match_id}: {e}")

# Configure performance logging (Modern way)
# caps = DesiredCapabilities.CHROME
# caps['goog:loggingPrefs'] = {'performance': 'ALL'}

def fetch_live_list_directly():
    """Fallback: Fetch live list directly via HTTP when network capture fails."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.sofascore.com/',
            'Origin': 'https://www.sofascore.com'
        }
        url = f'https://www.sofascore.com/api/v1/sport/football/events/live?_={int(time.time())}'
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if 'events' in data:
                with open(DATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f)
                
                # Firebase Upload
                try:
                    from firebase_uploader import upload_to_firebase
                    upload_to_firebase("live_events", data)
                except:
                    pass

                logger.info(f"[DIRECT] Captured LIVE_LIST via HTTP -> {DATA_FILE}")
                return True
    except Exception as e:
        logger.warning(f"[DIRECT] HTTP fallback failed: {e}")
    return False

def fetch_stats_via_js(driver, match_id):
    """Fallback: Fetch match statistics and details using browser's JS fetch (bypasses 403 & CDP issues)."""
    try:
        # 30 saniye timeout ile async script çalıştır
        driver.set_script_timeout(30)
        
        script = f"""
        var done = arguments[0];
        Promise.all([
            fetch('https://www.sofascore.com/api/v1/event/{match_id}/statistics').then(r => r.json()).catch(() => ({{}})),
            fetch('https://www.sofascore.com/api/v1/event/{match_id}').then(r => r.json()).catch(() => ({{}})),
            fetch('https://www.sofascore.com/api/v1/event/{match_id}/odds/1/3').then(r => r.json()).catch(() => ({{}}))
        ])
        .then(([stats, detail, odds]) => done({{status: 'success', stats: stats, detail: detail, odds: odds}}))
        .catch(err => done({{status: 'error', message: err.toString()}}));
        """
        
        result = driver.execute_async_script(script)
        
        if result and result.get('status') == 'success':
            captured_something = False
            
            # 1. Save Statistics
            stats_data = result.get('stats')
            if stats_data and ('statistics' in stats_data or 'error' in stats_data):
                stats_path = os.path.join(STATS_DIR, f"{match_id}_stats.json")
                with open(stats_path, 'w', encoding='utf-8') as f:
                    json.dump(stats_data, f)
                captured_something = True
                
                # Firebase Upload
                try:
                    from firebase_uploader import upload_to_firebase
                    upload_to_firebase(f"stats/{match_id}/stats", stats_data)
                except:
                    pass
            
            # 2. Save Details
            detail_data = result.get('detail')
            if detail_data and ('event' in detail_data or 'error' in detail_data):
                detail_path = os.path.join(STATS_DIR, f"{match_id}_detail.json")
                with open(detail_path, 'w', encoding='utf-8') as f:
                    json.dump(detail_data, f)
                captured_something = True
                
                # Firebase Upload
                try:
                    from firebase_uploader import upload_to_firebase
                    upload_to_firebase(f"stats/{match_id}/detail", detail_data)
                except:
                    pass

            # 3. Save Match Odds File & Update Central Odds
            odds_data = result.get('odds')
            if odds_data and ('odds' in odds_data or 'markets' in odds_data or 'choices' in odds_data):
                odds_path = os.path.join(STATS_DIR, f"{match_id}_odds.json")
                try:
                    with open(odds_path, 'w', encoding='utf-8') as f:
                        json.dump(odds_data, f)
                except Exception as oe:
                    logger.warning(f"Could not save {odds_path}: {oe}")
                update_central_odds(match_id, odds_data)
                captured_something = True
            
            if captured_something:
                logger.info(f"[JS-FETCH] Captured data for {match_id} (Stats: {'statistics' in (stats_data or {})})")
                return True
            else:
                logger.warning(f"[JS-FETCH] No valid data keys in response for {match_id}")
        else:
            logger.warning(f"[JS-FETCH] JS Error for {match_id}: {result.get('message')}")
            
    except Exception as e:
        logger.warning(f"[JS-FETCH] Execution failed for {match_id}: {e}")
    return False

def clean_chromedriver_cache():
    """Clean undetected_chromedriver cache to fix FileExistsError lock issues."""
    import shutil
    try:
        cache_dir = os.path.join(os.environ.get('APPDATA', ''), 'undetected_chromedriver')
        undetected_dir = os.path.join(cache_dir, 'undetected')
        if os.path.exists(undetected_dir):
            shutil.rmtree(undetected_dir, ignore_errors=True)
            logger.info("Cleaned chromedriver cache directory")
    except Exception as e:
        logger.warning(f"Failed to clean cache: {e}")

def get_scraper():
    """Get Chrome driver using patched ChromeDriver 152 with fallback."""
    from driver_helper import get_chromedriver_path
    driver_path = get_chromedriver_path()
    
    # Priority 1: Direct Selenium with patched ChromeDriver 152 (Fast, rock-solid, zero port conflicts)
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.service import Service
        from selenium.webdriver.chrome.options import Options
        
        options = Options()
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36')
        options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
        
        service = Service(executable_path=driver_path)
        logger.info("Launching SofaScore Browser via Patched ChromeDriver 152...")
        driver = webdriver.Chrome(service=service, options=options)
        return driver
    except Exception as e:
        logger.warning(f"Standard Selenium launch failed: {e}, trying undetected_chromedriver fallback...")

    # Priority 2: undetected_chromedriver fallback
    max_retries = 3
    for attempt in range(max_retries):
        try:
            options = uc.ChromeOptions()
            options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
            options.add_argument('--headless=new')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            
            logger.info(f"Launching SofaScore Browser (uc fallback attempt {attempt + 1})...")
            driver = uc.Chrome(options=options, driver_executable_path=driver_path, use_subprocess=True)
            return driver
        except Exception as e:
            logger.warning(f"SofaScore Driver Error (attempt {attempt + 1}): {e}")
            clean_chromedriver_cache()
            time.sleep(5)
            if attempt == max_retries - 1:
                raise

def capture_sofascore():
    driver = None
    last_restart_time = time.time()
    
    try:
        driver = get_scraper()
        url = "https://www.sofascore.com/"
        logger.info(f"[SCRAPER] Navigating to {url}...")
        driver.get(url)
        time.sleep(15)
        
        last_live_fetch = 0
        last_page_refresh = time.time()
        last_stats_fetch = 0
        stats_batch_index = 0

        while True:
            # WATCHDOG: Restart browser every 30 minutes to stay fresh and avoid detection patterns
            if time.time() - last_restart_time > 1800:
                logger.info("[WATCHDOG] 30 minutes passed. Restarting browser for fresh session...")
                if driver: driver.quit()
                driver = get_scraper()
                driver.get(url)
                time.sleep(15)
                last_restart_time = time.time()
                last_page_refresh = time.time()

            # Main Capture Logic...
            # Check for generic event fetch requests or specific detail requests
            logs = driver.get_log('performance')
            
            for entry in logs:
                try:
                    message = json.loads(entry['message'])['message']
                    method = message.get('method')
                    
                    if method == 'Network.responseReceived':
                        params = message.get('params', {})
                        response = params.get('response', {})
                        request_url = response.get('url', '')
                        
                        # Use a broader match to capture EVERYTHING from SofaScore API
                        if "api/v1" in request_url and "sofascore" in request_url:
                            request_id = params['requestId']
                            
                            # Determine type of data
                            if "sport/football/events/live" in request_url:
                                type_label = "LIVE_LIST"
                                target_path = DATA_FILE
                            elif "/statistics" in request_url:
                                type_label = "STATS"
                                # Robust ID extraction: find the number after /event/
                                try:
                                    parts = request_url.split('/')
                                    idx = parts.index('event')
                                    match_id = parts[idx + 1]
                                except:
                                    match_id = request_url.split('/')[-2]
                                
                                if not match_id.isdigit(): continue
                                target_path = os.path.join(STATS_DIR, f"{match_id}_stats.json")
                            elif "/event/" in request_url and "/statistics" not in request_url:
                                # Ensure it's a detail request, not odds or other sub-resources
                                parts = request_url.split('/')
                                try:
                                    idx = parts.index('event')
                                    match_id = parts[idx + 1]
                                    # If there's anything after the ID (like /odds), it's not the main DETAIL
                                    if len(parts) > idx + 2 and parts[idx + 2] not in ['', ' ']:
                                        continue
                                except:
                                    continue

                                if not match_id.isdigit() or len(match_id) < 5:
                                    continue
                                
                                type_label = "DETAIL"
                                target_path = os.path.join(STATS_DIR, f"{match_id}_detail.json")
                            else:
                                continue

                            current_match_id = match_id if 'match_id' in locals() else "N/A"
                            try:
                                response_body = driver.execute_cdp_cmd('Network.getResponseBody', {'requestId': request_id})
                                body = response_body.get('body', '')
                                if body:
                                    json_data = json.loads(body)
                                    if "error" not in json_data:
                                        with open(target_path, 'w', encoding='utf-8') as f:
                                            json.dump(json_data, f)
                                        
                                        # Firebase Upload
                                        try:
                                            from firebase_uploader import upload_to_firebase
                                            if type_label == "LIVE_LIST":
                                                upload_to_firebase("live_events", json_data)
                                            elif type_label == "STATS":
                                                upload_to_firebase(f"stats/{match_id}/stats", json_data)
                                            elif type_label == "DETAIL":
                                                upload_to_firebase(f"stats/{match_id}/detail", json_data)
                                        except Exception as e:
                                            logger.warning(f"Firebase upload failed: {e}")

                                        if type_label == "LIVE_LIST":
                                            logger.info(f"Captured LIVE_LIST -> {target_path}")
                                        else:
                                            logger.info(f"Captured {type_label} for {match_id} -> {target_path}")
                                    else:
                                        if type_label == "STATS":
                                            if fetch_stats_via_js(driver, match_id):
                                                logger.info(f"Fallback SUCCESS for {match_id} (STATS)")
                                                continue
                                        
                                        logger.warning(f"API Error for {current_match_id} ({type_label}), saving empty marker.")
                                        with open(target_path, 'w', encoding='utf-8') as f:
                                            json.dump({"error": "No data available", "items": []}, f)
                            except Exception as e:
                                continue

                except Exception:
                    continue
            
            if time.time() - last_live_fetch > LIVE_FETCH_INTERVAL:
                logger.info(f"Periodic fetch for LIVE_LIST (TS: {int(time.time())})")
                
                try:
                    # Async JS Fetch (Direct Capture)
                    driver.set_script_timeout(30)
                    cb = int(time.time())
                    script_live = f"""
                    var done = arguments[0];
                    fetch('https://www.sofascore.com/api/v1/sport/football/events/live?cache_buster={cb}', {{
                        headers: {{ 'Accept': 'application/json', 'Cache-Control': 'no-cache' }}
                    }})
                    .then(res => {{
                        if (!res.ok) throw new Error(res.status);
                        return res.json();
                    }})
                    .then(data => done({{status: 'success', data: data}}))
                    .catch(err => done({{status: 'error', message: err.toString()}}));
                    """
                    result = driver.execute_async_script(script_live)
                    
                    if result and result.get('status') == 'success':
                        json_data = result.get('data')
                        target_path = DATA_FILE
                        with open(target_path, 'w', encoding='utf-8') as f:
                            json.dump(json_data, f)
                            
                        # Firebase Upload (Replicating existing logic)
                        try:
                            from firebase_uploader import upload_to_firebase
                            upload_to_firebase("live_events", json_data)
                        except:
                            pass
                            
                        logger.info(f"[JS-FETCH] Captured LIVE_LIST directly -> {target_path}")
                        last_live_fetch = time.time()
                    else:
                        logger.warning(f"[JS-FETCH] Live List Failed: {result.get('message')}")
                        
                except Exception as e:
                    logger.error(f"[JS-FETCH] Live List Exception: {e}")
                    
                # Short sleep to prevent busy loop if intervals are small
                time.sleep(1)
                logs = driver.get_log('performance')
                captured = False
                for entry in logs:
                    try:
                        message = json.loads(entry['message'])['message']
                        if message.get('method') == 'Network.responseReceived':
                            params = message.get('params', {})
                            response = params.get('response', {})
                            request_url = response.get('url', '')
                            if "sport/football/events/live" in request_url:
                                request_id = params['requestId']
                                response_body = driver.execute_cdp_cmd('Network.getResponseBody', {'requestId': request_id})
                                body = response_body.get('body', '')
                                if body:
                                    json_data = json.loads(body)
                                    if "events" in json_data:
                                        with open(DATA_FILE, 'w', encoding='utf-8') as f:
                                            json.dump(json_data, f)
                                        
                                        # Firebase Upload
                                        try:
                                            from firebase_uploader import upload_to_firebase
                                            upload_to_firebase("live_events", json_data)
                                        except:
                                            pass

                                        logger.info(f"Captured LIVE_LIST -> {DATA_FILE}")
                                        captured = True
                                        break
                    except:
                        continue
                # If network capture failed, use direct HTTP fallback
                if not captured:
                    fetch_live_list_directly()
                last_live_fetch = time.time()

            if time.time() - last_page_refresh > 600:
                logger.info("Safety net: Refreshing page...")
                driver.refresh()
                time.sleep(10)
                last_page_refresh = time.time()

            # AUTO-FETCH STATS: Automatically fetch stats for all live matches in batches
            if time.time() - last_stats_fetch > STATS_FETCH_INTERVAL:
                try:
                    if os.path.exists(DATA_FILE):
                        with open(DATA_FILE, 'r', encoding='utf-8') as f:
                            live_data = json.load(f)
                        
                        events = live_data.get('events', [])
                        if events:
                            # SELECTION PRIORITY (v2.4)
                            def get_priority(event):
                                score = 0
                                # Priority 1: Unique Tournament Priority
                                tourney = event.get('tournament', {}).get('uniqueTournament', {})
                                score += tourney.get('priority', 0) * 10
                                # Priority 2: User count (popularity)
                                score += (event.get('userCount', 0) / 1000)
                                # Priority 3: Matches with active scoring potential (2nd half or close games)
                                status = event.get('status', {}).get('type', '')
                                if status == 'inprogress':
                                    score += 5
                                return score

                            # Sort all events by importance, then extract IDs
                            sorted_events = sorted(events, key=get_priority, reverse=True)
                            all_ids = [str(e.get('id')) for e in sorted_events if e.get('id')]
                            
                            # Calculate batch to process
                            total_batches = (len(all_ids) + BATCH_SIZE - 1) // BATCH_SIZE
                            if total_batches > 0:
                                stats_batch_index = stats_batch_index % total_batches
                                start_idx = stats_batch_index * BATCH_SIZE
                                end_idx = min(start_idx + BATCH_SIZE, len(all_ids))
                                batch_ids = all_ids[start_idx:end_idx]
                                
                                logger.info(f"[AUTO-STATS] Processing batch {stats_batch_index + 1}/{total_batches} ({len(batch_ids)} matches)")
                                
                                for match_id in batch_ids:
                                    # Check if stats file exists and is fresh (< 45 seconds old)
                                    stats_file = os.path.join(STATS_DIR, f"{match_id}_stats.json")
                                    should_fetch = True
                                    
                                    if os.path.exists(stats_file):
                                        age = time.time() - os.path.getmtime(stats_file)
                                        # If it was an empty marker, retry more frequently
                                        try:
                                            with open(stats_file, 'r') as sf:
                                                content = sf.read()
                                                if "error" in content:
                                                    # SofaScore has no stats for this match (404), wait 10 mins before retrying
                                                    should_fetch = (age > 600)
                                                elif age < 45:
                                                    should_fetch = False
                                        except:
                                            should_fetch = True
                                    
                                    if should_fetch:
                                        logger.info(f"[AUTO-STATS] Fetching stats for {match_id}")
                                        fetch_stats_via_js(driver, match_id)
                                        time.sleep(1.0)
                                
                                stats_batch_index += 1
                except Exception as e:
                    logger.error(f"[AUTO-STATS] Error: {e}")
                
                last_stats_fetch = time.time()

            request_queue = 'server/stats_request.json'
            if os.path.exists(request_queue):
                try:
                    with open(request_queue, 'r') as rq:
                        req_data = json.load(rq)
                    os.remove(request_queue)
                    
                    ids = req_data.get('ids', [])
                    if ids:
                        # Limit targeted fetch to avoid rate limiting
                        max_targeted = 10
                        ids_to_fetch = ids[-max_targeted:] # Process the most recent requests
                        logger.info(f"Processing queue: {len(ids)} total, fetching {len(ids_to_fetch)} most recent")
                        
                        for match_id in ids_to_fetch:
                            logger.info(f"Targeted fetch for Match ID: {match_id}")
                            fetch_stats_via_js(driver, match_id)
                            time.sleep(0.5)
                except Exception as e:
                    logger.error(f"Queue processing error: {e}")

            time.sleep(2)
            
    except Exception as e:
        logger.error(f"FATAL ERROR in capture loop: {e}", exc_info=True)
        sys.exit(1) # Tell proxy.js that we crashed, not exited cleanly
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass

if __name__ == "__main__":
    if not os.path.exists('server'): os.makedirs('server')
    if not os.path.exists(STATS_DIR): os.makedirs(STATS_DIR)
    capture_sofascore()
