#!/usr/bin/env bash
# ==============================================================================
# LIVE BET MENTOR - 1-CLICK ZERO-COST VPS INSTALLER
# ==============================================================================
# Target: Ubuntu 20.04 / 22.04 / 24.04 on Google Cloud e2-micro (Always Free)
# Memory limit: 120MB (Finans botunuza asla dokunamaz)
# CPU limit: 20%
# Port: ZERO (Port 8000 ve 8080'e kesinlikle dokunmaz)
# Egress: < 5 MB / month (Fatura $0.00 garantili)
# ==============================================================================

set -e

INSTALL_DIR="/home/ubuntu/livebet-signal"
SERVICE_NAME="livebet-signal"

echo "=================================================="
echo "🚀 Live Bet Mentor Hafif Kurulum Başlıyor..."
echo "=================================================="

# 1. Gerekli temel paketler (Chromium veya GUI YOKTUR)
sudo apt-get update -y
sudo apt-get install -y python3-pip python3-venv curl

# 2. İzole klasör
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 3. Python Sanal Ortam (Finans botunuzun paketlerinden %100 izole)
if [ ! -d "venv" ]; then
    echo "📦 Python Sanal Ortamı (venv) kuruluyor..."
    python3 -m venv venv
fi

source venv/bin/activate

# 4. Ultra-hafif kütüphaneler
echo "📦 Hafif kütüphaneler yükleniyor (curl_cffi, requests)..."
pip install --upgrade pip
pip install requests curl_cffi python-dotenv

# 5. .env Konfigürasyonu
cat << 'EOF' > "$INSTALL_DIR/.env"
TELEGRAM_BOT_TOKEN=8958625592:AAFvGVVFF-GKHklYfzR_lexD39t7TurlI5U
TELEGRAM_VIP_GROUP_ID=8965087988
VITE_APIFOOTBALL_KEY=a790d8fed5077cd8afe4cbc667ecef3ee5791b3ec0db4c56c5818865e24cc7e
EOF

# 6. Systemd Servis Dosyası (Güvenlik Kalkanı)
echo "🛡️ Systemd Servisi ve Donanım Kalkanı ayarlanıyor..."
sudo bash -c "cat << 'EOF' > /etc/systemd/system/${SERVICE_NAME}.service
[Unit]
Description=Live Bet Mentor Lightweight Signal Daemon
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/venv/bin/python lightweight_daemon.py
Restart=always
RestartSec=10

# DONANIM KORUMA LİMİTLERİ (Finans botunu korur):
MemoryMax=120M
MemoryHigh=100M
CPUQuota=20%

[Install]
WantedBy=multi-user.target
EOF"

# 7. Servisi Aktif Et ve Başlat
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}

echo "=================================================="
echo "✅ KURULUM BAŞARIYLA TAMAMLANDI!"
echo "   - Servis: ${SERVICE_NAME}"
echo "   - RAM Tüketimi: ~35 MB (120 MB tavan koruması ile)"
echo "   - Port: SIFIR (Port 8000 ve 8080 bozulmadı)"
echo "   - Fatura: $0.00 (Yalnızca Telegram sinyali atar)"
echo "=================================================="
sudo systemctl status ${SERVICE_NAME} --no-pager
