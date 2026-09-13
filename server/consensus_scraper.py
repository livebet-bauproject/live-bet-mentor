import time
import json
import os
import sys

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

import sqlite3
import re
from urllib.parse import unquote
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import undetected_chromedriver as uc

# CONFIG
SITES = {
    "soccervista": "https://www.soccervista.com/",
    "superbet": "https://superbetpredictions.com/",
    "prosoccer": "https://www.prosoccer.gr/en/football/predictions/",
    "predictz": "https://www.predictz.com/predictions/today/",
    "windrawwin": "https://www.windrawwin.com/predictions/today/kick-off-time/",
    "statarea": "https://www.statarea.com/predictions"
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, "consensus_data.json")

class ConsensusScraper:
    def __init__(self):
        self.results = {}
        # Load existing data to avoid wiping out sources that haven't run yet
        if os.path.exists(OUTPUT_FILE):
            try:
                with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                    raw_data = json.load(f)
                    # Migration: Convert old "prediction" format to new "markets" format
                    for site, matches in raw_data.items():
                        if site == "standings":
                            self.results[site] = matches
                            continue
                            
                        migrated_matches = []
                        if isinstance(matches, list):
                            for m in matches:
                                if isinstance(m, dict) and "prediction" in m and "markets" not in m:
                                    m["markets"] = {
                                        "1X2": {
                                            "pred": m.pop("prediction"),
                                            "prob": m.pop("probability", "0")
                                        }
                                    }
                                migrated_matches.append(m)
                            self.results[site] = migrated_matches
                        else:
                            # Catch all for unexpected non-list data types
                            self.results[site] = matches
                print(f"[CONSENSUS] Loaded and migrated {len(self.results)} sources")
            except Exception as e:
                print(f"[CONSENSUS] Could not load/migrate existing data: {e}")

    def get_driver(self, use_mobile=False, headless=False):
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
            if use_mobile:
                options.add_argument('--window-size=375,812')
            else:
                options.add_argument('--window-size=1920,1080')
            options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36')

            service = Service(executable_path=driver_path)
            driver = webdriver.Chrome(service=service, options=options)
            return driver
        except Exception as e:
            print(f"[CONSENSUS] Direct Selenium launch failed: {e}, falling back to uc...")

        # Priority 2: uc fallback
        options = uc.ChromeOptions()
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--headless=new')
        if use_mobile:
            options.add_argument('--window-size=375,812')
        else:
            options.add_argument('--window-size=1920,1080')

        return uc.Chrome(options=options, driver_executable_path=driver_path, use_subprocess=True)

    def save_results(self):
        # Save to local JSON file
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, ensure_ascii=False, indent=4)
        print(f"[CONSENSUS] Data saved to {OUTPUT_FILE}")
        
        # Also upload to Firebase
        try:
            from firebase_uploader import upload_to_firebase
            upload_to_firebase("consensus", self.results)
        except Exception as e:
            print(f"[CONSENSUS] Firebase upload failed: {e}")



    def scrape_prosoccer(self):
        print("[CONSENSUS] Scraping ProSoccer.gr...")
        driver = self.get_driver(use_mobile=False, headless=False)
        try:
            driver.get(SITES["prosoccer"])
            time.sleep(10)
            
            # Bypass SSL warning if it appears
            try:
                # Check for "Advanced" button in Chrome/UC SSL warning page
                if "Advanced" in driver.page_source or "Gelişmiş" in driver.page_source:
                    print("[CONSENSUS] ProSoccer: Bypassing SSL security warning...")
                    driver.execute_script("if(document.getElementById('details-button')) document.getElementById('details-button').click();")
                    time.sleep(2)
                    driver.execute_script("if(document.getElementById('proceed-link')) document.getElementById('proceed-link').click();")
                    time.sleep(10)
            except Exception as e:
                print(f"[CONSENSUS] ProSoccer SSL bypass attempt: {e}")

            time.sleep(5) # Wait for DataTables initialization
            
            predictions = []
            # ProSoccer rows are in #tblPredictions
            rows = driver.find_elements("css selector", "#tblPredictions tbody tr")
            print(f"[CONSENSUS] ProSoccer: Found {len(rows)} rows")
            
            for row in rows:
                try:
                    cells = row.find_elements("xpath", "./td")
                    if len(cells) < 7: continue
                    
                    # Teams: index 2 (td.mio.fc1)
                    teams_text = cells[2].get_attribute("textContent").strip().replace('\xa0', ' ')
                    if " - " not in teams_text: continue
                    home, away = teams_text.split(" - ", 1)
                    
                    # Probabilities: cells[3]=1, cells[4]=X, cells[5]=2
                    prob_1 = "0"
                    prob_x = "0"
                    prob_2 = "0"
                    try:
                        prob_1 = cells[3].get_attribute("textContent").strip()
                        prob_x = cells[4].get_attribute("textContent").strip()
                        prob_2 = cells[5].get_attribute("textContent").strip()
                    except:
                        pass
                    
                    # Tip from span.sctip or cells[6]
                    tip_1x2 = "N/A"
                    raw_tip = ""
                    try:
                        tip_el = row.find_element("css selector", "span.sctip")
                        raw_tip = tip_el.get_attribute("textContent").strip().lower()
                    except:
                        try:
                            raw_tip = cells[6].get_attribute("textContent").strip().lower()
                        except:
                            pass
                    
                    # More flexible tip parsing
                    if raw_tip:
                        raw_tip = raw_tip.replace(" ", "")
                        if raw_tip in ["1", "a1", "1+", "home"]: tip_1x2 = "1"
                        elif raw_tip in ["x", "ax", "0", "draw"]: tip_1x2 = "X"
                        elif raw_tip in ["2", "a2", "2+", "away"]: tip_1x2 = "2"
                        elif raw_tip in ["1x", "a1x", "x1"]: tip_1x2 = "1X"
                        elif raw_tip in ["x2", "ax2", "2x"]: tip_1x2 = "X2"
                        elif raw_tip in ["12", "a12", "noaw"]: tip_1x2 = "12"
                    
                    # OU 2.5 from cells[12] and [13] if they exist
                    tip_ou = "N/A"
                    if len(cells) > 13:
                        try:
                            under_prob = int(cells[12].get_attribute("textContent").strip() or "0")
                            over_prob = int(cells[13].get_attribute("textContent").strip() or "0")
                            if over_prob > 0 or under_prob > 0:
                                tip_ou = "OVER" if over_prob > under_prob else "UNDER"
                        except:
                            pass
                    
                    # Predicted score from cells[10] and [11] if available
                    score_pred = "N/A"
                    if len(cells) > 11:
                        try:
                            h_score = cells[10].get_attribute("textContent").strip()
                            a_score = cells[11].get_attribute("textContent").strip()
                            if h_score.isdigit() and a_score.isdigit():
                                score_pred = f"{h_score}-{a_score}"
                                
                                # CONSISTENCY CHECK: Derive 1X2 from score if they conflict
                                h_val = int(h_score)
                                a_val = int(a_score)
                                score_based_tip = "1" if h_val > a_val else ("2" if a_val > h_val else "X")
                                
                                # If tip_1x2 conflicts with score_pred, use score-based tip
                                if tip_1x2 != "N/A" and tip_1x2 != score_based_tip:
                                    print(f"[PROSOCCER] Conflict resolved: {home} vs {away} - Tip '{tip_1x2}' conflicts with score '{score_pred}', using '{score_based_tip}'")
                                    tip_1x2 = score_based_tip
                                elif tip_1x2 == "N/A":
                                    tip_1x2 = score_based_tip
                        except:
                            pass
                    
                    m_time = ""
                    try:
                        time_el = row.find_element("css selector", "td.fc7")
                        m_time = time_el.get_attribute("textContent").strip()
                    except:
                        for cell in cells[:3]:
                            txt = cell.get_attribute("textContent").strip()
                            t_match = re.search(r'(\d{2}:\d{2})', txt)
                            if t_match:
                                m_time = t_match.group(1)
                                break

                    # Only add if we have a valid prediction
                    if tip_1x2 != "N/A" or tip_ou != "N/A":
                        match_obj = {
                            "home": home.strip(), 
                            "away": away.strip(),
                            "score_pred": score_pred,
                            "timestamp": datetime.now().isoformat(),
                            "markets": {
                                "1X2": {
                                    "pred": tip_1x2, 
                                    "prob": prob_1 if tip_1x2 == "1" else (prob_2 if tip_1x2 == "2" else prob_x),
                                    "prob_full": f"{prob_1}/{prob_x}/{prob_2}"
                                },
                                "OU25": {"pred": tip_ou}
                            },
                            "date": datetime.now().strftime("%d.%m"),
                            "time": m_time
                        }
                        
                        predictions.append(match_obj)
                except: continue
                
            if predictions: 
                self.results["prosoccer"] = predictions
                print(f"[CONSENSUS] ProSoccer: Scraped {len(predictions)} matches")
            else:
                print("[CONSENSUS] ProSoccer: No predictions found, keeping old ones.")
        except Exception as e: 
            print(f"[CONSENSUS] ProSoccer error: {e}")
        finally: 
            driver.quit()


    def scrape_predictz(self):
        print("[CONSENSUS] Scraping PredictZ (Desktop Mode)...")
        driver = self.get_driver(use_mobile=False, headless=False)
        try:
            predictions = []
            
            # Scrape both today and tomorrow pages
            urls_to_scrape = [
                ("https://www.predictz.com/predictions/today/", datetime.now().strftime("%d.%m")),
                ("https://www.predictz.com/predictions/tomorrow/", (datetime.now() + __import__('datetime').timedelta(days=1)).strftime("%d.%m"))
            ]
            
            for url, date_str in urls_to_scrape:
                driver.get(url)
                time.sleep(10)
                
                # Cookie consent handling
                try:
                    consent_btn = driver.find_element(By.CSS_SELECTOR, ".cc_btn_accept_all, #cc_btn_accept_all, button[class*='accept']")
                    if consent_btn.is_displayed():
                        consent_btn.click()
                        print("[PREDICTZ] Cookie consent accepted")
                        time.sleep(2)
                except: pass
                
                # Close popup if exists
                try:
                    close_btn = driver.find_element(By.CSS_SELECTOR, "#intclose, .closeint, [id*='close']")
                    if close_btn.is_displayed():
                        close_btn.click()
                        print("[PREDICTZ] Popup closed")
                        time.sleep(1)
                except: pass
                
                # Scroll to load all content
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(3)
                driver.execute_script("window.scrollTo(0, 0);")
                time.sleep(2)
                
                # Use correct selector: .pttr.ptcnt for match rows (not header rows)
                rows = driver.find_elements(By.CSS_SELECTOR, ".pttr.ptcnt")
                print(f"[PREDICTZ] {url.split('/')[-2]}: Found {len(rows)} match rows")
                
                for row in rows:
                    try:
                        # Teams from .pttd.ptgame
                        game_el = row.find_elements(By.CSS_SELECTOR, ".pttd.ptgame a, .pttd.ptgame")
                        if not game_el:
                            game_el = row.find_elements(By.CSS_SELECTOR, ".ptgame a, .ptgame")
                        if not game_el:
                            continue
                        
                        match_text = game_el[0].get_attribute("textContent").strip()
                        if not match_text:
                            match_text = game_el[0].text.strip()
                        
                        # Clean "MATCH PREVIEW" text
                        match_text = match_text.replace("MATCH PREVIEW", "").strip()
                        
                        # Split teams
                        home = ""
                        away = ""
                        if ' v ' in match_text:
                            home, away = match_text.split(' v ', 1)
                        elif ' vs ' in match_text.lower():
                            parts = match_text.lower().split(' vs ', 1)
                            home, away = parts[0], parts[1]
                        elif ' - ' in match_text:
                            home, away = match_text.split(' - ', 1)
                        else:
                            continue
                        
                        home = home.strip()
                        away = away.strip()
                        
                        if not home or not away:
                            continue
                        
                        # Prediction from .pttd.ptprd
                        pred = "N/A"
                        markets = {}
                        score_pred = "N/A"
                        
                        pred_selectors = [".pttd.ptprd", ".ptprd", ".ptpredboxsml"]
                        for sel in pred_selectors:
                            try:
                                pred_el = row.find_element(By.CSS_SELECTOR, sel)
                                pred_text = pred_el.get_attribute("textContent").strip().replace("MATCH PREVIEW", "").strip().lower()
                                
                                # Score prediction (e.g., "Home 2-1" or just "2-1")
                                score_match = re.search(r'(\d+)\s*[-:]\s*(\d+)', pred_text)
                                if score_match:
                                    h_score = int(score_match.group(1))
                                    a_score = int(score_match.group(2))
                                    score_pred = f"{h_score}-{a_score}"
                                    if h_score > a_score: pred = "1"
                                    elif h_score < a_score: pred = "2"
                                    else: pred = "X"
                                    markets["1X2"] = {"pred": pred}
                                    markets["BTTS"] = {"pred": "Yes" if h_score > 0 and a_score > 0 else "No"}
                                    markets["OU25"] = {"pred": "OVER" if (h_score + a_score) > 2.5 else "UNDER"}
                                    break
                                
                                # Direct prediction text
                                if "home" in pred_text or pred_text == "1": 
                                    pred = "1"
                                elif "away" in pred_text or pred_text == "2": 
                                    pred = "2"
                                elif "draw" in pred_text or pred_text == "x": 
                                    pred = "X"
                                
                                if pred != "N/A":
                                    markets["1X2"] = {"pred": pred}
                                    break
                            except: 
                                continue
                        
                        # Get odds from .pttd.ptodds elements
                        try:
                            odds_els = row.find_elements(By.CSS_SELECTOR, ".pttd.ptodds")
                            if len(odds_els) >= 3:
                                odds_1 = odds_els[0].get_attribute("textContent").strip()
                                odds_x = odds_els[1].get_attribute("textContent").strip()
                                odds_2 = odds_els[2].get_attribute("textContent").strip()
                                if "1X2" in markets:
                                    markets["1X2"]["odds_1"] = odds_1
                                    markets["1X2"]["odds_x"] = odds_x
                                    markets["1X2"]["odds_2"] = odds_2
                        except: pass
                        
                        if home and away and pred != "N/A":
                            predictions.append({
                                "home": home.strip(),
                                "away": away.strip(),
                                "score_pred": score_pred,
                                "markets": markets,
                                "timestamp": datetime.now().isoformat(),
                                "date": date_str
                            })
                    except:
                        continue
            
            if predictions:
                self.results["predictz"] = predictions
                print(f"[CONSENSUS] PredictZ: Scraped {len(predictions)} total matches")
            else:
                print("[CONSENSUS] PredictZ: No new predictions found, keeping old ones.")
        except Exception as e:
            print(f"[CONSENSUS] PredictZ error: {e}")
        finally:
            driver.quit()

    def scrape_windrawwin(self):
        print("[CONSENSUS] Scraping WinDrawWin (DIV-based Mode)...")
        driver = self.get_driver(use_mobile=False, headless=False)
        try:
            # WDW main predictions page
            driver.get("https://www.windrawwin.com/predictions/today/")
            time.sleep(15)
            
            # Also scrape tomorrow for more data
            predictions = []
            
            # NEW: WinDrawWin uses .wttr divs instead of table rows
            # Structure: .wttr > .wtdesklnk (teams), .wtprd (prediction), .wtsc (score)
            rows = driver.find_elements(By.CSS_SELECTOR, ".wttr")
            print(f"[CONSENSUS] WinDrawWin: Found {len(rows)} .wttr rows")
            
            for row in rows:
                try:
                    # Team names from .wtdesklnk link
                    teams_el = row.find_elements(By.CSS_SELECTOR, ".wtdesklnk")
                    if not teams_el:
                        teams_el = row.find_elements(By.CSS_SELECTOR, "a[href*='/match/']")
                    
                    if not teams_el:
                        continue
                    
                    teams_text = teams_el[0].get_attribute("textContent").strip()
                    if " v " not in teams_text:
                        continue
                    
                    home, away = teams_text.split(" v ", 1)
                    home = home.strip()
                    away = away.strip()
                    
                    if not home or not away:
                        continue
                    
                    # Prediction from .wtprd element
                    pred = "N/A"
                    markets = {}
                    
                    try:
                        pred_el = row.find_element(By.CSS_SELECTOR, ".wtprd")
                        pred_text = pred_el.get_attribute("textContent").strip().lower()
                        
                        if "home win" in pred_text or pred_text == "1":
                            pred = "1"
                        elif "away win" in pred_text or pred_text == "2":
                            pred = "2"
                        elif "draw" in pred_text or pred_text == "x":
                            pred = "X"
                    except:
                        pass
                    
                    # Score prediction from .wtsc element
                    score_pred = "N/A"
                    try:
                        score_el = row.find_element(By.CSS_SELECTOR, ".wtsc")
                        score_pred = score_el.get_attribute("textContent").strip()
                        
                        # Infer prediction from score if not already set
                        if pred == "N/A" and "-" in score_pred:
                            parts = score_pred.split("-")
                            if len(parts) == 2:
                                h_score = int(parts[0].strip())
                                a_score = int(parts[1].strip())
                                if h_score > a_score:
                                    pred = "1"
                                elif a_score > h_score:
                                    pred = "2"
                                else:
                                    pred = "X"
                                # Infer BTTS and OU from score
                                markets["BTTS"] = {"pred": "Yes" if h_score > 0 and a_score > 0 else "No"}
                                markets["OU25"] = {"pred": "OVER" if (h_score + a_score) > 2.5 else "UNDER"}
                    except:
                        pass
                    
                    # Odds from data attributes
                    try:
                        home_odds_el = row.find_element(By.CSS_SELECTOR, "[data-type='MH']")
                        home_odds = home_odds_el.get_attribute("textContent").strip()
                    except:
                        home_odds = ""
                    
                    try:
                        draw_odds_el = row.find_element(By.CSS_SELECTOR, "[data-type='MD']")
                        draw_odds = draw_odds_el.get_attribute("textContent").strip()
                    except:
                        draw_odds = ""
                    
                    try:
                        away_odds_el = row.find_element(By.CSS_SELECTOR, "[data-type='MA']")
                        away_odds = away_odds_el.get_attribute("textContent").strip()
                    except:
                        away_odds = ""
                    
                    # Stake/Confidence from .wtstk
                    stake = ""
                    try:
                        stake_el = row.find_element(By.CSS_SELECTOR, ".wtstk")
                        stake = stake_el.get_attribute("textContent").strip()
                    except:
                        pass
                    
                    if pred != "N/A" or score_pred != "N/A":
                        markets["1X2"] = {
                            "pred": pred,
                            "odds": home_odds if pred == "1" else (away_odds if pred == "2" else draw_odds),
                            "odds_1": home_odds,
                            "odds_x": draw_odds,
                            "odds_2": away_odds
                        }
                        predictions.append({
                            "home": home,
                            "away": away,
                            "score_pred": score_pred,
                            "stake": stake,
                            "markets": markets,
                            "date": datetime.now().strftime("%d.%m"),
                            "timestamp": datetime.now().isoformat()
                        })
                except Exception as e:
                    continue
            
            # Try tomorrow page for more data
            try:
                driver.get("https://www.windrawwin.com/predictions/tomorrow/")
                time.sleep(10)
                
                tomorrow_rows = driver.find_elements(By.CSS_SELECTOR, ".wttr")
                print(f"[CONSENSUS] WinDrawWin Tomorrow: Found {len(tomorrow_rows)} rows")
                
                for row in tomorrow_rows:
                    try:
                        teams_el = row.find_elements(By.CSS_SELECTOR, ".wtdesklnk")
                        if not teams_el:
                            continue
                        
                        teams_text = teams_el[0].get_attribute("textContent").strip()
                        if " v " not in teams_text:
                            continue
                        
                        home, away = teams_text.split(" v ", 1)
                        
                        pred = "N/A"
                        markets = {}
                        
                        try:
                            pred_el = row.find_element(By.CSS_SELECTOR, ".wtprd")
                            pred_text = pred_el.get_attribute("textContent").strip().lower()
                            if "home" in pred_text: pred = "1"
                            elif "away" in pred_text: pred = "2"
                            elif "draw" in pred_text: pred = "X"
                        except:
                            pass
                        
                        score_pred = "N/A"
                        try:
                            score_el = row.find_element(By.CSS_SELECTOR, ".wtsc")
                            score_pred = score_el.get_attribute("textContent").strip()
                        except:
                            pass
                        
                        if pred != "N/A":
                            markets["1X2"] = {"pred": pred}
                            predictions.append({
                                "home": home.strip(),
                                "away": away.strip(),
                                "score_pred": score_pred,
                                "markets": markets,
                                "date": (datetime.now() + __import__('datetime').timedelta(days=1)).strftime("%d.%m"),
                                "timestamp": datetime.now().isoformat()
                            })
                    except:
                        continue
            except Exception as e:
                print(f"[CONSENSUS] WinDrawWin Tomorrow error: {e}")
            
            if predictions:
                self.results["windrawwin"] = predictions
                print(f"[CONSENSUS] WinDrawWin: Scraped {len(predictions)} total matches")
            else:
                print("[CONSENSUS] WinDrawWin: No predictions found, keeping old ones.")
        except Exception as e:
            print(f"[CONSENSUS] WinDrawWin error: {e}")
        finally:
            driver.quit()


    def scrape_statarea(self):
        print("[CONSENSUS] Scraping Statarea (innerHTML mode)...")
        driver = self.get_driver()
        try:
            url = SITES["statarea"]
            driver.get(url)
            time.sleep(15)
            
            predictions = []
            rows = driver.find_elements(By.CSS_SELECTOR, "div.cmatch")
            print(f"[CONSENSUS] Statarea: Found {len(rows)} match blocks")
            
            for row in rows:
                try:
                    # Team names: .teams a href contains team names (text is invisible)
                    # href format: /compare/teams/TeamA (Country)/TeamB (Country)
                    team_links = row.find_elements(By.CSS_SELECTOR, ".teams a")
                    if len(team_links) >= 2:
                        # Extract from href
                        href1 = team_links[0].get_attribute("href") or ""
                        href2 = team_links[1].get_attribute("href") or ""
                        
                        # Try to get from href: .../teams/Home (Country)/Away (Country)
                        home = ""
                        away = ""
                        
                        if "/teams/" in href1:
                            parts = href1.split("/teams/")[-1].split("/")
                            if parts:
                                home = unquote(parts[0].split(" (")[0].strip())
                        
                        if "/teams/" in href2:
                            parts = href2.split("/teams/")[-1].split("/")
                            if len(parts) > 1:
                                away = unquote(parts[1].split(" (")[0].strip())
                            elif parts:
                                away = unquote(parts[0].split(" (")[0].strip())
                        
                        # Fallback: try innerText or textContent
                        if not home:
                            home = team_links[0].get_attribute("textContent").strip() or team_links[0].get_attribute("innerText").strip()
                        if not away:
                            away = team_links[1].get_attribute("textContent").strip() or team_links[1].get_attribute("innerText").strip()
                    else:
                        continue
                    
                    if not home or not away:
                        continue
                    
                    # Prediction from innerHTML (text is invisible due to CSS visibility)
                    # Class mapping: type1=1, type2=?, type3=2, type5=X2, type6=12
                    pred = "N/A"
                    try:
                        tip_el = row.find_element(By.CSS_SELECTOR, ".tip")
                        inner_html = tip_el.get_attribute("innerHTML") or ""
                        
                        # Extract from innerHTML using class names
                        if 'type1' in inner_html:
                            # Check content
                            import re
                            match = re.search(r'type1["\']?>([^<]+)<', inner_html)
                            if match:
                                val = match.group(1).strip()
                                if val == "1": pred = "1"
                                elif val == "X": pred = "X"
                                elif val == "2": pred = "2"
                            else:
                                pred = "1"  # type1 usually means Home Win
                        elif 'type3' in inner_html:
                            pred = "2"  # type3 = Away Win based on debug
                        elif 'type2' in inner_html:
                            pred = "X"  # type2 likely Draw
                        elif 'type4' in inner_html or 'type5' in inner_html or 'type6' in inner_html:
                            # Double chance markets - skip for 1X2
                            continue
                        else:
                            # Try to extract any number
                            match = re.search(r'>([12X])<', inner_html)
                            if match:
                                pred = match.group(1)
                    except:
                        continue
                    
                    if pred == "N/A":
                        continue
                    
                    # Time
                    m_time = ""
                    try:
                        time_el = row.find_element(By.CSS_SELECTOR, ".time")
                        m_time = time_el.get_attribute("textContent").strip() or time_el.text.strip()
                    except: pass
                    
                    predictions.append({
                        "home": home, "away": away,
                        "date": datetime.now().strftime("%d.%m"),
                        "time": m_time,
                        "markets": {
                            "1X2": {"pred": pred}
                        },
                        "timestamp": datetime.now().isoformat()
                    })
                except:
                    continue
            
            if predictions:
                self.results["statarea"] = predictions
                print(f"[CONSENSUS] Statarea: Scraped {len(predictions)} matches")
            else:
                print("[CONSENSUS] Statarea: No new predictions found, keeping old ones.")
        except Exception as e:
            print(f"[CONSENSUS] Statarea error: {e}")
        finally:
            driver.quit()

    def scrape_vitibet(self):
        print("[CONSENSUS] Scraping Vitibet...")
        driver = self.get_driver()
        try:
            url = "https://www.vitibet.com/index.php?clanek=quicktips&sekce=fotbal&lang=en"
            driver.get(url)
            time.sleep(10)
            predictions = []
            
            # Vitibet uses a standard table for quicktips
            rows = driver.find_elements("css selector", "table tr")
            print(f"[CONSENSUS] Vitibet: Found {len(rows)} potential rows")
            
            current_league = "Unknown"
            for i, row in enumerate(rows):
                try:
                    # Check for league header
                    row_class = row.get_attribute("class") or ""
                    if "odseknutiligy" in row_class:
                        try:
                            # Try to get text from <a> or directly from the row
                            header_a = row.find_elements("css selector", "a")
                            temp_league = ""
                            if header_a:
                                temp_league = header_a[0].get_attribute("textContent").strip()
                            
                            if not temp_league:
                                temp_league = row.get_attribute("textContent").strip()
                            
                            if temp_league:
                                # Clean up league name (remove counts like (12))
                                current_league = re.sub(r'\s*\(\d+\)$', '', temp_league).strip()
                            continue
                        except: pass

                    cells = row.find_elements("xpath", "./td")
                    if len(cells) < 12: continue
                    
                    # Tarih deseni kontrolü (Satırın maç satırı olduğundan emin olmak için)
                    date_text = cells[0].get_attribute("textContent").strip()
                    if not re.match(r"^\d{2}\.\d{2}$", date_text): continue
                    
                    home = cells[2].get_attribute("textContent").strip()
                    away = cells[3].get_attribute("textContent").strip()
                    league = current_league # Use sticky league
                    
                    # Score Inference
                    score_h = cells[5].get_attribute("textContent").strip()
                    score_a = cells[7].get_attribute("textContent").strip()
                    
                    markets = {}
                    score_pred = "N/A"
                    if score_h.isdigit() and score_a.isdigit():
                        score_pred = f"{score_h}-{score_a}"
                        h_val = int(score_h)
                        a_val = int(score_a)
                        markets["BTTS"] = {"pred": "Yes" if h_val > 0 and a_val > 0 else "No"}
                        markets["OU25"] = {"pred": "OVER" if (h_val + a_val) > 2.5 else "UNDER"}
                    
                    tip_raw = cells[11].get_attribute("textContent").strip()
                    if not home or not away or not tip_raw: continue
                    
                    pred = "N/A"
                    if tip_raw in ["1", "10", "1X"]: pred = "1"
                    elif tip_raw in ["0", "X", "0-0", "0X", "X0"]: pred = "X"
                    elif tip_raw in ["2", "02", "X2"]: pred = "2"
                    
                    if pred != "N/A":
                        markets["1X2"] = {"pred": pred}
                        predictions.append({
                            "home": home, "away": away, 
                            "league": league, # Added league
                            "score_pred": score_pred,
                            "date": date_text,
                            "markets": markets,
                            "timestamp": datetime.now().isoformat()
                        })
                except: continue
            
            if predictions:
                self.results["vitibet"] = predictions
            else:
                print("[CONSENSUS] Vitibet: No new predictions found, keeping old ones.")
        except Exception as e: print(f"[CONSENSUS] Vitibet error: {e}")
        finally: driver.quit()

    def scrape_zulubet(self):
        print("[CONSENSUS] Scraping Zulubet...")
        driver = self.get_driver()
        try:
            driver.get("https://www.zulubet.com/")
            time.sleep(10)
            predictions = []
            
            # Find the main table explicitly
            table = driver.find_element("css selector", "table.content_table")
            rows = table.find_elements("css selector", "tr")
            print(f"[CONSENSUS] Zulubet: Found {len(rows)} potential rows")
            
            for row in rows:
                try:
                    # Get only direct child TDs to avoid nested table confusion
                    cells = row.find_elements("xpath", "./td")
                    if len(cells) < 7: continue
                    
                    # Match name is usually in cell index 1
                    match_el = cells[1]
                    txt = match_el.get_attribute("textContent").strip()
                    if " - " not in txt: continue
                    
                    # League info - try to get from title of flag img in cell 1
                    league = "Unknown"
                    try:
                        flag = match_el.find_element("css selector", "img.flags")
                        league = flag.get_attribute("title") or flag.get_attribute("alt") or "Unknown"
                    except: pass
                    
                    # Extract teams from the text
                    parts = txt.split(" - ")
                    if len(parts) >= 2:
                        home = parts[0].strip().split('\n')[-1].strip()
                        away = parts[1].strip().split('\n')[0].strip()
                        
                        # Tip is in index 6
                        tip = cells[6].get_attribute("textContent").strip()
                        
                        # Double chance support: 1X, X2, 12
                        pred = "N/A"
                        if tip in ["1", "X", "2", "1X", "X2", "12"]:
                            pred = tip
                        
                        if home and away and pred != "N/A":
                            m_date = datetime.now().strftime("%d.%m")
                            m_time = ""
                            try:
                                # cells[0] usually: "02-01, 14:00"
                                time_txt = cells[0].get_attribute("textContent").strip()
                                t_match = re.search(r'(\d{2}:\d{2})', time_txt)
                                if t_match: m_time = t_match.group(1)
                            except: pass

                            predictions.append({
                                "home": home, "away": away, 
                                "league": league,
                                "date": m_date,
                                "time": m_time,
                                "markets": {
                                    "1X2": {"pred": pred}
                                },
                                "timestamp": datetime.now().isoformat()
                            })
                except: continue
            self.results["zulubet"] = predictions
        except Exception as e: print(f"[CONSENSUS] Zulubet error: {e}")
        finally: driver.quit()

    def scrape_olbg(self):
        print("[CONSENSUS] Scraping OLBG (Global Popular Bets)...")
        driver = self.get_driver()
        try:
            driver.get("https://www.olbg.com/betting-tips/Football/1")
            # Wait for the list to load
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "li:has(h5)"))
            )
            time.sleep(5)
            
            predictions = []
            rows = driver.find_elements(By.CSS_SELECTOR, "li:has(h5)")
            print(f"[CONSENSUS] OLBG: Found {len(rows)} potential rows")
            
            for row in rows:
                try:
                    # Teams: "Home v Away"
                    teams_el = row.find_element(By.CSS_SELECTOR, ".rw.ev h5")
                    teams_text = teams_el.get_attribute("textContent").strip()
                    if " v " not in teams_text: continue
                    
                    home_away = teams_text.split(" v ")
                    home = home_away[0].strip()
                    away = home_away[1].strip()
                    
                    # League
                    league = "Unknown"
                    try:
                        league_el = row.find_element(By.CSS_SELECTOR, ".rw.ev p.text-sm:has(i.i-ui-trophy), .rw.ev p.text-sm")
                        league = league_el.get_attribute("textContent").strip()
                    except: pass

                    # Date and Time extraction
                    m_date = datetime.now().strftime("%d.%m")
                    m_time = ""
                    try:
                        # OLBG uses <time itemprop="startDate" datetime="...">
                        time_el = row.find_element(By.CSS_SELECTOR, "time")
                        iso_date = time_el.get_attribute("datetime")
                        raw_time_text = time_el.get_attribute("textContent").strip()
                        
                        if iso_date:
                            try:
                                dt_obj = datetime.fromisoformat(iso_date.replace('Z', '+00:00'))
                                m_date = dt_obj.strftime("%d.%m")
                                m_time = dt_obj.strftime("%H:%M")
                            except: pass
                        
                        # Fallback/Override: If time is still missing or we want to be sure
                        if not m_time or m_time == "00:00":
                            time_match = re.search(r'(\d{1,2}[:.]\d{2})', raw_time_text)
                            if time_match:
                                m_time = time_match.group(1).replace('.', ':')
                                # Ensure 0 prefix if needed (e.g. 8:35 -> 08:35)
                                if len(m_time.split(':')[0]) == 1:
                                    m_time = "0" + m_time

                        # Date fallback
                        if "Tomorrow" in raw_time_text:
                            m_date = (datetime.now() + timedelta(days=1)).strftime("%d.%m")
                        elif "Today" in raw_time_text:
                            m_date = datetime.now().strftime("%d.%m")
                        elif not iso_date:
                            # Look for "DD Mon" pattern
                            date_match = re.search(r'(\d{2})\s+([A-Za-z]{3})', raw_time_text)
                            if date_match:
                                day = date_match.group(1)
                                m_date = f"{day}.{datetime.now().strftime('%m')}"
                    except: pass
                    
                    # Consensus % and Tip Count
                    prob = "0"
                    tip_count = ""
                    try:
                        tips_container = row.find_element(By.CSS_SELECTOR, ".rw.tips")
                        
                        # Percentage
                        try:
                            prob_el = tips_container.find_element(By.CSS_SELECTOR, "span")
                            prob_txt = prob_el.get_attribute("textContent").strip()
                            prob_match = re.search(r'(\d+)%', prob_txt)
                            if prob_match: prob = prob_match.group(1)
                        except: pass
                            
                        # Tip Count (e.g. "52/62 Win Tips")
                        try:
                            tip_count_el = tips_container.find_element(By.CSS_SELECTOR, "b")
                            tip_count_txt = tip_count_el.get_attribute("textContent").strip()
                            tc_match = re.search(r'(\d+/\d+)', tip_count_txt)
                            if tc_match: tip_count = tc_match.group(1)
                        except: pass
                    except: pass
                    
                    # Selection (Tip)
                    selection = "Unknown"
                    try:
                        selection_el = row.find_element(By.CSS_SELECTOR, ".rw.sel h4")
                        selection = selection_el.get_attribute("textContent").strip()
                    except: pass
                    
                    # Market Name
                    market_name = "1X2" # Default
                    try:
                        market_el = row.find_element(By.CSS_SELECTOR, ".rw.sel p.truncate")
                        m_txt = market_el.get_attribute("textContent").lower()
                        if "both teams to score" in m_txt: market_name = "BTTS"
                        elif "over/under" in m_txt: market_name = "OU25"
                    except: pass
                    
                    # Map selection to our format
                    pred = selection
                    if market_name == "1X2":
                        if selection == home: pred = "1"
                        elif selection == away: pred = "2"
                        elif "draw" in selection.lower(): pred = "X"
                    elif market_name == "BTTS":
                        pred = "Yes" if "yes" in selection.lower() else "No"
                    elif market_name == "OU25":
                        pred = "OVER" if "over" in selection.lower() else "UNDER"
                        
                    predictions.append({
                        "home": home,
                        "away": away,
                        "league": league,
                        "date": m_date,
                        "time": m_time,
                        "markets": {
                            market_name: {
                                "pred": pred,
                                "prob": prob,
                                "tip_count": tip_count
                            }
                        },
                        "timestamp": datetime.now().isoformat()
                    })
                except:
                    continue
                    
            self.results["olbg"] = predictions
            print(f"[CONSENSUS] OLBG: Scraped {len(predictions)} predictions")
        except Exception as e:
            print(f"[CONSENSUS] OLBG error: {e}")
        finally:
            driver.quit()

    def scrape_forebet(self):
        """Scrape Forebet - Desktop version for full coverage"""
        url = "https://www.forebet.com/en/football-tips-and-predictions-for-today/predictions-1x2"
        print(f"[FOREBET] Scraping desktop site: {url}")
        
        driver = self.get_driver(use_mobile=False, headless=False)
        if not driver: return []
        
        predictions = []
        try:
            driver.get(url)
            time.sleep(10)
            
            # Consent (Çerez Onayı) handler for Forebet
            try:
                consent_selectors = [
                    "button.fc-cta-consent", 
                    ".qc-cmp2-footer button:last-child",
                    "button[aria-label='Agree']",
                    "button[aria-label='Consent']"
                ]
                for selector in consent_selectors:
                    try:
                        btn = driver.find_element(By.CSS_SELECTOR, selector)
                        if btn.is_displayed():
                            btn.click()
                            print("[FOREBET] Privacy consent accepted.")
                            time.sleep(2)
                            break
                    except: continue
            except: pass
            
            # Scroll loop to load lazy matches
            print("[FOREBET] Scrolling to load all matches (Deep Scroll)...")
            for _ in range(25): # Increased for more data
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(2)
            
            # Locate match rows - Added .tr_0, .tr_1 for older/alternating rows
            rows = driver.find_elements(By.CSS_SELECTOR, '.rcnt, .tr_0, .tr_1, .predict-row')
            print(f"[FOREBET] Found {len(rows)} potential match rows")
            
            for row in rows:
                try:
                    # Teams (Direct text from .homeTeam/.awayTeam is safer)
                    home_el = row.find_element(By.CSS_SELECTOR, '.homeTeam')
                    away_el = row.find_element(By.CSS_SELECTOR, '.awayTeam')
                    home = home_el.get_attribute("textContent").strip()
                    away = away_el.get_attribute("textContent").strip()
                    
                    if not home or not away:
                        continue

                    # Prediction & Probabilities
                    tip_1x2 = ""
                    try:
                        # Priority 1: The highlighted element with class .predict
                        try:
                            pred_el = row.find_element(By.CSS_SELECTOR, '.predict')
                            tip_text = pred_el.get_attribute("textContent").strip()
                            if tip_text in ['1', 'X', '2']:
                                tip_1x2 = tip_text
                        except: pass
                        
                        # Priority 2: Fallback selectors using textContent
                        if not tip_1x2:
                            for sel in ['.forepr', '.ex_pr span', '.ex_pr', '.fprc_cont span', '.predict .prob_dsc span']:
                                try:
                                    el = row.find_element(By.CSS_SELECTOR, sel)
                                    text = el.get_attribute("textContent").strip()
                                    if text and text in ['1', 'X', '2']:
                                        tip_1x2 = text
                                        break
                                except: continue
                        
                        # Priority 3: Highlighted probability cell
                        if not tip_1x2:
                            prob_cells = row.find_elements(By.CSS_SELECTOR, '.fprc span, .ex_pr span')
                            for i, cell in enumerate(prob_cells[:3]):
                                cls = cell.get_attribute('class') or ''
                                if any(x in cls for x in ['active', 'green', 'bold']):
                                    tip_1x2 = ['1', 'X', '2'][i]
                                    break
                    except:
                        tip_1x2 = "N/A"
                    
                    if not tip_1x2: tip_1x2 = "N/A"
                        
                    probs = row.find_elements(By.CSS_SELECTOR, '.fprc span')
                    
                    # Mapping Forebet prob list (Home/Draw/Away) to the specific tip probability
                    tip_prob = "0"
                    prob_str = "N/A"
                    if len(probs) >= 3:
                        prob_values = [p.get_attribute("textContent").strip().replace('%', '') for p in probs if p.get_attribute("textContent").strip()]
                        if len(prob_values) >= 3:
                            if tip_1x2 == "1": tip_prob = prob_values[0]
                            elif tip_1x2 == "X": tip_prob = prob_values[1]
                            elif tip_1x2 == "2": tip_prob = prob_values[2]
                            prob_str = "/".join(prob_values)
                    
                    # Another fallback for probabilities from ex_pr cells
                    if prob_str == "N/A" or tip_prob == "0":
                        ex_pr_cells = row.find_elements(By.CSS_SELECTOR, '.ex_pr span')
                        if len(ex_pr_cells) >= 3:
                            prob_values = [p.get_attribute("textContent").strip().replace('%', '') for p in ex_pr_cells if p.get_attribute("textContent").strip()]
                            if len(prob_values) >= 3:
                                prob_str = "/".join(prob_values)
                                if tip_1x2 == "1": tip_prob = prob_values[0]
                                elif tip_1x2 == "X": tip_prob = prob_values[1]
                                elif tip_1x2 == "2": tip_prob = prob_values[2]
                    
                    # Correct Score
                    try:
                        score_pred = row.find_element(By.CSS_SELECTOR, '.ex_sc').get_attribute("textContent").strip()
                    except:
                        score_pred = "N/A"
                        
                    # League
                    try:
                        league = row.find_element(By.CSS_SELECTOR, '.shortTag').get_attribute("textContent").strip()
                    except:
                        league = "Others"
                        
                    # Odds
                    odds = "1.00"
                    try:
                        odds_els = row.find_elements(By.CSS_SELECTOR, '.haodd span')
                        if odds_els:
                            if tip_1x2 == "1": odds = odds_els[0].get_attribute("textContent").strip()
                            elif tip_1x2 == "X" and len(odds_els) > 1: odds = odds_els[1].get_attribute("textContent").strip()
                            elif tip_1x2 == "2" and len(odds_els) > 2: odds = odds_els[2].get_attribute("textContent").strip()
                    except: pass
                    
                    if odds == "1.00":
                        try:
                            odds = row.find_element(By.CSS_SELECTOR, '.lscrsp').get_attribute("textContent").strip()
                        except: pass
                        
                    # Time
                    try:
                        m_time = row.find_element(By.CSS_SELECTOR, '.date_bah').get_attribute("textContent").strip()
                    except:
                        m_time = "00:00"
                        
                    # Detailed Link
                    forebet_url = ""
                    try:
                        link_el = row.find_element(By.CSS_SELECTOR, 'a.tnmscn')
                        forebet_url = link_el.get_attribute('href')
                    except: pass

                    # BTTS and O/U derived from score prediction
                    btts_pred = "N/A"
                    ou25_pred = "N/A"
                    if score_pred and score_pred != "N/A" and "-" in score_pred:
                        try:
                            parts = score_pred.replace(" ", "").split("-")
                            if len(parts) == 2:
                                h_score = int(parts[0].strip())
                                a_score = int(parts[1].strip())
                                btts_pred = "Yes" if h_score > 0 and a_score > 0 else "No"
                                ou25_pred = "OVER" if (h_score + a_score) > 2.5 else "UNDER"
                        except: pass
                    
                    # Average Goals (from .avg_goals or similar)
                    avg_goals = "N/A"
                    try:
                        avg_el = row.find_element(By.CSS_SELECTOR, '.avg_goals, .foremark, .avgGoals')
                        avg_goals = avg_el.get_attribute("textContent").strip()
                    except: pass

                    predictions.append({
                        "home": home, "away": away,
                        "league": league,
                        "score_pred": score_pred,
                        "date": datetime.now().strftime("%d.%m"),
                        "time": m_time,
                        "markets": {
                            "1X2": {
                                "pred": tip_1x2,
                                "prob": tip_prob,
                                "prob_full": prob_str,
                                "odds": odds
                            },
                            "BTTS": {
                                "pred": btts_pred
                            },
                            "OU25": {
                                "pred": ou25_pred
                            }
                        },
                        "avg_goals": avg_goals,
                        "forebetUrl": forebet_url,
                        "timestamp": datetime.now().isoformat()
                    })
                except: continue
            
            if predictions:
                self.results["forebet"] = predictions
                print(f"[FOREBET] Successfully scraped {len(predictions)} matches")
        except Exception as e:
            print(f"[FOREBET] Error: {e}")
        finally:
            driver.quit()



    def scrape_league_standings(self, driver, league_url, league_name):
        """Scrapes the standings table from a SoccerVista league page."""
        if not league_url: return
        print(f"[CONSENSUS] Scraping Standings for {league_name}...")
        try:
            driver.get(league_url)
            time.sleep(5)
            
            standings = {}
            # Robust strategy: Find "Pts" header to locate the table
            try:
                pts_header = None
                divs = driver.find_elements("css selector", "div")
                for div in divs:
                    if div.get_attribute("textContent").strip() == "Pts":
                        pts_header = div
                        break
                
                if pts_header:
                    # Container is usually a parent of the header row
                    container = pts_header.find_element("xpath", "./../..")
                    rows = container.find_elements("css selector", "div.flex.w-full")
                    
                    for row in rows:
                        try:
                            # Split by newline or look for specific children
                            txt = row.get_attribute("textContent").strip()
                            parts = [p.strip() for p in txt.split("\n") if p.strip()]
                            
                            if len(parts) >= 8:
                                # parts[0]: Rank, parts[1]: Team, parts[7]: Points (usually)
                                rank = parts[0]
                                team = parts[1]
                                # Points is usually the last one or index 7
                                points = parts[-1]
                                
                                if rank.isdigit():
                                    standings[team] = {"rank": rank, "points": points}
                        except: continue
            except: pass
            
            if standings:
                if "standings" not in self.results: self.results["standings"] = {}
                self.results["standings"][league_name] = standings
                print(f"[CONSENSUS] Scraped {len(standings)} teams for {league_name}")
            else:
                print(f"[CONSENSUS] No standings found for {league_name}")
        except Exception as e:
            print(f"[CONSENSUS] Standings error for {league_name}: {e}")

    def scrape_soccervista(self):
        print("[CONSENSUS] Scraping SoccerVista (with Form & Standings Support)...")
        driver = self.get_driver(headless=True)
        try:
            driver.get("https://www.soccervista.com/")
            time.sleep(12)
            
            predictions = []
            current_league = "Unknown"
            current_league_url = None
            leagues_to_scrape = {} # name -> url

            # Iterate through all rows to keep track of league headers
            rows = driver.find_elements("css selector", "tr")
            print(f"[CONSENSUS] SoccerVista: Found {len(rows)} potential rows")
            
            for row in rows:
                try:
                    classes = row.get_attribute("class") or ""
                    
                    # League Header Row
                    if "bg-[#283237]" in classes:
                        try:
                            link_el = row.find_element("css selector", "a")
                            current_league = link_el.get_attribute("textContent").strip()
                            current_league_url = link_el.get_attribute("href")
                            if current_league and current_league_url:
                                leagues_to_scrape[current_league] = current_league_url
                        except: pass
                        continue
                    
                    if "table-row" not in classes: continue
                    
                    cells = row.find_elements("css selector", "td")
                    if len(cells) < 8: continue
                    
                    # Team names
                    home_el = cells[1].find_element("css selector", "span[title]")
                    away_el = cells[3].find_element("css selector", "span[title]")
                    home = home_el.get_attribute("textContent").strip()
                    away = away_el.get_attribute("textContent").strip()
                    
                    if not home or not away: continue
                    
                    # Form Extraction: Targeting more specific containers to avoid duplicates
                    # Typical structure: <div class="flex gap-0.5"> <div background-color...><span>W</span></div> </div>
                    home_form_els = cells[1].find_elements("css selector", "div.flex.gap-0\\.5 > div span, .flex > div > span")
                    away_form_els = cells[3].find_elements("css selector", "div.flex.gap-0\\.5 > div span, .flex > div > span")
                    
                    # Extract text and filter only W, D, L
                    # SoccerVista often has duplicates in DOM (hidden mobile/desktop versions)
                    home_form_raw = [el.get_attribute("textContent").strip() for el in home_form_els]
                    away_form_raw = [el.get_attribute("textContent").strip() for el in away_form_els]
                    
                    def filter_and_dedupe(form_list):
                        # Filter only valid results
                        filtered = [f for f in form_list if f in ['W', 'D', 'L']]
                        if not filtered: return []
                        
                        # Heuristic: SoccerVista often doubles DOM elements for mobile/desktop.
                        # It can be sequential (W,W,L,L) or interleaved (W,L,W,L).
                        if len(filtered) >= 10:
                            # 1. Check Sequential Double (W,W,L,L...)
                            is_seq = True
                            for i in range(0, len(filtered)-1, 2):
                                if filtered[i] != filtered[i+1]:
                                    is_seq = False
                                    break
                            if is_seq: return filtered[0::2]
                            
                            # 2. Check Interleaved Double (W,L,D,W,L,D...)
                            half = len(filtered) // 2
                            if filtered[:half] == filtered[half:]:
                                return filtered[:half]
                                
                        return filtered

                    home_form = filter_and_dedupe(home_form_raw)
                    away_form = filter_and_dedupe(away_form_raw)
                    
                    # Prediction
                    tip = "N/A"
                    try:
                        tip_el = cells[7].find_element("css selector", "div.font-arial")
                        tip_txt = tip_el.get_attribute("textContent").strip()
                        if tip_txt in ["1", "X", "2"]: tip = tip_txt
                    except: pass
                    
                    # Predicted Score
                    score_pred = "N/A"
                    try:
                        score_txt = cells[9].get_attribute("textContent").strip()
                        if ":" in score_txt or "-" in score_txt: score_pred = score_txt
                    except: pass
                    
                    # Use current_league tracked from headers
                    league = current_league
                    
                    match_obj = {
                        "home": home, "away": away,
                        "league": league,
                        "timestamp": datetime.now().isoformat(),
                        "date": datetime.now().strftime("%d.%m"),
                        "score_pred": score_pred,
                        "form": {
                            "home": home_form,
                            "away": away_form
                        },
                        "markets": {
                            "1X2": {"pred": tip, "prob": "0"}
                        },
                        "league_url": current_league_url
                    }
                    predictions.append(match_obj)
                except: continue
                
            if predictions:
                self.results["soccervista"] = predictions
                print(f"[CONSENSUS] SoccerVista: Scraped {len(predictions)} matches")
                
                # Now scrape standings for identified leagues (limit to top 15 to avoid long runs)
                limit = 15
                count = 0
                for l_name, l_url in leagues_to_scrape.items():
                    if count >= limit: break
                    self.scrape_league_standings(driver, l_url, l_name)
                    count += 1
                    time.sleep(2)

        except Exception as e: print(f"[CONSENSUS] SoccerVista error: {e}")
        finally: driver.quit()

    def scrape_superbet(self):
        print("[CONSENSUS] Scraping SuperBetPredictions...")
        driver = self.get_driver(headless=True)
        try:
            driver.get(SITES["superbet"])
            time.sleep(10)
            
            # Dismiss cookie consent if it exists
            try:
                consent = driver.find_element("css selector", ".fc-cta-consent, button[aria-label='Consent']")
                consent.click()
                time.sleep(2)
            except: pass

            predictions = []
            # Table rows in tbody
            rows = driver.find_elements("css selector", "table.table tbody tr")
            print(f"[CONSENSUS] SuperBet: Found {len(rows)} potential rows")
            
            i = 0
            while i < len(rows):
                row = rows[i]
                
                # Check for league header in td
                try:
                    league_td = row.find_element("css selector", "td.league")
                    league = league_td.text.strip()
                    
                    # Next row should be Teams/Score
                    if i + 1 < len(rows):
                        team_row = rows[i+1]
                        try:
                            # Format: Home Score Away
                            home = team_row.find_element("css selector", "td p code:nth-of-type(1)").text.strip()
                            away = team_row.find_element("css selector", "td p code:nth-of-type(3)").text.strip()
                            
                            # Next row should be Details (Time, Tip, Odds)
                            if i + 2 < len(rows):
                                details_row = rows[i+2]
                                try:
                                    cells = details_row.find_elements("css selector", "td")
                                    if len(cells) >= 3:
                                        # Cell 1: Time: HH:mm
                                        time_text = cells[0].text.strip().replace("Time: ", "")
                                        # Cell 2: Tip: [Tip]
                                        tip_raw = cells[1].find_element("tag name", "strong").text.strip()
                                        # Cell 3: Odds: [Odds]
                                        odds_text = cells[2].text.strip().replace("Odds: ", "")
                                        
                                        # Map tip
                                        pred = "N/A"
                                        markets = {}
                                        
                                        # Clean tip string
                                        tip_val = tip_raw.replace("Tip:", "").strip()
                                        tip_upper = tip_val.upper()
                                        
                                        # 1X2 Mapping
                                        if tip_upper == "1" or "HT 1" in tip_upper: pred = "1"
                                        elif tip_upper == "2" or "HT 2" in tip_upper: pred = "2"
                                        elif tip_upper == "X" or "HT X" in tip_upper: pred = "X"
                                        elif "1X" in tip_upper: pred = "1X"
                                        elif "X2" in tip_upper: pred = "X2"
                                        elif "12" in tip_upper: pred = "12"
                                        
                                        # OU Support (be inclusive of 1.5, 2.5, 3.5)
                                        if "OVER" in tip_upper:
                                            markets["OU25"] = {"pred": "OVER"}
                                        elif "UNDER" in tip_upper:
                                            markets["OU25"] = {"pred": "UNDER"}
                                            
                                        # BTTS Support
                                        if "GG" in tip_upper:
                                            markets["BTTS"] = {"pred": "Yes"}
                                        elif "NG" in tip_upper:
                                            markets["BTTS"] = {"pred": "No"}
                                            
                                        markets["1X2"] = {"pred": pred, "odds": odds_text}

                                        predictions.append({
                                            "home": home, "away": away,
                                            "league": league,
                                            "time": time_text,
                                            "date": datetime.now().strftime("%d.%m"),
                                            "markets": markets,
                                            "source": "superbet",
                                            "timestamp": datetime.now().isoformat()
                                        })
                                except: pass
                            i += 3 # Move to next block
                            continue
                        except: pass
                except: pass
                i += 1
                
            if predictions:
                self.results["superbet"] = predictions
                print(f"[CONSENSUS] SuperBet: Scraped {len(predictions)} matches")
            else:
                print("[CONSENSUS] SuperBet: No predictions found.")
        except Exception as e: print(f"[CONSENSUS] SuperBet error: {e}")
        finally: driver.quit()

    def run_all(self, sites_to_run=None):
        print(f"[CONSENSUS] Starting full run at {datetime.now().isoformat()}")
        # Execute sequentially with fresh drivers
        all_methods = {
            "forebet": self.scrape_forebet, 
            "soccervista": self.scrape_soccervista,
            "prosoccer": self.scrape_prosoccer,
            "predictz": self.scrape_predictz, 
            "windrawwin": self.scrape_windrawwin,
            "statarea": self.scrape_statarea,
            "vitibet": self.scrape_vitibet,
            "zulubet": self.scrape_zulubet,
            "olbg": self.scrape_olbg,
            "superbet": self.scrape_superbet
        }
        
        target_sites = sites_to_run if sites_to_run else all_methods.keys()
        
        for site in target_sites:
            if site in all_methods:
                try:
                    all_methods[site]()
                    self.save_results()
                    time.sleep(5) # Cooldown between sites
                except Exception as e:
                    print(f"[CONSENSUS] Method {site} failed: {e}")

if __name__ == "__main__":
    import sys
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--sites", help="Comma separated list of sites to scrape")
    args = parser.parse_args()
    
    scraper = ConsensusScraper()
    sites = args.sites.split(",") if args.sites else None
    scraper.run_all(sites_to_run=sites)
