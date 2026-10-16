import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { ChatMessage, Movie, Reaction } from '@watch-party/shared';
import { SparklesIcon, XIcon, CopyIcon, CheckIcon } from '../icons';

interface PostMovieSummaryModalProps {
  movie: Movie;
  chatMessages: ChatMessage[];
  reactionsCount: number;
  reactionsHeatmap: Record<number, number>;
  roomCode: string;
  onClose: () => void;
}

export const PostMovieSummaryModal: React.FC<PostMovieSummaryModalProps> = ({
  movie,
  chatMessages,
  reactionsCount,
  roomCode,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {}
  }, []);

  const chatterCounts: Record<string, { count: number; color: string }> = {};
  for (const msg of chatMessages) {
    if (msg.isSystem) continue;
    if (!chatterCounts[msg.userName]) {
      chatterCounts[msg.userName] = { count: 0, color: msg.avatarColor };
    }
    chatterCounts[msg.userName].count++;
  }

  const topChatter = Object.entries(chatterCounts).sort((a, b) => b[1].count - a[1].count)[0];

  const handleShare = () => {
    const text = `🎉 We just watched "${movie.title}" together on Watch Party!\nRoom: ${roomCode}\nMessages: ${chatMessages.length}\nReactions: ${reactionsCount}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-center p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <XIcon size={18} />
        </button>

        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-brand-500 to-pink-500 flex items-center justify-center shadow-lg shadow-brand-500/30 mb-3">
          <SparklesIcon size={32} className="text-white" />
        </div>

        <h2 className="text-2xl font-black text-slate-100">Watch Party Recap!</h2>
        <p className="text-xs text-slate-400 mt-1">"{movie.title}"</p>

        <div className="grid grid-cols-2 gap-3 my-6 text-left">
          <div className="p-3 bg-slate-800/50 border border-slate-700/40 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Reactions</span>
            <div className="text-xl font-black text-pink-400 mt-1">
              🔥 {reactionsCount}
            </div>
            <span className="text-[10px] text-slate-500">Shared hype</span>
          </div>

          <div className="p-3 bg-slate-800/50 border border-slate-700/40 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Messages</span>
            <div className="text-xl font-black text-brand-400 mt-1">
              💬 {chatMessages.filter(m => !m.isSystem).length}
            </div>
            <span className="text-[10px] text-slate-500">Live conversation</span>
          </div>

          <div className="col-span-2 p-3 bg-slate-800/50 border border-slate-700/40 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Top Chatter MVP</span>
              <div className="text-sm font-bold text-slate-100 mt-0.5">
                {topChatter ? topChatter[0] : 'Everyone'}
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30">
              👑 {topChatter ? `${topChatter[1].count} msgs` : 'Co-stars'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-500/20 active:scale-95 transition"
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            <span>{copied ? 'Copied to Clipboard!' : 'Share Party Stats'}</span>
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
