import React, { useState, useEffect } from 'react';
import { Movie, Poll } from '@watch-party/shared';
import { VoteIcon, XIcon, ClockIcon, SparklesIcon } from '../icons';

interface PollModalProps {
  activePoll: Poll | null;
  movies: Movie[];
  currentUserId: string;
  isHost: boolean;
  onCreatePoll: (question: string, options: { text: string; movieId?: string }[], durationSeconds?: number) => void;
  onVote: (pollId: string, optionId: string) => void;
  onEndPoll: (pollId: string) => void;
  onClose: () => void;
}

export const PollModal: React.FC<PollModalProps> = ({
  activePoll,
  movies,
  currentUserId,
  isHost,
  onCreatePoll,
  onVote,
  onEndPoll,
  onClose
}) => {
  const [question, setQuestion] = useState('What movie should we watch next?');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [duration, setDuration] = useState<number>(60);
  const [selectedMovieIds, setSelectedMovieIds] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!activePoll || !activePoll.expiresAt) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((activePoll.expiresAt! - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 500);

    return () => clearInterval(interval);
  }, [activePoll]);

  const addOptionField = () => {
    if (options.length < 6) setOptions([...options, '']);
  };

  const handleOptionChange = (idx: number, val: string) => {
    const next = [...options];
    next[idx] = val;
    setOptions(next);
  };

  const handlePickMovie = (movie: Movie) => {
    if (options.filter(o => o.trim()).length >= 6) return;
    setOptions(prev => [...prev.filter(o => o.trim()), movie.title]);
    setSelectedMovieIds(prev => [...prev, movie.id]);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = options.filter(o => o.trim()).map(text => {
      const match = movies.find(m => m.title === text);
      return { text, movieId: match?.id };
    });
    if (valid.length < 2) return;
    onCreatePoll(question.trim(), valid, duration);
  };

  const totalVotes = activePoll
    ? activePoll.options.reduce((sum, opt) => sum + opt.votes.length, 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <VoteIcon size={20} className="text-brand-400" />
            <h2 className="font-semibold text-base text-slate-100">
              {activePoll ? 'Group Poll' : 'Create Room Poll'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activePoll ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-100">
                  {activePoll.question}
                </h3>
                {timeLeft !== null && (
                  <span className="flex items-center gap-1 text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                    <ClockIcon size={12} />
                    {timeLeft}s
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400">
                Created by {activePoll.createdByName} • {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} total
              </p>

              <div className="space-y-3 mt-4">
                {activePoll.options.map(opt => {
                  const hasVoted = opt.votes.includes(currentUserId);
                  const percentage = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;

                  return (
                    <div
                      key={opt.id}
                      onClick={() => activePoll.isActive && onVote(activePoll.id, opt.id)}
                      className={`relative overflow-hidden p-3 rounded-xl border transition cursor-pointer select-none ${
                        hasVoted
                          ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
                          : 'border-slate-700/60 bg-slate-800/40 hover:bg-slate-800/80'
                      }`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-brand-500/20 transition-all duration-500 rounded-l-xl pointer-events-none"
                        style={{ width: `${percentage}%` }}
                      />

                      <div className="relative flex items-center justify-between text-xs font-medium text-slate-200">
                        <span className="flex items-center gap-2">
                          {hasVoted && <span className="w-2 h-2 rounded-full bg-brand-400" />}
                          <span className="font-semibold text-slate-100">{opt.text}</span>
                        </span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-400">{opt.votes.length} votes</span>
                          <span className="font-bold text-brand-300 w-9 text-right">{percentage}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {isHost && activePoll.isActive && (
                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => onEndPoll(activePoll.id)}
                    className="px-4 py-2 bg-rose-600/80 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow transition"
                  >
                    End Poll Now
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Poll Question
                </label>
                <input
                  type="text"
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Options
                </label>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <input
                      key={i}
                      type="text"
                      value={opt}
                      onChange={e => handleOptionChange(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-brand-500"
                    />
                  ))}
                </div>
                {options.length < 6 && (
                  <button
                    type="button"
                    onClick={addOptionField}
                    className="mt-2 text-xs text-brand-400 hover:text-brand-300 font-medium"
                  >
                    + Add Another Option
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Quick Suggest from Catalog
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {movies.slice(0, 8).map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handlePickMovie(m)}
                      className="shrink-0 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] border border-slate-700 flex items-center gap-1"
                    >
                      <SparklesIcon size={12} className="text-amber-400" />
                      <span>{m.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Timer Duration
                </label>
                <select
                  value={duration}
                  onChange={e => setDuration(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-brand-500"
                >
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={120}>2 minutes</option>
                  <option value={300}>5 minutes</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-500/20 transition"
                >
                  Start Poll
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
