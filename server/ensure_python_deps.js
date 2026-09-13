import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pyCmd = process.platform === 'win32' ? 'python' : 'python3';

function run(cmd) {
    try {
        return execSync(cmd, { stdio: 'pipe' }).toString().trim();
    } catch (e) {
        return null;
    }
}

console.log(`[DEPS] Checking Python environment using: ${pyCmd}`);

// 1. Check if Python is available
const pyVer = run(`${pyCmd} --version`);
if (!pyVer) {
    console.warn(`[DEPS] ⚠️ ${pyCmd} not found. Python dependencies will be skipped.`);
    process.exit(0);
}
console.log(`[DEPS] Python detected: ${pyVer}`);

// 2. Check if curl_cffi is already installed
const checkCurl = run(`${pyCmd} -c "import site, sys; sys.path.insert(0, site.getusersitepackages()); import curl_cffi; print(curl_cffi.__version__)"`);
if (checkCurl) {
    console.log(`[DEPS] ✅ curl_cffi is already installed (version: ${checkCurl})`);
    process.exit(0);
}

console.log('[DEPS] curl_cffi not found. Attempting installation...');

// 3. Try standard pip
let pipInstalled = false;
const pipCommands = [
    `${pyCmd} -m pip install --user curl_cffi requests python-dotenv --break-system-packages`,
    `${pyCmd} -m pip install --user curl_cffi requests python-dotenv`,
    `${pyCmd} -m pip install curl_cffi requests python-dotenv`,
    `pip3 install --user curl_cffi requests python-dotenv`,
    `pip install curl_cffi requests python-dotenv`
];

for (const cmd of pipCommands) {
    try {
        console.log(`[DEPS] Trying: ${cmd}`);
        execSync(cmd, { stdio: 'inherit' });
        pipInstalled = true;
        break;
    } catch (e) {
        console.warn(`[DEPS] Command failed: ${cmd}`);
    }
}

// 4. If pip is missing, bootstrap it via get-pip.py
if (!pipInstalled) {
    console.log('[DEPS] Pip appears to be missing. Bootstrapping via get-pip.py...');
    const getPipPath = path.join(__dirname, 'get-pip.py');
    
    try {
        execSync(`curl -sS https://bootstrap.pypa.io/get-pip.py -o "${getPipPath}"`, { stdio: 'inherit' });
        if (fs.existsSync(getPipPath)) {
            console.log('[DEPS] Running get-pip.py...');
            execSync(`${pyCmd} "${getPipPath}" --user --break-system-packages`, { stdio: 'inherit' });
            fs.unlinkSync(getPipPath);

            console.log('[DEPS] Installing curl_cffi with bootstrapped pip...');
            execSync(`${pyCmd} -m pip install --user curl_cffi requests python-dotenv --break-system-packages`, { stdio: 'inherit' });
            pipInstalled = true;
        }
    } catch (err) {
        console.warn('[DEPS] get-pip bootstrap failed:', err.message);
    }
}

// 5. Final Verification
const verify = run(`${pyCmd} -c "import site, sys; sys.path.insert(0, site.getusersitepackages()); import curl_cffi; print(curl_cffi.__version__)"`);
if (verify) {
    console.log(`[DEPS] 🎉 SUCCESS! curl_cffi is now installed (version: ${verify})`);
} else {
    console.warn('[DEPS] ⚠️ Could not verify curl_cffi. System will fall back to requests/node.');
}
