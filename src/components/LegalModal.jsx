import React from 'react';
import { translations } from '../locales/translations';

export const LegalModal = ({ isOpen, onClose, lang = 'tr' }) => {
    if (!isOpen) return null;

    const t = translations[lang] || translations['tr'];

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
        }}>
            <div style={{
                background: 'linear-gradient(135deg, #0b1329 0%, #030712 100%)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '20px',
                maxWidth: '680px',
                width: '100%',
                maxHeight: '85vh',
                overflowY: 'auto',
                padding: '2.5rem',
                color: '#e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
                position: 'relative'
            }}>
                {/* Close Button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1.5rem',
                        right: '1.5rem',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: 'none',
                        color: '#94a3b8',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    ✕
                </button>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '2.4rem' }}>⚖️</span>
                    <div>
                        <div style={{
                            display: 'inline-block',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.65rem',
                            fontWeight: 900,
                            letterSpacing: '1px',
                            marginBottom: '0.4rem'
                        }}>
                            {t.legal_modal_badge || (lang === 'tr' ? '🔞 18+ YASAL BİLGİLENDİRME & KULLANIM SÖZLEŞMESİ' : (lang === 'de' ? '🔞 18+ GESETZLICHE HINWEISE & NUTZUNGSBEDINGUNGEN' : '🔞 18+ STATUTORY DISCLOSURE & TERMS OF USE'))}
                        </div>
                        <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f8fafc', margin: 0 }}>
                            {t.legal_modal_title || (lang === 'tr' ? 'Hukuki Şartlar & Sorumluluk Reddi' : (lang === 'de' ? 'Rechtliche Bedingungen & Haftungsausschluss' : 'Legal Terms & Disclaimer'))}
                        </h2>
                    </div>
                </div>

                {/* Content Sections */}
                <div style={{ fontSize: '0.85rem', lineHeight: 1.7, color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    
                    {/* Section 1 */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <h4 style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                            {t.legal_section1_title || (lang === 'tr' ? '1. Platformun Niteliği (Bahis Oynatılmaz)' : (lang === 'de' ? '1. Art der Plattform (Kein Glücksspiel)' : '1. Nature of the Platform (No Gambling Conducted)'))}
                        </h4>
                        <p style={{ margin: 0 }}>
                            {t.legal_section1_body || (lang === 'tr' 
                                ? 'LiveBet Mentor, spor müsabakalarına ilişkin kamuya açık verileri toplayan, xG, momentum ve veri kalitesi (DQS) metriklerini algoritmik olarak hesaplayan bir "Nicel Spor Analitiği ve İstatistik Yazılımıdır" (SaaS). Sitemiz bir bahis oynatma sitesi, kasa, aracı kurum veya bahis bürosu DEĞİLDİR. Sitemiz üzerinden hiçbir şekilde para yatırma, kupon yatırma veya bahis oynama işlemi gerçekleştirilemez.'
                                : (lang === 'de'
                                    ? 'LiveBet Mentor ist eine quantitative Sportanalyse- und Statistik-Software (SaaS) auf Basis öffentlich zugänglicher Daten. Es ist KEIN Buchmacher, Wettanbieter oder Vermittler. Auf dieser Plattform können keine Einsätze getätigt werden.'
                                    : 'LiveBet Mentor is a quantitative sports analytics and statistics software (SaaS) processing publicly available data. It is NOT a bookmaker, betting operator, or gambling intermediary. No bets or stakes are placed or processed on this platform.'
                                )
                            )}
                        </p>
                    </div>

                    {/* Section 2 */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <h4 style={{ color: '#fbbf24', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                            {t.legal_section2_title || (lang === 'tr' ? '2. 7258 Sayılı Kanun ve Yasal Uyum Beyanı' : (lang === 'de' ? '2. Gesetzliche Compliance- & Regulierungserklärung' : '2. Statutory & Regulatory Compliance Statement'))}
                        </h4>
                        <p style={{ margin: 0 }}>
                            {t.legal_section2_body || (lang === 'tr'
                                ? 'Platformumuz, Türkiye Cumhuriyeti 7258 sayılı "Futbol ve Diğer Spor Müsabakalarında Bahis ve Şans Oyunları Düzenlenmesi Hakkında Kanun" ve uluslararası mevzuat kurallarına harfiyen uymaktadır. Sitemizde yasadışı (kaçak) bahis sitelerinin reklamı, bağlantısı (affiliate/link) veya teşviki kesinlikle yapılmamaktadır.'
                                : (lang === 'de'
                                    ? 'Unsere Plattform erfüllt strikt alle gesetzlichen Vorgaben und internationalen Standards. Wir bewerben, verlinken oder fördern keinesfalls illegale oder nicht lizenzierte Wettanbieter.'
                                    : 'Our platform strictly complies with statutory sports wagering regulations and international standards. We do not promote, advertise, or link to unlicensed gambling operators.'
                                )
                            )}
                        </p>
                    </div>

                    {/* Section 3 */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <h4 style={{ color: '#f43f5e', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                            {t.legal_section3_title || (lang === 'tr' ? '3. Kesin Kazanç Garantisi Yoktur (İstatistiki Çıktı)' : (lang === 'de' ? '3. Keine Gewinngarantie (Statistische Wahrscheinlichkeiten)' : '3. No Guarantee of Profit (Statistical Outputs)'))}
                        </h4>
                        <p style={{ margin: 0 }}>
                            {t.legal_section3_body || (lang === 'tr'
                                ? 'Sistemde yer alan tüm yüzdeler, "Sistem Tahmini", "Günün Altın İkilisi", "Alpha Sinyaller" ve DQS skorları matematiksel olasılık hesaplarıdır. Spor karşılaşmaları öngörülemeyen değişkenler (kırmızı kart, hava durumu, hakem kararları vb.) barındırır; bu sebeple hiçbir veri veya algoritma KESİN KAZANÇ GARANTİSİ VERMEZ. Sitemizdeki veriler finansal veya yatırım tavsiyesi değildir.'
                                : (lang === 'de'
                                    ? 'Alle Wahrscheinlichkeiten, Alpha-Scores und Vorhersagen sind mathematisch-statistische Auswertungen. Sportereignisse unterliegen unvorhersehbaren Schwankungen; keine Analyse garantiert Gewinne. Die Daten stellen keine Anlage- oder Finanzberatung dar.'
                                    : 'All probabilities, Alpha scores, and predictions are statistical outputs. Sports events involve inherent volatility; no data or algorithm guarantees winnings. Nothing on this site constitutes financial advice.'
                                )
                            )}
                        </p>
                    </div>

                    {/* Section 4 */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <h4 style={{ color: '#a78bfa', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                            {t.legal_section4_title || (lang === 'tr' ? '4. 18+ Yaş Sınırı ve Kullanıcı Sorumluluğu' : (lang === 'de' ? '4. Altersbeschränkung ab 18 Jahren & Eigenverantwortung' : '4. 18+ Age Restriction & User Responsibility'))}
                        </h4>
                        <p style={{ margin: 0 }}>
                            {t.legal_section4_body || (lang === 'tr'
                                ? 'Sitemize kaydolan kullanıcılar 18 yaşını doldurmuş olduklarını kabul ve beyan ederler. 18 yaşından küçüklerin platformu kullanması yasaktır. Kullanıcıların platformdaki istatistikleri kullanarak alacakları tüm bireysel kararlar ve bu kararların maddi/manevi tüm sonuçları münhasıran kullanıcının kendi sorumluluğundadır.'
                                : (lang === 'de'
                                    ? 'Nutzer müssen mindestens 18 Jahre alt sein. Minderjährigen ist die Nutzung untersagt. Sämtliche Entscheidungen auf Grundlage der bereitgestellten Statistiken liegen in der alleinigen Verantwortung des Nutzers.'
                                    : 'Users must be at least 18 years of age. Users are solely responsible for any decisions they make based on the statistics provided.'
                                )
                            )}
                        </p>
                    </div>

                    {/* Section 5 */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <h4 style={{ color: '#10b981', fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                            {t.legal_section5_title || (lang === 'tr' ? '5. Üyelik ve Lisans Bedeli Tanımı' : (lang === 'de' ? '5. Mitgliedschafts- und Softwarelizenzgebühr' : '5. Membership & Software License Definition'))}
                        </h4>
                        <p style={{ margin: 0 }}>
                            {t.legal_section5_body || (lang === 'tr'
                                ? 'VIP / Pro üyelik karşılığı ödenen bedeller; sunucu, yapay zeka işlem maliyeti ve "Canlı Veri Analitik Yazılımı Kullanım Lisansı" ücretidir. Bu bedel hiçbir şekilde bahis yatırımı veya getiri havuzu değildir.'
                                : (lang === 'de'
                                    ? 'VIP- und Pro-Gebühren decken Serverkosten, KI-Rechenleistung und die Softwarelizenz ab. Sie stellen weder Wetteinsätze noch finanzielle Anlagepools dar.'
                                    : 'Membership and VIP fees represent software licensing, server costs, and analytical compute costs. They are not bets or investment contributions.'
                                )
                            )}
                        </p>
                    </div>
                </div>

                {/* Footer Action */}
                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
                            color: '#000',
                            border: 'none',
                            padding: '0.8rem 2.5rem',
                            borderRadius: '12px',
                            fontWeight: 900,
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 15px rgba(56, 189, 248, 0.3)'
                        }}
                    >
                        {t.legal_modal_close || (lang === 'tr' ? 'Anladım ve Kabul Ediyorum' : (lang === 'de' ? 'Verstanden und Zustimmen' : 'I Understand and Agree'))}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LegalModal;
