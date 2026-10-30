import { useState, useRef, useEffect } from "react";
import "./Settings.css";

const MODES = [
  { key: "words", label: "words", hint: "common english words" },
  { key: "sentences", label: "sentences", hint: "real passages, with punctuation" },
];

const DURATIONS = [15, 30, 60, 120];
const WORD_COUNTS = [10, 25, 50, 100];

function Token({ label, title, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="token-wrap" ref={ref}>
      <button
        className={`token ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        tabIndex={-1}
        aria-expanded={open}
        aria-haspopup="menu"
        title={title}
      >
        {label}
        <span className="token-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="token-pop" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export default function Settings({
  mode,
  testType,
  duration,
  wordCountTarget,
  punctuation,
  numbers,
  onModeChange,
  onDurationChange,
  onWordCountChange,
  onTogglePunctuation,
  onToggleNumbers,
}) {
  const modifiersDisabled = mode !== "words";
  const lengthLabel =
    testType === "time" ? `${duration} seconds` : `${wordCountTarget} words`;

  return (
    <div className="settings">
      <div className="spec">
        <Token label={mode} title="text">
          {(close) =>
            MODES.map((m) => (
              <button
                key={m.key}
                role="menuitemradio"
                aria-checked={mode === m.key}
                className={`pop-row ${mode === m.key ? "active" : ""}`}
                onClick={() => {
                  onModeChange(m.key);
                  close();
                }}
                tabIndex={-1}
              >
                <span className="pop-row-name">{m.label}</span>
                <span className="pop-row-hint">{m.hint}</span>
              </button>
            ))
          }
        </Token>

        <span className="spec-sep" aria-hidden="true">/</span>

        <Token label={lengthLabel} title="length">
          {(close) => (
            <div className="pop-grid">
              <span className="label pop-grid-label">seconds</span>
              <div className="pop-cells">
                {DURATIONS.map((d) => (
                  <button
                    key={`t${d}`}
                    role="menuitemradio"
                    aria-checked={testType === "time" && duration === d}
                    className={`pop-cell ${testType === "time" && duration === d ? "active" : ""}`}
                    onClick={() => {
                      onDurationChange(d);
                      close();
                    }}
                    tabIndex={-1}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <span className="label pop-grid-label">words</span>
              <div className="pop-cells">
                {WORD_COUNTS.map((c) => (
                  <button
                    key={`w${c}`}
                    role="menuitemradio"
                    aria-checked={testType === "wordcount" && wordCountTarget === c}
                    className={`pop-cell ${testType === "wordcount" && wordCountTarget === c ? "active" : ""}`}
                    onClick={() => {
                      onWordCountChange(c);
                      close();
                    }}
                    tabIndex={-1}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Token>
      </div>

      <div className={`mods ${modifiersDisabled ? "disabled" : ""}`}>
        <button
          className="mod"
          onClick={onTogglePunctuation}
          tabIndex={-1}
          aria-pressed={punctuation}
          title={modifiersDisabled ? "only applies to words mode" : "capitals and punctuation"}
        >
          <span className={`led ${punctuation && !modifiersDisabled ? "on" : ""}`} />
          punctuation
        </button>
        <button
          className="mod"
          onClick={onToggleNumbers}
          tabIndex={-1}
          aria-pressed={numbers}
          title={modifiersDisabled ? "only applies to words mode" : "mix in numbers"}
        >
          <span className={`led ${numbers && !modifiersDisabled ? "on" : ""}`} />
          numbers
        </button>
      </div>
    </div>
  );
}
