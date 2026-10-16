export type PlayerEventType =
  | 'play'
  | 'pause'
  | 'seeking'
  | 'seeked'
  | 'timeupdate'
  | 'waiting'
  | 'canplay'
  | 'playing'
  | 'ratechange'
  | 'ended'
  | 'error';

export interface IPlayerAdapter {
  attach(element: HTMLVideoElement): void;
  detach(): void;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  getCurrentTime(): number;
  getDuration(): number;
  isPaused(): boolean;
  isBuffering(): boolean;
  on(event: PlayerEventType, listener: (...args: unknown[]) => void): () => void;
}
