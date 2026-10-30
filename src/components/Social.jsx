import { useState, useEffect, useRef, useCallback } from "react";
import {
  searchByUsername,
  getFriendProfiles,
  getTestHistory,
  sendFriendRequest,
  getIncomingRequests,
  getOutgoingRequests,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  syncAcceptedRequests,
  removeFriend,
  getUserProfile,
} from "../services/firestore";
import StatsView from "./StatsView";
import "./Social.css";

function Person({ person, onOpen, action }) {
  return (
    <li className="person">
      <button className="person-main" onClick={onOpen}>
        <span className="person-avatar">
          {person.photoURL ? (
            <img src={person.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            (person.displayName || person.username || "?")[0].toUpperCase()
          )}
        </span>
        <span className="person-text">
          <span className="person-name">{person.displayName || person.username}</span>
          <span className="person-handle">@{person.username}</span>
        </span>
      </button>
      {action}
    </li>
  );
}

export default function Social({ visible, user, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [myProfile, setMyProfile] = useState(null);

  // Friend requests
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // uid being acted on

  // Sub-view: viewing another user's profile
  const [viewingUser, setViewingUser] = useState(null);
  const [viewingTests, setViewingTests] = useState([]);
  const [viewingLoading, setViewingLoading] = useState(false);

  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  // Load friends and requests when visible
  useEffect(() => {
    if (visible && user) {
      loadAll();
    }
  }, [visible, user]);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoadingFriends(true);
    setLoadingRequests(true);

    try {
      // Sync any accepted outgoing requests first
      await syncAcceptedRequests(user.uid);

      // Load profile, friends, and requests in parallel
      const [prof, incoming, outgoing] = await Promise.all([
        getUserProfile(user.uid),
        getIncomingRequests(user.uid),
        getOutgoingRequests(user.uid),
      ]);

      setMyProfile(prof);
      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
      setLoadingRequests(false);

      const friendUids = prof?.friends || [];
      if (friendUids.length) {
        const f = await getFriendProfiles(friendUids);
        setFriends(f);
      } else {
        setFriends([]);
      }
    } catch (err) {
      console.error("Failed to load social data:", err);
    }
    setLoadingFriends(false);
  }, [user]);

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

  // Send friend request
  const handleSendRequest = useCallback(
    async (targetUid) => {
      if (!user || !myProfile) return;
      setActionLoading(targetUid);
      try {
        await sendFriendRequest(user.uid, targetUid, myProfile);
        // Refresh outgoing requests
        const outgoing = await getOutgoingRequests(user.uid);
        setOutgoingRequests(outgoing);
      } catch (err) {
        console.error("Failed to send request:", err.message);
      }
      setActionLoading(null);
    },
    [user, myProfile]
  );

  // Accept incoming request
  const handleAccept = useCallback(
    async (request) => {
      if (!user) return;
      setActionLoading(request.from);
      try {
        await acceptFriendRequest(request.id, user.uid, request.from);
        // Remove from incoming, add to friends
        setIncomingRequests((prev) => prev.filter((r) => r.id !== request.id));
        const prof = await getUserProfile(request.from);
        if (prof) {
          setFriends((prev) => [...prev, prof]);
          setMyProfile((p) => ({
            ...p,
            friends: [...(p?.friends || []), request.from],
          }));
        }
      } catch (err) {
        console.error("Failed to accept request:", err);
      }
      setActionLoading(null);
    },
    [user]
  );

  // Decline incoming request
  const handleDecline = useCallback(async (request) => {
    setActionLoading(request.from);
    try {
      await declineFriendRequest(request.id);
      setIncomingRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err) {
      console.error("Failed to decline request:", err);
    }
    setActionLoading(null);
  }, []);

  // Cancel outgoing request
  const handleCancel = useCallback(async (request) => {
    setActionLoading(request.to);
    try {
      await cancelFriendRequest(request.id);
      setOutgoingRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err) {
      console.error("Failed to cancel request:", err);
    }
    setActionLoading(null);
  }, []);

  // Remove friend
  const handleRemoveFriend = useCallback(
    async (friendUid) => {
      if (!user) return;
      setActionLoading(friendUid);
      try {
        await removeFriend(user.uid, friendUid);
        setMyProfile((p) => ({
          ...p,
          friends: (p?.friends || []).filter((id) => id !== friendUid),
        }));
        setFriends((f) => f.filter((fr) => fr.uid !== friendUid));
      } catch (err) {
        console.error("Failed to remove friend:", err);
      }
      setActionLoading(null);
    },
    [user]
  );

  // Determine relationship status for a given uid
  const getRelationship = useCallback(
    (uid) => {
      if ((myProfile?.friends || []).includes(uid)) return "friends";
      const outgoing = outgoingRequests.find((r) => r.to === uid);
      if (outgoing) return "requested";
      const incoming = incomingRequests.find((r) => r.from === uid);
      if (incoming) return "incoming";
      return "none";
    },
    [myProfile, outgoingRequests, incomingRequests]
  );

  // Get the request object for a uid
  const getRequestFor = useCallback(
    (uid) => {
      return (
        outgoingRequests.find((r) => r.to === uid) ||
        incomingRequests.find((r) => r.from === uid)
      );
    },
    [outgoingRequests, incomingRequests]
  );

  if (!visible || !user) return null;

  // Inline action for a person row, based on relationship
  const renderActionButton = (uid) => {
    const rel = getRelationship(uid);
    const req = getRequestFor(uid);

    if (actionLoading === uid) {
      return (
        <button className="btn btn-sm" disabled>
          …
        </button>
      );
    }

    switch (rel) {
      case "friends":
        return <span className="person-state">friends</span>;
      case "requested":
        return (
          <button className="btn btn-sm" onClick={() => req && handleCancel(req)} title="cancel request">
            requested
          </button>
        );
      case "incoming":
        return (
          <div className="person-actions">
            <button className="btn btn-sm btn-primary" onClick={() => req && handleAccept(req)}>
              accept
            </button>
            <button className="btn btn-sm" onClick={() => req && handleDecline(req)} aria-label="decline">
              ✕
            </button>
          </div>
        );
      default:
        return (
          <button className="btn btn-sm" onClick={() => handleSendRequest(uid)}>
            add friend
          </button>
        );
    }
  };

  // ── Sub-view: another user's profile ──
  if (viewingUser) {
    const rel = getRelationship(viewingUser.uid);
    const req = getRequestFor(viewingUser.uid);

    const renderProfileAction = () => {
      if (actionLoading === viewingUser.uid) {
        return <button className="btn btn-sm" disabled>…</button>;
      }
      switch (rel) {
        case "friends":
          return (
            <button className="btn btn-sm btn-danger" onClick={() => handleRemoveFriend(viewingUser.uid)}>
              remove friend
            </button>
          );
        case "requested":
          return (
            <button className="btn btn-sm" onClick={() => req && handleCancel(req)}>
              cancel request
            </button>
          );
        case "incoming":
          return (
            <div className="person-actions">
              <button className="btn btn-sm btn-primary" onClick={() => req && handleAccept(req)}>
                accept request
              </button>
              <button className="btn btn-sm" onClick={() => req && handleDecline(req)}>
                decline
              </button>
            </div>
          );
        default:
          return (
            <button className="btn btn-sm btn-primary" onClick={() => handleSendRequest(viewingUser.uid)}>
              add friend
            </button>
          );
      }
    };

    const name = viewingUser.displayName || viewingUser.username;

    return (
      <div className="page social-page">
        <div className="page-inner">
          <div className="page-bar">
            <button
              className="back-link"
              onClick={() => {
                setViewingUser(null);
                setViewingTests([]);
              }}
            >
              back to friends
            </button>
            <div className="page-bar-actions">{renderProfileAction()}</div>
          </div>

          <header className="identity">
            <div className="identity-avatar">
              {viewingUser.photoURL ? (
                <img src={viewingUser.photoURL} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span>{name?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="identity-main">
              <h1 className="identity-name">{name}</h1>
              <div className="identity-meta">
                <span className="identity-handle">@{viewingUser.username}</span>
                {rel === "friends" && <span className="identity-since">friend</span>}
              </div>
              {viewingUser.bio && <p className="identity-bio">{viewingUser.bio}</p>}
            </div>
          </header>

          {viewingLoading ? (
            <div className="profile-skeleton" aria-label="loading">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <StatsView
              tests={viewingTests}
              emptyMessage={`${name} hasn't saved any tests yet.`}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Main view: search, requests, friends ──
  return (
    <div className="page social-page">
      <div className="page-inner narrow">
        <div className="page-bar">
          <button className="back-link" onClick={onClose}>
            back to typing
          </button>
        </div>

        <h1 className="page-title">friends</h1>

        <label className="search">
          <span className="search-at">@</span>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="find someone by username"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {searching && <span className="search-status">searching</span>}
        </label>

        {searchQuery.length >= 2 && (
          <section className="page-section">
            <div className="section-head">
              <span className="label">results</span>
              {!searching && <span className="section-note">{searchResults.length} found</span>}
            </div>
            {!searching && searchResults.length === 0 && (
              <p className="muted-note">No one goes by @{searchQuery}… yet.</p>
            )}
            <ul className="people">
              {searchResults.map((u) => (
                <Person key={u.uid} person={u} onOpen={() => handleViewUser(u)} action={renderActionButton(u.uid)} />
              ))}
            </ul>
          </section>
        )}

        {!loadingRequests && incomingRequests.length > 0 && (
          <section className="page-section">
            <div className="section-head">
              <span className="label">requests</span>
              <span className="section-note">{incomingRequests.length} waiting</span>
            </div>
            <ul className="people">
              {incomingRequests.map((req) => (
                <Person
                  key={req.id}
                  person={{
                    photoURL: req.fromPhotoURL,
                    displayName: req.fromDisplayName,
                    username: req.fromUsername,
                  }}
                  onOpen={async () => {
                    const prof = await getUserProfile(req.from);
                    if (prof) handleViewUser(prof);
                  }}
                  action={
                    <div className="person-actions">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAccept(req)}
                        disabled={actionLoading === req.from}
                      >
                        {actionLoading === req.from ? "…" : "accept"}
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleDecline(req)}
                        disabled={actionLoading === req.from}
                        aria-label="decline"
                      >
                        ✕
                      </button>
                    </div>
                  }
                />
              ))}
            </ul>
          </section>
        )}

        <section className="page-section">
          <div className="section-head">
            <span className="label">your friends</span>
            {friends.length > 0 && <span className="section-note">{friends.length}</span>}
          </div>
          {loadingFriends ? (
            <p className="muted-note">loading…</p>
          ) : friends.length === 0 ? (
            <p className="muted-note">
              No friends yet. Search for a username above, then race them.
            </p>
          ) : (
            <ul className="people">
              {friends.map((f) => (
                <Person
                  key={f.uid}
                  person={f}
                  onOpen={() => handleViewUser(f)}
                  action={
                    <button className="text-btn person-view" onClick={() => handleViewUser(f)}>
                      view stats
                    </button>
                  }
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
