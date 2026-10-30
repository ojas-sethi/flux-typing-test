import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTypingTest } from "./hooks/useTypingTest";
import { useTheme } from "./hooks/useTheme";
import { useAuth } from "./hooks/useAuth";
import { saveTestResult } from "./services/firestore";
import { SCORING_VERSION } from "./utils/scoring";
import Settings from "./components/Settings";
import TypingArea from "./components/TypingArea";
import Results from "./components/Results";
import Profile from "./components/Profile";
import UsernameSetup from "./components/UsernameSetup";
import Social from "./components/Social";
import Race from "./components/Race";
import Ruler from "./components/Ruler";
import "./App.css";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { user, profile, loading: authLoading, needsUsername, signIn, signOut, refreshProfile } = useAuth();
  const {
    mode,
    testType,
    duration,
    wordCountTarget,
    punctuation,
    numbers,
    liveWpm,
    wpmHistory,
    wordSpeeds,
    togglePunctuation,
    toggleNumbers,
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
    changeWordCount,
    getResults,
  } = useTypingTest();

  const [results, setResults] = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [socialVisible, setSocialVisible] = useState(false);
  const [raceVisible, setRaceVisible] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [personalBest, setPersonalBest] = useState(null); // { prev, isNew }
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("klacks-sound") === "on"
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      localStorage.setItem("klacks-sound", prev ? "off" : "on");
      return !prev;
    });
  }, []);

  // When test finishes, compute results once and save if logged in
  const didComputeResults = useRef(false);
  useEffect(() => {
    if (isFinished && !didComputeResults.current) {
      didComputeResults.current = true;
      const r = getResults();
      setResults(r);

      // Personal best tracking (per exact test configuration, stored locally)
      const mods = mode === "words" ? `${punctuation ? "-p" : ""}${numbers ? "-n" : ""}` : "";
      const pbKey = `klacks-pb-${mode}-${testType}-${testType === "time" ? duration : wordCountTarget}${mods}`;
      const prevBest = parseInt(localStorage.getItem(pbKey), 10) || 0;
      const isNew = prevBest > 0 && r.wpm > prevBest;
      if (r.wpm > prevBest) {
        localStorage.setItem(pbKey, String(r.wpm));
      }
      setPersonalBest({ prev: prevBest, isNew });

      // Auto-save if logged in
      if (user) {
        setSaveStatus("saving");
        const saveData = {
          wpm: r.wpm,
          rawWpm: r.rawWpm,
          accuracy: r.accuracy,
          consistency: r.consistency,
          totalChars: r.totalChars,
          correctChars: r.correctChars,
          incorrectChars: r.incorrectChars,
          extraChars: r.extraChars,
          missedChars: r.missedChars,
          mode,
          testType,
          punctuation: mode === "words" && punctuation,
          numbers: mode === "words" && numbers,
          duration: testType === "time" ? duration : r.timeTaken,
          wpmHistory: r.wpmHistory,
          scoringVersion: SCORING_VERSION,
        };
        if (testType === "wordcount") {
          saveData.wordCount = wordCountTarget;
        }
        saveTestResult(user.uid, saveData)
          .then(() => setSaveStatus("saved"))
          .catch(() => setSaveStatus("error"));
      }
    }
    if (!isFinished) {
      didComputeResults.current = false;
      setSaveStatus(null);
      setPersonalBest(null);
    }
  }, [isFinished, getResults, user, mode, testType, duration, wordCountTarget, punctuation, numbers]);

  // Restart handler
  const handleRestart = useCallback(() => {
    setResults(null);
    setSaveStatus(null);
    setPersonalBest(null);
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
        tabTimeout = setTimeout(() => {
          tabPressed = false;
        }, 1000);
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

  // Ruler: units are seconds (time) or words (word count)
  const rulerTotal = testType === "time" ? duration : wordCountTarget;
  const rulerValue =
    testType === "time" ? duration - timeLeft : Math.min(currentWordIndex, wordCountTarget);
  const rulerSpeeds = useMemo(() => {
    if (testType !== "time") return wordSpeeds;
    const arr = [];
    for (const h of wpmHistory) arr[h.second - 1] = h.burst ?? h.wpm;
    return arr;
  }, [testType, wpmHistory, wordSpeeds]);

  const handleSignOut = useCallback(() => {
    signOut();
    setProfileVisible(false);
  }, [signOut]);

  return (
    <>
      <div className="app">
        <header className={`app-header ${isRunning ? "faded" : ""}`}>
          <div className="logo" aria-label="klacks">
            klacks<span className="logo-caret" aria-hidden="true" />
          </div>
          <nav className="header-actions">
            {!authLoading && user && (
              <>
                <button className="nav-link" onClick={() => setRaceVisible(true)} tabIndex={-1}>
                  race
                </button>
                <button className="nav-link" onClick={() => setSocialVisible(true)} tabIndex={-1}>
                  friends
                </button>
              </>
            )}
            {!authLoading && user && <span className="nav-rule" aria-hidden="true" />}
            <button
              className={`icon-btn ${soundEnabled ? "on" : ""}`}
              onClick={toggleSound}
              tabIndex={-1}
              aria-label={soundEnabled ? "Turn typing sounds off" : "Turn typing sounds on"}
              aria-pressed={soundEnabled}
              title={soundEnabled ? "sound on" : "sound off"}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2.5 6v4h2.5l3.5 3V3L5 6H2.5z" fill="currentColor" />
                {soundEnabled ? (
                  <path d="M11 5.5c.9.7 1.4 1.5 1.4 2.5s-.5 1.8-1.4 2.5M12.8 3.6c1.4 1.1 2.2 2.6 2.2 4.4s-.8 3.3-2.2 4.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                ) : (
                  <path d="M11 6l3.5 4M14.5 6L11 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                )}
              </svg>
            </button>
            <button
              className="icon-btn"
              onClick={toggleTheme}
              tabIndex={-1}
              aria-label="Toggle theme"
              title={theme === "dark" ? "light mode" : "dark mode"}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
              </svg>
            </button>
            {!authLoading &&
              (user ? (
                <button
                  className="auth-avatar"
                  onClick={() => setProfileVisible(true)}
                  tabIndex={-1}
                  aria-label="Profile"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="avatar-fallback">
                      {(user.displayName || user.email || "?")[0].toUpperCase()}
                    </span>
                  )}
                </button>
              ) : (
                <button className="sign-in" onClick={signIn} tabIndex={-1}>
                  sign in
                </button>
              ))}
          </nav>
        </header>

        <main className="main-content">
          <div className="deck">
            <div className="deck-top">
              {isRunning ? (
                <div className="readout">
                  <div className="readout-cell">
                    <span className="num readout-value accent">
                      {testType === "time"
                        ? timeLeft
                        : `${Math.min(currentWordIndex, wordCountTarget)}`}
                    </span>
                    <span className="label">
                      {testType === "time" ? "seconds left" : `of ${wordCountTarget} words`}
                    </span>
                  </div>
                  <div className={`readout-cell right ${liveWpm > 0 ? "" : "pending"}`}>
                    <span className="num readout-value">{liveWpm || "—"}</span>
                    <span className="label">wpm</span>
                  </div>
                </div>
              ) : (
                <Settings
                  mode={mode}
                  testType={testType}
                  duration={duration}
                  wordCountTarget={wordCountTarget}
                  punctuation={punctuation}
                  numbers={numbers}
                  onModeChange={changeMode}
                  onDurationChange={changeDuration}
                  onWordCountChange={changeWordCount}
                  onTogglePunctuation={togglePunctuation}
                  onToggleNumbers={toggleNumbers}
                />
              )}
            </div>

            <Ruler
              total={rulerTotal}
              value={rulerValue}
              speeds={rulerSpeeds}
              running={isRunning}
            />

            <div className="typing-stage">
              <TypingArea
                words={words}
                typedWords={typedWords}
                currentInput={currentInput}
                currentWordIndex={currentWordIndex}
                isRunning={isRunning}
                isFinished={isFinished}
                disabled={needsUsername || profileVisible || socialVisible || raceVisible}
                soundEnabled={soundEnabled}
                onInput={handleInput}
                onGoToPrevWord={goToPrevWord}
                onClearCurrentWord={clearCurrentWord}
              />
            </div>
          </div>
        </main>

        <footer className={`app-footer ${isRunning ? "running" : ""}`}>
          <span className="hint">
            <kbd>tab</kbd>
            <kbd>enter</kbd>
            <span>restart</span>
          </span>
          <span className="hint idle-only">
            <kbd>esc</kbd>
            <span>reset</span>
          </span>
          <span className="hint idle-only">
            <kbd>ctrl</kbd>
            <kbd>⌫</kbd>
            <span>clear word</span>
          </span>
        </footer>
      </div>

      <Results
        visible={isFinished}
        results={results}
        onRestart={handleRestart}
        saveStatus={saveStatus}
        isLoggedIn={!!user}
        personalBest={personalBest}
        testConfig={{ mode, testType, duration, wordCountTarget, punctuation, numbers }}
      />

      <Profile
        visible={profileVisible}
        user={user}
        onClose={() => setProfileVisible(false)}
        onSignOut={handleSignOut}
        onOpenSocial={() => {
          setProfileVisible(false);
          setSocialVisible(true);
        }}
      />

      <UsernameSetup
        visible={needsUsername}
        user={user}
        onComplete={refreshProfile}
      />

      <Social
        visible={socialVisible}
        user={user}
        onClose={() => setSocialVisible(false)}
      />

      <Race
        visible={raceVisible}
        user={user}
        profile={profile}
        onClose={() => setRaceVisible(false)}
      />
    </>
  );
}
