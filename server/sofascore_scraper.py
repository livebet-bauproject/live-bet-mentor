import time
import json
import os
import logging
from logging.handlers import RotatingFileHandler
import requests
import sys
import random
import platform
import subprocess
import shutil
import tempfile

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, WebDriverException

def is_fatal_driver_error(e):
    """Check if exception represents a completely dead or closed Chrome instance."""
    err_str = str(e).lower()
    fatal_patterns = [
        '10061',
        'connection refused',
        'max retries exceeded',
        'invalid session id',
        'session not created',
        'no such window',
        'chrome not reachable',
        'disconnected: not connected to devtools'
    ]
    return any(p in err_str for p in fatal_patterns)

# Suppress harmless WinError 6 on garbage collection
_orig_del = getattr(uc.Chrome, '__del__', None)
def _safe_del(self):
    try:
        if _orig_del:
            _orig_del(self)
    except BaseException:
        pass
uc.Chrome.__del__ = _safe_del

# Centralized Logging with max 2MB rotation (prevents runaway disk and memory bloat)
log_path = os.path.join(SERVER_DIR, "scraper.log")
rotating_handler = RotatingFileHandler(log_path, maxBytes=2*1024*1024, backupCount=2, encoding='utf-8')
rotating_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))

stream_handler = logging.StreamHandler()
stream_handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(message)s'))

logger = logging.getLogger("SofaScoreScraper")
logger.setLevel(logging.INFO)
logger.handlers = [rotating_handler, stream_handler]

# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'sofascore_live.json')
ODDS_FILE = os.path.join(BASE_DIR, 'live_odds.json')
REQUEST_QUEUE_FILE = os.path.join(BASE_DIR, 'stats_request.json')
NETWORK_LOG_FILE = os.path.join(BASE_DIR, 'network_log.txt')
STATS_DIR = os.path.join(BASE_DIR, 'stats')
LIVE_FETCH_INTERVAL = 15  # Fetch live list every 15 seconds for fresher data
STATS_FETCH_INTERVAL = 20  # Auto-fetch stats for all live matches every 20 seconds
BATCH_SIZE = 10  # Number of matches to fetch stats for in each batch (to avoid rate limiting)

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

