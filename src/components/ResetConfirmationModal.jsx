import React from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';

export function ResetConfirmationModal({ onConfirmReset, onClose }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(4, 9, 20, 0.88)',
      backdropFilter: 'blur(14px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 300,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '28px 24px',
        position: 'relative',
        textAlign: 'center',
        border: '1px solid rgba(239, 68, 68, 0.3)'
      }}>
        {/* Close Icon */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        {/* Danger Warning Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)'
        }}>
          <AlertTriangle size={28} color="#EF4444" />
        </div>

        {/* Title */}
        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>
          Reset Steps & Streaks?
        </h3>

        {/* Description */}
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '24px' }}>
          Are you sure you want to reset today's step count back to <strong>0 steps</strong> and clear your active streak history? This action cannot be undone.
        </p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={onConfirmReset}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
              color: '#FFFFFF',
              fontWeight: '700',
              padding: '12px 18px',
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '14px',
              boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)'
            }}
          >
            <RotateCcw size={16} /> Yes, Reset Everything
          </button>

          <button 
            onClick={onClose}
            className="btn-secondary"
            style={{ flex: 1 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
