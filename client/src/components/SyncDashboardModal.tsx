import React from 'react';
import { Participant } from '@watch-party/shared';
import { BarChart2Icon, XIcon, ShieldIcon } from '../icons';

interface SyncDashboardModalProps {
  participants: Record<string, Participant>;
  onClose: () => void;
}

export const SyncDashboardModal: React.FC<SyncDashboardModalProps> = ({
  participants,
  onClose
}) => {
  const list = Object.values(participants).filter(p => p.connected);

  const avgRtt = list.length > 0
    ? Math.round(list.reduce((sum, p) => sum + p.rtt, 0) / list.length)
    : 0;

  const maxDrift = list.length > 0
    ? Math.max(...list.map(p => Math.abs(p.drift)))
    : 0;

  const inSyncCount = list.filter(p => p.syncStatus === 'in_sync').length;
  const inSyncPercent = list.length > 0 ? Math.round((inSyncCount / list.length) * 100) : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <BarChart2Icon size={18} className="text-emerald-400" />
            <h2 className="font-semibold text-sm text-slate-100">Live Sync-Quality Dashboard</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="p-4 grid grid-cols-3 gap-3 border-b border-slate-800 bg-slate-950/20">
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Room Health</span>
            <div className="text-xl font-bold text-emerald-400 mt-1">{inSyncPercent}%</div>
            <span className="text-[10px] text-slate-500">{inSyncCount} / {list.length} in sync</span>
          </div>

          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Average RTT</span>
            <div className="text-xl font-bold text-slate-200 mt-1">{avgRtt} ms</div>
            <span className="text-[10px] text-slate-500">Latency across group</span>
          </div>

          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Max Drift</span>
            <div className="text-xl font-bold text-amber-300 mt-1">{maxDrift} ms</div>
            <span className="text-[10px] text-slate-500">Target &le; 500 ms</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800 pb-2">
                <th className="font-semibold pb-2">Participant</th>
                <th className="font-semibold pb-2">RTT</th>
                <th className="font-semibold pb-2">Drift</th>
                <th className="font-semibold pb-2">Position</th>
                <th className="font-semibold pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {list.map(p => (
                <tr key={p.id} className="hover:bg-slate-800/30">
                  <td className="py-2.5 flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: p.avatarColor || '#6366f1' }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-medium text-slate-200 truncate">{p.name}</span>
                    {p.isHost && (
                      <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1 rounded border border-amber-400/30">
                        Host
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 font-mono text-slate-300">{p.rtt} ms</td>
                  <td className="py-2.5 font-mono text-slate-300">
                    {p.drift > 0 ? `+${p.drift}` : p.drift} ms
                  </td>
                  <td className="py-2.5 font-mono text-slate-400">{p.currentPosition.toFixed(1)}s</td>
                  <td className="py-2.5 text-right">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      p.syncStatus === 'in_sync'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : p.syncStatus === 'correcting'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}>
                      {p.syncStatus.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
