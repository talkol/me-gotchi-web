
import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";

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

let app: FirebaseApp;
let storage: FirebaseStorage;
let functions: Functions;

// Check that all required config values are present. If not, warn the developer.
if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.authDomain ||
    !firebaseConfig.projectId ||
    !firebaseConfig.storageBucket ||
    !firebaseConfig.messagingSenderId ||
    !firebaseConfig.appId
) {
    console.warn("Firebase is not configured correctly. One or more required environment variables are missing from .env.local. All Firebase-dependent features will be disabled. Please provide your configuration to enable Firebase.");
}

// Initialize Firebase. If this fails, it will now throw an error.
app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
storage = getStorage(app);
functions = getFunctions(app);

// isFirebaseEnabled is now determined by whether the config exists.
// The app will crash if initialization fails, which is what we want for debugging.
const isFirebaseEnabled = !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
);


export { functions, isFirebaseEnabled };
