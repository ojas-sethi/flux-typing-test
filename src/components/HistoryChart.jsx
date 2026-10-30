import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { setupCanvas, cssVar, niceMax, drawGrid, AXIS_FONT } from "../utils/chart";
import { configLabel, timeAgo, formatDate } from "../utils/stats";

const PAD = { top: 12, right: 4, bottom: 30, left: 40 };
const MAX_BARS = 200;
const WINDOW = 10;

function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
}

// Every result as a bar, oldest → newest, with a rolling average through it.
export default function HistoryChart({ items, bestId }) {
  const canvasRef = useRef(null);
  const [hover, setHover] = useState(null);

  // Chronological, capped
  const data = useMemo(() => items.slice(0, MAX_BARS).reverse(), [items]);

  const rolling = useMemo(() => {
    const out = [];
    let sum = 0;
    data.forEach((d, i) => {
      sum += d.wpm;
      if (i >= WINDOW) sum -= data[i - WINDOW].wpm;
      out.push(sum / Math.min(i + 1, WINDOW));
    });
    return out;
  }, [data]);

  const draw = useCallback(
    (hoverIndex = null) => {
      const canvas = canvasRef.current;
      if (!canvas || !data.length) return;
      const { ctx, w, h } = setupCanvas(canvas);

      const accent = cssVar("--accent");
      const ink = cssVar("--text-primary");
      const grid = cssVar("--chart-grid");
      const text = cssVar("--text-secondary");
      const bar = cssVar("--bar");

      const max = niceMax(Math.max(...data.map((d) => d.wpm)));
      const left = PAD.left;
      const right = w - PAD.right;
      const top = PAD.top;
      const bottom = h - PAD.bottom;
      const slot = (right - left) / data.length;
      const barW = Math.max(1, Math.min(slot * 0.6, 10));
      const x = (i) => left + slot * i + slot / 2;
      const y = (v) => bottom - (v / max) * (bottom - top);

      drawGrid(ctx, { left, right, top, bottom, max, gridColor: grid, textColor: text });

      data.forEach((d, i) => {
        const bx = Math.round(x(i) - barW / 2);
        const by = Math.round(y(d.wpm));
        ctx.fillStyle =
          i === hoverIndex ? ink : d.id === bestId ? accent : bar;
        ctx.fillRect(bx, by, Math.max(1, Math.round(barW)), Math.round(bottom) - by);
        if (d.won) {
          ctx.fillStyle = accent;
          ctx.fillRect(Math.round(x(i) - 2), Math.round(bottom + 5), 4, 4);
        }
      });

      if (data.length > 2) {
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        ctx.beginPath();
        rolling.forEach((v, i) => {
          if (i === 0) ctx.moveTo(x(i), y(v));
          else ctx.lineTo(x(i), y(v));
        });
        ctx.stroke();
      }

      ctx.font = AXIS_FONT;
      ctx.fillStyle = text;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillText(formatDate(data[0].completedAt), left, h - 2);
      ctx.textAlign = "right";
      ctx.fillText("latest", right, h - 2);
    },
    [data, rolling, bestId]
  );

  useEffect(() => {
    const t = setTimeout(() => draw(), 60);
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [draw]);

  const handleMove = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !data.length) return;
    const slot = (rect.width - PAD.left - PAD.right) / data.length;
    const i = Math.floor((e.clientX - rect.left - PAD.left) / slot);
    if (i < 0 || i >= data.length) {
      if (hover) {
        setHover(null);
        draw();
      }
      return;
    }
    if (hover?.i !== i) {
      const x = PAD.left + slot * i + slot / 2;
      setHover({ i, x: Math.min(Math.max(x, 60), rect.width - 60) });
      draw(i);
    }
  };

  const handleLeave = () => {
    setHover(null);
    draw();
  };

  const d = hover ? data[hover.i] : null;

  return (
    <div className="history-chart" onMouseMove={handleMove} onMouseLeave={handleLeave}>
      <canvas ref={canvasRef} />
      {d && (
        <div className="chart-tip" style={{ left: hover.x }}>
          <span className="chart-tip-title">
            {d.id === bestId ? "personal best · " : ""}
            {timeAgo(d.completedAt)}
          </span>
          <span>
            <b>{d.wpm}</b> wpm · {d.accuracy}%
          </span>
          <span>{configLabel(d)}</span>
          {d.placement && (
            <span>
              {ordinal(d.placement)} of {d.totalParticipants}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
