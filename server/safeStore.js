/**
 * SAFE STORE v1.0
 * In-memory state store with atomic debounced file persistence.
 * Prevents file-lock concurrency issues (EBUSY / race conditions) on busy live servers.
 */

import fs from 'fs';
import path from 'path';

export class SafeStore {
    /**
     * @param {string} filePath - Absolute path to the backing JSON file
     * @param {number} flushIntervalMs - Sync interval to disk (default: 5000ms)
     */
    constructor(filePath, flushIntervalMs = 5000) {
        this.filePath = filePath;
        this.memoryData = new Map();
        this.isDirty = false;
        this.flushIntervalMs = flushIntervalMs;
        this.flushTimer = null;

        this.init();
        this.startAutoFlush();
    }

    init() {
        try {
            if (fs.existsSync(this.filePath)) {
                const raw = fs.readFileSync(this.filePath, 'utf8');
                if (raw && raw.trim().length > 0) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        this.memoryData = new Map(Object.entries(parsed));
                    }
                }
            }
        } catch (e) {
            console.warn(`[SafeStore] Initial load warning for ${path.basename(this.filePath)}: ${e.message}`);
            this.memoryData = new Map();
        }
    }

    startAutoFlush() {
        if (this.flushTimer) clearInterval(this.flushTimer);
        this.flushTimer = setInterval(() => {
            if (this.isDirty) {
                this.flush();
            }
        }, this.flushIntervalMs);
    }

    get(key) {
        return this.memoryData.get(String(key));
    }

    has(key) {
        return this.memoryData.has(String(key));
    }

    set(key, value) {
        this.memoryData.set(String(key), value);
        this.isDirty = true;
    }

    delete(key) {
        const deleted = this.memoryData.delete(String(key));
        if (deleted) this.isDirty = true;
        return deleted;
    }

    clear() {
        this.memoryData.clear();
        this.isDirty = true;
        this.flush();
    }

    entries() {
        return this.memoryData.entries();
    }

    size() {
        return this.memoryData.size;
    }

    toObject() {
        return Object.fromEntries(this.memoryData);
    }

    flush() {
        if (!this.isDirty) return;
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const tempFile = `${this.filePath}.${Date.now()}.tmp`;
            const payload = JSON.stringify(this.toObject(), null, 2);

            // Atomic file write: write to temp file then rename
            fs.writeFileSync(tempFile, payload, 'utf8');
            fs.renameSync(tempFile, this.filePath);
            this.isDirty = false;
        } catch (e) {
            console.error(`[SafeStore] Flush failed for ${path.basename(this.filePath)}:`, e.message);
        }
    }

    destroy() {
        if (this.flushTimer) clearInterval(this.flushTimer);
        this.flush();
    }
}
