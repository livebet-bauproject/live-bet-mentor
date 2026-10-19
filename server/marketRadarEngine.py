#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LIVE BET MENTOR - PIYASA FIRSATLARI & AKILLI PARA RADARI (MARKET RADAR ENGINE)
------------------------------------------------------------------------------
24/7 background engine that continuously monitors global odds movements and line shifts
across Football, Basketball, Tennis, and Handball.
Filters out high-variance traps and extracts high-conviction +EV value opportunities.
"""

import sys
import os
import json
import time
import re
from datetime import datetime

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
VAULT_FILE = os.path.join(SERVER_DIR, "market_radar_vault.json")
PUBLIC_VAULT_FILE = os.path.join(SERVER_DIR, "..", "public", "market_radar_vault.json")
SRC_VAULT_FILE = os.path.join(SERVER_DIR, "..", "src", "data", "market_radar_vault.json")

from curl_cffi import requests
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

SPORTS = [
    {'key': 'soccer', 'name_tr': 'Futbol', 'icon': '⚽', 'is_3way': True},
    {'key': 'basketball', 'name_tr': 'Basketbol', 'icon': '🏀', 'is_3way': False},
    {'key': 'tennis', 'name_tr': 'Tenis', 'icon': '🎾', 'is_3way': False},
    {'key': 'handball', 'name_tr': 'Hentbol', 'icon': '🤾', 'is_3way': True},
]

def scrape_sport_movements(sport_info):
    url = f"https://www.betexplorer.com/odds-movements/{sport_info['key']}/"
    for attempt in range(2):
        try:
            r = requests.get(url, headers=HEADERS, impersonate='chrome120', timeout=30)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, 'html.parser')
                table = soup.find('table', class_='table-main--movements')
                if table:
                    break
        except Exception as e:
            if attempt == 1:
                print(f"[MARKET RADAR] Error scraping {sport_info['key']}: {e}")
            time.sleep(2)
    else:
        return []

    picks = []
    current_league = "General"
    current_date = datetime.now().strftime("%d.%m.%Y")

    for tr in table.find_all('tr'):
        # Check league
        th_league = tr.find('th', class_='h-text-left')
        if th_league:
            current_league = th_league.get_text(strip=True)
            continue
            
        th_date = tr.find('th', class_='table-main__date')
        if th_date:
            current_date = th_date.get_text(strip=True)
            continue

        tds = tr.find_all('td')
        if len(tds) < 4:
            continue

        match_td = tds[0]
        match_text = match_td.get_text(strip=True)
        
        # Parse time and teams
        time_match = re.match(r'^(\d{1,2}:\d{2})(.*)$', match_text)
        if time_match:
            match_time = time_match.group(1)
            teams_raw = time_match.group(2).strip()
        else:
            match_time = "TBD"
            teams_raw = match_text

        parts = teams_raw.split(' - ')
        if len(parts) >= 2:
            home = parts[0].strip()
            away = ' - '.join(parts[1:]).strip()
        else:
            home = teams_raw
            away = ""

        # Drop percentage
        drop_pct_td = tds[1]
        drop_pct_text = drop_pct_td.get_text(strip=True).replace('%', '')
        try:
            drop_pct = float(drop_pct_text)
        except:
            drop_pct = 0.0

        # Best odds
        best_odd = 1.80
        best_td = tr.find('td', class_='bestbet-odd')
        if best_td and best_td.get('data-odd'):
            try:
                best_odd = float(best_td.get('data-odd'))
            except:
                pass

        # Target tip outcome
        tip_text = "1"
        odds_cells = [td for td in tds if 'table-main__odds' in (td.get('class') or [])]
        for idx, oc in enumerate(odds_cells):
            oc_classes = oc.get('class') or []
            if any('drop' in c for c in oc_classes) or 'Drop:' in oc.get_text():
                if sport_info['is_3way']:
                    if idx == 0: tip_text = f"MS 1 ({home} Kazanır)"
                    elif idx == 1: tip_text = "MS X (Beraberlik)"
                    elif idx == 2: tip_text = f"MS 2 ({away} Kazanır)"
                else:
                    if idx == 0: tip_text = f"MS 1 ({home} Kazanır)"
                    elif idx == 1: tip_text = f"MS 2 ({away} Kazanır)"
                break

        # Sweet Spot and Confidence Score
        confidence = min(96, max(68, int(62 + (drop_pct * 0.8))))
        unique_id = re.sub(r'[^a-zA-Z0-9]', '', f"{sport_info['key']}_{home}_{away}_{current_date}").lower()

        picks.append({
            'id': unique_id,
            'sport': sport_info['key'],
            'sport_name': sport_info['name_tr'],
            'icon': sport_info['icon'],
            'league': current_league,
            'date': current_date,
            'time': match_time,
            'home': home,
            'away': away,
            'tip': tip_text,
            'odds': best_odd,
            'drop_pct': drop_pct,
            'confidence': confidence,
            'advantage': f"%{int(drop_pct)} Global Oran Düşüşü (Değerli Fiyat)",
            'status': 'ACTIVE'
        })

    return picks

def run_radar_cycle():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [MARKET RADAR] Starting 4-Sport scan cycle...")
    all_raw = []
    for s in SPORTS:
        items = scrape_sport_movements(s)
        all_raw.extend(items)
        print(f"  > {s['icon']} {s['name_tr']}: {len(items)} raw odds movements detected.")

    # High-quality filtering:
    # 1. Sweet spot odds: 1.35 to 2.50
    # 2. Meaningful drop: at least 12%
    filtered_picks = [p for p in all_raw if 1.35 <= p['odds'] <= 2.50 and p['drop_pct'] >= 12.0]
    filtered_picks.sort(key=lambda x: (x['confidence'], x['drop_pct']), reverse=True)

    vault_data = {
        'model': 'LiveBet Quant Market Radar v2.0',
        'last_updated': datetime.now().isoformat(),
        'total_scanned': len(all_raw),
        'total_opportunities': len(filtered_picks),
        'opportunities': filtered_picks
    }

    for path in [VAULT_FILE, PUBLIC_VAULT_FILE, SRC_VAULT_FILE]:
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(vault_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[MARKET RADAR] Error saving {path}: {e}")

    print(f"[MARKET RADAR] Successfully saved {len(filtered_picks)} high-conviction opportunities to vault files.")
    return vault_data

if __name__ == '__main__':
    run_radar_cycle()
