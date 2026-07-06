// Tiny WebAudio-based keyboard sounds — no assets, near-zero latency.
let audioCtx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// Soft mechanical "klack" — a high tick plus a low body, slightly
// randomized so rapid typing doesn't sound machine-gun uniform.
export function playClick() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  const tick = ctx.createOscillator();
  tick.type = "triangle";
  tick.frequency.setValueAtTime(1800 + Math.random() * 600, t);
  const tickGain = ctx.createGain();
  tickGain.gain.setValueAtTime(0.035, t);
  tickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  tick.connect(tickGain).connect(ctx.destination);
  tick.start(t);
  tick.stop(t + 0.05);

  const body = ctx.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(300 + Math.random() * 80, t);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.05, t);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  body.connect(bodyGain).connect(ctx.destination);
  body.start(t);
  body.stop(t + 0.07);
}

// Dull low thud for mistakes.
export function playError() {
  const ctx = getCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.08);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.05, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}
