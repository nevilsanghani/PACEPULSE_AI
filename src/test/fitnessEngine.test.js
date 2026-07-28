import { describe, it, expect } from 'vitest';
import { 
  calculateStrideCm, 
  calculateBMR, 
  getMETFromCadence, 
  calculateDistanceKm, 
  calculateCalories,
  generateInitialHourlyData,
  getCelebrationQuote
} from '../utils/fitnessEngine';

describe('PacePulse AI - Fitness & Calorie Engine Unit Tests', () => {

  describe('Stride Length Calculation', () => {
    it('should compute male stride length correctly (0.415 * height)', () => {
      const stride = calculateStrideCm(180, 'male');
      expect(stride).toBe(74.7);
    });

    it('should compute female stride length correctly (0.413 * height)', () => {
      const stride = calculateStrideCm(165, 'female');
      expect(stride).toBe(68.1);
    });

    it('should compute default/other stride length correctly', () => {
      const stride = calculateStrideCm(170, 'other');
      expect(stride).toBe(70.4);
    });
  });

  describe('BMR Energy Expenditure (Mifflin-St Jeor)', () => {
    it('should calculate male BMR accurately', () => {
      const bmr = calculateBMR(70, 175, 26, 'male');
      expect(bmr).toBe(1668.75);
    });

    it('should calculate female BMR accurately', () => {
      const bmr = calculateBMR(60, 165, 25, 'female');
      expect(bmr).toBe(1345.25);
    });
  });

  describe('Cadence & MET Mapping', () => {
    it('should return 2.5 MET for strolling (<60 spm)', () => {
      expect(getMETFromCadence(50)).toBe(2.5);
    });

    it('should return 3.3 MET for normal walk (60-94 spm)', () => {
      expect(getMETFromCadence(80)).toBe(3.3);
    });

    it('should return 4.3 MET for brisk walk (95-114 spm)', () => {
      expect(getMETFromCadence(105)).toBe(4.3);
    });

    it('should return 5.5 MET for fast fitness walk (115-129 spm)', () => {
      expect(getMETFromCadence(120)).toBe(5.5);
    });

    it('should return 7.0 MET for jogging/running (>=130 spm)', () => {
      expect(getMETFromCadence(140)).toBe(7.0);
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate accurate distance in km for 10,000 steps', () => {
      const km = calculateDistanceKm(10000, 72.6);
      expect(km).toBe(7.26);
    });

    it('should handle zero steps gracefully', () => {
      const km = calculateDistanceKm(0, 72.6);
      expect(km).toBe(0);
    });
  });

  describe('High-Precision Calorie Calculation', () => {
    const mockProfile = {
      gender: 'male',
      age: 26,
      weightKg: 70,
      heightCm: 175,
      dailyGoal: 10000,
      strideCm: 72.6,
      useAutoStride: true
    };

    it('should calculate zero calories for 0 steps', () => {
      const res = calculateCalories(0, mockProfile);
      expect(res.totalKcal).toBe(0);
      expect(res.distanceKm).toBe(0);
    });

    it('should calculate gross calories for 10,000 steps', () => {
      const res = calculateCalories(10000, mockProfile);
      expect(res.totalKcal).toBeGreaterThan(300);
      expect(res.distanceKm).toBe(7.26);
      expect(res.durationMins).toBe(100);
    });
  });

  describe('24-Hour Hourly Breakdown Data', () => {
    it('should generate exactly 24 hourly entries', () => {
      const data = generateInitialHourlyData();
      expect(data).toHaveLength(24);
      expect(data[0].hour).toBe(0);
      expect(data[23].hour).toBe(23);
      expect(data[12].label).toBe('12:00');
    });
  });

  describe('AI Celebration Quotes Generator', () => {
    it('should return goal quote when streak is under 7 days', () => {
      const quote = getCelebrationQuote(10000, 10000, 3);
      expect(quote).toMatch(/steps/i);
    });

    it('should return 1-WEEK STREAK quote when streak is 7+ days', () => {
      const quote = getCelebrationQuote(10000, 10000, 7);
      expect(quote).toMatch(/1-?Week|7 Days|Streak/i);
    });
  });

});
