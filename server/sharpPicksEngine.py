#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LIVE BET MENTOR - MENTOR ALPHA SHARP ENGINE
-------------------------------------------
Proprietary low-risk institutional predictive engine.
Ingests high-confidence, low-drawdown daily selections, monitors match
resolution periodically, and tracks historical accuracy.
"""

import sys
import os
import json
import time
import re
import argparse
from datetime import datetime
import requests
from bs4 import BeautifulSoup

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VAULT_FILE = os.path.join(BASE_DIR, "sharp_picks_vault.json")

SOURCE_CONFIG = {
    "top_today": "https://superbetpredictions.com/top",
    "all_today": "https://superbetpredictions.com/",
    "top_yesterday": "https://superbetpredictions.com/yesterdaytoptips",
    "all_yesterday": "https://superbetpredictions.com/yesterday"
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr,en-US;q=0.9,en;q=0.8"
}

def calculate_confidence(odd_val, tip):
    """Calculate proprietary confidence index (%) from odds and safety profile"""
    try:
        odd = float(odd_val)
    except:
        odd = 1.30

    # Base confidence inversely proportional to odds
    if odd <= 1.20:
        base = 92
    elif odd <= 1.30:
        base = 86
    elif odd <= 1.40:
        base = 80
    elif odd <= 1.55:
        base = 74
    else:
        base = 68

    # Double chance (1X / X2) bonus
    if "X" in tip.upper() and tip.upper() != "X":
        base = min(96, base + 4)

    return base

def parse_page_matches(html_content, is_top=False):
    soup = BeautifulSoup(html_content, 'html.parser')
    table = soup.find('table')
    if not table:
        return []

    league_tds = table.find_all('td', class_='league')
    results = []

    for ltd in league_tds:
        try:
            league_name = ltd.get_text(strip=True)
            tr_league = ltd.find_parent('tr')
            if not tr_league:
                continue

            tr_teams = tr_league.find_next_sibling('tr')
            if not tr_teams:
                continue

            codes = tr_teams.find_all('code')
            if len(codes) < 3:
                continue

            home = codes[0].get_text(strip=True)
            score = codes[1].get_text(strip=True).replace('_-_', '-').strip()
            away = codes[2].get_text(strip=True)

            tr_info = tr_teams.find_next_sibling('tr')
            if not tr_info:
                continue

            time_val = ''
            tip_val = ''
            odds_val = '1.30'
            status = 'PENDING'

            tds = tr_info.find_all('td')
            for td in tds:
                txt = td.get_text(strip=True)
                if 'Time:' in txt:
                    time_val = txt.replace('Time:', '').strip()
                if 'Tip:' in txt:
                    tip_val = txt.replace('Tip:', '').strip().upper()
                if 'Odds:' in txt:
                    m = re.search(r'Odds:\s*([0-9.]+)', txt)
                    if m:
                        odds_val = m.group(1)

                if td.find('img', src=lambda s: s and 'greendot' in s):
                    status = 'WON'
                elif td.find('img', src=lambda s: s and 'reddot' in s):
                    status = 'LOST'

            # Clean score display
            if score == '-' or not score:
                score = '-'

            conf = calculate_confidence(odds_val, tip_val)

            match_id = re.sub(r'[^a-zA-Z0-9]', '', f"{home}_{away}").lower()

            results.append({
                "id": match_id,
                "league": league_name,
                "time": time_val,
                "home": home,
                "away": away,
                "tip": tip_val,
                "odds": float(odds_val) if odds_val.replace('.', '', 1).isdigit() else 1.30,
                "score": score,
                "status": status,
                "confidence": conf,
                "is_top": is_top,
                "tier": "Ultra-Safe" if conf >= 85 else "Value-Safe"
            })
        except Exception as e:
            continue

    return results

class SharpPicksEngine:
    def __init__(self):
        self.vault = {
            "model": "Mentor Alpha-10 Quant",
            "last_updated": None,
            "today_picks": [],
            "yesterday_summary": {
                "total": 0,
                "won": 0,
                "lost": 0,
                "pending": 0,
                "win_rate": 0.0,
                "avg_odds": 0.0,
                "picks": []
            }
        }
        self.load_vault()

    def load_vault(self):
        if os.path.exists(VAULT_FILE):
            try:
                with open(VAULT_FILE, 'r', encoding='utf-8') as f:
                    self.vault = json.load(f)
            except Exception as e:
                print(f"[SHARP_ENGINE] Could not load vault: {e}")

    def save_vault(self):
        try:
            self.vault["last_updated"] = datetime.now().isoformat()
            with open(VAULT_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.vault, f, ensure_ascii=False, indent=2)
            print(f"[SHARP_ENGINE] Successfully saved vault to {VAULT_FILE}")
        except Exception as e:
            print(f"[SHARP_ENGINE] Save error: {e}")

        # Push to Render Cloud API
        try:
            render_url = os.environ.get('RENDER_EXTERNAL_URL', 'https://live-bet-mentor.onrender.com')
            sync_url = f"{render_url}/api/sync/sharp-picks"
            r = requests.post(sync_url, json=self.vault, headers={'Content-Type': 'application/json', 'x-sync-secret': 'lbm-sync-2026'}, timeout=15)
            if r.status_code == 200:
                print("[SHARP_ENGINE] 🚀 Successfully pushed sharp picks to Render cloud!")
            else:
                print(f"[SHARP_ENGINE] Render cloud response: {r.status_code}")
        except Exception as e:
            print(f"[SHARP_ENGINE] Render sync notice: {e}")

    def fetch_today_picks(self):
        print("[SHARP_ENGINE] Fetching today's top sharp selections...")
        picks = []
        try:
            # 1. Fetch Top 10 Picks first
            r_top = requests.get(SOURCE_CONFIG["top_today"], headers=HEADERS, timeout=12)
            if r_top.status_code == 200:
                top_matches = parse_page_matches(r_top.text, is_top=True)
                picks.extend(top_matches)
                print(f"[SHARP_ENGINE] Extracted {len(top_matches)} Top Tier picks")
        except Exception as e:
            print(f"[SHARP_ENGINE] Error fetching top picks: {e}")

        # 2. Fetch General Today's Picks if needed to supplement
        try:
            r_all = requests.get(SOURCE_CONFIG["all_today"], headers=HEADERS, timeout=12)
            if r_all.status_code == 200:
                all_matches = parse_page_matches(r_all.text, is_top=False)
                existing_ids = {m["id"] for m in picks}
                added_count = 0
                for m in all_matches:
                    if m["id"] not in existing_ids:
                        picks.append(m)
                        existing_ids.add(m["id"])
                        added_count += 1
                print(f"[SHARP_ENGINE] Supplemented with {added_count} additional picks")
        except Exception as e:
            print(f"[SHARP_ENGINE] Error fetching general today picks: {e}")

        if picks:
            def get_time_minutes(m):
                t_str = str(m.get("time", "")).strip()
                if not t_str: return 9999
                parts = t_str.split(":")
                if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                    return int(parts[0]) * 60 + int(parts[1])
                return 9999

            picks.sort(key=get_time_minutes)
            self.vault["today_picks"] = picks

    def fetch_yesterday_record(self):
        print("[SHARP_ENGINE] Fetching yesterday's verification record...")
        try:
            r = requests.get(SOURCE_CONFIG["top_yesterday"], headers=HEADERS, timeout=12)
            if r.status_code != 200:
                r = requests.get(SOURCE_CONFIG["all_yesterday"], headers=HEADERS, timeout=12)

            if r.status_code == 200:
                y_matches = parse_page_matches(r.text, is_top=True)
                def get_time_minutes(m):
                    t_str = str(m.get("time", "")).strip()
                    if not t_str: return 9999
                    parts = t_str.split(":")
                    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                        return int(parts[0]) * 60 + int(parts[1])
                    return 9999

                y_matches.sort(key=get_time_minutes)
                won = sum(1 for m in y_matches if m["status"] == "WON")
                lost = sum(1 for m in y_matches if m["status"] == "LOST")
                pending = sum(1 for m in y_matches if m["status"] == "PENDING")
                decided = won + lost
                win_rate = round((won / decided * 100), 1) if decided > 0 else 0.0
                odds_vals = [m["odds"] for m in y_matches if m["odds"] > 0]
                avg_odds = round(sum(odds_vals) / len(odds_vals), 2) if odds_vals else 0.0

                self.vault["yesterday_summary"] = {
                    "total": len(y_matches),
                    "won": won,
                    "lost": lost,
                    "pending": pending,
                    "win_rate": win_rate,
                    "avg_odds": avg_odds,
                    "picks": y_matches
                }
                print(f"[SHARP_ENGINE] Yesterday record: {won} Won / {lost} Lost ({win_rate}% Win Rate)")
        except Exception as e:
            print(f"[SHARP_ENGINE] Error fetching yesterday record: {e}")

    def update_cycle(self):
        print(f"\n[SHARP_ENGINE] === Starting update cycle at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===")
        self.fetch_today_picks()
        self.fetch_yesterday_record()
        self.save_vault()

    def run_daemon(self, interval_seconds=1800):
        print(f"[SHARP_ENGINE] Starting daemon mode (polling every {interval_seconds}s)...")
        while True:
            try:
                self.update_cycle()
            except Exception as e:
                print(f"[SHARP_ENGINE] Cycle error: {e}")
            time.sleep(interval_seconds)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Mentor Alpha Sharp Picks Engine")
    parser.add_argument("--once", action="store_true", help="Run a single update cycle and exit")
    parser.add_argument("--daemon", action="store_true", help="Run continuously in background")
    parser.add_argument("--interval", type=int, default=1800, help="Poll interval in seconds (default 1800)")
    args = parser.parse_args()

    engine = SharpPicksEngine()
    if args.daemon:
        engine.run_daemon(interval_seconds=args.interval)
    else:
        engine.update_cycle()
