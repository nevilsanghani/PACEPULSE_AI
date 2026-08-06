import React, { useRef, useEffect, useState } from 'react';
import { X, Share2, Download, Copy, Check, Sparkles, MessageCircle, Instagram, Camera, Image as ImageIcon, Move } from 'lucide-react';
import { getCelebrationQuote, metersToFloors } from '../utils/fitnessEngine';

export function ShareModal({ steps = 0, goal = 10000, streakDays = 1, caloriesData, profile, elevationM = 0, elevationSupported = true, onClose }) {
  const showElevation = elevationSupported && elevationM > 0;
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [cardMode, setCardMode] = useState('generated'); // 'generated' | 'photo'
  const [customPhotoDataUrl, setCustomPhotoDataUrl] = useState(null);
  const [overlayPosition, setOverlayPosition] = useState('bottom-left'); // 'top-left' | 'top-right' | 'center' | 'bottom-left' | 'bottom-right'
  const [quote, setQuote] = useState(() => getCelebrationQuote(steps, goal, streakDays));

  // Handle Photo File Upload / Camera Capture via FileReader for 100% reliability
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomPhotoDataUrl(event.target.result);
        setCardMode('photo');
      };
      reader.readAsDataURL(file);
    }
  };

  // Render Canvas Graphic Card (Generated or Photo Overlay)
  useEffect(() => {
    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const width = 1000;
      const height = 1000; // 1:1 Square aspect ratio ideal for Stories & Instagram/WhatsApp
      canvas.width = width;
      canvas.height = height;

      if (cardMode === 'photo' && customPhotoDataUrl) {
        const img = new Image();
        img.onload = () => {
          // Center-crop scale user photo onto 1000x1000 square canvas
          const imgAspect = img.width / img.height;
          let drawWidth = width;
          let drawHeight = height;
          let offsetX = 0;
          let offsetY = 0;

          if (imgAspect > 1) {
            drawWidth = height * imgAspect;
            offsetX = -(drawWidth - width) / 2;
          } else {
            drawHeight = width / imgAspect;
            offsetY = -(drawHeight - height) / 2;
          }

          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

          // Dark Overlay Gradient for contrast
          const overlay = ctx.createLinearGradient(0, 0, 0, height);
          overlay.addColorStop(0, 'rgba(4, 9, 20, 0.35)');
          overlay.addColorStop(0.5, 'rgba(4, 9, 20, 0.15)');
          overlay.addColorStop(1, 'rgba(4, 9, 20, 0.75)');
          ctx.fillStyle = overlay;
          ctx.fillRect(0, 0, width, height);

          drawPhotoOverlayHUD(ctx, width, height);
        };
        img.src = customPhotoDataUrl;
      } else {
        // 1. Dark Glassmorphism Background Gradient
        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#070A12');
        bgGradient.addColorStop(0.5, '#0F172A');
        bgGradient.addColorStop(1, '#05070E');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // Ambient Glow Orbs
        const cyanGlow = ctx.createRadialGradient(200, 200, 10, 200, 200, 450);
        cyanGlow.addColorStop(0, 'rgba(0, 242, 254, 0.25)');
        cyanGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = cyanGlow;
        ctx.beginPath();
        ctx.arc(200, 200, 450, 0, Math.PI * 2);
        ctx.fill();

        const purpleGlow = ctx.createRadialGradient(800, 800, 10, 800, 800, 450);
        purpleGlow.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
        purpleGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = purpleGlow;
        ctx.beginPath();
        ctx.arc(800, 800, 450, 0, Math.PI * 2);
        ctx.fill();

        // Outer Border Frame
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.35)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(40, 40, width - 80, height - 80, 36);
        ctx.fill();
        ctx.stroke();

        drawGeneratedCardContent(ctx, width, height);
      }
    };

    const drawGeneratedCardContent = (ctx, width, height) => {
      // Branding Header
      ctx.fillStyle = '#00F2FE';
      ctx.font = 'bold 36px "Outfit", system-ui, sans-serif';
      ctx.fillText('PacePulse AI', 80, 110);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 18px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('Precision Step & Calorie Story', 80, 145);

      // Streak Badge
      if (streakDays >= 1) {
        ctx.fillStyle = 'rgba(255, 107, 0, 0.22)';
        ctx.strokeStyle = 'rgba(255, 107, 0, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(width - 290, 75, 210, 50, 25);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FF9E44';
        ctx.font = 'bold 18px "Outfit", system-ui, sans-serif';
        ctx.fillText(`🔥 ${streakDays} DAY STREAK`, width - 265, 107);
      }

      // Main Step Count
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 18px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('STEPS CONQUERED TODAY', 80, 235);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 110px "Outfit", system-ui, sans-serif';
      ctx.fillText(steps.toLocaleString(), 80, 340);

      // Goal Pill Badge
      const isGoalHit = steps >= goal && steps > 0;
      ctx.fillStyle = isGoalHit ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 242, 254, 0.2)';
      ctx.strokeStyle = isGoalHit ? 'rgba(16, 185, 129, 0.6)' : 'rgba(0, 242, 254, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(80, 375, 220, 48, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isGoalHit ? '#34D399' : '#00F2FE';
      ctx.font = 'bold 18px "Outfit", system-ui, sans-serif';
      ctx.fillText(isGoalHit ? '🎯 GOAL ACHIEVED!' : '⚡ IN PROGRESS', 105, 406);

      // Elevation Gain Pill (only shown when the device supports it & gain > 0)
      if (showElevation) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(320, 375, 260, 48, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#34D399';
        ctx.font = 'bold 18px "Outfit", system-ui, sans-serif';
        ctx.fillText(`⛰️ ${Math.round(elevationM)}m • ${metersToFloors(elevationM)} floors`, 340, 406);
      }

      // 4 Metrics Grid (2x2 Grid)
      const gridY = 460;
      const boxW = 400;
      const boxH = 120;
      const gap = 40;

      const activeKcal = caloriesData ? caloriesData.activeKcal || caloriesData.totalKcal : 0;
      const distKm = caloriesData ? caloriesData.distanceKm : 0;
      const durationMins = caloriesData ? caloriesData.durationMins : 0;

      // Card 1: Active Calories
      ctx.fillStyle = 'rgba(255, 107, 0, 0.15)';
      ctx.strokeStyle = 'rgba(255, 107, 0, 0.4)';
      ctx.beginPath();
      ctx.roundRect(80, gridY, boxW, boxH, 20);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FF9E44';
      ctx.font = 'bold 16px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('🔥 ACTIVE CALORIES', 110, gridY + 42);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 36px "Outfit", system-ui, sans-serif';
      ctx.fillText(`${activeKcal} kcal`, 110, gridY + 92);

      // Card 2: Distance
      ctx.fillStyle = 'rgba(0, 242, 254, 0.15)';
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
      ctx.beginPath();
      ctx.roundRect(80 + boxW + gap, gridY, boxW, boxH, 20);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 16px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('📍 DISTANCE COVERED', 80 + boxW + gap + 30, gridY + 42);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 36px "Outfit", system-ui, sans-serif';
      ctx.fillText(`${distKm} km`, 80 + boxW + gap + 30, gridY + 92);

      // Card 3: Moving Time
      ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
      ctx.beginPath();
      ctx.roundRect(80, gridY + boxH + 24, boxW, boxH, 20);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#A78BFA';
      ctx.font = 'bold 16px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('⏱️ MOVING TIME', 110, gridY + boxH + 24 + 42);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 36px "Outfit", system-ui, sans-serif';
      ctx.fillText(`${durationMins} mins`, 110, gridY + boxH + 24 + 92);

      // Card 4: Daily Goal
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.beginPath();
      ctx.roundRect(80 + boxW + gap, gridY + boxH + 24, boxW, boxH, 20);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 16px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('🎯 TARGET GOAL', 80 + boxW + gap + 30, gridY + boxH + 24 + 42);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 36px "Outfit", system-ui, sans-serif';
      ctx.fillText(`${goal.toLocaleString()} steps`, 80 + boxW + gap + 30, gridY + boxH + 24 + 92);

      // Quote Banner at Bottom
      const quoteY = 765;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(80, quoteY, width - 160, 130, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#F1F5F9';
      ctx.font = 'italic 500 20px "Plus Jakarta Sans", system-ui, sans-serif';

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

      wrapText(`"${quote}"`, 110, quoteY + 50, width - 220, 30);
    };

    const drawPhotoOverlayHUD = (ctx, width, height) => {
      // Calculate coordinates for chosen overlay position
      const hudW = 460;
      const hudH = 340;
      let hudX = 50;
      let hudY = 50;

      if (overlayPosition === 'top-right') {
        hudX = width - hudW - 50;
        hudY = 50;
      } else if (overlayPosition === 'center') {
        hudX = (width - hudW) / 2;
        hudY = (height - hudH) / 2;
      } else if (overlayPosition === 'bottom-left') {
        hudX = 50;
        hudY = height - hudH - 50;
      } else if (overlayPosition === 'bottom-right') {
        hudX = width - hudW - 50;
        hudY = height - hudH - 50;
      }

      // Glassmorphism Overlay Box
      ctx.fillStyle = 'rgba(10, 15, 26, 0.82)';
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(hudX, hudY, hudW, hudH, 28);
      ctx.fill();
      ctx.stroke();

      // PacePulse AI Branding
      ctx.fillStyle = '#00F2FE';
      ctx.font = 'bold 22px "Outfit", system-ui, sans-serif';
      ctx.fillText('PacePulse AI', hudX + 24, hudY + 42);

      const isGoalHit = steps >= goal && steps > 0;
      ctx.fillStyle = isGoalHit ? '#34D399' : '#FF9E44';
      ctx.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(isGoalHit ? '🎯 GOAL ACHIEVED!' : '⚡ IN PROGRESS', hudX + hudW - 160, hudY + 42);

      // Big Steps Text
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 12px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('STEPS WALKED TODAY', hudX + 24, hudY + 80);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 58px "Outfit", system-ui, sans-serif';
      ctx.fillText(steps.toLocaleString(), hudX + 24, hudY + 140);

      // Metrics Row (Distance, Calories, Time)
      const activeKcal = caloriesData ? caloriesData.activeKcal || caloriesData.totalKcal : 0;
      const distKm = caloriesData ? caloriesData.distanceKm : 0;
      const durationMins = caloriesData ? caloriesData.durationMins : 0;

      // Metric 1: Distance
      ctx.fillStyle = 'rgba(0, 242, 254, 0.15)';
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.3)';
      ctx.beginPath();
      ctx.roundRect(hudX + 24, hudY + 165, 125, 70, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 11px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('📍 DISTANCE', hudX + 34, hudY + 188);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 20px "Outfit", system-ui, sans-serif';
      ctx.fillText(`${distKm} km`, hudX + 34, hudY + 218);

      // Metric 2: Active Calories
      ctx.fillStyle = 'rgba(255, 107, 0, 0.15)';
      ctx.strokeStyle = 'rgba(255, 107, 0, 0.3)';
      ctx.beginPath();
      ctx.roundRect(hudX + 165, hudY + 165, 130, 70, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FF9E44';
      ctx.font = 'bold 11px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('🔥 CALORIES', hudX + 175, hudY + 188);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 20px "Outfit", system-ui, sans-serif';
      ctx.fillText(`${activeKcal} kcal`, hudX + 175, hudY + 218);

      // Metric 3: Moving Time
      ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
      ctx.beginPath();
      ctx.roundRect(hudX + 310, hudY + 165, 125, 70, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#A78BFA';
      ctx.font = 'bold 11px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('⏱️ TIME', hudX + 320, hudY + 188);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 20px "Outfit", system-ui, sans-serif';
      ctx.fillText(`${durationMins} mins`, hudX + 320, hudY + 218);

      // Bottom Date & Goal Target Footer
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 13px "Plus Jakarta Sans", system-ui, sans-serif';
      const footerText = showElevation
        ? `Target: ${goal.toLocaleString()} steps • ⛰️ ${metersToFloors(elevationM)} floors • ${new Date().toLocaleDateString()}`
        : `Target: ${goal.toLocaleString()} steps • ${new Date().toLocaleDateString()}`;
      ctx.fillText(footerText, hudX + 24, hudY + 280);

      if (streakDays >= 1) {
        ctx.fillStyle = '#FF9E44';
        ctx.font = 'bold 13px "Outfit", system-ui, sans-serif';
        ctx.fillText(`🔥 ${streakDays} Day Streak`, hudX + 24, hudY + 308);
      }
    };

    if (document.fonts) {
      document.fonts.ready.then(() => renderCanvas());
    } else {
      renderCanvas();
    }
  }, [steps, goal, streakDays, caloriesData, quote, cardMode, customPhotoDataUrl, overlayPosition, elevationM, showElevation]);

  // Universal Native Mobile App Sharing (Android WhatsApp Status / Instagram Story)
  const handleUniversalNativeShare = async (platform) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      alert('Please wait for the Story Card to render, then try again.');
      return;
    }

    const activeKcal = caloriesData ? caloriesData.activeKcal || caloriesData.totalKcal : 0;
    const distKm = caloriesData ? caloriesData.distanceKm : 0;
    const isGoalHit = steps >= goal && steps > 0;
    const statusStr = isGoalHit ? '🎯 GOAL ACHIEVED!' : '⚡ IN PROGRESS';
    const elevationLine = showElevation ? `\n• Elevation Gain: ${Math.round(elevationM)} m (${metersToFloors(elevationM)} floors) ⛰️` : '';

    const caption = `🏃 *PacePulse AI Fitness Update* 🏃\n\n"${quote}"\n\n📊 *Daily Stats (${statusStr}):*\n• Steps: ${steps.toLocaleString()}\n• Active Calories: ${activeKcal} kcal\n• Distance: ${distKm} km${elevationLine}\n• Active Streak: ${streakDays} days 🔥\n\nTracked with PacePulse AI! ⚡`;

    // 1. Convert Canvas to JPEG format for universal mobile photo gallery compatibility.
    // Quality 0.85 (not 0.95) keeps the share card visually sharp while roughly halving
    // the base64 payload handed across the JS<->native bridge, which is what was making
    // WhatsApp/Instagram feel slow to open (the intent can't fire until that transfer finishes).
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) {
      alert('Could not generate story card image. Please try again.');
      return;
    }

    // 2. Inside the native Android wrapper: hand the image straight to WhatsApp Status /
    // Instagram Stories via real Android share intents (fixes the "page not found" error
    // caused by trying to navigate the WebView to whatsapp://.../instagram:// URLs).
    const bridge = window.AndroidStepBridge;
    if (bridge && (bridge.shareToWhatsAppStatus || bridge.shareToInstagramStory)) {
      try {
        await navigator.clipboard.writeText(caption);
      } catch (err) {}

      const base64Jpeg = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      if (platform === 'whatsapp' && bridge.shareToWhatsAppStatus) {
        bridge.shareToWhatsAppStatus(base64Jpeg, caption);
        return;
      } else if (platform === 'instagram' && bridge.shareToInstagramStory) {
        bridge.shareToInstagramStory(base64Jpeg);
        return;
      }
    }

    // 3. Plain browser / installed PWA (not the wrapped Android app): download the card
    // and copy the caption so the user can attach it manually - Web Share API first if available.
    const file = new File([blob], `PacePulse_Progress_${steps}_Steps.jpg`, { type: 'image/jpeg' });
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    try {
      const link = document.createElement('a');
      link.download = `PacePulse_Progress_${steps}_Steps.jpg`;
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.log("Card download fallback:", err);
    }

    try {
      await navigator.clipboard.writeText(caption);
    } catch (err) {}

    if (isMobile && navigator.share) {
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'PacePulse AI Progress',
            text: caption,
            files: [file]
          });
          return;
        }
      } catch (e) {
        if (e.name === 'AbortError') return; // User closed share sheet intentionally
      }
    }

    alert('📲 Card image downloaded & caption copied! Open WhatsApp or Instagram and attach it from your gallery.');
  };

  // Download PNG Card
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
    const elevationPart = showElevation ? ` | Elevation: ${metersToFloors(elevationM)} floors ⛰️` : '';
    const fullCaption = `${quote}\n\nSteps: ${steps.toLocaleString()} | Active Calories: ${activeKcal} kcal | Distance: ${distKm} km${elevationPart} | ${streakDays} Day Streak 🔥\n#PacePulseAI #FitnessGoal #StepTracker #WalkingStreak`;
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
      backdropFilter: 'blur(14px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '680px',
        maxHeight: '92vh',
        overflowY: 'auto',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={22} color="#00F2FE" /> Post Progress Story
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
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

        {/* Card Mode Selection (Generated Card vs Camera Photo) */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '16px',
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
            <Camera size={16} /> Take Photo / Upload Image
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

        {/* Photo Overlay Position Control (Visible when in Photo mode) */}
        {cardMode === 'photo' && (
          <div style={{
            background: 'rgba(0, 242, 254, 0.08)',
            border: '1px solid rgba(0, 242, 254, 0.25)',
            borderRadius: '16px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Move size={16} color="#00F2FE" />
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#00F2FE' }}>
                Stats HUD Position on Photo:
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {[
                { id: 'top-left', label: 'Top Left' },
                { id: 'top-right', label: 'Top Right' },
                { id: 'center', label: 'Center' },
                { id: 'bottom-left', label: 'Bottom Left' },
                { id: 'bottom-right', label: 'Bottom Right' }
              ].map(pos => (
                <button
                  key={pos.id}
                  onClick={() => setOverlayPosition(pos.id)}
                  style={{
                    padding: '6px 4px',
                    fontSize: '10px',
                    fontWeight: '700',
                    borderRadius: '8px',
                    border: overlayPosition === pos.id ? '1.5px solid #00F2FE' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: overlayPosition === pos.id ? '#00F2FE' : 'rgba(255, 255, 255, 0.05)',
                    color: overlayPosition === pos.id ? '#040914' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live Canvas Graphic Preview */}
        <div style={{
          width: '100%',
          borderRadius: '18px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '16px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
          maxHeight: '360px',
          display: 'flex',
          justifyContent: 'center',
          background: '#040914'
        }}>
          <canvas
            ref={canvasRef}
            style={{ maxWidth: '100%', maxHeight: '360px', width: 'auto', height: 'auto', display: 'block' }}
          />
        </div>

        {/* Primary Native Direct Share Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <button
            onClick={() => handleUniversalNativeShare('whatsapp')}
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
            <MessageCircle size={18} /> Share to WhatsApp Story
          </button>

          <button
            onClick={() => handleUniversalNativeShare('instagram')}
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
            <Instagram size={18} /> Share to Instagram Story
          </button>
        </div>

        {/* Secondary Action Buttons (Download & Copy Caption) */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleDownloadCard}
            className="btn-secondary"
            style={{ flex: 1, padding: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Download size={14} /> Download Story Card
          </button>
          <button
            onClick={handleCopyCaption}
            className="btn-secondary"
            style={{ flex: 1, padding: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
            {copied ? 'Caption Copied!' : 'Copy Caption Text'}
          </button>
        </div>
      </div>
    </div>
  );
}