def filter_live_events(data):
    """Purge finished, ended, ghost, or over-duration matches from live events list."""
    if not isinstance(data, dict) or 'events' not in data:
        return data
    events = data.get('events', [])
    now = time.time()
    clean = []
    for e in events:
        if not isinstance(e, dict):
            continue
        start_ts = e.get('startTimestamp') or now
        # 1. Match started > 165 mins (2.75h) ago is 100% finished
        if (now - start_ts) > (165 * 60):
            continue
        # Note: feedLocked is an editorial commentary lock in SofaScore, NOT an indicator of match conclusion.
        # Match conclusion is determined strictly by status (finished/code 100) or elapsed duration (> 165 mins).
        # 3. Status checks
        status = e.get('status', {})
        st_type = str(status.get('type', '')).lower()
        st_code = status.get('code')
        desc = str(status.get('description', '')).lower()

        if st_type == 'finished' or st_code == 100:
            continue
        if any(w in desc for w in ['ended', 'finished', 'bitti', 'sona', 'cancel', 'ertele', 'iptal', 'abandon', 'interrupt', 'suspend', 'delayed']):
            continue
        if desc in ['ft', 'aet', 'ap']:
            continue
        # 4. Halftime sanity: Stuck in Halftime > 85 mins after kickoff
        if (st_code == 31 or 'halftime' in desc or desc == 'ht') and (now - start_ts) > (85 * 60):
            continue
        clean.append(e)
    return {**data, 'events': clean}

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
                
                with open(ODDS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(current_odds, f, indent=2)
                logger.debug(f"[ODDS] Updated {match_id} in {ODDS_FILE}: {home_val} | {draw_val} | {away_val}")
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
                data = filter_live_events(data)
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

def fetch_stats_via_js(driver, match_id, include_extras=False):
    """Safely fetch match statistics and odds using browser's JS fetch with strict internal timeout."""
    if not driver:
        return False
    try:
        driver.set_script_timeout(8)
        
        # Hard 3.2s internal timeout inside JavaScript guarantees done() is ALWAYS invoked!
        # This completely prevents driver TimeoutExceptions from ever happening.
        script = """
        var done = arguments[0];
        var mid = String(arguments[1]);
        var includeExtras = Boolean(arguments[2]);
        var finished = false;
        
        var timer = setTimeout(function() {
            if (!finished) {
                finished = true;
                done({ status: 'timeout', stats: null, detail: null, odds: null, graph: null, incidents: null });
            }
        }, 3200);

        function safeDone(payload) {
            if (!finished) {
                finished = true;
                clearTimeout(timer);
                done(payload);
            }
        }

        var h = { 'Accept': 'application/json' };
        
        var reqs = [
            fetch('/api/v1/event/' + mid + '/statistics', { headers: h, signal: AbortSignal.timeout(2800) })
                .then(r => r.ok ? r.json() : (r.status === 404 ? { error: 'Not Found', noStats: true } : null))
                .catch(() => null),
            fetch('/api/v1/event/' + mid + '/odds/1/all', { headers: h, signal: AbortSignal.timeout(2800) })
                .then(r => r.ok ? r.json() : null)
                .catch(() => null),
            fetch('/api/v1/event/' + mid, { headers: h, signal: AbortSignal.timeout(2800) })
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
        ];
        
        if (includeExtras) {
            reqs.push(
                fetch('/api/v1/event/' + mid + '/graph', { headers: h, signal: AbortSignal.timeout(2800) })
                    .then(r => r.ok ? r.json() : null)
                    .catch(() => null)
            );
            reqs.push(
                fetch('/api/v1/event/' + mid + '/incidents', { headers: h, signal: AbortSignal.timeout(2800) })
                    .then(r => r.ok ? r.json() : null)
                    .catch(() => null)
            );
        }

        Promise.all(reqs)
            .then(function(res) {
                safeDone({
                    status: 'success',
                    stats: res[0] || null,
                    odds: res[1] || null,
                    detail: res[2] || null,
                    graph: includeExtras ? (res[3] || null) : null,
                    incidents: includeExtras ? (res[4] || null) : null
                });
            })
            .catch(function(err) {
                safeDone({ status: 'error', message: String(err) });
            });
        """
        
        result = driver.execute_async_script(script, str(match_id), bool(include_extras))
        
        if result and result.get('status') == 'success':
            captured_something = False
            
            # 1. Save Statistics
            stats_data = result.get('stats')
            stats_path = os.path.join(STATS_DIR, f"{match_id}_stats.json")
            if stats_data:
                if 'statistics' in stats_data or stats_data.get('noStats') or 'error' in stats_data:
                    is_err = 'error' in stats_data and not stats_data.get('noStats')
                    can_write = True
                    if is_err and os.path.exists(stats_path):
                        try:
                            with open(stats_path, 'r', encoding='utf-8') as f_old:
                                old_data = json.load(f_old)
                                if old_data and 'statistics' in old_data and old_data['statistics']:
                                    can_write = False
                        except:
                            pass
                    
                    if can_write:
                        with open(stats_path, 'w', encoding='utf-8') as f:
                            json.dump(stats_data, f)
                    
                    if 'statistics' in stats_data:
                        captured_something = True
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

            # 4. Save Attack Momentum Graph (if requested)
            if include_extras:
                graph_data = result.get('graph')
                if graph_data and ('graphPoints' in graph_data or 'graphPointsV2' in graph_data):
                    graph_path = os.path.join(STATS_DIR, f"{match_id}_graph.json")
                    try:
                        with open(graph_path, 'w', encoding='utf-8') as f:
                            json.dump(graph_data, f)
                        captured_something = True
                    except Exception as ge:
                        pass

                # 5. Save Match Incidents (if requested)
                incidents_data = result.get('incidents')
                if incidents_data and ('incidents' in incidents_data or 'noIncidents' in incidents_data):
                    incidents_path = os.path.join(STATS_DIR, f"{match_id}_incidents.json")
                    try:
                        with open(incidents_path, 'w', encoding='utf-8') as f:
                            json.dump(incidents_data, f)
                        captured_something = True
                    except Exception as ie:
                        pass
            
            if captured_something:
                logger.info(f"[JS-FETCH] Captured data for {match_id} (Stats: {'statistics' in (stats_data or {})})")
                return True
        elif result and result.get('status') == 'timeout':
            logger.debug(f"[JS-FETCH] Match {match_id} timed out after 3.2s, skipping.")
            return False
            
    except TimeoutException:
        logger.warning(f"[JS-FETCH] Script timeout for {match_id} (harmless, continuing)")
        return False
    except Exception as e:
        logger.warning(f"[JS-FETCH] Execution failed for {match_id}: {e}")
        if is_fatal_driver_error(e):
            raise e
    return False

def process_request_queue(driver, max_count=10):
    """Process high-priority on-demand match stats requests from proxy/UI."""
    if not driver or not os.path.exists(REQUEST_QUEUE_FILE):
        return
    try:
        with open(REQUEST_QUEUE_FILE, 'r', encoding='utf-8') as rq:
            raw_content = rq.read().strip()
        if not raw_content:
            return
        req_data = json.loads(raw_content)
        try:
            os.remove(REQUEST_QUEUE_FILE)
        except:
            pass
        
        ids = req_data.get('ids', [])
        if ids:
            ids_to_fetch = ids[-max_count:] # Process most recent requests
            logger.info(f"[ON-DEMAND] Fetching {len(ids_to_fetch)} requested matches: {ids_to_fetch}")
            for match_id in ids_to_fetch:
                fetch_stats_via_js(driver, str(match_id), include_extras=True)
                time.sleep(0.3)
    except Exception as e:
        logger.debug(f"[ON-DEMAND] Queue processing info: {e}")
        if is_fatal_driver_error(e):
            raise e

def kill_zombie_chrome_processes():
    """Aggressively kill all orphaned chromedriver and scraper Chrome instances."""
    is_win = platform.system().lower().startswith('win')
    try:
        if is_win:
            subprocess.run(["taskkill", "/F", "/IM", "chromedriver.exe", "/T"], capture_output=True, timeout=3)
            subprocess.run(["taskkill", "/F", "/IM", "undetected_chromedriver.exe", "/T"], capture_output=True, timeout=3)
            # Terminate orphaned scraper Chrome processes so they never accumulate in memory
            ps_kill = (
                "Get-CimInstance Win32_Process -Filter \"Name = 'chrome.exe'\" | "
                "Where-Object { $_.CommandLine -like '*headless=new*' -or $_.CommandLine -like '*remote-debugging-port*' -or $_.CommandLine -like '*--window-position=-32000*' } | "
                "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
            )
            subprocess.run(["powershell", "-NoProfile", "-Command", ps_kill], capture_output=True, timeout=6)
        else:
            subprocess.run(["killall", "-9", "chromedriver"], capture_output=True, timeout=3)
            subprocess.run(["pkill", "-9", "-f", "headless=new"], capture_output=True, timeout=3)
    except Exception as e:
        logger.debug(f"Zombie process cleanup note: {e}")

def safe_quit_driver(driver):
    """Safely and completely terminate Chrome driver and its specific browser process."""
    if not driver:
        kill_zombie_chrome_processes()
        return
    browser_pid = getattr(driver, 'browser_pid', None)
    service_pid = getattr(getattr(driver, 'service', None), 'process', None)
    service_pid = service_pid.pid if service_pid else None
    
    try:
        driver.quit()
    except Exception as e:
        logger.debug(f"driver.quit() exception ignored: {e}")
        
    is_win = platform.system().lower().startswith('win')
    for pid in [browser_pid, service_pid]:
        if pid:
            try:
                if is_win:
                    subprocess.run(["taskkill", "/F", "/PID", str(pid), "/T"], capture_output=True, timeout=3)
                else:
                    os.kill(pid, 9)
            except Exception:
                pass

    # Ensure no lingering child processes or taskbar buttons survive
    kill_zombie_chrome_processes()

def clean_chromedriver_cache(force_all=False):
    """Clean temporary lock files and scoped directories from %TEMP%."""
    if force_all:
        try:
            cache_dir = os.path.join(os.environ.get('APPDATA', ''), 'undetected_chromedriver')
            if os.path.exists(cache_dir):
                shutil.rmtree(cache_dir, ignore_errors=True)
                logger.info("Cleaned undetected_chromedriver cache directory")
        except Exception as e:
            logger.warning(f"Failed to clean cache: {e}")
        
    try:
        temp_dir = tempfile.gettempdir()
        for item in os.listdir(temp_dir):
            if item.startswith('.org.chromium.Chromium') or item.startswith('undetected_') or item.startswith('scoped_dir'):
                p = os.path.join(temp_dir, item)
                try:
                    if os.path.isdir(p):
                        shutil.rmtree(p, ignore_errors=True)
                    else:
                        os.remove(p)
                except Exception:
                    pass
    except Exception:
        pass

def wait_for_cloudflare_clearance(driver, timeout=30):
    """Wait for Cloudflare Turnstile challenge to auto-resolve or assist solving."""
    if not driver:
        return False
    start = time.time()
    while time.time() - start < timeout:
        try:
            title = (driver.title or '').lower()
            if "just a moment" in title or "cloudflare" in title or "attention required" in title:
                logger.info(f"[CLOUDFLARE] Challenge active. Waiting to auto-resolve ({int(time.time() - start)}s)...")
                time.sleep(3)
                # Attempt to click Turnstile checkbox if present inside iframe
                try:
                    iframes = driver.find_elements(By.TAG_NAME, "iframe")
                    for frame in iframes:
                        src = (frame.get_attribute("src") or "").lower()
                        if "cloudflare" in src or "turnstile" in src or "challenge" in src:
                            driver.switch_to.frame(frame)
                            box = driver.find_element(By.XPATH, "//input[@type='checkbox']")
                            if box and box.is_displayed():
                                box.click()
                                logger.info("[CLOUDFLARE] Clicked Turnstile checkbox!")
                            driver.switch_to.default_content()
                            break
                except Exception:
                    try:
                        driver.switch_to.default_content()
                    except:
                        pass
            else:
                logger.info(f"[CLOUDFLARE] Clearance confirmed! Page title: {driver.title}")
                return True
        except Exception:
            time.sleep(2)
    logger.warning("[CLOUDFLARE] Clearance wait completed or timed out.")
    return False

def get_scraper():
    """Get Chrome driver using undetected_chromedriver with anti-crash, memory-saving flags."""
    # Pre-launch hygiene: ensure no port conflicts or stale locks
    kill_zombie_chrome_processes()
    clean_chromedriver_cache(force_all=False)
    
    from driver_helper import get_installed_chrome_version, get_chrome_exe_path
    major_ver = get_installed_chrome_version()
    chrome_exe = get_chrome_exe_path()
    
    # Isolated scratch profile so Chrome Remote Desktop never blocks the debugging session
    profile_dir = os.path.join(tempfile.gettempdir(), 'livebet_uc_profile')
    os.makedirs(profile_dir, exist_ok=True)
    
    # Priority 1: undetected_chromedriver (Bypasses Cloudflare Turnstile/Bot Protection)
    max_retries = 3
    for attempt in range(max_retries):
        try:
            options = uc.ChromeOptions()
            if chrome_exe:
                options.binary_location = chrome_exe
            options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
            options.add_argument(f'--user-data-dir={profile_dir}')
            options.add_argument('--window-size=1100,750')
            options.add_argument('--window-position=50,50')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-breakpad')
            options.add_argument('--disable-component-update')
            options.add_argument('--disable-notifications')
            options.add_argument('--disable-infobars')
            
            # Anti-throttling flags: prevent Chrome from freezing timers or Turnstile in background
            options.add_argument('--disable-background-timer-throttling')
            options.add_argument('--disable-backgrounding-occluded-windows')
            options.add_argument('--disable-renderer-backgrounding')
            options.add_argument('--disable-features=CalculateNativeWinOcclusion')
            
            logger.info(f"Launching SofaScore Browser (uc attempt {attempt + 1}, Chrome v{major_ver})...")
            driver = uc.Chrome(
                options=options,
                user_data_dir=profile_dir,
                version_main=major_ver
            )
            # NEVER minimize the window - Turnstile requires a visible desktop window to solve!
            return driver
        except Exception as e:
            logger.warning(f"SofaScore Driver Launch Error (attempt {attempt + 1}): {e}")
            kill_zombie_chrome_processes()
            time.sleep(3 * (attempt + 1))
            if attempt == max_retries - 1:
                logger.warning("All uc launch attempts exhausted, attempting standard Selenium fallback...")

    # Priority 2: Direct Selenium fallback
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.service import Service
        from selenium.webdriver.chrome.options import Options
        from driver_helper import get_chromedriver_path
        
        driver_path = get_chromedriver_path()
        options = Options()
        if chrome_exe:
            options.binary_location = chrome_exe
        options.add_argument(f'--user-data-dir={profile_dir}')
        options.add_experimental_option('excludeSwitches', ['enable-automation'])
        options.add_experimental_option('useAutomationExtension', False)
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--window-size=1100,750')
        options.add_argument('--window-position=50,50')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-background-timer-throttling')
        options.add_argument('--disable-backgrounding-occluded-windows')
        options.add_argument('--disable-renderer-backgrounding')
        options.add_argument('--disable-features=CalculateNativeWinOcclusion')
        options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
        
        service = Service(executable_path=driver_path)
        logger.info("Launching SofaScore Browser via Fallback ChromeDriver...")
        driver = webdriver.Chrome(service=service, options=options)
        return driver
    except Exception as e:
        logger.error(f"Fallback Selenium launch also failed: {e}")
        raise

def _run_capture_session():
    driver = None
    last_restart_time = time.time()
    last_successful_save = time.time()
    last_page_refresh = time.time()
    
    try:
        driver = get_scraper()
        url = "https://www.sofascore.com/football/livescore"
        logger.info(f"[SCRAPER] Navigating to {url}...")
        driver.get(url)
        time.sleep(3)
        wait_for_cloudflare_clearance(driver, timeout=30)
        
        last_live_fetch = 0
        last_stats_fetch = 0
        stats_batch_index = 0

        while True:
            # 1. Soft DOM Refresh every 15 minutes: Keeps Turnstile cookies fresh without closing Chrome
            if time.time() - last_page_refresh > 900:
                logger.info("[SESSION] 15 minutes passed: Soft DOM refresh to keep session fresh...")
                try:
                    driver.get(url)
                    time.sleep(4)
                    wait_for_cloudflare_clearance(driver, timeout=20)
                except Exception as e:
                    logger.warning(f"[SESSION] DOM refresh notice: {e}")
                last_page_refresh = time.time()

            # 2. Hard Browser Rotation: Only after 4 continuous hours OR if data has stalled for > 360 seconds
            session_age = time.time() - last_restart_time
            data_stalled = (last_successful_save > 0) and (time.time() - last_successful_save > 360)
            
            if session_age > 14400 or data_stalled:
                reason = "4-hour routine rotation" if session_age > 14400 else "Data stalled for > 6 minutes"
                logger.info(f"[SESSION] Triggering clean browser rotation ({reason})...")
                safe_quit_driver(driver)
                driver = None
                clean_chromedriver_cache()
                kill_zombie_chrome_processes()
                time.sleep(3)
                driver = get_scraper()
                driver.get(url)
                time.sleep(4)
                wait_for_cloudflare_clearance(driver, timeout=30)
                last_restart_time = time.time()
                last_page_refresh = time.time()
                last_successful_save = time.time()

            # Main Capture Logic...
            # Safely capture performance logs without throwing if disconnected
            try:
                logs = driver.get_log('performance')
            except Exception:
                logs = []
            
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
                                        if type_label == "LIVE_LIST":
                                            json_data = filter_live_events(json_data)
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
                                            logger.info(f"Captured LIVE_LIST -> {target_path} ({len(json_data.get('events', []))} clean events)")
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
            
            fetch_jitter = random.uniform(0.5, 2.5)
            if time.time() - last_live_fetch > (LIVE_FETCH_INTERVAL + fetch_jitter):
                logger.info(f"Periodic fetch for LIVE_LIST (TS: {int(time.time())})")
                
                try:
                    # Async JS Fetch (Direct Capture with guaranteed internal timeout)
                    driver.set_script_timeout(10)
                    cb = int(time.time())
                    script_live = f"""
                    var done = arguments[0];
                    var finished = false;
                    var timer = setTimeout(function() {{
                        if (!finished) {{
                            finished = true;
                            done({{ status: 'timeout' }});
                        }}
                    }}, 4500);

                    function safeDone(payload) {{
                        if (!finished) {{
                            finished = true;
                            clearTimeout(timer);
                            done(payload);
                        }}
                    }}

                    fetch('/api/v1/sport/football/events/live?cache_buster={cb}', {{
                        headers: {{ 'Accept': 'application/json' }},
                        signal: AbortSignal.timeout(4000)
                    }})
                    .then(res => {{
                        if (!res.ok) throw new Error(res.status);
                        return res.json();
                    }})
                    .then(data => safeDone({{ status: 'success', data: data }}))
                    .catch(err => safeDone({{ status: 'error', message: err.toString() }}));
                    """
                    result = driver.execute_async_script(script_live)
                    
                    if result and result.get('status') == 'success':
                        raw_data = result.get('data')
                        if isinstance(raw_data, dict) and ('error' in raw_data or 'events' not in raw_data):
                            err_info = raw_data.get('error', 'challenge')
                            logger.warning(f"[JS-FETCH] Cloudflare challenge or API block ({err_info}). Waiting for clearance...")
                            wait_for_cloudflare_clearance(driver, timeout=15)
                            time.sleep(3)
                            continue

                        json_data = filter_live_events(raw_data)
                        target_path = DATA_FILE
                        with open(target_path, 'w', encoding='utf-8') as f:
                            json.dump(json_data, f)
                            
                        # Firebase Upload (Replicating existing logic)
                        try:
                            from firebase_uploader import upload_to_firebase
                            upload_to_firebase("live_events", json_data)
                        except:
                            pass
                            
                        clean_count = len(json_data.get('events', []))
                        logger.info(f"[JS-FETCH] Captured LIVE_LIST directly -> {target_path} ({clean_count} clean events)")
                        last_live_fetch = time.time()
                        if clean_count > 0:
                            last_successful_save = time.time()
                    else:
                        errMsg = str(result.get('message', '')) if result else 'null'
                        logger.warning(f"[JS-FETCH] Live List Failed: {errMsg}")
                        if '403' in errMsg or 'challenge' in errMsg.lower():
                            logger.warning("[JS-FETCH] 403 Challenge detected! Waiting for clearance...")
                            wait_for_cloudflare_clearance(driver, timeout=15)
                            time.sleep(3)
                        
                except Exception as e:
                    logger.error(f"[JS-FETCH] Live List Exception: {e}")
                    
                # Short sleep to prevent busy loop if intervals are small
                time.sleep(1)
                try:
                    logs = driver.get_log('performance')
                except Exception:
                    logs = []
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
                                        json_data = filter_live_events(json_data)
                                        with open(DATA_FILE, 'w', encoding='utf-8') as f:
                                            json.dump(json_data, f)
                                        
                                        # Firebase Upload
                                        try:
                                            from firebase_uploader import upload_to_firebase
                                            upload_to_firebase("live_events", json_data)
                                        except:
                                            pass

                                        clean_count = len(json_data.get('events', []))
                                        logger.info(f"Captured LIVE_LIST -> {DATA_FILE} ({clean_count} clean events)")
                                        captured = True
                                        if clean_count > 0:
                                            last_successful_save = time.time()
                                        break
                    except:
                        continue
                # If network capture failed, use direct HTTP fallback
                if not captured:
                    fetch_live_list_directly()
                last_live_fetch = time.time()

            # Check on-demand user request queue first
            process_request_queue(driver, max_count=10)

            # AUTO-FETCH STATS: Smart scheduler focusing on active in-progress matches
            if time.time() - last_stats_fetch > STATS_FETCH_INTERVAL:
                try:
                    if os.path.exists(DATA_FILE):
                        with open(DATA_FILE, 'r', encoding='utf-8') as f:
                            live_data = json.load(f)
                        
                        events = live_data.get('events', [])
                        if events:
                            # CRITICAL: Focus ONLY on matches that are actively in progress!
                            active_events = [e for e in events if e.get('status', {}).get('type') == 'inprogress']
                            
                            def get_match_priority(event):
                                score = 0
                                t = event.get('tournament', {})
                                ut = t.get('uniqueTournament', {})
                                score += t.get('priority', 0) * 1000
                                score += ut.get('userCount', 0) / 100
                                score += (event.get('homeTeam', {}).get('userCount', 0) + event.get('awayTeam', {}).get('userCount', 0)) / 500
                                return score

                            sorted_events = sorted(active_events, key=get_match_priority, reverse=True)
                            
                            # Tier 1: Top 15 active matches refreshed every cycle
                            # Tier 2: Remaining matches rotated in batches of 5
                            tier1_events = sorted_events[:15]
                            tier2_events = sorted_events[15:]
                            
                            tier1_ids = [str(e.get('id')) for e in tier1_events if e.get('id')]
                            tier2_ids = [str(e.get('id')) for e in tier2_events if e.get('id')]

                            tier1_updated = 0
                            for match_id in tier1_ids:
                                process_request_queue(driver, max_count=2)
                                stats_file = os.path.join(STATS_DIR, f"{match_id}_stats.json")
                                should_fetch = True

                                if os.path.exists(stats_file):
                                    age = time.time() - os.path.getmtime(stats_file)
                                    if age < 25:
                                        should_fetch = False
                                    else:
                                        try:
                                            with open(stats_file, 'r', encoding='utf-8') as sf:
                                                content = sf.read()
                                                if "noStats" in content or "error" in content:
                                                    if age < 60:
                                                        should_fetch = False
                                        except:
                                            should_fetch = True

                                if should_fetch:
                                    fetch_stats_via_js(driver, match_id, include_extras=False)
                                    tier1_updated += 1
                                    time.sleep(0.4)

                            if tier1_updated > 0:
                                logger.info(f"[TIER-1 STATS] Refreshed {tier1_updated}/{len(tier1_ids)} top matches")

                            # Background rotation for Tier 2 matches (5 per cycle)
                            if tier2_ids:
                                t2_batch_size = 5
                                total_t2_batches = (len(tier2_ids) + t2_batch_size - 1) // t2_batch_size
                                stats_batch_index = stats_batch_index % total_t2_batches
                                t2_start = stats_batch_index * t2_batch_size
                                t2_end = min(t2_start + t2_batch_size, len(tier2_ids))
                                t2_batch = tier2_ids[t2_start:t2_end]

                                for match_id in t2_batch:
                                    process_request_queue(driver, max_count=2)
                                    stats_file = os.path.join(STATS_DIR, f"{match_id}_stats.json")
                                    should_fetch = True
                                    if os.path.exists(stats_file):
                                        age = time.time() - os.path.getmtime(stats_file)
                                        try:
                                            with open(stats_file, 'r', encoding='utf-8') as sf:
                                                content = sf.read()
                                                if "noStats" in content or "error" in content:
                                                    should_fetch = (age > 90)
                                                elif age < 45:
                                                    should_fetch = False
                                        except:
                                            should_fetch = True

                                    if should_fetch:
                                        fetch_stats_via_js(driver, match_id, include_extras=False)
                                        time.sleep(0.4)

                                stats_batch_index += 1
                except Exception as e:
                    logger.error(f"[AUTO-STATS] Error: {e}")
                    if is_fatal_driver_error(e):
                        raise e

                last_stats_fetch = time.time()

            # Check queue again before sleep
            process_request_queue(driver, max_count=10)
            time.sleep(1)
            
    except Exception as e:
        logger.error(f"[SCRAPER] Loop error: {e}. Auto-healing in 5s...", exc_info=True)
        time.sleep(5)
    finally:
        if driver:
            safe_quit_driver(driver)
            driver = None

PID_FILE = os.path.join(BASE_DIR, 'sofascore_scraper.pid')

def check_single_instance():
    """Ensure only one instance of the scraper runs at any time."""
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, 'r') as f:
                old_pid = int(f.read().strip())
            if old_pid != os.getpid():
                is_alive = False
                if platform.system().lower().startswith('win'):
                    out = subprocess.run(['tasklist', '/FI', f'PID eq {old_pid}'], capture_output=True, text=True)
                    if str(old_pid) in out.stdout:
                        is_alive = True
                else:
                    try:
                        os.kill(old_pid, 0)
                        is_alive = True
                    except OSError:
                        is_alive = False
                if is_alive:
                    logger.warning(f"Another scraper is already active (PID {old_pid}). Exiting duplicate.")
                    sys.exit(0)
        except Exception:
            pass
    try:
        with open(PID_FILE, 'w') as f:
            f.write(str(os.getpid()))
    except Exception:
        pass

def capture_sofascore():
    """Autonomous 24/7 self-healing scraper driver with zero-crash recovery."""
    check_single_instance()
    kill_zombie_chrome_processes()
    clean_chromedriver_cache()
    while True:
        try:
            _run_capture_session()
        except Exception as e:
            logger.error(f"[SCRAPER] Recoverable session error: {e}. Auto-healing in 5s...", exc_info=True)
            kill_zombie_chrome_processes()
            clean_chromedriver_cache()
            time.sleep(5)

if __name__ == "__main__":
    if not os.path.exists('server'): os.makedirs('server')
    if not os.path.exists(STATS_DIR): os.makedirs(STATS_DIR)
    capture_sofascore()
