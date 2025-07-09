import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import { getStorage } from "firebase/storage";

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

// Ensure storageBucket is set, deriving from projectId if necessary.
if (!baseConfig.storageBucket && baseConfig.projectId) {
  baseConfig.storageBucket = `${baseConfig.projectId}.appspot.com`;
}

const firebaseConfig = baseConfig as FirebaseOptions;

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const storage = getStorage(app);

export { app, storage };
