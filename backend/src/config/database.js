const bcrypt = require('bcryptjs');
const path = require('path');

let db = null;
let isNative = false;

try {
  const Database = require('better-sqlite3');
  const dbPath = path.resolve(__dirname, '../../database.sqlite');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  isNative = true;
} catch (err) {
  console.warn('[DB] Native better-sqlite3 module unavailable or cross-platform mismatch. Using resilient in-memory store adapter:', err.message);
}

const fs = require('fs');
const STORE_PATH = path.resolve(__dirname, 'database_store.json');

const loadMemoryStore = () => {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const loaded = JSON.parse(raw);
      return {
        users: loaded.users || [],
        refresh_tokens: loaded.refresh_tokens || [],
        traffic_configurations: loaded.traffic_configurations || [],
        simulations: loaded.simulations || [],
        telemetry: loaded.telemetry || [],
        recommendations: loaded.recommendations || [],
        comparison_history: loaded.comparison_history || [],
      };
    }
  } catch (err) {
    console.error('Failed to load database backup:', err.message);
  }
  return {
    users: [
      {
        id: 'usr-master-001',
        email: 'master@airatelimit.com',
        password_hash: bcrypt.hashSync('MasterAdmin@2026!', 10),
        full_name: 'Master Administrator',
        role: 'System Architect',
        created_at: new Date().toISOString(),
      },
    ],
    refresh_tokens: [],
    traffic_configurations: [],
    simulations: [],
    telemetry: [],
    recommendations: [],
    comparison_history: [],
  };
};

function saveMemoryStore() {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(inMemoryStore, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist database changes:', err.message);
  }
}

const inMemoryStore = loadMemoryStore();

// Auto-clean stale running simulations on startup in fallback mode
if (inMemoryStore && inMemoryStore.simulations) {
  let cleaned = false;
  inMemoryStore.simulations.forEach(s => {
    if (s.status === 'RUNNING') {
      s.status = 'COMPLETED';
      s.stopped_at = new Date().toISOString();
      cleaned = true;
    }
  });
  if (cleaned) {
    saveMemoryStore();
  }
}

