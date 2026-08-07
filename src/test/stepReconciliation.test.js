import { describe, it, expect } from 'vitest';
import { computeStepDelta } from '../utils/stepReconciliation';

/**
 * Simulates a live session: feeds a sequence of raw native readings through
 * computeStepDelta exactly like the App.jsx handler does, tracking the
 * running displayed total the same way (add the returned delta to "now").
 * Returns the full history of displayed totals, one per call.
 */
function simulateSession(readings, initialDisplayedTotal = 0) {
  let previousNativeTotal = null;
  let displayedTotal = initialDisplayedTotal;
  const history = [];

  for (const totalSteps of readings) {
    const delta = computeStepDelta({ previousNativeTotal, totalSteps, currentTotal: displayedTotal });
    displayedTotal += delta;
    previousNativeTotal = totalSteps;
    history.push(displayedTotal);
  }

  return history;
}

describe('computeStepDelta', () => {
  it('adds nothing on a fresh session with no steps yet', () => {
    expect(computeStepDelta({ previousNativeTotal: null, totalSteps: 0, currentTotal: 0 })).toBe(0);
  });

  it('shows real steps already taken before the first reading reaches the app (the 74-shows-as-0 bug)', () => {
    // This is the exact bug reported live: native had genuinely recorded 74
    // steps by the time its first reading passed the ready-gate, but the
    // previous logic treated the first reading as a reference point only and
    // never added it, so the display stayed at 0 instead of showing 74.
    expect(computeStepDelta({ previousNativeTotal: null, totalSteps: 74, currentTotal: 0 })).toBe(74);
  });

  it('preserves a cloud-restored total when native resets to 0 after a reinstall', () => {
    // hourlyData already shows 143 (restored from Firestore); native's local
    // baseline was just wiped by an uninstall and its first reading is 0.
    expect(computeStepDelta({ previousNativeTotal: null, totalSteps: 0, currentTotal: 143 })).toBe(0);
  });

  it('does not reduce a cloud-restored total when native has not caught up to it yet', () => {
    expect(computeStepDelta({ previousNativeTotal: null, totalSteps: 50, currentTotal: 143 })).toBe(0);
  });

  it('adds the shortfall when native\'s first reading already exceeds the cloud-restored total', () => {
    // 7 genuine steps happened since the cloud total of 143 was recorded.
    expect(computeStepDelta({ previousNativeTotal: null, totalSteps: 150, currentTotal: 143 })).toBe(7);
  });

  it('adds the normal incremental delta during continuous walking', () => {
    expect(computeStepDelta({ previousNativeTotal: 74, totalSteps: 86, currentTotal: 74 })).toBe(12);
  });

  it('is a no-op on a duplicate tick reporting the same value', () => {
    expect(computeStepDelta({ previousNativeTotal: 74, totalSteps: 74, currentTotal: 74 })).toBe(0);
  });

  it('never subtracts when native\'s count drops below what was last seen mid-session', () => {
    expect(computeStepDelta({ previousNativeTotal: 100, totalSteps: 0, currentTotal: 100 })).toBe(0);
  });

  it('never returns a negative delta under any input combination', () => {
    const cases = [
      { previousNativeTotal: null, totalSteps: 0, currentTotal: 500 },
      { previousNativeTotal: 500, totalSteps: 0, currentTotal: 500 },
      { previousNativeTotal: 10, totalSteps: 5, currentTotal: 10 },
      { previousNativeTotal: 0, totalSteps: 0, currentTotal: 0 }
    ];
    for (const c of cases) {
      expect(computeStepDelta(c)).toBeGreaterThanOrEqual(0);
    }
  });

  describe('full session simulations', () => {
    it('reproduces the exact reported bug scenario and confirms the fix', () => {
      // App reopened mid-session; native's first reading to pass the ready-gate
      // was already 74 (real steps taken during the brief startup window),
      // then the user kept walking and native's next reading was 86.
      // Reported broken behavior: display showed 0, then regressed/settled at 12
      // (only the post-baseline delta), losing the original 74 entirely.
      const history = simulateSession([74, 86]);
      expect(history[0]).toBe(74); // must show the real steps immediately, not 0
      expect(history[1]).toBe(86); // then accumulate correctly, not just +12
    });

    it('never decreases across a long, realistic walking session', () => {
      const readings = [0, 3, 3, 9, 20, 20, 45, 45, 45, 80, 80, 120];
      const history = simulateSession(readings);
      for (let i = 1; i < history.length; i++) {
        expect(history[i]).toBeGreaterThanOrEqual(history[i - 1]);
      }
      expect(history[history.length - 1]).toBe(120);
    });

    it('never decreases across a reinstall mid-comparison (native resets, cloud total preserved, then real walking resumes)', () => {
      // Session 1: normal walking up to 143, matching what was actually
      // observed live before the reinstall test.
      const beforeReinstall = simulateSession([0, 41, 143]);
      expect(beforeReinstall[beforeReinstall.length - 1]).toBe(143);

      // Reinstall happens (new JS session, previousNativeTotal resets to
      // null), Firestore restore brings the displayed total back to 143
      // before any native reading arrives, then native reports its own
      // fresh-baseline sequence starting from 0.
      const afterReinstall = simulateSession([0, 5, 12], 143);
      for (let i = 0; i < afterReinstall.length; i++) {
        expect(afterReinstall[i]).toBeGreaterThanOrEqual(143);
      }
      expect(afterReinstall[afterReinstall.length - 1]).toBe(143 + 12);
    });

    it('handles a mid-session native process restart (app backgrounded and killed by the OS) without losing steps', () => {
      // Walked up to 60, then the OS killed the app process and restarted it
      // without a full uninstall - native's SharedPreferences baseline survives
      // (unlike a real uninstall), so its readings should already reflect 60+
      // and continue climbing normally. This models previousNativeTotal
      // resetting to null (fresh JS session) while native's own counter did NOT reset.
      const history = simulateSession([60, 61, 65], 60);
      expect(history[0]).toBe(60);
      expect(history[history.length - 1]).toBe(65);
    });
  });
});
