import {
  DRIFT_IGNORE_THRESHOLD_MS,
  DRIFT_SEEK_THRESHOLD_MS,
  RATE_ADJUST_FAST,
  RATE_ADJUST_SLOW,
  RATE_NORMAL
} from './constants.js';
import { RoomPlaybackState } from './types.js';

export interface NtpSample {
  clientSendTime: number;
  serverReceiveTime: number;
  serverSendTime: number;
  clientReceiveTime: number;
  rtt: number;
  offset: number;
}

export function calculateNtpSample(
  clientSendTime: number,
  serverReceiveTime: number,
  serverSendTime: number,
  clientReceiveTime: number
): NtpSample {
  const rtt = Math.max(0, (clientReceiveTime - clientSendTime) - (serverSendTime - serverReceiveTime));
  const offset = ((serverReceiveTime - clientSendTime) + (serverSendTime - clientReceiveTime)) / 2;
  return {
    clientSendTime,
    serverReceiveTime,
    serverSendTime,
    clientReceiveTime,
    rtt,
    offset
  };
}

export function filterMedianOffset(samples: NtpSample[]): { offset: number; rtt: number } {
  if (samples.length === 0) {
    return { offset: 0, rtt: 0 };
  }

  const sortedByRtt = [...samples].sort((a, b) => a.rtt - b.rtt);
  const bestSamples = sortedByRtt.slice(0, Math.max(1, Math.ceil(sortedByRtt.length * 0.6)));

  const sortedOffsets = bestSamples.map(s => s.offset).sort((a, b) => a - b);
  const mid = Math.floor(sortedOffsets.length / 2);
  const medianOffset = sortedOffsets.length % 2 !== 0
    ? sortedOffsets[mid]
    : (sortedOffsets[mid - 1] + sortedOffsets[mid]) / 2;

  const medianRtt = bestSamples[Math.floor(bestSamples.length / 2)].rtt;

  return {
    offset: Math.round(medianOffset),
    rtt: Math.round(medianRtt)
  };
}

export class ClockSyncTracker {
  private samples: NtpSample[] = [];
  private maxSamples: number;
  private currentOffset: number = 0;
  private currentRtt: number = 0;

  constructor(maxSamples: number = 10) {
    this.maxSamples = maxSamples;
  }

  public recordSample(sample: NtpSample): { offset: number; rtt: number } {
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
    const filtered = filterMedianOffset(this.samples);
    this.currentOffset = filtered.offset;
    this.currentRtt = filtered.rtt;
    return filtered;
  }

  public getOffset(): number {
    return this.currentOffset;
  }

  public getRtt(): number {
    return this.currentRtt;
  }

  public estimateServerTime(localTime: number = Date.now()): number {
    return localTime + this.currentOffset;
  }

  public reset(): void {
    this.samples = [];
    this.currentOffset = 0;
    this.currentRtt = 0;
  }
}

export function computeExpectedPosition(
  playback: RoomPlaybackState,
  estimatedServerTimeMs: number
): number {
  if (playback.status === 'paused' || playback.status === 'buffering') {
    return playback.positionAtRef;
  }

  if (playback.scheduledStartTime && estimatedServerTimeMs < playback.scheduledStartTime) {
    return playback.positionAtRef;
  }

  const referenceTime = playback.scheduledStartTime ?? playback.serverTimeAtRef;
  const elapsedMs = Math.max(0, estimatedServerTimeMs - referenceTime);
  const position = playback.positionAtRef + (elapsedMs / 1000) * (playback.playbackRate || 1.0);
  return position;
}

export function computeDriftMs(actualPositionSec: number, expectedPositionSec: number): number {
  return (actualPositionSec - expectedPositionSec) * 1000;
}

export type DriftCorrectionAction =
  | { type: 'ignore'; driftMs: number }
  | { type: 'adjust_rate'; rate: number; driftMs: number }
  | { type: 'seek'; targetPosition: number; driftMs: number };

export function resolveDriftCorrection(
  driftMs: number,
  expectedPositionSec: number
): DriftCorrectionAction {
  const absDrift = Math.abs(driftMs);

  if (absDrift <= DRIFT_IGNORE_THRESHOLD_MS) {
    return { type: 'ignore', driftMs };
  }

  if (absDrift <= DRIFT_SEEK_THRESHOLD_MS) {
    const rate = driftMs > 0 ? RATE_ADJUST_SLOW : RATE_ADJUST_FAST;
    return { type: 'adjust_rate', rate, driftMs };
  }

  return { type: 'seek', targetPosition: expectedPositionSec, driftMs };
}
