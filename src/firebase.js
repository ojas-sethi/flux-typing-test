import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDYJZm0Jfta9-TRZAlcvAmfcT_lShiARRM",
  authDomain: "fluxtype-c8103.firebaseapp.com",
  projectId: "fluxtype-c8103",
  storageBucket: "fluxtype-c8103.firebasestorage.app",
  messagingSenderId: "71270198285",
  appId: "1:71270198285:web:f24d6c7ba5492db33cb944",
  measurementId: "G-EWX5WM804S",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
