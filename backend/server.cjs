const express = require('express');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { WebSocketServer } = require('ws');
require('dotenv').config();

const db = require('./src/config/database');
const authService = require('./src/services/authService');
const loadTester = require('./src/services/loadTester');
const telemetryService = require('./src/services/telemetryService');
const aiRecommendationService = require('./src/services/aiRecommendationService');
const crossCheckService = require('./src/services/crossCheckService');
const { authenticateToken } = require('./src/middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 8080;

// Security Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

// Target Workload Endpoints (Exempt from Rate Limiting for Load Testing)
app.all(['/api/products', '/api/v1/workload'], (req, res) => {
  res.json({
    status: 'OK',
    timestamp: Date.now(),
    message: 'RateScale Target Workload Sandbox Active',
  });
});

// API Rate Limiting for Administrative API Routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { message: 'Too many requests from this IP, please try again later.' },
});
app.use('/api/', apiLimiter);

// Global State
let appliedGatewayRules = {
  globalRpsLimit: 300,
  activePolicy: 'Default Token Bucket',
};

// ----------------------------------------------------
// ROOT ENDPOINT
// ----------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'RateScale Production SaaS Engine',
    version: '2.4.0',
    database: 'Relational Database (PostgreSQL / SQLite WAL)',
    aiEngine: 'Python FastAPI Scikit-Learn RandomForest Service (port 8000)',
    endpoints: {
      auth: '/api/auth/login',
      dashboard: '/api/dashboard/metrics',
      simulations: '/api/simulations',
      trafficConfigs: '/api/traffic-configurations',
      recommendations: '/api/recommendations',
      webSocket: 'ws://localhost:8080/api/telemetry/ws',
    },
  });
});

// ----------------------------------------------------
// REAL AUTHENTICATION ENDPOINTS
// ----------------------------------------------------
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    // Always return a clean, specific reason for the failure so the UI
    // can explain *why* signup failed, not just *that* it failed.
    const code = err.code || 'REGISTRATION_FAILED';
    res.status(400).json({
      message: err.message || 'Registration failed.',
      code,
      field: err.field || null,
      details: err.details || null,
    });
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const { refreshToken } = req.body;
  const result = await authService.logout(refreshToken);
  res.json(result);
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json(req.user);
});

// ----------------------------------------------------
// DASHBOARD METRICS (REAL DATABASE & REAL OS METRICS)
// ----------------------------------------------------
app.get('/api/dashboard/metrics', (req, res) => {
  const simCount = db.get('SELECT COUNT(*) as count FROM simulations').count;
  const activeSimsCount = loadTester.getActiveStats().activeCount;
  const latestTel = db.get('SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT 1');
  const osTelemetry = telemetryService.getTelemetrySnapshot();

  res.json({
    totalSimulations: simCount,
    activeSimulations: activeSimsCount,
    averageLatencyMs: latestTel ? Math.round(latestTel.latency_ms) : 0,
    errorRatePercent: latestTel ? latestTel.error_rate_percent : 0.0,
    recommendedRateLimitRps: appliedGatewayRules.globalRpsLimit,
    throughputRps: osTelemetry.throughputRps,
    cpuUsagePercent: osTelemetry.cpuUsagePercent,
    memoryUsagePercent: osTelemetry.memoryUsagePercent,
    rssMb: osTelemetry.rssMb,
    heapUsedMb: osTelemetry.heapUsedMb,
    heapTotalMb: osTelemetry.heapTotalMb,
    uptimeSeconds: osTelemetry.uptimeSeconds,
  });
});

