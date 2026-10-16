import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Movie, Reaction, RoomPlaybackState, SceneBookmark } from '@watch-party/shared';
import { Html5PlayerAdapter } from '../player/Html5PlayerAdapter';
import { SyncEngine, SyncEngineMetrics } from '../sync/SyncEngine';
import {
  PlayIcon,
  PauseIcon,
  Volume2Icon,
  VolumeXIcon,
  MaximizeIcon,
  MinimizeIcon,
  TvIcon,
  SparklesIcon,
  FlameIcon,
  ClockIcon
} from '../icons';
import { TimelineHeatmap } from './TimelineHeatmap';
import { CountdownOverlay } from './CountdownOverlay';
import { DebugOverlay } from './DebugOverlay';
import { ReactionsOverlay } from './ReactionsOverlay';

interface VideoPlayerProps {
  movie: Movie;
  playback: RoomPlaybackState;
  scenes: SceneBookmark[];
  reactionsHeatmap: Record<number, number>;
  latestReaction: Reaction | null;
  isHost: boolean;
  canControl: boolean;
  startsAtServerTime: number | null;
  theaterMode: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (seconds: number) => void;
  onStartCountdown: (seconds: number) => void;
  onSendReaction: (emoji: string) => void;
  onToggleTheater: () => void;
  onCountdownFinish: () => void;
  sendPing: (clientSendTime: number) => void;
  sendSyncReport?: (report: { rtt: number; drift: number; position: number; syncStatus: any }) => void;
  onPlayerReady?: (adapter: Html5PlayerAdapter, syncEngine: SyncEngine) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  movie,
  playback,
  scenes,
  reactionsHeatmap,
  latestReaction,
  isHost,
  canControl,
  startsAtServerTime,
  theaterMode,
  onPlay,
  onPause,
  onSeek,
  onStartCountdown,
  onSendReaction,
  onToggleTheater,
  onCountdownFinish,
  sendPing,
  sendSyncReport,
  onPlayerReady
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<Html5PlayerAdapter | null>(null);
  const syncEngineRef = useRef<SyncEngine | null>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [ambientGlow, setAmbientGlow] = useState<boolean>(true);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [syncMetrics, setSyncMetrics] = useState<SyncEngineMetrics | null>(null);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const adapter = new Html5PlayerAdapter();
    adapter.attach(videoRef.current);
    adapterRef.current = adapter;

    const syncEngine = new SyncEngine(adapter, sendPing, sendSyncReport);
    syncEngineRef.current = syncEngine;
    syncEngine.start();

    const unbindMetrics = syncEngine.onMetrics(metrics => {
      setSyncMetrics(metrics);
      setCurrentTime(metrics.actualPosition);
    });

    const unbindTime = adapter.on('timeupdate', () => {
      setCurrentTime(adapter.getCurrentTime());
      setDuration(adapter.getDuration());
    });

    const unbindPlay = adapter.on('play', () => setIsPlaying(true));
    const unbindPause = adapter.on('pause', () => setIsPlaying(false));
    const unbindWait = adapter.on('waiting', () => setIsBuffering(true));
    const unbindPlaying = adapter.on('playing', () => setIsBuffering(false));
    const unbindCanPlay = adapter.on('canplay', () => setIsBuffering(false));

    if (onPlayerReady) {
      onPlayerReady(adapter, syncEngine);
    }

