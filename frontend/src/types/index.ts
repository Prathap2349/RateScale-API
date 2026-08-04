export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type TrafficPattern = 'CONSTANT' | 'SPIKE' | 'RAMP_UP' | 'BURST' | 'RANDOM';
export type SimulationStatus = 'RUNNING' | 'COMPLETED' | 'STOPPED' | 'FAILED' | 'PENDING';
export type TestType = 'API_TRAFFIC' | 'LOGIN';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupCredentials {
  fullName: string;
  email: string;
  password: string;
  confirmPassword?: string;
  acceptTerms: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  newPassword: string;
  confirmPassword?: string;
}

export interface Simulation {
  id: string;
  name: string;
  testType?: TestType;
  targetUrl: string;
  httpMethod: HttpMethod;
  concurrentUsers: number;
  requestsPerSecond: number;
  durationSeconds: number;
  trafficPattern: TrafficPattern;
  status: SimulationStatus;
  createdAt: string;
  stoppedAt?: string;
  successRequests?: number;
  failedRequests?: number;
  avgLatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
  errorRatePercent?: number;
  activeDefender?: boolean;
  isThrottled?: boolean;
}

export interface CreateSimulationRequest {
  name?: string;
  testType?: TestType;
  targetUrl: string;
  httpMethod: HttpMethod;
  concurrentUsers: number;
  requestsPerSecond: number;
  duration: number;
  trafficPattern: TrafficPattern;
  activeDefender?: boolean;
}

export interface TrafficConfiguration {
  id: string;
  name?: string;
  targetUrl: string;
  httpMethod: HttpMethod;
  requestsPerSecond: number;
  concurrentUsers: number;
  duration: number;
  trafficPattern: TrafficPattern;
  createdAt: string;
}

export interface CreateTrafficConfigRequest {
  targetUrl: string;
  httpMethod: HttpMethod;
  requestsPerSecond: number;
  concurrentUsers: number;
  duration: number;
  trafficPattern: TrafficPattern;
}

export interface LiveTelemetryData {
  timestamp: string;
  latencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  throughputRps: number;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  errorRatePercent: number;
  successfulRequests: number;
  failedRequests: number;
}

export interface Recommendation {
  id: string;
  simulationId?: string;
  recommendedRateLimitRps: number;
  confidenceScore: number;
  reason: string;
  modelVersion: string;
  createdAt: string;
  targetUrl?: string;
  status?: string;
  applied?: boolean;
  verificationStatus?: 'PENDING' | 'AUTO_VERIFIED' | 'NEEDS_REVIEW' | 'MANUALLY_APPROVED' | 'MANUALLY_REJECTED';
  secondaryRps?: number | null;
  secondaryReason?: string | null;
  secondaryModelVersion?: string | null;
  agreementPercent?: number | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
}

export interface DashboardMetrics {
  totalSimulations: number;
  activeSimulations: number;
  averageLatencyMs: number;
  errorRatePercent: number;
  recommendedRateLimitRps: number;
  throughputRps: number;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
}

export interface ComparisonHistory {
  id: string;
  timestamp: string;
  policy: string;
  beforeLimit: string;
  afterLimit: string;
  latencyReduction: string;
  errorReduction: string;
}

export interface AnalyticsData {
  latencyHistory: any[];
  throughputHistory: any[];
  errorRateHistory: any[];
  requestsTimeline: any[];
}

export interface UserSettings {
  darkMode: boolean;
  notificationsEnabled: boolean;
  language: string;
  timezone: string;
}
