import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sliders, RefreshCw, Cpu, ShieldAlert, CheckCircle, Info, Play, Square } from 'lucide-react';
import { Card } from '../components/ui/Card';

type Algorithm = 'TOKEN_BUCKET' | 'LEAKY_BUCKET' | 'FIXED_WINDOW';

interface VisualDot {
  id: string;
  status: 'ALLOWED' | 'BLOCKED';
  x: number;
  y: number;
}

export const PolicySandboxPage: React.FC = () => {
  const [algo, setAlgo] = useState<Algorithm>('TOKEN_BUCKET');
  
  // Runtime control state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  
  // Simulation configuration states
  const [loadRps, setLoadRps] = useState<number>(20);
  const [capacity, setCapacity] = useState<number>(15);
  const [refillRate, setRefillRate] = useState<number>(5);

  // Runtime visualization states
  const [tokens, setTokens] = useState<number>(15);
  const [waterLevel, setWaterLevel] = useState<number>(0);
  const [windowCount, setWindowCount] = useState<number>(0);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(1000);

  // Metrics
  const [passedCount, setPassedCount] = useState<number>(0);
  const [blockedCount, setBlockedCount] = useState<number>(0);
  
  // Animated particles running in the canvas container
  const [dots, setDots] = useState<VisualDot[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Core State loop for Token / Leak / Window math
  useEffect(() => {
    setTokens(capacity);
    setWaterLevel(0);
    setWindowCount(0);
    setTimeLeftMs(1000);
    setPassedCount(0);
    setBlockedCount(0);
    setDots([]);
  }, [algo, capacity]);

  // 2. Token regeneration / Water drain / Fixed window clock timers
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      if (algo === 'TOKEN_BUCKET') {
        setTokens((prev) => Math.min(capacity, prev + (refillRate / 10)));
      } else if (algo === 'LEAKY_BUCKET') {
        setWaterLevel((prev) => Math.max(0, prev - (refillRate / 10)));
      } else if (algo === 'FIXED_WINDOW') {
        setTimeLeftMs((prev) => {
          if (prev <= 100) {
            setWindowCount(0);
            return 1000;
          }
          return prev - 100;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [algo, capacity, refillRate, isRunning]);

  // 3. Request dispatcher loop (based on user's RPS load slider)
  useEffect(() => {
    if (!isRunning || loadRps === 0) return;
    
    const intervalMs = 1000 / loadRps;
    const interval = setInterval(() => {
      let isAllowed = false;

      // Rate limit algorithm logic evaluation
      if (algo === 'TOKEN_BUCKET') {
        setTokens((prev) => {
          if (prev >= 1) {
            isAllowed = true;
            return prev - 1;
          }
          return prev;
        });
      } else if (algo === 'LEAKY_BUCKET') {
        setWaterLevel((prev) => {
          if (prev < capacity) {
            isAllowed = true;
            return prev + 1;
          }
          return prev;
        });
      } else if (algo === 'FIXED_WINDOW') {
        setWindowCount((prev) => {
          if (prev < capacity) {
            isAllowed = true;
            return prev + 1;
          }
          return prev;
        });
      }

      if (isAllowed) {
        setPassedCount((c) => c + 1);
      } else {
        setBlockedCount((c) => c + 1);
      }

      // Add animated dot flowing through
      const newDot: VisualDot = {
        id: `dot-${Date.now()}-${Math.random()}`,
        status: isAllowed ? 'ALLOWED' : 'BLOCKED',
        x: Math.floor(Math.random() * 80) + 10, // random start horizontal %
        y: 0,
      };

      setDots((prev) => [...prev.slice(-30), newDot]);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [algo, loadRps, capacity, refillRate, isRunning]);

  // 4. Particle vertical movement animation physics
  useEffect(() => {
    const physics = setInterval(() => {
      setDots((prev) =>
        prev
          .map((d) => {
            // Allowed requests fall all the way down
            if (d.status === 'ALLOWED') {
              return { ...d, y: d.y + 4 };
            }
            // Blocked requests hit the lid and slide/bounce away to the side
            if (d.y < 35) {
              return { ...d, y: d.y + 3 };
            }
            return { ...d, y: d.y + 1, x: d.x + (d.x > 50 ? 2 : -2) }; // slide out
          })
          .filter((d) => d.y < 100)
      );
    }, 30);

    return () => clearInterval(physics);
  }, []);

  const total = passedCount + blockedCount;
  const dropRate = total > 0 ? Math.round((blockedCount / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Algorithmic Policy Sandbox</h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Visualize and fine-tune various rate-limiting algorithms under dynamic traffic load.
        </p>
      </div>

      {/* Educational Notice Banner */}
      <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[11px] leading-relaxed text-zinc-300">
          <strong className="text-zinc-100 font-bold block mb-0.5">💡 Conceptual Simulator</strong>
          This sandbox visually simulates rate limit algorithms in-browser for educational and policy tuning purposes. 
          To run a <strong>real traffic load test against a custom endpoint URL</strong>, please navigate to the 
          <a href="/simulations" className="text-blue-400 hover:text-blue-300 font-bold ml-1 underline">Simulations Page</a>.
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Controls Panel */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 border-zinc-850 bg-zinc-900/40">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-4 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>Simulation Controls</span>
            </h2>

            {/* Algorithm Selector */}
            <div className="space-y-2 mb-5">
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Algorithm</label>
              <div className="grid grid-cols-3 gap-2">
                {(['TOKEN_BUCKET', 'LEAKY_BUCKET', 'FIXED_WINDOW'] as Algorithm[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setAlgo(type)}
                    className={`py-2 px-2.5 rounded-lg border text-center font-bold text-[10px] transition-all duration-200 ${
                      algo === type
                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-300 shadow-sm'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Play / Pause Toggle Button */}
            <div className="mb-4">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`w-full py-2 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all duration-200 ${
                  isRunning
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500'
                }`}
              >
                {isRunning ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-amber-400" />
                    <span>Pause Visual Simulator</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Start Visual Simulator</span>
                  </>
                )}
              </button>
            </div>

            {/* Parameter Sliders */}
            <div className="space-y-4 pt-4 border-t border-zinc-800/60">
              {/* Load input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-zinc-400">Incoming Traffic Load</span>
                  <span className="font-semibold text-zinc-200">{loadRps} Requests/sec</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="2"
                  value={loadRps}
                  onChange={(e) => setLoadRps(Number(e.target.value))}
                  className="w-full h-1 bg-zinc-850 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Bucket Limit / Capacity */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-zinc-400">
                    {algo === 'TOKEN_BUCKET' ? 'Bucket Token Capacity' : algo === 'LEAKY_BUCKET' ? 'Funnel Water Capacity' : 'Max Limit / Window'}
                  </span>
                  <span className="font-semibold text-zinc-200">{capacity} requests</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="40"
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full h-1 bg-zinc-850 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Refill / Drain Rate */}
              {algo !== 'FIXED_WINDOW' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-zinc-400">
                      {algo === 'TOKEN_BUCKET' ? 'Token Refill Rate' : 'Funnel Drain Rate'}
                    </span>
                    <span className="font-semibold text-zinc-200">{refillRate}/sec</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={refillRate}
                    onChange={(e) => setRefillRate(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-850 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Informational descriptions */}
            <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-850 text-[10px] leading-relaxed text-zinc-400 mt-5 flex gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                {algo === 'TOKEN_BUCKET' && (
                  <span>
                    <strong>Token Bucket:</strong> Permits bursty loads. Each query consumes one token. Refill rate steadily adds tokens back. Rejects bursts once the token pool runs dry.
                  </span>
                )}
                {algo === 'LEAKY_BUCKET' && (
                  <span>
                    <strong>Leaky Bucket:</strong> Smoothes incoming traffic spikes. The funnel drains requests at a constant leak speed. Overflows are instantly dropped as 429 errors.
                  </span>
                )}
                {algo === 'FIXED_WINDOW' && (
                  <span>
                    <strong>Fixed Window:</strong> Resets counter every 1.0 second. Rejects requests once limit is reached inside the current time frame, then opens up on window refresh.
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* Real-time stats Card */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3.5 text-center border-zinc-850 bg-zinc-900/30">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Allowed</span>
              <span className="block text-lg font-bold text-zinc-100 mt-1">{passedCount}</span>
            </Card>
            <Card className="p-3.5 text-center border-zinc-850 bg-zinc-900/30">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Blocked</span>
              <span className="block text-lg font-bold text-zinc-100 mt-1">{blockedCount}</span>
            </Card>
            <Card className="p-3.5 text-center border-zinc-850 bg-zinc-900/30">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Drop Rate</span>
              <span className={`block text-lg font-bold mt-1 ${dropRate > 30 ? 'text-amber-400 animate-pulse' : 'text-zinc-300'}`}>
                {dropRate}%
              </span>
            </Card>
          </div>
        </div>

        {/* Visual Workspace Canvas */}
        <div className="lg:col-span-7">
          <Card className="h-[430px] border-zinc-850 bg-[var(--bg-card)] flex flex-col justify-between overflow-hidden relative">
            
            {/* Canvas Header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between z-10">
              <div>
                <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">Rate Limit Queue Visualizer</h3>
                <span className="text-[10px] text-zinc-500 block mt-0.5 font-mono">Algorithm: {algo.replace('_', ' ')}</span>
              </div>
              <button
                onClick={() => {
                  setPassedCount(0);
                  setBlockedCount(0);
                  setDots([]);
                }}
                className="p-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                title="Reset Statistics"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Animation Canvas */}
            <div className="flex-1 w-full relative bg-zinc-950/40 overflow-hidden">
              
              {/* Particle Dots */}
              {dots.map((dot) => (
                <div
                  key={dot.id}
                  className={`absolute w-2 h-2 rounded-full shadow-xs transition-all duration-75 ${
                    dot.status === 'ALLOWED'
                      ? 'bg-emerald-400 shadow-emerald-400/50'
                      : 'bg-rose-500 shadow-rose-500/50'
                  }`}
                  style={{
                    left: `${dot.x}%`,
                    top: `${dot.y}%`,
                  }}
                />
              ))}

              {/* Algorithm visualization frames */}
              
              {/* 1. Token Bucket visual shape */}
              {algo === 'TOKEN_BUCKET' && (
                <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-48 h-32 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/20 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Token Reservoir</span>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 p-3 max-w-[170px]">
                    {Array.from({ length: Math.floor(tokens) }).map((_, i) => (
                      <motion.div
                        key={i}
                        layoutId={`tok-${i}`}
                        className="w-3.5 h-3.5 rounded bg-blue-500/30 border border-blue-400 text-[8px] font-extrabold flex items-center justify-center text-blue-300 select-none cursor-default"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.3 }}
                      >
                        T
                      </motion.div>
                    ))}
                    {Math.floor(tokens) === 0 && (
                      <span className="text-[10px] text-rose-400 font-bold animate-pulse">Pool Exhausted</span>
                    )}
                  </div>
                  <span className="text-[10px] text-blue-400 font-semibold mt-1">Tokens: {tokens.toFixed(1)} / {capacity}</span>
                </div>
              )}

              {/* 2. Leaky Bucket / Funnel shape */}
              {algo === 'LEAKY_BUCKET' && (
                <div className="absolute top-[35%] left-1/2 -translate-x-1/2 w-44 flex flex-col items-center">
                  {/* Funnel container */}
                  <div className="w-40 h-36 border-2 border-zinc-600 rounded-b-[40px] border-t-0 bg-zinc-900/10 overflow-hidden relative flex flex-col justify-end">
                    {/* Water Level inside the funnel */}
                    <div
                      className="w-full bg-blue-500/20 border-t border-blue-400 transition-all duration-300"
                      style={{ height: `${(waterLevel / capacity) * 100}%` }}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 text-center select-none pointer-events-none">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase block">Funnel</span>
                      <span className="text-[10px] text-blue-400 font-bold block">{waterLevel} / {capacity}</span>
                    </div>
                  </div>
                  {/* Drip leak leak indicator */}
                  {waterLevel > 0 && (
                    <motion.div 
                      className="w-1.5 h-3 rounded bg-blue-400 shadow-md mt-1"
                      animate={{ y: [0, 20, 40], opacity: [1, 1, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, ease: 'easeIn' }}
                    />
                  )}
                </div>
              )}

              {/* 3. Fixed Window Clock reset visual */}
              {algo === 'FIXED_WINDOW' && (
                <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-48 h-32 rounded-2xl border border-zinc-800 bg-zinc-900/30 flex flex-col items-center justify-center space-y-2">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Fixed Time Window</span>
                  <div className="text-xl font-extrabold text-blue-400 font-mono">
                    {(timeLeftMs / 1000).toFixed(1)}s
                  </div>
                  {/* Progress bar */}
                  <div className="w-36 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-100 ease-linear"
                      style={{ width: `${(timeLeftMs / 1000) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-300 font-semibold">
                    Usage: <span className={windowCount >= capacity ? 'text-rose-400 font-bold' : 'text-zinc-200'}>{windowCount}</span> / {capacity}
                  </span>
                </div>
              )}
            </div>

            {/* Legend footer */}
            <div className="p-3 border-t border-zinc-850 bg-zinc-950/20 flex items-center justify-center gap-6 z-10 text-[10px] font-bold text-zinc-400">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400/50" />
                <span>Passed Request (200 OK)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs shadow-rose-500/50" />
                <span>Dropped Request (429 Rate Limited)</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
