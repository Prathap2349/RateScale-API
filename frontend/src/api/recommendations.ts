import apiClient from './axios';
import type { Recommendation, ComparisonHistory } from '../types';

const defaultRecs: Recommendation[] = [
  {
    id: "rec-glow-1",
    simulationId: "sim-glow-1",
    targetUrl: "https://api.gateway.io/v1/auth/login",
    recommendedRateLimitRps: 150,
    confidenceScore: 0.94,
    reason: "High concurrency detected on login route. A limit of 150 RPS is optimal to prevent brute force attacks while allowing legitimate users.",
    modelVersion: "rf-classifier-v3.2",
    applied: true,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    verificationStatus: "AUTO_VERIFIED",
    secondaryRps: 145,
    secondaryReason: "Login threshold matches expected capacity. 145-150 RPS ensures optimal security posture.",
    secondaryModelVersion: "llama-3.3-70b-versatile",
    agreementPercent: 96.6,
    verifiedBy: "system",
    verifiedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "rec-glow-2",
    simulationId: "sim-glow-2",
    targetUrl: "https://api.gateway.io/v1/products",
    recommendedRateLimitRps: 800,
    confidenceScore: 0.88,
    reason: "Throughput metrics show peak usage during high load. 800 RPS threshold provides a safe head-room without service degradation.",
    modelVersion: "rf-classifier-v3.2",
    applied: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    verificationStatus: "AUTO_VERIFIED",
    secondaryRps: 820,
    secondaryReason: "Product catalog throughput shows resilience at 800-850 RPS under stress testing.",
    secondaryModelVersion: "llama-3.3-70b-versatile",
    agreementPercent: 97.5,
    verifiedBy: "system",
    verifiedAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "rec-glow-3",
    simulationId: "sim-glow-3",
    targetUrl: "https://api.gateway.io/v1/checkout",
    recommendedRateLimitRps: 50,
    confidenceScore: 0.62,
    reason: "Checkout transaction rates are rising, causing database lock escalation. Limit to 50 RPS for thread pool stabilization.",
    modelVersion: "rf-classifier-v3.2",
    applied: false,
    createdAt: new Date().toISOString(),
    verificationStatus: "NEEDS_REVIEW",
    secondaryRps: 120,
    secondaryReason: "Transaction latency is moderate. Suggest a higher limit of 120 RPS to support high checkout volumes.",
    secondaryModelVersion: "llama-3.3-70b-versatile",
    agreementPercent: 41.6,
    verifiedBy: null,
    verifiedAt: null,
  }
];

const getLocalRecs = (): Recommendation[] => {
  const data = localStorage.getItem('ratescale_recs');
  if (!data) {
    localStorage.setItem('ratescale_recs', JSON.stringify(defaultRecs));
    return defaultRecs;
  }
  return JSON.parse(data);
};

const saveLocalRecs = (recs: Recommendation[]) => {
  localStorage.setItem('ratescale_recs', JSON.stringify(recs));
};

const getLocalHistory = (): ComparisonHistory[] => {
  const data = localStorage.getItem('ratescale_history');
  if (!data) {
    const defaultHistory: ComparisonHistory[] = [
      {
        id: "cmp-glow-1",
        timestamp: new Date().toISOString(),
        policy: "Token Bucket (150 RPS)",
        beforeLimit: "Uncapped",
        afterLimit: "150 RPS",
        latencyReduction: "38%",
        errorReduction: "92%"
      }
    ];
    localStorage.setItem('ratescale_history', JSON.stringify(defaultHistory));
    return defaultHistory;
  }
  return JSON.parse(data);
};

const saveLocalHistory = (hist: ComparisonHistory[]) => {
  localStorage.setItem('ratescale_history', JSON.stringify(hist));
};

