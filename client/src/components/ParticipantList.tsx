import React from 'react';
import { Participant } from '@watch-party/shared';
import { ShieldIcon, RadioIcon, SparklesIcon } from '../icons';

interface ParticipantListProps {
  participants: Record<string, Participant>;
  currentUserId: string;
  isHost: boolean;
  onTransferHost: (targetUserId: string) => void;
  onNudgeUser: (targetUserId: string) => void;
  onSyncMeToHost: () => void;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  currentUserId,
  isHost,
  onTransferHost,
  onNudgeUser,
  onSyncMeToHost
}) => {
  const list = Object.values(participants).sort((a, b) => {
    if (a.isHost) return -1;
    if (b.isHost) return 1;
    return a.joinedAt - b.joinedAt;
  });

  const getSyncBadge = (p: Participant) => {
    if (!p.connected) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
          Disconnected
        </span>
      );
    }
    if (p.syncStatus === 'buffering') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse">
          Buffering
        </span>
      );
    }
    if (p.syncStatus === 'correcting') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
          Correcting ({p.drift > 0 ? `+${p.drift}` : p.drift}ms)
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        In Sync ({p.rtt}ms)
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
      <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center gap-2">
          <RadioIcon size={16} className="text-brand-400" />
          <h2 className="font-semibold text-sm text-slate-100">Audience</h2>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-medium">
          {list.filter(p => p.connected).length} online
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {list.map(p => {
          const isMe = p.id === currentUserId;

          return (
            <div
              key={p.id}
              className={`p-2.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                isMe
                  ? 'bg-brand-500/10 border-brand-500/30'
                  : 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow relative"
                  style={{ backgroundColor: p.avatarColor || '#6366f1' }}
                >
                  {p.name.charAt(0).toUpperCase()}
                  {p.connected && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-slate-200 truncate">
                      {p.name}
                    </span>
                    {isMe && (
                      <span className="text-[10px] text-brand-400 font-medium">(You)</span>
                    )}
                    {p.isHost && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-300 bg-amber-400/20 px-1.5 py-0.2 rounded border border-amber-400/40">
                        <ShieldIcon size={10} />
                        HOST
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5">{getSyncBadge(p)}</div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!isMe && p.connected && (
                  <button
                    onClick={() => onNudgeUser(p.id)}
                    className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-700/60 transition text-xs"
                    title="Nudge / Ping participant"
                  >
                    👋
                  </button>
                )}

                {isHost && !p.isHost && p.connected && (
                  <button
                    onClick={() => onTransferHost(p.id)}
                    className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700 hover:border-amber-500/40 transition"
                    title="Transfer Host Privileges"
                  >
                    Make Host
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-slate-900/80 border-t border-slate-800/80 flex items-center justify-between">
        <button
          onClick={onSyncMeToHost}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-brand-500/20 active:scale-95 transition"
        >
          <SparklesIcon size={14} />
          <span>Sync Me to Host / Catch Up</span>
        </button>
      </div>
    </div>
  );
};
