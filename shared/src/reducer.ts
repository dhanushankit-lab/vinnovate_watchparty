import {
  HEATMAP_BUCKET_SECONDS,
  MAX_CHAT_HISTORY,
  SCHEDULE_LEAD_TIME_MS
} from './constants.js';
import {
  ChatMessage,
  Movie,
  Participant,
  PlaylistItem,
  Poll,
  Reaction,
  RoomPlaybackState,
  RoomSettings,
  RoomState,
  SceneBookmark
} from './types.js';
import { computeExpectedPosition } from './clock.js';

export function createInitialPlaybackState(
  movie?: Movie,
  serverTime: number = Date.now()
): RoomPlaybackState {
  return {
    videoId: movie?.id ?? 'big-buck-bunny',
    videoUrl: movie?.videoUrl ?? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    title: movie?.title ?? 'Big Buck Bunny',
    status: 'paused',
    positionAtRef: 0,
    serverTimeAtRef: serverTime,
    playbackRate: 1.0,
    version: 1,
    scheduledStartTime: null,
    bufferingParticipants: []
  };
}

export function createInitialRoomState(
  code: string,
  hostId: string,
  serverTime: number = Date.now(),
  initialMovie?: Movie
): RoomState {
  return {
    code,
    hostId,
    playback: createInitialPlaybackState(initialMovie, serverTime),
    participants: {},
    playlist: [],
    currentPlaylistIndex: 0,
    activePoll: null,
    recentChat: [],
    scenes: [],
    reactionsHeatmap: {},
    settings: {
      controlMode: 'everyone',
      pauseOnBuffering: false,
      maxParticipants: 50
    },
    version: 1
  };
}

export function applyPlay(
  state: RoomState,
  serverTime: number,
  leadTimeMs: number = SCHEDULE_LEAD_TIME_MS
): RoomState {
  if (state.playback.status === 'playing') {
    return state;
  }
  const currentPos = computeExpectedPosition(state.playback, serverTime);
  const scheduledTime = serverTime + leadTimeMs;

  return {
    ...state,
    version: state.version + 1,
    playback: {
      ...state.playback,
      status: 'playing',
      positionAtRef: currentPos,
      serverTimeAtRef: serverTime,
      scheduledStartTime: scheduledTime,
      version: state.playback.version + 1
    }
  };
}

export function applyPause(
  state: RoomState,
  serverTime: number
): RoomState {
  if (state.playback.status === 'paused') {
    return state;
  }
  const currentPos = computeExpectedPosition(state.playback, serverTime);

  return {
    ...state,
    version: state.version + 1,
    playback: {
      ...state.playback,
      status: 'paused',
      positionAtRef: currentPos,
      serverTimeAtRef: serverTime,
      scheduledStartTime: null,
      version: state.playback.version + 1
    }
  };
}

export function applySeek(
  state: RoomState,
  position: number,
  serverTime: number,
  leadTimeMs: number = SCHEDULE_LEAD_TIME_MS
): RoomState {
  const isPlaying = state.playback.status === 'playing';
  const scheduledTime = isPlaying ? serverTime + leadTimeMs : null;

  return {
    ...state,
    version: state.version + 1,
    playback: {
      ...state.playback,
      positionAtRef: Math.max(0, position),
      serverTimeAtRef: serverTime,
      scheduledStartTime: scheduledTime,
      version: state.playback.version + 1
    }
  };
}

export function applySetVideo(
  state: RoomState,
  movie: Movie,
  serverTime: number
): RoomState {
  return {
    ...state,
    version: state.version + 1,
    playback: {
      ...state.playback,
      videoId: movie.id,
      videoUrl: movie.videoUrl,
      title: movie.title,
      status: 'paused',
      positionAtRef: 0,
      serverTimeAtRef: serverTime,
      scheduledStartTime: null,
      bufferingParticipants: [],
      version: state.playback.version + 1
    }
  };
}

