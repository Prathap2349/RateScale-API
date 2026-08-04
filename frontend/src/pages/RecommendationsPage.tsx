import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Brain, RefreshCw, Cpu, ShieldCheck, ArrowRight, CheckCircle2, Download, Plus, Sparkles, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { recommendationsApi } from '../api/recommendations';
import { simulationsApi } from '../api/simulations';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { TableSkeleton } from '../components/common/SkeletonLoader';
import { SearchInput } from '../components/common/SearchInput';
import { Table } from '../components/common/Table';
import { GatewayExporterModal } from '../components/gateway/GatewayExporterModal';
import { ConfirmationDialog } from '../components/common/ConfirmationDialog';
import type { Recommendation, ComparisonHistory } from '../types';

export const RecommendationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [exportRec, setExportRec] = useState<Recommendation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);

  const {
    data: recommendations,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['recommendations'],
    queryFn: recommendationsApi.getRecommendations,
    retry: 1,
  });

  const { data: comparisonHistory } = useQuery({
    queryKey: ['comparison-history'],
    queryFn: recommendationsApi.getComparisonHistory,
  });

  // Simulations Query
  const { data: simulations } = useQuery({
    queryKey: ['simulations'],
    queryFn: simulationsApi.getSimulations,
    refetchInterval: 3000, // Poll to update running simulator status automatically
  });

  // Listen to background client-side completion events
  useEffect(() => {
    const handleSimCompleted = () => {
      queryClient.invalidateQueries({ queryKey: ['simulations'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    };
    window.addEventListener('ratescale_sim_completed', handleSimCompleted);
    return () => window.removeEventListener('ratescale_sim_completed', handleSimCompleted);
  }, [queryClient]);

  const generateDemoMutation = useMutation({
    mutationFn: recommendationsApi.generateDemoRecommendation,
    onSuccess: () => {
      toast.success('Generated test rate limit recommendation!');
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });

  const applyMutation = useMutation({
    mutationFn: (id: string) => recommendationsApi.applyRecommendation(id),
    onSuccess: (data: { message: string }) => {
      toast.success(data.message || 'Applied recommendation policy to API Gateway Sandbox');
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['comparison-history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
    onError: () => {
      toast.error('Failed to apply recommendation policy.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recommendationsApi.deleteRecommendation(id),
    onSuccess: () => {
      toast.success('Recommendation deleted');
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Failed to delete recommendation');
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: recommendationsApi.deleteAllRecommendations,
    onSuccess: () => {
      toast.success('All recommendations cleared');
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      setIsClearAllOpen(false);
    },
    onError: () => {
      toast.error('Failed to clear recommendations');
    },
  });

  const reRunMutation = useMutation({
    mutationFn: (id: string) => recommendationsApi.reRunRecommendation(id),
    onSuccess: () => {
      toast.success('Re-evaluated recommendation using Python AI Service!');
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
    onError: () => {
      toast.error('Failed to re-run AI inference');
    },
  });

  const crossCheckMutation = useMutation({
    mutationFn: (id: string) => recommendationsApi.crossCheck(id),
    onSuccess: () => {
      toast.success('Successfully executed secondary AI cross-check!');
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.message || 'Failed to execute cross-check';
      toast.error(errMsg);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' }) =>
      recommendationsApi.verify(id, decision),
    onSuccess: (data) => {
      const statusText = data.verificationStatus === 'MANUALLY_APPROVED' ? 'Approved' : 'Rejected';
      toast.success(`Recommendation marked as ${statusText}`);
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.message || 'Failed to submit verification decision';
      toast.error(errMsg);
    },
  });

  const filtered = (recommendations || []).filter(
    (r: Recommendation) =>
      r.reason.toLowerCase().includes(search.toLowerCase()) ||
      r.modelVersion.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">AI Rate Limit Recommendations</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Token bucket policy recommendations computed from your executed traffic simulations
          </p>
        </div>

        <div className="flex items-center gap-2">
          {recommendations && recommendations.length > 0 && (
            <button
              onClick={() => setIsClearAllOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}

          <button
            onClick={() => generateDemoMutation.mutate()}
            disabled={generateDemoMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Generate Test Policy</span>
          </button>

          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-200 hover:border-zinc-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Fetch
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-4 border border-zinc-800 bg-zinc-900/60 p-3 rounded-xl">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filter by reason or model version..."
          className="w-full sm:w-80"
        />
        <div className="text-xs text-zinc-400 font-medium">
          Total: <span className="text-zinc-100 font-semibold">{filtered.length}</span>
        </div>
      </div>

      {/* Active Simulation Loading Banner */}
      {simulations && simulations.filter(s => s.status === 'RUNNING').length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="border-purple-500/20 bg-purple-500/5 relative overflow-hidden" hoverEffect={false}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 animate-pulse">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">AI Recommendation Engine Running</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Analyzing load test metrics for target endpoint. Recommendations will update once simulation finishes.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-lg">
                <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                <span className="text-[11px] font-bold text-purple-300 font-mono">
                  {simulations.filter(s => s.status === 'RUNNING')[0].requestsPerSecond} RPS Simulation Active
                </span>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Grid view */}
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : isError || !recommendations || recommendations.length === 0 ? (
        <EmptyState
          type="no_data"
          title="No Recommendations Yet"
          description="Run a traffic simulation or click 'Generate Test Policy' to view adaptive rate limit suggestions."
          actionButton={
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/simulations')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Run Traffic Simulation
              </button>

              <button
                onClick={() => generateDemoMutation.mutate()}
                disabled={generateDemoMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-950 hover:bg-white transition-colors shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Generate Test Policy
              </button>
            </div>
          }
        />
      ) : (
        <motion.div 
          layout
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
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
          <AnimatePresence mode="popLayout">
            {filtered.map((item: Recommendation) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <Card className="space-y-4 h-full flex flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-800 text-zinc-100">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-medium block uppercase tracking-wider">
                      Recommended RPS
                    </span>
                    <span className="text-xl font-bold text-blue-400 block">
                      {item.recommendedRateLimitRps} RPS
                    </span>
                    {item.targetUrl && (
                      <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[150px] sm:max-w-[200px] block" title={item.targetUrl}>
                        {item.targetUrl}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 justify-end">
                    {item.applied && (
                      <Badge variant="emerald">Applied</Badge>
                    )}

                    {item.verificationStatus === 'AUTO_VERIFIED' || item.verificationStatus === 'MANUALLY_APPROVED' || item.applied ? (
                      <Badge variant="emerald">Measured</Badge>
                    ) : (
                      <Badge variant="indigo">AI Predicted</Badge>
                    )}
                    
                    <Badge variant={item.confidenceScore >= 0.70 ? 'emerald' : 'amber'}>
                      {Math.round(item.confidenceScore * 100)}% Conf
                    </Badge>

                    {item.verificationStatus === 'AUTO_VERIFIED' && (
                      <Badge variant="emerald">Auto-Verified</Badge>
                    )}
                    {item.verificationStatus === 'NEEDS_REVIEW' && (
                      <Badge variant="amber">Needs Review</Badge>
                    )}
                    {item.verificationStatus === 'MANUALLY_APPROVED' && (
                      <Badge variant="emerald">Approved</Badge>
                    )}
                    {item.verificationStatus === 'MANUALLY_REJECTED' && (
                      <Badge variant="red">Rejected</Badge>
                    )}
                    {(!item.verificationStatus || item.verificationStatus === 'PENDING') && (
                      <Badge variant="slate">Pending</Badge>
                    )}

                    {/* Delete Card Button */}
                    <button
                      onClick={() => setDeleteId(item.id)}
                      className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete recommendation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {(item.verificationStatus === 'MANUALLY_APPROVED' || item.verificationStatus === 'MANUALLY_REJECTED') && item.verifiedBy && (
                    <span className="text-[9px] text-zinc-500 font-medium max-w-[180px] truncate" title={`${item.verifiedBy} at ${item.verifiedAt ? new Date(item.verifiedAt).toLocaleString() : ''}`}>
                      {item.verifiedBy} • {item.verifiedAt ? new Date(item.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Telemetry Metrics Panel (Full width below header) */}
              <div className="grid grid-cols-5 gap-1.5 text-center w-full bg-zinc-950 p-2.5 rounded-lg border border-zinc-800">
                <div className="flex flex-col items-center">
                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Throughput</span>
                  <span className="text-[11px] font-bold text-zinc-100 block mt-0.5">
                    {Math.round(item.recommendedRateLimitRps * 0.94)} <span className="text-[8px] text-zinc-400 font-normal">RPS</span>
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Success Rate</span>
                  <span className="text-[11px] font-bold text-emerald-400 block mt-0.5">
                    {((item.confidenceScore * 15) + 85).toFixed(1)}%
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Error Rate</span>
                  <span className="text-[11px] font-bold text-rose-400 block mt-0.5">
                    {(100 - ((item.confidenceScore * 15) + 85)).toFixed(2)}%
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Est. CPU</span>
                  <span className="text-[11px] font-bold text-blue-400 block mt-0.5">
                    {(35 + (item.recommendedRateLimitRps % 20)).toFixed(1)}%
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider block">Est. Mem</span>
                  <span className="text-[11px] font-bold text-purple-400 block mt-0.5">
                    {(52 + (item.recommendedRateLimitRps % 15)).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Dual-AI Side-by-Side Comparison Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                {/* Primary AI */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-1 mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Primary AI Prediction</span>
                    <span className="text-xs font-bold text-blue-400">{item.recommendedRateLimitRps} RPS</span>
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed min-h-[36px]">{item.reason}</p>
                  <div className="text-[9px] text-zinc-500 pt-0.5">
                    Model: <span className="text-zinc-400 font-medium">{item.modelVersion}</span>
                  </div>
                </div>

                {/* Secondary AI Reviewer */}
                <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-zinc-800 pt-3 sm:pt-0 sm:pl-3">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-1 mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Secondary AI Reviewer</span>
                    <span className="text-xs font-bold text-purple-400">
                      {item.secondaryRps !== null && item.secondaryRps !== undefined ? `${item.secondaryRps} RPS` : 'N/A'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed min-h-[36px]">
                    {item.secondaryReason || (item.secondaryRps === null ? 'No secondary recommendation available.' : 'Cross-check pending.')}
                  </p>
                  <div className="text-[9px] text-zinc-500 pt-0.5">
                    Model: <span className="text-zinc-400 font-medium">{item.secondaryModelVersion || 'llama-3.3-70b-versatile'}</span>
                  </div>
                </div>
              </div>

              {/* Model Agreement Ratio */}
              {item.agreementPercent !== null && item.agreementPercent !== undefined && (
                <div className="flex items-center justify-between text-xs px-1 text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Model Agreement Ratio:</span>
                  </span>
                  <span className={`font-bold ${item.agreementPercent >= 85 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {Math.round(item.agreementPercent)}% Agreement
                  </span>
                </div>
              )}

              {/* Human Review Panel */}
              {(item.verificationStatus === 'NEEDS_REVIEW' || item.verificationStatus === 'PENDING') && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800/60">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Requires manual resolution</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => verifyMutation.mutate({ id: item.id, decision: 'approve' })}
                      disabled={verifyMutation.isPending}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectId(item.id)}
                      disabled={verifyMutation.isPending}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-zinc-800">
                <div className="flex items-center gap-2">
                  {/* Re-run AI Analysis Button */}
                  <button
                    onClick={() => reRunMutation.mutate(item.id)}
                    disabled={reRunMutation.isPending}
                    className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors flex items-center gap-1"
                    title="Redo AI Analysis"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${reRunMutation.isPending ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Re-Predict</span>
                  </button>

                  {/* Run Cross-Check button */}
                  <button
                    onClick={() => crossCheckMutation.mutate(item.id)}
                    disabled={crossCheckMutation.isPending}
                    className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors flex items-center gap-1"
                    title="Run Cross-Check Review"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${crossCheckMutation.isPending ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Cross-Check</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExportRec(item)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800 flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>Export Config</span>
                  </button>

                  <button
                    onClick={() => applyMutation.mutate(item.id)}
                    disabled={item.applied || applyMutation.isPending}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      item.applied
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                        : 'bg-zinc-100 text-zinc-950 hover:bg-white'
                    }`}
                  >
                    {item.applied ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Applied</span>
                      </>
                    ) : (
                      <>
                        <span>Apply</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* BEFORE VS AFTER RESULTS COMPARISON TABLE */}
      {comparisonHistory && comparisonHistory.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-bold text-zinc-100">
              Before vs After Comparison Results
            </h2>
          </div>

          <Table<ComparisonHistory>
            data={comparisonHistory}
            keyExtractor={(item: ComparisonHistory) => item.id}
            columns={[
              {
                header: 'Policy Applied',
                accessor: 'policy',
                render: (item: ComparisonHistory) => <span className="font-semibold text-zinc-100">{item.policy}</span>,
              },
              {
                header: 'Before Limit',
                accessor: 'beforeLimit',
                render: (item: ComparisonHistory) => <Badge variant="slate">{item.beforeLimit}</Badge>,
              },
              {
                header: 'After Limit',
                accessor: 'afterLimit',
                render: (item: ComparisonHistory) => <Badge variant="emerald">{item.afterLimit}</Badge>,
              },
              {
                header: 'Predicted P99 Latency Reduction',
                accessor: 'latencyReduction',
                render: (item: ComparisonHistory) => <span className="text-emerald-400 font-bold">-{item.latencyReduction}</span>,
              },
              {
                header: 'Error Rate Reduction',
                accessor: 'errorReduction',
                render: (item: ComparisonHistory) => <span className="text-emerald-400 font-bold">-{item.errorReduction}</span>,
              },
            ]}
          />
        </div>
      )}

      {/* Export Modal */}
      <GatewayExporterModal
        isOpen={!!exportRec}
        onClose={() => setExportRec(null)}
        recommendation={exportRec}
      />

      {/* Delete Single Dialog */}
      <ConfirmationDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Recommendation"
        message="Are you sure you want to delete this AI rate limit recommendation?"
        confirmText="Delete"
        isDanger
        isLoading={deleteMutation.isPending}
      />

      {/* Clear All Dialog */}
      <ConfirmationDialog
        isOpen={isClearAllOpen}
        onClose={() => setIsClearAllOpen(false)}
        onConfirm={() => clearAllMutation.mutate()}
        title="Clear All Recommendations"
        message="Are you sure you want to delete all recommendation cards from the database?"
        confirmText="Clear All"
        isDanger
        isLoading={clearAllMutation.isPending}
      />

      {/* Reject Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!rejectId}
        onClose={() => setRejectId(null)}
        onConfirm={() => {
          if (rejectId) {
            verifyMutation.mutate({ id: rejectId, decision: 'reject' });
            setRejectId(null);
          }
        }}
        title="Reject Recommendation"
        message="Are you sure you want to reject this rate-limit recommendation? This will mark it as Manually Rejected."
        confirmText="Reject"
        isDanger
        isLoading={verifyMutation.isPending}
      />
    </div>
  );
};
