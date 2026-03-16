import "./Settings.css";

const MODES = [
  { key: "words", label: "words" },
  { key: "sentences", label: "sentences" },
];

const DURATIONS = [15, 30, 60, 120];

export default function Settings({ mode, duration, onModeChange, onDurationChange, faded }) {
  return (
    <div className={`settings ${faded ? "faded" : ""}`}>
      {MODES.map((m) => (
        <button
          key={m.key}
          className={mode === m.key ? "active" : ""}
          onClick={() => onModeChange(m.key)}
          tabIndex={-1}
        >
          {m.label}
        </button>
      ))}
      <span className="divider" />
      {DURATIONS.map((d) => (
        <button
          key={d}
          className={duration === d ? "active" : ""}
          onClick={() => onDurationChange(d)}
          tabIndex={-1}
        >
          {d}s
        </button>
      ))}
    </div>
  );
}
