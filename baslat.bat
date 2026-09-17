@echo off
REM Live Bet Mentor - Baslatici
cd /d "%~dp0"

echo ==========================================
echo    Live Bet Mentor Baslatiliyor...
echo ==========================================

REM 1. Gereksinim Kontrolu
echo [1/4] Node ve Python kontrol ediliyor...
node -v
python --version

REM 2. Cache ve Surec Temizleme
echo [2/4] Eski cache ve sarkan surecler temizleniyor...
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM chromedriver.exe /T >nul 2>&1
taskkill /F /IM undetected_chromedriver.exe /T >nul 2>&1
if exist "dist" (
    echo [BILGI] dist klasoru siliniyor...
    rmdir /s /q "dist"
)
if exist "node_modules\.vite" (
    echo [BILGI] Vite cache temizleniyor...
    rmdir /s /q "node_modules\.vite"
)

REM 3. Modul Kontrolu
echo [3/4] Bagimliliklar kontrol ediliyor...
if not exist node_modules (
    echo [BILGI] Node modulleri yukleniyor, lutfen bekleyin...
    call npm install
)

python -c "import undetected_chromedriver, selenium, curl_cffi, requests" >nul 2>&1
if errorlevel 1 (
    echo [BILGI] Gerekli Python kutuphaneleri yukleniyor (bu ilk seferde 1-2 dk surebilir)...
    pip install undetected-chromedriver selenium curl_cffi requests python-dotenv
)

REM 4. Sunucuyu Baslat
echo [4/4] Uygulama baslatiliyor...
echo Bu pencereyi kapatmayin.
echo Tarayici 10 saniye icinde otomatik acilacak.

REM Yeni pencerede sunuculari baslat
start "LBM-Sunucu" cmd /k "npm run start"

REM Tarayiciyi acmak icin bekle (Scraper ilk canli veriyi yazana kadar 16 sn bekle)
timeout /t 16

REM Tarayiciyi cache bypass ile ac (Ctrl+Shift+R efekti)
start "" "http://localhost:5173/?v=%random%"

echo.
echo Islem tamam! 
echo [IPUCU] Hala eski goruyorsan tarayicida Ctrl+Shift+R yap.
pause
