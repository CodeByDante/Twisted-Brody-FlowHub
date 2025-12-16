import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (!firebaseConfig.apiKey) {
  alert("Error crítico: No se encontraron las claves de configuración de Firebase. \n\nAsegúrate de haber creado el archivo .env y reiniciado la terminal (start_dev.bat).");
  console.error("Firebase API Key is missing. Check .env file.");
}

// Helper function to check internet connectivity
const checkInternetConnection = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://www.google.com/favicon.ico', {
      mode: 'no-cors',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    return false;
  }
};

// Helper function for exponential backoff
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize Firebase and export instances
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Try to enable offline persistence
try {
  enableIndexedDbPersistence(db);
} catch (err) {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
  } else if (err.code === 'unimplemented') {
    console.warn('The current browser does not support offline persistence');
  }
}

const initializeFirebase = async (retryCount = 0, maxRetries = 5) => {
  try {
    // Check internet connectivity first
    const isOnline = await checkInternetConnection();
    if (!isOnline) {
      const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 32000);
      console.log(`No internet connection. Retrying in ${retryDelay / 1000} seconds...`);

      if (retryCount < maxRetries) {
        await delay(retryDelay);
        return initializeFirebase(retryCount + 1, maxRetries);
      } else {
        throw new Error('Failed to establish internet connection after maximum retries');
      }
    }

    console.log('Firebase initialized successfully');
    return { app, db, storage };
  } catch (error) {
    console.error("Error initializing Firebase:", error);

    if (retryCount < maxRetries) {
      const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 32000);
      console.log(`Retrying Firebase initialization in ${retryDelay / 1000} seconds...`);
      await delay(retryDelay);
      return initializeFirebase(retryCount + 1, maxRetries);
    }

    throw new Error(`Failed to initialize Firebase after ${maxRetries} attempts: ${error.message}`);
  }
};

// Export an async function to get the initialized Firebase instances
export const getFirebaseInstances = async () => {
  try {
    return await initializeFirebase();
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
  }
};