    return () => {
      unbindMetrics();
      unbindTime();
      unbindPlay();
      unbindPause();
      unbindWait();
      unbindPlaying();
      unbindCanPlay();
      syncEngine.stop();
      adapter.detach();
    };
  }, [movie.videoUrl]);

  useEffect(() => {
    if (syncEngineRef.current) {
      syncEngineRef.current.applyPlaybackState(playback);
    }
  }, [playback]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const togglePlay = useCallback(() => {
    if (!canControl) return;
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  }, [canControl, isPlaying, onPause, onPlay]);

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    videoRef.current.muted = next;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const handleSeekChange = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canControl || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = percent * duration;
    onSeek(target);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {}
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'KeyD') {
        e.preventDefault();
        setShowDebug(prev => !prev);
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        onToggleTheater();
      } else if (e.code === 'ArrowLeft' && canControl) {
        e.preventDefault();
        onSeek(Math.max(0, currentTime - 5));
      } else if (e.code === 'ArrowRight' && canControl) {
        e.preventDefault();
        onSeek(Math.min(duration, currentTime + 5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, canControl, currentTime, duration, onSeek, onToggleTheater]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className={`relative group bg-black rounded-2xl overflow-hidden shadow-2xl transition-all select-none ${
        theaterMode ? 'w-full max-h-[85vh] aspect-video' : 'w-full aspect-video'
      }`}
    >
      {ambientGlow && (
        <div
          className="absolute -inset-4 opacity-50 blur-3xl pointer-events-none transition-all duration-1000 -z-10"
          style={{
            background: `radial-gradient(circle, rgba(99,102,241,0.4) 0%, rgba(236,72,153,0.2) 60%, transparent 100%)`
          }}
        />
      )}

      <video
        ref={videoRef}
        src={movie.videoUrl}
        poster={movie.poster}
        playsInline
        preload="auto"
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
      />

      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none">
          <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-700 px-4 py-2 rounded-full text-slate-200 text-sm shadow-xl animate-pulse">
            <span className="w-3 h-3 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
            <span>Buffering video...</span>
          </div>
        </div>
      )}

      {playback.bufferingParticipants.length > 0 && playback.status === 'buffering' && (
        <div className="absolute top-4 right-4 z-30 bg-amber-500/20 border border-amber-500/40 backdrop-blur-md px-3 py-1.5 rounded-lg text-amber-200 text-xs font-medium flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Waiting for room participants to buffer...</span>
        </div>
      )}

      {startsAtServerTime && syncEngineRef.current && (
        <CountdownOverlay
          startsAtServerTime={startsAtServerTime}
          getServerTime={() => (syncMetrics ? syncMetrics.serverTime : Date.now())}
          onFinish={onCountdownFinish}
        />
      )}

      {showDebug && (
        <DebugOverlay
          metrics={syncMetrics}
          onClose={() => setShowDebug(false)}
        />
      )}

      <ReactionsOverlay
        latestReaction={latestReaction}
        onSendReaction={(emoji) => onSendReaction(emoji)}
      />

      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-14 pb-3 px-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          onClick={handleSeekChange}
          className="relative w-full h-2 bg-slate-800/80 hover:h-3 rounded-full cursor-pointer mb-3 transition-all flex items-center"
        >
          <TimelineHeatmap
            heatmap={reactionsHeatmap}
            duration={duration}
            onSeekTo={onSeek}
          />

          {scenes.map(s => {
            if (duration <= 0 || s.timestamp > duration) return null;
            const leftPct = (s.timestamp / duration) * 100;
            return (
              <div
                key={s.id}
                title={`Scene: ${s.title} (${formatTime(s.timestamp)})`}
                style={{ left: `${leftPct}%` }}
                className="absolute top-0 bottom-0 w-1 bg-amber-400 rounded-full z-10 hover:w-2 transition-all"
              />
            );
          })}

          <div
            className="h-full bg-gradient-to-r from-brand-500 via-indigo-500 to-pink-500 rounded-full relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform" />
          </div>
        </div>

        <div className="flex items-center justify-between text-slate-200">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              disabled={!canControl}
              className={`p-2 rounded-xl transition ${
                canControl
                  ? 'hover:bg-white/10 active:scale-95 text-white'
                  : 'text-slate-500 cursor-not-allowed'
              }`}
              title={canControl ? (isPlaying ? 'Pause' : 'Play') : 'Host control only'}
            >
              {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
            </button>

            {isHost && (
              <button
                onClick={() => onStartCountdown(3)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-brand-600/80 hover:bg-brand-500 rounded-lg text-white shadow transition hover:scale-105 active:scale-95"
                title="Synchronized 3-2-1 Countdown for room"
              >
                <ClockIcon size={14} />
                <span>3-2-1 Sync</span>
              </button>
            )}

            <div className="flex items-center gap-2 group/vol">
              <button onClick={toggleMute} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition">
                {isMuted || volume === 0 ? <VolumeXIcon size={20} /> : <Volume2Icon size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 md:w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>

            <span className="text-xs font-mono text-slate-300">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAmbientGlow(!ambientGlow)}
              className={`p-1.5 rounded-lg transition ${
                ambientGlow ? 'text-amber-300 bg-amber-400/10' : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle Ambient Glow Backdrop"
            >
              <SparklesIcon size={18} />
            </button>

            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`p-1.5 rounded-lg transition ${
                showDebug ? 'text-brand-400 bg-brand-500/10' : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle Sync Debug Overlay (D)"
            >
              <FlameIcon size={18} />
            </button>

            <button
              onClick={onToggleTheater}
              className={`p-1.5 rounded-lg transition ${
                theaterMode ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white'
              }`}
              title="Toggle Theater Mode (T)"
            >
              <TvIcon size={18} />
            </button>

            <button
              onClick={togglePiP}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
              title="Picture in Picture"
            >
              <span className="text-xs font-bold border border-slate-400 px-1 rounded">PiP</span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <MinimizeIcon size={18} /> : <MaximizeIcon size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
