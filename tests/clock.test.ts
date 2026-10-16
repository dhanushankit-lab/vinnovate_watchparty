import { describe, it, expect } from 'vitest';
import {
  calculateNtpSample,
  filterMedianOffset,
  ClockSyncTracker,
  computeExpectedPosition,
  computeDriftMs,
  resolveDriftCorrection,
  NtpSample
} from '../shared/src/clock';
import { RoomPlaybackState } from '../shared/src/types';

describe('NTP Clock Synchronization', () => {
  it('calculates round-trip time and clock offset accurately', () => {
    const t0 = 1000;
    const t1 = 1050;
    const t2 = 1055;
    const t3 = 1105;

    const sample = calculateNtpSample(t0, t1, t2, t3);
    expect(sample.rtt).toBe(100);
    expect(sample.offset).toBe(0);
  });

  it('handles asymmetric delays and positive clock offset', () => {
    const t0 = 1000;
    const t1 = 1200;
    const t2 = 1205;
    const t3 = 1225;

    const sample = calculateNtpSample(t0, t1, t2, t3);
    expect(sample.rtt).toBe(220);
    expect(sample.offset).toBe(90);
  });

  it('filters out high-RTT outliers and calculates median offset', () => {
    const samples: NtpSample[] = [
      { clientSendTime: 100, serverReceiveTime: 150, serverSendTime: 150, clientReceiveTime: 200, rtt: 100, offset: 50 },
      { clientSendTime: 200, serverReceiveTime: 252, serverSendTime: 252, clientReceiveTime: 304, rtt: 104, offset: 52 },
      { clientSendTime: 300, serverReceiveTime: 420, serverSendTime: 420, clientReceiveTime: 650, rtt: 350, offset: 120 },
      { clientSendTime: 400, serverReceiveTime: 449, serverSendTime: 449, clientReceiveTime: 502, rtt: 102, offset: 49 },
      { clientSendTime: 500, serverReceiveTime: 551, serverSendTime: 551, clientReceiveTime: 601, rtt: 100, offset: 51 }
    ];

    const result = filterMedianOffset(samples);
    expect(result.offset).toBeGreaterThanOrEqual(49);
    expect(result.offset).toBeLessThanOrEqual(52);
    expect(result.rtt).toBeLessThanOrEqual(104);
  });

  it('ClockSyncTracker tracks rolling window of samples', () => {
    const tracker = new ClockSyncTracker(5);
    tracker.recordSample({
      clientSendTime: 1000,
      serverReceiveTime: 1100,
      serverSendTime: 1100,
      clientReceiveTime: 1200,
      rtt: 200,
      offset: 100
    });

    expect(tracker.getOffset()).toBe(100);
    expect(tracker.getRtt()).toBe(200);
    expect(tracker.estimateServerTime(2000)).toBe(2100);
  });
});

describe('Expected Position and Drift Correction', () => {
  const basePlayback: RoomPlaybackState = {
    videoId: 'test-vid',
    videoUrl: 'http://example.com/video.mp4',
    title: 'Test Video',
    status: 'paused',
    positionAtRef: 12.5,
    serverTimeAtRef: 10000,
    playbackRate: 1.0,
    version: 1,
    scheduledStartTime: null,
    bufferingParticipants: []
  };

  it('keeps static position when paused', () => {
    const pos = computeExpectedPosition(basePlayback, 15000);
    expect(pos).toBe(12.5);
  });

  it('holds position before scheduled start time', () => {
    const playingWithSchedule: RoomPlaybackState = {
      ...basePlayback,
      status: 'playing',
      scheduledStartTime: 12000
    };

    const beforeStart = computeExpectedPosition(playingWithSchedule, 11000);
    expect(beforeStart).toBe(12.5);

    const afterStart = computeExpectedPosition(playingWithSchedule, 14000);
    expect(afterStart).toBe(14.5);
  });

  it('calculates drift in milliseconds correctly', () => {
    const drift = computeDriftMs(10.2, 10.0);
    expect(drift).toBeCloseTo(200, 1);
  });

  it('resolves drift tier: ignores drift under 80ms', () => {
    const action = resolveDriftCorrection(50, 20.0);
    expect(action.type).toBe('ignore');

    const actionNeg = resolveDriftCorrection(-75, 20.0);
    expect(actionNeg.type).toBe('ignore');
  });

  it('resolves drift tier: adjusts playback rate between 80ms and 1500ms', () => {
    const ahead = resolveDriftCorrection(250, 20.0);
    expect(ahead.type).toBe('adjust_rate');
    if (ahead.type === 'adjust_rate') {
      expect(ahead.rate).toBe(0.95);
    }

    const behind = resolveDriftCorrection(-400, 20.0);
    expect(behind.type).toBe('adjust_rate');
    if (behind.type === 'adjust_rate') {
      expect(behind.rate).toBe(1.05);
    }
  });

  it('resolves drift tier: hard seeks when drift exceeds 1500ms', () => {
    const action = resolveDriftCorrection(2400, 45.0);
    expect(action.type).toBe('seek');
    if (action.type === 'seek') {
      expect(action.targetPosition).toBe(45.0);
    }
  });
});
