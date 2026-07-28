import React, { useState } from 'react';
import { BarChart3, Zap, Clock, TrendingUp } from 'lucide-react';

export function HourlyChart({ hourlyData, currentHour }) {
  const [hoveredHour, setHoveredHour] = useState(null);

  // Find max steps in any hour for relative height calculation
  const maxSteps = Math.max(...hourlyData.map(h => h.steps), 100);

  // Calculate peak hour
  const peak = hourlyData.reduce((prev, curr) => (curr.steps > prev.steps ? curr : prev), hourlyData[0]);

  // Total steps calculated from hourly sum
  const totalHourlySum = hourlyData.reduce((sum, h) => sum + h.steps, 0);

  const activeHour = hoveredHour !== null ? hourlyData[hoveredHour] : hourlyData[currentHour] || hourlyData[12];

  return (
    <div className="glass-panel" style={{ padding: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(0, 242, 254, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(0, 242, 254, 0.25)'
          }}>
            <BarChart3 size={20} color="#00F2FE" />
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Hourly Step Breakdown</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>24-Hour Walk Distribution</p>
          </div>
        </div>

        {/* Peak Hour Badge */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          padding: '6px 14px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Zap size={14} color="#F59E0B" />
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#FCD34D' }}>
            Peak: {peak.label} ({peak.steps.toLocaleString()} steps)
          </span>
        </div>
      </div>

      {/* Selected Hour Details Box */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: '16px',
        padding: '14px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Clock size={18} color="#00F2FE" />
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Time Slot: {activeHour.label} - {(activeHour.hour + 1).toString().padStart(2, '0')}:00
            </span>
            <p style={{ fontSize: '18px', fontWeight: '800', color: '#00F2FE' }}>
              {activeHour.steps.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-main)' }}>steps</span>
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Share of Day</span>
          <p style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>
            {totalHourlySum > 0 ? Math.round((activeHour.steps / totalHourlySum) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Bar Chart Canvas Grid */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '6px',
        height: '160px',
        paddingTop: '20px',
        paddingBottom: '24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        position: 'relative'
      }}>
        {hourlyData.map((item) => {
          const isPeak = item.hour === peak.hour && item.steps > 0;
          const isCurrent = item.hour === currentHour;
          const heightPercent = Math.max(6, Math.round((item.steps / maxSteps) * 100));

          return (
            <div
              key={item.hour}
              onMouseEnter={() => setHoveredHour(item.hour)}
              onMouseLeave={() => setHoveredHour(null)}
              style={{
                flex: 1,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              {/* Bar Fill */}
              <div style={{
                width: '100%',
                height: `${heightPercent}%`,
                borderRadius: '6px 6px 3px 3px',
                background: isPeak 
                  ? 'linear-gradient(180deg, #F59E0B 0%, #D97706 100%)'
                  : isCurrent
                  ? 'linear-gradient(180deg, #10B981 0%, #059669 100%)'
                  : item.steps > 0
                  ? 'linear-gradient(180deg, #00F2FE 0%, #3B82F6 100%)'
                  : 'rgba(255, 255, 255, 0.04)',
                boxShadow: (isPeak || isCurrent || hoveredHour === item.hour)
                  ? '0 0 12px rgba(0, 242, 254, 0.5)'
                  : 'none',
                transition: 'all 0.3s ease',
                opacity: hoveredHour !== null && hoveredHour !== item.hour ? 0.4 : 1
              }} />

              {/* Hour Label (Shown every 3 hours) */}
              {(item.hour % 3 === 0) && (
                <span style={{
                  fontSize: '10px',
                  color: isCurrent ? '#10B981' : 'var(--text-dim)',
                  position: 'absolute',
                  bottom: '-20px',
                  fontWeight: isCurrent ? '700' : '500'
                }}>
                  {item.hour}h
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#00F2FE' }} />
          <span>Steps</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10B981' }} />
          <span>Current Hour</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#F59E0B' }} />
          <span>Peak Hour</span>
        </div>
      </div>
    </div>
  );
}
