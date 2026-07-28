import React, { useRef, useEffect, useState } from 'react';
import { X, Share2, Download, Copy, Check, Sparkles, MessageCircle, Instagram } from 'lucide-react';
import { getCelebrationQuote } from '../utils/fitnessEngine';

export function ShareModal({ steps, goal, streakDays, caloriesData, profile, onClose }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [quote, setQuote] = useState(() => getCelebrationQuote(steps, goal, streakDays));

  // Render Canvas Graphic Card with Perfect Layout & Font Safety
  useEffect(() => {
    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      // Crisp High-Resolution Canvas Dimensions (16:9 aspect ratio)
      const width = 1000;
      const height = 560;
      canvas.width = width;
      canvas.height = height;

      // 1. Dark Glassmorphism Background Gradient
      const bgGradient = ctx.createLinearGradient(0, 0, width, height);
      bgGradient.addColorStop(0, '#070A12');
      bgGradient.addColorStop(0.5, '#0F172A');
      bgGradient.addColorStop(1, '#05070E');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Ambient Glow Orbs
      const cyanGlow = ctx.createRadialGradient(180, 120, 10, 180, 120, 300);
      cyanGlow.addColorStop(0, 'rgba(0, 242, 254, 0.22)');
      cyanGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = cyanGlow;
      ctx.beginPath();
      ctx.arc(180, 120, 300, 0, Math.PI * 2);
      ctx.fill();

      const purpleGlow = ctx.createRadialGradient(820, 440, 10, 820, 440, 300);
      purpleGlow.addColorStop(0, 'rgba(139, 92, 246, 0.22)');
      purpleGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = purpleGlow;
      ctx.beginPath();
      ctx.arc(820, 440, 300, 0, Math.PI * 2);
      ctx.fill();

      // Outer Border Frame
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(40, 40, width - 80, height - 80, 28);
      ctx.fill();
      ctx.stroke();

      // 2. Header Branding
      ctx.fillStyle = '#00F2FE';
      ctx.font = 'bold 28px "Outfit", system-ui, sans-serif';
      ctx.fillText('PacePulse AI', 80, 95);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 15px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('Precision Step & Calorie Tracker Milestone', 80, 122);

      // Streak Badge (Top Right)
      if (streakDays >= 7) {
        ctx.fillStyle = 'rgba(255, 107, 0, 0.18)';
        ctx.strokeStyle = 'rgba(255, 107, 0, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(width - 270, 70, 190, 42, 21);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FF9E44';
        ctx.font = 'bold 15px "Outfit", system-ui, sans-serif';
        ctx.fillText(`🔥 1-WEEK STREAK`, width - 250, 96);
      }

      // 3. Giant Step Count Section (Clean Stacked Layout)
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 14px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('STEPS CONQUERED TODAY', 80, 175);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 76px "Outfit", system-ui, sans-serif';
      ctx.fillText(steps.toLocaleString(), 80, 245);

      // Goal Achievement Pill Badge
      const isGoalHit = steps >= goal;
      ctx.fillStyle = isGoalHit ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 242, 254, 0.15)';
      ctx.strokeStyle = isGoalHit ? 'rgba(16, 185, 129, 0.5)' : 'rgba(0, 242, 254, 0.4)';
      ctx.lineWidth = 1;
      
      const goalPillX = 80 + ctx.measureText(steps.toLocaleString()).width + 25;
      if (goalPillX < width - 300) {
        ctx.beginPath();
        ctx.roundRect(goalPillX, 195, 160, 36, 18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isGoalHit ? '#34D399' : '#00F2FE';
        ctx.font = 'bold 14px "Outfit", system-ui, sans-serif';
        ctx.fillText(isGoalHit ? '🎯 GOAL REACHED' : '⚡ IN PROGRESS', goalPillX + 15, 218);
      }

      // 4. Metrics Cards Grid (3 Columns, Spacious Y)
      const metricsY = 280;
      const boxWidth = 260;
      const boxHeight = 75;
      const boxGap = 20;

      // Card 1: Calories
      ctx.fillStyle = 'rgba(255, 107, 0, 0.12)';
      ctx.strokeStyle = 'rgba(255, 107, 0, 0.3)';
      ctx.beginPath();
      ctx.roundRect(80, metricsY, boxWidth, boxHeight, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FF9E44';
      ctx.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('🔥 CALORIES BURNED', 100, metricsY + 28);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 24px "Outfit", system-ui, sans-serif';
      ctx.fillText(`${caloriesData.totalKcal} kcal`, 100, metricsY + 58);

      // Card 2: Distance
      ctx.fillStyle = 'rgba(0, 242, 254, 0.12)';
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.3)';
      ctx.beginPath();
      ctx.roundRect(80 + boxWidth + boxGap, metricsY, boxWidth, boxHeight, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('📍 DISTANCE COVERED', 80 + boxWidth + boxGap + 20, metricsY + 28);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 24px "Outfit", system-ui, sans-serif';
      ctx.fillText(`${caloriesData.distanceKm} km`, 80 + boxWidth + boxGap + 20, metricsY + 58);

      // Card 3: Daily Target
      ctx.fillStyle = 'rgba(139, 92, 246, 0.12)';
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
      ctx.beginPath();
      ctx.roundRect(80 + (boxWidth + boxGap) * 2, metricsY, boxWidth, boxHeight, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#A78BFA';
      ctx.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('🎯 DAILY TARGET', 80 + (boxWidth + boxGap) * 2 + 20, metricsY + 28);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 24px "Outfit", system-ui, sans-serif';
      ctx.fillText(`${goal.toLocaleString()} steps`, 80 + (boxWidth + boxGap) * 2 + 20, metricsY + 58);

      // 5. Quote Box at Bottom (With Multiline Text Wrapping)
      const quoteBoxY = 385;
      const quoteBoxHeight = 85;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(80, quoteBoxY, width - 160, quoteBoxHeight, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F1F5F9';
      ctx.font = 'italic 500 16px "Plus Jakarta Sans", system-ui, sans-serif';

      // Helper function for multiline canvas text wrapping
      const wrapText = (text, x, y, maxWidth, lineHeight) => {
        const words = text.split(' ');
        let line = '';
        let currentY = y;

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, x, currentY);
      };

      wrapText(`"${quote}"`, 105, quoteBoxY + 36, width - 210, 24);
    };

    // Ensure fonts are loaded before drawing on canvas
    if (document.fonts) {
      document.fonts.ready.then(() => {
        renderCanvas();
      });
    } else {
      renderCanvas();
    }
  }, [steps, goal, streakDays, caloriesData, quote]);

  // Handle WhatsApp Direct Share
  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `🏃 *PacePulse AI Fitness Update* 🏃\n\n${quote}\n\n📊 *Daily Stats:*\n• Steps: ${steps.toLocaleString()}\n• Calories: ${caloriesData.totalKcal} kcal\n• Distance: ${caloriesData.distanceKm} km\n• Streak: ${streakDays} days 🔥\n\nTracked with PacePulse AI! ⚡`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Download High-Res PNG Card
  const handleDownloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `PacePulse_Goal_${steps}_Steps.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopyCaption = () => {
    const fullCaption = `${quote}\n\nSteps: ${steps.toLocaleString()} | Calories: ${caloriesData.totalKcal} kcal | Distance: ${caloriesData.distanceKm} km | ${streakDays} Day Streak 🔥\n#PacePulseAI #FitnessGoal #StepTracker #WalkingStreak`;
    navigator.clipboard.writeText(fullCaption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(4, 9, 20, 0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '880px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '32px',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={22} />
        </button>

        {/* Title Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #25D366 0%, #00F2FE 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Share2 size={22} color="#040914" />
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '800' }}>Social Media Post Creator</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Share your step goal achievement & streak on WhatsApp or Instagram
            </p>
          </div>
        </div>

        {/* Canvas Graphic Preview Card */}
        <div style={{
          width: '100%',
          overflowX: 'auto',
          borderRadius: '18px',
          border: '1px solid rgba(0, 242, 254, 0.25)',
          marginBottom: '24px',
          background: '#070A12',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
        }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>

        {/* Customizable Line/Quote Selector */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
            Celebration Line / Status Text
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text"
              className="glass-input"
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
            />
            <button 
              className="btn-secondary"
              onClick={() => setQuote(getCelebrationQuote(steps, goal, streakDays))}
              title="Regenerate AI Quote"
            >
              <Sparkles size={18} color="#F59E0B" />
            </button>
          </div>
        </div>

        {/* Action Share Buttons Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
          {/* WhatsApp Direct Share Button */}
          <button className="btn-whatsapp" onClick={handleWhatsAppShare}>
            <MessageCircle size={20} />
            Post to WhatsApp
          </button>

          {/* Instagram / Story Card Generator Button */}
          <button className="btn-instagram" onClick={() => { handleDownloadCard(); handleCopyCaption(); }}>
            <Instagram size={20} />
            Instagram Story Card
          </button>

          {/* Download Graphic Image Card */}
          <button className="btn-secondary" onClick={handleDownloadCard} style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
            <Download size={18} color="#00F2FE" />
            Download PNG Card
          </button>
        </div>

        {/* Copy Status Notification */}
        {copied && (
          <p style={{ marginTop: '12px', textAlign: 'center', color: '#34D399', fontSize: '13px', fontWeight: '600' }}>
            ✓ Caption copied to clipboard & Image card downloaded! Open Instagram to paste post!
          </p>
        )}
      </div>
    </div>
  );
}
