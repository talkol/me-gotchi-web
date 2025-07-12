
import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, httpsCallable, type Functions, type FunctionsError } from "firebase/functions";


const baseConfig: Partial<FirebaseOptions> = process.env.FIREBASE_CONFIG
  ? JSON.parse(process.env.FIREBASE_CONFIG)
  : {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

if (!baseConfig.storageBucket && baseConfig.projectId) {
  baseConfig.storageBucket = `${baseConfig.projectId}.appspot.com`;
}

const firebaseConfig = (baseConfig.projectId && baseConfig.apiKey) ? (baseConfig as FirebaseOptions) : null;

let app: FirebaseApp | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;

if (firebaseConfig) {
    try {
        app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        storage = getStorage(app);
        functions = getFunctions(app);
    } catch(e) {
        console.error("Firebase initialization failed:", e);
        app = null;
        storage = null;
        functions = null;
    }
}

if (!app || !storage || !functions) {
    console.warn("Firebase is not configured correctly. Running in local-only mode. All Firebase-dependent features will be disabled. To enable Firebase, please provide your configuration in a .env file or ensure the server environment is set up.");
}

export const isFirebaseEnabled = !!app && !!storage && !!functions;
export { app, storage, getFunctions, httpsCallable, type FunctionsError };
