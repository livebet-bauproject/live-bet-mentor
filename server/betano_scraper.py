#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BETANO ACCA & SENTIMENT RADAR (LiveBet Mentor)
Scrapes and analyzes Betano's 'Beliebte Kombiwetten' (Popular Accumulators / Hot Picks)
Features:
- Live REST API extraction via curl_cffi TLS impersonation
- Compounded House Margin & True Win Probability calculation
- Public Money Sentiment & Fade Radar (selectionCount tracking)
- Diamond Pick Extraction (Filtering out trap legs)
- Dual Output: Dedicated betano_cards.json & Consensus integration
"""

import sys
import os
import json
import time
from datetime import datetime

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(SERVER_DIR, "betano_cards.json")
CONSENSUS_FILE = os.path.join(SERVER_DIR, "consensus_data.json")

try:
    import site
    if hasattr(site, 'getusersitepackages'):
        _usp = site.getusersitepackages()
        if _usp and _usp not in sys.path:
            sys.path.insert(0, _usp)
except Exception:
    pass

try:
    from curl_cffi import requests
except ImportError:
    import requests


TEAM_TRANSLATIONS = {
    # Milli Takımlar / Ülkeler (Almanca -> Türkçe)
    "Türkei": "Türkiye",
    "Frankreich": "Fransa",
    "Italien": "İtalya",
    "Belgien": "Belçika",
    "Montenegro": "Karadağ",
    "Zypern": "Kıbrıs",
    "Ungarn": "Macaristan",
    "Ukraine": "Ukrayna",
    "Marokko": "Fas",
    "Gabun": "Gabon",
    "Ägypten": "Mısır",
    "Angola": "Angola",
    "Slowenien": "Slovenya",
    "Schottland": "İskoçya",
    "Algerien": "Cezayir",
    "Sambia": "Zambiya",
    "England": "İngiltere",
    "Kasachstan": "Kazakistan",
    "Deutschland": "Almanya",
    "Spanien": "İspanya",
    "Niederlande": "Hollanda",
    "Portugal": "Portekiz",
    "Kroatien": "Hırvatistan",
    "Dänemark": "Danimarka",
    "Schweden": "İsveç",
    "Schweiz": "İsviçre",
    "Polen": "Polonya",
    "Serbien": "Sırbistan",
    "Bosnien": "Bosna Hersek",
    "Bosnien und Herzegowina": "Bosna Hersek",
    "Bosnien-Herzegowina": "Bosna Hersek",
    "Albanien": "Arnavutluk",
    "Griechenland": "Yunanistan",
    "Tschechien": "Çekya",
    "Tschechische Republik": "Çekya",
    "Slowakei": "Slovakya",
    "Rumänien": "Romanya",
    "Bulgarien": "Bulgaristan",
    "Österreich": "Avusturya",
    "Norwegen": "Norveç",
    "Finnland": "Finlandiya",
    "Island": "İzlanda",
    "Irland": "İrlanda",
    "Nordirland": "Kuzey İrlanda",
    "Wales": "Galler",
    "Georgien": "Gürcistan",
    "Armenien": "Ermenistan",
    "Aserbaidschan": "Azerbaycan",
    "Israel": "İsrail",
    "Saudi-Arabien": "Suudi Arabistan",
    "Katar": "Katar",
    "Vereinigte Arabische Emirate": "BAE",
    "Iran": "İran",
    "Irak": "Irak",
    "Japan": "Japonya",
    "Südkorea": "Güney Kore",
    "Nordkorea": "Kuzey Kore",
    "Australien": "Avustralya",
    "USA": "ABD",
    "Vereinigte Staaten": "ABD",
    "Mexiko": "Meksika",
    "Kanada": "Kanada",
    "Brasilien": "Brezilya",
    "Argentinien": "Arjantin",
    "Kolombien": "Kolombiya",
    "Uruguay": "Uruguay",
    "Chile": "Şili",
    "Peru": "Peru",
    "Ecuador": "Ekvador",
    "Paraguay": "Paraguay",
    "Venezuela": "Venezuela",
    "Bolivien": "Bolivya",
    "Südafrika": "Güney Afrika",
    "Nigeria": "Nijerya",
    "Senegal": "Senegal",
    "Kamerun": "Kamerun",
    "Ghana": "Gana",
    "Elfenbeinküste": "Fildişi Sahili",
    "Tunesien": "Tunus",
    "Mali": "Mali",
    "Burkina Faso": "Burkina Faso",
    "Kongo": "Kongo",
    "DR Kongo": "Kongo DC",
    "Demokratische Republik Kongo": "Kongo DC",
    "Guinea": "Gine",
    "Äquatorialguinea": "Ekvator Ginesi",
    "Guinea-Bissau": "Gine-Bissau",
    "Kap Verde": "Yeşil Burun Adaları",
    "Madagaskar": "Madagaskar",
    "Mosambik": "Mozambik",
    "Benin": "Benin",
    "Togo": "Togo",
    "Uganda": "Uganda",
    "Kenia": "Kenya",
    "Tansania": "Tanzanya",
    "Simbabwe": "Zimbabve",
    "Sudan": "Sudan",
    "Südsudan": "Güney Sudan",
    "Libyen": "Libya",
    "Nordmazedonien": "Kuzey Makedonya",
    "Mazedonien": "Kuzey Makedonya",
    "Kosovo": "Kosova",
    "Moldawien": "Moldova",
    "Weißrussland": "Belarus",
    "Weissrussland": "Belarus",
    "Belarus": "Belarus",
    "Litauen": "Litvanya",
    "Lettland": "Letonya",
    "Estland": "Estonya",
    "Luxemburg": "Lüksemburg",
    "Malta": "Malta",
    "Andorra": "Andorra",
    "San Marino": "San Marino",
    "Gibraltar": "Cebelitarık",
    "Liechtenstein": "Lihtenştayn",
    "Färöer": "Faroe Adaları",
    "Färöer Inseln": "Faroe Adaları",
    "Usbekistan": "Özbekistan",
    "Jordanien": "Ürdün",
    "Libanon": "Lübnan",
    "Syrien": "Suriye",
    "Oman": "Umman",
    "Bahrain": "Bahreyn",
    "Kuwait": "Kuveyt",
    "China": "Çin",
    "Neuseeland": "Yeni Zelanda",

    # Popüler Kulüpler
    "Bayern München": "Bayern Münih",
    "Roter Stern Belgrad": "Kızılyıldız",
    "Roter Stern": "Kızılyıldız",
    "Sporting Lissabon": "Sporting Lizbon",
    "Benfica Lissabon": "Benfica",
    "Inter Mailand": "Inter",
    "AC Mailand": "Milan",
    "Juventus Turin": "Juventus",
    "AS Rom": "Roma",
    "Lazio Rom": "Lazio",
    "Neapel": "Napoli",
    "Real Madrid": "Real Madrid",
    "Atlético Madrid": "Atletico Madrid",
    "FC Barcelona": "Barcelona",
    "FC Sevilla": "Sevilla",
    "Athletic Bilbao": "Athletic Bilbao",
    "Real Sociedad": "Real Sociedad",
    "FC Porto": "Porto",
    "Paris Saint-Germain": "Paris Saint-Germain",
    "Olympique Marseille": "Marsilya",
    "Olympique Lyon": "Lyon",
    "AS Monaco": "Monaco",
    "OSC Lille": "Lille",
    "Ajax Amsterdam": "Ajax",
    "Feyenoord Rotterdam": "Feyenoord",
    "PSV Eindhoven": "PSV",
    "Celtic Glasgow": "Celtic",
    "Glasgow Rangers": "Rangers",
}

LEAGUE_TRANSLATIONS = {
    "Nations League A": "UEFA Uluslar Ligi A",
    "Nations League B": "UEFA Uluslar Ligi B",
    "Nations League C": "UEFA Uluslar Ligi C",
    "Nations League D": "UEFA Uluslar Ligi D",
    "UEFA Nations League": "UEFA Uluslar Ligi",
    "Afrika Cup Der Nationen - Qualifikationsspiele": "Afrika Uluslar Kupası Elemeleri",
    "Afrika Cup der Nationen - Qualifikation": "Afrika Uluslar Kupası Elemeleri",
    "Afrika Cup der Nationen": "Afrika Uluslar Kupası",
    "Afrika Cup": "Afrika Uluslar Kupası",
    "Europäische Meisterschaft - Qualifikationsspiele U21": "Avrupa U21 Şampiyonası Elemeleri",
    "Europäische Meisterschaft - Qualifikationsspiele": "Avrupa Şampiyonası Elemeleri",
    "Europameisterschaft - Qualifikation": "Avrupa Şampiyonası Elemeleri",
    "Weltmeisterschaft - Qualifikation": "Dünya Kupası Elemeleri",
    "WM - Qualifikation": "Dünya Kupası Elemeleri",
    "Champions League": "UEFA Şampiyonlar Ligi",
    "Europa League": "UEFA Avrupa Ligi",
    "Conference League": "UEFA Konferans Ligi",
    "Freundschaftsspiele": "Hazırlık Maçları",
    "Internationale Freundschaftsspiele": "Uluslararası Hazırlık Maçları",
    "Klub-Freundschaftsspiele": "Kulüp Hazırlık Maçları",
    "Premier League": "İngiltere Premier Lig",
    "LaLiga": "İspanya La Liga",
    "Primera Division": "İspanya La Liga",
    "Serie A": "İtalya Serie A",
    "Bundesliga": "Almanya Bundesliga",
    "2. Bundesliga": "Almanya 2. Bundesliga",
    "Ligue 1": "Fransa Ligue 1",
    "Süper Lig": "Trendyol Süper Lig",
}

MARKET_TRANSLATIONS = {
    "Endergebnis SuperQuoten": "Maç Sonucu (Süper Oran)",
    "Endergebnis Super Quoten": "Maç Sonucu (Süper Oran)",
    "Endergebnis": "Maç Sonucu",
    "Sieger": "Maç Sonucu",
    "Über/Unter Tore Gesamt": "Toplam Gol Alt/Üst",
    "Über / Unter Tore Gesamt": "Toplam Gol Alt/Üst",
    "Tore Gesamt": "Toplam Gol",
    "Beide Teams treffen": "Karşılıklı Gol (KG)",
    "Beide Teams treffen?": "Karşılıklı Gol (KG)",
    "Doppelte Chance": "Çifte Şans",
    "Halbzeit/Endstand": "İlk Yarı / Maç Sonucu",
    "Erste Halbzeit - Endergebnis": "İlk Yarı Sonucu",
    "Zweite Halbzeit - Endergebnis": "İkinci Yarı Sonucu",
    "Eckbälle Gesamt": "Toplam Korner",
    "Karten Gesamt": "Toplam Kart",
    "Genaues Ergebnis": "Skor Tahmini",
    "Handicap": "Handikap",
}

SELECTION_TRANSLATIONS = {
    "Über 0.5": "0.5 Gol Üst",
    "Über 1.5": "1.5 Gol Üst",
    "Über 2.5": "2.5 Gol Üst",
    "Über 3.5": "3.5 Gol Üst",
    "Über 4.5": "4.5 Gol Üst",
    "Unter 0.5": "0.5 Gol Alt",
    "Unter 1.5": "1.5 Gol Alt",
    "Unter 2.5": "2.5 Gol Alt",
    "Unter 3.5": "3.5 Gol Alt",
    "Unter 4.5": "4.5 Gol Alt",
    "Unentschieden": "Beraberlik (X)",
    "Ja": "Evet (KG Var)",
    "Nein": "Hayır (KG Yok)",
}


def translate_team(name):
    if not name:
        return ""
    name_clean = name.strip()
    suffix = ""
    for s in [" U21", " U19", " U20", " U23", " Frauen", " (F)"]:
        if name_clean.endswith(s):
            suffix = " Kadınlar" if "Frauen" in s or "(F)" in s else s
            name_clean = name_clean[:-len(s)].strip()
            break
    translated = TEAM_TRANSLATIONS.get(name_clean, name_clean)
    return f"{translated}{suffix}"


def translate_league(league):
    if not league:
        return ""
    league_clean = league.strip()
    if league_clean in LEAGUE_TRANSLATIONS:
        return LEAGUE_TRANSLATIONS[league_clean]
    res = league_clean
    res = res.replace("Nations League", "UEFA Uluslar Ligi")
    res = res.replace("Afrika Cup Der Nationen", "Afrika Uluslar Kupası")
    res = res.replace("Afrika Cup der Nationen", "Afrika Uluslar Kupası")
    res = res.replace("Europäische Meisterschaft", "Avrupa Şampiyonası")
    res = res.replace("Europameisterschaft", "Avrupa Şampiyonası")
    res = res.replace("Weltmeisterschaft", "Dünya Kupası")
    res = res.replace("Qualifikationsspiele", "Elemeleri")
    res = res.replace("Qualifikation", "Elemeleri")
    res = res.replace("Freundschaftsspiele", "Hazırlık Maçları")
    return res


def translate_market(market):
    if not market:
        return ""
    m_clean = market.strip()
    if m_clean in MARKET_TRANSLATIONS:
        return MARKET_TRANSLATIONS[m_clean]
    res = m_clean
    res = res.replace("Endergebnis SuperQuoten", "Maç Sonucu (Süper Oran)")
    res = res.replace("Endergebnis", "Maç Sonucu")
    res = res.replace("Über/Unter Tore Gesamt", "Toplam Gol Alt/Üst")
    res = res.replace("Über / Unter Tore Gesamt", "Toplam Gol Alt/Üst")
    res = res.replace("Tore Gesamt", "Toplam Gol")
    res = res.replace("Beide Teams treffen", "Karşılıklı Gol")
    res = res.replace("Doppelte Chance", "Çifte Şans")
    return res


def translate_selection(sel, home_tr="", away_tr="", raw_home="", raw_away=""):
    if not sel:
        return ""
    sel_clean = sel.strip()
    if sel_clean in SELECTION_TRANSLATIONS:
        return SELECTION_TRANSLATIONS[sel_clean]
    if sel_clean.startswith("Über "):
        return sel_clean.replace("Über ", "") + " Gol Üst"
    if sel_clean.startswith("Unter "):
        return sel_clean.replace("Unter ", "") + " Gol Alt"
    if "unentschieden" in sel_clean.lower():
        return "Beraberlik (X)"
    if (raw_home and sel_clean.lower() == raw_home.lower()) or (home_tr and sel_clean.lower() == home_tr.lower()) or sel_clean == "1":
        return f"{home_tr} (MS 1)"
    if (raw_away and sel_clean.lower() == raw_away.lower()) or (away_tr and sel_clean.lower() == away_tr.lower()) or sel_clean == "2":
        return f"{away_tr} (MS 2)"
    translated_team = translate_team(sel_clean)
    if translated_team != sel_clean:
        return translated_team
    return sel_clean


def parse_teams_from_event(event_name):
    """Split eventName (e.g. 'Türkei - Frankreich' or 'Partizan - Olimpia Milano') into home and away."""
    if not event_name:
        return "", ""
    parts = event_name.split(" - ")
    if len(parts) >= 2:
        return parts[0].strip(), parts[1].strip()
    parts = event_name.split("-")
    if len(parts) >= 2:
        return parts[0].strip(), parts[1].strip()
    return event_name.strip(), ""


def calculate_card_metrics(events, total_odds):
    """
    Computes mathematical probability, trap rating, public sentiment,
    translates German entities to Turkish, and extracts the 'Diamond Pick'
    (the safest / best value single selection).
    """
    if not events:
        return {
            "compounded_vig": 0.0,
            "true_win_prob_pct": 0.0,
            "trap_score": 0,
            "verdict": "UNKNOWN",
            "diamond_pick": None,
            "trap_legs": []
        }

    # Standard single-market vigorish assumed ~5.5% (0.945 payout)
    single_payout = 0.945
    n_legs = len(events)
    # Compounded bookmaker margin: 1 - (single_payout ^ n)
    compounded_vig_pct = round((1.0 - (single_payout ** n_legs)) * 100, 1)

    cumulative_prob = 1.0
    analyzed_legs = []
    diamond_candidates = []

    for ev in events:
        price = float(ev.get("selection", {}).get("price") or 1.0)
        sel_count = int(ev.get("selectionCount") or 0)
        raw_sel_name = ev.get("selection", {}).get("name", "")
        raw_mkt_name = ev.get("marketName", "")
        raw_event_name = ev.get("eventName", "")
        raw_league_name = ev.get("leagueName", "")

        raw_home, raw_away = parse_teams_from_event(raw_event_name)
        home_tr = translate_team(raw_home)
        away_tr = translate_team(raw_away)
        event_name_tr = f"{home_tr} - {away_tr}" if away_tr else home_tr
        league_tr = translate_league(raw_league_name)
        market_tr = translate_market(raw_mkt_name)
        sel_name_tr = translate_selection(raw_sel_name, home_tr=home_tr, away_tr=away_tr, raw_home=raw_home, raw_away=raw_away)

        implied_prob = (1.0 / price) if price > 0 else 0.0
        # De-vigged approximate probability
        fair_prob = min(0.96, implied_prob * single_payout)
        cumulative_prob *= fair_prob

        # Trap factor: odds >= 2.0 or volatile markets in a combo
        is_trap_candidate = price >= 1.95
        # High public money: more than 1,000 bettors
        is_public_heavy = sel_count >= 1000

        leg_data = {
            "event_name": event_name_tr,
            "home": home_tr,
            "away": away_tr,
            "league": league_tr,
            "market": market_tr,
            "selection": sel_name_tr,
            "raw_event_name": raw_event_name,
            "raw_home": raw_home,
            "raw_away": raw_away,
            "raw_market": raw_mkt_name,
            "raw_selection": raw_sel_name,
            "price": price,
            "selection_count": sel_count,
            "implied_prob_pct": round(implied_prob * 100, 1),
            "fair_prob_pct": round(fair_prob * 100, 1),
            "is_trap": is_trap_candidate,
            "is_public_heavy": is_public_heavy,
            "risk_level": "YÜKSEK (Tuzak)" if price >= 2.10 else ("ORTA" if price >= 1.60 else "DÜŞÜK")
        }
        analyzed_legs.append(leg_data)

        # Diamond candidates: high fair prob (>= 65%), odds between 1.25 and 1.75
        if 1.25 <= price <= 1.75 and fair_prob >= 0.55:
            diamond_candidates.append(leg_data)

    true_win_prob_pct = round(cumulative_prob * 100, 2)
    
    # Calculate Trap Score (0 - 100)
    # Higher vig + lower win prob + high individual leg odds = higher trap score
    trap_score = min(99, int(compounded_vig_pct * 1.5 + (100 - true_win_prob_pct * 4) * 0.4))
    if trap_score < 10: trap_score = 10

    # Verdict
    if trap_score >= 70 or true_win_prob_pct < 8.0:
        verdict = "YÜKSEK RİSK / TUZAK KOMBİNE (Tek Tek Ayıklayın)"
        verdict_code = "HIGH_TRAP"
    elif trap_score >= 45:
        verdict = "ORTA RİSK / SEÇİCİ DEĞER (Maks. 2 Maç Seçin)"
        verdict_code = "SELECTIVE_VALUE"
    else:
        verdict = "DÜŞÜK RİSK / YÜKSEK PROBABİLİTE"
        verdict_code = "LOW_RISK"

    # Select best Diamond Pick (safest value leg)
    diamond_pick = None
    if diamond_candidates:
        # Sort by best balance of fair_prob and selection_count
        diamond_candidates.sort(key=lambda x: (x["fair_prob_pct"], x["selection_count"]), reverse=True)
        diamond_pick = diamond_candidates[0]
    elif analyzed_legs:
        # Fallback to leg with highest fair probability
        sorted_by_prob = sorted(analyzed_legs, key=lambda x: x["fair_prob_pct"], reverse=True)
        diamond_pick = sorted_by_prob[0]

    trap_legs = [l for l in analyzed_legs if l["is_trap"]]

    return {
        "compounded_vig_pct": compounded_vig_pct,
        "true_win_prob_pct": true_win_prob_pct,
        "trap_score": trap_score,
        "verdict": verdict,
        "verdict_code": verdict_code,
        "diamond_pick": diamond_pick,
        "trap_legs": trap_legs,
        "analyzed_legs": analyzed_legs
    }


def fetch_betano_cards():
    """Fetches real-time popular accumulators from Betano API."""
    url = "https://www.betano.de/api/accaCards"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.betano.de/'
    }

    try:
        r = requests.get(url, headers=headers, impersonate='chrome120', timeout=15)
        if r.status_code != 200:
            print(f"[BETANO] HTTP Error {r.status_code}")
            return None
        return r.json()
    except Exception as e:
        print(f"[BETANO] Network/Request error: {e}")
        return None


def process_and_save():
    """Main execution: fetches, processes, analyzes, and saves Betano cards."""
    print(f"[{datetime.now().strftime('%H:%M:%S')}] [BETANO] Fetching Beliebte Kombiwetten & Hot Picks from Betano...")
    raw_data = fetch_betano_cards()
    if not raw_data:
        print("[BETANO] Failed to fetch data from Betano.")
        return False

    cards = raw_data.get('data', {}).get('accaCards', [])
    if not cards:
        print("[BETANO] No accaCards found in response.")
        return False

    processed_cards = []
    consensus_predictions = []

    # Filter ONLY Hot Picks (TrendingSelection) as requested
    hot_picks_cards = [c for c in cards if c.get('cardType') == 'TrendingSelection' or 'hot' in c.get('title', '').lower()]
    selected_cards = hot_picks_cards if hot_picks_cards else (cards[-1:] if cards else [])

    for idx, card in enumerate(selected_cards):
        card_type = "HotPicks"
        title = f"Günün Sıcak Seçimleri #{idx + 1}" if len(selected_cards) > 1 else "Günün Sıcak Seçimleri (Hot Picks)"
        total_odds = float(card.get('totalOdds') or 1.0)
        events = card.get('events', [])

        metrics = calculate_card_metrics(events, total_odds)

        card_info = {
            "card_type": card_type,
            "title": title,
            "total_odds": total_odds,
            "events_count": len(events),
            "metrics": metrics,
            "events": metrics.get("analyzed_legs", []),
            "updated_at": datetime.now().isoformat()
        }
        processed_cards.append(card_info)

        # Convert selections to Consensus prediction format for consensus_data.json
        for leg in metrics.get("analyzed_legs", []):
            home = leg["home"]
            away = leg["away"]
            if not home or not away:
                continue

            sel_name = leg["selection"]
            mkt_name = leg["market"]
            raw_sel = leg.get("raw_selection", "")
            raw_mkt = leg.get("raw_market", "")
            price = leg["price"]

            markets = {}
            check_mkt = f"{mkt_name} {raw_mkt}".lower()
            check_sel = f"{sel_name} {raw_sel}".lower()

            # Match Winner (1X2)
            if any(k in check_mkt for k in ["endergebnis", "sieger", "winner", "1x2", "maç sonucu", "sonucu"]):
                if "ms 1" in check_sel or home.lower() in check_sel:
                    markets["1X2"] = {"pred": "1", "price": price, "source_note": f"Piyasa Yoğunluğu ({leg['selection_count']} kupon)"}
                elif "ms 2" in check_sel or away.lower() in check_sel:
                    markets["1X2"] = {"pred": "2", "price": price, "source_note": f"Piyasa Yoğunluğu ({leg['selection_count']} kupon)"}
                elif any(d in check_sel for d in ["unentschieden", "draw", "beraberlik", "x"]):
                    markets["1X2"] = {"pred": "X", "price": price, "source_note": f"Piyasa Yoğunluğu ({leg['selection_count']} kupon)"}

            # Over/Under
            if any(k in check_mkt for k in ["über/unter", "over/under", "tore", "gol", "alt/üst"]):
                if "1.5" in check_sel or "1.5" in check_mkt:
                    if any(w in check_sel for w in ["über", "over", "üst"]):
                        markets["OU15"] = {"pred": "OVER", "price": price}
                    elif any(w in check_sel for w in ["unter", "under", "alt"]):
                        markets["OU15"] = {"pred": "UNDER", "price": price}
                elif "2.5" in check_sel or "2.5" in check_mkt:
                    if any(w in check_sel for w in ["über", "over", "üst"]):
                        markets["OU25"] = {"pred": "OVER", "price": price}
                    elif any(w in check_sel for w in ["unter", "under", "alt"]):
                        markets["OU25"] = {"pred": "UNDER", "price": price}

            if markets:
                consensus_predictions.append({
                    "home": home,
                    "away": away,
                    "league": leg["league"],
                    "date": datetime.now().strftime("%d.%m"),
                    "score_pred": "N/A",
                    "markets": markets,
                    "public_bets": leg["selection_count"],
                    "card_source": "Global Hot Picks",
                    "timestamp": datetime.now().isoformat()
                })

    # Save dedicated Betano JSON
    output_payload = {
        "status": "success",
        "timestamp": datetime.now().isoformat(),
        "total_cards": len(processed_cards),
        "cards": processed_cards
    }

    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(output_payload, f, ensure_ascii=False, indent=2)
        print(f"[BETANO] Successfully saved {len(processed_cards)} analyzed cards to {OUTPUT_FILE}")
    except Exception as e:
        print(f"[BETANO] Save error: {e}")

    # Also integrate into consensus_data.json if it exists
    if consensus_predictions and os.path.exists(CONSENSUS_FILE):
        try:
            with open(CONSENSUS_FILE, 'r', encoding='utf-8') as f:
                c_data = json.load(f)
            c_data["betano"] = consensus_predictions
            with open(CONSENSUS_FILE, 'w', encoding='utf-8') as f:
                json.dump(c_data, f, ensure_ascii=False, indent=2)
            print(f"[BETANO] Integrated {len(consensus_predictions)} Betano market predictions into consensus_data.json")
        except Exception as e:
            print(f"[BETANO] Consensus integration error: {e}")

    # Push to Render Cloud API
    try:
        render_url = os.environ.get('RENDER_EXTERNAL_URL', 'https://live-bet-mentor.onrender.com')
        sync_url = f"{render_url}/api/sync/betano"
        r = requests.post(sync_url, json=output_payload, headers={'Content-Type': 'application/json', 'x-sync-secret': 'lbm-sync-2026'}, timeout=15)
        if r.status_code == 200:
            print("[BETANO] 🚀 Successfully pushed Betano cards to Render cloud!")
        else:
            print(f"[BETANO] Render cloud sync response: {r.status_code}")
    except Exception as e:
        print(f"[BETANO] Render sync notice: {e}")

    # Print executive summary to stdout
    print("\n" + "=" * 65)
    print(" ⚡ BETANO POPULAR ACCA & SENTIMENT REPORT (INSTITUTIONAL AUDIT) ")
    print("=" * 65)
    for c in processed_cards:
        m = c["metrics"]
        print(f"\n📌 Kupon: {c['title']} ({c['card_type']})")
        print(f"   • Toplam Oran: {c['total_odds']} | Maç Sayısı: {c['events_count']}")
        print(f"   • Kasa Marjı: %{m['compounded_vig_pct']} (Compounded Vig)")
        print(f"   • Gerçek Kazanma Olasılığı: %{m['true_win_prob_pct']}")
        print(f"   • Tuzak Skoru: {m['trap_score']}/100 -> {m['verdict']}")
        if m.get("diamond_pick"):
            dp = m["diamond_pick"]
            print(f"   💎 AYIKLANAN CEVHER SEÇİM: [{dp['league']}] {dp['event_name']} -> {dp['selection']} (@{dp['price']}) (Gerçek Şans: %{dp['fair_prob_pct']}, Oynanma: {dp['selection_count']})")
        if m.get("trap_legs"):
            print(f"   ⚠️ TUZAK MAÇLAR ({len(m['trap_legs'])} adet):")
            for tl in m["trap_legs"]:
                print(f"      - {tl['event_name']} -> {tl['selection']} (@{tl['price']}) [Risk: {tl['risk_level']}]")
    print("=" * 65 + "\n")

    return True


if __name__ == "__main__":
    process_and_save()
