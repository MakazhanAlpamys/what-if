"use client";

import { useEffect, useRef, useCallback } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  phase: number;
  layer: number;
}

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const starsRef = useRef<Star[]>([]);
  const animFrameRef = useRef<number>(0);

  const initStars = useCallback((width: number, height: number) => {
    const isMobile = width < 768;
    const count = Math.floor((width * height) / (isMobile ? 6000 : 3000));
    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.6 + 0.2,
        speed: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2,
        layer: Math.floor(Math.random() * 3),
      });
    }
    starsRef.current = stars;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      };
    };
    window.addEventListener("mousemove", handleMouseMove);

    let time = 0;
    const parallaxStrength = [2, 5, 10];

    const animate = () => {
      if (document.hidden) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      time += 0.016;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isLight = document.documentElement.classList.contains("light");

      for (const star of starsRef.current) {
        const twinkle = Math.sin(time * star.speed * 60 + star.phase) * 0.3 + 0.7;
        const alpha = star.opacity * twinkle * (isLight ? 0.15 : 1);

        const px = mouseRef.current.x * parallaxStrength[star.layer];
        const py = mouseRef.current.y * parallaxStrength[star.layer];

        ctx.beginPath();
        ctx.arc(star.x + px, star.y + py, star.size, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? `rgba(109, 62, 216, ${alpha})` : `rgba(200, 200, 255, ${alpha})`;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [initStars]);

  return (
    <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
  );
}