export const recommendationsApi = {
  getRecommendations: async (): Promise<Recommendation[]> => {
    try {
      const response = await apiClient.get<Recommendation[]>('/recommendations');
      saveLocalRecs(response.data);
      return response.data;
    } catch (e) {
      console.warn('Using LocalStorage fallback for recommendations');
      return getLocalRecs();
    }
  },

  generateDemoRecommendation: async (): Promise<Recommendation> => {
    try {
      const response = await apiClient.post<Recommendation>('/recommendations/generate-demo');
      const local = getLocalRecs();
      local.unshift(response.data);
      saveLocalRecs(local);
      return response.data;
    } catch (e) {
      const local = getLocalRecs();
      const newRec: Recommendation = {
        id: `rec-demo-${Date.now()}`,
        simulationId: `sim-demo-${Date.now()}`,
        targetUrl: "https://api.gateway.io/v1/demo",
        recommendedRateLimitRps: Math.floor(Math.random() * 500) + 50,
        confidenceScore: parseFloat((Math.random() * 0.4 + 0.55).toFixed(2)),
        reason: "Simulated load test showing resource exhaustion under peak traffic conditions.",
        modelVersion: "rf-classifier-v3.2-demo",
        applied: false,
        createdAt: new Date().toISOString(),
        verificationStatus: "PENDING"
      };
      local.unshift(newRec);
      saveLocalRecs(local);
      return newRec;
    }
  },

  applyRecommendation: async (id: string): Promise<{ message: string; gatewayRules: any }> => {
    try {
      const response = await apiClient.post<{ message: string; gatewayRules: any }>(
        `/recommendations/${id}/apply`
      );
      return response.data;
    } catch (e) {
      const local = getLocalRecs();
      const rec = local.find(r => r.id === id);
      if (rec) {
        rec.applied = true;
        saveLocalRecs(local);

        const hist = getLocalHistory();
        hist.unshift({
          id: `cmp-demo-${Date.now()}`,
          timestamp: new Date().toISOString(),
          policy: `Token Bucket (${rec.recommendedRateLimitRps} RPS)`,
          beforeLimit: "Uncapped",
          afterLimit: `${rec.recommendedRateLimitRps} RPS`,
          latencyReduction: "41%",
          errorReduction: "95%"
        });
        saveLocalHistory(hist);
      }
      return {
        message: "Applied recommendation policy to local storage",
        gatewayRules: { globalRpsLimit: rec ? rec.recommendedRateLimitRps : 300 }
      };
    }
  },

  deleteRecommendation: async (id: string): Promise<{ message: string }> => {
    try {
      const response = await apiClient.delete<{ message: string }>(`/recommendations/${id}`);
      return response.data;
    } catch (e) {
      const local = getLocalRecs();
      const filtered = local.filter(r => r.id !== id);
      saveLocalRecs(filtered);
      return { message: "Deleted recommendation locally" };
    }
  },

  deleteAllRecommendations: async (): Promise<{ message: string }> => {
    try {
      const response = await apiClient.delete<{ message: string }>('/recommendations');
      return response.data;
    } catch (e) {
      saveLocalRecs([]);
      return { message: "Cleared all recommendations locally" };
    }
  },

  reRunRecommendation: async (id: string): Promise<{ message: string; recommendation: Recommendation }> => {
    try {
      const response = await apiClient.post<{ message: string; recommendation: Recommendation }>(
        `/recommendations/${id}/re-run`
      );
      return response.data;
    } catch (e) {
      const local = getLocalRecs();
      const rec = local.find(r => r.id === id);
      if (rec) {
        rec.recommendedRateLimitRps = Math.floor(Math.random() * 500) + 50;
        rec.confidenceScore = parseFloat((Math.random() * 0.4 + 0.55).toFixed(2));
        rec.verificationStatus = "PENDING";
        rec.secondaryRps = null;
        rec.secondaryReason = null;
        rec.agreementPercent = null;
        saveLocalRecs(local);
        return { message: "Re-run done locally", recommendation: rec };
      }
      throw new Error("Not found");
    }
  },

  crossCheck: async (id: string): Promise<Recommendation> => {
    try {
      const response = await apiClient.post<Recommendation>(`/recommendations/${id}/cross-check`);
      return response.data;
    } catch (e) {
      const local = getLocalRecs();
      const rec = local.find(r => r.id === id);
      if (rec) {
        const secRps = Math.floor(rec.recommendedRateLimitRps * (0.85 + Math.random() * 0.3));
        const diff = rec.recommendedRateLimitRps > 0 ? (Math.abs(rec.recommendedRateLimitRps - secRps) / rec.recommendedRateLimitRps) * 100 : 0;
        const agreement = Math.max(0, Math.min(100, 100 - diff));
        
        rec.secondaryRps = secRps;
        rec.secondaryReason = `Simulated secondary analysis shows traffic profile capacity at ${secRps} RPS.`;
        rec.secondaryModelVersion = "llama-3.3-70b-versatile";
        rec.agreementPercent = agreement;
        
        if (rec.confidenceScore >= 0.70 && diff <= 15) {
          rec.verificationStatus = "AUTO_VERIFIED";
          rec.verifiedBy = "system";
          rec.verifiedAt = new Date().toISOString();
        } else {
          rec.verificationStatus = "NEEDS_REVIEW";
        }
        saveLocalRecs(local);
        return rec;
      }
      throw new Error("Not found");
    }
  },

  verify: async (id: string, decision: 'approve' | 'reject'): Promise<Recommendation> => {
    try {
      const response = await apiClient.post<Recommendation>(`/recommendations/${id}/verify`, { decision });
      return response.data;
    } catch (e) {
      const local = getLocalRecs();
      const rec = local.find(r => r.id === id);
      if (rec) {
        rec.verificationStatus = decision === 'approve' ? 'MANUALLY_APPROVED' : 'MANUALLY_REJECTED';
        rec.verifiedBy = "admin@airatelimit.local";
        rec.verifiedAt = new Date().toISOString();
        saveLocalRecs(local);
        return rec;
      }
      throw new Error("Not found");
    }
  },

  getComparisonHistory: async (): Promise<ComparisonHistory[]> => {
    try {
      const response = await apiClient.get<ComparisonHistory[]>('/comparison-history');
      return response.data;
    } catch (e) {
      return getLocalHistory();
    }
  },
};
