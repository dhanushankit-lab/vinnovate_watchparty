import React, { useState, useEffect } from 'react';
import { Reaction } from '@watch-party/shared';

interface FloatingReaction {
  id: string;
  emoji: string;
  left: number;
}

interface ReactionsOverlayProps {
  latestReaction: Reaction | null;
  onSendReaction: (emoji: string) => void;
}

const EMOJI_PRESETS = ['❤️', '🔥', '😂', '👏', '🍿', '😱', '🚀', '🤯'];

export const ReactionsOverlay: React.FC<ReactionsOverlayProps> = ({
  latestReaction,
  onSendReaction
}) => {
  const [floatingList, setFloatingList] = useState<FloatingReaction[]>([]);
  const [lastSentTime, setLastSentTime] = useState<number>(0);

  useEffect(() => {
    if (!latestReaction) return;

    const id = `${latestReaction.id}-${Date.now()}`;
    const left = 15 + Math.random() * 70;

    setFloatingList(prev => [...prev.slice(-25), { id, emoji: latestReaction.emoji, left }]);

    const timer = setTimeout(() => {
      setFloatingList(prev => prev.filter(item => item.id !== id));
    }, 2500);

    return () => clearTimeout(timer);
  }, [latestReaction]);

  const handleEmojiClick = (emoji: string) => {
    const now = Date.now();
    if (now - lastSentTime < 200) return;
    setLastSentTime(now);
    onSendReaction(emoji);
  };

  return (
    <>
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
        {floatingList.map(item => (
          <div
            key={item.id}
            className="absolute bottom-16 text-3xl md:text-4xl animate-float-up drop-shadow-lg select-none"
            style={{ left: `${item.left}%` }}
          >
            {item.emoji}
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 right-4 z-40 flex items-center gap-1 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-full px-2 py-1 shadow-xl">
        {EMOJI_PRESETS.map(emoji => (
          <button
            key={emoji}
            onClick={() => handleEmojiClick(emoji)}
            className="hover:scale-130 active:scale-95 transition text-lg md:text-xl p-1 rounded-full hover:bg-slate-800"
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
};
