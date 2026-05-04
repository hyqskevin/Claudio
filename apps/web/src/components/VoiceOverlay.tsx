import { useEffect, useRef, useState, useCallback } from "react";
import { stop } from "../utils/voiceSynth";

export default function VoiceOverlay() {
  const [visible, setVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const onStart = () => setVisible(true);
    const onEnd = () => setVisible(false);
    window.addEventListener("voiceStart", onStart);
    window.addEventListener("voiceEnd", onEnd);
    return () => {
      window.removeEventListener("voiceStart", onStart);
      window.removeEventListener("voiceEnd", onEnd);
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const barCount = 40;
    const barWidth = w / barCount;
    const time = Date.now() / 1000;

    for (let i = 0; i < barCount; i++) {
      const baseHeight = visible
        ? 20 + Math.random() * (h * 0.6)
        : 10 + Math.sin(time * 2 + i * 0.3) * 8;
      const barH = baseHeight;
      const x = i * barWidth;
      const y = (h - barH) / 2;

      ctx.fillStyle = visible
        ? `rgba(94, 232, 197, ${0.4 + Math.random() * 0.4})`
        : "rgba(94, 232, 197, 0.15)";
      ctx.beginPath();
      ctx.roundRect(x + 1, y, barWidth - 2, barH, 2);
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [visible]);

  useEffect(() => {
    if (visible) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    }
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [visible, draw]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(10px)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "80%", height: 120, marginBottom: 24 }}
      />
      <div style={{ color: "var(--text-primary, #e8e8f0)", fontSize: 18, fontWeight: 500 }}>
        DJ is speaking...
      </div>
      <button
        onClick={() => stop()}
        style={{
          marginTop: 24,
          padding: "8px 24px",
          borderRadius: 20,
          border: "1px solid var(--border-light, rgba(255,255,255,0.1))",
          background: "var(--bg-glass, rgba(255,255,255,0.04))",
          color: "var(--text-secondary, #8888a0)",
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        Close
      </button>
    </div>
  );
}
