
"use client";

import { initializeApp, getApps, type FirebaseApp, setLogLevel } from "firebase/app";

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

// Verify that all required environment variables are present.
const requiredEnvVars = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const missingEnvVars = requiredEnvVars.filter(key => !(process.env as any)[key]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Firebase configuration is missing. Please make sure the following environment variables are set in your .env file: ${missingEnvVars.join(", ")}`
  );
}


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
