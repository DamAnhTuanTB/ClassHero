"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

const CONFETTI_COLORS = [
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
] as const;

const EFFECT_DURATION_MS = 5_200;

type ConfettiParticle = {
  color: (typeof CONFETTI_COLORS)[number];
  delay: number;
  height: number;
  rotation: number;
  rotationSpeed: number;
  velocityX: number;
  velocityY: number;
  width: number;
  wobble: number;
  wobbleSpeed: number;
  x: number;
  y: number;
};

export function AssessmentResultConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const activeCanvas: HTMLCanvasElement = canvas;
    const drawingContext: CanvasRenderingContext2D = context;
    let animationFrameId = 0;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    function resizeCanvas() {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      activeCanvas.width = Math.round(viewportWidth * pixelRatio);
      activeCanvas.height = Math.round(viewportHeight * pixelRatio);
      activeCanvas.style.width = `${viewportWidth}px`;
      activeCanvas.style.height = `${viewportHeight}px`;
      drawingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    resizeCanvas();

    const particleCount = viewportWidth < 640 ? 54 : 70;
    const particles = Array.from({ length: particleCount }, (_, index) =>
      createParticle(index, viewportWidth, viewportHeight),
    );
    const startedAt = performance.now();
    let lastFrameAt = startedAt;

    function renderFrame(now: number) {
      const elapsed = now - startedAt;
      const deltaSeconds = Math.min((now - lastFrameAt) / 1_000, 0.032);
      lastFrameAt = now;
      drawingContext.clearRect(0, 0, viewportWidth, viewportHeight);

      for (const particle of particles) {
        if (elapsed < particle.delay) continue;

        particle.velocityY += 52 * deltaSeconds;
        particle.velocityX *= 1 - 0.12 * deltaSeconds;
        particle.x +=
          (particle.velocityX + Math.sin(particle.wobble) * 24) * deltaSeconds;
        particle.y += particle.velocityY * deltaSeconds;
        particle.rotation += particle.rotationSpeed * deltaSeconds;
        particle.wobble += particle.wobbleSpeed * deltaSeconds;

        const bottomFade = Math.min(1, Math.max(0, (viewportHeight - particle.y) / 90));

        drawingContext.save();
        drawingContext.globalAlpha = bottomFade;
        drawingContext.translate(particle.x, particle.y);
        drawingContext.rotate(particle.rotation);
        drawingContext.scale(Math.cos(particle.wobble), 1);
        drawingContext.fillStyle = particle.color;
        drawingContext.fillRect(
          -particle.width / 2,
          -particle.height / 2,
          particle.width,
          particle.height,
        );
        drawingContext.restore();
      }

      if (elapsed < EFFECT_DURATION_MS) {
        animationFrameId = window.requestAnimationFrame(renderFrame);
      } else {
        drawingContext.clearRect(0, 0, viewportWidth, viewportHeight);
      }
    }

    animationFrameId = window.requestAnimationFrame(renderFrame);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [shouldReduceMotion]);

  if (shouldReduceMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="assessment-result-confetti"
      className="pointer-events-none fixed inset-0 z-30"
    />
  );
}

function createParticle(
  index: number,
  viewportWidth: number,
  viewportHeight: number,
): ConfettiParticle {
  const isFirstWave = index < 20;

  return {
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length] ?? CONFETTI_COLORS[0],
    delay: isFirstWave ? 0 : Math.random() * 450,
    height: 8 + Math.random() * 6,
    rotation: Math.random() * Math.PI,
    rotationSpeed: (Math.random() - 0.5) * 7,
    velocityX: (Math.random() - 0.5) * 70,
    velocityY: 210 + Math.random() * 120,
    width: 5 + Math.random() * 4,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: 3 + Math.random() * 3,
    x: Math.random() * viewportWidth,
    y: isFirstWave
      ? -16 + Math.random() * Math.min(viewportHeight * 0.26, 240)
      : -12 - Math.random() * 45,
  };
}
