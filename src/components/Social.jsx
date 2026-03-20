import { useState, useEffect, useRef, useCallback } from "react";
import {
  searchByUsername,
  getFriendProfiles,
  getTestHistory,
  addFriend,
  removeFriend,
  getUserProfile,
} from "../services/firestore";
import { computeStats, formatDuration, timeAgo } from "../utils/stats";
import "./Social.css";

export default function Social({ visible, user, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [myProfile, setMyProfile] = useState(null);

  // Sub-view: viewing another user's profile
  const [viewingUser, setViewingUser] = useState(null);
  const [viewingTests, setViewingTests] = useState([]);
  const [viewingLoading, setViewingLoading] = useState(false);

  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const chartRef = useRef(null);

  // Load friends when visible
  useEffect(() => {
    if (visible && user) {
      setLoadingFriends(true);
      getUserProfile(user.uid).then((prof) => {
        setMyProfile(prof);
        const friendUids = prof?.friends || [];
        if (friendUids.length) {
          getFriendProfiles(friendUids).then((f) => {
            setFriends(f);
            setLoadingFriends(false);
          });
        } else {
          setFriends([]);
          setLoadingFriends(false);
        }
      });
    }
  }, [visible, user]);

  // Reset when closing
  useEffect(() => {
    if (!visible) {
      setSearchQuery("");
      setSearchResults([]);
      setViewingUser(null);
      setViewingTests([]);
    }
  }, [visible]);

  // Search
  const handleSearch = useCallback(
    (query) => {
      setSearchQuery(query);
      clearTimeout(debounceRef.current);

      if (query.length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await searchByUsername(query, 8);
          // Filter out self
          setSearchResults(results.filter((r) => r.uid !== user?.uid));
        } catch {
          setSearchResults([]);
        }
        setSearching(false);
      }, 350);
    },
    [user]
  );

  // View a user's profile
  const handleViewUser = useCallback(async (targetUser) => {
    setViewingLoading(true);
    setViewingUser(targetUser);
    try {
      const tests = await getTestHistory(targetUser.uid, 50);
      setViewingTests(tests);
    } catch {
      setViewingTests([]);
    }
    setViewingLoading(false);
  }, []);

  // Add/remove friend
  const handleToggleFriend = useCallback(
    async (friendUid) => {
      if (!user || !myProfile) return;
      const isFriend = (myProfile.friends || []).includes(friendUid);

      if (isFriend) {
        await removeFriend(user.uid, friendUid);
        setMyProfile((p) => ({
          ...p,
          friends: (p.friends || []).filter((id) => id !== friendUid),
        }));
        setFriends((f) => f.filter((fr) => fr.uid !== friendUid));
      } else {
        await addFriend(user.uid, friendUid);
        setMyProfile((p) => ({
          ...p,
          friends: [...(p.friends || []), friendUid],
        }));
        // Add to friends list if we have their data
        const prof = await getUserProfile(friendUid);
        if (prof) setFriends((f) => [...f, prof]);
      }
    },
    [user, myProfile]
  );

  const isFriend = (uid) => (myProfile?.friends || []).includes(uid);

  // Draw chart for viewed user
  const drawChart = useCallback(() => {
    const canvas = chartRef.current;
    if (!canvas || viewingTests.length < 2) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 12, right: 12, bottom: 24, left: 36 };
    const data = [...viewingTests].reverse();
    const maxWpm = Math.max(...data.map((d) => d.wpm), 10);
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const xScale = (i) => pad.left + (i / (data.length - 1)) * chartW;
    const yScale = (v) => pad.top + chartH - (v / (maxWpm * 1.15)) * chartH;

    const style = getComputedStyle(document.documentElement);
    const lineColor = style.getPropertyValue("--chart-line").trim();
    const gridColor = style.getPropertyValue("--chart-grid").trim();
    const textColor = style.getPropertyValue("--text-secondary").trim();

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (i / 3) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.font = "10px Outfit, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(Math.round(maxWpm * 1.15 * (1 - i / 3)), pad.left - 8, y + 3);
    }

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

    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    gradient.addColorStop(0, lineColor + "20");
    gradient.addColorStop(1, lineColor + "00");
    ctx.lineTo(xScale(data.length - 1), pad.top + chartH);
    ctx.lineTo(xScale(0), pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    data.forEach((d, i) => {
      ctx.beginPath();
      ctx.arc(xScale(i), yScale(d.wpm), 3, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
    });
  }, [viewingTests]);

  useEffect(() => {
    if (viewingUser && !viewingLoading && viewingTests.length >= 2) {
      const t = setTimeout(drawChart, 200);
      return () => clearTimeout(t);
    }
  }, [viewingUser, viewingLoading, viewingTests, drawChart]);

  if (!visible || !user) return null;

  // ── Sub-view: Viewing another user's profile ──
  if (viewingUser) {
    const stats = computeStats(viewingTests);
    return (
      <div className="social-overlay visible">
        <div className="social-container">
          <div className="social-header">
            <button
              className="social-back"
              onClick={() => {
                setViewingUser(null);
                setViewingTests([]);
              }}
            >
              back
            </button>
            <button
              className={`social-friend-btn ${isFriend(viewingUser.uid) ? "is-friend" : ""}`}
              onClick={() => handleToggleFriend(viewingUser.uid)}
            >
              {isFriend(viewingUser.uid) ? "remove friend" : "add friend"}
            </button>
          </div>

          {viewingLoading ? (
            <div className="social-loading">loading...</div>
          ) : (
            <div className="social-profile-view">
              <div className="social-user-hero">
                {viewingUser.photoURL && (
                  <img
                    src={viewingUser.photoURL}
                    alt=""
                    className="social-avatar-lg"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <h2 className="social-user-name">
                    {viewingUser.displayName || viewingUser.username}
                  </h2>
                  <span className="social-user-handle">
                    @{viewingUser.username}
                  </span>
                  {viewingUser.bio && (
                    <p className="social-user-bio">{viewingUser.bio}</p>
                  )}
                </div>
              </div>

              {stats ? (
                <>
                  <div className="social-stats-grid">
                    <div className="social-stat">
                      <span className="social-stat-value">{stats.totalTests}</span>
                      <span className="social-stat-label">tests</span>
                    </div>
                    <div className="social-stat">
                      <span className="social-stat-value">{stats.bestWpm}</span>
                      <span className="social-stat-label">best wpm</span>
                    </div>
                    <div className="social-stat">
                      <span className="social-stat-value">{stats.avgWpm}</span>
                      <span className="social-stat-label">avg wpm</span>
                    </div>
                    <div className="social-stat">
                      <span className="social-stat-value">
                        {stats.avgAccuracy}<small>%</small>
                      </span>
                      <span className="social-stat-label">accuracy</span>
                    </div>
                    <div className="social-stat">
                      <span className="social-stat-value">
                        {formatDuration(stats.totalTime)}
                      </span>
                      <span className="social-stat-label">practiced</span>
                    </div>
                  </div>

                  {viewingTests.length >= 2 && (
                    <div className="social-section">
                      <h3 className="social-section-title">wpm progression</h3>
                      <div className="social-chart-card">
                        <canvas ref={chartRef} />
                      </div>
                    </div>
                  )}

                  <div className="social-section">
                    <h3 className="social-section-title">recent tests</h3>
                    <div className="social-tests">
                      {viewingTests.slice(0, 10).map((test) => (
                        <div key={test.id} className="social-test-row">
                          <span className="social-test-wpm">
                            {test.wpm}<small> wpm</small>
                          </span>
                          <span className="social-test-acc">{test.accuracy}%</span>
                          <span className="social-test-meta">
                            {test.mode} / {test.duration}s
                          </span>
                          <span className="social-test-time">
                            {timeAgo(test.completedAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="social-empty">No tests yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main view: Search + Friends ──
  return (
    <div className="social-overlay visible">
      <div className="social-container">
        <div className="social-header">
          <button className="social-back" onClick={onClose}>
            back
          </button>
        </div>

        {/* Search */}
        <div className="social-search-wrapper">
          <span className="social-search-icon">@</span>
          <input
            ref={searchRef}
            className="social-search"
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="search by username..."
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <div className="social-section">
            <h3 className="social-section-title">
              {searching ? "searching..." : `results`}
            </h3>
            {!searching && searchResults.length === 0 && (
              <div className="social-empty">No users found.</div>
            )}
            <div className="social-user-list">
              {searchResults.map((u) => (
                <div key={u.uid} className="social-user-row">
                  <div
                    className="social-user-info"
                    onClick={() => handleViewUser(u)}
                  >
                    {u.photoURL && (
                      <img
                        src={u.photoURL}
                        alt=""
                        className="social-avatar-sm"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="social-user-text">
                      <span className="social-user-row-name">
                        {u.displayName || u.username}
                      </span>
                      <span className="social-user-row-handle">
                        @{u.username}
                      </span>
                    </div>
                  </div>
                  <button
                    className={`social-action-btn ${isFriend(u.uid) ? "is-friend" : ""}`}
                    onClick={() => handleToggleFriend(u.uid)}
                  >
                    {isFriend(u.uid) ? "remove" : "add"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends */}
        <div className="social-section">
          <h3 className="social-section-title">
            friends{friends.length > 0 ? ` (${friends.length})` : ""}
          </h3>
          {loadingFriends ? (
            <div className="social-empty">loading...</div>
          ) : friends.length === 0 ? (
            <div className="social-empty">
              Search for users above to add friends.
            </div>
          ) : (
            <div className="social-user-list">
              {friends.map((f) => (
                <div key={f.uid} className="social-user-row">
                  <div
                    className="social-user-info"
                    onClick={() => handleViewUser(f)}
                  >
                    {f.photoURL && (
                      <img
                        src={f.photoURL}
                        alt=""
                        className="social-avatar-sm"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="social-user-text">
                      <span className="social-user-row-name">
                        {f.displayName || f.username}
                      </span>
                      <span className="social-user-row-handle">
                        @{f.username}
                      </span>
                    </div>
                  </div>
                  <button
                    className="social-action-btn view"
                    onClick={() => handleViewUser(f)}
                  >
                    view
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
