import { memo, useMemo } from "react";
import "./Ruler.css";

const MAX_BAR = 22; // px — tallest speed tick
const UNIT_TICK = 7;
const MINOR_TICK = 3;

// A measuring-tape progress indicator. Each unit (a second, or a word) is a
// tick; once a unit is done its tick grows to the speed you typed it at.
function Ruler({ total, value, speeds = [], running }) {
  const units = Math.max(1, total);
  const sub = units <= 15 ? 4 : units <= 30 ? 2 : 1;
  const tickCount = units * sub + 1;

  const maxSpeed = useMemo(() => {
    let m = 0;
    for (const s of speeds) if (s > m) m = s;
    return Math.max(m, 60);
  }, [speeds]);

  const done = running ? Math.min(value, units) : 0;

  const ticks = [];
  for (let j = 0; j < tickCount; j++) {
    const isUnit = j % sub === 0;
    const unitIndex = j / sub; // boundary after `unitIndex` units
    const elapsed = running && j / sub <= done;
    const isHead = running && isUnit && unitIndex === Math.floor(done);
    let height = isUnit ? UNIT_TICK : MINOR_TICK;
    let cls = "tick";

    if (isUnit && unitIndex > 0 && elapsed) {
      const speed = speeds[unitIndex - 1];
      if (speed > 0) {
        height = Math.max(UNIT_TICK, Math.round((speed / maxSpeed) * MAX_BAR));
        cls += " speed";
      } else {
        cls += " on";
      }
    } else if (elapsed) {
      cls += " on";
    }
    if (isHead) cls += " head";

    ticks.push(<span key={j} className={cls} style={{ height }} />);
  }

  return (
    <div className={`ruler ${running ? "running" : ""}`} aria-hidden="true">
      {ticks}
    </div>
  );
}

export default memo(Ruler);
