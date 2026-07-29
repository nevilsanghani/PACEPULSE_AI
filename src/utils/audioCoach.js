/**
 * PacePulse AI - Web Speech Synthesis Audio Coach
 * Provides real-time voice announcements when step milestones or daily goals are reached
 */

let isAudioMuted = false;

export function setAudioCoachMuted(muted) {
  isAudioMuted = muted;
}

export function speakGoalReachedAnnouncement(goal, activeKcal) {
  if (isAudioMuted) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();
    const message = `Congratulations! You reached your daily goal of ${goal.toLocaleString()} steps and burned ${activeKcal} active calories! Amazing job!`;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("Audio coach error:", e);
  }
}

export function speakMilestoneAnnouncement(steps, activeKcal, goal) {
  if (isAudioMuted) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel();

    let message = "";
    if (steps >= goal) {
      message = `Awesome job! You reached your goal of ${goal.toLocaleString()} steps and burned ${activeKcal} active calories!`;
    } else {
      message = `Great pace! You reached ${steps.toLocaleString()} steps with ${activeKcal} active calories burned!`;
    }

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    utterance.volume = 0.9;

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("Audio coach error:", e);
  }
}
