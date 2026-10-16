import React from 'react';
import { Movie, PlaylistItem } from '@watch-party/shared';
import { ArrowUpIcon, XIcon, PlayIcon, SparklesIcon, ListVideoIcon } from '../icons';

interface PlaylistDrawerProps {
  playlist: PlaylistItem[];
  currentIndex: number;
  currentUserId: string;
  canControl: boolean;
  onUpvote: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onReorder: (itemIds: string[]) => void;
  onPlayMovie: (movie: Movie) => void;
  onOpenDiscovery: () => void;
  onClose: () => void;
}

export const PlaylistDrawer: React.FC<PlaylistDrawerProps> = ({
  playlist,
  currentIndex,
  currentUserId,
  canControl,
  onUpvote,
  onRemove,
  onReorder,
  onPlayMovie,
  onOpenDiscovery,
  onClose
}) => {
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= playlist.length) return;
    const items = [...playlist];
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;
    onReorder(items.map(i => i.id));
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/90 backdrop-blur-2xl border-l border-slate-800 w-80 md:w-96 shadow-2xl z-40">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListVideoIcon size={18} className="text-brand-400" />
          <h2 className="font-semibold text-sm text-slate-100">Party Queue</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {playlist.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <XIcon size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {playlist.length === 0 ? (
          <div className="text-center py-12 px-4">
            <ListVideoIcon size={36} className="mx-auto text-slate-600 mb-3" />
            <p className="text-sm text-slate-400 font-medium">The queue is empty</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">Add movies from discovery for auto-play</p>
            <button
              onClick={onOpenDiscovery}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-md transition"
            >
              <SparklesIcon size={14} />
              <span>Browse Catalog</span>
            </button>
          </div>
        ) : (
          playlist.map((item, index) => {
            const isCurrent = index === currentIndex;
            const hasUpvoted = item.upvotes.includes(currentUserId);

            return (
              <div
                key={item.id}
                className={`p-3 rounded-xl border transition flex items-center gap-3 ${
                  isCurrent
                    ? 'bg-brand-500/15 border-brand-500/40 ring-1 ring-brand-500/30'
                    : 'bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/70'
                }`}
              >
                <img
                  src={item.poster}
                  alt={item.title}
                  className="w-12 h-16 object-cover rounded-lg shrink-0 shadow"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isCurrent && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-brand-500 text-white">
                        Playing
                      </span>
                    )}
                    <h3 className="font-semibold text-xs text-slate-100 truncate">
                      {item.title}
                    </h3>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    Added by {item.addedByUserName}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => onUpvote(item.id)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition ${
                        hasUpvoted
                          ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                          : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
                      }`}
                      title="Upvote item to move it higher in queue"
                    >
                      <ArrowUpIcon size={12} className={hasUpvoted ? 'text-pink-400' : ''} />
                      <span>{item.upvotes.length}</span>
                    </button>

                    {canControl && !isCurrent && (
                      <button
                        onClick={() => onPlayMovie({
                          id: item.movieId,
                          title: item.title,
                          year: 2024,
                          genres: [],
                          rating: 8.0,
                          runtime: item.duration,
                          language: 'English',
                          description: '',
                          poster: item.poster,
                          videoUrl: item.videoUrl
                        })}
                        className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        title="Play Now"
                      >
                        <PlayIcon size={14} />
                      </button>
                    )}

                    <div className="flex items-center gap-0.5 ml-auto">
                      <button
                        onClick={() => moveItem(index, 'up')}
                        disabled={index <= 0}
                        className="px-1 py-0.5 text-[10px] text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveItem(index, 'down')}
                        disabled={index >= playlist.length - 1}
                        className="px-1 py-0.5 text-[10px] text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => onRemove(item.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition ml-1"
                        title="Remove from queue"
                      >
                        <XIcon size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <button
          onClick={onOpenDiscovery}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
        >
          <SparklesIcon size={14} className="text-brand-400" />
          <span>Add More Movies to Queue</span>
        </button>
      </div>
    </div>
  );
};
