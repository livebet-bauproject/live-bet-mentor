/**
 * MATCH TELEMETRY RECORDER & HISTORICAL ARCHIVE ENGINE
 * 
 * 1. Collects minute-by-minute in-play telemetry (snapshots) for all live matches.
 * 2. Persists rolling telemetry on disk (survives proxy restarts, tab reloads, and network drops).
 * 3. Enriches live match feeds with ready-to-use minuteHistory for zero-latency client bootstrap.
 * 4. Automatically archives concluded matches (full timeseries + final stats) for ML training & data monetization.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { learningEngine } from './learningEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TELEMETRY_DIR = path.join(__dirname, 'telemetry');
const ARCHIVE_DIR = path.join(__dirname, 'matches_archive');
const ARCHIVE_INDEX_FILE = path.join(ARCHIVE_DIR, 'archive_index.json');

// Ensure necessary directories exist
if (!fs.existsSync(TELEMETRY_DIR)) {
    try { fs.mkdirSync(TELEMETRY_DIR, { recursive: true }); } catch (e) {}
}
if (!fs.existsSync(ARCHIVE_DIR)) {
    try { fs.mkdirSync(ARCHIVE_DIR, { recursive: true }); } catch (e) {}
}

class MatchTelemetryRecorder {
    constructor() {
        // matchId -> array of snapshots [newest, ..., oldest]
        this.activeTelemetry = new Map();
        // matchId -> last recorded timestamp (ms)
        this.lastSampleTime = new Map();
        // matchId -> last known state / minute
        this.lastRecordedMinute = new Map();
        
        // In-memory archive index
        this.archiveIndex = [];
        this.totalSnapshotsRecorded = 0;
        
        this.init();
    }

    init() {
        this.loadActiveTelemetryFromDisk();
        this.loadArchiveIndexFromDisk();
        console.log(`[TELEMETRY] Initialized with ${this.activeTelemetry.size} active matches, ${this.archiveIndex.length} archived matches.`);
        
        // Auto-flush active telemetry to disk every 30s
        setInterval(() => this.flushDirtyToDisk(), 30000);
        // Auto-prune finished matches every 2 minutes
        setInterval(() => this.pruneAndArchive(), 120000);
    }

    loadActiveTelemetryFromDisk() {
        try {
            if (!fs.existsSync(TELEMETRY_DIR)) return;
            const files = fs.readdirSync(TELEMETRY_DIR);
            const now = Date.now();
            let loaded = 0;

            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                const matchId = file.replace('.json', '');
                try {
                    const filePath = path.join(TELEMETRY_DIR, file);
                    const raw = fs.readFileSync(filePath, 'utf8');
                    const data = JSON.parse(raw);
                    
                    if (Array.isArray(data?.history) && data.history.length > 0) {
                        const lastSnap = data.history[0];
                        // If match is older than 4 hours, archive or purge it
                        if (now - (lastSnap.timestamp || 0) < 4 * 3600 * 1000) {
                            this.activeTelemetry.set(matchId, data.history);
                            this.lastSampleTime.set(matchId, lastSnap.timestamp || now);
                            this.lastRecordedMinute.set(matchId, lastSnap.minute || 0);
                            loaded++;
                        } else {
                            // Archive stale match if valid
                            this.archiveDirect(matchId, data);
                            try { fs.unlinkSync(filePath); } catch (e) {}
                        }
                    }
                } catch (err) {}
            }
            if (loaded > 0) {
                console.log(`[TELEMETRY] Restored ${loaded} active match telemetry logs from disk.`);
            }
        } catch (e) {
            console.warn('[TELEMETRY] Error loading active telemetry:', e.message);
        }
    }

    loadArchiveIndexFromDisk() {
        try {
            if (fs.existsSync(ARCHIVE_INDEX_FILE)) {
                const raw = fs.readFileSync(ARCHIVE_INDEX_FILE, 'utf8');
                const list = JSON.parse(raw);
                if (Array.isArray(list)) {
                    this.archiveIndex = list;
                }
            }
        } catch (e) {
            this.archiveIndex = [];
        }
    }

    saveArchiveIndex() {
        try {
            fs.writeFileSync(ARCHIVE_INDEX_FILE, JSON.stringify(this.archiveIndex, null, 2), 'utf8');
        } catch (e) {
            console.error('[TELEMETRY] Error saving archive index:', e.message);
        }
    }

    /**
     * Ingest and record a snapshot for a match.
     * Guaranteed to keep history sorted from NEWEST (index 0) to OLDEST.
     */
    recordSnapshot(matchId, snapshot) {
        if (!matchId || !snapshot) return;
        const idStr = String(matchId);
        const now = Date.now();

        let history = this.activeTelemetry.get(idStr);
        if (!history) {
            history = [];
            this.activeTelemetry.set(idStr, history);
        }

        const lastTime = this.lastSampleTime.get(idStr) || 0;
        const lastMin = this.lastRecordedMinute.get(idStr);
        const currentMin = snapshot.minute;

        // Sampling throttle: record if 40 seconds passed OR match minute changed
        const timeDiff = now - lastTime;
        const minuteChanged = currentMin !== undefined && currentMin !== null && currentMin !== lastMin;

        if (timeDiff >= 40000 || minuteChanged || history.length === 0) {
            const cleanSnap = {
                timestamp: now,
                minute: currentMin || 0,
                score: snapshot.score || { home: 0, away: 0 },
                stats: snapshot.stats || {},
                dqs: snapshot.dqs || 1.0,
                pressure: snapshot.pressure || 50
            };

            // Unshift to keep newest at [0]
            history.unshift(cleanSnap);
            this.totalSnapshotsRecorded++;

            // Cap at 90 minutes of active history
            if (history.length > 90) {
                history.pop();
            }

            this.lastSampleTime.set(idStr, now);
            this.lastRecordedMinute.set(idStr, currentMin);
            this._dirty = true;
        }
    }

    /**
     * Process an array of live events (e.g. from sofascore_live.json or proxy feed)
     */
    recordFromLiveEvents(events = []) {
        if (!Array.isArray(events) || events.length === 0) return;
        
        for (const ev of events) {
            if (!ev || !ev.id) continue;

            const st = (ev.status?.type || '').toLowerCase();
            const desc = (ev.status?.description || '').toLowerCase();
            const isFinished = st === 'finished' || ev.status?.code === 100 || desc.includes('ended') || desc.includes('ft') || desc.includes('bitti');

            // If match is finished, trigger archiving
            if (isFinished) {
                this.archiveMatch(ev.id, ev);
                continue;
            }

            // Extract stats
            const stats = ev.stats || {};
            const minute = typeof ev.minute === 'number' ? ev.minute : parseInt(String(ev.minute || '').replace(/[^0-9]/g, ''), 10) || 0;
            
            let score = { home: 0, away: 0 };
            if (ev.homeScore !== undefined || ev.awayScore !== undefined) {
                score.home = Number(ev.homeScore?.current ?? ev.homeScore ?? 0) || 0;
                score.away = Number(ev.awayScore?.current ?? ev.awayScore ?? 0) || 0;
            } else if (ev.score && typeof ev.score === 'object') {
                score.home = Number(ev.score.home ?? 0) || 0;
                score.away = Number(ev.score.away ?? 0) || 0;
            }

            this.recordSnapshot(ev.id, {
                minute,
                score,
                stats,
                dqs: ev.dqs || 1.0,
                pressure: ev.observations?.pressure?.total || ev.pressureIndex || 50
            });
        }
    }

    /**
     * Returns minuteHistory for a match (ready for frontend bootstrap)
     */
    getTelemetry(matchId, maxSnapshots = 60) {
        if (!matchId) return [];
        const history = this.activeTelemetry.get(String(matchId));
        if (!history || !Array.isArray(history)) return [];
        return history.slice(0, maxSnapshots);
    }

    /**
     * Flushes dirty active telemetry files to disk
     */
    flushDirtyToDisk() {
        if (this.activeTelemetry.size === 0) return;
        
        for (const [matchId, history] of this.activeTelemetry.entries()) {
            if (!history || history.length === 0) continue;
            try {
                const filePath = path.join(TELEMETRY_DIR, `${matchId}.json`);
                const payload = {
                    matchId,
                    lastUpdated: Date.now(),
                    snapshotsCount: history.length,
                    history
                };
                fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
            } catch (e) {}
        }
    }

    /**
     * Finalizes and permanently archives a completed match
     */
    archiveMatch(matchId, finalEventData = null) {
        const idStr = String(matchId);
        const history = this.activeTelemetry.get(idStr);
        
        // If already archived or no meaningful data, skip
        if (this.archiveIndex.some(a => String(a.id) === idStr)) {
            // Clean active telemetry
            this.activeTelemetry.delete(idStr);
            try { fs.unlinkSync(path.join(TELEMETRY_DIR, `${idStr}.json`)); } catch(e) {}
            return;
        }

        const homeName = finalEventData?.homeTeam?.name || finalEventData?.homeTeam || 'Home';
        const awayName = finalEventData?.awayTeam?.name || finalEventData?.awayTeam || 'Away';
        const league = finalEventData?.tournament?.name || finalEventData?.league || 'Unknown';
        
        const archiveRecord = {
            id: idStr,
            archivedAt: new Date().toISOString(),
            homeTeam: homeName,
            awayTeam: awayName,
            league,
            finalScore: finalEventData?.score || {
                home: finalEventData?.homeScore?.current ?? 0,
                away: finalEventData?.awayScore?.current ?? 0
            },
            totalStats: finalEventData?.stats || {},
            snapshotsCount: history ? history.length : 0,
            hasTimeseries: Boolean(history && history.length >= 3)
        };

        try {
            // Write full archive file including minute-by-minute timeseries
            const fullArchiveFile = path.join(ARCHIVE_DIR, `${idStr}.json`);
            const fullPayload = {
                ...archiveRecord,
                timeseries: history || []
            };
            fs.writeFileSync(fullArchiveFile, JSON.stringify(fullPayload, null, 2), 'utf8');

            // Prepend to index (keep last 500 in quick index)
            this.archiveIndex.unshift(archiveRecord);
            if (this.archiveIndex.length > 500) {
                this.archiveIndex.pop();
            }
            this.saveArchiveIndex();

            // Train LearningEngine autonomously on concluded match
            try {
                learningEngine.recordArchivedMatchTelemetry(archiveRecord, history || []);
            } catch (leErr) {
                console.warn('[ARCHIVE] Error training learning engine:', leErr.message);
            }

            console.log(`[ARCHIVE] 🏛️ Match Archived: ${homeName} vs ${awayName} (${league}) with ${archiveRecord.snapshotsCount} telemetry snapshots.`);
        } catch (e) {
            console.error(`[ARCHIVE] Failed to archive match ${idStr}:`, e.message);
        }

        // Clean up from active tracking
        this.activeTelemetry.delete(idStr);
        this.lastSampleTime.delete(idStr);
        this.lastRecordedMinute.delete(idStr);
        try { fs.unlinkSync(path.join(TELEMETRY_DIR, `${idStr}.json`)); } catch (e) {}
    }

    archiveDirect(matchId, data) {
        if (!matchId || !data) return;
        const idStr = String(matchId);
        if (this.archiveIndex.some(a => String(a.id) === idStr)) return;

        const archiveRecord = {
            id: idStr,
            archivedAt: new Date().toISOString(),
            snapshotsCount: Array.isArray(data.history) ? data.history.length : 0,
            hasTimeseries: true
        };
        try {
            fs.writeFileSync(path.join(ARCHIVE_DIR, `${idStr}.json`), JSON.stringify(data, null, 2), 'utf8');
            this.archiveIndex.unshift(archiveRecord);
            this.saveArchiveIndex();
        } catch(e) {}
    }

    pruneAndArchive() {
        const now = Date.now();
        // Remove matches with no updates for over 2.5 hours
        for (const [matchId, lastTime] of this.lastSampleTime.entries()) {
            if (now - lastTime > 2.5 * 3600 * 1000) {
                this.archiveMatch(matchId, { id: matchId });
            }
        }
    }

    getArchiveList(limit = 100, offset = 0) {
        return this.archiveIndex.slice(offset, offset + limit);
    }

    getArchivedMatch(matchId) {
        if (!matchId) return null;
        const file = path.join(ARCHIVE_DIR, `${matchId}.json`);
        if (fs.existsSync(file)) {
            try {
                return JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch(e) {}
        }
        return null;
    }

    getStats() {
        return {
            activeTrackedMatches: this.activeTelemetry.size,
            archivedMatchesCount: this.archiveIndex.length,
            totalSnapshotsRecorded: this.totalSnapshotsRecorded
        };
    }
}

export const matchTelemetryRecorder = new MatchTelemetryRecorder();
