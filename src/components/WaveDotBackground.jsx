import { useEffect, useRef } from 'react';

export default function WaveDotBackground() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H;
    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const COLS = 45;
    const ROWS = 55;
    let t = 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Base dark background
      ctx.fillStyle = '#060a06';
      ctx.fillRect(0, 0, W, H);

      // Green glow — top left
      const g1 = ctx.createRadialGradient(W * 0.08, H * 0.18, 0, W * 0.08, H * 0.18, W * 0.45);
      g1.addColorStop(0, 'rgba(16,185,129,0.18)');
      g1.addColorStop(0.5, 'rgba(16,185,129,0.07)');
      g1.addColorStop(1, 'transparent');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);

      // Green glow — bottom right
      const g2 = ctx.createRadialGradient(W * 0.85, H * 0.78, 0, W * 0.85, H * 0.78, W * 0.5);
      g2.addColorStop(0, 'rgba(52,211,153,0.14)');
      g2.addColorStop(0.5, 'rgba(16,185,129,0.06)');
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);

      // Subtle center glow
      const g3 = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.6);
      g3.addColorStop(0, 'rgba(10,150,100,0.05)');
      g3.addColorStop(1, 'transparent');
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, W, H);

      // Dot wave grid
      const spacingX = W / (COLS - 1);
      const spacingY = H / (ROWS - 1);

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const baseX = col * spacingX;
          const baseY = row * spacingY;

          // Wave distortion: combine multiple sine waves for organic feel
          const wave1 = Math.sin((col / COLS) * Math.PI * 3 + (row / ROWS) * Math.PI * 2 + t * 0.6) * 18;
          const wave2 = Math.cos((row / ROWS) * Math.PI * 2.5 + (col / COLS) * Math.PI + t * 0.4) * 12;
          const wave3 = Math.sin((col + row) / (COLS + ROWS) * Math.PI * 4 + t * 0.5) * 8;

          const x = baseX + wave2 * 0.3;
          const y = baseY + wave1 + wave3;

          // Dot size varies with wave height
          const waveVal = (Math.sin((col / COLS) * Math.PI * 3 + (row / ROWS) * Math.PI * 2 + t * 0.6) + 1) / 2;
          const radius = 0.6 + waveVal * 1.4;

          // Brightness based on position and wave
          const brightness = 0.15 + waveVal * 0.65;

          // Color: mostly white/grey, greenish near glows
          const greenInfluence = Math.max(0,
            0.4 - Math.sqrt(Math.pow(col / COLS - 0.08, 2) + Math.pow(row / ROWS - 0.18, 2)) * 1.5
          ) + Math.max(0,
            0.35 - Math.sqrt(Math.pow(col / COLS - 0.85, 2) + Math.pow(row / ROWS - 0.78, 2)) * 1.5
          );

          const r = Math.round(255 * brightness * (1 - greenInfluence * 0.5));
          const g = Math.round(255 * brightness * (1 + greenInfluence * 0.8));
          const b = Math.round(255 * brightness * (1 - greenInfluence * 0.3));

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${brightness * 0.9})`;
          ctx.fill();
        }
      }

      t += 0.012;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0, pointerEvents: 'none' }}
    />
  );
}