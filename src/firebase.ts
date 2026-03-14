import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuration from environment variables (Vite)
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID;

// Helper to load config
async function getFirebaseConfig() {
  if (config.apiKey) {
    return { config, databaseId };
  }
  
  try {
    // @ts-ignore
    const localConfig = await import('../firebase-applet-config.json');
    return { 
      config: localConfig.default, 
      databaseId: localConfig.default.firestoreDatabaseId 
    };
  } catch (e) {
    console.warn("Firebase config not found. Please set VITE_FIREBASE_* environment variables.");
    return { config: {}, databaseId: undefined };
  }
}

const { config: finalConfig, databaseId: finalDatabaseId } = await getFirebaseConfig();

// Initialize Firebase SDK
export const app = initializeApp(finalConfig);
export const db = getFirestore(app, finalDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
