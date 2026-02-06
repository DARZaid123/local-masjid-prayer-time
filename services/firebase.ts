// services/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCmUD14Lr700gzfwQWUI-D_RBflS6VUNDg",
  authDomain: "masjid-prayer-time-c817d.firebaseapp.com",
  projectId: "masjid-prayer-time-c817d",
  storageBucket: "masjid-prayer-time-c817d.firebasestorage.app",
  messagingSenderId: "279141966857",
  appId: "1:279141966857:web:fc09da41f3cc31bf63c4d8",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("🔥 Firebase initialized");
console.log("Auth:", auth);
console.log("DB:", db);
