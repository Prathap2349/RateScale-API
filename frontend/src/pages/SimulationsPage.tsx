import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { PlaySquare, Plus, Trash2, Square, RefreshCw, KeyRound, Globe, ArrowRight, BarChart2, CheckCircle2, XCircle, Database, TrendingUp, Activity, Shield } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { simulationsApi } from '../api/simulations';
import type { Simulation } from '../types';
import { Table } from '../components/common/Table';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/common/Modal';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import { SearchInput } from '../components/common/SearchInput';
import { EmptyState } from '../components/common/EmptyState';

const simulationSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  testType: z.enum(['API_TRAFFIC', 'LOGIN']),
  targetUrl: z.string().min(1, 'Target URL is required'),
  httpMethod: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  concurrentUsers: z.number().min(1, 'At least 1 user'),
  requestsPerSecond: z.number().min(1, 'At least 1 RPS'),
  duration: z.number().min(1, 'Minimum 1 second'),
  trafficPattern: z.enum(['CONSTANT', 'SPIKE', 'RAMP_UP', 'BURST', 'RANDOM']),
  activeDefender: z.boolean().optional(),
});

type SimulationFormInputs = z.infer<typeof simulationSchema>;

export const SimulationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTestType, setSelectedTestType] = useState<'API_TRAFFIC' | 'LOGIN'>('API_TRAFFIC');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteRecommendations, setDeleteRecommendations] = useState<boolean>(true);
  const [search, setSearch] = useState('');
  const [reportSim, setReportSim] = useState<Simulation | null>(null);

  // Fetch Simulations
  const {
    data: simulations,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['simulations'],
    queryFn: simulationsApi.getSimulations,
    retry: 1,
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: simulationsApi.createSimulation,
    onSuccess: () => {
      toast.success('Simulation created and started!');
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to create simulation.';
      toast.error(msg);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => simulationsApi.deleteSimulation(id, deleteRecommendations),
    onSuccess: () => {
      toast.success('Simulation deleted');
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      // Invalidate recommendations as well to refresh recommendation page view!
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Failed to delete simulation.');
    },
  });

  // Stop Mutation
  const stopMutation = useMutation({
    mutationFn: simulationsApi.stopSimulation,
    onSuccess: () => {
      toast.success('Simulation stopped');
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
    onError: () => {
      toast.error('Failed to stop simulation.');
    },
  });

  // Sync to PostgreSQL Mutation
  const syncPgMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('http://localhost:8080/api/simulations/sync-all-to-postgres', { method: 'POST' });
      return await res.json();
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.count} simulations to PostgreSQL!`);
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
    },
    onError: () => {
      toast.error('Failed to sync to PostgreSQL.');
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SimulationFormInputs>({
    resolver: zodResolver(simulationSchema),
    defaultValues: {
      name: 'API Endpoint Workload Test',
      testType: 'API_TRAFFIC',
      targetUrl: 'http://localhost:8080/api/products',
      httpMethod: 'GET',
      concurrentUsers: 50,
      requestsPerSecond: 200,
      duration: 60,
      trafficPattern: 'CONSTANT',
    },
  });

  const selectTestPreset = (type: 'API_TRAFFIC' | 'LOGIN') => {
    setSelectedTestType(type);
    setValue('testType', type);
    if (type === 'LOGIN') {
      setValue('name', 'Login Gateway Load Test');
      setValue('targetUrl', 'http://localhost:8080/api/auth/login');
      setValue('httpMethod', 'POST');
      setValue('requestsPerSecond', 350);
      setValue('concurrentUsers', 80);
    } else {
      setValue('name', 'API Endpoint Workload Test');
      setValue('targetUrl', 'http://localhost:8080/api/products');
      setValue('httpMethod', 'GET');
      setValue('requestsPerSecond', 200);
      setValue('concurrentUsers', 50);
    }
  };

  const onSubmit = (data: SimulationFormInputs) => {
    let cleanUrl = data.targetUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      if (cleanUrl.startsWith('/')) {
        cleanUrl = `http://localhost:8080${cleanUrl}`;
      } else {
        cleanUrl = `http://${cleanUrl}`;
      }
    }
    createMutation.mutate({ ...data, targetUrl: cleanUrl });
  };

  const filteredData = (simulations || []).filter(
    (s: Simulation) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.targetUrl.toLowerCase().includes(search.toLowerCase())
  );

  // Generate dynamic chart points for the execution report modal
  const generateChartData = (sim: Simulation) => {
    const avg = sim.avgLatencyMs || 250;
    const p99 = sim.p99LatencyMs || sim.avgLatencyMs || 500;
    const rps = sim.requestsPerSecond || 50;

    return [
      { time: '0s', latency: Math.round(avg * 0.4), p99Latency: Math.round(p99 * 0.5), rps: Math.round(rps * 0.2) },
      { time: '2s', latency: Math.round(avg * 0.7), p99Latency: Math.round(p99 * 0.8), rps: Math.round(rps * 0.6) },
      { time: '4s', latency: Math.round(avg * 0.9), p99Latency: Math.round(p99 * 0.95), rps: Math.round(rps * 0.9) },
      { time: '6s', latency: Math.round(avg), p99Latency: Math.round(p99), rps: rps },
      { time: '8s', latency: Math.round(avg * 1.05), p99Latency: Math.round(p99 * 1.1), rps: rps },
      { time: '10s', latency: Math.round(avg * 0.98), p99Latency: Math.round(p99 * 1.02), rps: rps },
    ];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Traffic Simulations</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Run synthetic workload load tests against target endpoints
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => syncPgMutation.mutate()}
            disabled={syncPgMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
            title="Sync all simulations to PostgreSQL"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{syncPgMutation.isPending ? 'Syncing...' : 'Sync to PostgreSQL'}</span>
          </button>

          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 border border-zinc-800 bg-zinc-900 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-950 font-semibold text-xs transition-opacity hover:opacity-90 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Simulation
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4 border border-zinc-800 bg-zinc-900/60 p-3 rounded-xl">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by simulation name or URL..."
          className="w-full sm:w-80"
        />
        <div className="text-xs text-zinc-400 font-medium">
          Total: <span className="text-zinc-100 font-semibold">{filteredData.length}</span>
        </div>
      </div>

      {/* Zero State empty check */}
      {!isLoading && filteredData.length === 0 && (
        <EmptyState
          type="no_data"
          title="No Traffic Simulations"
          description="Click 'New Simulation' to start your first workload test."
          actionButton={
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-950 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              Start First Simulation
            </button>
          }
        />
      )}

      {/* Simulation Table */}
      {filteredData.length > 0 && (
        <Table<Simulation>
          isLoading={isLoading}
          isError={isError}
          emptyTitle="No Simulations Found"
          emptyDescription="Create your first traffic simulation to test endpoint performance."
          onRetry={() => refetch()}
          data={filteredData}
          keyExtractor={(item: Simulation) => item.id}
          columns={[
            {
              header: 'Simulation Name & URL',
              render: (item: Simulation) => (
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-zinc-100 block">{item.name}</span>
                    {item.activeDefender && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Shield className="w-2.5 h-2.5" />
                        <span>Shield</span>
                      </span>
                    )}
                    {item.isThrottled && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                        <span>Throttled</span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-blue-400 font-mono truncate max-w-xs block mt-0.5">
                    {item.targetUrl}
                  </span>
                </div>
              ),
            },
            {
              header: 'Method',
              render: (item: Simulation) => (
                <Badge variant={item.httpMethod === 'GET' ? 'blue' : 'amber'}>
                  {item.httpMethod}
                </Badge>
              ),
            },
            {
              header: 'Requests Passed / Failed',
              render: (item: Simulation) => (
                item.status === 'RUNNING' ? (
                  <span className="text-xs text-amber-400 font-medium animate-pulse">Load Test Executing...</span>
                ) : (
                  <div className="text-xs space-y-0.5">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{(item.successRequests ?? 0).toLocaleString()} Passed</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                      <XCircle className="w-3 h-3 text-red-400" />
                      <span>{(item.failedRequests ?? 0).toLocaleString()} Failed ({item.errorRatePercent ?? 0}%)</span>
                    </div>
                  </div>
                )
              ),
            },
            {
              header: 'Latency (Avg / P99)',
              render: (item: Simulation) => (
                item.status === 'RUNNING' ? (
                  <span className="text-xs text-zinc-500">Measuring...</span>
                ) : (
                  <div className="text-xs text-zinc-100">
                    <span className="font-semibold text-blue-400">{item.avgLatencyMs ?? 0} ms</span>
                    <span className="text-[11px] text-zinc-400 block font-mono">P99: {item.p99LatencyMs ?? item.avgLatencyMs ?? 0} ms</span>
                  </div>
                )
              ),
            },
            {
              header: 'Status',
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
            {
              header: 'Actions',
              className: 'text-right',
              render: (item: Simulation) => (
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setReportSim(item)}
                    className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                    title="View Execution Report & Interactive Graph"
                  >
                    <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
                  </button>

                  {item.status === 'RUNNING' && (
                    <button
                      onClick={() => stopMutation.mutate(item.id)}
                      className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                      title="Stop Simulation"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteId(item.id)}
                    className="p-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Delete Simulation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      {/* Modal: Create Simulation */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Configure Traffic Simulation"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-100 mb-2">
              1. Select Test Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => selectTestPreset('API_TRAFFIC')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  selectedTestType === 'API_TRAFFIC'
                    ? 'border-blue-500 bg-blue-500/10 text-zinc-100'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                }`}
              >
                <div className="p-2 rounded-lg bg-zinc-800 shrink-0">
                  <Globe className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <span className="text-xs font-bold block text-zinc-100">API Traffic Test</span>
                  <span className="text-[11px] block mt-0.5 leading-snug">
                    Test REST endpoints (e.g. GET /api/products)
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => selectTestPreset('LOGIN')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  selectedTestType === 'LOGIN'
                    ? 'border-blue-500 bg-blue-500/10 text-zinc-100'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                }`}
              >
                <div className="p-2 rounded-lg bg-zinc-800 shrink-0">
                  <KeyRound className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <span className="text-xs font-bold block text-zinc-100">Login Load Test</span>
                  <span className="text-[11px] block mt-0.5 leading-snug">
                    Stress-test auth gateway (e.g. POST /api/auth/login)
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div className="pt-2 space-y-3.5">
            <label className="block text-xs font-semibold text-zinc-100">
              2. Configure Simulation Parameters
            </label>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Simulation Name
              </label>
              <input
                {...register('name')}
                placeholder="e.g. Auth Gateway Load Test"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Method</label>
                <select
                  {...register('httpMethod')}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Target Endpoint URL
                </label>
                <input
                  {...register('targetUrl')}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 font-mono"
                />
                {errors.targetUrl && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.targetUrl.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Concurrent Users
                </label>
                <input
                  {...register('concurrentUsers', { valueAsNumber: true })}
                  type="number"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Req / Sec (RPS)
                </label>
                <input
                  {...register('requestsPerSecond', { valueAsNumber: true })}
                  type="number"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Duration (sec)
                </label>
                <input
                  {...register('duration', { valueAsNumber: true })}
                  type="number"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Traffic Pattern
              </label>
              <select
                {...register('trafficPattern')}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
              >
                <option value="CONSTANT">CONSTANT (Uniform stream)</option>
                <option value="SPIKE">SPIKE (Sudden aggressive surge)</option>
                <option value="RAMP_UP">RAMP_UP (Linear increase)</option>
                <option value="BURST">BURST (Periodic intermittent surges)</option>
                <option value="RANDOM">RANDOM (Fluctuating)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl mt-1.5">
              <div className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold block text-zinc-100">🛡️ Enable Active Defender Shield</span>
                  <span className="text-[10px] text-zinc-400 block mt-0.5 leading-snug">
                    Dynamically throttle traffic load if latency warning thresholds are breached.
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                {...register('activeDefender')}
                className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-indigo-500 focus:ring-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-1.5 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-white rounded-lg shadow-sm flex items-center gap-1.5"
            >
              <span>{createMutation.isPending ? 'Starting...' : 'Start Simulation'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: View Execution Report with Live Interactive Chart */}
      <Modal
        isOpen={!!reportSim}
        onClose={() => setReportSim(null)}
        title="Simulation Execution Report & Analytics"
        maxWidth="lg"
      >
        {reportSim && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-100">{reportSim.name}</span>
                <Badge variant={reportSim.status === 'COMPLETED' ? 'blue' : 'emerald'}>
                  {reportSim.status}
                </Badge>
              </div>
              <span className="text-xs text-blue-400 font-mono block break-all">
                {reportSim.targetUrl}
              </span>
            </div>

            {/* Interactive Latency & Throughput Timeline Graphic */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <h4 className="text-xs font-bold text-zinc-100">Live Execution Latency & Tail Curve</h4>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 text-blue-400">
                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Avg Latency
                  </span>
                  <span className="flex items-center gap-1 text-purple-400">
                    <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> P99 Tail Spike
                  </span>
                </div>
              </div>

              <div className="h-48 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={generateChartData(reportSim)}>
                    <defs>
                      <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorP99" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#c084fc" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#c084fc" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="time" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} unit="ms" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '11px', color: '#f4f4f5' }}
                    />
                    <Area type="monotone" dataKey="latency" name="Avg Latency (ms)" stroke="#60a5fa" fillOpacity={1} fill="url(#colorAvg)" />
                    <Area type="monotone" dataKey="p99Latency" name="P99 Latency (ms)" stroke="#c084fc" fillOpacity={1} fill="url(#colorP99)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 block text-[11px]">Passed (2xx HTTP OK)</span>
                <span className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {(reportSim.successRequests ?? 0).toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 block text-[11px]">Failed / Errors</span>
                <span className="text-lg font-bold text-red-400 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  {(reportSim.failedRequests ?? 0).toLocaleString()}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 block text-[11px]">Average Latency</span>
                <span className="text-lg font-bold text-blue-400">
                  {reportSim.avgLatencyMs ?? 0} ms
                </span>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-zinc-400 block text-[11px]">P99 Tail Latency</span>
                <span className="text-lg font-bold text-purple-400">
                  {reportSim.p99LatencyMs ?? reportSim.avgLatencyMs ?? 0} ms
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Configured RPS Target:</span>
              <span className="font-bold text-zinc-100">{reportSim.requestsPerSecond} RPS</span>
            </div>

            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Concurrent Users:</span>
              <span className="font-bold text-zinc-100">{reportSim.concurrentUsers} Users</span>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-zinc-800">
              <button
                onClick={() => setReportSim(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white"
              >
                Close Report
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Simulation"
        message={
          <div className="space-y-3">
            <p className="text-xs text-zinc-300">Are you sure you want to delete this simulation from the server?</p>
            <label className="flex items-center gap-2 p-2 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={deleteRecommendations}
                onChange={(e) => setDeleteRecommendations(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 text-blue-500 focus:ring-0 cursor-pointer"
              />
              <span className="text-[11px] font-bold text-zinc-200 select-none">
                Also delete related AI rate limit recommendations
              </span>
            </label>
          </div>
        }
        confirmText="Delete"
        isDanger
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
