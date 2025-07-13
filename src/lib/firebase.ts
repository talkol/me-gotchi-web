
"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFunctions } from "firebase/functions";
import { setLogLevel } from "firebase/app";

// This configuration is for the CLIENT-SIDE app and will be bundled.
// It uses the NEXT_PUBLIC_ variables from your .env.local file.
const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;

// Initialize Firebase.
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApps()[0];
}

// Set log level to 'verbose' to get detailed debugging information
// in the browser console. This will help us understand the internal error.
setLogLevel('verbose');

export { app };
