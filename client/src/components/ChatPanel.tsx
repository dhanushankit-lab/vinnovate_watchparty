import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@watch-party/shared';
import { SendIcon, SparklesIcon, EyeIcon, EyeOffIcon, ClockIcon } from '../icons';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentVideoTime: number;
  typingUsers: string[];
  onSendMessage: (text: string, videoTimestamp?: number) => void;
  onSendTyping: (isTyping: boolean) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  currentVideoTime,
  typingUsers,
  onSendMessage,
  onSendTyping
}) => {
  const [inputText, setInputText] = useState('');
  const [tagTimestamp, setTagTimestamp] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onSendTyping(true);

    typingTimeoutRef.current = setTimeout(() => {
      onSendTyping(false);
    }, 1500);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onSendTyping(false);

    const timestamp = tagTimestamp ? Math.floor(currentVideoTime) : undefined;
    onSendMessage(inputText.trim(), timestamp);
    setInputText('');
  };

  const toggleRevealSpoiler = (msgId: string) => {
    setRevealedSpoilers(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
      <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/80">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <h2 className="font-semibold text-sm text-slate-100">Live Party Chat</h2>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          {messages.length} msgs
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="text-center my-2">
                <span className="inline-block px-3 py-1 bg-slate-800/60 text-slate-400 text-xs rounded-full border border-slate-700/40 font-medium">
                  {msg.text}
                </span>
              </div>
            );
          }

          const isSpoiler =
            msg.videoTimestamp !== undefined &&
            msg.videoTimestamp > currentVideoTime + 2 &&
            !revealedSpoilers.has(msg.id);

          return (
            <div key={msg.id} className="flex items-start gap-2.5 group">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow"
                style={{ backgroundColor: msg.avatarColor || '#6366f1' }}
              >
                {msg.userName.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-semibold text-xs text-slate-200 truncate">
                    {msg.userName}
                  </span>
                  {msg.videoTimestamp !== undefined && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      @{formatTime(msg.videoTimestamp)}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 ml-auto">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {isSpoiler ? (
                  <div
                    onClick={() => toggleRevealSpoiler(msg.id)}
                    className="p-2 rounded-xl bg-slate-800/80 border border-amber-500/40 text-amber-200 text-xs cursor-pointer hover:bg-slate-800 transition flex items-center justify-between"
                  >
                    <span className="italic flex items-center gap-1.5">
                      <EyeOffIcon size={14} className="text-amber-400" />
                      Spoiler alert (@ {formatTime(msg.videoTimestamp!)})
                    </span>
                    <span className="text-[10px] underline text-amber-400">Reveal</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-300 break-words leading-relaxed bg-slate-800/40 p-2 rounded-xl border border-slate-700/30">
                    {msg.text}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="px-4 py-1 text-[11px] text-brand-300 italic flex items-center gap-1 bg-slate-900/40">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          <span>{typingUsers.join(', ')} {typingUsers.length > 1 ? 'are' : 'is'} typing...</span>
        </div>
      )}

      <form onSubmit={handleSend} className="p-3 bg-slate-900/80 border-t border-slate-800/80 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder={tagTimestamp ? `Message @ ${formatTime(currentVideoTime)}...` : "Say something to the room..."}
            className="flex-1 bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-md transition active:scale-95"
            title="Send Message"
          >
            <SendIcon size={16} />
          </button>
        </div>

        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setTagTimestamp(!tagTimestamp)}
            className={`flex items-center gap-1 text-[11px] font-medium transition rounded-md px-1.5 py-0.5 ${
              tagTimestamp
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tag with current video position for spoiler-safe viewing"
          >
            <ClockIcon size={12} />
            <span>Tag timestamp ({formatTime(currentVideoTime)})</span>
          </button>
          <span className="text-[10px] text-slate-500">Enter to send</span>
        </div>
      </form>
    </div>
  );
};
