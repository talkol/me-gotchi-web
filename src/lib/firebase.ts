
import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, httpsCallable, type Functions, type FunctionsError } from "firebase/functions";

// This configuration is for the CLIENT-SIDE app and will be bundled.
// It uses the NEXT_PUBLIC_ variables from your .env.local file.
const firebaseConfig: FirebaseOptions = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

let app: FirebaseApp | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;
let isFirebaseEnabled = false;

// Check that all required config values are present
if (
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
) {
    try {
        app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        storage = getStorage(app);
        functions = getFunctions(app);
        isFirebaseEnabled = true;
    } catch(e) {
        console.error("Firebase initialization failed:", e);
    }
} else {
     console.warn("Firebase is not configured correctly. One or more required environment variables are missing from .env.local. All Firebase-dependent features will be disabled. Please provide your configuration to enable Firebase.");
}

export { app, storage, getFunctions, httpsCallable, type FunctionsError, isFirebaseEnabled };
