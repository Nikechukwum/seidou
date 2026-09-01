'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, useAnimationControls, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { RootState, AppDispatch } from '@/redux/store';

// BIG SIS REQUEST: official Aviator-style cubic multiplier curve:
//   multiplier = 1 + MULTIPLIER_CONST * t^3  (t in ms)
// Constant tuned so rounds feel snappy: ~6s to 2x, ~12.5s to 10x, ~17s to 25x.
const MULTIPLIER_CONST = 4.6e-12;
import {
  initializeGame,
  startRound,
  updateMultiplier,
  placeBet,
  cashout,
  endRound,
  resetGame,
  setBetAmount,
  setAutoCashout,
  setBalance,
  toggleMute,
  type GameState,
  type HistoryItem,
} from '@/redux/crashGameSlice';

// ============================================================================
// Audio System
// ============================================================================

class AudioSystem {
  private hitSound: HTMLAudioElement | null = null;
  private successSound: HTMLAudioElement | null = null;
  private tickSound: HTMLAudioElement | null = null;
  private startSound: HTMLAudioElement | null = null;
  private isInitialized = false;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  playHit(isMuted: boolean) {
    if (isMuted) return;
    this.playTone(150, 0.3, 'sawtooth');
  }

  playSuccess(isMuted: boolean) {
    if (isMuted) return;
    this.playTone(523, 0.15, 'sine');
    setTimeout(() => this.playTone(659, 0.15, 'sine'), 100);
    setTimeout(() => this.playTone(784, 0.3, 'sine'), 200);
  }

  playTick(isMuted: boolean) {
    if (isMuted) return;
    this.playTone(800, 0.03, 'sine');
  }

  playStart(isMuted: boolean) {
    if (isMuted) return;
    this.playTone(440, 0.15, 'triangle');
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine') {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = freq;
      oscillator.type = type;
      gainNode.gain.value = 0.3;
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      // Audio not supported or blocked
    }
  }

  startTickLoop(isMuted: boolean, callback: () => void) {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(() => {
      callback();
    }, 600);
  }

  stopTickLoop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}

const audioSystem = new AudioSystem();

// ============================================================================
// Background Component
// ============================================================================

