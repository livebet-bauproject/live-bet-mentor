@echo off
REM Live Bet Mentor - 7/24 Otonom Baslatici
title Live Bet Mentor - 7/24 Veri ve Tunel Konsolu
cd /d "%~dp0"

echo ============================================================
echo    Live Bet Mentor - 7/24 Otonom Sistem Baslatiliyor...
echo ============================================================

REM 1. Gereksinim Kontrolu
echo [1/4] Node.js ve Python kontrol ediliyor...
node -v >nul 2>&1
if errorlevel 1 (
    echo [HATA] Node.js bulunamadi! Lutfen https://nodejs.org adresinden yukleyin.
    pause
    exit /b 1
)

python --version >nul 2>&1
if errorlevel 1 (
    echo [HATA] Python bulunamadi! Lutfen https://python.org adresinden yukleyin.
    pause
    exit /b 1
)

REM 2. Eski Surecleri Temizle
echo [2/4] Eski cache ve sarkan surecler temizleniyor...
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM chromedriver.exe /T >nul 2>&1
taskkill /F /IM undetected_chromedriver.exe /T >nul 2>&1
taskkill /F /IM cloudflared.exe /T >nul 2>&1

if exist "node_modules\.vite" (
    rmdir /s /q "node_modules\.vite" >nul 2>&1
)

REM 3. Modul ve Paket Kontrolu
echo [3/4] Bagimliliklar kontrol ediliyor...
if not exist node_modules (
    echo [BILGI] Node modulleri yukleniyor, lutfen bekleyin...
    call npm install
)

python -c "import undetected_chromedriver, selenium, curl_cffi, requests" >nul 2>&1
if errorlevel 1 (
    echo [BILGI] Gerekli Python kutuphaneleri yukleniyor - ilk seferde 1-2 dk surebilir...
    pip install undetected-chromedriver selenium curl_cffi requests python-dotenv
)

if not exist "server\bin\cloudflared.exe" (
    echo [BILGI] 7/24 Guvenli Tunnel modulu indiriliyor...
    if not exist "server\bin" mkdir "server\bin"
    curl.exe -L -o "server\bin\cloudflared.exe" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
)

REM 4. Otomatik Tarayici Tetikleyici (12 sn sonra tarayiciyi acar)
start /b cmd /c "timeout /t 12 >nul && start http://localhost:5173/?v=%random%"

REM 5. Sunucuyu ve Tüneli Doğrudan Bu Pencerede Çalıştır
echo [4/4] Sistem baslatiliyor...
echo.
echo ============================================================
echo   LIVE BET MENTOR 7/24 AKTIF!
echo   - Bu siyah pencereyi ASLA KAPATMAYIN!
echo   - Veriler ve Cloudflare Tunel adresi asagida gorunecektir.
echo ============================================================
echo.

call npm run start

echo.
echo [UYARI] Sistem durduruldu. Yeniden baslatmak icin bir tusa basin...
pause
