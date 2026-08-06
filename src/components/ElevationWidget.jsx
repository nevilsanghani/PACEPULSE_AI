import React from 'react';
import { Mountain, TrendingUp } from 'lucide-react';
import { metersToFloors } from '../utils/fitnessEngine';

export function ElevationWidget({ elevationM = 0, supported = true }) {
  const floors = metersToFloors(elevationM);

  return (
    <div className="glass-panel" style={{ padding: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'rgba(16, 185, 129, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(16, 185, 129, 0.25)'
        }}>
          <Mountain size={20} color="#10B981" />
        </div>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Elevation Gain</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Real climb, not the lift or the car 🏔️
          </p>
        </div>
      </div>

      {supported ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              METERS CLIMBED TODAY
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '40px', fontWeight: '800', lineHeight: 1 }}>
                {Math.round(elevationM || 0)}
              </span>
              <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-muted)' }}>m</span>
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '20px',
            padding: '6px 14px',
            marginBottom: '4px'
          }}>
            <TrendingUp size={14} color="#10B981" />
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#34D399' }}>
              ≈ {floors} floors
            </span>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Barometer not available on this device — elevation tracking isn't supported here.
        </p>
      )}
    </div>
  );
}
