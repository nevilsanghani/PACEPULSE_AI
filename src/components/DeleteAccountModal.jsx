import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export function DeleteAccountModal({ userEmail, onConfirmDelete, onClose }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const canDelete = confirmText.trim().toUpperCase() === 'DELETE';

  const handleDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    setErrorMsg('');
    const result = await onConfirmDelete();
    if (result && result.success === false) {
      setErrorMsg(result.error || 'Could not delete your account right now. Please try again.');
      setDeleting(false);
    }
  };

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
      zIndex: 350,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '28px 24px',
        position: 'relative',
        textAlign: 'center',
        border: '1px solid rgba(239, 68, 68, 0.35)'
      }}>
        <button
          onClick={onClose}
          disabled={deleting}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: deleting ? 'not-allowed' : 'pointer'
          }}
        >
          <X size={20} />
        </button>

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

        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>
          Delete Your Account?
        </h3>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '4px' }}>
          This permanently deletes <strong style={{ color: 'var(--text-main)' }}>{userEmail || 'your account'}</strong> and everything tied to it:
        </p>

        <ul style={{
          textAlign: 'left',
          fontSize: '12.5px',
          color: 'var(--text-muted)',
          lineHeight: 1.7,
          margin: '12px 0 20px',
          paddingLeft: '20px'
        }}>
          <li>Step, calorie, and elevation history</li>
          <li>Streaks and badges</li>
          <li>Friends and any pending connection requests</li>
          <li>Your profile and login credentials</li>
        </ul>

        <p style={{ fontSize: '12px', color: '#EF4444', fontWeight: '700', marginBottom: '10px' }}>
          This cannot be undone.
        </p>

        <input
          type="text"
          className="glass-input"
          placeholder='Type "DELETE" to confirm'
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          disabled={deleting}
          style={{ marginBottom: errorMsg ? '10px' : '20px', textAlign: 'center', fontWeight: '700', letterSpacing: '1px' }}
        />

        {errorMsg && (
          <p style={{ fontSize: '12px', color: '#EF4444', marginBottom: '16px' }}>
            {errorMsg}
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            style={{
              flex: 1,
              background: canDelete ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' : 'rgba(239, 68, 68, 0.25)',
              color: '#FFFFFF',
              fontWeight: '700',
              padding: '12px 18px',
              borderRadius: '14px',
              border: 'none',
              cursor: canDelete && !deleting ? 'pointer' : 'not-allowed',
              opacity: canDelete ? 1 : 0.6,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '14px',
              boxShadow: canDelete ? '0 6px 20px rgba(239, 68, 68, 0.4)' : 'none'
            }}
          >
            <Trash2 size={16} /> {deleting ? 'Deleting...' : 'Delete Forever'}
          </button>

          <button
            onClick={onClose}
            disabled={deleting}
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
