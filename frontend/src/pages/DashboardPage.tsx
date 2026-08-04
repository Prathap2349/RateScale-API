import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PlaySquare,
  Zap,
  Clock,
  AlertTriangle,
  Sparkles,
  Activity,
  Cpu,
  HardDrive,
  RefreshCw,
  ServerOff,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi } from '../api/analytics';
import { simulationsApi } from '../api/simulations';
import { recommendationsApi } from '../api/recommendations';
import { Card } from '../components/ui/Card';
import { CardSkeleton } from '../components/common/SkeletonLoader';
import { Table } from '../components/common/Table';
import { Badge } from '../components/ui/Badge';
import type { Simulation, Recommendation } from '../types';

export const DashboardPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState('24h');

  // Metrics Query
  const {
    data: metrics,
    isLoading: isMetricsLoading,
    isError: isMetricsError,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: analyticsApi.getDashboardMetrics,
    retry: 1,
  });

  // Recent Simulations Query
  const {
    data: simulations,
    isLoading: isSimulationsLoading,
    isError: isSimulationsError,
  } = useQuery({
    queryKey: ['recent-simulations'],
    queryFn: simulationsApi.getSimulations,
    retry: 1,
  });

  // Recommendations Query
  const {
    data: recommendations,
    isLoading: isRecsLoading,
    isError: isRecsError,
  } = useQuery({
    queryKey: ['recent-recommendations'],
    queryFn: recommendationsApi.getRecommendations,
    retry: 1,
  });

  const cardConfig = [
    {
      title: 'Total Simulations',
      value: metrics ? `${metrics.totalSimulations}` : null,
      icon: PlaySquare,
    },
    {
      title: 'Active Workloads',
      value: metrics ? `${metrics.activeSimulations}` : null,
      icon: Zap,
    },
    {
      title: 'Average Latency',
      value: metrics ? `${metrics.averageLatencyMs} ms` : null,
      icon: Clock,
    },
    {
      title: 'Error Rate',
      value: metrics ? `${metrics.errorRatePercent}%` : null,
      icon: AlertTriangle,
    },
    {
      title: 'Recommended Rate Limit',
      value: metrics ? `${metrics.recommendedRateLimitRps} RPS` : null,
      icon: Sparkles,
    },
    {
      title: 'Throughput',
      value: metrics ? `${metrics.throughputRps} RPS` : null,
      icon: Activity,
    },
    {
      title: 'CPU Usage',
      value: metrics ? `${metrics.cpuUsagePercent}%` : null,
      icon: Cpu,
    },
    {
      title: 'Memory Usage',
      value: metrics ? `${metrics.memoryUsagePercent}%` : null,
      icon: HardDrive,
    },
  ];

  return (
    <motion.div 
      className="space-y-6"
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: 0.05
          }
        }
      }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">System Telemetry & Quotas</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Workload throughput, latency distribution, and rate limit policies
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
            {['1h', '24h', '7d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={() => refetchMetrics()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-zinc-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Backend Status Banner if Error */}
      {isMetricsError && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ServerOff className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <span className="text-xs font-bold block">Backend Disconnected</span>
              <span className="text-[11px] text-amber-300">
                Server at http://localhost:8080/api is offline. Please start the backend.
              </span>
            </div>
          </div>
          <button
            onClick={() => refetchMetrics()}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Cards Grid */}
      <motion.div 
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.03
            }
          }
        }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {isMetricsLoading
          ? Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
          : cardConfig.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={index}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0 }
                  }}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="space-y-2 h-full">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-400">{item.title}</span>
                      <div className="p-1.5 rounded-lg bg-zinc-850 border border-zinc-800 text-zinc-300">
                        <Icon className="w-4 h-4 text-blue-400" />
                      </div>
                    </div>

                    {isMetricsError || !item.value ? (
                      <div className="py-1">
                        <span className="text-xs font-medium text-zinc-500">
                          Unavailable
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-2xl font-bold text-zinc-100 tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-300 bg-clip-text text-transparent">
                          {item.value}
                        </span>
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
      </motion.div>

      {/* Grid: Recent Simulations & Recommendations */}
      <motion.div 
        variants={{
          hidden: { opacity: 0, y: 15 },
          show: { opacity: 1, y: 0, transition: { delay: 0.1 } }
        }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Recent Simulations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-100">Recent Traffic Workloads</h2>
          </div>

          <Table<Simulation>
            isLoading={isSimulationsLoading}
            isError={isSimulationsError}
            emptyTitle="No Simulations"
            emptyDescription="No traffic simulations have been initiated yet."
            onRetry={() => refetchMetrics()}
            data={(simulations || []).slice(0, 5)}
            keyExtractor={(item: Simulation) => item.id}
            columns={[
              {
                header: 'Name',
                accessor: 'name',
                render: (item: Simulation) => (
                  <div>
                    <span className="font-semibold text-zinc-100">{item.name}</span>
                    <span className="text-[11px] text-zinc-400 block font-mono truncate max-w-xs">
                      {item.targetUrl}
                    </span>
                  </div>
                ),
              },
              {
                header: 'RPS',
                accessor: 'requestsPerSecond',
                render: (item: Simulation) => `${item.requestsPerSecond} req/s`,
              },
              {
                header: 'Status',
                accessor: 'status',
                render: (item: Simulation) => (
                  <Badge
                    variant={
                      item.status === 'RUNNING'
                        ? 'emerald'
                        : item.status === 'COMPLETED'
                        ? 'blue'
                        : 'slate'
                    }
                  >
                    {item.status}
                  </Badge>
                ),
              },
            ]}
          />
        </div>

        {/* Rate Limit Recommendations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-100">Rate Limit Policy Suggestions</h2>
          </div>

          <Table<Recommendation>
            isLoading={isRecsLoading}
            isError={isRecsError}
            emptyTitle="No Policy Suggestions"
            emptyDescription="No rate limit optimization suggestions generated yet."
            onRetry={() => refetchMetrics()}
            data={(recommendations || []).slice(0, 5)}
            keyExtractor={(item: Recommendation) => item.id}
            columns={[
              {
                header: 'Suggested Limit',
                accessor: 'recommendedRateLimitRps',
                render: (item: Recommendation) => (
                  <span className="font-semibold text-blue-400">
                    {item.recommendedRateLimitRps} RPS
                  </span>
                ),
              },
              {
                header: 'Confidence',
                accessor: 'confidenceScore',
                render: (item: Recommendation) => `${Math.round(item.confidenceScore * 100)}%`,
              },
              {
                header: 'Reason',
                accessor: 'reason',
                render: (item: Recommendation) => (
                  <span className="text-xs text-zinc-400 truncate max-w-xs block">
                    {item.reason}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </motion.div>
    </motion.div>
  );
};
