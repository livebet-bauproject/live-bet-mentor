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
    from curl_cffi import requests
except ImportError:
    import requests


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
    and extracts the 'Diamond Pick' (the safest / best value single selection).
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
        sel_name = ev.get("selection", {}).get("name", "")
        mkt_name = ev.get("marketName", "")
        home, away = parse_teams_from_event(ev.get("eventName", ""))

        implied_prob = (1.0 / price) if price > 0 else 0.0
        # De-vigged approximate probability
        fair_prob = min(0.96, implied_prob * single_payout)
        cumulative_prob *= fair_prob

        # Trap factor: odds >= 2.0 or volatile markets in a combo
        is_trap_candidate = price >= 1.95
        # High public money: more than 1,000 bettors
        is_public_heavy = sel_count >= 1000

        leg_data = {
            "event_name": ev.get("eventName"),
            "home": home,
            "away": away,
            "league": ev.get("leagueName"),
            "market": mkt_name,
            "selection": sel_name,
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

    for card in cards:
        card_type = card.get('cardType', '')
        title = card.get('title', 'Kombi')
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
            price = leg["price"]

            markets = {}
            # Match Winner (1X2)
            if any(k in mkt_name.lower() for k in ["endergebnis", "sieger", "winner", "1x2"]):
                if sel_name.lower() in home.lower() or home.lower() in sel_name.lower():
                    markets["1X2"] = {"pred": "1", "price": price, "source_note": f"Betano Public ({leg['selection_count']} bets)"}
                elif sel_name.lower() in away.lower() or away.lower() in sel_name.lower():
                    markets["1X2"] = {"pred": "2", "price": price, "source_note": f"Betano Public ({leg['selection_count']} bets)"}
                elif "unentschieden" in sel_name.lower() or "draw" in sel_name.lower() or "x" == sel_name.lower():
                    markets["1X2"] = {"pred": "X", "price": price, "source_note": f"Betano Public ({leg['selection_count']} bets)"}

            # Over/Under
            if any(k in mkt_name.lower() for k in ["über/unter", "over/under", "tore"]):
                if "1.5" in sel_name or "1.5" in mkt_name:
                    if "über" in sel_name.lower() or "over" in sel_name.lower():
                        markets["OU15"] = {"pred": "OVER", "price": price}
                elif "2.5" in sel_name or "2.5" in mkt_name:
                    if "über" in sel_name.lower() or "over" in sel_name.lower():
                        markets["OU25"] = {"pred": "OVER", "price": price}
                    elif "unter" in sel_name.lower() or "under" in sel_name.lower():
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
                    "card_source": title,
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