// Execute Automatic SQL DDL Table Migrations
function initDatabase() {
  if (isNative && db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Engineer',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS traffic_configurations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        target_url TEXT NOT NULL,
        http_method TEXT NOT NULL,
        requests_per_second INTEGER NOT NULL,
        concurrent_users INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        traffic_pattern TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS simulations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        test_type TEXT NOT NULL,
        target_url TEXT NOT NULL,
        http_method TEXT NOT NULL,
        requests_per_second INTEGER NOT NULL,
        concurrent_users INTEGER NOT NULL,
        duration_seconds INTEGER NOT NULL,
        traffic_pattern TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        stopped_at TEXT
      );

      CREATE TABLE IF NOT EXISTS telemetry (
        id TEXT PRIMARY KEY,
        simulation_id TEXT,
        timestamp TEXT NOT NULL,
        latency_ms REAL NOT NULL,
        p95_latency_ms REAL NOT NULL,
        p99_latency_ms REAL NOT NULL,
        throughput_rps REAL NOT NULL,
        cpu_usage_percent REAL NOT NULL,
        memory_usage_percent REAL NOT NULL,
        heap_used_mb REAL NOT NULL,
        heap_total_mb REAL NOT NULL,
        rss_mb REAL NOT NULL,
        error_rate_percent REAL NOT NULL,
        success_requests INTEGER NOT NULL,
        failed_requests INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recommendations (
        id TEXT PRIMARY KEY,
        simulation_id TEXT,
        target_url TEXT NOT NULL,
        recommended_rate_limit_rps INTEGER NOT NULL,
        confidence_score REAL NOT NULL,
        reason TEXT NOT NULL,
        model_version TEXT NOT NULL,
        applied INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        verification_status TEXT NOT NULL DEFAULT 'PENDING',
        secondary_rps INTEGER,
        secondary_reason TEXT,
        secondary_model_version TEXT,
        agreement_percent REAL,
        verified_by TEXT,
        verified_at TEXT
      );

      CREATE TABLE IF NOT EXISTS comparison_history (
        id TEXT PRIMARY KEY,
        policy TEXT NOT NULL,
        before_limit TEXT NOT NULL,
        after_limit TEXT NOT NULL,
        latency_reduction TEXT NOT NULL,
        error_reduction TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Run schema migrations for recommendations table to add new columns to existing databases
    const columns = [
      { name: 'verification_status', type: "TEXT NOT NULL DEFAULT 'PENDING'" },
      { name: 'secondary_rps', type: 'INTEGER' },
      { name: 'secondary_reason', type: 'TEXT' },
      { name: 'secondary_model_version', type: 'TEXT' },
      { name: 'agreement_percent', type: 'REAL' },
      { name: 'verified_by', type: 'TEXT' },
      { name: 'verified_at', type: 'TEXT' }
    ];

    for (const col of columns) {
      try {
        db.exec(`ALTER TABLE recommendations ADD COLUMN ${col.name} ${col.type}`);
      } catch (err) {
        // Suppress errors (e.g. duplicate column name)
      }
    }

    try {
      db.exec(`ALTER TABLE simulations ADD COLUMN active_defender INTEGER DEFAULT 0`);
      db.exec(`ALTER TABLE simulations ADD COLUMN is_throttled INTEGER DEFAULT 0`);
    } catch (err) {
      // Suppress duplicate column errors
    }

    // Ensure Master Administrator exists with matching password MasterAdmin@2026!
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('MasterAdmin@2026!', salt);

    const existingMaster = db.prepare('SELECT * FROM users WHERE email = ?').get('master@airatelimit.com');
    if (!existingMaster) {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'usr-master-001',
        'master@airatelimit.com',
        hash,
        'Master Administrator',
        'System Architect',
        new Date().toISOString()
      );
    } else {
      db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, 'master@airatelimit.com');
    }

    // Auto-clean stale running simulations on startup
    db.prepare("UPDATE simulations SET status = 'COMPLETED' WHERE status = 'RUNNING'").run();
  }
}

initDatabase();

