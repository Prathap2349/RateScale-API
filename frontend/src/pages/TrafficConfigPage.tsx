import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Sliders, Save, RefreshCw, PlaySquare, Trash2 } from 'lucide-react';
import { trafficApi } from '../api/traffic';
import { simulationsApi } from '../api/simulations';
import type { TrafficConfiguration } from '../types';
import { Card } from '../components/ui/Card';
import { Table } from '../components/common/Table';
import { Badge } from '../components/ui/Badge';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';

const trafficConfigSchema = z.object({
  targetUrl: z.string().min(1, 'Please enter a target URL'),
  httpMethod: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  requestsPerSecond: z.number().min(1, 'Minimum 1 RPS'),
  concurrentUsers: z.number().min(1, 'Minimum 1 concurrent user'),
  duration: z.number().min(1, 'Minimum 1 second duration'),
  trafficPattern: z.enum(['CONSTANT', 'SPIKE', 'RAMP_UP', 'BURST', 'RANDOM']),
});

type TrafficConfigInputs = z.infer<typeof trafficConfigSchema>;

export const TrafficConfigPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    data: configs,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['traffic-configurations'],
    queryFn: trafficApi.getTrafficConfigs,
    retry: 1,
  });

  const saveMutation = useMutation({
    mutationFn: trafficApi.createTrafficConfig,
    onSuccess: () => {
      toast.success('Traffic configuration saved');
      queryClient.invalidateQueries({ queryKey: ['traffic-configurations'] });
      reset();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to save configuration.';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: trafficApi.deleteTrafficConfig,
    onSuccess: () => {
      toast.success('Traffic configuration deleted');
      queryClient.invalidateQueries({ queryKey: ['traffic-configurations'] });
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Failed to delete configuration');
    },
  });

  const runSimulationMutation = useMutation({
    mutationFn: simulationsApi.createSimulation,
    onSuccess: () => {
      toast.success('Simulation started from traffic profile!');
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to start simulation.';
      toast.error(msg);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TrafficConfigInputs>({
    resolver: zodResolver(trafficConfigSchema),
    defaultValues: {
      targetUrl: 'http://localhost:8080/api/v1/workload',
      httpMethod: 'GET',
      requestsPerSecond: 100,
      concurrentUsers: 25,
      duration: 30,
      trafficPattern: 'CONSTANT',
    },
  });

  const onSubmit = (data: TrafficConfigInputs) => {
    let cleanUrl = data.targetUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      if (cleanUrl.startsWith('/')) {
        cleanUrl = `http://localhost:8080${cleanUrl}`;
      } else {
        cleanUrl = `http://${cleanUrl}`;
      }
    }
    saveMutation.mutate({ ...data, targetUrl: cleanUrl });
  };

  const handleRunProfile = (cfg: TrafficConfiguration) => {
    runSimulationMutation.mutate({
      name: `Profile Load Test (${cfg.httpMethod} ${cfg.requestsPerSecond} RPS)`,
      testType: 'API_TRAFFIC',
      targetUrl: cfg.targetUrl,
      httpMethod: cfg.httpMethod,
      concurrentUsers: cfg.concurrentUsers,
      requestsPerSecond: cfg.requestsPerSecond,
      duration: cfg.duration || 30,
      trafficPattern: cfg.trafficPattern,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Traffic Configurations</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Define workload profiles and request patterns for rate limiting tests
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-zinc-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reload
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
              <Sliders className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-bold text-zinc-100">Save Traffic Profile</h2>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Target URL
                </label>
                <input
                  {...register('targetUrl')}
                  placeholder="http://localhost:8080/api/v1/resource"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none"
                />
                {errors.targetUrl && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.targetUrl.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  HTTP Method
                </label>
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

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Req / sec
                  </label>
                  <input
                    {...register('requestsPerSecond', { valueAsNumber: true })}
                    type="number"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Concurrent Users
                  </label>
                  <input
                    {...register('concurrentUsers', { valueAsNumber: true })}
                    type="number"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Duration (sec)
                </label>
                <input
                  {...register('duration', { valueAsNumber: true })}
                  type="number"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Traffic Pattern
                </label>
                <select
                  {...register('trafficPattern')}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100"
                >
                  <option value="CONSTANT">CONSTANT (Uniform stream)</option>
                  <option value="SPIKE">SPIKE (Aggressive burst)</option>
                  <option value="RAMP_UP">RAMP_UP (Linear increase)</option>
                  <option value="BURST">BURST (Periodic surges)</option>
                  <option value="RANDOM">RANDOM (Unpredictable)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="w-full py-2 px-4 rounded-lg bg-zinc-100 text-zinc-950 font-semibold text-xs hover:bg-white transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                <Save className="w-3.5 h-3.5" />
                {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </button>
            </form>
          </Card>
        </div>

        {/* Existing Configurations Table */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-bold text-zinc-100">Saved Traffic Profiles</h2>

          <Table<TrafficConfiguration>
            isLoading={isLoading}
            isError={isError}
            emptyTitle="No Configurations"
            emptyDescription="Save a traffic profile using the form."
            onRetry={() => refetch()}
            data={configs || []}
            keyExtractor={(item: TrafficConfiguration) => item.id}
            columns={[
              {
                header: 'Target Endpoint',
                render: (item: TrafficConfiguration) => (
                  <div>
                    <span className="font-mono text-xs text-blue-400 block font-semibold">
                      {item.targetUrl}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Created: {new Date(item.createdAt || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                ),
              },
              {
                header: 'Method',
                render: (item: TrafficConfiguration) => <Badge variant="slate">{item.httpMethod}</Badge>,
              },
              {
                header: 'RPS / Users',
                render: (item: TrafficConfiguration) => (
                  <span className="text-xs text-zinc-200">
                    <strong className="text-blue-400">{item.requestsPerSecond}</strong> req/s |{' '}
                    <span>{item.concurrentUsers}</span> users
                  </span>
                ),
              },
              {
                header: 'Pattern',
                render: (item: TrafficConfiguration) => (
                  <Badge variant="purple" size="sm">
                    {item.trafficPattern}
                  </Badge>
                ),
              },
              {
                header: 'Actions',
                className: 'text-right',
                render: (item: TrafficConfiguration) => (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleRunProfile(item)}
                      disabled={runSimulationMutation.isPending}
                      className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Run Simulation from Profile"
                    >
                      <PlaySquare className="w-3.5 h-3.5" />
                      <span>Run</span>
                    </button>

                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="p-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Delete Profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>

      <ConfirmationDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Traffic Profile"
        message="Are you sure you want to delete this saved traffic profile?"
        confirmText="Delete"
        isDanger
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
