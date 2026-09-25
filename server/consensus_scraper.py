import time
import json
import os
import sys
import re
from datetime import datetime, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from curl_cffi import requests
from bs4 import BeautifulSoup

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, "consensus_data.json")

class ConsensusScraper:
    def __init__(self):
        self.results = {}
        if os.path.exists(OUTPUT_FILE):
            try:
                with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                    raw = json.load(f)
                    for k, v in raw.items():
                        self.results[k] = v
                print(f"[CONSENSUS] Loaded existing data: {len(self.results)} sources")
            except Exception as e:
                print(f"[CONSENSUS] Could not load existing data: {e}")

    def get_driver(self, use_mobile=False, headless=True):
        from driver_helper import get_chromedriver_path
        driver_path = get_chromedriver_path()
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.service import Service
            from selenium.webdriver.chrome.options import Options

            options = Options()
            if headless:
                options.add_argument('--headless=new')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            if use_mobile:
                options.add_argument('--window-size=375,812')
            else:
                options.add_argument('--window-size=1920,1080')
            options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

            service = Service(executable_path=driver_path)
            driver = webdriver.Chrome(service=service, options=options)
            return driver
        except Exception as e:
            print(f"[CONSENSUS] Selenium driver error: {e}")
            return None

    def save_results(self):
        try:
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.results, f, ensure_ascii=False, indent=4)
            print(f"[CONSENSUS] Saved to {OUTPUT_FILE} ({len(self.results)} sources)")
        except Exception as e:
            print(f"[CONSENSUS] Save error: {e}")

        # Push to Render Cloud API
        try:
            render_url = os.environ.get('RENDER_EXTERNAL_URL', 'https://live-bet-mentor.onrender.com')
            sync_url = f"{render_url}/api/sync/consensus"
            r = requests.post(sync_url, json=self.results, headers={'Content-Type': 'application/json', 'x-sync-secret': 'lbm-sync-2026'}, timeout=15)
            if r.status_code == 200:
                print(f"[CONSENSUS] 🚀 Successfully pushed consensus to Render cloud!")
            else:
                print(f"[CONSENSUS] Render cloud response: {r.status_code}")
        except Exception as e:
            print(f"[CONSENSUS] Render sync notice: {e}")

    # 1. FOREBET (AI / Mathematical)
    def scrape_forebet(self):
        print("[CONSENSUS] Scraping Forebet via fast TLS engine...")
        url = "https://www.forebet.com/en/football-tips-and-predictions-for-today"
        try:
            r = requests.get(url, impersonate="chrome120", timeout=15)
            soup = BeautifulSoup(r.text, "html.parser")
            rows = soup.find_all("div", class_=lambda c: c and "rcnt" in c)
            preds = []
            for row in rows:
                try:
                    home_el = row.find("span", class_="homeTeam")
                    away_el = row.find("span", class_="awayTeam")
                    if not home_el or not away_el: continue
                    home = home_el.get_text(strip=True)
                    away = away_el.get_text(strip=True)
                    
                    # Forebet tip is in span.forepr or span.forepred
                    pred_el = row.find("span", class_=lambda c: c and ("forepr" in c or "forepred" in c))
                    pred = pred_el.get_text(strip=True) if pred_el else "N/A"
                    
                    # Probabilities: 3 fprb spans (1, X, 2)
                    probs = [p.get_text(strip=True) for p in row.find_all("span", class_="fprb")]
                    p1 = probs[0] if len(probs)>0 else "0"
                    px = probs[1] if len(probs)>1 else "0"
                    p2 = probs[2] if len(probs)>2 else "0"
                    
                    cs_el = row.find("span", class_=lambda c: c and ("ex_sc" in c or "scrmobpred" in c))
                    score_pred = cs_el.get_text(strip=True) if cs_el else ""

                    dt_el = row.find("time") or row.find("span", class_="date_bah")
                    m_date, m_time = datetime.now().strftime("%d.%m"), ""
                    if dt_el and dt_el.get_text():
                        parts_dt = dt_el.get_text(strip=True).split()
                        if len(parts_dt) >= 2:
                            d_parts = parts_dt[0].split('/')
                            if len(d_parts) >= 2: m_date = f"{d_parts[0]}.{d_parts[1]}"
                            m_time = parts_dt[1]

                    markets = {}
                    if pred in ["1", "X", "2", "1X", "X2"]:
                        prob = p1 if pred=="1" else (p2 if pred=="2" else px)
                        markets["1X2"] = {"pred": pred, "prob": prob, "prob_full": f"{p1}/{px}/{p2}"}
                    if "-" in score_pred:
                        s_parts = score_pred.split("-")
                        if len(s_parts) == 2 and s_parts[0].strip().isdigit() and s_parts[1].strip().isdigit():
                            h, a = int(s_parts[0].strip()), int(s_parts[1].strip())
                            markets["BTTS"] = {"pred": "Yes" if h > 0 and a > 0 else "No"}
                            markets["OU25"] = {"pred": "OVER" if (h + a) > 2.5 else "UNDER"}
                            if pred == "N/A":
                                pred = "1" if h > a else ("2" if a > h else "X")
                                markets["1X2"] = {"pred": pred}

                    if markets:
                        preds.append({
                            "home": home, "away": away, "date": m_date, "time": m_time,
                            "score_pred": score_pred, "markets": markets,
                            "timestamp": datetime.now().isoformat()
                        })
                except: continue
            if preds:
                self.results["forebet"] = preds
                print(f"[CONSENSUS] Forebet: {len(preds)} matches extracted.")
        except Exception as e:
            print(f"[CONSENSUS] Forebet error: {e}")

    # 2. PROSOCCER (Algorithmic)
    def scrape_prosoccer(self):
        print("[CONSENSUS] Scraping ProSoccer via fast parser...")
        url = "https://www.prosoccer.gr/en/football/predictions/"
        try:
            r = requests.get(url, impersonate="chrome120", timeout=15, verify=False)
            soup = BeautifulSoup(r.text, "html.parser")
            tbl = soup.find("table", id="tblPredictions")
            preds = []
            if tbl:
                for row in tbl.find_all("tr"):
                    try:
                        cells = row.find_all("td")
                        if len(cells) < 7: continue
                        teams = cells[2].get_text(strip=True).replace("\xa0", " ")
                        if " - " not in teams: continue
                        home, away = [t.strip() for t in teams.split(" - ", 1)]
                        prob_1 = cells[3].get_text(strip=True) if len(cells)>3 else "0"
                        prob_x = cells[4].get_text(strip=True) if len(cells)>4 else "0"
                        prob_2 = cells[5].get_text(strip=True) if len(cells)>5 else "0"
                        tip_raw = cells[6].get_text(strip=True).lower() if len(cells)>6 else ""
                        
                        clean_tip = tip_raw.replace("a", "").upper()
                        pred = "N/A"
                        if clean_tip in ["1", "X", "2", "1X", "X2", "12"]: pred = clean_tip
                        elif clean_tip == "X1": pred = "1X"
                        elif clean_tip == "2X": pred = "X2"
                        elif "1" in tip_raw: pred = "1"
                        elif "2" in tip_raw: pred = "2"
                        elif "X" in clean_tip: pred = "X"

                        score_pred = cells[10].get_text(strip=True) if len(cells)>10 else "N/A"
                        if pred == "N/A" and "-" in score_pred:
                            parts = score_pred.split("-")
                            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                                h, a = int(parts[0]), int(parts[1])
                                pred = "1" if h > a else ("2" if a > h else "X")

                        tip_ou = "N/A"
                        if len(cells) > 13:
                            try:
                                u_p = int(cells[12].get_text(strip=True) or "0")
                                o_p = int(cells[13].get_text(strip=True) or "0")
                                if o_p > 0 or u_p > 0: tip_ou = "OVER" if o_p > u_p else "UNDER"
                            except: pass

                        m_time = cells[1].get_text(strip=True) if len(cells)>1 else ""
                        markets = {}
                        if pred != "N/A":
                            markets["1X2"] = {"pred": pred, "prob": prob_1 if pred=="1" else (prob_2 if pred=="2" else prob_x), "prob_full": f"{prob_1}/{prob_x}/{prob_2}"}
                        if tip_ou != "N/A":
                            markets["OU25"] = {"pred": tip_ou}

                        if markets:
                            preds.append({
                                "home": home, "away": away, "date": datetime.now().strftime("%d.%m"),
                                "time": m_time, "score_pred": score_pred, "markets": markets,
                                "timestamp": datetime.now().isoformat()
                            })
                    except: continue
            if preds:
                self.results["prosoccer"] = preds
                print(f"[CONSENSUS] ProSoccer: {len(preds)} matches extracted.")
        except Exception as e:
            print(f"[CONSENSUS] ProSoccer error: {e}")

    # 3. PREDICTZ (Score Predictions)
    def scrape_predictz(self):
        print("[CONSENSUS] Scraping PredictZ via fast TLS engine...")
        url = "https://www.predictz.com/predictions/today/"
        try:
            r = requests.get(url, impersonate="chrome120", timeout=15)
            soup = BeautifulSoup(r.text, "html.parser")
            rows = soup.find_all("div", class_=lambda c: c and "pttr" in c and "ptcnt" in c)
            preds = []
            for row in rows:
                try:
                    home_el = row.find("div", class_=lambda c: c and "ptmobh" in c)
                    away_el = row.find("div", class_=lambda c: c and "ptmoba" in c)
                    if home_el and away_el:
                        home = home_el.get_text(strip=True)
                        away = away_el.get_text(strip=True)
                    else:
                        game_el = row.find("div", class_=lambda c: c and "ptgame" in c)
                        if game_el and " v " in game_el.get_text():
                            home, away = [t.strip() for t in game_el.get_text(strip=True).split(" v ")]
                        else:
                            continue

                    pred_box = row.find("div", class_=lambda c: c and "ptpredbox" in c)
                    pred_text = pred_box.get_text(strip=True) if pred_box else ""

                    pred = "N/A"
                    if "Home" in pred_text or "1" in pred_text: pred = "1"
                    elif "Away" in pred_text or "2" in pred_text: pred = "2"
                    elif "Draw" in pred_text or "X" in pred_text: pred = "X"

                    score_pred = "N/A"
                    score_match = re.search(r'(\d+-\d+)', pred_text)
                    if score_match: score_pred = score_match.group(1)

                    markets = {}
                    if pred != "N/A": markets["1X2"] = {"pred": pred}
                    if score_pred != "N/A":
                        h, a = [int(x) for x in score_pred.split("-")]
                        markets["BTTS"] = {"pred": "Yes" if h > 0 and a > 0 else "No"}
                        markets["OU25"] = {"pred": "OVER" if (h + a) > 2.5 else "UNDER"}

                    if markets:
                        preds.append({
                            "home": home, "away": away, "date": datetime.now().strftime("%d.%m"),
                            "score_pred": score_pred, "markets": markets,
                            "timestamp": datetime.now().isoformat()
                        })
                except: continue
            if preds:
                self.results["predictz"] = preds
                print(f"[CONSENSUS] PredictZ: {len(preds)} matches extracted.")
        except Exception as e:
            print(f"[CONSENSUS] PredictZ error: {e}")

    # 4. WINDRAWWIN (Trend Tracker)
    def scrape_windrawwin(self):
        print("[CONSENSUS] Scraping WinDrawWin via fast TLS engine...")
        url = "https://www.windrawwin.com/predictions/today/kick-off-time/"
        try:
            r = requests.get(url, impersonate="chrome120", timeout=15)
            soup = BeautifulSoup(r.text, "html.parser")
            rows = soup.find_all("div", class_="wttr")
            preds = []
            for row in rows:
                try:
                    team_divs = row.find_all("div", class_="wtteam")
                    if len(team_divs) >= 2:
                        h_a = team_divs[0].find("a")
                        a_a = team_divs[1].find("a")
                        home = h_a.get_text(strip=True) if h_a else team_divs[0].get_text(strip=True)
                        away = a_a.get_text(strip=True) if a_a else team_divs[1].get_text(strip=True)
                        # Clean " Results" noise
                        home = re.sub(r'\s*Results$', '', home, flags=re.I).strip()
                        away = re.sub(r'\s*Results$', '', away, flags=re.I).strip()
                    else: continue

                    pred_el = row.find("div", class_=lambda c: c and "wtprd" in c) or row.find("div", class_=lambda c: c and "wtfullpred" in c)
                    pred_text = pred_el.get_text(strip=True) if pred_el else ""

                    pred = "N/A"
                    if "Home Win" in pred_text: pred = "1"
                    elif "Away Win" in pred_text: pred = "2"
                    elif "Draw" in pred_text: pred = "X"

                    score_el = row.find("div", class_=lambda c: c and "wtsc" in c)
                    score_pred = score_el.get_text(strip=True) if score_el else "N/A"
                    if score_pred == "N/A":
                        score_match = re.search(r'(\d+-\d+)', pred_text)
                        if score_match: score_pred = score_match.group(1)

                    markets = {}
                    if pred != "N/A": markets["1X2"] = {"pred": pred}
                    if score_pred != "N/A" and "-" in score_pred:
                        h, a = [int(x) for x in score_pred.split("-")]
                        markets["OU25"] = {"pred": "OVER" if (h + a) > 2.5 else "UNDER"}

                    if markets:
                        preds.append({
                            "home": home, "away": away, "date": datetime.now().strftime("%d.%m"),
                            "score_pred": score_pred, "markets": markets,
                            "timestamp": datetime.now().isoformat()
                        })
                except: continue
            if preds:
                self.results["windrawwin"] = preds
                print(f"[CONSENSUS] WinDrawWin: {len(preds)} matches extracted.")
        except Exception as e:
            print(f"[CONSENSUS] WinDrawWin error: {e}")

    # 5. STATAREA (Statistical)
    def scrape_statarea(self):
        print("[CONSENSUS] Scraping Statarea via fast parser...")
        url = "https://www.statarea.com/predictions"
        try:
            r = requests.get(url, impersonate="chrome120", timeout=15)
            soup = BeautifulSoup(r.text, "html.parser")
            matches = soup.find_all("div", class_="match")
            preds = []
            for m in matches:
                try:
                    host_div = m.find("div", class_="hostteam")
                    guest_div = m.find("div", class_="guestteam")
                    if not host_div or not guest_div: continue

                    home = host_div.find("div", class_="name").get_text(strip=True) if host_div.find("div", class_="name") else host_div.get_text(strip=True).replace("-", "").strip()
                    away = guest_div.find("div", class_="name").get_text(strip=True) if guest_div.find("div", class_="name") else guest_div.get_text(strip=True).replace("-", "").strip()

                    tip_div = m.find("div", class_="tip")
                    tip_val = tip_div.find("div", class_="value").get_text(strip=True) if (tip_div and tip_div.find("div", class_="value")) else ""

                    pred = "N/A"
                    if tip_val in ["1", "1X", "12"]: pred = "1" if tip_val=="1" else tip_val
                    elif tip_val in ["2", "X2"]: pred = "2" if tip_val=="2" else tip_val
                    elif tip_val in ["X"]: pred = "X"

                    date_div = m.find("div", class_="date")
                    m_time = date_div.get_text(strip=True) if date_div else ""

                    markets = {}
                    if pred != "N/A": markets["1X2"] = {"pred": pred}

                    if home and away and markets:
                        preds.append({
                            "home": home, "away": away, "time": m_time,
                            "date": datetime.now().strftime("%d.%m"),
                            "score_pred": "N/A", "markets": markets,
                            "timestamp": datetime.now().isoformat()
                        })
                except: continue
            if preds:
                self.results["statarea"] = preds
                print(f"[CONSENSUS] Statarea: {len(preds)} matches extracted.")
        except Exception as e:
            print(f"[CONSENSUS] Statarea error: {e}")

    # 6. VITIBET (Quick Tips) - Modern Div Layout
    def scrape_vitibet(self):
        print("[CONSENSUS] Scraping Vitibet via modern div parser...")
        url = "https://www.vitibet.com/index.php?clanek=quicktips&sekce=fotbal&lang=en"
        try:
            r = requests.get(url, impersonate="chrome120", timeout=15)
            soup = BeautifulSoup(r.text, "html.parser")
            items = soup.find_all("div", class_="livescore-matches-list")
            preds = []
            for it in items:
                try:
                    teams_el = it.find("div", class_="livescore-match-teams-col")
                    if not teams_el: continue
                    teams = [t.get_text(strip=True) for t in teams_el.find_all("div", class_="livescore-team-line")]
                    if len(teams) < 2:
                        t_text = teams_el.get_text(separator="|", strip=True).split("|")
                        teams = [t.strip() for t in t_text if t.strip()]
                    if len(teams) < 2: continue
                    home, away = teams[0], teams[1]

                    score_el = it.find("div", class_="livescore-match-score-col")
                    score_pred = score_el.get_text(strip=True) if score_el else ""
                    time_el = it.find("div", class_="livescore-match-time-col")
                    m_time = time_el.get_text(strip=True) if time_el else ""

                    probs = [p.get_text(strip=True).replace("%", "") for p in it.find_all("div", class_="pct-item")]
                    p1 = probs[0] if len(probs)>0 and probs[0].isdigit() else "0"
                    px = probs[1] if len(probs)>1 and probs[1].isdigit() else "0"
                    p2 = probs[2] if len(probs)>2 and probs[2].isdigit() else "0"
                    pred = "1" if int(p1) > max(int(px), int(p2)) else ("2" if int(p2) > max(int(p1), int(px)) else "X")

                    markets = {}
                    markets["1X2"] = {"pred": pred, "prob": max(p1, px, p2), "prob_full": f"{p1}/{px}/{p2}"}
                    if "-" in score_pred:
                        s_parts = score_pred.split("-")
                        if len(s_parts) == 2 and s_parts[0].isdigit() and s_parts[1].isdigit():
                            h, a = int(s_parts[0]), int(s_parts[1])
                            markets["BTTS"] = {"pred": "Yes" if h > 0 and a > 0 else "No"}
                            markets["OU25"] = {"pred": "OVER" if (h + a) > 2.5 else "UNDER"}

                    preds.append({
                        "home": home, "away": away, "date": datetime.now().strftime("%d.%m"),
                        "time": m_time, "score_pred": score_pred, "markets": markets,
                        "timestamp": datetime.now().isoformat()
                    })
                except: continue
            if preds:
                self.results["vitibet"] = preds
                print(f"[CONSENSUS] Vitibet: {len(preds)} matches extracted.")
        except Exception as e:
            print(f"[CONSENSUS] Vitibet error: {e}")

    # 7. ZULUBET (Combo Predictions) - Clean HTTP with SSL bypass
    def scrape_zulubet(self):
        print("[CONSENSUS] Scraping Zulubet via direct HTTP...")
        url = "http://zulubet.com/"
        try:
            try:
                r = requests.get(url, impersonate="chrome120", timeout=15, verify=False)
            except:
                r = requests.get("https://zulubet.com/", impersonate="chrome120", timeout=15, verify=False)
            soup = BeautifulSoup(r.text, "html.parser")
            table = soup.find("table", class_="content_table")
            preds = []
            if table:
                for row in table.find_all("tr"):
                    try:
                        cells = row.find_all("td", recursive=False)
                        if len(cells) < 7: continue
                        txt = cells[1].get_text(strip=True)
                        if " - " not in txt: continue
                        parts = txt.split(" - ")
                        home = parts[0].strip().split("\n")[-1].strip()
                        away = parts[1].strip().split("\n")[0].strip()
                        tip_raw = cells[6].get_text(strip=True)
                        pred = "N/A"
                        if "1" in tip_raw: pred = "1"
                        elif "2" in tip_raw: pred = "2"
                        elif "X" in tip_raw: pred = "X"

                        prob_full = cells[5].get_text(strip=True) if len(cells)>5 else ""
                        markets = {}
                        if pred != "N/A":
                            markets["1X2"] = {"pred": pred, "prob_full": prob_full}
                        if markets:
                            preds.append({
                                "home": home, "away": away, "date": datetime.now().strftime("%d.%m"),
                                "score_pred": "N/A", "markets": markets,
                                "timestamp": datetime.now().isoformat()
                            })
                    except: continue
            if preds:
                self.results["zulubet"] = preds
                print(f"[CONSENSUS] Zulubet: {len(preds)} matches extracted.")
        except Exception as e:
            print(f"[CONSENSUS] Zulubet error: {e}")

    # 8. OLBG (Community Consensus)
    def scrape_olbg(self):
        print("[CONSENSUS] Scraping OLBG...")
        url = "https://www.olbg.com/betting-tips/Football/1"
        try:
            r = requests.get(url, impersonate="chrome120", timeout=15)
            soup = BeautifulSoup(r.text, "html.parser")
            rows = soup.find_all("li")
            preds = []
            for row in rows:
                try:
                    h5 = row.find("h5")
                    if not h5 or " v " not in h5.get_text(): continue
                    home, away = [t.strip() for t in h5.get_text(strip=True).split(" v ")]
                    pct = "0"
                    for s in row.find_all(["strong", "span"]):
                        t = s.get_text(strip=True)
                        if "%" in t:
                            pct = t.replace("%", "").strip()
                            break
                    
                    # OLBG tip selection is in div.sel
                    sel_el = row.find("div", class_="sel")
                    sel_tag = sel_el.find(["h4", "a"]) if sel_el else None
                    sel_val = sel_tag.get_text(strip=True) if sel_tag else (sel_el.get_text(strip=True) if sel_el else "")

                    pred = "N/A"
                    s = sel_val.lower().strip()
                    h = home.lower().strip()
                    a = away.lower().strip()

                    if "draw" in s or "tie" in s or "berabere" in s:
                        pred = "X"
                    elif h in s or s in h:
                        pred = "1"
                    elif a in s or s in a:
                        pred = "2"
                    else:
                        s_tokens = set(s.split())
                        h_tokens = set(h.split())
                        a_tokens = set(a.split())
                        h_overlap = len(s_tokens & h_tokens)
                        a_overlap = len(s_tokens & a_tokens)
                        if h_overlap > a_overlap:
                            pred = "1"
                        elif a_overlap > h_overlap:
                            pred = "2"
                        else:
                            pred = "1"

                    preds.append({
                        "home": home, "away": away, "date": datetime.now().strftime("%d.%m"),
                        "score_pred": "N/A", "markets": {"1X2": {"pred": pred, "prob": pct}},
                        "timestamp": datetime.now().isoformat()
                    })
                except: continue
            if preds:
                self.results["olbg"] = preds
                print(f"[CONSENSUS] OLBG: {len(preds)} matches extracted.")
        except Exception as e:
            print(f"[CONSENSUS] OLBG error: {e}")

    # 9. SUPERBET (Sharp Prediction)
    def scrape_superbet(self):
        print("[CONSENSUS] Scraping SuperBet...")
        url = "https://superbetpredictions.com/"
        try:
            r = requests.get(url, impersonate="chrome120", timeout=15)
            soup = BeautifulSoup(r.text, "html.parser")
            tbl = soup.find("table", class_="table")
            preds = []
            if tbl:
                rows = tbl.find_all("tr")
                i = 0
                while i < len(rows):
                    try:
                        if i + 2 < len(rows):
                            t_row = rows[i+1]
                            codes = t_row.find_all("code")
                            if len(codes) >= 3:
                                home = codes[0].get_text(strip=True)
                                away = codes[2].get_text(strip=True)
                                d_row = rows[i+2]
                                tip_strong = d_row.find("strong")
                                tip = tip_strong.get_text(strip=True).upper() if tip_strong else ""
                                pred = "N/A"
                                if tip == "1" or "HT 1" in tip: pred = "1"
                                elif tip == "2" or "HT 2" in tip: pred = "2"
                                elif tip == "X" or "HT X" in tip: pred = "X"
                                elif "1X" in tip: pred = "1X"
                                elif "X2" in tip: pred = "X2"

                                markets = {}
                                if pred != "N/A": markets["1X2"] = {"pred": pred}
                                if "OVER" in tip: markets["OU25"] = {"pred": "OVER"}
                                elif "UNDER" in tip: markets["OU25"] = {"pred": "UNDER"}
                                if markets:
                                    preds.append({
                                        "home": home, "away": away, "date": datetime.now().strftime("%d.%m"),
                                        "score_pred": "N/A", "markets": markets,
                                        "timestamp": datetime.now().isoformat()
                                    })
                    except: pass
                    i += 1
            if preds:
                self.results["superbet"] = preds
                print(f"[CONSENSUS] SuperBet: {len(preds)} matches extracted.")
        except Exception as e:
            print(f"[CONSENSUS] SuperBet error: {e}")

    # 10. SOCCERVISTA (Form & Standings Analysis - Headless Chrome)
    def scrape_soccervista(self):
        print("[CONSENSUS] Scraping SoccerVista (with Form & Standings Support)...")
        driver = self.get_driver(headless=True)
        if not driver:
            print("[CONSENSUS] SoccerVista: Driver not available, skipping.")
            return
        try:
            driver.get("https://www.soccervista.com/")
            time.sleep(8)
            predictions = []
            rows = driver.find_elements("css selector", "tr")
            print(f"[CONSENSUS] SoccerVista: Found {len(rows)} potential rows")

            current_league = "Unknown"
            for row in rows:
                try:
                    cells = row.find_elements("css selector", "td")
                    if len(cells) == 1:
                        txt = cells[0].text.strip()
                        if txt: current_league = txt
                        continue

                    if len(cells) < 10: continue

                    m_time = cells[0].text.strip()
                    home_raw = cells[1].text.strip()
                    away_raw = cells[3].text.strip()
                    if not home_raw or not away_raw: continue

                    h_parts = home_raw.split()
                    home_form = [p for p in h_parts if p in ['W', 'D', 'L']][:5]
                    home_team = ' '.join([p for p in h_parts if p not in ['W', 'D', 'L']])
                    if not home_team: home_team = home_raw

                    a_parts = away_raw.split()
                    away_form = [p for p in a_parts if p in ['W', 'D', 'L']][:5]
                    away_team = ' '.join([p for p in a_parts if p not in ['W', 'D', 'L']])
                    if not away_team: away_team = away_raw

                    tip_1x2 = cells[7].text.strip().upper() if len(cells) > 7 else "N/A"
                    ou_tip = cells[8].text.strip().upper() if len(cells) > 8 else "N/A"
                    score_pred = cells[9].text.strip() if len(cells) > 9 else "N/A"

                    markets = {}
                    if tip_1x2 in ["1", "X", "2", "1X", "X2"]:
                        markets["1X2"] = {"pred": tip_1x2}
                    if ou_tip in ["O", "OVER"]:
                        markets["OU25"] = {"pred": "OVER"}
                    elif ou_tip in ["U", "UNDER"]:
                        markets["OU25"] = {"pred": "UNDER"}

                    if re.match(r'^\d+:\d+$', score_pred):
                        h_s, a_s = [int(x) for x in score_pred.split(":")]
                        markets["BTTS"] = {"pred": "Yes" if h_s > 0 and a_s > 0 else "No"}
                        if "OU25" not in markets:
                            markets["OU25"] = {"pred": "OVER" if (h_s + a_s) > 2.5 else "UNDER"}

                    if markets:
                        match_obj = {
                            "home": home_team, "away": away_team, "league": current_league,
                            "date": datetime.now().strftime("%d.%m"), "time": m_time,
                            "score_pred": score_pred, "markets": markets,
                            "timestamp": datetime.now().isoformat()
                        }
                        if home_form and away_form:
                            match_obj["form"] = {"home": home_form, "away": away_form}
                        predictions.append(match_obj)
                except: continue

            if predictions:
                self.results["soccervista"] = predictions
                print(f"[CONSENSUS] SoccerVista: {len(predictions)} matches extracted.")
        except Exception as e:
            print(f"[CONSENSUS] SoccerVista error: {e}")
        finally:
            try: driver.quit()
            except: pass

    # 11. BETANO (Popular Acca & Sentiment Radar)
    def scrape_betano(self):
        print("[CONSENSUS] Scraping Betano Acca & Sentiment...")
        try:
            from betano_scraper import process_and_save
            process_and_save()
            # If betano_cards was saved, reload it into self.results
            if os.path.exists(OUTPUT_FILE):
                with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                    c_data = json.load(f)
                    if "betano" in c_data:
                        self.results["betano"] = c_data["betano"]
        except Exception as e:
            print(f"[CONSENSUS] Betano error: {e}")

    def run_all(self, sites_to_run=None):
        print(f"[CONSENSUS] Starting comprehensive full run at {datetime.now().isoformat()}")
        all_methods = {
            "forebet": self.scrape_forebet,
            "prosoccer": self.scrape_prosoccer,
            "predictz": self.scrape_predictz,
            "windrawwin": self.scrape_windrawwin,
            "statarea": self.scrape_statarea,
            "vitibet": self.scrape_vitibet,
            "zulubet": self.scrape_zulubet,
            "olbg": self.scrape_olbg,
            "superbet": self.scrape_superbet,
            "soccervista": self.scrape_soccervista,
            "betano": self.scrape_betano
        }

        target_sites = sites_to_run if sites_to_run else all_methods.keys()

        for site in target_sites:
            if site in all_methods:
                try:
                    all_methods[site]()
                except Exception as e:
                    print(f"[CONSENSUS] Method {site} failed: {e}")

        self.save_results()
        print(f"[CONSENSUS] Completed full run at {datetime.now().isoformat()}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--sites", help="Comma separated list of sites to scrape")
    args = parser.parse_args()

    scraper = ConsensusScraper()
    sites = args.sites.split(",") if args.sites else None
    scraper.run_all(sites_to_run=sites)
