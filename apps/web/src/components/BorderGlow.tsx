import { useEffect, useRef } from "react";

interface Props {
  targetSelector?: string;
}

export default function BorderGlow({ targetSelector = ".main-inner" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const wave = (seed: number, t: number, pos: number) =>
      Math.sin(pos * 0.008 + t * 0.4 + seed) * 0.35 +
      Math.sin(pos * 0.015 - t * 0.25 + seed * 2.7) * 0.25 +
      Math.sin(pos * 0.003 + t * 0.15 + seed * 0.5) * 0.4;

    const draw = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);

      const appEl = document.querySelector(targetSelector);
      if (!appEl) {
        frameRef.current = requestAnimationFrame(draw);
        return;
      }
      const r = appEl.getBoundingClientRect();
      const R = 24;
      const t = performance.now() * 0.001;
      const amp = 10;

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();

      // Top edge (right to left)
      for (let x = r.right - R; x >= r.left + R; x -= 3) {
        const wv = wave(0, t, x) * amp;
        ctx.lineTo(x, r.top + wv);
      }

      // Top-left corner
      for (let a = Math.PI * 1.5; a >= Math.PI; a -= 0.06) {
        const cx = r.left + R;
        const cy = r.top + R;
        const wv = wave(1, t, a * 100) * amp * 0.6;
        ctx.lineTo(cx + Math.cos(a) * (R + wv), cy + Math.sin(a) * (R + wv));
      }

      // Left edge (top to bottom)
      for (let y = r.top + R; y <= r.bottom - R; y += 3) {
        const wv = wave(2, t, y) * amp;
        ctx.lineTo(r.left + wv, y);
      }

      // Bottom-left corner
      for (let a = Math.PI; a >= Math.PI * 0.5; a -= 0.06) {
        const cx = r.left + R;
        const cy = r.bottom - R;
        const wv = wave(3, t, a * 100) * amp * 0.6;
        ctx.lineTo(cx + Math.cos(a) * (R + wv), cy + Math.sin(a) * (R + wv));
      }

      // Bottom edge (left to right)
      for (let x = r.left + R; x <= r.right - R; x += 3) {
        const wv = wave(4, t, x) * amp;
        ctx.lineTo(x, r.bottom + wv);
      }

      // Bottom-right corner
      for (let a = Math.PI * 0.5; a >= 0; a -= 0.06) {
        const cx = r.right - R;
        const cy = r.bottom - R;
        const wv = wave(5, t, a * 100) * amp * 0.6;
        ctx.lineTo(cx + Math.cos(a) * (R + wv), cy + Math.sin(a) * (R + wv));
      }

      // Right edge (bottom to top)
      for (let y = r.bottom - R; y >= r.top + R; y -= 3) {
        const wv = wave(6, t, y) * amp;
        ctx.lineTo(r.right + wv, y);
      }

      // Top-right corner
      for (let a = 0; a <= Math.PI * 0.5; a += 0.06) {
        const cx = r.right - R;
        const cy = r.top + R;
        const wv = wave(7, t, a * 100) * amp * 0.6;
        ctx.lineTo(cx + Math.cos(a) * (R + wv), cy + Math.sin(a) * (R + wv));
      }

      ctx.closePath();

      const layers = [
        { w: 80, blur: 40, alpha: 0.08 },
        { w: 55, blur: 25, alpha: 0.15 },
        { w: 35, blur: 12, alpha: 0.25 },
        { w: 18, blur: 5, alpha: 0.35 },
      ];
      for (const l of layers) {
        ctx.lineWidth = l.w;
        ctx.filter = `blur(${l.blur}px)`;
        ctx.strokeStyle = `rgba(170, 130, 255, ${l.alpha})`;
        ctx.stroke();
      }
      ctx.filter = "none";
      ctx.restore();

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [targetSelector]);

  return <canvas ref={canvasRef} className="border-glow-canvas" />;
}
