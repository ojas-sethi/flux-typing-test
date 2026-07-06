import { useEffect, useState, useCallback, useRef } from "react";
import { useTypingTest } from "./hooks/useTypingTest";
import { useTheme } from "./hooks/useTheme";
import { useAuth } from "./hooks/useAuth";
import { saveTestResult } from "./services/firestore";
import Settings from "./components/Settings";
import TypingArea from "./components/TypingArea";
import Results from "./components/Results";
import Profile from "./components/Profile";
import UsernameSetup from "./components/UsernameSetup";
import Social from "./components/Social";
import Race from "./components/Race";
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
    togglePunctuation,
    toggleNumbers,
    words,
    typedWords,
    currentInput,
    currentWordIndex,
    isRunning,
    isFinished,
    timeLeft,
    elapsedTime,
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

      // Personal best tracking (per test configuration, stored locally)
      const pbKey = `klacks-pb-${mode}-${testType}-${testType === "time" ? duration : wordCountTarget}`;
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
          duration: testType === "time" ? duration : r.timeTaken,
          wpmHistory: r.wpmHistory,
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
  }, [isFinished, getResults, user, mode, testType, duration, wordCountTarget]);

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

  const progress = isRunning
    ? testType === "time"
      ? (timeLeft / duration) * 100
      : (currentWordIndex / wordCountTarget) * 100
    : testType === "time"
      ? 100
      : 0;

  const handleSignOut = useCallback(() => {
    signOut();
    setProfileVisible(false);
  }, [signOut]);

  return (
    <>
      {/* Progress bar timer */}
      <div className={`progress-bar ${isRunning ? "active" : ""}`}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="app">
        <header className={isRunning ? "faded" : ""}>
          <div className="logo">
            klacks<span className="logo-mark">*</span>
          </div>
          <nav className="header-actions">
            {!authLoading &&
              (user ? (
                <>
                  <button
                    className="nav-link"
                    onClick={() => setRaceVisible(true)}
                    tabIndex={-1}
                  >
                    race
                  </button>
                  <button
                    className="nav-link"
                    onClick={() => setSocialVisible(true)}
                    tabIndex={-1}
                  >
                    friends
                  </button>
                  <button
                    className="auth-avatar"
                    onClick={() => setProfileVisible(true)}
                    tabIndex={-1}
                    aria-label="Profile"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt=""
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="avatar-fallback">
                        {(user.displayName || user.email || "?")[0].toUpperCase()}
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <button className="nav-link" onClick={signIn} tabIndex={-1}>
                  sign in
                </button>
              ))}
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              tabIndex={-1}
              aria-label="Toggle theme"
              title={theme === "dark" ? "light mode" : "dark mode"}
            >
              ◐
            </button>
          </nav>
        </header>

        <main className="main-content">
          <div className={`type-meta ${isRunning ? "running" : ""}`}>
            <span className="type-meta-left">
              {isRunning
                ? testType === "time"
                  ? timeLeft
                  : `${Math.min(currentWordIndex, wordCountTarget)} / ${wordCountTarget}`
                : `${mode} — ${testType === "time" ? `${duration}s` : `${wordCountTarget} words`}`}
            </span>
            <span className={`type-meta-right ${isRunning && liveWpm > 0 ? "visible" : ""}`}>
              {liveWpm} wpm
            </span>
          </div>

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

          <Settings
            mode={mode}
            testType={testType}
            duration={duration}
            wordCountTarget={wordCountTarget}
            punctuation={punctuation}
            numbers={numbers}
            soundEnabled={soundEnabled}
            onModeChange={changeMode}
            onDurationChange={changeDuration}
            onWordCountChange={changeWordCount}
            onTogglePunctuation={togglePunctuation}
            onToggleNumbers={toggleNumbers}
            onToggleSound={toggleSound}
            faded={isRunning}
          />
        </main>

        <footer className={`app-footer ${isRunning ? "visible" : ""}`}>
          <kbd>tab</kbd> + <kbd>enter</kbd> to restart
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
