import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// ── Join Code ─────────────────────────────────────────────────
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(len = 6) {
  let code = "";
  for (let i = 0; i < len; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// ── Create Race ───────────────────────────────────────────────
export async function createRace(hostUid, hostProfile, mode, duration, words, testType = "time", wordCount = 25) {
  const code = generateCode();
  const raceId = `${code}_${Date.now()}`;
  const raceRef = doc(db, "races", raceId);
  const codeRef = doc(db, "raceCodes", code);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(codeRef);
    if (existing.exists()) {
      // Extremely rare collision — just retry
      throw new Error("Code collision, please retry");
    }

    transaction.set(raceRef, {
      code,
      status: "waiting",
      hostUid,
      mode,
      duration,
      words,
      testType,
      wordCount,
      participants: {
        [hostUid]: {
          displayName: hostProfile.displayName || "",
          username: hostProfile.username || "",
          photoURL: hostProfile.photoURL || "",
          joinedAt: serverTimestamp(),
        },
      },
      countdownStartedAt: null,
      raceStartedAt: null,
      finishedAt: null,
      createdAt: serverTimestamp(),
      expiresAt,
    });

    transaction.set(codeRef, {
      raceId,
      createdAt: serverTimestamp(),
      expiresAt,
    });
  });

  return { raceId, code };
}

// ── Join Race ─────────────────────────────────────────────────
export async function joinRace(code, uid, profile) {
  const codeRef = doc(db, "raceCodes", code.toUpperCase());
  const codeSnap = await getDoc(codeRef);

  if (!codeSnap.exists()) throw new Error("Race not found");

  const { raceId, expiresAt } = codeSnap.data();

  if (expiresAt && expiresAt.toDate && expiresAt.toDate() < new Date()) {
    throw new Error("Race has expired");
  }
  if (expiresAt && !(expiresAt.toDate) && new Date(expiresAt) < new Date()) {
    throw new Error("Race has expired");
  }

  const raceRef = doc(db, "races", raceId);

  await runTransaction(db, async (transaction) => {
    const raceSnap = await transaction.get(raceRef);
    if (!raceSnap.exists()) throw new Error("Race not found");

    const data = raceSnap.data();
    if (data.status !== "waiting") throw new Error("Race already started");

    const participants = data.participants || {};
    if (Object.keys(participants).length >= 10) throw new Error("Race is full");
    if (participants[uid]) return; // already joined

    transaction.update(raceRef, {
      [`participants.${uid}`]: {
        displayName: profile.displayName || "",
        username: profile.username || "",
        photoURL: profile.photoURL || "",
        joinedAt: serverTimestamp(),
      },
    });
  });

  return raceId;
}

// ── Start Race (host only) ────────────────────────────────────
export async function startCountdown(raceId, hostUid) {
  const raceRef = doc(db, "races", raceId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(raceRef);
    if (!snap.exists()) throw new Error("Race not found");

    const data = snap.data();
    if (data.hostUid !== hostUid) throw new Error("Only the host can start");
    if (data.status !== "waiting") throw new Error("Race already started");
    if (Object.keys(data.participants || {}).length < 2) {
      throw new Error("Need at least 2 players");
    }

    transaction.update(raceRef, {
      status: "countdown",
      countdownStartedAt: serverTimestamp(),
    });
  });
}

export async function setRaceActive(raceId) {
  const raceRef = doc(db, "races", raceId);
  await updateDoc(raceRef, {
    status: "racing",
    raceStartedAt: serverTimestamp(),
  });
}

export async function setRaceFinished(raceId) {
  const raceRef = doc(db, "races", raceId);
  await updateDoc(raceRef, {
    status: "finished",
    finishedAt: serverTimestamp(),
  });
}

// ── Progress ──────────────────────────────────────────────────
export async function updateRaceProgress(raceId, uid, data) {
  const ref = doc(db, "races", raceId, "progress", uid);
  await setDoc(ref, data, { merge: true });
}

export async function submitRaceResults(raceId, uid, results) {
  const ref = doc(db, "races", raceId, "progress", uid);
  await setDoc(
    ref,
    {
      isFinished: true,
      finishedAt: serverTimestamp(),
      finalResults: results,
    },
    { merge: true }
  );
}

// ── Reset Race (back to lobby with new words) ────────────────
export async function resetRace(raceId, newWords) {
  const raceRef = doc(db, "races", raceId);

  // Clear all progress docs
  const progressCol = collection(db, "races", raceId, "progress");
  const progressSnap = await getDocs(progressCol);
  const deletePromises = [];
  progressSnap.forEach((d) => {
    deletePromises.push(deleteDoc(doc(db, "races", raceId, "progress", d.id)));
  });
  await Promise.all(deletePromises);

  // Reset the race document back to waiting
  await updateDoc(raceRef, {
    status: "waiting",
    words: newWords,
    countdownStartedAt: null,
    raceStartedAt: null,
    finishedAt: null,
  });
}

// ── Leave Race ────────────────────────────────────────────────
export async function leaveRace(raceId, uid) {
  const raceRef = doc(db, "races", raceId);
  await updateDoc(raceRef, {
    [`participants.${uid}`]: deleteField(),
  });
}

// ── Listeners ─────────────────────────────────────────────────
export function onRaceChange(raceId, callback, onError) {
  const ref = doc(db, "races", raceId);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() });
      }
    },
    (err) => {
      console.error("Race snapshot error:", err);
      if (onError) onError(err);
    }
  );
}

export function onProgressChange(raceId, callback, onError) {
  const ref = collection(db, "races", raceId, "progress");
  return onSnapshot(
    ref,
    (snap) => {
      const progress = {};
      snap.forEach((doc) => {
        progress[doc.id] = doc.data();
      });
      callback(progress);
    },
    (err) => {
      console.error("Progress snapshot error:", err);
      if (onError) onError(err);
    }
  );
}