export function applyParticipantJoin(
  state: RoomState,
  user: { id: string; name: string; avatarColor: string },
  serverTime: number
): RoomState {
  const existing = state.participants[user.id];
  const isFirst = Object.keys(state.participants).length === 0;
  const isHost = existing ? existing.isHost : (isFirst || state.hostId === user.id);
  const hostId = isHost ? user.id : (state.hostId || user.id);

  const updatedParticipant: Participant = {
    id: user.id,
    name: user.name,
    avatarColor: user.avatarColor,
    isHost,
    joinedAt: existing ? existing.joinedAt : serverTime,
    lastSeenAt: serverTime,
    connected: true,
    syncStatus: 'in_sync',
    rtt: existing ? existing.rtt : 0,
    drift: existing ? existing.drift : 0,
    currentPosition: existing ? existing.currentPosition : state.playback.positionAtRef
  };

  return {
    ...state,
    hostId,
    version: state.version + 1,
    participants: {
      ...state.participants,
      [user.id]: updatedParticipant
    }
  };
}

export function applyParticipantLeave(
  state: RoomState,
  userId: string,
  serverTime: number
): RoomState {
  const existing = state.participants[userId];
  if (!existing) {
    return state;
  }

  const updatedParticipants = {
    ...state.participants,
    [userId]: {
      ...existing,
      connected: false,
      lastSeenAt: serverTime
    }
  };

  let newHostId = state.hostId;
  if (state.hostId === userId) {
    const activeCandidates = Object.values(updatedParticipants)
      .filter(p => p.connected && p.id !== userId)
      .sort((a, b) => a.joinedAt - b.joinedAt);

    if (activeCandidates.length > 0) {
      newHostId = activeCandidates[0].id;
      for (const id of Object.keys(updatedParticipants)) {
        updatedParticipants[id] = {
          ...updatedParticipants[id],
          isHost: id === newHostId
        };
      }
    }
  }

  return {
    ...state,
    hostId: newHostId,
    version: state.version + 1,
    participants: updatedParticipants
  };
}

export function applyParticipantUpdate(
  state: RoomState,
  userId: string,
  update: Partial<Participant>
): RoomState {
  const existing = state.participants[userId];
  if (!existing) {
    return state;
  }

  return {
    ...state,
    participants: {
      ...state.participants,
      [userId]: {
        ...existing,
        ...update
      }
    }
  };
}

export function applyBufferStart(
  state: RoomState,
  userId: string,
  serverTime: number
): RoomState {
  const alreadyBuffering = state.playback.bufferingParticipants.includes(userId);
  const updatedBuffering = alreadyBuffering
    ? state.playback.bufferingParticipants
    : [...state.playback.bufferingParticipants, userId];

  let nextPlayback = {
    ...state.playback,
    bufferingParticipants: updatedBuffering
  };

  if (state.settings.pauseOnBuffering && state.playback.status === 'playing') {
    const currentPos = computeExpectedPosition(state.playback, serverTime);
    nextPlayback = {
      ...nextPlayback,
      status: 'buffering',
      positionAtRef: currentPos,
      serverTimeAtRef: serverTime,
      scheduledStartTime: null,
      version: state.playback.version + 1
    };
  }

  return {
    ...state,
    version: state.version + 1,
    playback: nextPlayback
  };
}

export function applyBufferEnd(
  state: RoomState,
  userId: string,
  serverTime: number,
  leadTimeMs: number = SCHEDULE_LEAD_TIME_MS
): RoomState {
  const updatedBuffering = state.playback.bufferingParticipants.filter(id => id !== userId);
  let nextPlayback = {
    ...state.playback,
    bufferingParticipants: updatedBuffering
  };

  if (state.playback.status === 'buffering' && updatedBuffering.length === 0) {
    nextPlayback = {
      ...nextPlayback,
      status: 'playing',
      serverTimeAtRef: serverTime,
      scheduledStartTime: serverTime + leadTimeMs,
      version: state.playback.version + 1
    };
  }

  return {
    ...state,
    version: state.version + 1,
    playback: nextPlayback
  };
}

export function applyAddChatMessage(
  state: RoomState,
  message: ChatMessage
): RoomState {
  const updatedChat = [...state.recentChat, message];
  if (updatedChat.length > MAX_CHAT_HISTORY) {
    updatedChat.shift();
  }
  return {
    ...state,
    recentChat: updatedChat,
    version: state.version + 1
  };
}

export function applyAddReaction(
  state: RoomState,
  reaction: Reaction
): { nextState: RoomState; bucket: number; count: number } {
  const bucket = Math.floor(Math.max(0, reaction.videoTimestamp) / HEATMAP_BUCKET_SECONDS);
  const currentCount = state.reactionsHeatmap[bucket] || 0;
  const newCount = currentCount + 1;

  const nextState: RoomState = {
    ...state,
    reactionsHeatmap: {
      ...state.reactionsHeatmap,
      [bucket]: newCount
    }
  };

  return { nextState, bucket, count: newCount };
}