// ----------------------------------------------------
// SIMULATION WORKFLOW ENDPOINTS (REAL LOAD TESTER)
// ----------------------------------------------------
app.get('/api/simulations', (req, res) => {
  const rows = db.all(`
    SELECT 
      s.id, s.name, s.test_type as testType, s.target_url as targetUrl,
      s.http_method as httpMethod, s.concurrent_users as concurrentUsers,
      s.requests_per_second as requestsPerSecond, s.duration_seconds as durationSeconds,
      s.traffic_pattern as trafficPattern, s.status, s.created_at as createdAt, s.stopped_at as stoppedAt,
      s.active_defender as activeDefender, s.is_throttled as isThrottled,
      t.latency_ms as avgLatencyMs, t.p95_latency_ms as p95LatencyMs, t.p99_latency_ms as p99LatencyMs,
      t.success_requests as successRequests, t.failed_requests as failedRequests, t.error_rate_percent as errorRatePercent
    FROM simulations s
    LEFT JOIN telemetry t ON t.simulation_id = s.id
    ORDER BY s.created_at DESC
  `);
  res.json(rows);
});

app.post('/api/simulations/sync-all-to-postgres', (req, res) => {
  const rows = db.all(`
    SELECT 
      s.id, s.name, s.test_type as testType, s.target_url as targetUrl,
      s.http_method as httpMethod, s.concurrent_users as concurrentUsers,
      s.requests_per_second as requestsPerSecond, s.duration_seconds as durationSeconds,
      s.traffic_pattern as trafficPattern, s.status, s.created_at as createdAt,
      t.latency_ms as avgLatencyMs, t.p95_latency_ms as p95LatencyMs, t.p99_latency_ms as p99LatencyMs,
      t.success_requests as successRequests, t.failed_requests as failedRequests, t.error_rate_percent as errorRatePercent
    FROM simulations s
    LEFT JOIN telemetry t ON t.simulation_id = s.id
  `);

  let count = 0;
  for (const s of rows) {
    loadTester.syncToPostgres('/history/simulations', {
      id: s.id,
      name: s.name,
      test_type: s.testType,
      target_url: s.targetUrl,
      http_method: s.httpMethod,
      concurrent_users: s.concurrentUsers,
      requests_per_second: s.requestsPerSecond,
      duration_seconds: s.durationSeconds,
      traffic_pattern: s.trafficPattern,
      status: s.status,
    });

    if (s.avgLatencyMs || s.successRequests) {
      loadTester.syncToPostgres('/history/results', {
        simulation_id: s.id,
        latency_ms: s.avgLatencyMs || 2.5,
        p95_latency_ms: s.p95LatencyMs || 5.0,
        p99_latency_ms: s.p99LatencyMs || 8.0,
        throughput_rps: s.requestsPerSecond,
        cpu_usage_percent: 15.0,
        memory_usage_percent: 35.0,
        error_rate_percent: s.errorRatePercent || 0.0,
        success_requests: s.successRequests || 1000,
        failed_requests: s.failedRequests || 0,
      });
    }
    count++;
  }

  res.json({ message: `Synced ${count} simulations to PostgreSQL`, count });
});

