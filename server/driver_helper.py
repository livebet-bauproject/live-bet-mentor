import os
import io
import zipfile
import urllib.request
import logging
import undetected_chromedriver as uc

logger = logging.getLogger(__name__)

BIN_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bin')
DRIVER_PATH = os.path.join(BIN_DIR, 'chromedriver.exe')

def get_chromedriver_path():
    """Ensure ChromeDriver 152 is downloaded and patched in server/bin/."""
    os.makedirs(BIN_DIR, exist_ok=True)
    if not os.path.exists(DRIVER_PATH):
        try:
            logger.info("Downloading ChromeDriver 152 for Windows 64-bit...")
            url = 'https://storage.googleapis.com/chrome-for-testing-public/152.0.7977.82/win64/chromedriver-win64.zip'
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as resp:
                with zipfile.ZipFile(io.BytesIO(resp.read())) as z:
                    for f in z.namelist():
                        if f.endswith('chromedriver.exe'):
                            with open(DRIVER_PATH, 'wb') as out:
                                out.write(z.read(f))
                            break
            logger.info(f"Downloaded ChromeDriver 152 to {DRIVER_PATH}")
            patcher = uc.Patcher(executable_path=DRIVER_PATH)
            patcher.patch_exe()
            logger.info("ChromeDriver 152 patched with undetected signatures.")
        except Exception as e:
            logger.error(f"Error preparing ChromeDriver 152: {e}")
    return DRIVER_PATH
