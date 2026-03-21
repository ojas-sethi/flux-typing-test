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
  const [profileVisible, setProfileVisible] = useState(false);
  const [socialVisible, setSocialVisible] = useState(false);
  const [raceVisible, setRaceVisible] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'

  // When test finishes, compute results once and save if logged in
  const didComputeResults = useRef(false);
  useEffect(() => {
    if (isFinished && !didComputeResults.current) {
      didComputeResults.current = true;
      const r = getResults();
      setResults(r);

      // Auto-save if logged in
      if (user) {
        setSaveStatus("saving");
        saveTestResult(user.uid, {
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
          duration,
          wpmHistory: r.wpmHistory,
        })
          .then(() => setSaveStatus("saved"))
          .catch(() => setSaveStatus("error"));
      }
    }
    if (!isFinished) {
      didComputeResults.current = false;
      setSaveStatus(null);
    }
  }, [isFinished, getResults, user, mode, duration]);

  // Restart handler
  const handleRestart = useCallback(() => {
    setResults(null);
    setSaveStatus(null);
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

  const progress = isRunning ? (timeLeft / duration) * 100 : 100;

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
          <div className="logo">klacks</div>
          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              tabIndex={-1}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "light" : "dark"}
            </button>

            {!authLoading &&
              (user ? (
                <>
                  <button
                    className="social-nav-btn"
                    onClick={() => setRaceVisible(true)}
                    tabIndex={-1}
                  >
                    race
                  </button>
                  <button
                    className="social-nav-btn"
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
                <button
                  className="sign-in-btn"
                  onClick={signIn}
                  tabIndex={-1}
                >
                  sign in
                </button>
              ))}
          </div>
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
              disabled={needsUsername || profileVisible || socialVisible || raceVisible}
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

      <Results
        visible={isFinished}
        results={results}
        onRestart={handleRestart}
        saveStatus={saveStatus}
        isLoggedIn={!!user}
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
