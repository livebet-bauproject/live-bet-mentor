import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[CRITICAL_ERROR_BOUNDARY] Caught React rendering error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%)',
                    color: '#f8fafc',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    padding: '2rem'
                }}>
                    <div style={{
                        maxWidth: '600px',
                        width: '100%',
                        background: 'rgba(30, 41, 59, 0.7)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '20px',
                        padding: '2.5rem',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.1)',
                        backdropFilter: 'blur(16px)',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '16px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem',
                            margin: '0 auto 1.5rem auto',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                        }}>
                            🛡️
                        </div>

                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem', color: '#fff' }}>
                            Arayüz Kurtarma Modu (Safe Mode)
                        </h2>

                        <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                            Gelen canlı maç verisi işlenirken beklenmeyen bir render hatası engellendi. Sayfa kilitlenip siyah ekrana düşmek yerine koruma altına alındı.
                        </p>

                        {this.state.error && (
                            <div style={{
                                background: 'rgba(0, 0, 0, 0.4)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '10px',
                                padding: '1rem',
                                marginBottom: '1.5rem',
                                textAlign: 'left',
                                overflowX: 'auto',
                                fontSize: '0.75rem',
                                color: '#f87171',
                                fontFamily: 'monospace'
                            }}>
                                <strong>Hata:</strong> {this.state.error.toString()}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                onClick={this.handleReset}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '10px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#fff',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                🔄 Durumu Sıfırla
                            </button>
                            <button
                                onClick={this.handleReload}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                                    border: 'none',
                                    color: '#000',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                ⚡ Sayfayı Yenile
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
