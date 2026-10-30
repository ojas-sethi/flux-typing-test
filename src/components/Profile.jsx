import { useState, useEffect, useRef } from "react";
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
import { toSeconds } from "../utils/stats";
import StatsView from "./StatsView";
import "./Profile.css";

function memberSince(profile) {
  const s = toSeconds(profile?.createdAt);
  if (!s) return null;
  return new Date(s * 1000).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function UsernameEditor({ current, onSave, onCancel }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState(null); // checking | available | taken | error | cooldown
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => clearTimeout(debounceRef.current);
  }, []);

  const handleChange = (e) => {
    const raw = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setValue(raw);
    setStatus(null);
    setError(null);
    clearTimeout(debounceRef.current);
    if (raw.length < 3) return setError("at least 3 characters");
    if (raw.length > 20) return setError("max 20 characters");
    if (raw === current) return setError("that's your current username");
    setStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        setStatus((await checkUsernameAvailable(raw)) ? "available" : "taken");
      } catch {
        setStatus("error");
      }
    }, 400);
  };

  const save = async () => {
    if (error || status !== "available") return;
    setSubmitting(true);
    try {
      await onSave(value);
    } catch (err) {
      if (err.message === "Username already taken") setStatus("taken");
      else if (err.message.includes("6 months")) setStatus("cooldown");
      else setStatus("error");
    }
    setSubmitting(false);
  };

  const message =
    error ||
    {
      checking: "checking…",
      available: "available",
      taken: "already taken",
      cooldown: "you can only change it once every 6 months",
      error: "something went wrong",
    }[status] ||
    "letters, numbers and underscores";

  return (
    <div className="username-editor">
      <div className="username-field">
        <span>@</span>
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="new username"
          maxLength={20}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      <span className={`username-msg ${status === "available" && !error ? "ok" : ""} ${error || ["taken", "error", "cooldown"].includes(status) ? "bad" : ""}`}>
        {message}
      </span>
      <div className="username-actions">
        <button
          className="btn btn-primary btn-sm"
          onClick={save}
          disabled={!!error || status !== "available" || submitting}
        >
          {submitting ? "saving…" : "save"}
        </button>
        <button className="btn btn-sm" onClick={onCancel}>
          cancel
        </button>
      </div>
    </div>
  );
}

function InlineEdit({ value, placeholder, onSave, className, inputClassName, maxLength, as }) {
  const Tag = as || "p";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const ref = useRef(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  if (editing) {
    const commit = () => {
      setEditing(false);
      if (draft.trim() !== (value || "")) onSave(draft.trim());
    };
    return (
      <input
        ref={ref}
        className={inputClassName}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value || "");
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    );
  }

  return (
    <Tag
      className={`${className} editable ${value ? "" : "placeholder"}`}
      onClick={() => {
        setDraft(value || "");
        setEditing(true);
      }}
      title="click to edit"
    >
      {value || placeholder}
    </Tag>
  );
}

// Presentational: everything the profile page shows, given its data.
export function ProfileView({
  user,
  profile,
  tests,
  races,
  loading,
  onClose,
  onSignOut,
  onOpenSocial,
  onSaveName,
  onSaveBio,
  onSaveUsername,
}) {
  const [editingUsername, setEditingUsername] = useState(false);
  const canEdit = profile ? canChangeUsername(profile) : false;
  const nextChange = profile ? nextUsernameChangeDate(profile) : null;
  const name = profile?.displayName || user.displayName || "anonymous";
  const since = memberSince(profile);

  return (
    <div className="page profile-page">
      <div className="page-inner">
        <div className="page-bar">
          <button className="back-link" onClick={onClose}>
            back to typing
          </button>
          <div className="page-bar-actions">
            {onOpenSocial && (
              <button className="text-btn" onClick={onOpenSocial}>
                friends
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="profile-skeleton" aria-label="loading">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <>
            <header className="identity">
              <div className="identity-avatar">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span>{name[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="identity-main">
                <InlineEdit
                  as="h1"
                  value={name}
                  placeholder="your name"
                  onSave={onSaveName}
                  className="identity-name"
                  inputClassName="identity-name-input"
                  maxLength={50}
                />
                <div className="identity-meta">
                  {profile?.username && !editingUsername && (
                    <button
                      className={`identity-handle ${canEdit ? "can-edit" : ""}`}
                      onClick={() => canEdit && setEditingUsername(true)}
                      title={
                        canEdit
                          ? "change username"
                          : nextChange
                            ? `you can change this after ${nextChange.toLocaleDateString()}`
                            : ""
                      }
                    >
                      @{profile.username}
                    </button>
                  )}
                  {since && <span className="identity-since">typing since {since}</span>}
                </div>
                {editingUsername && (
                  <UsernameEditor
                    current={profile?.username}
                    onCancel={() => setEditingUsername(false)}
                    onSave={async (v) => {
                      await onSaveUsername(v);
                      setEditingUsername(false);
                    }}
                  />
                )}
                <InlineEdit
                  value={profile?.bio}
                  placeholder="add a short bio"
                  onSave={onSaveBio}
                  className="identity-bio"
                  inputClassName="identity-bio-input"
                  maxLength={160}
                />
              </div>
            </header>

            <div className="profile-stats">
              <StatsView
                tests={tests}
                races={races}
                emptyMessage="Your history starts with your first saved test. Every result lands here automatically."
                emptyAction={
                  <button className="btn btn-primary" onClick={onClose}>
                    take a test
                  </button>
                }
              />
            </div>

            <footer className="account">
              <span className="label">account</span>
              <span className="account-email">{user.email}</span>
              <button className="btn btn-sm btn-danger" onClick={onSignOut}>
                sign out
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

export default function Profile({ visible, user, onClose, onSignOut, onOpenSocial }) {
  const [profile, setProfile] = useState(null);
  const [tests, setTests] = useState([]);
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible || !user) return;
    setLoading(true);
    Promise.all([
      getUserProfile(user.uid),
      getTestHistory(user.uid).catch(() => []),
      getRaceHistory(user.uid).catch(() => []),
    ])
      .then(([prof, hist, raceHist]) => {
        setProfile(prof);
        setTests(hist || []);
        setRaces(raceHist || []);
      })
      .catch((err) => console.error("Failed to load profile:", err))
      .finally(() => setLoading(false));
  }, [visible, user]);

  if (!visible || !user) return null;

  return (
    <ProfileView
      user={user}
      profile={profile}
      tests={tests}
      races={races}
      loading={loading}
      onClose={onClose}
      onSignOut={onSignOut}
      onOpenSocial={onOpenSocial}
      onSaveName={async (displayName) => {
        if (!displayName) return;
        await updateUserProfile(user.uid, { displayName });
        setProfile((p) => ({ ...p, displayName }));
      }}
      onSaveBio={async (bio) => {
        await updateUserProfile(user.uid, { bio });
        setProfile((p) => ({ ...p, bio }));
      }}
      onSaveUsername={async (username) => {
        await changeUsername(user.uid, profile.username, username);
        setProfile((p) => ({
          ...p,
          username,
          usernameChangedAt: { seconds: Math.floor(Date.now() / 1000) },
        }));
      }}
    />
  );
}
