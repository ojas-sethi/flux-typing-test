import { useState, useEffect, useRef, useCallback } from "react";
import { checkUsernameAvailable, claimUsername } from "../services/firestore";
import "./UsernameSetup.css";

const USERNAME_REGEX = /^[a-z0-9_]+$/;

function validateUsername(value) {
  if (value.length < 3) return "at least 3 characters";
  if (value.length > 20) return "max 20 characters";
  if (!USERNAME_REGEX.test(value)) return "lowercase letters, numbers, underscores only";
  return null;
}

export default function UsernameSetup({ visible, user, onComplete }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState(null); // null | 'checking' | 'available' | 'taken' | 'error'
  const [validationError, setValidationError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (visible && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [visible]);

  const checkAvailability = useCallback(async (username) => {
    try {
      const available = await checkUsernameAvailable(username);
      setStatus(available ? "available" : "taken");
    } catch {
      setStatus("error");
    }
  }, []);

  const handleChange = (e) => {
    const raw = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setValue(raw);
    setStatus(null);

    const error = validateUsername(raw);
    setValidationError(error);

    if (!error && raw.length >= 3) {
      clearTimeout(debounceRef.current);
      setStatus("checking");
      debounceRef.current = setTimeout(() => checkAvailability(raw), 400);
    }
  };

  const handleSubmit = async () => {
    if (validationError || status !== "available" || !user) return;
    setSubmitting(true);
    try {
      await claimUsername(user.uid, value);
      onComplete();
    } catch (err) {
      if (err.message === "Username already taken") {
        setStatus("taken");
      } else {
        setStatus("error");
      }
    }
    setSubmitting(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  if (!visible) return null;

  return (
    <div className="username-overlay">
      <div className="username-modal">
        <h2 className="username-title">choose your username</h2>
        <p className="username-subtitle">
          This is how others will find you on klacks.
          <br />
          <span className="username-cooldown-note">You can only change your username once every 6 months.</span>
        </p>

        <div className="username-input-wrapper">
          <span className="username-prefix">@</span>
          <input
            ref={inputRef}
            className="username-input"
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="username"
            maxLength={20}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="username-feedback">
          {validationError && (
            <span className="feedback-error">{validationError}</span>
          )}
          {!validationError && status === "checking" && (
            <span className="feedback-checking">checking...</span>
          )}
          {!validationError && status === "available" && (
            <span className="feedback-available">available</span>
          )}
          {!validationError && status === "taken" && (
            <span className="feedback-taken">already taken</span>
          )}
          {!validationError && status === "error" && (
            <span className="feedback-error">something went wrong</span>
          )}
        </div>

        <button
          className="username-submit"
          onClick={handleSubmit}
          disabled={!!validationError || status !== "available" || submitting}
        >
          {submitting ? "setting up..." : "continue"}
        </button>
      </div>
    </div>
  );
}
