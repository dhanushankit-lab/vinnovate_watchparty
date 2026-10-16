export type PlaybackStatus = 'playing' | 'paused' | 'buffering';

export type SyncStatus = 'in_sync' | 'correcting' | 'buffering' | 'reconnecting';

export type ControlMode = 'host_only' | 'everyone';

export interface RoomPlaybackState {
  videoId: string;
  videoUrl: string;
  title: string;
  status: PlaybackStatus;
  positionAtRef: number;
  serverTimeAtRef: number;
  playbackRate: number;
  version: number;
  scheduledStartTime?: number | null;
  bufferingParticipants: string[];
}

export interface Participant {
  id: string;
  name: string;
  avatarColor: string;
  isHost: boolean;
  joinedAt: number;
  lastSeenAt: number;
  connected: boolean;
  syncStatus: SyncStatus;
  rtt: number;
  drift: number;
  currentPosition: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  avatarColor: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  videoTimestamp?: number;
}

export interface PlaylistItem {
  id: string;
  movieId: string;
  title: string;
  poster: string;
  duration: number;
  videoUrl: string;
  addedByUserId: string;
  addedByUserName: string;
  upvotes: string[];
  addedAt: number;
}

export interface PollOption {
  id: string;
  text: string;
  movieId?: string;
  votes: string[];
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  createdByName: string;
  createdAt: number;
  expiresAt?: number | null;
  isActive: boolean;
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  userName: string;
  timestamp: number;
  videoTimestamp: number;
}

export interface SceneBookmark {
  id: string;
  title: string;
  timestamp: number;
  createdBy: string;
  createdByName: string;
  createdAt: number;
}

export interface RoomSettings {
  controlMode: ControlMode;
  pauseOnBuffering: boolean;
  maxParticipants: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  playback: RoomPlaybackState;
  participants: Record<string, Participant>;
  playlist: PlaylistItem[];
  currentPlaylistIndex: number;
  activePoll: Poll | null;
  recentChat: ChatMessage[];
  scenes: SceneBookmark[];
  reactionsHeatmap: Record<number, number>;
  settings: RoomSettings;
  version: number;
}

export interface Movie {
  id: string;
  title: string;
  year: number;
  genres: string[];
  rating: number;
  runtime: number;
  language: string;
  description: string;
  poster: string;
  videoUrl: string;
  backdrop?: string;
}

export interface NtpPingMessage {
  type: 'ntp_ping';
  clientSendTime: number;
}

export interface NtpPongMessage {
  type: 'ntp_pong';
  clientSendTime: number;
  serverReceiveTime: number;
  serverSendTime: number;
}

export interface ClientSyncReport {
  rtt: number;
  drift: number;
  position: number;
  syncStatus: SyncStatus;
}

export interface ClientActionMeta {
  actionId: string;
  clientTime: number;
}

export type ClientMessage =
  | { type: 'join'; roomId: string; user: { id: string; name: string; avatarColor: string } }
  | { type: 'ntp_ping'; clientSendTime: number }
  | { type: 'sync_report'; report: ClientSyncReport }
  | { type: 'play'; actionId: string }
  | { type: 'pause'; actionId: string }
  | { type: 'seek'; position: number; actionId: string }
  | { type: 'set_video'; movie: Movie; actionId: string }
  | { type: 'buffer_start'; position: number }
  | { type: 'buffer_end'; position: number }
  | { type: 'start_countdown'; seconds: number }
  | { type: 'chat'; text: string; videoTimestamp?: number }
  | { type: 'typing'; isTyping: boolean }
  | { type: 'reaction'; emoji: string; videoTimestamp: number }
  | { type: 'playlist_add'; movie: Movie }
  | { type: 'playlist_remove'; itemId: string }
  | { type: 'playlist_upvote'; itemId: string }
  | { type: 'playlist_reorder'; itemIds: string[] }
  | { type: 'poll_create'; question: string; options: { text: string; movieId?: string }[]; durationSeconds?: number }
  | { type: 'poll_vote'; pollId: string; optionId: string }
  | { type: 'poll_end'; pollId: string }
  | { type: 'transfer_host'; targetUserId: string }
  | { type: 'update_settings'; settings: Partial<RoomSettings> }
  | { type: 'add_scene'; title: string; timestamp: number }
  | { type: 'nudge_user'; targetUserId: string };

export type ServerMessage =
  | { type: 'room_snapshot'; state: RoomState; serverTime: number; yourUserId: string }
  | { type: 'ntp_pong'; clientSendTime: number; serverReceiveTime: number; serverSendTime: number }
  | { type: 'playback_update'; playback: RoomPlaybackState; version: number; serverTime: number }
  | { type: 'participant_joined'; participant: Participant }
  | { type: 'participant_updated'; participant: Participant }
  | { type: 'participant_left'; userId: string; newHostId?: string }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'user_typing'; userId: string; userName: string; isTyping: boolean }
  | { type: 'reaction_broadcast'; reaction: Reaction; heatmapBucket: number; heatmapCount: number }
  | { type: 'playlist_update'; playlist: PlaylistItem[]; currentPlaylistIndex: number }
  | { type: 'poll_update'; poll: Poll | null }
  | { type: 'scenes_update'; scenes: SceneBookmark[] }
  | { type: 'settings_update'; settings: RoomSettings }
  | { type: 'countdown_start'; startsAtServerTime: number; seconds: number }
  | { type: 'nudge_received'; fromUserName: string }
  | { type: 'error'; code: string; message: string; actionId?: string };