function Background({ gameState }: { gameState: GameState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const starsRef = useRef<Array<{ x: number; y: number; size: number; speed: number; opacity: number }>>([]);
  const cloudsRef = useRef<Array<{ x: number; y: number; width: number; height: number; speed: number; opacity: number }>>([]);
  const mountainsRef = useRef<Array<{ x: number; height: number; width: number; color: string }>>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!initializedRef.current) {
      // Initialize stars
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < 150; i++) {
        starsRef.current.push({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height * 0.8,
          size: Math.random() * 2 + 1,
          speed: Math.random() * 0.5 + 0.1,
          opacity: Math.random() * 0.8 + 0.2,
        });
      }

      // Initialize clouds
      for (let i = 0; i < 12; i++) {
        cloudsRef.current.push({
          x: Math.random() * rect.width,
          y: Math.random() * (rect.height / 3),
          width: Math.random() * 150 + 50,
          height: Math.random() * 60 + 20,
          speed: Math.random() * 0.3 + 0.1,
          opacity: Math.random() * 0.4 + 0.1,
        });
      }

      // Initialize mountains
      const mountainColors = [
        'rgba(30, 30, 60, 0.8)',
        'rgba(40, 40, 70, 0.7)',
        'rgba(50, 50, 80, 0.6)',
        'rgba(60, 60, 90, 0.5)',
        'rgba(70, 70, 100, 0.4)',
      ];
      for (let i = 0; i < 5; i++) {
        mountainsRef.current.push({
          x: (rect.width / 6) * (i + 1),
          height: Math.random() * 200 + 100,
          width: Math.random() * 300 + 200,
          color: mountainColors[i],
        });
      }

      initializedRef.current = true;
    }

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const animate = () => {
      if (!ctx || !canvas.width || !canvas.height) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw sky gradient based on game state
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      if (gameState === 'crashed') {
        gradient.addColorStop(0, '#300000');
        gradient.addColorStop(0.5, '#600000');
        gradient.addColorStop(1, '#200000');
      } else if (gameState === 'flying') {
        gradient.addColorStop(0, '#001233');
        gradient.addColorStop(0.6, '#023e8a');
        gradient.addColorStop(1, '#03045e');
      } else {
        gradient.addColorStop(0, '#001845');
        gradient.addColorStop(0.7, '#002855');
        gradient.addColorStop(1, '#001233');
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw sun/moon
      if (gameState === 'flying' || gameState === 'crashed') {
        const centerX = canvas.width * 0.8;
        const centerY = canvas.height * 0.15;
        const radius = 30;
        const isCrashed = gameState === 'crashed';

        const glowGradient = ctx.createRadialGradient(
          centerX, centerY, radius * 0.5,
          centerX, centerY, radius * 3
        );
        glowGradient.addColorStop(0, isCrashed ? 'rgba(255, 50, 50, 0.3)' : 'rgba(255, 255, 200, 0.3)');
        glowGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isCrashed ? '#ff5555' : '#ffffdd';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw stars
      const time = Date.now() / 1000;
      starsRef.current.forEach((star, index) => {
        const twinkle = 0.7 + Math.sin(time + index) * 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * twinkle})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        star.x -= star.speed;
        if (star.x < 0) {
          star.x = canvas.width;
          star.y = Math.random() * canvas.height * 0.7;
        }
      });

      // Draw mountains
      mountainsRef.current.forEach((mountain) => {
        ctx.fillStyle = mountain.color;
        ctx.beginPath();
        ctx.moveTo(mountain.x - mountain.width / 2, canvas.height);
        ctx.bezierCurveTo(
          mountain.x - mountain.width / 4, canvas.height - mountain.height / 2,
          mountain.x - mountain.width / 8, canvas.height - mountain.height,
          mountain.x, canvas.height - mountain.height
        );
        ctx.bezierCurveTo(
          mountain.x + mountain.width / 8, canvas.height - mountain.height,
          mountain.x + mountain.width / 4, canvas.height - mountain.height / 2,
          mountain.x + mountain.width / 2, canvas.height
        );
        ctx.closePath();
        ctx.fill();

        if (mountain.height > 150) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.beginPath();
          ctx.moveTo(mountain.x - mountain.width / 8, canvas.height - mountain.height + 20);
          ctx.lineTo(mountain.x, canvas.height - mountain.height);
          ctx.lineTo(mountain.x + mountain.width / 8, canvas.height - mountain.height + 20);
          ctx.closePath();
          ctx.fill();
        }
      });

      // Draw clouds
      cloudsRef.current.forEach((cloud) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${cloud.opacity})`;
        const circleCount = Math.floor(cloud.width / 30);
        ctx.beginPath();
        for (let i = 0; i < circleCount; i++) {
          const circleX = cloud.x + i * (cloud.width / circleCount);
          const circleY = cloud.y + Math.sin((i / circleCount) * Math.PI) * (cloud.height / 2);
          const radius = (Math.random() * 0.5 + 0.5) * cloud.height;
          ctx.moveTo(circleX + radius, circleY);
          ctx.arc(circleX, circleY, radius, 0, Math.PI * 2);
        }
        ctx.fill();

        cloud.x -= cloud.speed * (gameState === 'flying' ? 1.5 : 1);
        if (cloud.x + cloud.width < 0) {
          cloud.x = canvas.width;
          cloud.y = Math.random() * (canvas.height / 3);
          cloud.width = Math.random() * 150 + 50;
          cloud.height = Math.random() * 60 + 20;
          cloud.opacity = Math.random() * 0.4 + 0.1;
        }
      });

      // Crash particles
      if (gameState === 'crashed') {
        for (let i = 0; i < 10; i++) {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const size = Math.random() * 3 + 1;
          ctx.fillStyle = `rgba(255, ${Math.random() * 100}, 0, ${Math.random() * 0.5})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Motion lines during flight
      if (gameState === 'flying') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 10; i++) {
          const y = Math.random() * canvas.height;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(50, y);
          ctx.stroke();
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gameState]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ============================================================================
// Plane Component
// ============================================================================

