import React, { useState, useEffect, useRef } from 'react';
import { liveCopilotEngine } from '../backend/liveCopilotEngine.js';
import { triggerHaptic } from '../utils/haptics.js';

export const LiveAICopilotModal = ({ match, isOpen, onClose, lang = 'tr' }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const chatEndRef = useRef(null);

    const isTr = lang === 'tr';
    const isDe = lang === 'de';

    const homeTeam = match?.homeTeam || match?.home?.name || (isTr ? 'Ev Sahibi' : (isDe ? 'Heimteam' : 'Home Team'));
    const awayTeam = match?.awayTeam || match?.away?.name || (isTr ? 'Deplasman' : (isDe ? 'Auswärtsteam' : 'Away Team'));
    const score = match?.score || { home: 0, away: 0 };
    const minute = match?.minute || 0;
    const pressure = match?.observations?.pressure?.total || match?.pressure?.total || 0;

    // Reset conversation with an initial welcome briefing whenever opened or match changes
    useEffect(() => {
        if (isOpen && match) {
            const initialBriefing = liveCopilotEngine.generateAnswer(match, 'overview', '', lang);
            setMessages([
                {
                    id: 'init_1',
                    sender: 'ai',
                    text: initialBriefing,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
            ]);
            triggerHaptic('light');
        }
    }, [isOpen, match?.id, match?.matchId]);

    // Scroll to bottom when messages update
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    if (!isOpen || !match) return null;

    const handleSendQuery = (queryType, userQuestionText) => {
        triggerHaptic('medium');
        const userMsg = {
            id: `user_${Date.now()}`,
            sender: 'user',
            text: userQuestionText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, userMsg]);
        setIsTyping(true);

        setTimeout(() => {
            const replyText = liveCopilotEngine.generateAnswer(match, queryType, userQuestionText, lang);
            const aiMsg = {
                id: `ai_${Date.now()}`,
                sender: 'ai',
                text: replyText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, aiMsg]);
            setIsTyping(false);
            triggerHaptic('success');
        }, 350);
    };

    const handleCustomSubmit = (e) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text) return;
        setInputText('');
        handleSendQuery('custom', text);
    };

    return (
        <div className="copilot-modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 10, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
        }} onClick={onClose}>
            <div className="copilot-modal-card" style={{
                background: 'linear-gradient(145deg, #0d1527, #0a0e1a)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 25px rgba(56, 189, 248, 0.15)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '560px',
                height: '85vh',
                maxHeight: '680px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(15, 23, 42, 0.6)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>🤖</span>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                                    {isTr ? 'Canlı AI Maç Asistanı' : (isDe ? 'Live-KI Spielassistent' : 'Live AI Copilot')}
                                </h3>
                                <span style={{
                                    fontSize: '0.65rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'rgba(56, 189, 248, 0.2)',
                                    color: '#38bdf8',
                                    fontWeight: 700
                                }}>
                                    QUANT v3.0
                                </span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                                {homeTeam} {score.home} - {score.away} {awayTeam} • <strong style={{ color: '#22c55e' }}>{minute}'</strong> {pressure >= 75 ? '• 🔥 ALEV' : ''}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: '1.3rem',
                            cursor: 'pointer',
                            padding: '4px 8px'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Preset Chips */}
                <div style={{
                    padding: '10px 14px',
                    display: 'flex',
                    gap: '6px',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                    background: 'rgba(10, 15, 28, 0.7)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <button
                        onClick={() => handleSendQuery('goal_prob', isTr ? 'Gol kokusu var mı?' : (isDe ? 'Liegt ein Tor in der Luft?' : 'Will there be a goal?'))}
                        style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#fca5a5',
                            padding: '5px 10px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        ⚽ {isTr ? 'Gol Kokusu?' : (isDe ? 'Torgefahr?' : 'Goal Danger?')}
                    </button>

                    <button
                        onClick={() => handleSendQuery('dominance', isTr ? 'Hangi takım daha üstün?' : (isDe ? 'Wer hat die Spielkontrolle?' : 'Who is dominating?'))}
                        style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            color: '#7dd3fc',
                            padding: '5px 10px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        🎯 {isTr ? 'Saha Hakimiyeti?' : (isDe ? 'Dominanz?' : 'Dominance?')}
                    </button>

                    <button
                        onClick={() => handleSendQuery('value_odds', isTr ? 'Oran avantajı var mı?' : (isDe ? 'Gibt es eine Value-Quote?' : 'Any value odds?'))}
                        style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            color: '#fcd34d',
                            padding: '5px 10px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        📊 {isTr ? 'Değerli Oran?' : (isDe ? 'Value-Quote?' : 'Value Odds?')}
                    </button>

                    <button
                        onClick={() => handleSendQuery('risk_check', isTr ? 'Kasa riski nedir?' : (isDe ? 'Wie hoch ist das Risiko?' : 'What is the risk?'))}
                        style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#6ee7b7',
                            padding: '5px 10px',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        🛡️ {isTr ? 'Kasa Riski?' : (isDe ? 'Risiko-Check?' : 'Risk Check?')}
                    </button>
                </div>

                {/* Conversation Body */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            style={{
                                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                            }}
                        >
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                                background: msg.sender === 'user'
                                    ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                                    : 'rgba(30, 41, 59, 0.8)',
                                border: msg.sender === 'user'
                                    ? '1px solid rgba(56, 189, 248, 0.4)'
                                    : '1px solid rgba(255, 255, 255, 0.08)',
                                color: '#f8fafc',
                                fontSize: '0.86rem',
                                lineHeight: '1.45',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {msg.text}
                            </div>
                            <span style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '3px', padding: '0 4px' }}>
                                {msg.timestamp}
                            </span>
                        </div>
                    ))}

                    {isTyping && (
                        <div style={{
                            alignSelf: 'flex-start',
                            padding: '8px 14px',
                            borderRadius: '14px 14px 14px 2px',
                            background: 'rgba(30, 41, 59, 0.6)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            color: '#94a3b8',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}>
                            <span>{isTr ? '🤖 Asistan analiz ediyor' : (isDe ? '🤖 Assistent analysiert...' : '🤖 Copilot analyzing...')}</span>
                            <span className="typing-dot" style={{ animation: 'pulse 1s infinite' }}>...</span>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Bar */}
                <form
                    onSubmit={handleCustomSubmit}
                    style={{
                        padding: '12px 14px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(15, 23, 42, 0.8)',
                        display: 'flex',
                        gap: '8px'
                    }}
                >
                    <input
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        placeholder={isTr ? "Maç hakkında soru sor (örn: 'Kim gol atar?')..." : (isDe ? "Frage zum Spiel stellen (z.B. 'Wer trifft?')..." : "Ask about the match (e.g. 'Who will score?')...")}
                        style={{
                            flex: 1,
                            background: 'rgba(10, 14, 23, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            color: '#f8fafc',
                            fontSize: '0.85rem',
                            outline: 'none'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim()}
                        style={{
                            background: inputText.trim() ? 'linear-gradient(135deg, #38bdf8, #0284c7)' : 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0 16px',
                            color: inputText.trim() ? '#fff' : '#64748b',
                            fontWeight: 700,
                            cursor: inputText.trim() ? 'pointer' : 'default',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {isTr ? 'Sor' : (isDe ? 'Fragen' : 'Ask')}
                    </button>
                </form>
            </div>
        </div>
    );
};
