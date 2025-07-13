
"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAq9ko3Sk8SDNKz77UZpflJHiCPn7CkxKY",
  authDomain: "me-gotchi.firebaseapp.com",
  projectId: "me-gotchi",
  storageBucket: "me-gotchi.appspot.com",
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

export { app };
