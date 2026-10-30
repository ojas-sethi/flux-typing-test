// Shared canvas helpers so every chart in the app speaks the same language.

export function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, w: rect.width, h: rect.height };
}

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Round an axis maximum up to a friendly step (10, 20, 50…)
export function niceMax(value) {
  const v = Math.max(value, 10);
  const step = v <= 60 ? 10 : v <= 150 ? 20 : 50;
  return Math.ceil((v * 1.08) / step) * step;
}

export const AXIS_FONT = "10px 'Fragment Mono', ui-monospace, monospace";

// Horizontal gridlines with right-aligned mono labels on the left gutter
export function drawGrid(ctx, { left, right, top, bottom, max, gridColor, textColor }) {
  // Pick a line count that lands every label on a round number
  const lines = [4, 3, 5, 2].find((n) => (max / n) % 5 === 0) || 4;
  ctx.font = AXIS_FONT;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= lines; i++) {
    const y = Math.round(top + ((bottom - top) * i) / lines) + 0.5;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.fillText(String(Math.round(max * (1 - i / lines))), left - 10, y);
  }
}
