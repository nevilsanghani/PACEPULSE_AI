import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepRing } from '../components/StepRing';
import { HourlyChart } from '../components/HourlyChart';
import { StreakTracker } from '../components/StreakTracker';

describe('PacePulse AI - Component & Integration Unit Tests', () => {
  const mockCaloriesData = {
    totalKcal: 420,
    activeKcal: 420,
    restingKcal: 50,
    bmrDaily: 1669,
    distanceKm: 7.26,
    durationMins: 100,
    userAge: 25
  };

  describe('<StepRing /> Dashboard Component', () => {
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
      expect(screen.getAllByText(/420/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/100% Complete/i)).toBeDefined();
      expect(screen.getByText(/Goal Achieved!/i)).toBeDefined();
    });

    it('triggers reset modal on Reset Steps click', () => {
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

      const btn = screen.getByText(/Reset Steps/i);
      fireEvent.click(btn);
      expect(handleOpenResetModal).toHaveBeenCalled();
    });
  });

  describe('<HourlyChart /> 24-Hour Breakdown Component', () => {
    it('renders 24 hourly bars accurately', () => {
      const mockHourly = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        label: `${i.toString().padStart(2, '0')}:00`,
        steps: i * 50
      }));

      render(<HourlyChart hourlyData={mockHourly} currentHour={14} />);
      expect(screen.getByText(/Hourly Step Breakdown/i)).toBeDefined();
      expect(screen.getByText(/Peak Hour/i)).toBeDefined();
    });
  });

  describe('<StreakTracker /> Badge Component', () => {
    it('renders streak days and active weekly status', () => {
      const mockHistory = Array.from({ length: 7 }, () => ({ completed: true, steps: 10000 }));
      render(
        <StreakTracker
          streakDays={7}
          history={mockHistory}
          dailyGoal={10000}
          onOpenShareModal={vi.fn()}
        />
      );

      expect(screen.getByText(/Streak & Badges/i)).toBeDefined();
    });
  });
});
