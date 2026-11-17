export function createSnowfall(width: number, height: number) {
  const random = (seed: number) => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const flakes = Array.from({ length: 110 }, (_, i) => {
    const depth = random(i + 500);
    return {
      x: random(i + 100) * width,
      y: random(i + 200) * height,
      radius: 0.8 + depth * 2.8,
      speed: 18 + depth * 48,
      drift: -6 + random(i + 300) * 16,
      sway: 5 + random(i + 400) * 15,
      phase: random(i + 600) * Math.PI * 2,
      opacity: 0.3 + depth * 0.55,
    };
  });
  const margin = 12;
  const wrap = (value: number, extent: number) => ((value % extent) + extent) % extent;

  return {
    draw(ctx: CanvasRenderingContext2D, time: number) {
      ctx.save();
      ctx.fillStyle = '#f6fbff';
      ctx.strokeStyle = '#f6fbff';
      ctx.lineWidth = 0.9;
      ctx.lineCap = 'round';
      for (const flake of flakes) {
        const x = wrap(flake.x + time * flake.drift
          + Math.sin(time * 0.65 + flake.phase) * flake.sway, width + margin * 2) - margin;
        const y = wrap(flake.y + time * flake.speed, height + margin * 2) - margin;
        ctx.globalAlpha = flake.opacity;
        ctx.beginPath();
        if (flake.radius > 2.8) {
          for (let arm = 0; arm < 3; arm++) {
            const angle = arm * Math.PI / 3 + flake.phase + time * 0.2;
            const dx = Math.cos(angle) * flake.radius;
            const dy = Math.sin(angle) * flake.radius;
            ctx.moveTo(x - dx, y - dy);
            ctx.lineTo(x + dx, y + dy);
          }
          ctx.stroke();
        } else {
          ctx.arc(x, y, flake.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    },
  };
}
