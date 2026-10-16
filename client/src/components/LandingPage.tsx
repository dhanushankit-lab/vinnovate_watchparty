import React, { useState } from 'react';
import { Movie } from '@watch-party/shared';
import { AVATAR_COLORS } from '../services/identity';
import { PlayIcon, SparklesIcon, UsersIcon, ShieldIcon, RadioIcon, ChevronRightIcon } from '../icons';

interface LandingPageProps {
  userName: string;
  avatarColor: string;
  movies: Movie[];
  onUpdateUser: (name: string, color: string) => void;
  onCreateRoom: (movieId?: string) => void;
  onJoinRoom: (code: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  userName,
  avatarColor,
  movies,
  onUpdateUser,
  onCreateRoom,
  onJoinRoom
}) => {
  const [name, setName] = useState(userName);
  const [color, setColor] = useState(avatarColor);
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleNameBlur = () => {
    if (name.trim()) {
      onUpdateUser(name.trim(), color);
    }
  };

  const handleColorPick = (c: string) => {
    setColor(c);
    onUpdateUser(name.trim() || userName, c);
  };

  const handleCreate = async (movieId?: string) => {
    setIsCreating(true);
    try {
      await onCreateRoom(movieId);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onJoinRoom(joinCode.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden relative selection:bg-brand-500">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-brand-600/20 via-pink-500/10 to-transparent blur-3xl pointer-events-none -z-10" />

      <header className="h-20 px-6 max-w-7xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/30">
            <PlayIcon size={20} />
          </div>
          <span className="font-black text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            WatchParty
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
            style={{ backgroundColor: color }}
          >
            {(name || 'U').charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-medium text-slate-300 hidden sm:inline">{name}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-6 py-10 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-4">
            <RadioIcon size={14} className="text-brand-400 animate-pulse" />
            <span>Real-Time Sub-Second Synchronized Playback</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
            Watch Movies Together <br />
            <span className="bg-gradient-to-r from-brand-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
              In Perfect Lockstep.
            </span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
            Experience movies with friends without countdown drift. NTP-driven synchronization, collaborative queue, live reactions, group polls, and spoiler-safe chat.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full mb-16">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-400 flex items-center justify-center mb-4">
                <SparklesIcon size={24} />
              </div>
              <h2 className="text-xl font-bold text-white">Host a Watch Party</h2>
              <p className="text-xs text-slate-400 mt-1 mb-6">
                Instant room creation with shareable link, custom video player, and host controls.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Your Display Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onBlur={handleNameBlur}
                    placeholder="Enter your name"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-hidden focus:border-brand-500"
                    maxLength={30}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Avatar Color
                  </label>
                  <div className="flex gap-2">
                    {AVATAR_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleColorPick(c)}
                        className={`w-7 h-7 rounded-full transition-transform ${
                          color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleCreate()}
              disabled={isCreating}
              className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-pink-600 hover:from-brand-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-brand-500/25 active:scale-98 transition flex items-center justify-center gap-2"
            >
              <PlayIcon size={16} />
              <span>{isCreating ? 'Creating Room...' : 'Start New Watch Party'}</span>
            </button>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-pink-500/20 text-pink-400 flex items-center justify-center mb-4">
                <UsersIcon size={24} />
              </div>
              <h2 className="text-xl font-bold text-white">Join an Existing Room</h2>
              <p className="text-xs text-slate-400 mt-1 mb-6">
                Enter a room code or paste the shareable link to hop into a session.
              </p>

              <form onSubmit={handleJoinSubmit} className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Room Code
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. K7QX-92"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono tracking-widest focus:outline-hidden focus:border-brand-500 uppercase"
                    maxLength={10}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={!joinCode.trim()}
                  className="w-full py-3 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold text-sm border border-slate-700 active:scale-98 transition flex items-center justify-center gap-2"
                >
                  <span>Join Watch Party</span>
                  <ChevronRightIcon size={16} />
                </button>
              </form>
            </div>

            <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-xs text-slate-400 space-y-2">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <ShieldIcon size={14} className="text-amber-400" />
                <span>Zero Latency Clock Sync</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                NTP ping/pong filters network jitter and eliminates playback drift automatically without pauses.
              </p>
            </div>
          </div>
        </div>

        {movies.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-slate-300 uppercase tracking-wider">
                Ready to stream without API keys
              </h3>
              <span className="text-xs text-slate-500">{movies.length} titles in local catalog</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {movies.slice(0, 6).map(m => (
                <div
                  key={m.id}
                  onClick={() => handleCreate(m.id)}
                  className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-brand-500/80 transition-all cursor-pointer shadow-md"
                >
                  <img src={m.poster} alt={m.title} className="w-full h-36 object-cover group-hover:scale-105 transition-transform" />
                  <div className="p-2">
                    <h4 className="font-bold text-xs text-slate-200 truncate group-hover:text-brand-300 transition">
                      {m.title}
                    </h4>
                    <span className="text-[10px] text-slate-400">⭐ {m.rating} • {m.year}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="h-16 border-t border-slate-800/80 flex items-center justify-center text-xs text-slate-500">
        <span>WatchParty • Real-Time Synchronized Cinema • High Reliability Sync Engine</span>
      </footer>
    </div>
  );
};
