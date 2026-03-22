import { useState, useEffect, useRef, useCallback } from "react";
import { generateWordList } from "../data/words";
import {
  createRace,
  joinRace,
  startCountdown,
  setRaceActive,
  setRaceFinished,
  resetRace,
  updateRaceProgress,
  submitRaceResults,
  leaveRace,
  onRaceChange,
  onProgressChange,
} from "../services/raceService";
import { saveRaceResult } from "../services/firestore";
import { useRaceTypingTest } from "../hooks/useRaceTypingTest";
import TypingArea from "./TypingArea";
import "./Race.css";

const COUNTDOWN_SECONDS = 3;

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, "0")}`;
  return `${s}`;
}

function getRankLabel(i) {
  if (i === 0) return "1st";
  if (i === 1) return "2nd";
  if (i === 2) return "3rd";
  return `${i + 1}th`;
}

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
  const [raceTestType, setRaceTestType] = useState("time");
  const [raceWordCount, setRaceWordCount] = useState(25);

  // Session history
  const [sessionHistory, setSessionHistory] = useState([]);
  const didPushSessionRef = useRef(false);

  const unsubRaceRef = useRef(null);
  const unsubProgressRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const progressThrottleRef = useRef(0);
  const didSubmitResults = useRef(false);

  // Refs to avoid stale closures in intervals
  const raceDataRef = useRef(null);
  const phaseRef = useRef(phase);
  raceDataRef.current = raceData;
  phaseRef.current = phase;

  const typing = useRaceTypingTest(
    raceData?.words || [],
    raceData?.duration || 30,
    raceData?.testType || "time",
    raceData?.wordCount || 25
  );

  // ── Subscribe to race changes ──
  const subscribeToRace = useCallback((id) => {
    unsubRaceRef.current?.();
    unsubProgressRef.current?.();

    unsubRaceRef.current = onRaceChange(
      id,
      (data) => {
        setRaceData(data);
      },
      (err) => {
        setError("Connection lost: " + err.message);
        setPhase("menu");
      }
    );
    unsubProgressRef.current = onProgressChange(
      id,
      (prog) => {
        setProgress(prog);
      },
      (err) => {
        console.error("Progress listener error:", err);
      }
    );
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
      didPushSessionRef.current = false;
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
    const status = raceData.status;

    // Countdown started — begin local countdown
    if (status === "countdown" && phase === "lobby") {
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
          didPushSessionRef.current = false;
          // Host sets race to active (use ref to avoid stale closure)
          const rd = raceDataRef.current;
          if (rd && rd.hostUid === user?.uid) {
            setRaceActive(rd.id).catch((err) =>
              console.error("Failed to set race active:", err)
            );
          }
        }
      }, 1000);
    }

    // Race is now active — if we missed countdown or are still counting, jump to racing
    if (status === "racing" && (phase === "lobby" || phase === "countdown")) {
      clearInterval(countdownTimerRef.current);
      setPhase("racing");
      typing.enableTyping();
      didPushSessionRef.current = false;
    }

    // Race finished
    if (status === "finished" && (phase === "racing" || phase === "countdown")) {
      clearInterval(countdownTimerRef.current);
      setPhase("results");
    }

    // Race reset back to waiting (race again) — everyone goes back to lobby
    if (status === "waiting" && (phase === "results" || phase === "racing" || phase === "countdown")) {
      clearInterval(countdownTimerRef.current);
      setProgress({});
      didSubmitResults.current = false;
      didPushSessionRef.current = false;
      typing.reset();
      setPhase("lobby");
    }
  }, [raceData?.status, phase]);

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

  // ── Push session history and save race result when entering results phase ──
  useEffect(() => {
    if (phase === "results" && raceData && !didPushSessionRef.current) {
      didPushSessionRef.current = true;

      const participants = raceData.participants || {};
      const standings = Object.entries(participants)
        .map(([uid, data]) => {
          const prog = progress[uid];
          const results = prog?.finalResults;
          return {
            uid,
            displayName: data.displayName,
            username: data.username,
            wpm: results?.wpm || prog?.wpm || 0,
            accuracy: results?.accuracy || prog?.accuracy || 0,
            consistency: results?.consistency || 0,
            wordsTyped: results?.wordsTyped || prog?.currentWordIndex || 0,
          };
        })
        .sort((a, b) => b.wpm - a.wpm);

      setSessionHistory((prev) => [...prev, { standings, raceId, timestamp: Date.now() }]);

      // Save race result to user's races subcollection
      if (user) {
        const myRank = standings.findIndex((s) => s.uid === user.uid);
        const myStats = standings.find((s) => s.uid === user.uid);
        if (myStats) {
          saveRaceResult(user.uid, {
            wpm: myStats.wpm,
            accuracy: myStats.accuracy,
            consistency: myStats.consistency,
            mode: raceData.mode,
            duration: raceData.duration,
            testType: raceData.testType || "time",
            wordCount: raceData.wordCount || 25,
            placement: myRank + 1,
            totalParticipants: standings.length,
            raceId: raceData.id,
            won: myRank === 0,
          }).catch((err) => console.error("Failed to save race result:", err));
        }
      }
    }
  }, [phase, raceData, progress, user]);

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
        words,
        raceTestType,
        raceWordCount
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
  const currentTestType = raceData?.testType || raceTestType;
  const currentWordCount = raceData?.wordCount || raceWordCount;

  // ── Session stats computation ──
  const computeSessionStats = () => {
    if (sessionHistory.length === 0) return null;

    const winCounts = {};
    let myBestWpm = 0;
    let allBestWpm = 0;
    let myTotalWpm = 0;
    let myRaceCount = 0;

    for (const race of sessionHistory) {
      const winner = race.standings[0];
      if (winner) {
        const key = winner.username || winner.displayName || winner.uid;
        winCounts[key] = (winCounts[key] || 0) + 1;
      }

      for (const s of race.standings) {
        if (s.wpm > allBestWpm) allBestWpm = s.wpm;
        if (s.uid === user.uid) {
          if (s.wpm > myBestWpm) myBestWpm = s.wpm;
          myTotalWpm += s.wpm;
          myRaceCount++;
        }
      }
    }

    const topWinner = Object.entries(winCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      totalRaces: sessionHistory.length,
      topWinner: topWinner ? { name: topWinner[0], wins: topWinner[1] } : null,
      myBestWpm,
      allBestWpm,
      myAvgWpm: myRaceCount > 0 ? Math.round(myTotalWpm / myRaceCount) : 0,
    };
  };

  const sessionStats = computeSessionStats();

  // ── Subtitle helper ──
  const getSubtitle = () => {
    if (currentTestType === "wordcount") {
      return `${raceData?.mode || raceMode} / ${currentWordCount} words`;
    }
    return `${raceData?.mode || raceMode} / ${raceData?.duration || raceDuration}s`;
  };

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
                    <span className="race-setting-label">test type</span>
                    <div className="race-setting-options">
                      {["time", "wordcount"].map((t) => (
                        <button
                          key={t}
                          className={`race-setting-btn ${raceTestType === t ? "active" : ""}`}
                          onClick={() => setRaceTestType(t)}
                        >
                          {t === "wordcount" ? "words" : "time"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="race-settings-row">
                  {raceTestType === "time" ? (
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
                  ) : (
                    <div className="race-setting">
                      <span className="race-setting-label">word count</span>
                      <div className="race-setting-options">
                        {[10, 25, 50, 100].map((wc) => (
                          <button
                            key={wc}
                            className={`race-setting-btn ${raceWordCount === wc ? "active" : ""}`}
                            onClick={() => setRaceWordCount(wc)}
                          >
                            {wc}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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
              <p className="race-subtitle">{getSubtitle()}</p>

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
            <div className="race-timer">
              {currentTestType === "wordcount"
                ? formatElapsed(typing.timeLeft)
                : typing.timeLeft}
            </div>

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
              <p className="race-subtitle">{getSubtitle()}</p>

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
                        {getRankLabel(i)}
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

              {/* Session Stats */}
              {sessionStats && (
                <div className="race-session-stats">
                  <h3 className="race-session-title">session stats</h3>
                  <div className="race-session-grid">
                    <div className="race-session-stat">
                      <span className="race-session-stat-value">{sessionStats.totalRaces}</span>
                      <span className="race-session-stat-label">races</span>
                    </div>
                    {sessionStats.topWinner && (
                      <div className="race-session-stat">
                        <span className="race-session-stat-value">{sessionStats.topWinner.name}</span>
                        <span className="race-session-stat-label">most wins ({sessionStats.topWinner.wins})</span>
                      </div>
                    )}
                    <div className="race-session-stat">
                      <span className="race-session-stat-value">{sessionStats.myBestWpm}</span>
                      <span className="race-session-stat-label">your best wpm</span>
                    </div>
                    <div className="race-session-stat">
                      <span className="race-session-stat-value">{sessionStats.allBestWpm}</span>
                      <span className="race-session-stat-label">best wpm (all)</span>
                    </div>
                    <div className="race-session-stat">
                      <span className="race-session-stat-value">{sessionStats.myAvgWpm}</span>
                      <span className="race-session-stat-label">your avg wpm</span>
                    </div>
                  </div>
                </div>
              )}

              {isHost ? (
                <button
                  className="race-primary-btn"
                  style={{ marginTop: "1.5rem" }}
                  onClick={async () => {
                    try {
                      const newWords = generateWordList(raceData.mode || "words", 200);
                      await resetRace(raceId, newWords);
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                >
                  race again
                </button>
              ) : (
                <span className="race-waiting-text" style={{ marginTop: "1.5rem", display: "block", textAlign: "center" }}>
                  waiting for host to start a new race...
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
