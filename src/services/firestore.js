import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  arrayUnion,
  arrayRemove,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// ── User Profiles ────────────────────────────────────────────

export async function getOrCreateUserProfile(firebaseUser) {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const profile = {
      displayName: firebaseUser.displayName || "",
      email: firebaseUser.email || "",
      photoURL: firebaseUser.photoURL || "",
      bio: "",
      username: "",
      friends: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, profile);
    return profile;
  }

  return snap.data();
}

export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

export async function updateUserProfile(uid, data) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
}

// ── Usernames ────────────────────────────────────────────────

export async function checkUsernameAvailable(username) {
  const ref = doc(db, "usernames", username.toLowerCase());
  const snap = await getDoc(ref);
  return !snap.exists();
}

export async function claimUsername(uid, username) {
  const normalized = username.toLowerCase();
  const usernameRef = doc(db, "usernames", normalized);
  const userRef = doc(db, "users", uid);

  await runTransaction(db, async (transaction) => {
    const usernameDoc = await transaction.get(usernameRef);
    if (usernameDoc.exists()) {
      throw new Error("Username already taken");
    }
    transaction.set(usernameRef, { uid, createdAt: serverTimestamp() });
    transaction.update(userRef, {
      username: normalized,
      usernameChangedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export function canChangeUsername(profile) {
  if (!profile?.usernameChangedAt) return true;
  const changedAt = profile.usernameChangedAt.seconds
    ? profile.usernameChangedAt.seconds * 1000
    : profile.usernameChangedAt;
  return Date.now() - changedAt >= SIX_MONTHS_MS;
}

export function nextUsernameChangeDate(profile) {
  if (!profile?.usernameChangedAt) return null;
  const changedAt = profile.usernameChangedAt.seconds
    ? profile.usernameChangedAt.seconds * 1000
    : profile.usernameChangedAt;
  return new Date(changedAt + SIX_MONTHS_MS);
}

export async function changeUsername(uid, oldUsername, newUsername) {
  const normalized = newUsername.toLowerCase();
  const oldNormalized = oldUsername.toLowerCase();
  const newUsernameRef = doc(db, "usernames", normalized);
  const oldUsernameRef = doc(db, "usernames", oldNormalized);
  const userRef = doc(db, "users", uid);

  await runTransaction(db, async (transaction) => {
    // Check cooldown
    const userDoc = await transaction.get(userRef);
    const userData = userDoc.data();
    if (userData?.usernameChangedAt) {
      const changedAt = userData.usernameChangedAt.seconds
        ? userData.usernameChangedAt.seconds * 1000
        : userData.usernameChangedAt;
      if (Date.now() - changedAt < SIX_MONTHS_MS) {
        throw new Error("Username can only be changed once every 6 months");
      }
    }

    // Check new username is available
    const newDoc = await transaction.get(newUsernameRef);
    if (newDoc.exists()) {
      throw new Error("Username already taken");
    }

    // Delete old username reservation, create new one
    transaction.delete(oldUsernameRef);
    transaction.set(newUsernameRef, { uid, createdAt: serverTimestamp() });
    transaction.update(userRef, {
      username: normalized,
      usernameChangedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

// ── Search ───────────────────────────────────────────────────

export async function searchByUsername(prefix, maxResults = 10) {
  if (!prefix || prefix.length < 2) return [];
  const normalized = prefix.toLowerCase();
  const q = query(
    collection(db, "users"),
    where("username", ">=", normalized),
    where("username", "<=", normalized + "\uf8ff"),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// ── Friends ──────────────────────────────────────────────────

export async function addFriend(myUid, friendUid) {
  const ref = doc(db, "users", myUid);
  await updateDoc(ref, {
    friends: arrayUnion(friendUid),
    updatedAt: serverTimestamp(),
  });
}

export async function removeFriend(myUid, friendUid) {
  const ref = doc(db, "users", myUid);
  await updateDoc(ref, {
    friends: arrayRemove(friendUid),
    updatedAt: serverTimestamp(),
  });
}

export async function getFriendProfiles(friendUids) {
  if (!friendUids || !friendUids.length) return [];
  // Fetch in parallel (Firestore doesn't support 'in' queries for doc refs)
  const profiles = await Promise.all(
    friendUids.map(async (uid) => {
      const prof = await getUserProfile(uid);
      return prof ? { uid, ...prof } : null;
    })
  );
  return profiles.filter(Boolean);
}

// ── Test Results ─────────────────────────────────────────────

export async function saveTestResult(uid, result) {
  const ref = collection(db, "users", uid, "tests");
  await addDoc(ref, {
    ...result,
    completedAt: serverTimestamp(),
  });
}

export async function getTestHistory(uid, count = 50) {
  const ref = collection(db, "users", uid, "tests");
  const q = query(ref, orderBy("completedAt", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
