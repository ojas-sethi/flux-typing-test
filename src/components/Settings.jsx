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
  punctuation,
  numbers,
  soundEnabled,
  onModeChange,
  onDurationChange,
  onWordCountChange,
  onTogglePunctuation,
  onToggleNumbers,
  onToggleSound,
  faded,
}) {
  const modifiersDimmed = mode !== "words";

  return (
    <div className={`settings ${faded ? "faded" : ""}`}>
      <div className="settings-group">
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
      </div>

      <span className="sep" aria-hidden="true">·</span>

      <div className="settings-group">
        <button
          className={`${punctuation ? "active" : ""} ${modifiersDimmed ? "dimmed" : ""}`}
          onClick={onTogglePunctuation}
          tabIndex={-1}
          title="add punctuation (words mode)"
        >
          !?
        </button>
        <button
          className={`${numbers ? "active" : ""} ${modifiersDimmed ? "dimmed" : ""}`}
          onClick={onToggleNumbers}
          tabIndex={-1}
          title="add numbers (words mode)"
        >
          123
        </button>
      </div>

      <span className="sep" aria-hidden="true">·</span>

      <div className="settings-group">
        <span className="settings-group-label">time</span>
        {DURATIONS.map((d) => (
          <button
            key={`t${d}`}
            className={testType === "time" && duration === d ? "active" : ""}
            onClick={() => onDurationChange(d)}
            tabIndex={-1}
          >
            {d}
          </button>
        ))}
      </div>

      <span className="sep" aria-hidden="true">·</span>

      <div className="settings-group">
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

      <span className="sep" aria-hidden="true">·</span>

      <div className="settings-group">
        <button
          className={soundEnabled ? "active" : ""}
          onClick={onToggleSound}
          tabIndex={-1}
          title="typing sounds"
        >
          sound
        </button>
      </div>
    </div>
  );
}
