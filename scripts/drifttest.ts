import {
  computeExpectedPosition,
  computeDriftMs,
  resolveDriftCorrection,
  RoomPlaybackState,
  RATE_NORMAL
} from '@watch-party/shared';

interface DriftSimulationResult {
  scenario: string;
  initialDriftMs: number;
  finalDriftMs: number;
  convergenceTimeMs: number;
  steps: number;
  passed: boolean;
}

function runDriftSimulation(
  scenario: string,
  initialDriftMs: number,
  simulationDurationSec: number = 20
): DriftSimulationResult {
  const serverStart = 100000;
  const playback: RoomPlaybackState = {
    videoId: 'bunny',
    videoUrl: 'http://example.com/video.mp4',
    title: 'Bunny',
    status: 'playing',
    positionAtRef: 10.0,
    serverTimeAtRef: serverStart,
    playbackRate: 1.0,
    version: 1,
    scheduledStartTime: null,
    bufferingParticipants: []
  };

  let simulatedLocalTime = serverStart;
  let playerActualPos = playback.positionAtRef + initialDriftMs / 1000;
  let playerRate = RATE_NORMAL;

  const dtSec = 0.5;
  const dtMs = dtSec * 1000;
  let converged = false;
  let convergenceTimeMs = simulationDurationSec * 1000;
  let step = 0;

  const maxSteps = Math.floor(simulationDurationSec / dtSec);

  for (step = 0; step < maxSteps; step++) {
    simulatedLocalTime += dtMs;
    playerActualPos += dtSec * playerRate;

    const expectedPos = computeExpectedPosition(playback, simulatedLocalTime);
    const driftMs = computeDriftMs(playerActualPos, expectedPos);

    if (Math.abs(driftMs) <= 80 && !converged) {
      converged = true;
      convergenceTimeMs = (step + 1) * dtMs;
    }

    const action = resolveDriftCorrection(driftMs, expectedPos);
    if (action.type === 'ignore') {
      playerRate = RATE_NORMAL;
    } else if (action.type === 'adjust_rate') {
      playerRate = action.rate;
    } else if (action.type === 'seek') {
      playerActualPos = action.targetPosition;
      playerRate = RATE_NORMAL;
    }
  }

  const finalExpected = computeExpectedPosition(playback, simulatedLocalTime);
  const finalDriftMs = Math.round(computeDriftMs(playerActualPos, finalExpected));

  return {
    scenario,
    initialDriftMs,
    finalDriftMs,
    convergenceTimeMs,
    steps: step,
    passed: Math.abs(finalDriftMs) <= 500
  };
}

async function main(): Promise<void> {
  console.log(`=======================================================`);
  console.log(`  WATCH PARTY DRIFT DETECTION & CORRECTION TEST`);
  console.log(`  Hard Constraint 3: Playback drift <= 500 ms`);
  console.log(`=======================================================\n`);

  const scenarios = [
    { name: 'Slight positive drift (client slightly ahead)', drift: 120 },
    { name: 'Moderate positive drift', drift: 450 },
    { name: 'Slight negative drift (client slightly behind)', drift: -180 },
    { name: 'Moderate negative drift', drift: -650 },
    { name: 'Significant drift near tier boundary', drift: 1400 },
    { name: 'Severe drift exceeding tier (requires hard seek)', drift: 2800 },
    { name: 'Severe negative drift (tab backgrounded/buffer stall)', drift: -3500 }
  ];

  const results: DriftSimulationResult[] = [];
  for (const s of scenarios) {
    const res = runDriftSimulation(s.name, s.drift);
    results.push(res);
    console.log(`[Scenario] ${s.name}`);
    console.log(`  Initial Drift:       ${s.drift > 0 ? `+${s.drift}` : s.drift} ms`);
    console.log(`  Final Drift:         ${res.finalDriftMs > 0 ? `+${res.finalDriftMs}` : res.finalDriftMs} ms`);
    console.log(`  Convergence Time:    ${res.convergenceTimeMs} ms (${(res.convergenceTimeMs / 1000).toFixed(1)}s)`);
    console.log(`  Constraint Met:      ${res.passed ? 'PASSED (<= 500ms)' : 'FAILED'}\n`);
  }

  const allPassed = results.every(r => r.passed);
  console.log(`=======================================================`);
  console.log(`  DRIFT TEST SUMMARY`);
  console.log(`  All Scenarios Passed: ${allPassed ? 'YES' : 'NO'}`);
  console.log(`  Max Residual Drift:   ${Math.max(...results.map(r => Math.abs(r.finalDriftMs)))} ms`);
  console.log(`=======================================================\n`);

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