export function applyPlaylistAdd(
  state: RoomState,
  item: PlaylistItem
): RoomState {
  return {
    ...state,
    version: state.version + 1,
    playlist: [...state.playlist, item]
  };
}

export function applyPlaylistRemove(
  state: RoomState,
  itemId: string
): RoomState {
  return {
    ...state,
    version: state.version + 1,
    playlist: state.playlist.filter(item => item.id !== itemId)
  };
}

export function applyPlaylistUpvote(
  state: RoomState,
  itemId: string,
  userId: string
): RoomState {
  const updated = state.playlist.map(item => {
    if (item.id !== itemId) {
      return item;
    }
    const hasVoted = item.upvotes.includes(userId);
    const upvotes = hasVoted
      ? item.upvotes.filter(id => id !== userId)
      : [...item.upvotes, userId];
    return { ...item, upvotes };
  });

  const activeItem = updated[state.currentPlaylistIndex];
  const remaining = updated.slice(state.currentPlaylistIndex + 1);
  remaining.sort((a, b) => b.upvotes.length - a.upvotes.length || a.addedAt - b.addedAt);

  const finalPlaylist = [
    ...updated.slice(0, state.currentPlaylistIndex),
    ...(activeItem ? [activeItem] : []),
    ...remaining
  ];

  return {
    ...state,
    version: state.version + 1,
    playlist: finalPlaylist
  };
}

export function applyPlaylistReorder(
  state: RoomState,
  itemIds: string[]
): RoomState {
  const itemMap = new Map(state.playlist.map(i => [i.id, i]));
  const reordered: PlaylistItem[] = [];

  for (const id of itemIds) {
    const item = itemMap.get(id);
    if (item) {
      reordered.push(item);
      itemMap.delete(id);
    }
  }

  for (const remaining of itemMap.values()) {
    reordered.push(remaining);
  }

  return {
    ...state,
    version: state.version + 1,
    playlist: reordered
  };
}

export function applyPollCreate(
  state: RoomState,
  poll: Poll
): RoomState {
  return {
    ...state,
    version: state.version + 1,
    activePoll: poll
  };
}

export function applyPollVote(
  state: RoomState,
  pollId: string,
  optionId: string,
  userId: string
): RoomState {
  if (!state.activePoll || state.activePoll.id !== pollId || !state.activePoll.isActive) {
    return state;
  }

  const updatedOptions = state.activePoll.options.map(opt => {
    const withoutUser = opt.votes.filter(u => u !== userId);
    if (opt.id === optionId) {
      return { ...opt, votes: [...withoutUser, userId] };
    }
    return { ...opt, votes: withoutUser };
  });

  return {
    ...state,
    version: state.version + 1,
    activePoll: {
      ...state.activePoll,
      options: updatedOptions
    }
  };
}

export function applyPollEnd(
  state: RoomState,
  pollId: string
): RoomState {
  if (!state.activePoll || state.activePoll.id !== pollId) {
    return state;
  }

  return {
    ...state,
    version: state.version + 1,
    activePoll: {
      ...state.activePoll,
      isActive: false
    }
  };
}

export function applyTransferHost(
  state: RoomState,
  targetUserId: string
): RoomState {
  if (!state.participants[targetUserId]) {
    return state;
  }

  const updatedParticipants: Record<string, Participant> = {};
  for (const [id, p] of Object.entries(state.participants)) {
    updatedParticipants[id] = {
      ...p,
      isHost: id === targetUserId
    };
  }

  return {
    ...state,
    hostId: targetUserId,
    version: state.version + 1,
    participants: updatedParticipants
  };
}

export function applyAddScene(
  state: RoomState,
  scene: SceneBookmark
): RoomState {
  return {
    ...state,
    version: state.version + 1,
    scenes: [...state.scenes, scene]
  };
}

export function applyUpdateSettings(
  state: RoomState,
  settings: Partial<RoomSettings>
): RoomState {
  return {
    ...state,
    version: state.version + 1,
    settings: {
      ...state.settings,
      ...settings
    }
  };
}
