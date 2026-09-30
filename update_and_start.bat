@echo off
chcp 65001 >nul
cls
color 0B
title LIVE BET MENTOR - 7/24 Otonom VIP Sistem

echo =====================================================================
echo        💎 LIVE BET MENTOR - OTONOM VIP SISTEM & GUNCELLEYICI 💎
echo =====================================================================
echo.

REM Proje klasorune gec
cd /d "%~dp0"

REM Masaustune otomatik kisayol olustur (Eger yoksa)
if not exist "%USERPROFILE%\Desktop\Sistemi Guncelle ve Baslat.lnk" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Sistemi Guncelle ve Baslat.lnk'); $s.TargetPath = '%~dp0update_and_start.bat'; $s.WorkingDirectory = '%~dp0'; $s.Save()" >nul 2>&1
)

echo [1/3] 📡 GitHub'dan en güncel VIP kodlar çekiliyor...
git fetch origin main >nul 2>&1
git add . >nul 2>&1
git reset --hard origin/main
echo.
echo [2/3] ✅ Sistem en son sürüme başarıyla güncellendi!
echo.
echo [3/3] 🚀 7/24 Otonom Sunucu ve Telegram VIP Motoru Başlatılıyor...
echo =====================================================================
echo.

npm start
pause
