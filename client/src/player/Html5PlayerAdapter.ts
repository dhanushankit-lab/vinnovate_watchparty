import { IPlayerAdapter, PlayerEventType } from './PlayerAdapter';

export class Html5PlayerAdapter implements IPlayerAdapter {
  private element: HTMLVideoElement | null = null;
  private listeners: Map<PlayerEventType, Set<(...args: unknown[]) => void>> = new Map();
  private isBufferingState: boolean = false;
  private boundDomListeners: Map<string, EventListener> = new Map();

  public attach(element: HTMLVideoElement): void {
    this.detach();
    this.element = element;

    const bind = (domEvent: string, playerEvent: PlayerEventType, handler?: () => void) => {
      const listener: EventListener = () => {
        if (handler) handler();
        this.emit(playerEvent);
      };
      this.boundDomListeners.set(domEvent, listener);
      element.addEventListener(domEvent, listener);
    };

    bind('play', 'play');
    bind('pause', 'pause');
    bind('seeking', 'seeking');
    bind('seeked', 'seeked');
    bind('timeupdate', 'timeupdate');
    bind('waiting', 'waiting', () => {
      this.isBufferingState = true;
    });
    bind('canplay', 'canplay', () => {
      this.isBufferingState = false;
    });
    bind('playing', 'playing', () => {
      this.isBufferingState = false;
    });
    bind('ratechange', 'ratechange');
    bind('ended', 'ended');
    bind('error', 'error');
  }

  public detach(): void {
    if (!this.element) return;
    for (const [domEvent, listener] of this.boundDomListeners.entries()) {
      this.element.removeEventListener(domEvent, listener);
    }
    this.boundDomListeners.clear();
    this.element = null;
    this.isBufferingState = false;
  }

  public async play(): Promise<void> {
    if (!this.element) return;
    try {
      await this.element.play();
    } catch {}
  }

  public pause(): void {
    if (!this.element) return;
    this.element.pause();
  }

  public seek(seconds: number): void {
    if (!this.element) return;
    this.element.currentTime = Math.max(0, seconds);
  }

  public setPlaybackRate(rate: number): void {
    if (!this.element) return;
    this.element.playbackRate = rate;
  }

  public getPlaybackRate(): number {
    return this.element ? this.element.playbackRate : 1.0;
  }

  public getCurrentTime(): number {
    return this.element ? this.element.currentTime : 0;
  }

  public getDuration(): number {
    return this.element ? this.element.duration || 0 : 0;
  }

  public isPaused(): boolean {
    return this.element ? this.element.paused : true;
  }

  public isBuffering(): boolean {
    return this.isBufferingState;
  }

  public on(event: PlayerEventType, listener: (...args: unknown[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  private emit(event: PlayerEventType, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(...args);
    }
  }
}
