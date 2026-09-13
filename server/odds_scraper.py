import time
import json
import os
import logging
import requests
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Centralized Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("server/odds_scraper.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'live_odds.json')
ODDS_FETCH_INTERVAL = 30  # Fetch odds every 30 seconds

# Configure performance logging
caps = DesiredCapabilities.CHROME
caps['goog:loggingPrefs'] = {'performance': 'ALL'}


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
    """Initialize Chrome driver using patched ChromeDriver 152 with fallback."""
    from driver_helper import get_chromedriver_path
    driver_path = get_chromedriver_path()
    
    # Priority 1: Direct Selenium with patched ChromeDriver 152
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
        logger.info("Launching OddsPortal Browser via Patched ChromeDriver 152...")
        driver = webdriver.Chrome(service=service, options=options)
        return driver
    except Exception as e:
        logger.warning(f"Standard Selenium launch failed: {e}, trying uc fallback...")

    # Priority 2: undetected_chromedriver fallback
    max_retries = 3
    for attempt in range(max_retries):
        try:
            options = uc.ChromeOptions()
            options.add_argument('--headless=new')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            
            logger.info(f"Launching OddsPortal Browser (uc fallback attempt {attempt + 1})...")
            driver = uc.Chrome(options=options, driver_executable_path=driver_path, use_subprocess=True)
            return driver
        except Exception as e:
            logger.warning(f"OddsPortal Driver Error (attempt {attempt + 1}): {e}")
            clean_chromedriver_cache()
            time.sleep(5)
            if attempt == max_retries - 1:
                raise


def parse_odds_from_page(driver):
    """Extract odds data from the page using DOM parsing - optimized for OddsPortal 2026."""
    import re
    
    odds_data = {
        'matches': [],
        'timestamp': int(time.time()),
        'source': 'oddsportal'
    }
    
    # Common patterns to filter out
    LEAGUE_KEYWORDS = ['football', 'soccer', 'league', 'cup', 'championship', 'division', 'serie', 
                       'bundesliga', 'laliga', 'premier', 'world', 'europe', 'africa', 'asia', 
                       'america', 'brazil', 'trinidad', 'tobago', 'argentina', 'mexico', 'usa',
                       'england', 'spain', 'germany', 'italy', 'france', 'copa', 'euro']
    
    # Score patterns like "2-1", "0:0", "2 – 3"
    SCORE_PATTERN = re.compile(r'^\d+\s*[-–:]\s*\d+$')
    # Time patterns like "12:00", "45'", "HT"
    TIME_PATTERN = re.compile(r'^(\d{1,2}[:\']?\d{0,2}[+\d]*\'?|HT|FT|ET|PEN|LIVE)$', re.IGNORECASE)
    
    def is_valid_team_name(name):
        """Check if a string is likely a valid team name."""
        if not name or len(name) < 2 or len(name) > 50:
            return False
        name_lower = name.lower().strip()
        
        # Skip if it's just a score
        if SCORE_PATTERN.match(name):
            return False
        # Skip if it's just a time
        if TIME_PATTERN.match(name):
            return False
        # Skip if it's a single number (odds or score)
        if name.replace('.', '').replace(',', '').isdigit():
            return False
        # Skip if it matches league keywords exactly
        if name_lower in LEAGUE_KEYWORDS:
            return False
        # Skip if name contains newlines (dirty data)
        if '\n' in name:
            return False
        # Skip if starts with common non-team patterns
        if name_lower.startswith(('vs ', 'vs.')) or name_lower == 'vs':
            return False
        return True
    
    def clean_team_name(name):
        """Clean and normalize team name."""
        if not name:
            return None
        # Remove common artifacts
        name = name.strip()
        name = name.replace(' - ', ' ').replace('- ', '').replace(' -', '')
        # Remove leading/trailing special chars
        name = re.sub(r'^[\-–\s]+|[\-–\s]+$', '', name)
        # Remove score patterns that might be attached
        name = re.sub(r'\s*\d+\s*[-–:]\s*\d+\s*$', '', name)
        name = re.sub(r'^\s*\d+\s*[-–:]\s*\d+\s*', '', name)
        return name.strip() if is_valid_team_name(name.strip()) else None
    
    try:
        time.sleep(3)
        
        # OddsPortal match row selectors - try multiple patterns
        match_rows = driver.find_elements(By.CSS_SELECTOR, 
            '.eventRow, [class*="eventRow"], [data-id], div[class*="flex"][class*="border-b"]')
        
        logger.info(f"[DOM] Found {len(match_rows)} potential match rows")
        
        seen_matches = set()  # Dedupe
        
        for row in match_rows:
            try:
                row_text = row.text.strip()
                
                # Skip empty/short rows
                if not row_text or len(row_text) < 10:
                    continue
                
                # Skip rows that look like headers (country/league only)
                lines = [l.strip() for l in row_text.split('\n') if l.strip()]
                if len(lines) < 3:  # A proper match row needs: team1, team2, at least one odd
                    continue
                
                match_info = {}
                home_team = None
                away_team = None
                
                # Strategy 1: Look for anchor links pointing to team pages
                team_links = row.find_elements(By.CSS_SELECTOR, 'a[href*="/football/"][href*="/team/"]')
                if len(team_links) >= 2:
                    home_team = clean_team_name(team_links[0].text)
                    away_team = clean_team_name(team_links[1].text)
                
                # Strategy 2: Look for participant elements
                if not (home_team and away_team):
                    participants = row.find_elements(By.CSS_SELECTOR, 
                        '[class*="participant"], [class*="team-name"], [class*="name"]>span, span[class*="truncate"]')
                    valid_names = [clean_team_name(p.text) for p in participants if clean_team_name(p.text)]
                    if len(valid_names) >= 2:
                        home_team = valid_names[0]
                        away_team = valid_names[1]
                
                # Strategy 3: Parse from text lines - find two consecutive valid team names
                if not (home_team and away_team):
                    potential_teams = []
                    for line in lines:
                        cleaned = clean_team_name(line)
                        if cleaned:
                            potential_teams.append(cleaned)
                        if len(potential_teams) >= 2:
                            break
                    if len(potential_teams) >= 2:
                        home_team = potential_teams[0]
                        away_team = potential_teams[1]
                
                # Skip if we couldn't find valid teams
                if not (home_team and away_team):
                    logger.debug(f"[DOM] Skipping row - no valid teams: {row_text[:50]}...")
                    continue
                
                # Dedupe check
                match_key = f"{home_team.lower()}_{away_team.lower()}"
                if match_key in seen_matches:
                    continue
                seen_matches.add(match_key)
                
                match_info['homeTeam'] = home_team
                match_info['awayTeam'] = away_team
                
                # Extract score
                score_elems = row.find_elements(By.CSS_SELECTOR, 
                    '[class*="score"], [class*="result"], span[class*="font-bold"]')
                for s in score_elems:
                    text = s.text.strip()
                    if SCORE_PATTERN.match(text):
                        match_info['score'] = text.replace('–', '-')
                        break
                
                # Extract match time/minute
                time_elems = row.find_elements(By.CSS_SELECTOR, 
                    '[class*="time"], [class*="minute"], [class*="stage"]')
                for t in time_elems:
                    text = t.text.strip()
                    if TIME_PATTERN.match(text):
                        match_info['minute'] = text
                        break
                
                # Extract odds - ENHANCED: Multiple strategies for OddsPortal 2026
                odds_values = []
                
                # Strategy 1: OddsPortal specific - p.height-content elements inside odds cells
                try:
                    odds_cells = row.find_elements(By.CSS_SELECTOR, 
                        'p.height-content, div[class*="odds"] > p, [class*="odds-value"] p, span[data-v][class*="truncate"]')
                    for cell in odds_cells:
                        text = cell.text.strip()
                        try:
                            val = float(text)
                            if 1.01 <= val <= 50.0 and text not in odds_values:
                                odds_values.append(text)
                                logger.debug(f"[ODDS] Strategy 1 found: {text}")
                        except ValueError:
                            pass
                except Exception as e:
                    logger.debug(f"[ODDS] Strategy 1 failed: {e}")
                
                # Strategy 2: Look for clickable odds buttons with decimal text
                if len(odds_values) < 3:
                    try:
                        buttons = row.find_elements(By.CSS_SELECTOR, 
                            'button[class*="flex"], a[class*="flex"], div[role="button"]')
                        for btn in buttons:
                            # Get innerText of the button, looking for decimal odds
                            inner = btn.text.strip()
                            # OddsPortal often has odds in nested spans
                            try:
                                val = float(inner)
                                if 1.01 <= val <= 50.0 and inner not in odds_values:
                                    odds_values.append(inner)
                                    logger.debug(f"[ODDS] Strategy 2 found: {inner}")
                            except ValueError:
                                # Try to extract from inner elements
                                for span in btn.find_elements(By.TAG_NAME, 'span'):
                                    span_text = span.text.strip()
                                    try:
                                        val = float(span_text)
                                        if 1.01 <= val <= 50.0 and span_text not in odds_values:
                                            odds_values.append(span_text)
                                            logger.debug(f"[ODDS] Strategy 2b found: {span_text}")
                                    except ValueError:
                                        pass
                    except Exception as e:
                        logger.debug(f"[ODDS] Strategy 2 failed: {e}")
                
                # Strategy 3: Find all text nodes matching decimal pattern
                if len(odds_values) < 3:
                    try:
                        # Use a broad selector and filter by text content
                        all_elems = row.find_elements(By.XPATH, 
                            './/*[not(self::script)][not(self::style)][string-length(normalize-space(text())) > 0]')
                        for elem in all_elems:
                            try:
                                text = elem.text.strip()
                                # Match decimal odds pattern: X.XX where X is 1-50
                                if re.match(r'^\d{1,2}\.\d{1,2}$', text):
                                    val = float(text)
                                    if 1.01 <= val <= 50.0 and text not in odds_values:
                                        odds_values.append(text)
                                        logger.debug(f"[ODDS] Strategy 3 found: {text}")
                            except:
                                pass
                    except Exception as e:
                        logger.debug(f"[ODDS] Strategy 3 failed: {e}")
                
                # Strategy 4: Parse from raw text lines (last resort)
                if len(odds_values) < 2:
                    for line in lines:
                        line_clean = line.strip()
                        try:
                            # Only accept proper decimal format
                            if re.match(r'^\d{1,2}\.\d{1,2}$', line_clean):
                                val = float(line_clean)
                                if 1.01 <= val <= 50.0 and line_clean not in odds_values:
                                    odds_values.append(line_clean)
                        except ValueError:
                            pass
                
                # Build odds object
                if len(odds_values) >= 3:
                    match_info['odds'] = {
                        'home': odds_values[0],
                        'draw': odds_values[1],
                        'away': odds_values[2]
                    }
                    logger.info(f"[ODDS] Full 1X2 odds: {odds_values[0]} | {odds_values[1]} | {odds_values[2]}")
                elif len(odds_values) == 2:
                    match_info['odds'] = {
                        'home': odds_values[0],
                        'away': odds_values[1]
                    }
                    logger.info(f"[ODDS] Partial odds: {odds_values[0]} | {odds_values[1]}")
                
                # Only add if we have at least teams + (odds or score)
                if match_info.get('homeTeam') and match_info.get('awayTeam') and (match_info.get('odds') or match_info.get('score')):
                    odds_data['matches'].append(match_info)
                    logger.info(f"[DOM] Captured: {match_info['homeTeam']} vs {match_info['awayTeam']}")
                    
            except Exception as e:
                logger.debug(f"[DOM] Error parsing row: {e}")
                continue
        
        logger.info(f"[DOM] Parsed {len(odds_data['matches'])} matches from page")
        
    except Exception as e:
        logger.error(f"[DOM] Error parsing page: {e}")
    
    return odds_data



def capture_network_odds(driver, logs):
    """Capture odds data from network requests."""
    odds_data = {
        'matches': [],
        'timestamp': int(time.time()),
        'source': 'oddsportal_api'
    }
    
    for entry in logs:
        try:
            message = json.loads(entry['message'])['message']
            method = message.get('method')
            
            if method == 'Network.responseReceived':
                params = message.get('params', {})
                response = params.get('response', {})
                request_url = response.get('url', '')
                
                # OddsPortal API patterns
                if any(pattern in request_url for pattern in [
                    '/ajax-sport-country-tournament-archive',
                    '/match-odds',
                    '/feed/match',
                    '/api/',
                    '/live-now'
                ]):
                    try:
                        request_id = params['requestId']
                        response_body = driver.execute_cdp_cmd('Network.getResponseBody', {'requestId': request_id})
                        body = response_body.get('body', '')
                        
                        if body:
                            # Try to parse as JSON
                            try:
                                json_data = json.loads(body)
                                logger.info(f"[NETWORK] Captured API response from: {request_url[:80]}...")
                                
                                # Store raw API data for analysis
                                api_file = 'server/odds_api_raw.json'
                                with open(api_file, 'w', encoding='utf-8') as f:
                                    json.dump(json_data, f, indent=2)
                                    
                            except json.JSONDecodeError:
                                # Might be HTML or other format
                                pass
                                
                    except Exception as e:
                        continue
                        
        except Exception:
            continue
    
    return odds_data


def capture_oddsportal():
    """Main capture loop for OddsPortal live odds."""
    driver = None
    
    try:
        driver = get_scraper()
        
        # Navigate to OddsPortal - use matches/football/ which worked in debug
        # The /live/ URL returns 404, fallback to regular matches page with odds
        url = "https://www.oddsportal.com/matches/football/"
        logger.info(f"[SCRAPER] Navigating to {url}...")
        driver.get(url)
        
        # Wait for page to fully load
        time.sleep(15)
        
        # Accept cookies if popup appears
        try:
            cookie_btn = driver.find_elements(By.XPATH, "//*[contains(text(), 'Accept') or contains(text(), 'agree')]")
            if cookie_btn:
                cookie_btn[0].click()
                time.sleep(2)
        except:
            pass
        
        last_fetch = 0
        last_page_refresh = time.time()
        first_run = True
        
        while True:
            current_time = time.time()
            
            # Fetch odds periodically
            if current_time - last_fetch > ODDS_FETCH_INTERVAL:
                logger.info(f"[SCRAPER] Fetching live odds (TS: {int(current_time)})")
                
                # Debug: Screenshot and page info on first run
                if first_run:
                    try:
                        driver.save_screenshot("server/odds_live_debug.png")
                        logger.info("[DEBUG] Screenshot saved to server/odds_live_debug.png")
                        
                        # Log page title and check for Cloudflare
                        logger.info(f"[DEBUG] Page Title: {driver.title}")
                        
                        # Log body text preview
                        body_text = driver.find_element(By.TAG_NAME, "body").text[:1000]
                        logger.info(f"[DEBUG] Body Preview: {body_text[:500]}")
                        
                        # Check if blocked
                        if "Just a moment" in driver.page_source or "Checking your browser" in driver.page_source:
                            logger.warning("[DEBUG] CLOUDFLARE BLOCK DETECTED!")
                        
                        first_run = False
                    except Exception as e:
                        logger.error(f"[DEBUG] Error capturing debug info: {e}")
                
                # Get network logs
                logs = driver.get_log('performance')
                
                # Try network capture first
                odds_from_network = capture_network_odds(driver, logs)
                
                # Fallback: Parse from DOM
                odds_from_dom = parse_odds_from_page(driver)
                
                # Use whichever has more data
                if len(odds_from_network['matches']) > len(odds_from_dom['matches']):
                    odds_data = odds_from_network
                else:
                    odds_data = odds_from_dom
                
                # Save to file
                if odds_data['matches']:
                    with open(DATA_FILE, 'w', encoding='utf-8') as f:
                        json.dump(odds_data, f, indent=2)
                    
                    # Firebase Upload
                    try:
                        from firebase_uploader import upload_to_firebase
                        upload_to_firebase("live_odds", odds_data)
                    except:
                        pass

                    logger.info(f"[SCRAPER] Saved {len(odds_data['matches'])} matches to {DATA_FILE}")
                else:
                    logger.warning("[SCRAPER] No odds data captured this cycle")
                
                last_fetch = current_time
            
            # Refresh page every 5 minutes to avoid stale data
            if current_time - last_page_refresh > 300:
                logger.info("[SCRAPER] Refreshing page...")
                driver.refresh()
                time.sleep(8)
                last_page_refresh = current_time
            
            time.sleep(5)
            
    except Exception as e:
        logger.error(f"[FATAL] Error in capture loop: {e}", exc_info=True)
    finally:
        if driver:
            driver.quit()


def try_flashscore_fallback():
    """Fallback to Flashscore if OddsPortal fails."""
    logger.info("[FALLBACK] Trying Flashscore as alternative...")
    driver = None
    
    try:
        driver = get_scraper()
        url = "https://www.flashscore.com/"
        driver.get(url)
        time.sleep(10)
        
        odds_data = {
            'matches': [],
            'timestamp': int(time.time()),
            'source': 'flashscore'
        }
        
        # Flashscore shows odds on hover/click
        # This is a simplified version
        match_rows = driver.find_elements(By.CSS_SELECTOR, '.event__match, [id*="g_1_"]')
        
        for row in match_rows:
            try:
                match_info = {}
                
                home = row.find_elements(By.CSS_SELECTOR, '.event__participant--home, .event__homeParticipant')
                away = row.find_elements(By.CSS_SELECTOR, '.event__participant--away, .event__awayParticipant')
                
                if home and away:
                    match_info['homeTeam'] = home[0].text.strip()
                    match_info['awayTeam'] = away[0].text.strip()
                
                score_home = row.find_elements(By.CSS_SELECTOR, '.event__score--home')
                score_away = row.find_elements(By.CSS_SELECTOR, '.event__score--away')
                
                if score_home and score_away:
                    match_info['score'] = f"{score_home[0].text}-{score_away[0].text}"
                
                # Flashscore odds require clicking or API
                # For now, just capture match info
                
                if match_info.get('homeTeam'):
                    odds_data['matches'].append(match_info)
                    
            except:
                continue
        
        if odds_data['matches']:
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(odds_data, f, indent=2)
            
            # Firebase Upload
            try:
                from firebase_uploader import upload_to_firebase
                upload_to_firebase("live_odds", odds_data)
            except:
                pass

            logger.info(f"[FLASHSCORE] Saved {len(odds_data['matches'])} matches")
            
    except Exception as e:
        logger.error(f"[FLASHSCORE] Error: {e}")
    finally:
        if driver:
            driver.quit()


if __name__ == "__main__":
    if not os.path.exists('server'):
        os.makedirs('server')
    
    logger.info("=" * 50)
    logger.info("ODDS SCRAPER STARTING")
    logger.info("=" * 50)
    
    try:
        capture_oddsportal()
    except Exception as e:
        logger.error(f"OddsPortal failed: {e}")
        logger.info("Attempting Flashscore fallback...")
        try_flashscore_fallback()
