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

function SegRow({ label, options, value, onChange }) {
  return (
    <div className="seg-row">
      <span className="label">{label}</span>
      <div className="seg">
        {options.map((o) => (
          <button
            key={o.value}
            className={`seg-opt ${value === o.value ? "active" : ""}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
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
      return `${raceData?.mode || raceMode}  /  ${currentWordCount} words`;
    }
    return `${raceData?.mode || raceMode}  /  ${raceData?.duration || raceDuration} seconds`;
  };

  const standings = participantList
    .map((p) => {
      const prog = progress[p.uid];
      const results = prog?.finalResults;
      return {
        ...p,
        wpm: results?.wpm || prog?.wpm || 0,
        accuracy: results?.accuracy || prog?.accuracy || 0,
        isFinished: prog?.isFinished || false,
      };
    })
    .sort((a, b) => b.wpm - a.wpm);

  // ── Render ──
  return (
    <div className="page race-page">
      <div className="page-inner">
        {/* ── Menu ── */}
        {phase === "menu" && (
          <>
            <div className="page-bar">
              <button className="back-link" onClick={onClose}>
                back to typing
              </button>
            </div>
            <h1 className="page-title">race</h1>
            <p className="race-lede">
              Type the same text as your friends, live. Host a room and share the code, or join one.
            </p>

            <div className="race-menu">
              <section className="race-panel">
                <div className="section-head">
                  <span className="label">host a room</span>
                </div>
                <SegRow
                  label="text"
                  value={raceMode}
                  onChange={setRaceMode}
                  options={[
                    { value: "words", label: "words" },
                    { value: "sentences", label: "sentences" },
                  ]}
                />
                <SegRow
                  label="length by"
                  value={raceTestType}
                  onChange={setRaceTestType}
                  options={[
                    { value: "time", label: "time" },
                    { value: "wordcount", label: "words" },
                  ]}
                />
                {raceTestType === "time" ? (
                  <SegRow
                    label="seconds"
                    value={raceDuration}
                    onChange={setRaceDuration}
                    options={[15, 30, 60].map((d) => ({ value: d, label: d }))}
                  />
                ) : (
                  <SegRow
                    label="words"
                    value={raceWordCount}
                    onChange={setRaceWordCount}
                    options={[10, 25, 50, 100].map((w) => ({ value: w, label: w }))}
                  />
                )}
                <button className="btn btn-primary race-cta" onClick={handleCreate}>
                  create room
                </button>
              </section>

              <section className="race-panel">
                <div className="section-head">
                  <span className="label">join a room</span>
                </div>
                <label className="code-cells" aria-label="room code">
                  <input
                    value={joinCode}
                    onChange={(e) =>
                      setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    maxLength={6}
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="characters"
                  />
                  {Array.from({ length: 6 }, (_, i) => (
                    <span
                      key={i}
                      className={`code-cell ${joinCode[i] ? "filled" : ""} ${i === Math.min(joinCode.length, 5) ? "next" : ""}`}
                    >
                      {joinCode[i] || ""}
                    </span>
                  ))}
                </label>
                <p className="race-hint">Six characters, from the host's screen.</p>
                <button
                  className="btn race-cta"
                  onClick={handleJoin}
                  disabled={joinCode.length < 6}
                >
                  join room
                </button>
              </section>
            </div>

            {error && <div className="race-error">{error}</div>}
          </>
        )}

        {/* ── Lobby ── */}
        {phase === "lobby" && raceData && (
          <>
            <div className="page-bar">
              <button className="back-link" onClick={handleLeave}>
                leave room
              </button>
              <span className="race-spec">{getSubtitle()}</span>
            </div>

            <div className="room-code">
              <span className="label">room code</span>
              <button className="num room-code-value" onClick={handleCopyCode} title="copy code">
                {raceData.code}
              </button>
              <button className="text-btn" onClick={handleCopyCode}>
                {copied ? "copied to clipboard" : "copy code"}
              </button>
            </div>

            <section className="page-section">
              <div className="section-head">
                <span className="label">players</span>
                <span className="section-note">{participantList.length} of 10</span>
              </div>
              <ol className="players">
                {participantList.map((p, i) => (
                  <li key={p.uid} className="player">
                    <span className="num player-index">{String(i + 1).padStart(2, "0")}</span>
                    <span className="person-avatar">
                      {p.photoURL ? (
                        <img src={p.photoURL} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        (p.displayName || p.username || "?")[0].toUpperCase()
                      )}
                    </span>
                    <span className="person-text">
                      <span className="person-name">
                        {p.displayName || p.username}
                        {p.uid === user.uid && <span className="player-you"> (you)</span>}
                      </span>
                      {p.username && <span className="person-handle">@{p.username}</span>}
                    </span>
                    {p.uid === raceData.hostUid && <span className="tag">host</span>}
                  </li>
                ))}
              </ol>
            </section>

            <div className="lobby-footer">
              {isHost ? (
                <>
                  <span className="race-hint">
                    {participantList.length < 2
                      ? "Waiting for at least one more player."
                      : "Everyone's in? Start when ready."}
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={handleStart}
                    disabled={participantList.length < 2}
                  >
                    start race
                  </button>
                </>
              ) : (
                <span className="waiting">
                  <span className="led on" />
                  waiting for the host to start
                </span>
              )}
            </div>
            {error && <div className="race-error">{error}</div>}
          </>
        )}

        {/* ── Countdown ── */}
        {phase === "countdown" && (
          <div className="countdown">
            <span key={countdown} className="num countdown-value">
              {countdown}
            </span>
            <span className="label">get ready</span>
          </div>
        )}

        {/* ── Racing ── */}
        {phase === "racing" && raceData && (
          <div className="race-active">
            <div className="readout race-readout">
              <div className="readout-cell">
                <span className="num readout-value accent">
                  {currentTestType === "wordcount" ? formatElapsed(typing.timeLeft) : typing.timeLeft}
                </span>
                <span className="label">
                  {currentTestType === "wordcount" ? "elapsed" : "seconds left"}
                </span>
              </div>
              <div className="readout-cell right">
                <span className="num readout-value">{typing.liveWpm || "—"}</span>
                <span className="label">wpm</span>
              </div>
            </div>

            <ol className="lanes">
              {participantList.map((p) => {
                const isSelf = p.uid === user.uid;
                const prog = isSelf
                  ? {
                      currentWordIndex: typing.currentWordIndex,
                      wpm: typing.liveWpm,
                      isFinished: typing.isFinished,
                    }
                  : progress[p.uid] || { currentWordIndex: 0, wpm: 0 };

                const target =
                  currentTestType === "wordcount"
                    ? currentWordCount
                    : Math.max(
                        ...participantList.map((pp) =>
                          pp.uid === user.uid
                            ? typing.currentWordIndex
                            : progress[pp.uid]?.currentWordIndex || 0
                        ),
                        1
                      );
                const pct = Math.min(100, (prog.currentWordIndex / Math.max(target, 1)) * 100);

                return (
                  <li
                    key={p.uid}
                    className={`lane ${isSelf ? "is-self" : ""} ${prog.isFinished ? "finished" : ""}`}
                  >
                    <span className="lane-name">{isSelf ? "you" : p.username || p.displayName}</span>
                    <span className="lane-track">
                      <span className="lane-fill" style={{ width: `${pct}%` }} />
                      <span className="lane-marker" style={{ left: `${pct}%` }} />
                    </span>
                    <span className="lane-wpm">
                      <span className="num">{prog.wpm || 0}</span>
                      <span className="lane-unit">wpm</span>
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="race-typing">
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
            <div className="page-bar">
              <button className="back-link" onClick={onClose}>
                done
              </button>
              <span className="race-spec">{getSubtitle()}</span>
            </div>

            <h1 className="page-title">
              {standings[0]?.uid === user.uid ? "you won" : "results"}
            </h1>

            <ol className="standings">
              {standings.map((p, i) => (
                <li
                  key={p.uid}
                  className={`standing ${p.uid === user.uid ? "is-self" : ""} ${i === 0 ? "is-winner" : ""}`}
                >
                  <span className="num standing-rank">{getRankLabel(i)}</span>
                  <span className="person-avatar">
                    {p.photoURL ? (
                      <img src={p.photoURL} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      (p.displayName || p.username || "?")[0].toUpperCase()
                    )}
                  </span>
                  <span className="person-text">
                    <span className="person-name">
                      {p.uid === user.uid ? "you" : p.displayName || p.username}
                    </span>
                    {p.username && <span className="person-handle">@{p.username}</span>}
                  </span>
                  <span className="standing-acc">{p.accuracy}%</span>
                  <span className="standing-wpm">
                    <span className="num">{p.wpm}</span>
                    <span className="lane-unit">wpm</span>
                  </span>
                </li>
              ))}
            </ol>

            {sessionStats && sessionStats.totalRaces > 0 && (
              <section className="page-section">
                <div className="section-head">
                  <span className="label">this session</span>
                  <span className="section-note">
                    {sessionStats.totalRaces} race{sessionStats.totalRaces === 1 ? "" : "s"}
                  </span>
                </div>
                <dl className="session">
                  {sessionStats.topWinner && (
                    <div>
                      <dt className="label">most wins</dt>
                      <dd>
                        {sessionStats.topWinner.name}
                        <span> × {sessionStats.topWinner.wins}</span>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="label">your best</dt>
                    <dd>{sessionStats.myBestWpm}</dd>
                  </div>
                  <div>
                    <dt className="label">your average</dt>
                    <dd>{sessionStats.myAvgWpm}</dd>
                  </div>
                  <div>
                    <dt className="label">room best</dt>
                    <dd>{sessionStats.allBestWpm}</dd>
                  </div>
                </dl>
              </section>
            )}

            <div className="lobby-footer">
              {isHost ? (
                <>
                  <span className="race-hint">Same players, fresh text.</span>
                  <button
                    className="btn btn-primary"
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
                </>
              ) : (
                <span className="waiting">
                  <span className="led on" />
                  waiting for the host to start another
                </span>
              )}
            </div>
            {error && <div className="race-error">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}
