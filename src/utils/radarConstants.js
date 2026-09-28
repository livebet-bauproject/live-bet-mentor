export const RADAR_SOURCES = [
    { id: 'forebet', label: 'Forebet', descTr: 'Forebet (Matematiksel AI Tahmin Motoru)', descEn: 'Forebet (Mathematical AI Model)', color: '#34d399', iq: 'iq_forebet' },
    { id: 'prosoccer', label: 'ProSoccer', descTr: 'ProSoccer (Fizik & Poisson Olasılık Modeli)', descEn: 'ProSoccer (Physics & Poisson Model)', color: '#38bdf8', iq: 'iq_prosoccer' },
    { id: 'predictz', label: 'PredictZ', descTr: 'PredictZ (Skor & Form Tahminleri)', descEn: 'PredictZ (Score & Form Analysis)', color: '#f87171', iq: 'iq_predictz' },
    { id: 'windrawwin', label: 'WDW', descTr: 'WinDrawWin (Trend & İstatistik Tahmini)', descEn: 'WinDrawWin (Trend & Statistical Predictions)', color: '#60a5fa', iq: 'iq_windrawwin' },
    { id: 'statarea', label: 'Statarea', descTr: 'Statarea (İstatistiki Olasılık Analizi)', descEn: 'Statarea (Statistical Probabilities)', color: '#fbbf24', iq: 'iq_statarea' },
    { id: 'vitibet', label: 'Vitibet', descTr: 'Vitibet (Algoritmik Skor & Olasılık Dağılımı)', descEn: 'Vitibet (Algorithmic Score & Probs)', color: '#a78bfa', iq: 'iq_vitibet' },
    { id: 'zulubet', label: 'Zulubet', descTr: 'Zulubet (Kombine Tahmin & Olasılık Dağılımı)', descEn: 'Zulubet (Combined Probabilities)', color: '#f472b6', iq: 'iq_zulubet' },
    { id: 'olbg', label: 'OLBG', descTr: 'OLBG (Topluluk / Tipster Konsensüsü & Halk Oyu)', descEn: 'OLBG (Community Tipster Consensus)', color: '#00f2fe', iq: 'iq_olbg' },
    { id: 'soccervista', label: 'SoccerVista', descTr: 'SoccerVista (Derin Form & Puan Durumu Analizi)', descEn: 'SoccerVista (Deep Form & League Analysis)', color: '#fb923c', iq: 'iq_soccervista' },
    { id: 'superbet', label: 'SuperBet', descTr: 'SuperBet (Keskin Bahis & Trend Tahminleri)', descEn: 'SuperBet (Sharp Betting Predictions)', color: '#facc15', iq: 'iq_superbet' },
    { id: 'betano', label: 'Hot Picks', descTr: 'Betano Hot Picks (Avrupa Popüler Halk Bahisleri)', descEn: 'Betano Hot Picks (Popular Public Accas)', color: '#f97316', iq: 'iq_hotpicks' }
];

export const RADAR_BASE_URLS = {
    forebet: 'https://www.forebet.com',
    predictz: 'https://www.predictz.com',
    windrawwin: 'https://www.windrawwin.com',
    statarea: 'https://www.statarea.com',
    vitibet: 'https://www.vitibet.com',
    zulubet: 'https://www.zulubet.com',
    prosoccer: 'https://www.prosoccer.eu',
    olbg: 'https://www.olbg.com/betting-tips/Football/1',
    soccervista: 'https://www.soccervista.com',
    superbet: 'https://superbetpredictions.com',
    betano: 'https://www.betano.de'
};
