export type BubblePosition = { x: number; y: number; radius: number };

// Largest first, packed from the centre. Positions remain stable when a topic is selected.
export function layoutBubbles(counts: number[], width: number, height: number): BubblePosition[] {
  if (!counts.length || width < 80 || height < 80) return [];
  const weights = counts.map(count => Math.sqrt(Math.max(1, count)));
  const area = weights.reduce((sum, weight) => sum + weight * weight, 0);
  const scale = Math.sqrt(width * height * 0.43 / (Math.PI * area));
  const base = weights.map(weight => Math.min(width * 0.24, 102, Math.max(34, weight * scale)));
  for (let attempt = 0; attempt < 24; attempt++) {
    const circles: BubblePosition[] = [];
    const factor = Math.pow(0.95, attempt);
    for (const radius of base.map(value => Math.max(32, value * factor))) {
      let best: BubblePosition | null = null;
      let bestScore = Infinity;
      for (let y = radius + 8; y <= height - radius - 8; y += 7) {
        for (let x = radius + 8; x <= width - radius - 8; x += 7) {
          const score = ((x - width / 2) / width) ** 2 + ((y - height / 2) / height) ** 2;
          if (score >= bestScore || circles.some(other => Math.hypot(x - other.x, y - other.y) < radius + other.radius + 9)) continue;
          best = { x, y, radius };
          bestScore = score;
        }
      }
      if (!best) break;
      circles.push(best);
    }
    if (circles.length === counts.length) return circles;
  }
  return [];
}
