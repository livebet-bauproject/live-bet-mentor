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
        import glob
        # 1. Fast, zero-subprocess filesystem inspection: Chrome directories are named with version (e.g. 155.0.8059.85)
        candidate_dirs = [
            r'C:\Program Files\Google\Chrome\Application',
            r'C:\Program Files (x86)\Google\Chrome\Application',
            os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Google', 'Chrome', 'Application'),
            os.path.join(os.environ.get('PROGRAMFILES', ''), 'Google', 'Chrome', 'Application'),
            os.path.join(os.environ.get('PROGRAMFILES(X86)', ''), 'Google', 'Chrome', 'Application'),
        ]
        try:
            candidate_dirs.extend(glob.glob(r'C:\Users\*\AppData\Local\Google\Chrome\Application'))
        except Exception:
            pass

        for cdir in candidate_dirs:
            if cdir and os.path.isdir(cdir):
                try:
                    for item in os.listdir(cdir):
                        m = re.match(r'^(\d+)\.\d+\.\d+\.\d+$', item)
                        if m:
                            ver = int(m.group(1))
                            logger.info(f"Detected Chrome v{ver} ({item}) from filesystem: {cdir}")
                            return ver
                except Exception:
                    pass

        # 2. Fast registry check (HKCU and HKLM)
        for reg_key in [
            r'reg query "HKCU\Software\Google\Chrome\BLBeacon" /v version',
            r'reg query "HKLM\Software\Google\Chrome\BLBeacon" /v version',
            r'reg query "HKLM\Software\WOW6432Node\Google\Update\Clients\{8A69D345-D564-463c-AFF1-A69D9E530F96}" /v pv'
        ]:
            try:
                out = subprocess.check_output(reg_key, shell=True, text=True, timeout=3)
                m = re.search(r'(?:version|pv)\s+REG_SZ\s+(\d+)\.', out)
                if m:
                    ver = int(m.group(1))
                    logger.info(f"Detected Chrome v{ver} from registry")
                    return ver
            except Exception:
                pass

        # 3. Fallback to PowerShell
        try:
            cmd = 'powershell -NoProfile -Command "(Get-Item (Get-ItemProperty \'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe\').\'(default)\').VersionInfo.FileVersion"'
            out = subprocess.check_output(cmd, shell=True, text=True, timeout=4).strip()
            m = re.search(r'(\d+)\.', out)
            if m:
                return int(m.group(1))
        except Exception:
            pass
    else:
        for cmd in ['google-chrome --version', 'google-chrome-stable --version', 'chromium --version', 'chromium-browser --version']:
            try:
                out = subprocess.check_output(cmd, shell=True, text=True, timeout=3)
                m = re.search(r'(\d+)\.', out)
                if m:
                    return int(m.group(1))
            except Exception:
                pass

    logger.warning("Could not automatically detect Chrome version, falling back to stable v155")
    return 155

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
        # Clean stale driver binary before patching to prevent Windows WinError 183
        default_uc_path = os.path.join(os.environ.get('APPDATA', ''), 'undetected_chromedriver', 'undetected_chromedriver.exe')
        if os.path.exists(default_uc_path):
            try:
                os.remove(default_uc_path)
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
