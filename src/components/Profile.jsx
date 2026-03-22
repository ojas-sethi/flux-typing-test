import { useState, useEffect, useCallback, useRef } from "react";
import {
  getUserProfile,
  updateUserProfile,
  getTestHistory,
  getRaceHistory,
  checkUsernameAvailable,
  changeUsername,
  canChangeUsername,
  nextUsernameChangeDate,
} from "../services/firestore";
import "./Profile.css";

function formatDuration(totalSeconds) {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

function timeAgo(timestamp) {
  if (!timestamp) return "";
  const seconds =
    typeof timestamp.seconds === "number"
      ? timestamp.seconds
      : Math.floor(timestamp / 1000);
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(seconds * 1000).toLocaleDateString();
}

function getTimestamp(item) {
  if (!item.completedAt) return 0;
  if (typeof item.completedAt.seconds === "number") return item.completedAt.seconds;
  return Math.floor(item.completedAt / 1000);
}

function computeStats(tests, races, includeRaces) {
  const items = includeRaces ? [...tests, ...races] : tests;
  if (!items.length) return null;

  const totalTests = items.length;
  const bestWpm = Math.max(...items.map((t) => t.wpm));
  const avgWpm = Math.round(
    items.reduce((s, t) => s + t.wpm, 0) / totalTests
  );
  const avgAccuracy = Math.round(
    items.reduce((s, t) => s + t.accuracy, 0) / totalTests
  );
  const totalTime = items.reduce((s, t) => s + (t.duration || 0), 0);

  const wordTests = items.filter((t) => t.mode === "words");
  const sentenceTests = items.filter((t) => t.mode === "sentences");
  const avgWpmWords = wordTests.length
    ? Math.round(wordTests.reduce((s, t) => s + t.wpm, 0) / wordTests.length)
    : null;
  const avgWpmSentences = sentenceTests.length
    ? Math.round(
        sentenceTests.reduce((s, t) => s + t.wpm, 0) / sentenceTests.length
      )
    : null;

  // Recent trend (use only solo tests for trend)
  const recent10 = tests.slice(0, 10);
  const prev10 = tests.slice(10, 20);
  const recentAvg = recent10.length
    ? Math.round(recent10.reduce((s, t) => s + t.wpm, 0) / recent10.length)
    : 0;
  const prevAvg = prev10.length
    ? Math.round(prev10.reduce((s, t) => s + t.wpm, 0) / prev10.length)
    : 0;
  const trend = prev10.length ? recentAvg - prevAvg : 0;

  return {
    totalTests,
    bestWpm,
    avgWpm,
    avgAccuracy,
    totalTime,
    avgWpmWords,
    avgWpmSentences,
    trend,
  };
}

function computeRaceStats(races) {
  if (!races.length) return null;
  const completed = races.length;
  const won = races.filter((r) => r.won).length;
  const winRate = completed > 0 ? Math.round((won / completed) * 100) : 0;
  const bestWpm = Math.max(...races.map((r) => r.wpm));
  const avgWpm = Math.round(races.reduce((s, r) => s + r.wpm, 0) / completed);
  return { completed, won, winRate, bestWpm, avgWpm };
}

export default function Profile({ visible, user, onClose, onSignOut, onOpenSocial }) {
  const [profile, setProfile] = useState(null);
  const [tests, setTests] = useState([]);
  const [races, setRaces] = useState([]);
  const [includeRaces, setIncludeRaces] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [bioValue, setBioValue] = useState("");
  const [usernameValue, setUsernameValue] = useState("");
  const [usernameStatus, setUsernameStatus] = useState(null); // null | 'checking' | 'available' | 'taken' | 'error' | 'cooldown'
  const [usernameError, setUsernameError] = useState(null);
  const [usernameSubmitting, setUsernameSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);
  const nameInputRef = useRef(null);
  const bioInputRef = useRef(null);
  const usernameInputRef = useRef(null);
  const usernameDebounceRef = useRef(null);

  // Load data when visible
  useEffect(() => {
    if (visible && user) {
      setLoading(true);
      Promise.all([
        getUserProfile(user.uid),
        getTestHistory(user.uid, 50),
        getRaceHistory(user.uid, 50),
      ])
        .then(([prof, hist, raceHist]) => {
          setProfile(prof);
          setTests(hist);
          setRaces(raceHist);
          setNameValue(prof?.displayName || user.displayName || "");
          setBioValue(prof?.bio || "");
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [visible, user]);

  // Focus inputs when entering edit mode
  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);
  useEffect(() => {
    if (editingBio && bioInputRef.current) bioInputRef.current.focus();
  }, [editingBio]);

  // Draw WPM progression chart
  const drawChart = useCallback(() => {
    const canvas = chartRef.current;
    if (!canvas || tests.length < 2) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 12, right: 12, bottom: 24, left: 36 };

    // Chronological order (oldest first)
    const data = [...tests].reverse();
    const maxWpm = Math.max(...data.map((d) => d.wpm), 10);
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const xScale = (i) => pad.left + (i / (data.length - 1)) * chartW;
    const yScale = (v) =>
      pad.top + chartH - (v / (maxWpm * 1.15)) * chartH;

    const style = getComputedStyle(document.documentElement);
    const lineColor = style.getPropertyValue("--chart-line").trim();
    const gridColor = style.getPropertyValue("--chart-grid").trim();
    const textColor = style.getPropertyValue("--text-secondary").trim();

    // Grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (i / 3) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      const val = Math.round(maxWpm * 1.15 * (1 - i / 3));
      ctx.fillStyle = textColor;
      ctx.font = "10px Outfit, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(val, pad.left - 8, y + 3);
    }

    // X labels
    ctx.textAlign = "center";
    const labelCount = Math.min(data.length, 6);
    const step = Math.max(1, Math.floor((data.length - 1) / (labelCount - 1)));
    for (let i = 0; i < data.length; i += step) {
      ctx.fillStyle = textColor;
      ctx.fillText(`#${i + 1}`, xScale(i), h - 4);
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    data.forEach((d, i) => {
      const x = xScale(i);
      const y = yScale(d.wpm);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    gradient.addColorStop(0, lineColor + "20");
    gradient.addColorStop(1, lineColor + "00");
    ctx.lineTo(xScale(data.length - 1), pad.top + chartH);
    ctx.lineTo(xScale(0), pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Dots
    data.forEach((d, i) => {
      ctx.beginPath();
      ctx.arc(xScale(i), yScale(d.wpm), 3, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
    });
  }, [tests]);

  useEffect(() => {
    if (visible && !loading && tests.length >= 2) {
      const t = setTimeout(drawChart, 200);
      return () => clearTimeout(t);
    }
  }, [visible, loading, tests, drawChart]);

  // Save handlers
  const saveName = async () => {
    if (nameValue.trim() && user) {
      await updateUserProfile(user.uid, { displayName: nameValue.trim() });
      setProfile((p) => ({ ...p, displayName: nameValue.trim() }));
    }
    setEditingName(false);
  };

  const saveBio = async () => {
    if (user) {
      await updateUserProfile(user.uid, { bio: bioValue.trim() });
      setProfile((p) => ({ ...p, bio: bioValue.trim() }));
    }
    setEditingBio(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === "Enter") saveName();
    if (e.key === "Escape") {
      setNameValue(profile?.displayName || "");
      setEditingName(false);
    }
  };

  const handleBioKeyDown = (e) => {
    if (e.key === "Enter") saveBio();
    if (e.key === "Escape") {
      setBioValue(profile?.bio || "");
      setEditingBio(false);
    }
  };

  // Username editing
  const canEdit = profile ? canChangeUsername(profile) : false;
  const nextChangeDate = profile ? nextUsernameChangeDate(profile) : null;

  const startEditingUsername = () => {
    if (!canEdit) return;
    setEditingUsername(true);
    setUsernameValue("");
    setUsernameStatus(null);
    setUsernameError(null);
    setTimeout(() => usernameInputRef.current?.focus(), 100);
  };

  const handleUsernameChange = (e) => {
    const raw = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsernameValue(raw);
    setUsernameStatus(null);
    setUsernameError(null);

    if (raw.length < 3) {
      setUsernameError("at least 3 characters");
      return;
    }
    if (raw.length > 20) {
      setUsernameError("max 20 characters");
      return;
    }
    if (raw === profile?.username) {
      setUsernameError("same as current username");
      return;
    }

    clearTimeout(usernameDebounceRef.current);
    setUsernameStatus("checking");
    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(raw);
        setUsernameStatus(available ? "available" : "taken");
      } catch {
        setUsernameStatus("error");
      }
    }, 400);
  };

  const saveUsername = async () => {
    if (usernameError || usernameStatus !== "available" || !user || !profile?.username) return;
    setUsernameSubmitting(true);
    try {
      await changeUsername(user.uid, profile.username, usernameValue);
      setProfile((p) => ({ ...p, username: usernameValue, usernameChangedAt: { seconds: Math.floor(Date.now() / 1000) } }));
      setEditingUsername(false);
    } catch (err) {
      if (err.message === "Username already taken") {
        setUsernameStatus("taken");
      } else if (err.message.includes("6 months")) {
        setUsernameStatus("cooldown");
      } else {
        setUsernameStatus("error");
      }
    }
    setUsernameSubmitting(false);
  };

  const handleUsernameKeyDown = (e) => {
    if (e.key === "Enter") saveUsername();
    if (e.key === "Escape") setEditingUsername(false);
  };

  if (!user) return null;

  const stats = computeStats(tests, races, includeRaces);
  const raceStats = computeRaceStats(races);
  const photoURL = user.photoURL;

  // Combine tests and races for recent items, sorted by date, limited to 10
  const recentItems = [...tests.map((t) => ({ ...t, _type: "test" })), ...races.map((r) => ({ ...r, _type: "race" }))]
    .sort((a, b) => getTimestamp(b) - getTimestamp(a))
    .slice(0, 10);

  return (
    <div className={`profile-overlay ${visible ? "visible" : ""}`}>
      <div className="profile-container">
        {/* Header */}
        <div className="profile-header">
          <button className="profile-back" onClick={onClose}>
            back
          </button>
          <button className="profile-signout" onClick={onSignOut}>
            sign out
          </button>
        </div>

        {loading ? (
          <div className="profile-loading">loading...</div>
        ) : (
          <div className="profile-content">
            {/* User Info */}
            <div className="profile-info">
              {photoURL && (
                <img
                  src={photoURL}
                  alt=""
                  className="profile-avatar"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="profile-details">
                {editingName ? (
                  <input
                    ref={nameInputRef}
                    className="profile-name-input"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={handleNameKeyDown}
                    maxLength={50}
                  />
                ) : (
                  <h2
                    className="profile-name"
                    onClick={() => setEditingName(true)}
                    title="Click to edit"
                  >
                    {profile?.displayName || user.displayName || "Anonymous"}
                    <span className="edit-hint">edit</span>
                  </h2>
                )}

                {editingBio ? (
                  <input
                    ref={bioInputRef}
                    className="profile-bio-input"
                    value={bioValue}
                    onChange={(e) => setBioValue(e.target.value)}
                    onBlur={saveBio}
                    onKeyDown={handleBioKeyDown}
                    placeholder="Write something about yourself..."
                    maxLength={160}
                  />
                ) : (
                  <p
                    className="profile-bio"
                    onClick={() => setEditingBio(true)}
                    title="Click to edit"
                  >
                    {profile?.bio || "Click to add a bio..."}
                    <span className="edit-hint">edit</span>
                  </p>
                )}

                {profile?.username && !editingUsername && (
                  <span
                    className={`profile-username ${canEdit ? "editable" : ""}`}
                    onClick={canEdit ? startEditingUsername : undefined}
                    title={canEdit ? "Click to change username" : nextChangeDate ? `Can change after ${nextChangeDate.toLocaleDateString()}` : ""}
                  >
                    @{profile.username}
                    {canEdit && <span className="edit-hint">edit</span>}
                    {!canEdit && nextChangeDate && (
                      <span className="username-cooldown">
                        can change after {nextChangeDate.toLocaleDateString()}
                      </span>
                    )}
                  </span>
                )}
                {editingUsername && (
                  <div className="profile-username-edit">
                    <div className="profile-username-input-row">
                      <span className="profile-username-prefix">@</span>
                      <input
                        ref={usernameInputRef}
                        className="profile-username-input"
                        value={usernameValue}
                        onChange={handleUsernameChange}
                        onKeyDown={handleUsernameKeyDown}
                        placeholder="new username"
                        maxLength={20}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                    <div className="profile-username-feedback">
                      {usernameError && <span className="feedback-error">{usernameError}</span>}
                      {!usernameError && usernameStatus === "checking" && <span className="feedback-checking">checking...</span>}
                      {!usernameError && usernameStatus === "available" && <span className="feedback-available">available</span>}
                      {!usernameError && usernameStatus === "taken" && <span className="feedback-taken">already taken</span>}
                      {!usernameError && usernameStatus === "cooldown" && <span className="feedback-error">can only change once every 6 months</span>}
                      {!usernameError && usernameStatus === "error" && <span className="feedback-error">something went wrong</span>}
                    </div>
                    <div className="profile-username-actions">
                      <button
                        className="profile-username-save"
                        onClick={saveUsername}
                        disabled={!!usernameError || usernameStatus !== "available" || usernameSubmitting}
                      >
                        {usernameSubmitting ? "saving..." : "save"}
                      </button>
                      <button
                        className="profile-username-cancel"
                        onClick={() => setEditingUsername(false)}
                      >
                        cancel
                      </button>
                    </div>
                  </div>
                )}
                <span className="profile-email">{user.email}</span>
              </div>
            </div>

            {/* Social link */}
            {onOpenSocial && (
              <button className="profile-social-btn" onClick={onOpenSocial}>
                find friends
              </button>
            )}

            {/* Include Races Toggle */}
            {races.length > 0 && (
              <div className="profile-toggle-row">
                <span className="profile-toggle-label">include races in stats</span>
                <button
                  className={`profile-toggle ${includeRaces ? "active" : ""}`}
                  onClick={() => setIncludeRaces((v) => !v)}
                  role="switch"
                  aria-checked={includeRaces}
                >
                  <span className="profile-toggle-knob" />
                </button>
              </div>
            )}

            {/* Stats */}
            {stats ? (
              <>
                <div className="profile-stats-grid">
                  <div className="profile-stat">
                    <span className="profile-stat-value">{stats.totalTests}</span>
                    <span className="profile-stat-label">tests</span>
                  </div>
                  <div className="profile-stat">
                    <span className="profile-stat-value">{stats.bestWpm}</span>
                    <span className="profile-stat-label">best wpm</span>
                  </div>
                  <div className="profile-stat">
                    <span className="profile-stat-value">{stats.avgWpm}</span>
                    <span className="profile-stat-label">avg wpm</span>
                  </div>
                  <div className="profile-stat">
                    <span className="profile-stat-value">
                      {stats.avgAccuracy}
                      <small>%</small>
                    </span>
                    <span className="profile-stat-label">accuracy</span>
                  </div>
                  <div className="profile-stat">
                    <span className="profile-stat-value">
                      {formatDuration(stats.totalTime)}
                    </span>
                    <span className="profile-stat-label">practiced</span>
                  </div>
                </div>

                {/* Trend */}
                {stats.trend !== 0 && (
                  <div
                    className={`profile-trend ${stats.trend > 0 ? "up" : "down"}`}
                  >
                    {stats.trend > 0 ? "+" : ""}
                    {stats.trend} wpm vs your previous 10 tests
                  </div>
                )}

                {/* Mode Breakdown */}
                {(stats.avgWpmWords !== null ||
                  stats.avgWpmSentences !== null) && (
                  <div className="profile-modes">
                    {stats.avgWpmWords !== null && (
                      <div className="profile-mode-stat">
                        <span className="profile-mode-value">
                          {stats.avgWpmWords}
                        </span>
                        <span className="profile-mode-label">
                          avg wpm (words)
                        </span>
                      </div>
                    )}
                    {stats.avgWpmSentences !== null && (
                      <div className="profile-mode-stat">
                        <span className="profile-mode-value">
                          {stats.avgWpmSentences}
                        </span>
                        <span className="profile-mode-label">
                          avg wpm (sentences)
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Race Stats */}
                {raceStats && (
                  <div className="profile-section">
                    <h3 className="profile-section-title">race stats</h3>
                    <div className="profile-race-stats-grid">
                      <div className="profile-race-stat">
                        <span className="profile-race-stat-value">{raceStats.completed}</span>
                        <span className="profile-race-stat-label">races</span>
                      </div>
                      <div className="profile-race-stat">
                        <span className="profile-race-stat-value">{raceStats.won}</span>
                        <span className="profile-race-stat-label">won</span>
                      </div>
                      <div className="profile-race-stat">
                        <span className="profile-race-stat-value">{raceStats.winRate}<small>%</small></span>
                        <span className="profile-race-stat-label">win rate</span>
                      </div>
                      <div className="profile-race-stat">
                        <span className="profile-race-stat-value">{raceStats.bestWpm}</span>
                        <span className="profile-race-stat-label">best wpm</span>
                      </div>
                      <div className="profile-race-stat">
                        <span className="profile-race-stat-value">{raceStats.avgWpm}</span>
                        <span className="profile-race-stat-label">avg wpm</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* WPM Chart */}
                {tests.length >= 2 && (
                  <div className="profile-section">
                    <h3 className="profile-section-title">wpm progression</h3>
                    <div className="profile-chart-card">
                      <canvas ref={chartRef} />
                    </div>
                  </div>
                )}

                {/* Recent Tests */}
                <div className="profile-section">
                  <h3 className="profile-section-title">recent tests</h3>
                  <div className="profile-tests">
                    {recentItems.map((item) => (
                      <div key={item.id} className="profile-test-row">
                        <span className="test-wpm">
                          {item.wpm}
                          <small> wpm</small>
                        </span>
                        <span className="test-accuracy">
                          {item.accuracy}%
                        </span>
                        <span className="test-meta">
                          {item._type === "race" ? (
                            <>
                              <span className="test-badge">race</span>
                              {" "}{item.mode}
                            </>
                          ) : (
                            <>
                              {item.mode} / {item.duration}s
                            </>
                          )}
                        </span>
                        <span className="test-time">
                          {timeAgo(item.completedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="profile-empty">
                Complete your first test to see stats here.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
