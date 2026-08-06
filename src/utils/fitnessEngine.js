/**
 * PacePulse AI - High Precision Fitness & Calorie Engine
 * Grounded in exercise physiology (MET equations & Mifflin-St Jeor BMR)
 */

export const DEFAULT_PROFILE = {
  name: "My Profile",
  gender: "male", // 'male' | 'female' | 'other'
  birthDate: "2000-01-01", // Auto-calculates Age
  age: 26,
  weightKg: 70, // kg
  heightCm: 175, // cm
  dailyGoal: 10000,
  strideCm: 72.6,
  heightUnit: 'cm',
  weightUnit: 'kg',
  useAutoStride: true,
};

/**
 * Calculates exact age in years from birthDate string (YYYY-MM-DD)
 */
export function calculateAgeFromBirthDate(birthDateStr) {
  if (!birthDateStr) return 26;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return 26;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(1, age);
}

/**
 * Calculates stride length based on height and gender (in cm)
 */
export function calculateStrideCm(heightCm, gender) {
  const height = parseFloat(heightCm) || 175;
  if (gender === "female") return Math.round(height * 0.413 * 10) / 10;
  if (gender === "male") return Math.round(height * 0.415 * 10) / 10;
  return Math.round(height * 0.414 * 10) / 10;
}

/**
 * Calculates BMR using Mifflin-St Jeor Equation
 */
export function calculateBMR(weightKg, heightCm, ageOrBirthDate, gender) {
  const w = parseFloat(weightKg) || 70;
  const h = parseFloat(heightCm) || 175;
  
  const a = typeof ageOrBirthDate === 'string' && ageOrBirthDate.includes('-')
    ? calculateAgeFromBirthDate(ageOrBirthDate)
    : (parseFloat(ageOrBirthDate) || 25);
  
  const base = 10 * w + 6.25 * h - 5 * a;
  
  if (gender === "female") return base - 161;
  if (gender === "other") return base - 78;
  return base + 5; // male & default
}

/**
 * Determines MET based on steps per minute (cadence)
 */
export function getMETFromCadence(cadenceSpm) {
  if (cadenceSpm < 60) return 2.5; // Strolling
  if (cadenceSpm < 95) return 3.3; // Normal walk
  if (cadenceSpm < 115) return 4.3; // Brisk walk
  if (cadenceSpm < 130) return 5.5; // Fast fitness walk
  return 7.0; // Jogging / Running
}

/**
 * Calculates distance in KM from step count and stride length
 */
export function calculateDistanceKm(steps, strideCm) {
  const strideMeters = (parseFloat(strideCm) || 72.6) / 100;
  const distanceKm = (steps * strideMeters) / 1000;
  return Math.round(distanceKm * 100) / 100;
}

/**
 * Converts elevation gain in meters to approximate floors climbed (~3m per floor)
 */
export function metersToFloors(meters) {
  const m = parseFloat(meters) || 0;
  return Math.round((m / 3) * 10) / 10;
}

/**
 * Calculates active calories burned (STRICTLY EXCLUDES BMR RESTING ENERGY)
 */
export function calculateCalories(steps, profile, activeMinutes = null, cadence = 100) {
  const userAge = profile.birthDate 
    ? calculateAgeFromBirthDate(profile.birthDate)
    : (profile.age || 26);

  const bmrDaily = calculateBMR(profile.weightKg, profile.heightCm, userAge, profile.gender);
  const stride = profile.useAutoStride
    ? calculateStrideCm(profile.heightCm, profile.gender)
    : (profile.strideCm || 72.6);

  const distanceKm = calculateDistanceKm(steps, stride);

  if (!steps || steps <= 0) {
    return {
      totalKcal: 0,
      activeKcal: 0,
      restingKcal: 0,
      bmrDaily: Math.round(bmrDaily),
      distanceKm: 0,
      durationMins: 0,
      userAge
    };
  }

  // Active Duration in hours
  const durationMins = activeMinutes || steps / cadence;
  const durationHours = durationMins / 60;

  // Determine MET based on cadence
  const met = getMETFromCadence(cadence);

  // Active energy expenditure (Kcal) = MET * Weight(kg) * Hours (EXCLUDES BMR RESTING CALORIES)
  const activeKcal = met * profile.weightKg * durationHours;
  const restingKcal = (bmrDaily / 24) * durationHours;

  const activeKcalRounded = Math.round(activeKcal);

  return {
    totalKcal: activeKcalRounded,
    activeKcal: activeKcalRounded,
    restingKcal: Math.round(restingKcal),
    bmrDaily: Math.round(bmrDaily),
    distanceKm,
    durationMins: Math.round(durationMins),
    userAge
  };
}

/**
 * Generates empty 24-hour breakdown (0 steps for new users)
 */
export function generateEmptyHourlyData() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${i.toString().padStart(2, '0')}:00`,
    steps: 0
  }));
}

/**
 * Generates sample hourly breakdown for demo preview
 */
export function generateInitialHourlyData() {
  const hours = Array.from({ length: 24 }, (_, i) => {
    let steps = 0;
    if (i >= 7 && i <= 8) steps = Math.floor(Math.random() * 800) + 1200;
    else if (i >= 12 && i <= 13) steps = Math.floor(Math.random() * 400) + 700;
    else if (i >= 17 && i <= 19) steps = Math.floor(Math.random() * 1000) + 1800;
    else if (i >= 9 && i <= 16) steps = Math.floor(Math.random() * 250) + 150;
    else if (i >= 20 && i <= 22) steps = Math.floor(Math.random() * 200) + 100;
    else steps = 0;

    return {
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      steps
    };
  });
  return hours;
}

/**
 * AI Quote Generator
 */
export function getCelebrationQuote(steps, goal, streakDays) {
  const goalQuotes = [
    `Unstoppable! Reached my daily goal of ${steps.toLocaleString()} steps! 🚀💪`,
    `Crushed ${steps.toLocaleString()} steps today! Step by step, defining my fitness journey 🔥`,
    `Milestone unlocked! Hit my ${goal.toLocaleString()} steps daily target! 🏆✨`,
    `Felt the pulse, hit ${steps.toLocaleString()} steps! Energy levels 100% ⚡`,
    `Consistency in action: ${steps.toLocaleString()} steps conquered today! 🌟`
  ];

  const streakQuotes = [
    `🔥 1-WEEK STREAK UNLOCKED! 7 consecutive days hitting ${goal.toLocaleString()}+ steps! Persistence pays off! 🏅`,
    `🔥 7 Days of non-stop action! Completed a full 1-week walking streak! 💪⚡`,
    `🔥 Unstoppable Momentum! 7 Days straight of reaching step goals! 🚀`,
    `🔥 1-Week Fitness Mastery achieved! Stronger, fitter, faster every single day! 💎`
  ];

  if (streakDays >= 7) {
    const idx = Math.floor(Math.random() * streakQuotes.length);
    return streakQuotes[idx];
  } else {
    const idx = Math.floor(Math.random() * goalQuotes.length);
    return goalQuotes[idx];
  }
}
