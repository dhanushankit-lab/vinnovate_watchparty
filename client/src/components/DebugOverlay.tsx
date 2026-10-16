import React from 'react';
import { SyncEngineMetrics } from '../sync/SyncEngine';

interface DebugOverlayProps {
  metrics: SyncEngineMetrics | null;
  onClose: () => void;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({ metrics, onClose }) => {
  if (!metrics) return null;

  const getRttColor = (rtt: number) => {
    if (rtt < 50) return 'text-emerald-400';
    if (rtt < 150) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getDriftColor = (drift: number) => {
    const abs = Math.abs(drift);
    if (abs < 80) return 'text-emerald-400';
    if (abs < 500) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="absolute top-4 left-4 z-40 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl p-3 shadow-2xl text-xs font-mono text-slate-200 pointer-events-auto max-w-xs">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          <span className="font-semibold text-slate-100 uppercase tracking-wider text-[10px]">Sync Diagnostics</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white px-1 rounded hover:bg-slate-800 transition"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div>
          <span className="text-slate-400">RTT:</span>{' '}
          <span className={`font-bold ${getRttColor(metrics.rtt)}`}>{metrics.rtt} ms</span>
        </div>
        <div>
          <span className="text-slate-400">Offset:</span>{' '}
          <span className="font-bold text-slate-100">{metrics.offset > 0 ? `+${metrics.offset}` : metrics.offset} ms</span>
        </div>

        <div>
          <span className="text-slate-400">Drift:</span>{' '}
          <span className={`font-bold ${getDriftColor(metrics.driftMs)}`}>
            {metrics.driftMs > 0 ? `+${metrics.driftMs}` : metrics.driftMs} ms
          </span>
        </div>
        <div>
          <span className="text-slate-400">Rate:</span>{' '}
          <span className="font-bold text-slate-100">{metrics.playbackRate.toFixed(2)}x</span>
        </div>

        <div>
          <span className="text-slate-400">Actual:</span>{' '}
          <span className="text-slate-200">{metrics.actualPosition.toFixed(2)}s</span>
        </div>
        <div>
          <span className="text-slate-400">Expected:</span>{' '}
          <span className="text-slate-200">{metrics.expectedPosition.toFixed(2)}s</span>
        </div>

        <div className="col-span-2 pt-1 border-t border-slate-800 flex items-center justify-between">
          <span className="text-slate-400">Sync Status:</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
            metrics.syncStatus === 'in_sync'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : metrics.syncStatus === 'correcting'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
          }`}>
            {metrics.syncStatus.replace('_', ' ')}
          </span>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-slate-500 text-center">
        Press <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300">D</kbd> to toggle HUD
      </div>
    </div>
  );
};
