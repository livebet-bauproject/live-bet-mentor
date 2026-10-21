import os
import shutil
import logging
import subprocess
import re
import platform
import undetected_chromedriver as uc

logger = logging.getLogger(__name__)

BIN_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bin')
is_win = platform.system().lower().startswith('win')
DRIVER_PATH = os.path.join(BIN_DIR, 'chromedriver.exe' if is_win else 'chromedriver')

def get_installed_chrome_version():
    """Detects the major version of the installed Google Chrome browser (e.g. 155)."""
    if is_win:
        try:
            out = subprocess.check_output(r'reg query "HKEY_CURRENT_USER\Software\Google\Chrome\BLBeacon" /v version', shell=True, text=True, timeout=3)
            m = re.search(r'version\s+REG_SZ\s+(\d+)\.', out)
            if m:
                return int(m.group(1))
        except Exception:
            pass
        try:
            cmd = 'powershell -NoProfile -Command "(Get-Item (Get-ItemProperty \'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe\').\'(default)\').VersionInfo.FileVersion"'
            out = subprocess.check_output(cmd, shell=True, text=True, timeout=4).strip()
            m = re.search(r'(\d+)\.', out)
            if m:
                return int(m.group(1))
        except Exception:
            pass

    for cmd in ['google-chrome --version', 'google-chrome-stable --version', 'chromium --version', 'chromium-browser --version']:
        try:
            out = subprocess.check_output(cmd, shell=True, text=True, timeout=3)
            m = re.search(r'(\d+)\.', out)
            if m:
                return int(m.group(1))
        except Exception:
            pass
    return None

def purge_cached_chromedriver():
    """Purge cached binary to force a clean re-download on version mismatch."""
    try:
        if os.path.exists(DRIVER_PATH):
            os.remove(DRIVER_PATH)
            logger.info(f"Purged cached driver at {DRIVER_PATH}")
    except Exception as e:
        logger.debug(f"Could not purge {DRIVER_PATH}: {e}")

def get_chromedriver_path():
    """Ensure an up-to-date patched ChromeDriver matching the installed Chrome version."""
    os.makedirs(BIN_DIR, exist_ok=True)
    major_ver = get_installed_chrome_version()
    
    # 1. Kill any zombie drivers locking the binary
    if is_win:
        try:
            subprocess.run(["taskkill", "/F", "/IM", "chromedriver.exe", "/T"], capture_output=True, timeout=3)
            subprocess.run(["taskkill", "/F", "/IM", "undetected_chromedriver.exe", "/T"], capture_output=True, timeout=3)
        except Exception:
            pass

    try:
        patcher = uc.Patcher(version_main=major_ver, force=True) if major_ver else uc.Patcher(force=True)
        patcher.auto()
        detected_path = patcher.executable_path
        if detected_path and os.path.exists(detected_path):
            try:
                shutil.copy2(detected_path, DRIVER_PATH)
                logger.info(f"ChromeDriver synchronized to {DRIVER_PATH} (Chrome v{patcher.version_main})")
                return DRIVER_PATH
            except Exception as ce:
                logger.debug(f"Could not copy to bin dir: {ce}")
                return detected_path
    except Exception as e:
        logger.warning(f"Auto-patching ChromeDriver warning (falling back to cached binary): {e}")

    if os.path.exists(DRIVER_PATH):
        return DRIVER_PATH
    return "chromedriver"