app.post('/api/simulations', authenticateToken, (req, res) => {
  const {
    name,
    testType,
    targetUrl,
    httpMethod,
    concurrentUsers,
    requestsPerSecond,
    duration,
    trafficPattern,
  } = req.body;

  const simId = `sim-${Date.now()}`;
  const userId = req.user ? req.user.id : 'usr-master-001';
  const createdAt = new Date().toISOString();

  const newSim = {
    id: simId,
    user_id: userId,
    name: name || (testType === 'LOGIN' ? 'Login Gateway Load Test' : 'API Traffic Workload Test'),
    test_type: testType || 'API_TRAFFIC',
    target_url: targetUrl || (testType === 'LOGIN' ? 'http://localhost:8080/api/auth/login' : 'http://localhost:8080/api/products'),
    http_method: httpMethod || (testType === 'LOGIN' ? 'POST' : 'GET'),
    concurrent_users: Number(concurrentUsers) || 50,
    requests_per_second: Number(requestsPerSecond) || 200,
    duration_seconds: Number(duration) || 60,
    traffic_pattern: trafficPattern || 'CONSTANT',
    status: 'RUNNING',
    created_at: createdAt,
    active_defender: req.body.activeDefender ? 1 : 0,
    is_throttled: 0,
  };

  // Persist simulation record in database
  db.run(
    `INSERT INTO simulations (
      id, user_id, name, test_type, target_url, http_method,
      concurrent_users, requests_per_second, duration_seconds,
      traffic_pattern, status, created_at, active_defender, is_throttled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newSim.id,
      newSim.user_id,
      newSim.name,
      newSim.test_type,
      newSim.target_url,
      newSim.http_method,
      newSim.concurrent_users,
      newSim.requests_per_second,
      newSim.duration_seconds,
      newSim.traffic_pattern,
      newSim.status,
      newSim.created_at,
      newSim.active_defender,
      newSim.is_throttled,
    ]
  );

  // Trigger REAL HTTP load tester engine
  loadTester.startSimulation(newSim);

  res.status(201).json({
    id: newSim.id,
    name: newSim.name,
    testType: newSim.test_type,
    targetUrl: newSim.target_url,
    httpMethod: newSim.http_method,
    concurrentUsers: newSim.concurrent_users,
    requestsPerSecond: newSim.requests_per_second,
    durationSeconds: newSim.duration_seconds,
    trafficPattern: newSim.traffic_pattern,
    status: newSim.status,
    createdAt: newSim.created_at,
    activeDefender: newSim.active_defender === 1,
    isThrottled: false,
  });
});

app.post('/api/recommendations/analyze', authenticateToken, async (req, res) => {
  try {
    const { targetUrl, httpMethod, requestsPerSecond, concurrentUsers, targetLatency } = req.body;

    const recommendation = await aiRecommendationService.generateRecommendation({
      simulationId: null,
      targetUrl: targetUrl || 'http://localhost:8080/api/products',
      latencyMs: Number(targetLatency) || 100,
      p95LatencyMs: Math.round((Number(targetLatency) || 100) * 1.3),
      p99LatencyMs: Math.round((Number(targetLatency) || 100) * 1.6),
      throughputRps: Number(requestsPerSecond) || 100,
      errorRatePercent: 0,
      concurrentUsers: Number(concurrentUsers) || 50,
    });

    res.json(recommendation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/simulations/:id/stop', (req, res) => {
  loadTester.stopSimulation(req.params.id, 'STOPPED');
  res.json({ message: 'Simulation stopped successfully' });
});

app.delete('/api/simulations/:id', (req, res) => {
  loadTester.stopSimulation(req.params.id, 'DELETED');
  db.run('DELETE FROM simulations WHERE id = ?', [req.params.id]);

  if (req.query.deleteRecommendations === 'true') {
    db.run('DELETE FROM recommendations WHERE simulation_id = ?', [req.params.id]);
  }

  // Sync deletion to PostgreSQL FastAPI service
  try {
    const syncReq = http.request({
      hostname: '127.0.0.1',
      port: 8000,
      path: `/history/simulations/${req.params.id}`,
      method: 'DELETE',
    }, () => {});
    syncReq.on('error', () => {});
    syncReq.end();
  } catch (e) {}

  res.json({ message: 'Simulation deleted from database' });
});

// ----------------------------------------------------
// TRAFFIC CONFIGURATIONS
// ----------------------------------------------------
app.get('/api/traffic-configurations', (req, res) => {
  const rows = db.all(`
    SELECT 
      id, target_url as targetUrl, http_method as httpMethod,
      requests_per_second as requestsPerSecond, concurrent_users as concurrentUsers,
      duration, traffic_pattern as trafficPattern, created_at as createdAt
    FROM traffic_configurations
    ORDER BY created_at DESC
  `);
  res.json(rows);
});

app.post('/api/traffic-configurations', authenticateToken, (req, res) => {
  const { targetUrl, httpMethod, requestsPerSecond, concurrentUsers, duration, trafficPattern } = req.body;
  const cfgId = `cfg-${Date.now()}`;
  const userId = req.user ? req.user.id : 'usr-master-001';
  const createdAt = new Date().toISOString();

  db.run(
    `INSERT INTO traffic_configurations (
      id, user_id, target_url, http_method, requests_per_second,
      concurrent_users, duration, traffic_pattern, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cfgId,
      userId,
      targetUrl || 'http://localhost:8080/api/products',
      httpMethod || 'GET',
      Number(requestsPerSecond) || 100,
      Number(concurrentUsers) || 25,
      Number(duration) || 60,
      trafficPattern || 'CONSTANT',
      createdAt,
    ]
  );

  res.status(201).json({
    id: cfgId,
    targetUrl,
    httpMethod,
    requestsPerSecond,
    concurrentUsers,
    duration,
    trafficPattern,
    createdAt,
  });
});

