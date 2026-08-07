/**
 * Reconciles a raw reading from the native step sensor against what's currently
 * displayed, and returns how many steps (if any) should be added to the current
 * hour bucket. Pulled out as a pure function specifically so every scenario that
 * has broken in production can be pinned down with an automated test, rather
 * than reasoned about by eye inside a React effect closure.
 *
 * Ground rules this function must uphold, in order of priority:
 *  1. The displayed total must never decrease. A native reading lower than what
 *     was last seen means native's own local baseline was reset (e.g. a full
 *     uninstall wipes the SharedPreferences it lives in) - it is never grounds
 *     to subtract from the display.
 *  2. A correctly cloud-restored total must never be clobbered by a fresh/lower
 *     native reading arriving after it.
 *  3. Real steps must never be silently discarded - including steps native
 *     already recorded before its very first reading of a session reaches this
 *     function (e.g. taken during the brief window before the ready-gate opened).
 *
 * @param {object} params
 * @param {number|null} params.previousNativeTotal - the last raw value native
 *   reported this session, or null if this is the first reading this session.
 * @param {number} params.totalSteps - native's current raw "steps today" reading.
 * @param {number} params.currentTotal - the total currently reflected in
 *   hourlyData (may include a cloud-restored total native doesn't know about).
 * @returns {number} how many steps to add to the current hour bucket (>= 0).
 */
export function computeStepDelta({ previousNativeTotal, totalSteps, currentTotal }) {
  if (previousNativeTotal === null) {
    // Never subtract - only add whatever portion of native's count isn't
    // reflected in the currently-displayed total yet.
    return Math.max(totalSteps - currentTotal, 0);
  }

  if (totalSteps < previousNativeTotal) {
    // Native's own count dropped below what we last saw - re-anchor without
    // touching the display.
    return 0;
  }

  return Math.max(totalSteps - previousNativeTotal, 0);
}
