import React, { useState } from 'react';
import { SceneBookmark } from '@watch-party/shared';
import { BookmarkIcon, XIcon, PlayIcon } from '../icons';

interface ScenesModalProps {
  scenes: SceneBookmark[];
  currentTime: number;
  canControl: boolean;
  onAddScene: (title: string, timestamp: number) => void;
  onSeek: (seconds: number) => void;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const ScenesModal: React.FC<ScenesModalProps> = ({
  scenes,
  currentTime,
  canControl,
  onAddScene,
  onSeek,
  onClose
}) => {
  const [title, setTitle] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddScene(title.trim(), Math.floor(currentTime));
    setTitle('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <BookmarkIcon size={18} className="text-amber-400" />
            <h2 className="font-semibold text-sm text-slate-100">Party Scenes & Bookmarks</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-900/60">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={`Bookmark @ ${formatTime(currentTime)} (e.g. 'Epic jump')...`}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-hidden focus:border-brand-500"
              maxLength={80}
            />
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow transition"
            >
              Add Scene
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {scenes.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No party scene bookmarks saved yet. Add one above!
            </div>
          ) : (
            scenes.map(s => (
              <div
                key={s.id}
                className="p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl flex items-center justify-between hover:bg-slate-800 transition"
              >
                <div>
                  <h4 className="font-semibold text-xs text-slate-100">{s.title}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span className="font-mono text-amber-300 font-bold">{formatTime(s.timestamp)}</span>
                    <span>•</span>
                    <span>by {s.createdByName}</span>
                  </div>
                </div>

                {canControl && (
                  <button
                    onClick={() => {
                      onSeek(s.timestamp);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold transition"
                    title="Jump together to scene"
                  >
                    <PlayIcon size={12} />
                    <span>Jump</span>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