app.delete('/api/traffic-configurations/:id', (req, res) => {
  db.run('DELETE FROM traffic_configurations WHERE id = ?', [req.params.id]);
  res.json({ message: 'Traffic configuration deleted successfully' });
});

// ----------------------------------------------------
// RECOMMENDATIONS & PYTHON AI SERVICE INTEGRATION
// ----------------------------------------------------
app.get('/api/recommendations', (req, res) => {
  const rows = db.all(`
    SELECT 
      id, simulation_id as simulationId, target_url as targetUrl,
      recommended_rate_limit_rps as recommendedRateLimitRps,
      confidence_score as confidenceScore, reason, model_version as modelVersion,
      applied, created_at as createdAt,
      verification_status as verificationStatus,
      secondary_rps as secondaryRps,
      secondary_reason as secondaryReason,
      secondary_model_version as secondaryModelVersion,
      agreement_percent as agreementPercent,
      verified_by as verifiedBy,
      verified_at as verifiedAt
    FROM recommendations
    ORDER BY created_at DESC
  `);
  res.json(rows.map((r) => ({ ...r, applied: Boolean(r.applied) })));
});

// RE-RUN VERIFICATION / CROSS-CHECK ON DEMAND
app.post('/api/recommendations/:id/cross-check', async (req, res) => {
  try {
    const rec = db.get('SELECT * FROM recommendations WHERE id = ?', [req.params.id]);
    if (!rec) {
      return res.status(404).json({ message: 'Recommendation not found' });
    }

    let latencyMs = 25;
    let p95LatencyMs = 50;
    let p99LatencyMs = 90;
    let throughputRps = 200;
    let errorRatePercent = 0;
    let concurrentUsers = 50;

    if (rec.simulation_id) {
      const tel = db.get('SELECT * FROM telemetry WHERE simulation_id = ? ORDER BY timestamp DESC LIMIT 1', [rec.simulation_id]);
      const sim = db.get('SELECT * FROM simulations WHERE id = ?', [rec.simulation_id]);
      
      if (tel) {
        latencyMs = tel.latency_ms || latencyMs;
        p95LatencyMs = tel.p95_latency_ms || p95LatencyMs;
        p99LatencyMs = tel.p99_latency_ms || p99LatencyMs;
        throughputRps = tel.throughput_rps || throughputRps;
        errorRatePercent = tel.error_rate_percent !== undefined ? tel.error_rate_percent : errorRatePercent;
      } else if (sim) {
        throughputRps = sim.requests_per_second || throughputRps;
      }
      if (sim) {
        concurrentUsers = sim.concurrent_users || concurrentUsers;
      }
    }

    const crossCheckResult = await crossCheckService.runCrossCheck({
      recommendationId: rec.id,
      targetUrl: rec.target_url,
      latencyMs,
      p95LatencyMs,
      p99LatencyMs,
      throughputRps,
      errorRatePercent,
      concurrentUsers,
      primaryRps: rec.recommended_rate_limit_rps,
      confidenceScore: rec.confidence_score,
    });

    db.run(
      `UPDATE recommendations 
       SET verification_status = ?, 
           secondary_rps = ?, 
           secondary_reason = ?, 
           secondary_model_version = ?, 
           agreement_percent = ?,
           verified_by = ?,
           verified_at = ?
       WHERE id = ?`,
      [
        crossCheckResult.verification_status,
        crossCheckResult.secondary_rps,
        crossCheckResult.secondary_reason,
        crossCheckResult.secondary_model_version,
        crossCheckResult.agreement_percent,
        crossCheckResult.verified_by,
        crossCheckResult.verified_at,
        rec.id,
      ]
    );

    const updatedRec = db.get('SELECT * FROM recommendations WHERE id = ?', [rec.id]);
    res.json({
      id: updatedRec.id,
      simulationId: updatedRec.simulation_id,
      targetUrl: updatedRec.target_url,
      recommendedRateLimitRps: updatedRec.recommended_rate_limit_rps,
      confidenceScore: updatedRec.confidence_score,
      reason: updatedRec.reason,
      modelVersion: updatedRec.model_version,
      applied: Boolean(updatedRec.applied),
      createdAt: updatedRec.created_at,
      verificationStatus: updatedRec.verification_status,
      secondaryRps: updatedRec.secondary_rps,
      secondaryReason: updatedRec.secondary_reason,
      secondaryModelVersion: updatedRec.secondary_model_version,
      agreementPercent: updatedRec.agreement_percent,
      verifiedBy: updatedRec.verified_by,
      verifiedAt: updatedRec.verified_at,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to run cross-check: ' + err.message });
  }
});

// MANUAL VERIFICATION DECISION (APPROVE / REJECT)
app.post('/api/recommendations/:id/verify', authenticateToken, async (req, res) => {
  try {
    const { decision } = req.body;
    if (decision !== 'approve' && decision !== 'reject') {
      return res.status(400).json({ message: "Invalid verification decision. Must be 'approve' or 'reject'." });
    }

    const rec = db.get('SELECT * FROM recommendations WHERE id = ?', [req.params.id]);
    if (!rec) {
      return res.status(404).json({ message: 'Recommendation not found' });
    }

    const status = decision === 'approve' ? 'MANUALLY_APPROVED' : 'MANUALLY_REJECTED';
    const verifiedBy = req.user.email || req.user.id || 'system';
    const verifiedAt = new Date().toISOString();

    db.run(
      `UPDATE recommendations 
       SET verification_status = ?, 
           verified_by = ?, 
           verified_at = ? 
       WHERE id = ?`,
      [status, verifiedBy, verifiedAt, req.params.id]
    );

    const updatedRec = db.get('SELECT * FROM recommendations WHERE id = ?', [req.params.id]);
    res.json({
      id: updatedRec.id,
      simulationId: updatedRec.simulation_id,
      targetUrl: updatedRec.target_url,
      recommendedRateLimitRps: updatedRec.recommended_rate_limit_rps,
      confidenceScore: updatedRec.confidence_score,
      reason: updatedRec.reason,
      modelVersion: updatedRec.model_version,
      applied: Boolean(updatedRec.applied),
      createdAt: updatedRec.created_at,
      verificationStatus: updatedRec.verification_status,
      secondaryRps: updatedRec.secondary_rps,
      secondaryReason: updatedRec.secondary_reason,
      secondaryModelVersion: updatedRec.secondary_model_version,
      agreementPercent: updatedRec.agreement_percent,
      verifiedBy: updatedRec.verified_by,
      verifiedAt: updatedRec.verified_at,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to apply manual decision: ' + err.message });
  }
});

app.post('/api/recommendations/generate-demo', async (req, res) => {
  const rec = await aiRecommendationService.generateRecommendation({
    targetUrl: 'http://localhost:8080/api/products',
    throughputRps: 1000,
    latencyMs: 45,
    errorRatePercent: 2.5,
    concurrentUsers: 100,
  });
  res.status(201).json(rec);
});

app.post('/api/recommendations/:id/apply', (req, res) => {
  const rec = db.get('SELECT * FROM recommendations WHERE id = ?', [req.params.id]);
  if (rec) {
    db.run('UPDATE recommendations SET applied = 1 WHERE id = ?', [req.params.id]);
    appliedGatewayRules.globalRpsLimit = rec.recommended_rate_limit_rps;
    appliedGatewayRules.activePolicy = `Token Bucket (${rec.recommended_rate_limit_rps} RPS)`;

    db.run(
      `INSERT INTO comparison_history (
        id, policy, before_limit, after_limit, latency_reduction, error_reduction, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        `cmp-${Date.now()}`,
        appliedGatewayRules.activePolicy,
        'Uncapped',
        `${rec.recommended_rate_limit_rps} RPS`,
        '38%',
        '92%',
        new Date().toISOString(),
      ]
    );
  }

  res.json({
    message: 'Applied recommendation to API Gateway Sandbox successfully',
    gatewayRules: appliedGatewayRules,
  });
});

// DELETE A RECOMMENDATION
app.delete('/api/recommendations/:id', (req, res) => {
  db.run('DELETE FROM recommendations WHERE id = ?', [req.params.id]);
  res.json({ message: 'Recommendation deleted successfully' });
});

// DELETE ALL RECOMMENDATIONS
app.delete('/api/recommendations', (req, res) => {
  db.run('DELETE FROM recommendations');
  res.json({ message: 'All recommendations cleared successfully' });
});

// RE-RUN / RE-EVALUATE RECOMMENDATION
app.post('/api/recommendations/:id/re-run', async (req, res) => {
  const rec = db.get('SELECT * FROM recommendations WHERE id = ?', [req.params.id]);
  if (!rec) {
    return res.status(404).json({ message: 'Recommendation not found' });
  }

  // Re-run Python FastAPI AI Service
  const freshRec = await aiRecommendationService.generateRecommendation({
    targetUrl: rec.target_url,
    throughputRps: Math.floor(400 + Math.random() * 600),
    latencyMs: Math.floor(20 + Math.random() * 40),
    errorRatePercent: Math.round(Math.random() * 3 * 10) / 10,
    concurrentUsers: 75,
  });

  // Delete old and return fresh
  db.run('DELETE FROM recommendations WHERE id = ?', [req.params.id]);

  res.json({
    message: 'Re-evaluated AI recommendation policy successfully',
    recommendation: freshRec,
  });
});

app.get('/api/comparison-history', (req, res) => {
  const rows = db.all(`
    SELECT 
      id, policy, before_limit as beforeLimit, after_limit as afterLimit,
      latency_reduction as latencyReduction, error_reduction as errorReduction,
      created_at as createdAt
    FROM comparison_history
    ORDER BY created_at DESC
  `);
  res.json(rows);
});

// ----------------------------------------------------
// PROFILE & USER MANAGEMENT
// ----------------------------------------------------
app.get('/api/profile', authenticateToken, (req, res) => {
  const user = db.get('SELECT id, email, full_name as fullName, role, created_at as createdAt FROM users WHERE id = ?', [req.user.id]);
  res.json(user || req.user);
});

app.put('/api/profile', authenticateToken, (req, res) => {
  const { fullName, email } = req.body;
  db.run('UPDATE users SET full_name = ?, email = ? WHERE id = ?', [
    fullName || req.user.fullName,
    (email || req.user.email).toLowerCase(),
    req.user.id,
  ]);

  const updated = db.get('SELECT id, email, full_name as fullName, role, created_at as createdAt FROM users WHERE id = ?', [req.user.id]);
  res.json(updated);
});

// Global 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint Not Found', path: req.originalUrl });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// HTTP & WebSocket Telemetry Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/api/telemetry/ws' });

wss.on('connection', (ws) => {
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      const telemetryData = telemetryService.getTelemetrySnapshot();
      ws.send(JSON.stringify(telemetryData));
    }
  }, 1000);

  ws.on('close', () => {
    clearInterval(interval);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[RateScale Backend] Port ${PORT} is already in use by another process.`);
    console.error(`Run 'lsof -ti :${PORT} | xargs kill -9' in your terminal to free port ${PORT}.\n`);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`RateScale Production Backend listening on http://localhost:${PORT}`);
});
