import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Movie,
  Reaction,
  RoomSettings,
  RoomState,
  ServerMessage
} from '@watch-party/shared';
import { getOrCreateIdentity, LocalUser } from './services/identity';
import { ConnectionStatus, WatchPartySocket } from './services/ws';
import { Html5PlayerAdapter } from './player/Html5PlayerAdapter';
import { SyncEngine } from './sync/SyncEngine';
import { LandingPage } from './components/LandingPage';
import { Navbar } from './components/Navbar';
import { VideoPlayer } from './components/VideoPlayer';
import { ChatPanel } from './components/ChatPanel';
import { ParticipantList } from './components/ParticipantList';
import { MovieDiscoveryModal } from './components/MovieDiscoveryModal';
import { PlaylistDrawer } from './components/PlaylistDrawer';
import { PollModal } from './components/PollModal';
import { ScenesModal } from './components/ScenesModal';
import { SyncDashboardModal } from './components/SyncDashboardModal';
import { PostMovieSummaryModal } from './components/PostMovieSummaryModal';
import { ProfileModal } from './components/ProfileModal';

export const App: React.FC = () => {
  const [user, setUser] = useState<LocalUser>(() => getOrCreateIdentity());
  const [roomCode, setRoomCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const roomFromQuery = params.get('room');
    if (roomFromQuery) return roomFromQuery.toUpperCase();

    const path = window.location.pathname;
    if (path.startsWith('/room/')) {
      const code = path.replace('/room/', '').trim();
      if (code) return code.toUpperCase();
    }
    return null;
  });

  const [movies, setMovies] = useState<Movie[]>([]);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [socket, setSocket] = useState<WatchPartySocket | null>(null);
  const [latestReaction, setLatestReaction] = useState<Reaction | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [countdownServerTime, setCountdownServerTime] = useState<number | null>(null);
  const [nudgeNotice, setNudgeNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const [theaterMode, setTheaterMode] = useState<boolean>(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'audience' | null>('chat');

  const [showDiscovery, setShowDiscovery] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [showScenes, setShowScenes] = useState(false);
  const [showSyncDashboard, setShowSyncDashboard] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const syncEngineRef = useRef<SyncEngine | null>(null);

  useEffect(() => {
    fetch('/api/movies')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMovies(data);
      })
      .catch(() => {});
  }, []);

  const handlePlayerReady = useCallback((adapter: Html5PlayerAdapter, engine: SyncEngine) => {
    syncEngineRef.current = engine;
  }, []);

  useEffect(() => {
    if (!roomCode) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setRoomState(null);
      return;
    }

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('room', roomCode);
    window.history.replaceState({}, '', currentUrl.toString());

    const wsClient = new WatchPartySocket(roomCode, user);
    setSocket(wsClient);

    const unbindStatus = wsClient.onStatus(status => {
      setConnectionStatus(status);
    });

    const unbindMsg = wsClient.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'room_snapshot':
          setRoomState(msg.state);
          break;

        case 'ntp_pong':
          if (syncEngineRef.current) {
            syncEngineRef.current.handleNtpPong(msg.clientSendTime, msg.serverReceiveTime, msg.serverSendTime);
          }
          break;

        case 'playback_update':
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              playback: msg.playback,
              version: msg.version
            };
          });
          break;

        case 'participant_joined':
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              participants: {
                ...prev.participants,
                [msg.participant.id]: msg.participant
              }
            };
          });
          break;

        case 'participant_updated':
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              participants: {
                ...prev.participants,
                [msg.participant.id]: msg.participant
              }
            };
          });
          break;

        case 'participant_left':
          setRoomState(prev => {
            if (!prev) return prev;
            const updated = { ...prev.participants };
            if (updated[msg.userId]) {
              updated[msg.userId] = {
                ...updated[msg.userId],
                connected: false
              };
            }
            return {
              ...prev,
              hostId: msg.newHostId || prev.hostId,
              participants: updated
            };
          });
          break;

        case 'chat_message':
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              recentChat: [...prev.recentChat, msg.message]
            };
          });
          if (activeSidebarTab !== 'chat') {
            setUnreadChatCount(c => c + 1);
          }
          break;

        case 'user_typing':
          setTypingUsers(prev => {
            if (msg.isTyping) {
              return prev.includes(msg.userName) ? prev : [...prev, msg.userName];
            } else {
              return prev.filter(name => name !== msg.userName);
            }
          });
          break;

        case 'reaction_broadcast':
          setLatestReaction(msg.reaction);
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              reactionsHeatmap: {
                ...prev.reactionsHeatmap,
                [msg.heatmapBucket]: msg.heatmapCount
              }
            };
          });
          break;

        case 'playlist_update':
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              playlist: msg.playlist,
              currentPlaylistIndex: msg.currentPlaylistIndex
            };
          });
          break;

        case 'poll_update':
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              activePoll: msg.poll
            };
          });
          break;

        case 'scenes_update':
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              scenes: msg.scenes
            };
          });
          break;

        case 'settings_update':
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              settings: msg.settings
            };
          });
          break;

        case 'countdown_start':
          setCountdownServerTime(msg.startsAtServerTime);
          break;

        case 'nudge_received':
          setNudgeNotice(`${msg.fromUserName} gave you a wave! 👋`);
          setTimeout(() => setNudgeNotice(null), 3000);
          break;

        case 'error':
          setErrorNotice(msg.message);
          setTimeout(() => setErrorNotice(null), 4000);
          break;
      }
    });

    wsClient.connect();

    return () => {
      unbindStatus();
      unbindMsg();
      wsClient.disconnect();
    };
  }, [roomCode, user.id]);

  const handleCreateRoom = async (movieId?: string) => {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: user.id, movieId })
      });
      const data = await res.json();
      if (data.code) {
        setRoomCode(data.code);
      }
    } catch {}
  };

  const handleJoinRoom = (code: string) => {
    setRoomCode(code.trim().toUpperCase());
  };

  const handleLeaveRoom = () => {
    if (socket) socket.disconnect();
    setSocket(null);
    setRoomCode(null);
    setRoomState(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.pathname);
  };

  const isHost = roomState ? roomState.hostId === user.id : false;
  const canControl = isHost || (roomState?.settings.controlMode === 'everyone');

  const currentMovie: Movie = (roomState && movies.find(m => m.id === roomState.playback.videoId)) || {
    id: roomState?.playback.videoId || 'big-buck-bunny',
    title: roomState?.playback.title || 'Big Buck Bunny',
    year: 2008,
    genres: ['Animation', 'Comedy'],
    rating: 7.8,
    runtime: 596,
    language: 'English',
    description: 'An iconic open-source animated short film.',
    poster: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/600px-Big_buck_bunny_poster_big.jpg',
    videoUrl: roomState?.playback.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  };

  if (!roomCode) {
    return (
      <LandingPage
        userName={user.name}
        avatarColor={user.avatarColor}
        movies={movies}
        onUpdateUser={(name, color) => setUser({ ...user, name, avatarColor: color })}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Navbar
        roomCode={roomCode}
        isHost={isHost}
        participantCount={roomState ? Object.values(roomState.participants).filter(p => p.connected).length : 1}
        unreadChatCount={unreadChatCount}
        playlistCount={roomState?.playlist.length || 0}
        activePollCount={roomState?.activePoll?.isActive ? 1 : 0}
        settings={roomState?.settings || { controlMode: 'everyone', pauseOnBuffering: false, maxParticipants: 50 }}
        userName={user.name}
        avatarColor={user.avatarColor}
        activeSidebarTab={activeSidebarTab}
        onToggleSidebarTab={tab => {
          if (activeSidebarTab === tab) {
            setActiveSidebarTab(null);
          } else {
            setActiveSidebarTab(tab);
            if (tab === 'chat') setUnreadChatCount(0);
          }
        }}
        onOpenDiscovery={() => setShowDiscovery(true)}
        onOpenPlaylist={() => setShowPlaylist(true)}
        onOpenPolls={() => setShowPolls(true)}
        onOpenScenes={() => setShowScenes(true)}
        onOpenSyncDashboard={() => setShowSyncDashboard(true)}
        onOpenSummary={() => setShowSummary(true)}
        onOpenProfile={() => setShowProfile(true)}
        onUpdateSettings={s => socket?.updateSettings(s)}
        onLeaveRoom={handleLeaveRoom}
      />

      {connectionStatus !== 'connected' && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-200 text-xs py-1 px-4 text-center font-medium flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>
            {connectionStatus === 'reconnecting'
              ? 'Reconnecting to party room... synchronizing state'
              : 'Connecting to room...'}
          </span>
        </div>
      )}

      {nudgeNotice && (
        <div className="fixed top-20 right-6 z-50 bg-gradient-to-r from-brand-600 to-pink-600 text-white font-bold text-xs px-4 py-2.5 rounded-2xl shadow-2xl animate-bounce">
          {nudgeNotice}
        </div>
      )}

      {errorNotice && (
        <div className="fixed top-20 right-6 z-50 bg-rose-600 text-white font-bold text-xs px-4 py-2.5 rounded-2xl shadow-2xl">
          ⚠️ {errorNotice}
        </div>
      )}

      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        <div className="flex-1 flex flex-col justify-center items-center min-w-0">
          {roomState && (
            <VideoPlayer
              movie={currentMovie}
              playback={roomState.playback}
              scenes={roomState.scenes}
              reactionsHeatmap={roomState.reactionsHeatmap}
              latestReaction={latestReaction}
              isHost={isHost}
              canControl={canControl}
              startsAtServerTime={countdownServerTime}
              theaterMode={theaterMode}
              onPlay={() => socket?.play()}
              onPause={() => socket?.pause()}
              onSeek={seconds => socket?.seek(seconds)}
              onStartCountdown={secs => socket?.startCountdown(secs)}
              onSendReaction={emoji => {
                const pos = syncEngineRef.current ? syncEngineRef.current['player']?.getCurrentTime() || 0 : 0;
                socket?.sendReaction(emoji, pos);
              }}
              onToggleTheater={() => setTheaterMode(!theaterMode)}
              onCountdownFinish={() => setCountdownServerTime(null)}
              sendPing={time => socket?.send({ type: 'ntp_ping', clientSendTime: time })}
              sendSyncReport={rep => socket?.send({ type: 'sync_report', report: rep })}
              onPlayerReady={handlePlayerReady}
            />
          )}

          <div className="w-full mt-3 flex items-center justify-between text-xs text-slate-400 px-2">
            <div>
              <span className="font-bold text-slate-200">{currentMovie.title}</span> ({currentMovie.year})
              <span className="mx-2">•</span>
              <span>{currentMovie.genres.join(', ')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span>Shortcuts: <kbd className="px-1 py-0.5 bg-slate-800 rounded">Space</kbd> Play/Pause, <kbd className="px-1 py-0.5 bg-slate-800 rounded">D</kbd> HUD, <kbd className="px-1 py-0.5 bg-slate-800 rounded">F</kbd> Fullscreen</span>
            </div>
          </div>
        </div>

        {activeSidebarTab && (
          <aside className="w-80 md:w-96 shrink-0 h-full">
            {activeSidebarTab === 'chat' && (
              <ChatPanel
                messages={roomState?.recentChat || []}
                currentVideoTime={roomState?.playback.positionAtRef || 0}
                typingUsers={typingUsers}
                onSendMessage={(text, ts) => socket?.sendChat(text, ts)}
                onSendTyping={isTyping => socket?.sendTyping(isTyping)}
              />
            )}
            {activeSidebarTab === 'audience' && roomState && (
              <ParticipantList
                participants={roomState.participants}
                currentUserId={user.id}
                isHost={isHost}
                onTransferHost={targetId => socket?.transferHost(targetId)}
                onNudgeUser={targetId => socket?.nudgeUser(targetId)}
                onSyncMeToHost={() => syncEngineRef.current?.syncMeToHost()}
              />
            )}
          </aside>
        )}
      </main>

      {showDiscovery && (
        <MovieDiscoveryModal
          movies={movies}
          currentMovie={currentMovie}
          canControl={canControl}
          onPlayMovie={m => {
            socket?.setVideo(m);
            setShowDiscovery(false);
          }}
          onAddToQueue={m => {
            socket?.addToPlaylist(m);
            setShowDiscovery(false);
          }}
          onClose={() => setShowDiscovery(false)}
        />
      )}

      {showPlaylist && roomState && (
        <div className="fixed inset-y-0 right-0 z-50">
          <PlaylistDrawer
            playlist={roomState.playlist}
            currentIndex={roomState.currentPlaylistIndex}
            currentUserId={user.id}
            canControl={canControl}
            onUpvote={id => socket?.upvotePlaylistItem(id)}
            onRemove={id => socket?.removeFromPlaylist(id)}
            onReorder={ids => socket?.reorderPlaylist(ids)}
            onPlayMovie={m => socket?.setVideo(m)}
            onOpenDiscovery={() => {
              setShowPlaylist(false);
              setShowDiscovery(true);
            }}
            onClose={() => setShowPlaylist(false)}
          />
        </div>
      )}

      {showPolls && (
        <PollModal
          activePoll={roomState?.activePoll || null}
          movies={movies}
          currentUserId={user.id}
          isHost={isHost}
          onCreatePoll={(q, opts, dur) => {
            socket?.createPoll(q, opts, dur);
            setShowPolls(false);
          }}
          onVote={(pId, oId) => socket?.votePoll(pId, oId)}
          onEndPoll={pId => socket?.endPoll(pId)}
          onClose={() => setShowPolls(false)}
        />
      )}

      {showScenes && roomState && (
        <ScenesModal
          scenes={roomState.scenes}
          currentTime={roomState.playback.positionAtRef}
          canControl={canControl}
          onAddScene={(title, ts) => socket?.addScene(title, ts)}
          onSeek={seconds => socket?.seek(seconds)}
          onClose={() => setShowScenes(false)}
        />
      )}

      {showSyncDashboard && roomState && (
        <SyncDashboardModal
          participants={roomState.participants}
          onClose={() => setShowSyncDashboard(false)}
        />
      )}

      {showSummary && roomState && (
        <PostMovieSummaryModal
          movie={currentMovie}
          chatMessages={roomState.recentChat}
          reactionsCount={Object.values(roomState.reactionsHeatmap).reduce((a, b) => a + b, 0)}
          reactionsHeatmap={roomState.reactionsHeatmap}
          roomCode={roomCode}
          onClose={() => setShowSummary(false)}
        />
      )}

      {showProfile && (
        <ProfileModal
          currentName={user.name}
          currentColor={user.avatarColor}
          onSave={(name, color) => setUser({ ...user, name, avatarColor: color })}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
};
