import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  BUFFERING_WAIT_TIMEOUT_MS,
  ChatMessage,
  ClientMessage,
  ClientMessageSchema,
  createInitialRoomState,
  Movie,
  Participant,
  PlaylistItem,
  Poll,
  RATE_LIMIT_ACTIONS_PER_SECOND,
  RECONNECT_GRACE_PERIOD_MS,
  RoomSettings,
  RoomState,
  SCHEDULE_LEAD_TIME_MS,
  ServerMessage,
  applyPlay,
  applyPause,
  applySeek,
  applySetVideo,
  applyParticipantJoin,
  applyParticipantLeave,
  applyParticipantUpdate,
  applyBufferStart,
  applyBufferEnd,
  applyAddChatMessage,
  applyAddReaction,
  applyPlaylistAdd,
  applyPlaylistRemove,
  applyPlaylistUpvote,
  applyPlaylistReorder,
  applyPollCreate,
  applyPollVote,
  applyPollEnd,
  applyTransferHost,
  applyAddScene,
  applyUpdateSettings
} from '@watch-party/shared';

export class Room {
  public readonly code: string;
  private state: RoomState;
  private clients: Map<string, WebSocket> = new Map();
  private socketToUserId: Map<WebSocket, string> = new Map();
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private dedupActionIds: Map<string, number> = new Map();
  private rateLimits: Map<string, number[]> = new Map();
  private pollTimer: NodeJS.Timeout | null = null;
  private bufferingTimer: NodeJS.Timeout | null = null;
  private emptyRoomTimer: NodeJS.Timeout | null = null;
  private onRoomEmptyCallback?: (code: string) => void;

  constructor(code: string, hostId: string = '', initialMovie?: Movie, onRoomEmpty?: (code: string) => void) {
    this.code = code;
    this.state = createInitialRoomState(code, hostId, Date.now(), initialMovie);
    this.onRoomEmptyCallback = onRoomEmpty;
    this.resetEmptyRoomTimer();
  }

  public getState(): RoomState {
    return this.state;
  }

  public getConnectedCount(): number {
    return this.clients.size;
  }

  public getParticipantCount(): number {
    return Object.keys(this.state.participants).length;
  }

  public handleConnection(ws: WebSocket): void {
    ws.on('message', (data: Buffer | string) => {
      this.handleMessage(ws, data.toString());
    });

    ws.on('close', () => {
      this.handleSocketClose(ws);
    });

    ws.on('error', () => {
      this.handleSocketClose(ws);
    });
  }

  private handleSocketClose(ws: WebSocket): void {
    const userId = this.socketToUserId.get(ws);
    if (!userId) {
      return;
    }

    this.socketToUserId.delete(ws);
    this.clients.delete(userId);

    const now = Date.now();
    this.state = applyParticipantLeave(this.state, userId, now);

    this.broadcast({
      type: 'participant_left',
      userId,
      newHostId: this.state.hostId
    });

    const timer = setTimeout(() => {
      this.disconnectTimers.delete(userId);
      delete this.state.participants[userId];
      this.state.version++;
      if (this.clients.size === 0) {
        this.resetEmptyRoomTimer();
      }
    }, RECONNECT_GRACE_PERIOD_MS);

    this.disconnectTimers.set(userId, timer);

    if (this.clients.size === 0) {
      this.resetEmptyRoomTimer();
    }
  }

  private resetEmptyRoomTimer(): void {
    if (this.emptyRoomTimer) {
      clearTimeout(this.emptyRoomTimer);
    }
    this.emptyRoomTimer = setTimeout(() => {
      if (this.clients.size === 0 && this.onRoomEmptyCallback) {
        this.onRoomEmptyCallback(this.code);
      }
    }, 3600000);
  }

  private handleMessage(ws: WebSocket, raw: string): void {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      this.send(ws, {
        type: 'error',
        code: 'INVALID_JSON',
        message: 'Could not parse message JSON'
      });
      return;
    }

    const validation = ClientMessageSchema.safeParse(parsedJson);
    if (!validation.success) {
      this.send(ws, {
        type: 'error',
        code: 'VALIDATION_FAILED',
        message: validation.error.errors.map(e => e.message).join(', ')
      });
      return;
    }

    const msg: ClientMessage = validation.data;
    const now = Date.now();

    if (msg.type === 'ntp_ping') {
      const serverReceiveTime = now;
      const serverSendTime = Date.now();
      this.send(ws, {
        type: 'ntp_pong',
        clientSendTime: msg.clientSendTime,
        serverReceiveTime,
        serverSendTime
      });
      return;
    }

    if (msg.type === 'join') {
      this.handleJoin(ws, msg);
      return;
    }

