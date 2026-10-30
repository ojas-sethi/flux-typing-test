import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { setupCanvas, cssVar, niceMax, drawGrid, AXIS_FONT } from "../utils/chart";
import "./Results.css";

const PAD = { top: 10, right: 6, bottom: 34, left: 40 };

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
  const [hover, setHover] = useState(null); // { i, x }
  const [copied, setCopied] = useState(false);

  const data = useMemo(() => results?.wpmHistory || [], [results]);

  const drawChart = useCallback(
    (hoverIndex = null) => {
      const canvas = canvasRef.current;
      if (!canvas || data.length < 1) return;
      const { ctx, w, h } = setupCanvas(canvas);

      const accent = cssVar("--accent");
      const ink = cssVar("--text-primary");
      const grid = cssVar("--chart-grid");
      const text = cssVar("--text-secondary");
      const muted = cssVar("--text-muted");
      const error = cssVar("--incorrect");

      const speeds = data.map((d) => d.burst ?? d.wpm);
      const max = niceMax(Math.max(...speeds, ...data.map((d) => d.wpm)));
      const left = PAD.left;
      const right = w - PAD.right;
      const top = PAD.top;
      const bottom = h - PAD.bottom;
      const slot = (right - left) / data.length;
      const barW = Math.max(2, Math.min(slot * 0.42, 9));
      const x = (i) => left + slot * i + slot / 2;
      const y = (v) => bottom - (v / max) * (bottom - top);

      drawGrid(ctx, { left, right, top, bottom, max, gridColor: grid, textColor: text });

      // Speed per second — bars
      speeds.forEach((s, i) => {
        const bx = Math.round(x(i) - barW / 2);
        const by = Math.round(y(s));
        ctx.fillStyle = hoverIndex === null || hoverIndex === i ? accent : muted;
        ctx.fillRect(bx, by, Math.round(barW), Math.max(1, Math.round(bottom) - by));
      });

      // Running average — line
      if (data.length > 1) {
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        ctx.beginPath();
        data.forEach((d, i) => {
          if (i === 0) ctx.moveTo(x(i), y(d.wpm));
          else ctx.lineTo(x(i), y(d.wpm));
        });
        ctx.stroke();
      }

      // Errors — red marks under the baseline
      data.forEach((d, i) => {
        const n = Math.min(d.errors || 0, 3);
        for (let k = 0; k < n; k++) {
          ctx.fillStyle = error;
          ctx.fillRect(Math.round(x(i) - 2), Math.round(bottom + 6 + k * 6), 4, 4);
        }
      });

      // Seconds axis
      ctx.font = AXIS_FONT;
      ctx.fillStyle = text;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const every = Math.max(1, Math.ceil(data.length / 10));
      data.forEach((d, i) => {
        if ((i + 1) % every === 0) {
          ctx.fillText(`${d.second}s`, x(i), h - 2);
        }
      });
    },
    [data]
  );

  useEffect(() => {
    if (!visible || !results) return;
    const t = setTimeout(() => drawChart(), 120);
    const onResize = () => drawChart();
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [visible, results, drawChart]);

  useEffect(() => {
    if (!visible) {
      setHover(null);
      setCopied(false);
    }
  }, [visible]);

  const handleMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const slot = (rect.width - PAD.left - PAD.right) / data.length;
    const i = Math.floor((px - PAD.left) / slot);
    if (i < 0 || i >= data.length) {
      if (hover) {
        setHover(null);
        drawChart();
      }
      return;
    }
    if (hover?.i !== i) {
      setHover({ i, x: PAD.left + slot * i + slot / 2 });
      drawChart(i);
    }
  };

  const handleLeave = () => {
    setHover(null);
    drawChart();
  };

  if (!results) return null;

  const specParts = [];
  if (testConfig) {
    specParts.push(testConfig.mode);
    if (testConfig.mode === "quotes" && testConfig.quoteLength !== "any") {
      specParts.push(testConfig.quoteLength);
    }
    specParts.push(
      testConfig.testType === "time"
        ? `${testConfig.duration} seconds`
        : `${testConfig.wordCountTarget} words`
    );
    if (testConfig.mode === "words" && testConfig.punctuation) specParts.push("punctuation");
    if (testConfig.mode === "words" && testConfig.numbers) specParts.push("numbers");
  }

  const timeTaken =
    testConfig?.testType === "time" ? testConfig.duration : results.timeTaken;

  const handleCopy = () => {
    const credit = testConfig?.quote ? ` typing ${testConfig.quote.author}, ${testConfig.quote.source}` : "";
    const text = `klacks — ${results.wpm} wpm, ${results.accuracy}% accuracy${credit} (${specParts.join(", ")})`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  const hovered = hover ? data[hover.i] : null;

  return (
    <div className={`results-container ${visible ? "visible" : ""}`}>
      <div className="results">
        <div className="results-top">
          <span className="results-spec">{specParts.join("  /  ")}</span>
          {personalBest?.isNew ? (
            <span className="pb-flag">
              <span className="led on" />
              new personal best
              {personalBest.prev > 0 && (
                <span className="pb-delta">+{results.wpm - personalBest.prev}</span>
              )}
            </span>
          ) : (
            personalBest?.prev > 0 && (
              <span className="pb-note">
                best <strong>{personalBest.prev}</strong>
              </span>
            )
          )}
        </div>

        {testConfig?.quote && (
          <p className="results-quote">
            <span className="results-quote-mark" aria-hidden="true">&ldquo;</span>
            <span>
              <strong>{testConfig.quote.author}</strong>
              <cite>{testConfig.quote.source}</cite>
              <span className="results-quote-year">{testConfig.quote.year}</span>
            </span>
          </p>
        )}

        <div className="results-main">
          <div className="hero">
            <span className="label">wpm</span>
            <span className="num hero-value">{results.wpm}</span>
          </div>
          <div className="hero hero-acc">
            <span className="label">accuracy</span>
            <span className="num hero-value-sm">
              {results.accuracy}
              <span className="hero-unit">%</span>
            </span>
          </div>
          <dl className="readouts">
            <div className="readout-item">
              <dt className="label">raw</dt>
              <dd>{results.rawWpm}</dd>
            </div>
            <div className="readout-item">
              <dt className="label">consistency</dt>
              <dd>{results.consistency === null ? "—" : `${results.consistency}%`}</dd>
            </div>
            <div className="readout-item">
              <dt className="label">time</dt>
              <dd>{timeTaken}s</dd>
            </div>
            <div
              className="readout-item"
              title="correct / incorrect / extra / missed"
            >
              <dt className="label">characters</dt>
              <dd>
                {results.correctChars}
                <i>/</i>
                <span className={results.incorrectChars ? "bad" : ""}>
                  {results.incorrectChars}
                </span>
                <i>/</i>
                {results.extraChars}
                <i>/</i>
                {results.missedChars}
              </dd>
            </div>
          </dl>
        </div>

        {data.length > 0 && (
          <div className="rhythm">
            <div className="rhythm-head">
              <span className="label">rhythm</span>
              <div className="rhythm-legend">
                <span><i className="sw bar" />speed each second</span>
                <span><i className="sw line" />average</span>
                <span><i className="sw err" />errors</span>
              </div>
            </div>
            <div
              className="rhythm-chart"
              onMouseMove={handleMove}
              onMouseLeave={handleLeave}
            >
              <canvas ref={canvasRef} />
              {hovered && (
                <div
                  className="chart-tip"
                  style={{ left: hover.x }}
                >
                  <span className="chart-tip-title">second {hovered.second}</span>
                  <span>
                    <b>{hovered.burst ?? hovered.wpm}</b> wpm
                  </span>
                  <span>avg {hovered.wpm}</span>
                  {hovered.errors > 0 && (
                    <span className="bad">
                      {hovered.errors} error{hovered.errors > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="results-footer">
          <div className="results-meta">
            {isLoggedIn && saveStatus ? (
              <span className={`save-status ${saveStatus}`}>
                <span className={`led ${saveStatus === "saved" ? "on" : ""}`} />
                {saveStatus === "saving" && "saving"}
                {saveStatus === "saved" && "saved to profile"}
                {saveStatus === "error" && "couldn't save"}
              </span>
            ) : (
              !isLoggedIn && <span className="save-status">sign in to keep your history</span>
            )}
            <button className="text-btn" onClick={handleCopy} tabIndex={-1}>
              {copied ? "copied" : "copy result"}
            </button>
          </div>

          <div className="results-actions">
            <span className="results-kbd">
              <kbd>tab</kbd>
              <kbd>enter</kbd>
            </span>
            <button className="btn btn-primary restart-btn" onClick={onRestart} tabIndex={-1}>
              next test
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 7h9.5M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
