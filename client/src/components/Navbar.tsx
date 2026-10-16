import React, { useState } from 'react';
import { RoomSettings } from '@watch-party/shared';
import {
  PlayIcon,
  CopyIcon,
  CheckIcon,
  UsersIcon,
  MessageSquareIcon,
  ListVideoIcon,
  VoteIcon,
  SparklesIcon,
  BarChart2Icon,
  BookmarkIcon,
  ShieldIcon,
  SettingsIcon
} from '../icons';

interface NavbarProps {
  roomCode: string;
  isHost: boolean;
  participantCount: number;
  unreadChatCount: number;
  playlistCount: number;
  activePollCount: number;
  settings: RoomSettings;
  userName: string;
  avatarColor: string;
  activeSidebarTab: 'chat' | 'audience' | null;
  onToggleSidebarTab: (tab: 'chat' | 'audience') => void;
  onOpenDiscovery: () => void;
  onOpenPlaylist: () => void;
  onOpenPolls: () => void;
  onOpenScenes: () => void;
  onOpenSyncDashboard: () => void;
  onOpenSummary: () => void;
  onOpenProfile: () => void;
  onUpdateSettings: (settings: Partial<RoomSettings>) => void;
  onLeaveRoom: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomCode,
  isHost,
  participantCount,
  unreadChatCount,
  playlistCount,
  activePollCount,
  settings,
  userName,
  avatarColor,
  activeSidebarTab,
  onToggleSidebarTab,
  onOpenDiscovery,
  onOpenPlaylist,
  onOpenPolls,
  onOpenScenes,
  onOpenSyncDashboard,
  onOpenSummary,
  onOpenProfile,
  onUpdateSettings,
  onLeaveRoom
}) => {
  const [copied, setCopied] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-16 px-4 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 flex items-center justify-between shrink-0 z-30 select-none">
      <div className="flex items-center gap-3">
        <div
          onClick={onLeaveRoom}
          className="flex items-center gap-2 cursor-pointer group"
          title="Return to Home"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-brand-500/30 group-hover:scale-105 transition">
            <PlayIcon size={16} />
          </div>
          <span className="font-black text-base tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent hidden sm:inline">
            WatchParty
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-700/60 rounded-xl px-2.5 py-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Room:</span>
          <span className="text-xs font-black font-mono text-brand-300">{roomCode}</span>
          <button
            onClick={handleCopyLink}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1"
            title="Copy invite link to share with friends"
          >
            {copied ? <CheckIcon size={13} className="text-emerald-400" /> : <CopyIcon size={13} />}
          </button>
        </div>

        {isHost && (
          <span className="hidden md:flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">
            <ShieldIcon size={12} />
            <span>Host Controls Active</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenDiscovery}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition active:scale-95"
          title="Browse 60+ movies"
        >
          <SparklesIcon size={14} className="text-amber-300" />
          <span className="hidden sm:inline">Movies</span>
        </button>

        <button
          onClick={onOpenPlaylist}
          className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-750 transition"
          title="Collaborative Queue"
        >
          <ListVideoIcon size={18} />
          {playlistCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-500 text-[9px] font-bold text-white flex items-center justify-center">
              {playlistCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenPolls}
          className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-750 transition"
          title="Group Polls"
        >
          <VoteIcon size={18} />
          {activePollCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping" />
          )}
        </button>

        <button
          onClick={onOpenScenes}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-750 transition"
          title="Party Scenes & Bookmarks"
        >
          <BookmarkIcon size={18} />
        </button>

        {isHost && (
          <button
            onClick={onOpenSyncDashboard}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-750 transition"
            title="Host Sync Quality Dashboard"
          >
            <BarChart2Icon size={18} className="text-emerald-400" />
          </button>
        )}

        <button
          onClick={onOpenSummary}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-750 transition"
          title="Watch Party Recap Card"
        >
          <SparklesIcon size={18} className="text-pink-400" />
        </button>

        <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />

        <button
          onClick={() => onToggleSidebarTab('audience')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition text-xs font-semibold ${
            activeSidebarTab === 'audience'
              ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
              : 'text-slate-300 hover:text-white bg-slate-800/60 border-slate-700/40'
          }`}
          title="Audience List"
        >
          <UsersIcon size={16} />
          <span>{participantCount}</span>
        </button>

        <button
          onClick={() => onToggleSidebarTab('chat')}
          className={`relative p-2 rounded-xl border transition ${
            activeSidebarTab === 'chat'
              ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
              : 'text-slate-300 hover:text-white bg-slate-800/60 border-slate-700/40'
          }`}
          title="Live Chat"
        >
          <MessageSquareIcon size={18} />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
              {unreadChatCount}
            </span>
          )}
        </button>

        {isHost && (
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Room Host Settings"
            >
              <SettingsIcon size={18} />
            </button>

            {showSettingsMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 text-xs text-slate-200 space-y-3">
                <div className="font-bold text-slate-100 pb-1 border-b border-slate-800">
                  Room Settings
                </div>

                <div>
                  <span className="text-slate-400 block mb-1">Playback Control:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => onUpdateSettings({ controlMode: 'everyone' })}
                      className={`p-1.5 rounded-lg border text-center font-medium ${
                        settings.controlMode === 'everyone'
                          ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      Everyone
                    </button>
                    <button
                      onClick={() => onUpdateSettings({ controlMode: 'host_only' })}
                      className={`p-1.5 rounded-lg border text-center font-medium ${
                        settings.controlMode === 'host_only'
                          ? 'bg-brand-500/20 text-brand-300 border-brand-500/40'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      Host Only
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400">Pause on Buffer:</span>
                  <input
                    type="checkbox"
                    checked={settings.pauseOnBuffering}
                    onChange={e => onUpdateSettings({ pauseOnBuffering: e.target.checked })}
                    className="accent-brand-500 w-4 h-4 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onOpenProfile}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow ring-2 ring-slate-700 hover:ring-brand-400 transition"
          style={{ backgroundColor: avatarColor }}
          title={`Profile: ${userName}`}
        >
          {userName.charAt(0).toUpperCase()}
        </button>
      </div>
    </header>
  );
};