    const userId = this.socketToUserId.get(ws);
    if (!userId) {
      this.send(ws, {
        type: 'error',
        code: 'UNAUTHENTICATED',
        message: 'Must send join message before issuing commands'
      });
      return;
    }

    if (!this.checkRateLimit(userId, now)) {
      this.send(ws, {
        type: 'error',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests'
      });
      return;
    }

    this.dispatchClientMessage(ws, userId, msg, now);
  }

  private checkRateLimit(userId: string, now: number): boolean {
    const history = this.rateLimits.get(userId) || [];
    const windowStart = now - 1000;
    const recent = history.filter(t => t > windowStart);
    if (recent.length >= RATE_LIMIT_ACTIONS_PER_SECOND) {
      return false;
    }
    recent.push(now);
    this.rateLimits.set(userId, recent);
    return true;
  }

  private checkDedup(actionId?: string): boolean {
    if (!actionId) return false;
    const now = Date.now();
    if (this.dedupActionIds.has(actionId)) {
      return true;
    }
    this.dedupActionIds.set(actionId, now);
    if (this.dedupActionIds.size > 1000) {
      const staleThreshold = now - 60000;
      for (const [id, ts] of this.dedupActionIds.entries()) {
        if (ts < staleThreshold) this.dedupActionIds.delete(id);
      }
    }
    return false;
  }

  private handleJoin(
    ws: WebSocket,
    msg: { type: 'join'; roomId: string; user: { id: string; name: string; avatarColor: string } }
  ): void {
    const { user } = msg;
    const now = Date.now();

    const existingTimer = this.disconnectTimers.get(user.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.disconnectTimers.delete(user.id);
    }

    const oldWs = this.clients.get(user.id);
    if (oldWs && oldWs !== ws) {
      this.socketToUserId.delete(oldWs);
      try {
        oldWs.close();
      } catch {}
    }

    this.clients.set(user.id, ws);
    this.socketToUserId.set(ws, user.id);

    if (this.emptyRoomTimer) {
      clearTimeout(this.emptyRoomTimer);
      this.emptyRoomTimer = null;
    }

    this.state = applyParticipantJoin(this.state, user, now);
    const participant = this.state.participants[user.id];

    this.send(ws, {
      type: 'room_snapshot',
      state: this.state,
      serverTime: now,
      yourUserId: user.id
    });

    this.broadcast({
      type: 'participant_joined',
      participant
    }, user.id);

    const joinAnnouncement: ChatMessage = {
      id: uuidv4(),
      userId: 'system',
      userName: 'System',
      avatarColor: '#6366F1',
      text: `${user.name} joined the party`,
      timestamp: now,
      isSystem: true
    };
    this.state = applyAddChatMessage(this.state, joinAnnouncement);
    this.broadcast({
      type: 'chat_message',
      message: joinAnnouncement
    });
  }

  private canControl(userId: string): boolean {
    if (this.state.settings.controlMode === 'everyone') {
      return true;
    }
    return this.state.hostId === userId;
  }

  private dispatchClientMessage(
    ws: WebSocket,
    userId: string,
    msg: ClientMessage,
    now: number
  ): void {
    switch (msg.type) {
      case 'sync_report': {
        this.state = applyParticipantUpdate(this.state, userId, {
          rtt: msg.report.rtt,
          drift: msg.report.drift,
          currentPosition: msg.report.position,
          syncStatus: msg.report.syncStatus,
          lastSeenAt: now
        });
        const updated = this.state.participants[userId];
        if (updated) {
          this.broadcast({
            type: 'participant_updated',
            participant: updated
          });
        }
        break;
      }

      case 'play': {
        if (!this.canControl(userId)) {
          this.send(ws, { type: 'error', code: 'PERMISSION_DENIED', message: 'Only the host can control playback', actionId: msg.actionId });
          return;
        }
        if (this.checkDedup(msg.actionId)) {
          this.sendPlaybackUpdate();
          return;
        }
        this.state = applyPlay(this.state, now);
        this.sendPlaybackUpdate();
        break;
      }

      case 'pause': {
        if (!this.canControl(userId)) {
          this.send(ws, { type: 'error', code: 'PERMISSION_DENIED', message: 'Only the host can control playback', actionId: msg.actionId });
          return;
        }
        if (this.checkDedup(msg.actionId)) {
          this.sendPlaybackUpdate();
          return;
        }
        this.state = applyPause(this.state, now);
        this.sendPlaybackUpdate();
        break;
      }

      case 'seek': {
        if (!this.canControl(userId)) {
          this.send(ws, { type: 'error', code: 'PERMISSION_DENIED', message: 'Only the host can control playback', actionId: msg.actionId });
          return;
        }
        if (this.checkDedup(msg.actionId)) {
          this.sendPlaybackUpdate();
          return;
        }
        this.state = applySeek(this.state, msg.position, now);
        this.sendPlaybackUpdate();
        break;
      }

      case 'set_video': {
        if (!this.canControl(userId)) {
          this.send(ws, { type: 'error', code: 'PERMISSION_DENIED', message: 'Only the host can change video', actionId: msg.actionId });
          return;
        }
        if (this.checkDedup(msg.actionId)) {
          this.sendPlaybackUpdate();
          return;
        }
        this.state = applySetVideo(this.state, msg.movie, now);
        this.sendPlaybackUpdate();
        break;
      }

      case 'start_countdown': {
        if (!this.canControl(userId)) {
          this.send(ws, { type: 'error', code: 'PERMISSION_DENIED', message: 'Only host can start countdown' });
          return;
        }
        const lead = msg.seconds * 1000;
        const startsAt = now + lead;
        this.state = applyPlay(this.state, now, lead);
        this.broadcast({
          type: 'countdown_start',
          startsAtServerTime: startsAt,
          seconds: msg.seconds
        });
        this.sendPlaybackUpdate();
        break;
      }

      case 'buffer_start': {
        this.state = applyBufferStart(this.state, userId, now);
        if (this.state.settings.pauseOnBuffering && this.state.playback.status === 'buffering') {
          this.sendPlaybackUpdate();
          if (this.bufferingTimer) clearTimeout(this.bufferingTimer);
          this.bufferingTimer = setTimeout(() => {
            this.state = applyBufferEnd(this.state, userId, Date.now());
            this.sendPlaybackUpdate();
          }, BUFFERING_WAIT_TIMEOUT_MS);
        }
        break;
      }

      case 'buffer_end': {
        this.state = applyBufferEnd(this.state, userId, now);
        if (this.state.playback.status === 'playing') {
          this.sendPlaybackUpdate();
        }
        break;
      }

      case 'chat': {
        const participant = this.state.participants[userId];
        if (!participant) return;
        const chatMsg: ChatMessage = {
          id: uuidv4(),
          userId,
          userName: participant.name,
          avatarColor: participant.avatarColor,
          text: msg.text,
          timestamp: now,
          videoTimestamp: msg.videoTimestamp
        };
        this.state = applyAddChatMessage(this.state, chatMsg);
        this.broadcast({
          type: 'chat_message',
          message: chatMsg
        });
        break;
      }

      case 'typing': {
        const participant = this.state.participants[userId];
        if (!participant) return;
        this.broadcast({
          type: 'user_typing',
          userId,
          userName: participant.name,
          isTyping: msg.isTyping
        }, userId);
        break;
      }

      case 'reaction': {
        const participant = this.state.participants[userId];
        if (!participant) return;
        const reaction = {
          id: uuidv4(),
          emoji: msg.emoji,
          userId,
          userName: participant.name,
          timestamp: now,
          videoTimestamp: msg.videoTimestamp
        };
        const { nextState, bucket, count } = applyAddReaction(this.state, reaction);
        this.state = nextState;
        this.broadcast({
          type: 'reaction_broadcast',
          reaction,
          heatmapBucket: bucket,
          heatmapCount: count
        });
        break;
      }

      case 'playlist_add': {
        const participant = this.state.participants[userId];
        const item: PlaylistItem = {
          id: uuidv4(),
          movieId: msg.movie.id,
          title: msg.movie.title,
          poster: msg.movie.poster,
          duration: msg.movie.runtime,
          videoUrl: msg.movie.videoUrl,
          addedByUserId: userId,
          addedByUserName: participant ? participant.name : 'Participant',
          upvotes: [userId],
          addedAt: now
        };
        this.state = applyPlaylistAdd(this.state, item);
        this.broadcast({
          type: 'playlist_update',
          playlist: this.state.playlist,
          currentPlaylistIndex: this.state.currentPlaylistIndex
        });
        break;
      }

      case 'playlist_remove': {
        this.state = applyPlaylistRemove(this.state, msg.itemId);
        this.broadcast({
          type: 'playlist_update',
          playlist: this.state.playlist,
          currentPlaylistIndex: this.state.currentPlaylistIndex
        });
        break;
      }

      case 'playlist_upvote': {
        this.state = applyPlaylistUpvote(this.state, msg.itemId, userId);
        this.broadcast({
          type: 'playlist_update',
          playlist: this.state.playlist,
          currentPlaylistIndex: this.state.currentPlaylistIndex
        });
        break;
      }

      case 'playlist_reorder': {
        this.state = applyPlaylistReorder(this.state, msg.itemIds);
        this.broadcast({
          type: 'playlist_update',
          playlist: this.state.playlist,
          currentPlaylistIndex: this.state.currentPlaylistIndex
        });
        break;
      }

      case 'poll_create': {
        const participant = this.state.participants[userId];
        const poll: Poll = {
          id: uuidv4(),
          question: msg.question,
          options: msg.options.map(opt => ({
            id: uuidv4(),
            text: opt.text,
            movieId: opt.movieId,
            votes: []
          })),
          createdBy: userId,
          createdByName: participant ? participant.name : 'Host',
          createdAt: now,
          expiresAt: msg.durationSeconds ? now + msg.durationSeconds * 1000 : null,
          isActive: true
        };
        this.state = applyPollCreate(this.state, poll);
        this.broadcast({
          type: 'poll_update',
          poll: this.state.activePoll
        });

        if (msg.durationSeconds) {
          if (this.pollTimer) clearTimeout(this.pollTimer);
          this.pollTimer = setTimeout(() => {
            this.handlePollAutoEnd(poll.id);
          }, msg.durationSeconds * 1000);
        }
        break;
      }

      case 'poll_vote': {
        this.state = applyPollVote(this.state, msg.pollId, msg.optionId, userId);
        this.broadcast({
          type: 'poll_update',
          poll: this.state.activePoll
        });
        break;
      }

      case 'poll_end': {
        if (this.state.hostId !== userId) {
          this.send(ws, { type: 'error', code: 'PERMISSION_DENIED', message: 'Only host can end poll' });
          return;
        }
        this.handlePollAutoEnd(msg.pollId);
        break;
      }

      case 'transfer_host': {
        if (this.state.hostId !== userId) {
          this.send(ws, { type: 'error', code: 'PERMISSION_DENIED', message: 'Only current host can transfer host privileges' });
          return;
        }
        this.state = applyTransferHost(this.state, msg.targetUserId);
        const newHost = this.state.participants[msg.targetUserId];
        if (newHost) {
          const sysMsg: ChatMessage = {
            id: uuidv4(),
            userId: 'system',
            userName: 'System',
            avatarColor: '#6366F1',
            text: `${newHost.name} is now the room host`,
            timestamp: now,
            isSystem: true
          };
          this.state = applyAddChatMessage(this.state, sysMsg);
          this.broadcast({ type: 'chat_message', message: sysMsg });
        }
        for (const p of Object.values(this.state.participants)) {
          this.broadcast({ type: 'participant_updated', participant: p });
        }
        break;
      }

      case 'update_settings': {
        if (this.state.hostId !== userId) {
          this.send(ws, { type: 'error', code: 'PERMISSION_DENIED', message: 'Only host can update settings' });
          return;
        }
        this.state = applyUpdateSettings(this.state, msg.settings);
        this.broadcast({
          type: 'settings_update',
          settings: this.state.settings
        });
        break;
      }

      case 'add_scene': {
        const participant = this.state.participants[userId];
        const scene = {
          id: uuidv4(),
          title: msg.title,
          timestamp: msg.timestamp,
          createdBy: userId,
          createdByName: participant ? participant.name : 'Participant',
          createdAt: now
        };
        this.state = applyAddScene(this.state, scene);
        this.broadcast({
          type: 'scenes_update',
          scenes: this.state.scenes
        });
        break;
      }

      case 'nudge_user': {
        const sender = this.state.participants[userId];
        const targetWs = this.clients.get(msg.targetUserId);
        if (targetWs && sender) {
          this.send(targetWs, {
            type: 'nudge_received',
            fromUserName: sender.name
          });
        }
        break;
      }
    }
  }

  private handlePollAutoEnd(pollId: string): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.state = applyPollEnd(this.state, pollId);
    this.broadcast({
      type: 'poll_update',
      poll: this.state.activePoll
    });
  }

  private sendPlaybackUpdate(): void {
    const now = Date.now();
    this.broadcast({
      type: 'playback_update',
      playback: this.state.playback,
      version: this.state.playback.version,
      serverTime: now
    });
  }

  public broadcast(msg: ServerMessage, excludeUserId?: string): void {
    const payload = JSON.stringify(msg);
    for (const [userId, client] of this.clients.entries()) {
      if (excludeUserId && userId === excludeUserId) {
        continue;
      }
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  public send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  public destroy(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.bufferingTimer) clearTimeout(this.bufferingTimer);
    if (this.emptyRoomTimer) clearTimeout(this.emptyRoomTimer);
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    for (const ws of this.clients.values()) {
      try {
        ws.close();
      } catch {}
    }
    this.clients.clear();
    this.socketToUserId.clear();
  }
}
