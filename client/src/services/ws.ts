import {
  ClientMessage,
  Movie,
  RoomSettings,
  ServerMessage
} from '@watch-party/shared';

export type MessageHandler = (msg: ServerMessage) => void;
export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export class WatchPartySocket {
  private ws: WebSocket | null = null;
  private url: string;
  private roomId: string;
  private user: { id: string; name: string; avatarColor: string };
  private handlers: Set<MessageHandler> = new Set();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private reconnectAttempts: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private intentionalClose: boolean = false;
  private currentStatus: ConnectionStatus = 'disconnected';

  constructor(
    roomId: string,
    user: { id: string; name: string; avatarColor: string },
    customUrl?: string
  ) {
    this.roomId = roomId;
    this.user = user;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.url = customUrl || `${protocol}//${host}/ws?roomId=${encodeURIComponent(roomId)}`;
  }

  public connect(): void {
    this.intentionalClose = false;
    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected');
      this.send({
        type: 'join',
        roomId: this.roomId,
        user: this.user
      });
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        for (const handler of this.handlers) {
          handler(msg);
        }
      } catch {}
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.intentionalClose) {
        this.setStatus('reconnecting');
        this.scheduleReconnect();
      } else {
        this.setStatus('disconnected');
      }
    };

    this.ws.onerror = () => {
      if (this.ws) {
        this.ws.close();
      }
    };
  }

  public disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  public onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  public onStatus(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.currentStatus = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout || this.intentionalClose) return;
    this.reconnectAttempts++;
    const baseDelay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    const jitter = Math.random() * 500;
    const delay = baseDelay + jitter;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  public play(): void {
    this.send({ type: 'play', actionId: `play-${Date.now()}` });
  }

  public pause(): void {
    this.send({ type: 'pause', actionId: `pause-${Date.now()}` });
  }

  public seek(position: number): void {
    this.send({ type: 'seek', position, actionId: `seek-${Date.now()}` });
  }

  public setVideo(movie: Movie): void {
    this.send({ type: 'set_video', movie, actionId: `set-${Date.now()}` });
  }

  public startCountdown(seconds: number = 3): void {
    this.send({ type: 'start_countdown', seconds });
  }

  public sendChat(text: string, videoTimestamp?: number): void {
    this.send({ type: 'chat', text, videoTimestamp });
  }

  public sendTyping(isTyping: boolean): void {
    this.send({ type: 'typing', isTyping });
  }

  public sendReaction(emoji: string, videoTimestamp: number): void {
    this.send({ type: 'reaction', emoji, videoTimestamp });
  }

  public addToPlaylist(movie: Movie): void {
    this.send({ type: 'playlist_add', movie });
  }

  public removeFromPlaylist(itemId: string): void {
    this.send({ type: 'playlist_remove', itemId });
  }

  public upvotePlaylistItem(itemId: string): void {
    this.send({ type: 'playlist_upvote', itemId });
  }

  public reorderPlaylist(itemIds: string[]): void {
    this.send({ type: 'playlist_reorder', itemIds });
  }

  public createPoll(question: string, options: { text: string; movieId?: string }[], durationSeconds?: number): void {
    this.send({ type: 'poll_create', question, options, durationSeconds });
  }

  public votePoll(pollId: string, optionId: string): void {
    this.send({ type: 'poll_vote', pollId, optionId });
  }

  public endPoll(pollId: string): void {
    this.send({ type: 'poll_end', pollId });
  }

  public transferHost(targetUserId: string): void {
    this.send({ type: 'transfer_host', targetUserId });
  }

  public updateSettings(settings: Partial<RoomSettings>): void {
    this.send({ type: 'update_settings', settings });
  }

  public addScene(title: string, timestamp: number): void {
    this.send({ type: 'add_scene', title, timestamp });
  }

  public nudgeUser(targetUserId: string): void {
    this.send({ type: 'nudge_user', targetUserId });
  }
}
