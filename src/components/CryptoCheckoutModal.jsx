import React, { useState, useEffect } from 'react';
import { triggerHaptic } from '../utils/haptics.js';
import { telegramWebApp } from '../utils/telegramWebApp.js';

export const CryptoCheckoutModal = ({ isOpen, onClose, plan = 'PROFESYONEL', days = 30, price = '29', lang = 'tr', onActivated }) => {
    const [selectedAsset, setSelectedAsset] = useState('USDT'); // 'USDT' or 'TON'
    const [isLoading, setIsLoading] = useState(false);
    const [invoiceData, setInvoiceData] = useState(null);
    const [copied, setCopied] = useState(false);
    const [isPaid, setIsPaid] = useState(false);

    const isTr = lang === 'tr';
    const isDe = lang === 'de';

    // TON direct deposit address (for manual or TON Connect transfer)
    const TON_VAULT_ADDRESS = 'EQBvW8Z5huBkMJYdn30dcYnxTSqydVN6UN6UVI2wSXbEbX4Z';
    const USDT_TRC20_ADDRESS = 'TN3JvK2RkH9VbK4eQwX4Z12bM8sL6qRtYv';

    const tgUser = telegramWebApp.getUser();
    const currentUserId = tgUser?.id || (typeof localStorage !== 'undefined' ? localStorage.getItem('user_id') : null) || 'web_user';
    const currentUsername = tgUser?.username || 'User';

    // Create invoice when opened
    useEffect(() => {
        if (!isOpen) {
            setInvoiceData(null);
            setIsPaid(false);
            return;
        }

        const createCryptoInvoice = async () => {
            setIsLoading(true);
            try {
                const res = await fetch('/api/crypto/create-invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        plan,
                        days,
                        amount: price,
                        asset: selectedAsset,
                        userId: currentUserId,
                        username: currentUsername
                    })
                });
                const data = await res.json();
                if (data.success) {
                    setInvoiceData(data);
                }
            } catch (e) {
                console.warn('[CRYPTO_MODAL] Invoice fetch warning:', e.message);
            } finally {
                setIsLoading(false);
            }
        };

        createCryptoInvoice();
    }, [isOpen, selectedAsset, plan, days, price]);

    // Poll invoice status while open
    useEffect(() => {
        if (!isOpen || !invoiceData?.invoiceId || isPaid) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/crypto/status/${invoiceData.invoiceId}`);
                const data = await res.json();
                if (data.isPaid) {
                    setIsPaid(true);
                    triggerHaptic('success');
                    if (typeof onActivated === 'function') {
                        onActivated();
                    }
                }
            } catch (e) {}
        }, 3000);

        return () => clearInterval(interval);
    }, [isOpen, invoiceData?.invoiceId, isPaid]);

    if (!isOpen) return null;

    const copyToClipboard = (text) => {
        if (!text) return;
        navigator.clipboard?.writeText(text);
        setCopied(true);
        triggerHaptic('light');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenTelegramPay = () => {
        triggerHaptic('medium');
        const targetUrl = invoiceData?.miniAppUrl || invoiceData?.payUrl;
        if (targetUrl) {
            telegramWebApp.openLink(targetUrl);
        } else {
            // Fallback TON transfer link
            window.open(`ton://transfer/${TON_VAULT_ADDRESS}?amount=${price}`, '_blank');
        }
    };

    return (
        <div className="crypto-modal-overlay" style={{
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
            <div className="crypto-modal-card" style={{
                background: 'linear-gradient(145deg, #0d1527, #0a0e1a)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 25px rgba(56, 189, 248, 0.15)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '460px',
                padding: '22px',
                color: '#f8fafc'
            }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.4rem' }}>⚡</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                                {isTr ? 'Kripto & Web3 ile 1-Tık Ödeme' : (isDe ? 'Krypto & Web3 1-Klick-Zahlung' : 'Crypto & Web3 1-Click Checkout')}
                            </h3>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {isTr ? '100% Anonim • Sıfır Banka Engeli' : (isDe ? '100% Anonym • Keine Bankblockaden' : '100% Anonymous • Zero Bank Restrictions')}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
                    >
                        ✕
                    </button>
                </div>

                {isPaid ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎉</div>
                        <h4 style={{ fontSize: '1.2rem', color: '#22c55e', margin: '0 0 8px 0' }}>
                            {isTr ? 'Ödeme Onaylandı!' : (isDe ? 'Zahlung bestätigt!' : 'Payment Confirmed!')}
                        </h4>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                            {isTr ? 'VIP üyeliğiniz anında aktifleşti. Keyifli analizler dileriz.' : (isDe ? 'VIP-Zugang sofort freigeschaltet. Viel Erfolg bei den Analysen.' : 'VIP access activated instantly.')}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Plan Summary Banner */}
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.7)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            marginBottom: '16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <strong style={{ color: '#38bdf8', fontSize: '0.95rem' }}>{plan} VIP</strong>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{days} {isTr ? 'Gün Tam Erişim' : (isDe ? 'Tage Vollzugriff' : 'Days Full Access')}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f59e0b' }}>
                                    {price} {selectedAsset}
                                </div>
                            </div>
                        </div>

                        {/* Asset Selector */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <button
                                onClick={() => {
                                    triggerHaptic('light');
                                    setSelectedAsset('USDT');
                                }}
                                style={{
                                    flex: 1,
                                    padding: '9px 0',
                                    borderRadius: '8px',
                                    background: selectedAsset === 'USDT' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    border: selectedAsset === 'USDT' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                                    color: selectedAsset === 'USDT' ? '#38bdf8' : '#94a3b8',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                💵 USDT (TRC20 / TON)
                            </button>
                            <button
                                onClick={() => {
                                    triggerHaptic('light');
                                    setSelectedAsset('TON');
                                }}
                                style={{
                                    flex: 1,
                                    padding: '9px 0',
                                    borderRadius: '8px',
                                    background: selectedAsset === 'TON' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    border: selectedAsset === 'TON' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                                    color: selectedAsset === 'TON' ? '#38bdf8' : '#94a3b8',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                💎 TON (Telegram Wallet)
                            </button>
                        </div>

                        {/* 1-Click Telegram Wallet Action */}
                        <button
                            onClick={handleOpenTelegramPay}
                            style={{
                                width: '100%',
                                padding: '13px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                border: '1px solid rgba(56, 189, 248, 0.5)',
                                color: '#fff',
                                fontWeight: 800,
                                fontSize: '0.92rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                marginBottom: '16px',
                                boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)'
                            }}
                        >
                            <span>✈️</span>
                            <span>{isTr ? 'Telegram / Cüzdan ile 1-Tık Öde' : (isDe ? 'Mit 1-Klick über Telegram / Wallet bezahlen' : 'Pay 1-Click via Telegram / Wallet')}</span>
                        </button>

                        {/* Direct Address Copy */}
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.6)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '8px',
                            padding: '10px 12px',
                            marginBottom: '16px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                    {selectedAsset === 'TON' 
                                        ? (isTr ? 'Doğrudan TON Adresi:' : (isDe ? 'Direkte TON-Adresse:' : 'Direct TON Address:')) 
                                        : (isTr ? 'Doğrudan USDT (TRC20) Adresi:' : (isDe ? 'Direkte USDT (TRC20)-Adresse:' : 'Direct USDT (TRC20) Address:'))}
                                </span>
                                <button
                                    onClick={() => copyToClipboard(selectedAsset === 'TON' ? TON_VAULT_ADDRESS : USDT_TRC20_ADDRESS)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: copied ? '#22c55e' : '#38bdf8',
                                        fontSize: '0.72rem',
                                        cursor: 'pointer',
                                        fontWeight: 700
                                    }}
                                >
                                    {copied 
                                        ? (isTr ? '✓ Kopyalandı' : (isDe ? '✓ Kopiert' : '✓ Copied')) 
                                        : (isTr ? '📋 Kopyala' : (isDe ? '📋 Kopieren' : '📋 Copy'))}
                                </button>
                            </div>
                            <div style={{
                                fontSize: '0.74rem',
                                color: '#cbd5e1',
                                fontFamily: 'monospace',
                                wordBreak: 'break-all',
                                background: 'rgba(10, 14, 23, 0.7)',
                                padding: '6px 8px',
                                borderRadius: '4px'
                            }}>
                                {selectedAsset === 'TON' ? TON_VAULT_ADDRESS : USDT_TRC20_ADDRESS}
                            </div>
                        </div>

                        {/* Live Status Indicator */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            fontSize: '0.78rem',
                            color: '#94a3b8'
                        }}>
                            <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#f59e0b',
                                display: 'inline-block',
                                animation: 'pulse 1.5s infinite'
                            }} />
                            <span>{isTr 
                                ? 'Blockchain işlemi bekleniyor (otomatik onaylanır)...' 
                                : (isDe 
                                    ? 'Warte auf Blockchain-Bestätigung (automatisch)...' 
                                    : 'Awaiting blockchain confirmation...')}</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
