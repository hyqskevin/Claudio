import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  color: string;
  trail: { x: number; y: number; alpha: number }[];
}

let burstRef: ((x: number, y: number, color?: string) => void) | null = null;

export function burstParticles(x: number, y: number, color = "#5ee8c5") {
  burstRef?.(x, y, color);
}

export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);

  const burst = useCallback((x: number, y: number, color?: string) => {
    // 粒子数量上限：超过 200 时裁剪到 150
    if (particlesRef.current.length > 200) {
      particlesRef.current = particlesRef.current.slice(-150);
    }
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        life: 1.0,
        color: color ?? "#5ee8c5",
        trail: [],
      });
    }
  }, []);

  useEffect(() => {
    burstRef = burst;
    return () => { burstRef = null; };
  }, [burst]);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    // Clear canvas — trail effect via per-particle trail history, NOT by overlaying black
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const alive: Particle[] = [];
    for (const p of particlesRef.current) {
      // Save current position to trail (keep last 5 positions)
      p.trail.push({ x: p.x, y: p.y, alpha: p.life * 0.3 });
      if (p.trail.length > 5) p.trail.shift();

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // gravity
      p.life -= 0.02;

      if (p.life <= 0) continue;

      // Draw trail
      for (const t of p.trail) {
        ctx.globalAlpha = t.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw particle
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      alive.push(p);
    }
    particlesRef.current = alive;
    ctx.globalAlpha = 1;

    animRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [loop]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9998,
      }}
    />
  );
}
