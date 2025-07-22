
"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAq9ko3Sk8SDNKz77UZpflJHiCPn7CkxKY",
  authDomain: "me-gotchi.firebaseapp.com",
  projectId: "me-gotchi",
  storageBucket: "me-gotchi.firebasestorage.app",
  messagingSenderId: "608391410965",
  appId: "1:608391410965:web:32ede4abf2f366c511a51c",
  measurementId: "G-CGLTF301HS"
};


let app: FirebaseApp;

// Initialize Firebase.
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApps()[0];
}

// Initialize Firebase services
const auth = getAuth(app);
const storage = getStorage(app);

export { app, auth, storage };
