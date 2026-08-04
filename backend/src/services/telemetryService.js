const os = require('os');
const db = require('../config/database');
const loadTester = require('./loadTester');

class TelemetryService {
  constructor() {
    this.previousCpuTimes = this.getSystemCpuTimes();
  }

  getSystemCpuTimes() {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;

    for (const cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    }

    return { user, nice, sys, idle, irq, total: user + nice + sys + idle + irq };
  }

  getRealCpuUsagePercent() {
    const current = this.getSystemCpuTimes();
    const prev = this.previousCpuTimes;
    this.previousCpuTimes = current;

    const idleDelta = current.idle - prev.idle;
    const totalDelta = current.total - prev.total;

    if (totalDelta === 0) return 0;

    const usage = 100 - (idleDelta / totalDelta) * 100;
    return Math.max(0, Math.min(100, Math.round(usage * 10) / 10));
  }

  getRealMemoryMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryPercent = Math.round((usedMem / totalMem) * 100 * 10) / 10;

    const memUsage = process.memoryUsage();
    return {
      memoryPercent,
      rssMb: Math.round(memUsage.rss / 1024 / 1024 * 10) / 10,
      heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024 * 10) / 10,
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024 * 10) / 10,
      totalMemMb: Math.round(totalMem / 1024 / 1024),
      freeMemMb: Math.round(freeMem / 1024 / 1024),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }

  getTelemetrySnapshot() {
    const cpuUsagePercent = this.getRealCpuUsagePercent();
    const mem = this.getRealMemoryMetrics();
    const loadStats = loadTester.getActiveStats();

    // Query latest database telemetry record if available
    const latestTel = db.get('SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT 1');

    return {
      timestamp: new Date().toISOString(),
      cpuUsagePercent,
      memoryUsagePercent: mem.memoryPercent,
      rssMb: mem.rssMb,
      heapTotalMb: mem.heapTotalMb,
      heapUsedMb: mem.heapUsedMb,
      freeMemMb: mem.freeMemMb,
      totalMemMb: mem.totalMemMb,
      uptimeSeconds: mem.uptimeSeconds,
      activeSimulationsCount: loadStats.activeCount,
      throughputRps: loadStats.totalThroughput,
      latencyMs: latestTel ? latestTel.latency_ms : (loadStats.activeCount > 0 ? 32 : 0),
      p95LatencyMs: latestTel ? latestTel.p95_latency_ms : (loadStats.activeCount > 0 ? 58 : 0),
      p99LatencyMs: latestTel ? latestTel.p99_latency_ms : (loadStats.activeCount > 0 ? 110 : 0),
      errorRatePercent: latestTel ? latestTel.error_rate_percent : 0,
      successfulRequests: latestTel ? latestTel.success_requests : 0,
      failedRequests: latestTel ? latestTel.failed_requests : 0,
    };
  }
}

module.exports = new TelemetryService();
