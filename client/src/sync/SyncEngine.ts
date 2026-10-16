import {
  calculateNtpSample,
  ClockSyncTracker,
  computeDriftMs,
  computeExpectedPosition,
  DRIFT_CHECK_INTERVAL_MS,
  NTP_SYNC_INTERVAL_MS,
  RATE_NORMAL,
  resolveDriftCorrection,
  RoomPlaybackState,
  SyncStatus
} from '@watch-party/shared';
import { IPlayerAdapter } from '../player/PlayerAdapter';

export interface SyncEngineMetrics {
  rtt: number;
  offset: number;
  driftMs: number;
  syncStatus: SyncStatus;
  actualPosition: number;
  expectedPosition: number;
  playbackRate: number;
  serverTime: number;
}

export type SyncMetricsListener = (metrics: SyncEngineMetrics) => void;

export class SyncEngine {
  private player: IPlayerAdapter;
  private clockTracker: ClockSyncTracker;
  private currentPlayback: RoomPlaybackState | null = null;
  private driftTimer: NodeJS.Timeout | null = null;
  private ntpTimer: NodeJS.Timeout | null = null;
  private scheduledPlayTimer: NodeJS.Timeout | null = null;
  private sendPingCallback: (clientSendTime: number) => void;
  private sendSyncReportCallback?: (report: { rtt: number; drift: number; position: number; syncStatus: SyncStatus }) => void;
  private metricsListeners: Set<SyncMetricsListener> = new Set();
  private lastReportedSyncStatus: SyncStatus = 'in_sync';
  private lastReportTime: number = 0;

  constructor(
    player: IPlayerAdapter,
    sendPing: (clientSendTime: number) => void,
    sendSyncReport?: (report: { rtt: number; drift: number; position: number; syncStatus: SyncStatus }) => void
  ) {
    this.player = player;
    this.clockTracker = new ClockSyncTracker(10);
    this.sendPingCallback = sendPing;
    this.sendSyncReportCallback = sendSyncReport;
  }

  public start(): void {
    this.stop();
    this.sendNtpPing();

    this.ntpTimer = setInterval(() => {
      this.sendNtpPing();
    }, NTP_SYNC_INTERVAL_MS);

    this.driftTimer = setInterval(() => {
      this.runDriftCheck();
    }, DRIFT_CHECK_INTERVAL_MS);
  }

  public stop(): void {
    if (this.ntpTimer) {
      clearInterval(this.ntpTimer);
      this.ntpTimer = null;
    }
    if (this.driftTimer) {
      clearInterval(this.driftTimer);
      this.driftTimer = null;
    }
    if (this.scheduledPlayTimer) {
      clearTimeout(this.scheduledPlayTimer);
      this.scheduledPlayTimer = null;
    }
  }

  public onMetrics(listener: SyncMetricsListener): () => void {
    this.metricsListeners.add(listener);
    return () => {
      this.metricsListeners.delete(listener);
    };
  }

  public handleNtpPong(clientSendTime: number, serverReceiveTime: number, serverSendTime: number): void {
    const clientReceiveTime = Date.now();
    const sample = calculateNtpSample(clientSendTime, serverReceiveTime, serverSendTime, clientReceiveTime);
    this.clockTracker.recordSample(sample);
  }

  public applyPlaybackState(playback: RoomPlaybackState): void {
    if (this.currentPlayback && playback.version < this.currentPlayback.version) {
      return;
    }

    this.currentPlayback = playback;
    if (this.scheduledPlayTimer) {
      clearTimeout(this.scheduledPlayTimer);
      this.scheduledPlayTimer = null;
    }

    const estimatedNow = this.clockTracker.estimateServerTime();
    const expected = computeExpectedPosition(playback, estimatedNow);

    if (playback.status === 'paused') {
      this.player.pause();
      this.player.setPlaybackRate(RATE_NORMAL);
      this.player.seek(expected);
      return;
    }

    if (playback.status === 'buffering') {
      this.player.pause();
      return;
    }

    if (playback.status === 'playing') {
      if (playback.scheduledStartTime && playback.scheduledStartTime > estimatedNow) {
        const delayMs = Math.max(0, playback.scheduledStartTime - estimatedNow);
        this.player.seek(playback.positionAtRef);
        this.scheduledPlayTimer = setTimeout(() => {
          this.player.play();
          this.scheduledPlayTimer = null;
        }, delayMs);
      } else {
        const drift = computeDriftMs(this.player.getCurrentTime(), expected);
        if (Math.abs(drift) > 1500) {
          this.player.seek(expected);
        }
        if (this.player.isPaused()) {
          this.player.play();
        }
      }
    }
  }

  public syncMeToHost(): void {
    if (!this.currentPlayback) return;
    const estimatedNow = this.clockTracker.estimateServerTime();
    const expected = computeExpectedPosition(this.currentPlayback, estimatedNow);
    this.player.seek(expected);
    this.player.setPlaybackRate(RATE_NORMAL);
    if (this.currentPlayback.status === 'playing' && this.player.isPaused()) {
      this.player.play();
    }
  }

  private sendNtpPing(): void {
    this.sendPingCallback(Date.now());
  }

  private runDriftCheck(): void {
    if (!this.currentPlayback) return;

    const estimatedNow = this.clockTracker.estimateServerTime();
    const expected = computeExpectedPosition(this.currentPlayback, estimatedNow);
    const actual = this.player.getCurrentTime();
    const driftMs = computeDriftMs(actual, expected);

    let syncStatus: SyncStatus = 'in_sync';

    if (this.player.isBuffering()) {
      syncStatus = 'buffering';
    } else if (this.currentPlayback.status === 'playing') {
      const correction = resolveDriftCorrection(driftMs, expected);

      if (correction.type === 'ignore') {
        if (this.player.getPlaybackRate() !== RATE_NORMAL) {
          this.player.setPlaybackRate(RATE_NORMAL);
        }
        syncStatus = 'in_sync';
      } else if (correction.type === 'adjust_rate') {
        if (this.player.getPlaybackRate() !== correction.rate) {
          this.player.setPlaybackRate(correction.rate);
        }
        syncStatus = 'correcting';
      } else if (correction.type === 'seek') {
        this.player.seek(correction.targetPosition);
        this.player.setPlaybackRate(RATE_NORMAL);
        syncStatus = 'correcting';
      }
    } else {
      if (this.player.getPlaybackRate() !== RATE_NORMAL) {
        this.player.setPlaybackRate(RATE_NORMAL);
      }
      syncStatus = 'in_sync';
    }

    const metrics: SyncEngineMetrics = {
      rtt: this.clockTracker.getRtt(),
      offset: this.clockTracker.getOffset(),
      driftMs: Math.round(driftMs),
      syncStatus,
      actualPosition: Math.round(actual * 100) / 100,
      expectedPosition: Math.round(expected * 100) / 100,
      playbackRate: this.player.getPlaybackRate(),
      serverTime: estimatedNow
    };

    for (const listener of this.metricsListeners) {
      listener(metrics);
    }

    const now = Date.now();
    if (this.sendSyncReportCallback && (syncStatus !== this.lastReportedSyncStatus || now - this.lastReportTime >= 2000)) {
      this.lastReportedSyncStatus = syncStatus;
      this.lastReportTime = now;
      this.sendSyncReportCallback({
        rtt: metrics.rtt,
        drift: metrics.driftMs,
        position: metrics.actualPosition,
        syncStatus
      });
    }
  }
}
