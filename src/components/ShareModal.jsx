import React, { useRef, useEffect, useState } from 'react';
import { X, Share2, Download, Copy, Check, Sparkles, MessageCircle, Instagram, Camera, Image as ImageIcon } from 'lucide-react';
import { getCelebrationQuote } from '../utils/fitnessEngine';

export function ShareModal({ steps = 0, goal = 10000, streakDays = 1, caloriesData, profile, onClose }) {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [cardMode, setCardMode] = useState('generated'); // 'generated' | 'photo'
  const [customPhotoUrl, setCustomPhotoUrl] = useState(null);
  const [quote, setQuote] = useState(() => getCelebrationQuote(steps, goal, streakDays));

  // Handle Photo File Upload / Camera Capture
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomPhotoUrl(url);
      setCardMode('photo');
    }
  };

  // Render Canvas Graphic Card (Generated or Photo Overlay)
  useEffect(() => {
    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const width = 1000;
      const height = 560;
      canvas.width = width;
      canvas.height = height;

      if (cardMode === 'photo' && customPhotoUrl) {
        const img = new Image();
        img.onload = () => {
          // Draw user photo scaled to fill canvas
          const imgAspect = img.width / img.height;
          const canvasAspect = width / height;
          let drawWidth = width;
          let drawHeight = height;
          let offsetX = 0;
          let offsetY = 0;

          if (imgAspect > canvasAspect) {
            drawWidth = height * imgAspect;
            offsetX = -(drawWidth - width) / 2;
          } else {
            drawHeight = width / imgAspect;
            offsetY = -(drawHeight - height) / 2;
          }

          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

          // Dark Overlay Gradient for contrast
          const overlay = ctx.createLinearGradient(0, 0, 0, height);
          overlay.addColorStop(0, 'rgba(4, 9, 20, 0.4)');
          overlay.addColorStop(0.5, 'rgba(4, 9, 20, 0.2)');
          overlay.addColorStop(1, 'rgba(4, 9, 20, 0.85)');
          ctx.fillStyle = overlay;
          ctx.fillRect(0, 0, width, height);

          drawOverlayStats(ctx, width, height);
        };
        img.src = customPhotoUrl;
      } else {
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

        drawOverlayStats(ctx, width, height);
      }
    };

    const drawOverlayStats = (ctx, width, height) => {
      // 2. Header Branding
      ctx.fillStyle = '#00F2FE';
      ctx.font = 'bold 28px "Outfit", system-ui, sans-serif';
      ctx.fillText('PacePulse AI', 80, 95);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 15px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('Precision Step & Calorie Tracker Story', 80, 122);

      // Streak Badge (Top Right)
      if (streakDays >= 1) {
        ctx.fillStyle = 'rgba(255, 107, 0, 0.22)';
        ctx.strokeStyle = 'rgba(255, 107, 0, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(width - 270, 70, 190, 42, 21);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FF9E44';
        ctx.font = 'bold 15px "Outfit", system-ui, sans-serif';
        ctx.fillText(`🔥 ${streakDays} DAY STREAK`, width - 245, 96);
      }

      // 3. Giant Step Count Section
      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 14px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('STEPS CONQUERED TODAY', 80, 175);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 76px "Outfit", system-ui, sans-serif';
      ctx.fillText(steps.toLocaleString(), 80, 245);

      // Goal Achievement Pill Badge
      const isGoalHit = steps >= goal;
      ctx.fillStyle = isGoalHit ? 'rgba(16, 185, 129, 0.3)' : 'rgba(0, 242, 254, 0.2)';
      ctx.strokeStyle = isGoalHit ? 'rgba(16, 185, 129, 0.7)' : 'rgba(0, 242, 254, 0.5)';
      ctx.lineWidth = 1.5;

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

      // 4. Metrics Cards Grid (3 Columns)
      const metricsY = 280;
      const boxWidth = 260;
      const boxHeight = 75;
      const boxGap = 20;

      const totalKcal = caloriesData ? caloriesData.activeKcal || caloriesData.totalKcal : 0;
      const distanceKm = caloriesData ? caloriesData.distanceKm : 0;

      // Card 1: Active Calories
      ctx.fillStyle = 'rgba(255, 107, 0, 0.2)';
      ctx.strokeStyle = 'rgba(255, 107, 0, 0.4)';
      ctx.beginPath();
      ctx.roundRect(80, metricsY, boxWidth, boxHeight, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FF9E44';
      ctx.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('🔥 ACTIVE CALORIES', 100, metricsY + 28);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 24px "Outfit", system-ui, sans-serif';
      ctx.fillText(`${totalKcal} kcal`, 100, metricsY + 58);

      // Card 2: Distance
      ctx.fillStyle = 'rgba(0, 242, 254, 0.2)';
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
      ctx.beginPath();
      ctx.roundRect(80 + boxWidth + boxGap, metricsY, boxWidth, boxHeight, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('📍 DISTANCE COVERED', 80 + boxWidth + boxGap + 20, metricsY + 28);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 24px "Outfit", system-ui, sans-serif';
      ctx.fillText(`${distanceKm} km`, 80 + boxWidth + boxGap + 20, metricsY + 58);

      // Card 3: Daily Target
      ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
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

      // 5. Quote Box at Bottom
      const quoteBoxY = 385;
      const quoteBoxHeight = 85;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(80, quoteBoxY, width - 160, quoteBoxHeight, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F1F5F9';
      ctx.font = 'italic 500 16px "Plus Jakarta Sans", system-ui, sans-serif';

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

    if (document.fonts) {
      document.fonts.ready.then(() => renderCanvas());
    } else {
      renderCanvas();
    }
  }, [steps, goal, streakDays, caloriesData, quote, cardMode, customPhotoUrl]);

  // Handle WhatsApp Direct Share (Story or Chat)
  const handleWhatsAppShare = () => {
    handleDownloadCard();
    const text = encodeURIComponent(
      `🏃 *PacePulse AI Fitness Update* 🏃\n\n${quote}\n\n📊 *Daily Stats:*\n• Steps: ${steps.toLocaleString()}\n• Active Calories: ${caloriesData ? caloriesData.activeKcal : 0} kcal\n• Distance: ${caloriesData ? caloriesData.distanceKm : 0} km\n• Streak: ${streakDays} days 🔥\n\nTracked with PacePulse AI! ⚡`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Handle Instagram Stories Direct Share
  const handleInstagramShare = () => {
    handleDownloadCard();
    handleCopyCaption();
    alert("Image card downloaded & caption copied! Opening Instagram...");
    window.open(`https://www.instagram.com/`, '_blank');
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
    const activeKcal = caloriesData ? caloriesData.activeKcal : 0;
    const distKm = caloriesData ? caloriesData.distanceKm : 0;
    const fullCaption = `${quote}\n\nSteps: ${steps.toLocaleString()} | Active Calories: ${activeKcal} kcal | Distance: ${distKm} km | ${streakDays} Day Streak 🔥\n#PacePulseAI #FitnessGoal #StepTracker #WalkingStreak`;
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
        borderRadius: '24px',
        padding: '28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={22} color="#00F2FE" /> Post Progress Story
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Share your step milestone to WhatsApp Status & Instagram Stories
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--text-muted)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Story Card Image Source Selection (Generated vs Camera Photo) */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '4px',
          borderRadius: '16px'
        }}>
          <button
            onClick={() => setCardMode('generated')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '12px',
              border: 'none',
              background: cardMode === 'generated' ? 'rgba(0, 242, 254, 0.2)' : 'transparent',
              color: cardMode === 'generated' ? '#00F2FE' : 'var(--text-muted)',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <ImageIcon size={16} /> PacePulse Card
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '12px',
              border: 'none',
              background: cardMode === 'photo' ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
              color: cardMode === 'photo' ? '#EC4899' : 'var(--text-muted)',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Camera size={16} /> Take Photo / Upload Camera Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handlePhotoUpload}
          />
        </div>

        {/* Live Canvas Preview */}
        <div style={{
          width: '100%',
          borderRadius: '18px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '20px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)'
        }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>

        {/* Social Share Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={handleWhatsAppShare}
            style={{
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <MessageCircle size={18} /> Post to WhatsApp Status
          </button>

          <button
            onClick={handleInstagramShare}
            style={{
              background: 'linear-gradient(135deg, #E1306C 0%, #C13584 50%, #833AB4 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '14px',
              padding: '14px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Instagram size={18} /> Share to Instagram Stories
          </button>
        </div>

        {/* Secondary Action Buttons (Download & Copy Caption) */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleDownloadCard}
            className="btn-secondary"
            style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Download size={16} /> Save Image Card
          </button>
          <button
            onClick={handleCopyCaption}
            className="btn-secondary"
            style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {copied ? <Check size={16} color="#10B981" /> : <Copy size={16} />}
            {copied ? 'Caption Copied!' : 'Copy Caption Text'}
          </button>
        </div>
      </div>
    </div>
  );
}