module.exports = {
  db,
  all: (sql, params = []) => {
    if (isNative && db) {
      return db.prepare(sql).all(params);
    }
    // Fallback query matching
    const sqlUpper = sql.toUpperCase();
    if (sqlUpper.includes('FROM USERS')) return inMemoryStore.users;
    if (sqlUpper.includes('FROM SIMULATIONS')) {
      return inMemoryStore.simulations.map(s => {
        const tel = inMemoryStore.telemetry.find(t => t.simulation_id === s.id) || {};
        return {
          id: s.id,
          name: s.name,
          testType: s.test_type,
          targetUrl: s.target_url,
          httpMethod: s.http_method,
          concurrentUsers: s.concurrent_users,
          requestsPerSecond: s.requests_per_second,
          durationSeconds: s.duration_seconds,
          trafficPattern: s.traffic_pattern,
          status: s.status,
          createdAt: s.created_at,
          stoppedAt: s.stopped_at,
          activeDefender: s.active_defender === 1 || s.active_defender === true,
          isThrottled: s.is_throttled === 1 || s.is_throttled === true,
          avgLatencyMs: tel.latency_ms !== undefined ? tel.latency_ms : null,
          p95LatencyMs: tel.p95_latency_ms !== undefined ? tel.p95_latency_ms : null,
          p99LatencyMs: tel.p99_latency_ms !== undefined ? tel.p99_latency_ms : null,
          successRequests: tel.success_requests !== undefined ? tel.success_requests : null,
          failedRequests: tel.failed_requests !== undefined ? tel.failed_requests : null,
          errorRatePercent: tel.error_rate_percent !== undefined ? tel.error_rate_percent : null,
        };
      });
    }
    if (sqlUpper.includes('FROM TRAFFIC_CONFIGURATIONS')) return inMemoryStore.traffic_configurations;
    if (sqlUpper.includes('FROM RECOMMENDATIONS')) {
      return inMemoryStore.recommendations.map(r => ({
        ...r,
        simulationId: r.simulation_id,
        targetUrl: r.target_url,
        recommendedRateLimitRps: r.recommended_rate_limit_rps,
        confidenceScore: r.confidence_score,
        modelVersion: r.model_version,
        createdAt: r.created_at,
        verificationStatus: r.verification_status || 'PENDING',
        secondaryRps: r.secondary_rps !== undefined ? r.secondary_rps : null,
        secondaryReason: r.secondary_reason !== undefined ? r.secondary_reason : null,
        secondaryModelVersion: r.secondary_model_version !== undefined ? r.secondary_model_version : null,
        agreementPercent: r.agreement_percent !== undefined ? r.agreement_percent : null,
        verifiedBy: r.verified_by !== undefined ? r.verified_by : null,
        verifiedAt: r.verified_at !== undefined ? r.verified_at : null,
      }));
    }
    if (sqlUpper.includes('FROM COMPARISON_HISTORY')) return inMemoryStore.comparison_history;
    if (sqlUpper.includes('FROM TELEMETRY')) return inMemoryStore.telemetry;
    return [];
  },
  get: (sql, params = []) => {
    if (isNative && db) {
      return db.prepare(sql).get(params);
    }
    const sqlUpper = sql.toUpperCase();
    if (sqlUpper.includes('COUNT(*)')) {
      if (sqlUpper.includes('FROM SIMULATIONS')) return { count: inMemoryStore.simulations.length };
      if (sqlUpper.includes('FROM USERS')) return { count: inMemoryStore.users.length };
    }
    if (sqlUpper.includes('FROM USERS')) {
      let found = null;
      if (params[0]) {
        found = inMemoryStore.users.find(
          u => u.email.toLowerCase() === String(params[0]).toLowerCase() || u.id === params[0]
        );
      } else {
        found = inMemoryStore.users[0];
      }
      if (!found) return null;
      return {
        id: found.id,
        email: found.email,
        password_hash: found.password_hash,
        fullName: found.full_name,
        full_name: found.full_name,
        role: found.role,
        createdAt: found.created_at,
        created_at: found.created_at,
      };
    }
    if (sqlUpper.includes('FROM RECOMMENDATIONS')) {
      const id = params[0];
      const rec = id ? inMemoryStore.recommendations.find(r => r.id === id) : inMemoryStore.recommendations[0];
      if (!rec) return null;
      return {
        ...rec,
        simulationId: rec.simulation_id,
        targetUrl: rec.target_url,
        recommendedRateLimitRps: rec.recommended_rate_limit_rps,
        confidenceScore: rec.confidence_score,
        modelVersion: rec.model_version,
        createdAt: rec.created_at,
        verificationStatus: rec.verification_status || 'PENDING',
        secondaryRps: rec.secondary_rps !== undefined ? rec.secondary_rps : null,
        secondaryReason: rec.secondary_reason !== undefined ? rec.secondary_reason : null,
        secondaryModelVersion: rec.secondary_model_version !== undefined ? rec.secondary_model_version : null,
        agreementPercent: rec.agreement_percent !== undefined ? rec.agreement_percent : null,
        verifiedBy: rec.verified_by !== undefined ? rec.verified_by : null,
        verifiedAt: rec.verified_at !== undefined ? rec.verified_at : null,
      };
    }
    if (sqlUpper.includes('FROM TELEMETRY')) return inMemoryStore.telemetry[0] || null;
    if (sqlUpper.includes('FROM SIMULATIONS')) {
      const found = inMemoryStore.simulations.find(s => s.id === params[0]);
      if (!found) return null;
      return {
        ...found,
        testType: found.test_type,
        targetUrl: found.target_url,
        httpMethod: found.http_method,
        concurrentUsers: found.concurrent_users,
        requestsPerSecond: found.requests_per_second,
        durationSeconds: found.duration_seconds,
        trafficPattern: found.traffic_pattern,
        createdAt: found.created_at,
        stoppedAt: found.stopped_at,
        activeDefender: found.active_defender === 1 || found.active_defender === true,
        isThrottled: found.is_throttled === 1 || found.is_throttled === true,
      };
    }
    return null;
  },
  run: (sql, params = []) => {
    if (isNative && db) {
      return db.prepare(sql).run(params);
    }
    const sqlUpper = sql.toUpperCase();
    if (sqlUpper.includes('INSERT INTO USERS') || sqlUpper.includes('INSERT OR REPLACE INTO USERS')) {
      const existingIdx = inMemoryStore.users.findIndex(u => u.id === params[0] || u.email === params[1]);
      const userObj = { id: params[0], email: params[1], password_hash: params[2], full_name: params[3], role: params[4], created_at: params[5] };
      if (existingIdx >= 0) {
        inMemoryStore.users[existingIdx] = userObj;
      } else {
        inMemoryStore.users.push(userObj);
      }
    } else if (sqlUpper.includes('INSERT INTO SIMULATIONS')) {
      inMemoryStore.simulations.unshift({
        id: params[0],
        user_id: params[1],
        name: params[2],
        test_type: params[3],
        target_url: params[4],
        http_method: params[5],
        concurrent_users: params[6],
        requests_per_second: params[7],
        duration_seconds: params[8],
        traffic_pattern: params[9],
        status: params[10],
        created_at: params[11],
        active_defender: params[12] !== undefined ? params[12] : 0,
        is_throttled: params[13] !== undefined ? params[13] : 0,
      });
    } else if (sqlUpper.includes('INSERT INTO RECOMMENDATIONS')) {
      inMemoryStore.recommendations.unshift({
        id: params[0],
        simulation_id: params[1],
        target_url: params[2],
        recommended_rate_limit_rps: params[3],
        confidence_score: params[4],
        reason: params[5],
        model_version: params[6],
        applied: params[7] !== undefined ? params[7] : 0,
        created_at: params[8],
        verification_status: 'PENDING',
        secondary_rps: null,
        secondary_reason: null,
        secondary_model_version: null,
        agreement_percent: null,
        verified_by: null,
        verified_at: null,
      });
    } else if (sqlUpper.includes('UPDATE RECOMMENDATIONS')) {
      if (sqlUpper.includes('SET APPLIED =')) {
        const val = sqlUpper.includes('APPLIED = 1') ? 1 : params[0];
        const id = sqlUpper.includes('APPLIED = 1') ? params[0] : params[1];
        const rec = inMemoryStore.recommendations.find(r => r.id === id);
        if (rec) rec.applied = val;
      } else {
        const id = params[params.length - 1];
        const rec = inMemoryStore.recommendations.find(r => r.id === id);
        if (rec) {
          if (sqlUpper.includes('SECONDARY_RPS')) {
            rec.verification_status = params[0];
            rec.secondary_rps = params[1];
            rec.secondary_reason = params[2];
            rec.secondary_model_version = params[3];
            rec.agreement_percent = params[4];
            rec.verified_by = params[5];
            rec.verified_at = params[6];
          } else if (sqlUpper.includes('VERIFIED_BY')) {
            rec.verification_status = params[0];
            rec.verified_by = params[1];
            rec.verified_at = params[2];
          }
        }
      }
    } else if (sqlUpper.includes('INSERT INTO TELEMETRY')) {
      inMemoryStore.telemetry.unshift({ id: params[0], simulation_id: params[1], timestamp: params[2], latency_ms: params[3], p95_latency_ms: params[4], p99_latency_ms: params[5], throughput_rps: params[6], cpu_usage_percent: params[7], memory_usage_percent: params[8], heap_used_mb: params[9], heap_total_mb: params[10], rss_mb: params[11], error_rate_percent: params[12], success_requests: params[13], failed_requests: params[14] });
    } else if (sqlUpper.includes('DELETE FROM RECOMMENDATIONS')) {
      if (params[0]) {
        inMemoryStore.recommendations = inMemoryStore.recommendations.filter(r => r.id !== params[0]);
      } else {
        inMemoryStore.recommendations = [];
      }
    } else if (sqlUpper.includes('DELETE FROM SIMULATIONS')) {
      inMemoryStore.simulations = inMemoryStore.simulations.filter(s => s.id !== params[0]);
    }
    
    // Persist memory store modifications to disk
    saveMemoryStore();
    return { changes: 1 };
  },
};
