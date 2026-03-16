import { useEffect, useState, useCallback, useRef } from "react";
import { useTypingTest } from "./hooks/useTypingTest";
import { useTheme } from "./hooks/useTheme";
import Settings from "./components/Settings";
import TypingArea from "./components/TypingArea";
import Results from "./components/Results";
import "./App.css";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    mode,
    duration,
    words,
    typedWords,
    currentInput,
    currentWordIndex,
    isRunning,
    isFinished,
    timeLeft,
    handleInput,
    goToPrevWord,
    clearCurrentWord,
    reset,
    changeMode,
    changeDuration,
    getResults,
  } = useTypingTest();

  const [results, setResults] = useState(null);

  // When test finishes, compute results once
  const didComputeResults = useRef(false);
  useEffect(() => {
    if (isFinished && !didComputeResults.current) {
      didComputeResults.current = true;
      setResults(getResults());
    }
    if (!isFinished) {
      didComputeResults.current = false;
    }
  }, [isFinished, getResults]);

  // Restart handler
  const handleRestart = useCallback(() => {
    setResults(null);
    reset();
  }, [reset]);

  // Keep a ref to handleRestart so keydown handler is always fresh
  const handleRestartRef = useRef(handleRestart);
  handleRestartRef.current = handleRestart;

  // Tab + Enter / Escape to restart
  useEffect(() => {
    let tabPressed = false;
    let tabTimeout;

    const handleKeyDown = (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        tabPressed = true;
        clearTimeout(tabTimeout);
        tabTimeout = setTimeout(() => { tabPressed = false; }, 1000);
        return;
      }

      if (e.key === "Enter" && tabPressed) {
        e.preventDefault();
        tabPressed = false;
        handleRestartRef.current();
        return;
      }

      if (e.key === "Escape") {
        handleRestartRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(tabTimeout);
    };
  }, []);

  const progress = isRunning ? (timeLeft / duration) * 100 : 100;

  return (
    <>
      {/* Progress bar timer */}
      <div className={`progress-bar ${isRunning ? "active" : ""}`}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="app">
        <header className={isRunning ? "faded" : ""}>
          <div className="logo">flux</div>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            tabIndex={-1}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "light" : "dark"}
          </button>
        </header>

        <main className="main-content">
          <div className={`timer-display ${isRunning ? "visible" : ""}`}>
            {timeLeft}
          </div>

          <div className="typing-card">
            <TypingArea
              words={words}
              typedWords={typedWords}
              currentInput={currentInput}
              currentWordIndex={currentWordIndex}
              isRunning={isRunning}
              isFinished={isFinished}
              onInput={handleInput}
              onGoToPrevWord={goToPrevWord}
              onClearCurrentWord={clearCurrentWord}
            />
          </div>

          <div className={`restart-hint ${isRunning ? "visible" : ""}`}>
            <kbd>tab</kbd> + <kbd>enter</kbd> to restart
          </div>
        </main>
      </div>

      {/* Floating dock settings */}
      <Settings
        mode={mode}
        duration={duration}
        onModeChange={changeMode}
        onDurationChange={changeDuration}
        faded={isRunning}
      />

      <Results visible={isFinished} results={results} onRestart={handleRestart} />
    </>
  );
}
