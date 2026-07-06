import { useEffect, useRef, useCallback } from "react";
import "./Results.css";

export default function Results({
  visible,
  results,
  onRestart,
  saveStatus,
  isLoggedIn,
  personalBest,
  testConfig,
}) {
  const canvasRef = useRef(null);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !results) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 12, right: 12, bottom: 24, left: 36 };

    const data = results.wpmHistory;
    if (!data || data.length < 2) return;

    const hasRaw = data.some((d) => typeof d.raw === "number");
    const maxWpm = Math.max(
      ...data.map((d) => d.wpm),
      ...(hasRaw ? data.map((d) => d.raw || 0) : []),
      10
    );
    const maxTime = data[data.length - 1].second;
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const xScale = (s) => pad.left + (s / maxTime) * chartW;
    const yScale = (v) => pad.top + chartH - (v / (maxWpm * 1.15)) * chartH;

    const style = getComputedStyle(document.documentElement);
    const lineColor = style.getPropertyValue("--chart-line").trim();
    const gridColor = style.getPropertyValue("--chart-grid").trim();
    const textColor = style.getPropertyValue("--text-secondary").trim();
    const mutedColor = style.getPropertyValue("--text-muted").trim();

    // Grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (i / 3) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      const val = Math.round(maxWpm * 1.15 * (1 - i / 3));
      ctx.fillStyle = textColor;
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(val, pad.left - 8, y + 3);
    }

    // X labels
    const xSteps = Math.min(data.length, 5);
    const xInterval = Math.max(1, Math.floor(data.length / xSteps));
    ctx.textAlign = "center";
    for (let i = 0; i < data.length; i += xInterval) {
      ctx.fillStyle = textColor;
      ctx.fillText(data[i].second + "s", xScale(data[i].second), h - 4);
    }

    // Raw wpm line (muted, behind the main line)
    if (hasRaw) {
      ctx.beginPath();
      ctx.strokeStyle = mutedColor;
      ctx.lineWidth = 1.25;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.55;
      data.forEach((d, i) => {
        const x = xScale(d.second);
        const y = yScale(d.raw || 0);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    data.forEach((d, i) => {
      const x = xScale(d.second);
      const y = yScale(d.wpm);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    gradient.addColorStop(0, lineColor + "25");
    gradient.addColorStop(1, lineColor + "00");

    ctx.lineTo(xScale(data[data.length - 1].second), pad.top + chartH);
    ctx.lineTo(xScale(data[0].second), pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Dots
    data.forEach((d) => {
      ctx.beginPath();
      ctx.arc(xScale(d.second), yScale(d.wpm), 2.5, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
    });
  }, [results]);

  useEffect(() => {
    if (visible && results) {
      const t = setTimeout(drawChart, 200);
      return () => clearTimeout(t);
    }
  }, [visible, results, drawChart]);

  if (!results) return null;

  // Build meta description line: "words · 15s · punctuation"
  const metaParts = [];
  if (testConfig) {
    metaParts.push(testConfig.mode);
    if (testConfig.testType === "time") {
      metaParts.push(`${testConfig.duration}s`);
    } else {
      metaParts.push(`${testConfig.wordCountTarget} words`);
      if (results.timeTaken) metaParts.push(`${results.timeTaken}s`);
    }
    if (testConfig.mode === "words" && testConfig.punctuation) metaParts.push("punctuation");
    if (testConfig.mode === "words" && testConfig.numbers) metaParts.push("numbers");
  }

  return (
    <div className={`results-container ${visible ? "visible" : ""}`}>
      <div className="results">
        <div className="results-spread">
          <div className="results-left">
            <div className="results-eyebrow">— result</div>
            <div className="results-hero">
              <span className="results-hero-value">{results.wpm}</span>
              <span className="results-hero-label">wpm</span>
            </div>
            {metaParts.length > 0 && (
              <div className="results-meta">{metaParts.join(" · ")}</div>
            )}
            {personalBest?.isNew ? (
              <div className="pb-badge">
                <span className="pb-star">*</span> new personal best
                {personalBest.prev > 0 && (
                  <span className="pb-prev"> — was {personalBest.prev}</span>
                )}
              </div>
            ) : (
              personalBest?.prev > 0 && (
                <div className="pb-note">personal best {personalBest.prev} wpm</div>
              )
            )}
          </div>

          <div className="results-right">
            <div className="stat-row">
              <span className="stat-label">accuracy</span>
              <span className="stat-value">{results.accuracy}%</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">raw</span>
              <span className="stat-value">{results.rawWpm}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">consistency</span>
              <span className="stat-value">{results.consistency}%</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">characters</span>
              <span className="stat-value">{results.totalChars}</span>
            </div>
            <div className="stat-row chars">
              <span className="stat-label">errors</span>
              <span className="stat-value">
                <em className={results.incorrectChars > 0 ? "bad" : ""}>
                  {results.incorrectChars} wrong
                </em>
                {" / "}{results.extraChars} extra{" / "}{results.missedChars} missed
              </span>
            </div>
          </div>
        </div>

        <div className="chart-card">
          <canvas ref={canvasRef} />
        </div>

        <div className="results-footer">
          {isLoggedIn && saveStatus ? (
            <span className={`save-status ${saveStatus}`}>
              {saveStatus === "saving" && "saving..."}
              {saveStatus === "saved" && "result saved"}
              {saveStatus === "error" && "save failed"}
            </span>
          ) : (
            <span className="save-status" />
          )}

          <div className="results-actions">
            <button className="restart-btn" onClick={onRestart} tabIndex={-1}>
              try again <span className="restart-arrow">↳</span>
            </button>
            <span className="results-kbd-hint">
              <kbd>tab</kbd>+<kbd>enter</kbd>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
