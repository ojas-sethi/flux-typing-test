import { useState, useEffect, useRef, useCallback } from "react";
import { generateWordList } from "../data/words";
import {
  createRace,
  joinRace,
  startCountdown,
  setRaceActive,
  setRaceFinished,
  updateRaceProgress,
  submitRaceResults,
  leaveRace,
  onRaceChange,
  onProgressChange,
} from "../services/raceService";
import { useRaceTypingTest } from "../hooks/useRaceTypingTest";
import TypingArea from "./TypingArea";
import "./Race.css";

const COUNTDOWN_SECONDS = 3;

export default function Race({ visible, user, profile, onClose }) {
  // ── Phase: "menu" | "lobby" | "join" | "countdown" | "racing" | "results"
  const [phase, setPhase] = useState("menu");
  const [raceId, setRaceId] = useState(null);
  const [raceData, setRaceData] = useState(null);
  const [progress, setProgress] = useState({});
  const [error, setError] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [copied, setCopied] = useState(false);

  // Race settings (for host)
  const [raceMode, setRaceMode] = useState("words");
  const [raceDuration, setRaceDuration] = useState(30);

  const unsubRaceRef = useRef(null);
  const unsubProgressRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const progressThrottleRef = useRef(0);
  const didSubmitResults = useRef(false);

  const typing = useRaceTypingTest(
    raceData?.words || [],
    raceData?.duration || 30
  );

  // ── Subscribe to race changes ──
  const subscribeToRace = useCallback((id) => {
    unsubRaceRef.current?.();
    unsubProgressRef.current?.();

    unsubRaceRef.current = onRaceChange(id, (data) => {
      setRaceData(data);
    });
    unsubProgressRef.current = onProgressChange(id, (prog) => {
      setProgress(prog);
    });
  }, []);

  // ── Cleanup on unmount or close ──
  useEffect(() => {
    if (!visible) {
      unsubRaceRef.current?.();
      unsubProgressRef.current?.();
      clearInterval(countdownTimerRef.current);
      setPhase("menu");
      setRaceId(null);
      setRaceData(null);
      setProgress({});
      setError(null);
      setJoinCode("");
      setCountdown(COUNTDOWN_SECONDS);
      setCopied(false);
      didSubmitResults.current = false;
      typing.reset();
    }
    return () => {
      unsubRaceRef.current?.();
      unsubProgressRef.current?.();
      clearInterval(countdownTimerRef.current);
    };
  }, [visible]);

  // ── React to race status changes ──
  useEffect(() => {
    if (!raceData) return;

    if (raceData.status === "countdown" && phase === "lobby") {
      setPhase("countdown");
      setCountdown(COUNTDOWN_SECONDS);
      typing.reset();

      let count = COUNTDOWN_SECONDS;
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = setInterval(() => {
        count--;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(countdownTimerRef.current);
          setPhase("racing");
          typing.enableTyping();
          // Host sets race to active
          if (raceData.hostUid === user?.uid) {
            setRaceActive(raceData.id);
          }
        }
      }, 1000);
    }

    if (raceData.status === "finished" && phase === "racing") {
      setPhase("results");
    }
  }, [raceData?.status]);

  // ── Report progress while racing ──
  useEffect(() => {
    if (phase !== "racing" || !raceId || !user || !typing.isRunning) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now - progressThrottleRef.current < 400) return;
      progressThrottleRef.current = now;

      updateRaceProgress(raceId, user.uid, {
        currentWordIndex: typing.currentWordIndex,
        wpm: typing.liveWpm,
        accuracy: typing.liveAccuracy,
        isFinished: false,
      });
    }, 400);

    return () => clearInterval(interval);
  }, [phase, raceId, user, typing.isRunning, typing.currentWordIndex, typing.liveWpm, typing.liveAccuracy]);

  // ── Submit final results when typing finishes ──
  useEffect(() => {
    if (typing.isFinished && raceId && user && !didSubmitResults.current) {
      didSubmitResults.current = true;
      const results = typing.getResults();
      submitRaceResults(raceId, user.uid, results).then(() => {
        // Check if all players are done
        const participants = raceData?.participants || {};
        const pCount = Object.keys(participants).length;
        const finishedCount = Object.values(progress).filter((p) => p.isFinished).length + 1; // +1 for self
        if (finishedCount >= pCount && raceData?.hostUid === user.uid) {
          setRaceFinished(raceId);
        }
      });
    }
  }, [typing.isFinished]);

  // ── Check if all done (non-host) ──
  useEffect(() => {
    if (phase !== "racing" || !raceData) return;
    const participants = raceData.participants || {};
    const pCount = Object.keys(participants).length;
    const finishedCount = Object.values(progress).filter((p) => p.isFinished).length;
    if (finishedCount >= pCount) {
      if (raceData.hostUid === user?.uid) {
        setRaceFinished(raceId);
      }
      setPhase("results");
    }
  }, [progress, phase, raceData]);

  // ── Actions ──
  const handleCreate = async () => {
    setError(null);
    try {
      const words = generateWordList(raceMode, 200);
      const { raceId: id, code } = await createRace(
        user.uid,
        profile,
        raceMode,
        raceDuration,
        words
      );
      setRaceId(id);
      subscribeToRace(id);
      setPhase("lobby");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleJoin = async () => {
    setError(null);
    if (joinCode.length < 6) {
      setError("Enter a 6-character code");
      return;
    }
    try {
      const id = await joinRace(joinCode.toUpperCase(), user.uid, profile);
      setRaceId(id);
      subscribeToRace(id);
      setPhase("lobby");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStart = async () => {
    setError(null);
    try {
      await startCountdown(raceId, user.uid);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLeave = async () => {
    if (raceId && user && phase === "lobby") {
      await leaveRace(raceId, user.uid);
    }
    unsubRaceRef.current?.();
    unsubProgressRef.current?.();
    setPhase("menu");
    setRaceId(null);
    setRaceData(null);
    setError(null);
  };

  const handleCopyCode = () => {
    if (raceData?.code) {
      navigator.clipboard.writeText(raceData.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!visible || !user) return null;

  const participants = raceData?.participants || {};
  const participantList = Object.entries(participants).map(([uid, data]) => ({
    uid,
    ...data,
  }));
  const isHost = raceData?.hostUid === user.uid;

  // ── Render ──
  return (
    <div className="race-overlay visible">
      <div className="race-container">
        {/* ── Menu ── */}
        {phase === "menu" && (
          <>
            <div className="race-header">
              <button className="race-back" onClick={onClose}>
                back
              </button>
            </div>
            <div className="race-menu">
              <h2 className="race-title">typing race</h2>
              <p className="race-subtitle">
                Compete with friends in real-time
              </p>

              <div className="race-menu-section">
                <h3 className="race-section-label">create a race</h3>
                <div className="race-settings-row">
                  <div className="race-setting">
                    <span className="race-setting-label">mode</span>
                    <div className="race-setting-options">
                      {["words", "sentences"].map((m) => (
                        <button
                          key={m}
                          className={`race-setting-btn ${raceMode === m ? "active" : ""}`}
                          onClick={() => setRaceMode(m)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="race-setting">
                    <span className="race-setting-label">duration</span>
                    <div className="race-setting-options">
                      {[15, 30, 60].map((d) => (
                        <button
                          key={d}
                          className={`race-setting-btn ${raceDuration === d ? "active" : ""}`}
                          onClick={() => setRaceDuration(d)}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button className="race-primary-btn" onClick={handleCreate}>
                  create race
                </button>
              </div>

              <div className="race-divider">
                <span>or</span>
              </div>

              <div className="race-menu-section">
                <h3 className="race-section-label">join a race</h3>
                <div className="race-join-row">
                  <input
                    className="race-code-input"
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)
                      )
                    }
                    placeholder="ENTER CODE"
                    maxLength={6}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    className="race-primary-btn"
                    onClick={handleJoin}
                    disabled={joinCode.length < 6}
                  >
                    join
                  </button>
                </div>
              </div>

              {error && <div className="race-error">{error}</div>}
            </div>
          </>
        )}

        {/* ── Lobby ── */}
        {phase === "lobby" && raceData && (
          <>
            <div className="race-header">
              <button className="race-back" onClick={handleLeave}>
                leave
              </button>
              <div className="race-code-display" onClick={handleCopyCode}>
                <span className="race-code-label">room code</span>
                <span className="race-code-value">{raceData.code}</span>
                <span className="race-code-copy">
                  {copied ? "copied!" : "click to copy"}
                </span>
              </div>
            </div>

            <div className="race-lobby">
              <h2 className="race-title">waiting for players</h2>
              <p className="race-subtitle">
                {raceData.mode} / {raceData.duration}s
              </p>

              <div className="race-participants">
                {participantList.map((p) => (
                  <div key={p.uid} className="race-participant">
                    {p.photoURL && (
                      <img
                        src={p.photoURL}
                        alt=""
                        className="race-participant-avatar"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="race-participant-info">
                      <span className="race-participant-name">
                        {p.displayName || p.username}
                      </span>
                      {p.username && (
                        <span className="race-participant-handle">
                          @{p.username}
                        </span>
                      )}
                    </div>
                    {p.uid === raceData.hostUid && (
                      <span className="race-host-badge">host</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="race-lobby-footer">
                <span className="race-player-count">
                  {participantList.length}/10 players
                </span>
                {isHost ? (
                  <button
                    className="race-primary-btn"
                    onClick={handleStart}
                    disabled={participantList.length < 2}
                  >
                    start race
                  </button>
                ) : (
                  <span className="race-waiting-text">
                    waiting for host to start...
                  </span>
                )}
              </div>
              {error && <div className="race-error">{error}</div>}
            </div>
          </>
        )}

        {/* ── Countdown ── */}
        {phase === "countdown" && (
          <div className="race-countdown-overlay">
            <div className="race-countdown-number">{countdown}</div>
            <div className="race-countdown-label">get ready</div>
          </div>
        )}

        {/* ── Racing ── */}
        {phase === "racing" && raceData && (
          <div className="race-active">
            <div className="race-timer">{typing.timeLeft}</div>

            {/* Progress tracks */}
            <div className="race-tracks">
              {participantList.map((p) => {
                const prog = p.uid === user.uid
                  ? {
                      currentWordIndex: typing.currentWordIndex,
                      wpm: typing.liveWpm,
                      isFinished: typing.isFinished,
                    }
                  : progress[p.uid] || { currentWordIndex: 0, wpm: 0 };

                const maxWords = Math.max(
                  ...participantList.map((pp) => {
                    if (pp.uid === user.uid) return typing.currentWordIndex;
                    return progress[pp.uid]?.currentWordIndex || 0;
                  }),
                  1
                );
                const pct = Math.min(100, (prog.currentWordIndex / Math.max(maxWords, 1)) * 100);

                return (
                  <div
                    key={p.uid}
                    className={`race-track ${p.uid === user.uid ? "is-self" : ""} ${prog.isFinished ? "finished" : ""}`}
                  >
                    <div className="race-track-info">
                      {p.photoURL && (
                        <img
                          src={p.photoURL}
                          alt=""
                          className="race-track-avatar"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <span className="race-track-name">
                        {p.uid === user.uid ? "you" : p.username || p.displayName}
                      </span>
                    </div>
                    <div className="race-track-bar">
                      <div
                        className="race-track-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="race-track-wpm">
                      {prog.wpm}<small> wpm</small>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Typing area */}
            <div className="race-typing-card">
              <TypingArea
                words={typing.words}
                typedWords={typing.typedWords}
                currentInput={typing.currentInput}
                currentWordIndex={typing.currentWordIndex}
                isRunning={typing.isRunning}
                isFinished={typing.isFinished}
                disabled={false}
                onInput={typing.handleInput}
                onGoToPrevWord={typing.goToPrevWord}
                onClearCurrentWord={typing.clearCurrentWord}
              />
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {phase === "results" && raceData && (
          <>
            <div className="race-header">
              <button className="race-back" onClick={onClose}>
                done
              </button>
            </div>
            <div className="race-results">
              <h2 className="race-title">race results</h2>
              <p className="race-subtitle">
                {raceData.mode} / {raceData.duration}s
              </p>

              <div className="race-standings">
                {participantList
                  .map((p) => {
                    const prog = progress[p.uid];
                    const results = prog?.finalResults;
                    return {
                      ...p,
                      wpm: results?.wpm || prog?.wpm || 0,
                      accuracy: results?.accuracy || prog?.accuracy || 0,
                      consistency: results?.consistency || 0,
                      wordsTyped: results?.wordsTyped || prog?.currentWordIndex || 0,
                      isFinished: prog?.isFinished || false,
                    };
                  })
                  .sort((a, b) => b.wpm - a.wpm)
                  .map((p, i) => (
                    <div
                      key={p.uid}
                      className={`race-standing ${p.uid === user.uid ? "is-self" : ""} ${i === 0 ? "is-winner" : ""}`}
                    >
                      <span className="race-rank">
                        {i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`}
                      </span>
                      <div className="race-standing-user">
                        {p.photoURL && (
                          <img
                            src={p.photoURL}
                            alt=""
                            className="race-standing-avatar"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="race-standing-info">
                          <span className="race-standing-name">
                            {p.uid === user.uid ? "you" : p.displayName || p.username}
                          </span>
                          {p.username && (
                            <span className="race-standing-handle">
                              @{p.username}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="race-standing-stats">
                        <span className="race-standing-wpm">
                          {p.wpm}<small> wpm</small>
                        </span>
                        <span className="race-standing-acc">
                          {p.accuracy}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              {isHost && (
                <button
                  className="race-primary-btn"
                  onClick={() => {
                    setPhase("menu");
                    setRaceId(null);
                    setRaceData(null);
                    setProgress({});
                    setError(null);
                    didSubmitResults.current = false;
                    typing.reset();
                  }}
                >
                  race again
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
