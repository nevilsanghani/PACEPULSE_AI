import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { StepRing } from '../components/StepRing';
import { HourlyChart } from '../components/HourlyChart';
import { StreakTracker } from '../components/StreakTracker';
import { ProfileModal } from '../components/ProfileModal';
import { ShareModal } from '../components/ShareModal';
import { DEFAULT_PROFILE } from '../utils/fitnessEngine';

describe('PacePulse AI - Component & Integration Unit Tests', () => {

  describe('<StepRing /> Dashboard Component', () => {
    const mockCaloriesData = {
      totalKcal: 420,
      activeKcal: 350,
      distanceKm: 7.26,
      durationMins: 100
    };

    it('renders step count, goal, distance, and calories accurately', () => {
      render(
        <StepRing
          steps={10000}
          goal={10000}
          caloriesData={mockCaloriesData}
          onOpenResetModal={vi.fn()}
          onOpenShareModal={vi.fn()}
          isGoalReached={true}
        />
      );

      expect(screen.getByText('10,000')).toBeDefined();
      expect(screen.getByText('420')).toBeDefined();
      expect(screen.getByText('7.26')).toBeDefined();
      expect(screen.getByText(/100% Complete/i)).toBeDefined();
      expect(screen.getByText(/Goal Achieved!/i)).toBeDefined();
    });

    it('triggers reset modal on Reset Steps & Streak click', () => {
      const handleOpenResetModal = vi.fn();
      render(
        <StepRing
          steps={5000}
          goal={10000}
          caloriesData={mockCaloriesData}
          onOpenResetModal={handleOpenResetModal}
          onOpenShareModal={vi.fn()}
          isGoalReached={false}
        />
      );

      const btn = screen.getByText(/Reset Steps & Streak/i);
      fireEvent.click(btn);
      expect(handleOpenResetModal).toHaveBeenCalled();
    });
  });

  describe('<HourlyChart /> 24-Hour Breakdown Component', () => {
    const mockHourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      steps: i === 18 ? 2500 : 100
    }));

    it('renders 24-hour step chart and correctly highlights peak hour (18:00)', () => {
      render(<HourlyChart hourlyData={mockHourlyData} currentHour={14} />);
      expect(screen.getByText(/Hourly Step Breakdown/i)).toBeDefined();
      expect(screen.getByText(/Peak: 18:00 \(2,500 steps\)/i)).toBeDefined();
    });
  });

  describe('<StreakTracker /> Streak Milestone Component', () => {
    const mockHistory = Array.from({ length: 7 }, () => ({ completed: true, steps: 10000 }));

    it('displays 1-week streak unlocked badge when streak is 7 days', () => {
      render(
        <StreakTracker
          streakDays={7}
          history={mockHistory}
          dailyGoal={10000}
          onOpenShareModal={vi.fn()}
        />
      );

      expect(screen.getByText(/1-Week Streak Unlocked!/i)).toBeDefined();
      expect(screen.getByText(/7-Day Titan/i)).toBeDefined();
    });
  });

  describe('<ProfileModal /> Setup Component', () => {
    it('updates weight and height inputs and triggers save', () => {
      const handleSave = vi.fn();
      render(
        <ProfileModal
          profile={DEFAULT_PROFILE}
          onSave={handleSave}
          onClose={vi.fn()}
        />
      );

      const submitBtn = screen.getByText(/Update Profile & Goals/i);
      fireEvent.click(submitBtn);
      expect(handleSave).toHaveBeenCalled();
    });
  });

  describe('<ShareModal /> WhatsApp & Instagram Post Creator', () => {
    const mockCaloriesData = {
      totalKcal: 420,
      activeKcal: 350,
      distanceKm: 7.26,
      durationMins: 100
    };

    it('renders social post creator modal with WhatsApp and Instagram buttons', () => {
      render(
        <ShareModal
          steps={10000}
          goal={10000}
          streakDays={7}
          caloriesData={mockCaloriesData}
          profile={DEFAULT_PROFILE}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText(/Social Media Post Creator/i)).toBeDefined();
      expect(screen.getByText(/Post to WhatsApp/i)).toBeDefined();
      expect(screen.getByText(/Instagram Story Card/i)).toBeDefined();
    });
  });

});