function Plane({
  gameState,
  multiplier,
  crashPoint,
  cashoutMultiplier,
}: {
  gameState: GameState;
  multiplier: number;
  crashPoint: number;
  cashoutMultiplier: number;
}) {
  const controls = useAnimationControls();
  // BIG SIS REQUEST: Aviator-style flight — duck starts bottom-left, climbs diagonally up-right.
  // Position maps to multiplier progress (which follows the cubic curve), so speed always syncs
  // with the multiplier and the duck naturally accelerates toward the crash point.
  const [style, setStyle] = useState({ x: 4, y: 88, angle: 0 });

  useEffect(() => {
    if (gameState === 'flying') {
      const p = Math.min(1, Math.max(0, (multiplier - 1) / Math.max(0.01, crashPoint - 1)));
      // Diagonal climb: x runs bottom-left to right, y rises toward the top.
      const x = 4 + 82 * p;
      // Higher power keeps the duck low early then climbs steeply, matching Aviator.
      const y = 88 - 74 * Math.pow(p, 1.4);
      // Tilt up as it climbs faster, driven by speed (higher multiplier = steeper).
      const angle = -18 * Math.min(1, 0.3 + p);
      setStyle({ x, y, angle });
    }
  }, [multiplier, gameState, crashPoint]);

  useEffect(() => {
    if (gameState === 'crashed') {
      // BIG SIS REQUEST: no delay — duck flies off-screen fast and instantly disappears.
      controls.start({
        x: 240,
        y: -160,
        rotate: 40,
        opacity: [1, 1, 0],
        transition: { duration: 0.35, ease: 'easeIn' },
      });
    } else {
      controls.start({ x: 0, y: 0, rotate: 0, opacity: 1, transition: { duration: 0.1 } });
    }
  }, [gameState, controls]);

  // Duck is hidden while READY/counting down, flies during FLYING, and stays visible
  // briefly so the crash fly-off animation shows before reset.
  const visible = gameState === 'flying' || gameState === 'crashed';

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 overflow-visible">
        <motion.div
          animate={controls}
          style={{
            position: 'absolute',
            left: `${visible ? style.x : 4}%`,
            top: `${visible ? style.y : 88}%`,
            transformOrigin: 'center center',
            zIndex: 40,
            opacity: visible ? 1 : 0,
          }}
        >
          {/* BIG SIS REQUEST: motion-blur trail behind the duck, opposite flight direction */}
          <div className="absolute top-1/2 right-3 -translate-y-1/2 w-24 md:w-36 h-4 bg-gradient-to-l from-yellow-300/50 via-yellow-300/20 to-transparent rounded-full blur-md translate-x-full" />

          <motion.div
            className={`w-20 h-20 md:w-28 md:h-28 flex items-center justify-center -mt-10 -ml-10 md:-mt-14 md:-ml-14
              ${cashoutMultiplier > 0 ? 'text-green-500' : 'text-yellow-300'}`}
            style={{ transform: `rotate(${style.angle}deg)`, transition: 'transform 0.08s linear' }}
            // BIG SIS REQUEST: subtle wing flap + wobble so it feels alive, not a straight line
            animate={
              visible
                ? { scale: [1, 1.12, 1, 0.92, 1], rotate: [style.angle, style.angle + 3, style.angle - 3, style.angle] }
                : {}
            }
            transition={{ duration: visible ? 0.5 : 0, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg
              viewBox="0 0 24 24"
              width="100%"
              height="100%"
              fill="currentColor"
              strokeWidth="0.5"
              stroke="#000"
              style={{ filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.9))' }}
            >
              <path d="M23,11C22.14,11 21.35,11.32 20.75,11.83C20.38,11.32 19.89,10.91 19.31,10.63C19.75,10.33 20.09,9.89 20.27,9.37C20.45,8.84 20.45,8.28 20.27,7.76C20.09,7.24 19.75,6.8 19.31,6.5C18.87,6.2 18.35,6.03 17.8,6.03C17.24,6.03 16.73,6.2 16.29,6.5C15.84,6.8 15.5,7.23 15.33,7.76C15.15,8.29 15.15,8.85 15.33,9.37C15.5,9.89 15.84,10.33 16.29,10.63C15.57,10.97 15,11.57 14.68,12.32C14.15,12.12 13.58,12 13,12C12.24,12 11.5,12.18 10.85,12.5L14.68,8.68C14.86,8.5 15,8.28 15.08,8.03C15.14,7.79 15.14,7.53 15.08,7.28C15,7.04 14.86,6.82 14.68,6.64C14.5,6.46 14.28,6.32 14.03,6.24C13.79,6.18 13.53,6.18 13.28,6.24C13.04,6.32 12.82,6.46 12.64,6.64L10.87,8.41C10.82,8.17 10.78,7.92 10.73,7.67C10.64,7.17 10.5,6.67 10.3,6.19C10.1,5.71 9.85,5.27 9.54,4.86C9.24,4.45 8.89,4.09 8.5,3.77C8.12,3.44 7.68,3.18 7.23,2.97C6.77,2.76 6.28,2.62 5.79,2.55C5.29,2.47 4.79,2.47 4.29,2.54C3.79,2.61 3.31,2.75 2.85,2.96C3.09,3.78 3.44,4.55 3.89,5.26C4.24,5.83 4.66,6.36 5.13,6.81C5.46,7.15 5.81,7.44 6.19,7.7L4.12,9.77C3.91,9.97 3.76,10.24 3.69,10.53C3.62,10.83 3.64,11.14 3.75,11.42C3.86,11.71 4.04,11.97 4.29,12.15C4.54,12.34 4.83,12.46 5.14,12.5C5.38,12.74 5.68,12.92 6,13C6.83,14.74 8.77,16 11,16C12.96,16 14.69,15.07 15.58,13.67C15.92,13.25 16.17,12.76 16.33,12.24C16.65,12.09 16.94,11.87 17.17,11.6C17.39,11.33 17.56,11.02 17.67,10.69C17.77,10.36 17.8,10.01 17.75,9.67C18.81,9.95 19.94,9.65 20.72,8.86C21.35,9.37 22.14,9.69 23,9.69V11Z" />
            </svg>

            {gameState === 'flying' && cashoutMultiplier === 0 && (
              <div className="absolute -bottom-20 left-0 transform -translate-x-16 z-10">
                <div className="w-44 h-10 bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-full blur-md opacity-60" />
              </div>
            )}

            {cashoutMultiplier > 0 && (
              <div className="absolute -bottom-16 -left-24 z-20">
                <div className="w-48 h-14 bg-gradient-to-r from-transparent to-green-500/70 rounded-full blur-md" />
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// ============================================================================
// Multiplier Display Component
// ============================================================================

function MultiplierDisplay({ multiplier, gameState }: { multiplier: number; gameState: GameState }) {
  const displayMultiplier = multiplier.toFixed(2);

  const multiplierStyle = useMemo(() => {
    let textColor = 'text-white';
    let glowColor = '';
    let fontSize = 'text-4xl md:text-6xl';

    if (multiplier >= 30) {
      textColor = 'text-purple-400';
      glowColor = 'drop-shadow-[0_0_10px_rgba(147,51,234,0.7)]';
      fontSize = 'text-5xl md:text-7xl';
    } else if (multiplier >= 20) {
      textColor = 'text-indigo-400';
      glowColor = 'drop-shadow-[0_0_8px_rgba(99,102,241,0.7)]';
      fontSize = 'text-5xl md:text-7xl';
    } else if (multiplier >= 10) {
      textColor = 'text-blue-400';
      glowColor = 'drop-shadow-[0_0_6px_rgba(59,130,246,0.7)]';
      fontSize = 'text-5xl md:text-7xl';
    } else if (multiplier >= 5) {
      textColor = 'text-green-400';
      glowColor = 'drop-shadow-[0_0_5px_rgba(74,222,128,0.6)]';
    } else if (multiplier >= 2) {
      textColor = 'text-yellow-400';
      glowColor = 'drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]';
    } else if (multiplier >= 1.5) {
      textColor = 'text-orange-400';
    }

    return { textColor, glowColor, fontSize };
  }, [multiplier]);

  if (gameState === 'betting') {
    return (
      <div className="relative flex flex-col items-center justify-center mt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-bold text-center text-white opacity-70"
        >
          Ready
        </motion.div>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 5, ease: 'linear' }}
          className="h-1 bg-white/30 rounded-full mt-2 max-w-[200px]"
        />
      </div>
    );
  }

  if (gameState === 'crashed') {
    return (
      <motion.div
        initial={{ scale: 1, y: 0 }}
        animate={{ scale: [1, 1.5, 1], y: [0, -20, 0] }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center justify-center mt-4"
      >
        <div className={`font-bold text-center text-red-500 ${multiplierStyle.fontSize} drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]`}>
          {displayMultiplier}×
        </div>
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: '100%', opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="h-1 bg-red-500/50 rounded-full mt-2 max-w-[200px]"
        />
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center mt-4">
      <div className={`font-bold text-center ${multiplierStyle.textColor} ${multiplierStyle.glowColor} ${multiplierStyle.fontSize}`}>
        {displayMultiplier}×
      </div>

      {/* BIG SIS REQUEST: progress bar below multiplier */}
      <div className="flex items-center space-x-1 mt-2">
        <div className="flex items-center justify-between w-full max-w-[200px] h-2 bg-slate-800/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((multiplier / 50) * 100, 100)}%` }}
            className="h-full bg-gradient-to-r from-yellow-500 to-red-500"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Countdown Timer Component
// ============================================================================

function CountdownTimer() {
  const { nextGameTimestamp } = useSelector((state: RootState) => state.crashGame);
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    if (!nextGameTimestamp) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((nextGameTimestamp - now) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [nextGameTimestamp]);

  return (
    <div className="bg-slate-800/80 px-4 py-2 rounded-full text-white">
      Next round in: <span className="font-bold">{secondsLeft}s</span>
    </div>
  );
}

// ============================================================================
// Game Canvas Component
// ============================================================================

function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { gameState, multiplier, crashPoint, cashoutMultiplier, nextGameTimestamp, currentBet } = useSelector(
    (state: RootState) => state.crashGame
  );

  // BIG SIS REQUEST: cashout winnings display on game board
  const currentBetWinningsView = useMemo(() => {
    if (currentBet.cashedOut) {
      return currentBet.winnings.toFixed(2);
    }
    if (currentBet.active && gameState === 'flying') {
      return (currentBet.amount * multiplier).toFixed(2);
    }
    return '0.00';
  }, [currentBet, gameState, multiplier]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div className="absolute inset-0 w-full h-full">
        <Background gameState={gameState} />
        <Plane gameState={gameState} multiplier={multiplier} crashPoint={crashPoint} cashoutMultiplier={cashoutMultiplier} />

        {/* BIG SIS REQUEST: Row 3 content — multiplier centered upper area */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <MultiplierDisplay multiplier={multiplier} gameState={gameState} />

          {/* BIG SIS REQUEST: cashout amount displayed on the game board */}
          {cashoutMultiplier > 0 && (
            <div className="mt-3 bg-emerald-600/90 px-5 py-2 rounded-full text-white text-lg font-bold shadow-lg">
              +{currentBetWinningsView} ({cashoutMultiplier.toFixed(2)}×)
            </div>
          )}
        </div>

        {gameState === 'crashed' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-red-500/80 px-6 py-3 rounded-lg text-white text-3xl font-bold animate-bounce">
              CRASHED @ {multiplier.toFixed(2)}×
            </div>
          </div>
        )}

        {/* BIG SIS REQUEST: Row 4 — timer raised up, above the bottom edge */}
        {gameState === 'betting' && nextGameTimestamp && (
          <div className="absolute top-6 left-1/2 transform -translate-x-1/2">
            <CountdownTimer />
          </div>
        )}

        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2">
          <CashoutButton />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Cashout Button Component
// ============================================================================

function CashoutButton() {
  const dispatch = useDispatch<AppDispatch>();
  const { gameState, multiplier, currentBet } = useSelector((state: RootState) => state.crashGame);
  const [showProgressRing, setShowProgressRing] = useState(false);
  const [ringProgress, setRingProgress] = useState(0);

  const isActive = gameState === 'flying' && currentBet.active && !currentBet.cashedOut;

  useEffect(() => {
    if (isActive) {
      const progress = Math.min((multiplier / 50) * 100, 100);
      setRingProgress(progress);
      setShowProgressRing(true);
    } else {
      setShowProgressRing(false);
    }
  }, [multiplier, isActive]);

  const handleCashout = () => {
    if (isActive) {
      const winnings = currentBet.amount * multiplier;
      dispatch(cashout());
    }
  };

  if (!currentBet.active) {
    return null;
  }

  const potentialWinnings = currentBet.amount * multiplier;
  const formattedWinnings = isActive ? potentialWinnings.toFixed(2) : '0.00';
  const profit = isActive ? potentialWinnings - currentBet.amount : 0;

  const getMultiplierColor = () => {
    if (multiplier >= 10) return 'from-blue-500 to-indigo-600';
    if (multiplier >= 5) return 'from-green-500 to-emerald-600';
    if (multiplier >= 2) return 'from-yellow-500 to-amber-600';
    return 'from-orange-500 to-red-600';
  };

  return (
    <div className="relative">
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-lg bg-green-500/20 blur-md"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: 'easeInOut',
          }}
        />
      )}

      {showProgressRing && (
        <svg
          className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] -rotate-90"
          viewBox="0 0 100 100"
        >
          <circle cx="50" cy="50" r="45" fill="none" stroke="#0f172a" strokeWidth="6" />
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={multiplier >= 2 ? '#22c55e' : '#f97316'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="283"
            initial={{ strokeDashoffset: 283 }}
            animate={{
              strokeDashoffset: 283 - (283 * ringProgress) / 100,
            }}
            transition={{ duration: 0.1 }}
          />
        </svg>
      )}

      <motion.div
        initial={{ scale: 1 }}
        animate={{
          scale: isActive ? [1, 1.05, 1] : 1,
          transition: {
            repeat: isActive ? Infinity : 0,
            duration: 0.5,
          },
        }}
        className="relative"
      >
        <button
          className={`relative text-lg font-bold px-6 py-6 shadow-lg rounded-2xl ${
            isActive
              ? `bg-gradient-to-r ${getMultiplierColor()} hover:brightness-110`
              : currentBet.cashedOut
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-800 cursor-default'
              : 'bg-slate-700 cursor-default'
          }`}
          disabled={!isActive}
          onClick={handleCashout}
        >
          <div className="flex flex-col items-center text-white">
            {currentBet.cashedOut ? (
              <>
                <span className="text-xl">Cashed Out</span>
                <span className="text-2xl font-bold">{currentBet.cashedOutAt?.toFixed(2)}×</span>
              </>
            ) : isActive ? (
              <>
                <span className="text-xl">Cash Out</span>
                <span className="text-2xl font-bold">{formattedWinnings}</span>
                <span className="text-sm text-green-200">+{profit.toFixed(2)}</span>
              </>
            ) : (
              <span>Waiting...</span>
            )}
          </div>
        </button>
      </motion.div>
    </div>
  );
}

// ============================================================================
// Betting Panel Component
// ============================================================================

function BettingPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { gameState, multiplier, balance, betAmount, autoCashout, currentBet } = useSelector(
    (state: RootState) => state.crashGame
  );

  const [useAutoCashout, setUseAutoCashout] = useState(false);
  const [autoValue, setAutoValue] = useState<string>('2');
  const [inputValue, setInputValue] = useState(betAmount.toString());
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const canPlaceBet = gameState === 'betting' && !currentBet.active && !isPlacingBet;

  useEffect(() => {
    setInputValue(betAmount.toString());
  }, [betAmount]);

  const potentialReturn = useMemo(() => {
    if (gameState === 'flying' && currentBet.active && !currentBet.cashedOut) {
      return currentBet.amount * multiplier;
    }
    return betAmount * (gameState === 'flying' ? multiplier : 1.0);
  }, [betAmount, multiplier, gameState, currentBet]);

  const profit = useMemo(() => potentialReturn - betAmount, [potentialReturn, betAmount]);

  const handleBetAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      dispatch(setBetAmount(value));
    }
  };

  const handleBetSliderChange = (value: number[]) => {
    dispatch(setBetAmount(value[0]));
  };

  const handleAutoCashoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAutoValue(value);

    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 1) {
      dispatch(setAutoCashout(numValue));
    } else {
      dispatch(setAutoCashout(null));
    }
  };

  const handleAutoCashoutToggle = (checked: boolean) => {
    setUseAutoCashout(checked);

    if (checked) {
      const numValue = parseFloat(autoValue);
      if (!isNaN(numValue) && numValue >= 1) {
        dispatch(setAutoCashout(numValue));
      }
    } else {
      dispatch(setAutoCashout(null));
    }
  };

  const handlePlaceBet = async () => {
    if (!canPlaceBet) return;

    if (betAmount <= 0) {
      setNotification({ message: 'Bet amount must be greater than 0', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (betAmount > balance) {
      setNotification({ message: 'Insufficient balance', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setIsPlacingBet(true);

    try {
      const autoCashoutValue = useAutoCashout ? parseFloat(autoValue) : null;
      dispatch(placeBet({ amount: betAmount, autoCashout: autoCashoutValue }));
      setNotification({ message: `Bet of ${betAmount.toFixed(2)} placed!`, type: 'success' });
    } catch (error) {
      setNotification({ message: 'Failed to place bet', type: 'error' });
    } finally {
      setIsPlacingBet(false);
    }
  };

  const quickBetPresets = [
    { label: '10', value: 10 },
    { label: '25', value: 25 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
  ];

  return (
    <div className="border mx-1 border-slate-700 shadow-lg rounded-lg bg-slate-800">
      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`px-4 py-2 text-sm font-semibold ${
              notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            } text-white rounded-t-lg`}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-2">
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Bet Amount</label>
          </div>

          {/* FIGMA ROW 5: [ - amount + ] [Potential Return] [Bet] in one horizontal row */}
          <div className="grid grid-cols-[1fr_auto] items-stretch gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="flex items-center gap-2 bg-gray-900 rounded-xl p-2">
              <button
                onClick={() => dispatch(setBetAmount(Math.max(betAmount - 10, 1)))}
                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400"
              >
                <span className="text-xl">−</span>
              </button>

              <div className="flex-1 text-center">
                <input
                  type="number"
                  min={1}
                  max={balance}
                  value={inputValue}
                  onChange={handleBetAmountChange}
                  className="text-center font-bold bg-transparent border-none focus:outline-none text-white w-full"
                />
              </div>

              <button
                onClick={() => dispatch(setBetAmount(betAmount + 10))}
                disabled={betAmount + 10 > balance}
                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-gray-400"
              >
                <span className="text-xl">+</span>
              </button>
            </div>

            {/* Potential Return — directly left of the Bet button, updates live */}
            <div className="bg-slate-900 rounded-xl px-3 flex flex-col items-center justify-center min-w-[92px]">
              <div className="text-gray-400 text-[10px] uppercase tracking-wide">Potential Return</div>
              <div className="font-bold text-green-400 text-lg leading-tight">
                {potentialReturn.toFixed(2)}
                <span className="text-xs ml-1 text-green-300">(+{profit.toFixed(2)})</span>
              </div>
            </div>

            {/* bet/cashout toggle — becomes Cash Out once bet is placed */}
            {currentBet.active ? (
              <button
                className="col-span-2 sm:col-span-1 py-2 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold text-lg shadow-lg"
                onClick={() => { if (gameState === 'flying' && !currentBet.cashedOut) dispatch(cashout()); }}
                disabled={gameState !== 'flying' || currentBet.cashedOut}
              >
                <div className="flex flex-col items-center">
                  <span>{currentBet.cashedOut ? 'Cashed Out' : 'Cash Out'}</span>
                  <span className="text-sm opacity-90">
                    {currentBet.cashedOut
                      ? `+${currentBet.winnings.toFixed(2)}`
                      : `+${(currentBet.amount * multiplier - currentBet.amount).toFixed(2)} (${multiplier.toFixed(2)}×)`}
                  </span>
                </div>
              </button>
            ) : (
              <button
                className="col-span-2 sm:col-span-1 py-2 px-4 rounded-2xl bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold text-lg shadow-lg disabled:opacity-50"
                onClick={handlePlaceBet}
                disabled={!canPlaceBet || betAmount <= 0 || betAmount > balance}
              >
                <div className="flex flex-col items-center">
                  <span>{isPlacingBet ? 'Placing Bet...' : 'Bet'}</span>
                  <span className="text-sm opacity-90">{betAmount.toFixed(2)} NGN</span>
                </div>
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {quickBetPresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => dispatch(setBetAmount(preset.value))}
                disabled={preset.value > balance}
                className={`py-2 rounded-lg text-sm font-semibold ${
                  betAmount === preset.value
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {balance > 0 && (
            <input
              type="range"
              min={1}
              max={Math.max(balance, 1)}
              step={1}
              value={Math.min(betAmount, balance)}
              onChange={(e) => handleBetSliderChange([parseFloat(e.target.value)])}
              className="w-full accent-green-500"
            />
          )}

          {/* GLOBAL RULE 4: Virtual currency disclaimer at bottom of bet area */}
          <div className="text-center">
            <span className="text-xs text-slate-500">Virtual currency only. No real money involved.</span>
          </div>
        </div>

        {currentBet.active && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700"
          >
            <h3 className="font-semibold mb-2 text-white">Current Bet</h3>
            <div className="flex justify-between text-base border-b border-slate-700 pb-2 mb-2">
              <span className="text-gray-400">Amount:</span>
              <span className="font-mono font-bold text-white">{currentBet.amount.toFixed(2)}</span>
            </div>

            {gameState === 'flying' && !currentBet.cashedOut && (
              <motion.div
                className="flex justify-between text-sm text-green-400 font-medium"
                animate={{
                  scale: [1, 1.03, 1],
                  transition: { repeat: Infinity, duration: 1.5, ease: 'easeInOut' },
                }}
              >
                <span>Live potential win:</span>
                <span className="font-mono font-bold">
                  {(currentBet.amount * multiplier).toFixed(2)}
                  <span className="ml-1 text-xs opacity-80">({multiplier.toFixed(2)}×)</span>
                </span>
              </motion.div>
            )}

            {currentBet.cashedOut && (
              <div className="flex justify-between text-green-400 font-medium mt-1">
                <span>Cashed out:</span>
                <span className="font-mono font-bold">
                  +{currentBet.winnings.toFixed(2)}
                  <span className="ml-1 text-xs opacity-80">({currentBet.cashedOutAt?.toFixed(2)}×)</span>
                </span>
              </div>
            )}

            {autoCashout !== null && (
              <div className="flex justify-between text-sm text-yellow-400 mt-2 border-t border-slate-700 pt-2">
                <span>Auto Cashout at:</span>
                <span className="font-mono">{autoCashout.toFixed(2)}×</span>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// History Panel Component
// ============================================================================

function HistoryPanel() {
  const { history } = useSelector((state: RootState) => state.crashGame);
  const [isOpen, setIsOpen] = useState(false);

  // BIG SIS REQUEST: history is stored newest-first; show newest 5 in order
  const visibleHistory = history.slice(0, 5);

  return (
    <div className="relative">
      <div className="bg-slate-800 rounded-lg px-4 py-2 flex items-center gap-2">
        {history.length === 0 ? (
          <span className="text-sm text-slate-500">No history yet</span>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-1 overflow-x-auto">
              {visibleHistory.map((item) => (
                <CrashHistoryItem key={item.id} item={item} />
              ))}
            </div>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="ml-2 p-1.5 hover:bg-slate-700 rounded transition-colors flex-shrink-0"
            >
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </>
        )}
      </div>

      <AnimatePresence>
        {isOpen && history.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 z-50 max-h-96 overflow-hidden"
            >
              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">All Crash History</h3>

                <div className="max-h-48 overflow-y-auto mb-4">
                  <div className="flex flex-wrap gap-2">
                    {history.map((item) => (
                      <CrashHistoryItem key={item.id} item={item} showTime />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function CrashHistoryItem({
  item,
  showTime = false,
}: {
  item: HistoryItem;
  showTime?: boolean;
}) {
  const getBgColor = (value: number) => {
    if (value < 1.2) return 'bg-red-500 text-white';
    if (value < 2) return 'bg-orange-500 text-white';
    if (value < 5) return 'bg-yellow-500 text-black';
    if (value < 10) return 'bg-green-500 text-white';
    return 'bg-blue-500 text-white';
  };

  return (
    <div
      className={`px-1 py-1 rounded text-sm ${getBgColor(item.crashPoint)} whitespace-nowrap`}
      title={new Date(item.timestamp).toLocaleTimeString()}
    >
      {item.crashPoint.toFixed(2)}×
    </div>
  );
}

// ============================================================================
// Stats Component
// ============================================================================

function Stats() {
  const dispatch = useDispatch<AppDispatch>();
  const { balance, isMuted } = useSelector((state: RootState) => state.crashGame);

  return (
    <div className="flex items-center gap-3">
      {/* BIG SIS REQUEST: Balance label and value side by side on the same line */}
      <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
        <span className="text-xs text-white/60">Balance</span>
        <span className="font-bold text-green-400">B {balance.toLocaleString()}</span>
      </div>

      <button
        onClick={() => dispatch(toggleMute())}
        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
      >
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
    </div>
  );
}

// ============================================================================
// Main CrashGame Component
// ============================================================================

const CrashGame = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { gameState, isMuted, balance } = useSelector((state: RootState) => state.crashGame);
  const { user } = useSelector((state: RootState) => state.auth);
  const [prevGameState, setPrevGameState] = useState<GameState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Prevent SSR hydration mismatch by only rendering game content on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // BIG SIS REQUEST: sync the game balance with the user's auction-table balance (bidding_balance)
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;

      const { data: profile } = await supabase
        .from('users')
        .select('bidding_balance')
        .eq('id', userId)
        .single();

      if (!cancelled && profile && typeof profile.bidding_balance === 'number') {
        dispatch(setBalance(Number(profile.bidding_balance)));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // Game loop refs
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCashoutCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const crashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize game
  useEffect(() => {
    if (!isInitialized) {
      audioSystem.initialize();
      dispatch(initializeGame());
      setIsInitialized(true);
    }
  }, [dispatch, isInitialized]);

  // Start a round after the "Next round in: 5s" countdown elapses (READY -> FLYING)
  useEffect(() => {
    if (isInitialized && gameState === 'betting') {
      startTimeoutRef.current = setTimeout(() => {
        startNextRound();
      }, 5000);
    }

    return () => {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
      }
    };
  }, [isInitialized, gameState]);

  // Generate crash point and start round
  const startNextRound = useCallback(() => {
    const crashPoint = generateCrashPoint();
    const duration = calculateFlightDuration(crashPoint);

    dispatch(startRound({ crashPoint, duration }));
    audioSystem.playStart(isMuted);

    // Start multiplier update loop
    const startTime = Date.now();
    const endTime = startTime + duration;
    // BIG SIS REQUEST: official Aviator curve — multiplier = 1 + MULTIPLIER_CONST * t^3

    gameLoopRef.current = setInterval(() => {
      const now = Date.now();
      if (now >= endTime) {
        if (gameLoopRef.current) {
          clearInterval(gameLoopRef.current);
          gameLoopRef.current = null;
        }
        return;
      }

      const elapsed = now - startTime;
      const newMultiplier = 1 + MULTIPLIER_CONST * Math.pow(elapsed, 3);

      dispatch(updateMultiplier(newMultiplier));
    }, 33);

    // Auto cashout check
    autoCashoutCheckRef.current = setInterval(() => {
      const state = document.dispatchEvent(new CustomEvent('check-autocashout'));
    }, 100);

    // End round at crash point
    crashTimeoutRef.current = setTimeout(() => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      if (autoCashoutCheckRef.current) {
        clearInterval(autoCashoutCheckRef.current);
        autoCashoutCheckRef.current = null;
      }

      dispatch(endRound(crashPoint));
      audioSystem.playHit(isMuted);

      // Schedule reset — resetGame sets betting + "Next round in: 5s", and the
      // betting-state effect drives the countdown -> startNextRound transition
      resetTimeoutRef.current = setTimeout(() => {
        dispatch(resetGame());
      }, 1500);
    }, duration);
  }, [dispatch, isMuted]);

  // Auto cashout logic - moved to startNextRound callback since we already have access to state

  // Handle sound effects based on game state changes
  useEffect(() => {
    if (prevGameState === null) {
      setPrevGameState(gameState);
      return;
    }

    if (prevGameState !== gameState) {
      if (gameState === 'flying') {
        audioSystem.startTickLoop(isMuted, () => audioSystem.playTick(isMuted));
      } else if (gameState === 'crashed') {
        audioSystem.stopTickLoop();
      }

      setPrevGameState(gameState);
    }
  }, [gameState, isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (autoCashoutCheckRef.current) clearInterval(autoCashoutCheckRef.current);
      if (crashTimeoutRef.current) clearTimeout(crashTimeoutRef.current);
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      if (startTimeoutRef.current) clearTimeout(startTimeoutRef.current);
    };
  }, []);

  // Helper functions
  
  function generateCrashPoint(): number {
    const r = Math.random();
    let crashPoint: number;
    if (r < 0.7) {
      
      crashPoint = 1 + Math.random() * 1;
    } else {
     
      crashPoint = 1 + Math.pow(Math.random(), -0.8);
    }
    return Math.min(50, +crashPoint.toFixed(2));
  }

  
  function calculateFlightDuration(crashPoint: number): number {
    const tMs = Math.pow((crashPoint - 1) / MULTIPLIER_CONST, 1 / 3);
    return Math.max(1200, Math.round(tMs));
  }

  // Prevent SSR hydration mismatch by rendering nothing until client mount
  if (!isMounted) {
    return (
      <div className="min-h-dvh bg-black">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-black">
      <div className="text-white">
        
        <header className="bg-black sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
              Skybound
            </h1>
            {gameState === 'crashed' && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded animate-pulse">
                CRASHED
              </span>
            )}
            {gameState === 'flying' && (
              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded animate-pulse">
                FLYING
              </span>
            )}
          </div>
          <Stats />
        </header>

        
        <div className="px-4 pt-3 pb-2 bg-black">
          <HistoryPanel />
        </div>

        
        <main className="px-4">
          <div className="h-[210px] md:h-[280px] relative rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shadow-xl">
            <GameCanvas />
          </div>

          <div className="flex flex-col gap-3 mt-3">
            <BettingPanel />
          </div>
        </main>
      </div>
    </div>
  );
};

export default CrashGame;