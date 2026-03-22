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

// ── Friend Requests ──────────────────────────────────────────

export async function sendFriendRequest(fromUid, toUid, fromProfile) {
  // Check if a request already exists in either direction
  const existing = await getRequestBetween(fromUid, toUid);
  if (existing) {
    if (existing.status === "pending") {
      throw new Error("Request already sent");
    }
  }

  // Check if already friends
  const myProfile = await getUserProfile(fromUid);
  if ((myProfile?.friends || []).includes(toUid)) {
    throw new Error("Already friends");
  }

  const ref = collection(db, "friendRequests");
  await addDoc(ref, {
    from: fromUid,
    to: toUid,
    fromUsername: fromProfile?.username || "",
    fromDisplayName: fromProfile?.displayName || "",
    fromPhotoURL: fromProfile?.photoURL || "",
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function getIncomingRequests(uid) {
  const q = query(
    collection(db, "friendRequests"),
    where("to", "==", uid),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Sort client-side to avoid composite index requirement
  results.sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
  return results;
}

export async function getOutgoingRequests(uid) {
  const q = query(
    collection(db, "friendRequests"),
    where("from", "==", uid),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  const results = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  results.sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
  return results;
}

async function getRequestBetween(uidA, uidB) {
  // Query all pending requests involving uidA, then filter client-side
  const q = query(
    collection(db, "friendRequests"),
    where("from", "==", uidA),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  const match = snap.docs.find((d) => d.data().to === uidB);
  if (match) return { id: match.id, ...match.data() };

  // Check reverse direction
  const q2 = query(
    collection(db, "friendRequests"),
    where("from", "==", uidB),
    where("status", "==", "pending")
  );
  const snap2 = await getDocs(q2);
  const match2 = snap2.docs.find((d) => d.data().to === uidA);
  if (match2) return { id: match2.id, ...match2.data() };

  return null;
}

export async function acceptFriendRequest(requestId, myUid, otherUid) {
  // Update request status
  const reqRef = doc(db, "friendRequests", requestId);
  await updateDoc(reqRef, { status: "accepted" });

  // Add the other user to MY friends (I can write my own doc)
  const myRef = doc(db, "users", myUid);
  await updateDoc(myRef, {
    friends: arrayUnion(otherUid),
    updatedAt: serverTimestamp(),
  });
}

export async function declineFriendRequest(requestId) {
  const reqRef = doc(db, "friendRequests", requestId);
  await deleteDoc(reqRef);
}

export async function cancelFriendRequest(requestId) {
  const reqRef = doc(db, "friendRequests", requestId);
  await deleteDoc(reqRef);
}

// Sync: when I open social, check if any of MY outgoing requests were accepted.
// If so, add those users to my friends and clean up the request docs.
export async function syncAcceptedRequests(myUid) {
  const q = query(
    collection(db, "friendRequests"),
    where("from", "==", myUid),
    where("status", "==", "accepted")
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const myRef = doc(db, "users", myUid);
  for (const d of snap.docs) {
    const data = d.data();
    // Add the other user to my friends
    await updateDoc(myRef, {
      friends: arrayUnion(data.to),
      updatedAt: serverTimestamp(),
    });
    // Clean up the request doc
    await deleteDoc(doc(db, "friendRequests", d.id));
  }
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

// ── Race Results ──────────────────────────────────────────────

export async function saveRaceResult(uid, result) {
  const ref = collection(db, "users", uid, "races");
  await addDoc(ref, {
    ...result,
    completedAt: serverTimestamp(),
  });
}

export async function getRaceHistory(uid, count = 50) {
  const ref = collection(db, "users", uid, "races");
  const q = query(ref, orderBy("completedAt", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
