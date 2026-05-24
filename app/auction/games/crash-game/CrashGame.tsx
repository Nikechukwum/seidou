'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, useAnimationControls, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, ChevronDown } from 'lucide-react';
import { PageLayout } from '@/components/PageLayout';
import type { RootState, AppDispatch } from '@/redux/store';
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
  cashoutMultiplier,
}: {
  gameState: GameState;
  multiplier: number;
  cashoutMultiplier: number;
}) {
  const controls = useAnimationControls();
  const containerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(0);
  const [planePosition, setPlanePosition] = useState({ x: 5, y: 90 });
  const [angle, setAngle] = useState(0);

  const CRUISE_MULTIPLIER = 4.0;
  const MAX_HEIGHT_PERCENT = 40;
  const START_HEIGHT_PERCENT = 90;
  const BOB_AMPLITUDE_PERCENT = 3;
  const BOB_FREQUENCY = 2;

  useEffect(() => {
    if (gameState !== 'flying') {
      startTimeRef.current = 0;
      return;
    }

    if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }

    const elapsedTime = (Date.now() - startTimeRef.current) / 1000;

    const progress = Math.log(multiplier) / Math.log(50);
    const normalizedProgress = Math.min(1, Math.max(0, progress));
    const xPositionPercent = 5 + (90 * normalizedProgress);

    let yPositionPercent: number;
    let planeAngle: number;

    if (multiplier <= CRUISE_MULTIPLIER) {
      const riseProgress = (multiplier - 1) / (CRUISE_MULTIPLIER - 1);
      yPositionPercent = START_HEIGHT_PERCENT - ((START_HEIGHT_PERCENT - MAX_HEIGHT_PERCENT) * riseProgress);
      planeAngle = -20 * riseProgress;
    } else {
      const bobOffset = Math.sin(elapsedTime * BOB_FREQUENCY * Math.PI * 2) * BOB_AMPLITUDE_PERCENT;
      yPositionPercent = MAX_HEIGHT_PERCENT + bobOffset;
      planeAngle = Math.cos(elapsedTime * BOB_FREQUENCY * Math.PI * 2) * 5;
    }

    setPlanePosition({ x: xPositionPercent, y: yPositionPercent });
    setAngle(planeAngle);
  }, [multiplier, gameState]);

  useEffect(() => {
    if (gameState === 'betting' || gameState === 'idle') {
      setPlanePosition({ x: 5, y: START_HEIGHT_PERCENT });
      setAngle(0);
      startTimeRef.current = 0;
    }

    if (gameState === 'crashed') {
      controls.start({
        y: 300,
        rotate: 90,
        opacity: [1, 0.8, 0.6, 0.4, 0],
        transition: { duration: 1, ease: 'easeIn' },
      });
    } else {
      controls.start({
        y: 0,
        rotate: 0,
        opacity: 1,
        transition: { duration: 0.3 },
      });
    }
  }, [gameState, controls]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line
          x1="0"
          y1={MAX_HEIGHT_PERCENT}
          x2="100"
          y2={MAX_HEIGHT_PERCENT}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="0.2"
          strokeDasharray="2,1"
        />
      </svg>

      <div className="absolute top-0 left-0 w-full h-full overflow-visible">
        <motion.div
          animate={controls}
          style={{
            position: 'absolute',
            left: `${planePosition.x}%`,
            top: `${planePosition.y}%`,
            transformOrigin: 'center center',
            zIndex: 40,
          }}
        >
          <motion.div
            className={`w-20 h-20 md:w-28 md:h-28 flex items-center justify-center -mt-10 -ml-10 md:-mt-14 md:-ml-14
              ${gameState === 'crashed'
                ? 'text-red-500'
                : cashoutMultiplier > 0
                ? 'text-green-500'
                : 'text-yellow-300'
              }`}
            style={{
              transform: `rotate(${angle}deg)`,
              transition: 'transform 0.1s ease-out',
            }}
          >
            <div className="absolute inset-0 rounded-full bg-white/40 blur-md" />

            <svg
              viewBox="0 0 24 24"
              width="100%"
              height="100%"
              fill="currentColor"
              strokeWidth="0.5"
              stroke="#000"
              className={gameState === 'crashed' ? 'animate-spin' : ''}
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

            {gameState === 'crashed' && (
              <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2">
                <div className="w-20 h-20 bg-gradient-to-t from-red-600 to-orange-400 rounded-full blur-md animate-pulse" />
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

      <div className="flex items-center space-x-1 mt-2">
        <div className="flex items-center justify-between w-full max-w-[200px] h-2 bg-slate-800/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((multiplier / 50) * 100, 100)}%` }}
            className="h-full bg-gradient-to-r from-yellow-500 to-red-500"
          />
        </div>
      </div>

      <div className="flex justify-between w-full max-w-[200px] text-xs font-normal text-white/70 mt-1">
        <span>1×</span>
        <span>Max: 50×</span>
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
  const { gameState, multiplier, cashoutMultiplier, nextGameTimestamp } = useSelector(
    (state: RootState) => state.crashGame
  );

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
        <Plane gameState={gameState} multiplier={multiplier} cashoutMultiplier={cashoutMultiplier} />

        <div className="absolute inset-0 flex flex-col items-center justify-between p-4">
          <MultiplierDisplay multiplier={multiplier} gameState={gameState} />

          <div className="self-end mb-4 mr-4">
            <CashoutButton />
          </div>
        </div>

        {gameState === 'crashed' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-red-500/80 px-6 py-3 rounded-lg text-white text-3xl font-bold animate-bounce">
              CRASHED @ {multiplier.toFixed(2)}×
            </div>
          </div>
        )}

        {gameState === 'flying' && cashoutMultiplier > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-green-500/80 px-6 py-3 rounded-lg text-white text-3xl font-bold animate-pulse">
              CASHED OUT @ {cashoutMultiplier.toFixed(2)}×
            </div>
          </div>
        )}

        {gameState === 'betting' && nextGameTimestamp && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <CountdownTimer />
          </div>
        )}
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
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="grid grid-cols-2 justify-between">
              <label className="text-sm font-medium text-gray-300">Bet Amount</label>

              {betAmount > 0 && (
                <div className="text-sm">
                  <div className="text-gray-400 text-xs mb-1">Potential Return</div>
                  <div className="font-bold text-green-400">
                    {potentialReturn.toFixed(2)}
                    <span className="text-xs ml-2 text-green-300">(+{profit.toFixed(2)})</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 bg-gray-900 rounded-xl p-3">
                <button
                  onClick={() => dispatch(setBetAmount(Math.max(betAmount - 10, 1)))}
                  className="w-5 h-5 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400"
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
                  className="w-5 h-5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-gray-400"
                >
                  <span className="text-xl">+</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
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
            </div>

            <button
              className="w-full h-full py-4 rounded-2xl bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold text-lg shadow-lg disabled:opacity-50"
              onClick={handlePlaceBet}
              disabled={!canPlaceBet || betAmount <= 0 || betAmount > balance}
            >
              <div className="flex flex-col items-center">
                <span>{isPlacingBet ? 'Placing Bet...' : 'Bet'}</span>
                <span className="text-sm opacity-90">{betAmount.toFixed(2)} NGN</span>
              </div>
            </button>
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

  const visibleHistory = history.slice(-5).reverse();

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
                    {[...history].reverse().map((item) => (
                      <CrashHistoryItem key={item.id} item={item} showTime />
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-3">
                  <HistoryStats history={history} />
                </div>

                <div className="flex justify-between mt-3 text-xs text-slate-400">
                  <div>Min: 1.00×</div>
                  <div>Max: 50.00×</div>
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

function HistoryStats({ history }: { history: Array<{ crashPoint: number }> }) {
  const avgCrash = history.reduce((sum, item) => sum + item.crashPoint, 0) / history.length;
  const lowCrashes = history.filter(item => item.crashPoint < 2).length;
  const lowCrashPercent = Math.round((lowCrashes / history.length) * 100);

  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div className="bg-slate-900 p-2 rounded">
        <div className="text-slate-400">Avg. Crash</div>
        <div className="font-semibold text-slate-200">{avgCrash.toFixed(2)}×</div>
      </div>
      <div className="bg-slate-900 p-2 rounded">
        <div className="text-slate-400">Below 2×</div>
        <div className="font-semibold text-slate-200">{lowCrashPercent}%</div>
      </div>
    </div>
  );
}

// ============================================================================
// Stats Component
// ============================================================================

function Stats() {
  const dispatch = useDispatch<AppDispatch>();
  const { balance, isMuted } = useSelector((state: RootState) => state.crashGame);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-xs text-slate-400">Balance</div>
          <div className="font-semibold text-green-400">{balance.toFixed(2)}</div>
        </div>

        <div className="hidden md:block">
          <div className="text-xs text-slate-400">Time</div>
          <div className="font-mono text-white">{currentTime.toLocaleTimeString()}</div>
        </div>
      </div>

      <button
        onClick={() => dispatch(toggleMute())}
        className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-white"
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

  // Start the first round after initialization
  useEffect(() => {
    if (isInitialized && gameState === 'betting') {
      startTimeoutRef.current = setTimeout(() => {
        startNextRound();
      }, 10000);
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
      const progress = elapsed / duration;
      const newMultiplier = Math.min(
        1 + Math.exp(progress * 2.8) - 1,
        crashPoint,
        50
      );

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

      // Schedule reset
      resetTimeoutRef.current = setTimeout(() => {
        dispatch(resetGame());

        // Schedule next round
        startTimeoutRef.current = setTimeout(() => {
          startNextRound();
        }, 5000);
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
    const rand = Math.random();
    if (rand < 0.3) {
      return 1 + Math.random() * 0.5; // 30% chance of early crash (1.0-1.5x)
    } else if (rand < 0.6) {
      return 1.5 + Math.random() * 3.5; // 30% chance of medium crash (1.5-5x)
    } else {
      return 5 + Math.random() * 45; // 40% chance of high crash (5-50x)
    }
  }

  function calculateFlightDuration(crashPoint: number): number {
    if (crashPoint < 5) {
      return crashPoint * 2000;
    }
    return 10000 + crashPoint * 800;
  }

  // Prevent SSR hydration mismatch by rendering nothing until client mount
  if (!isMounted) {
    return (
      <PageLayout pageTitle="Crash Game" className="bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout pageTitle="Crash Game" className="bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen">
      <div className="text-white">
        <header className="p-2 border-b border-slate-700 flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">SkyCrash</h1>
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
          <div className="flex items-center gap-4">
            <Stats />
          </div>
        </header>

        <div className="mb-4">
          <HistoryPanel />
        </div>

        <main className="grid gap-4 md:grid-cols-3 md:gap-6">
          <div className="md:col-span-2 h-[250px] md:h-[350px] relative rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shadow-xl">
            <GameCanvas />
          </div>

          <div className="flex flex-col gap-4">
            <BettingPanel />
          </div>
        </main>

        <footer className="mt-6 p-4 pb-20 border-t border-slate-700 text-center text-sm text-slate-400">
          <p>Virtual currency only. No real money involved.</p>
          <p className="mt-1 text-xs opacity-60">
            Max multiplier: 50.00×, Max flight time: 60 seconds
          </p>
        </footer>
      </div>
    </PageLayout>
  );
};

export default CrashGame;