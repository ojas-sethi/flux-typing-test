import "./Settings.css";

const MODES = [
  { key: "words", label: "words" },
  { key: "sentences", label: "sentences" },
];

const DURATIONS = [15, 30, 60, 120];
const WORD_COUNTS = [10, 25, 50, 100];

export default function Settings({
  mode,
  testType,
  duration,
  wordCountTarget,
  onModeChange,
  onDurationChange,
  onWordCountChange,
  faded,
}) {
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
      <span className="settings-group-label">time</span>
      {DURATIONS.map((d) => (
        <button
          key={`t${d}`}
          className={testType === "time" && duration === d ? "active" : ""}
          onClick={() => onDurationChange(d)}
          tabIndex={-1}
        >
          {d}s
        </button>
      ))}
      <span className="divider" />
      <span className="settings-group-label">words</span>
      {WORD_COUNTS.map((c) => (
        <button
          key={`w${c}`}
          className={testType === "wordcount" && wordCountTarget === c ? "active" : ""}
          onClick={() => onWordCountChange(c)}
          tabIndex={-1}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
