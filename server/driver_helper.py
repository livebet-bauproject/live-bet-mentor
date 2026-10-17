import os
import shutil
import logging
import undetected_chromedriver as uc

logger = logging.getLogger(__name__)

BIN_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bin')
DRIVER_PATH = os.path.join(BIN_DIR, 'chromedriver.exe')

def get_chromedriver_path():
    """Ensure an up-to-date patched ChromeDriver matching the installed Chrome version."""
    os.makedirs(BIN_DIR, exist_ok=True)
    try:
        patcher = uc.Patcher()
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
        logger.warning(f"Auto-patching ChromeDriver warning: {e}")

    if os.path.exists(DRIVER_PATH):
        return DRIVER_PATH
    return "chromedriver"
