// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAyI8tR4Piubfchvvb39d8u6Qx1XXAnK2Q",
  authDomain: "pclogr.firebaseapp.com",
  projectId: "pclogr",
  storageBucket: "pclogr.firebasestorage.app",
  messagingSenderId: "365874402726",
  appId: "1:365874402726:web:9c2ab934b98da538a3ab67",
  measurementId: "G-KZHPPKXQ92"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth & Firestore exports
export const auth = getAuth(app);
export const db = getFirestore(app);

enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Offline persistence not enabled:", err.code || err.message);
});

export default app;
