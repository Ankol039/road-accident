/**
 * Firebase initialisation (Spark plan: Hosting + Auth + Firestore).
 *
 * Config comes from .env (see .env.example). These values are not secrets; they
 * identify the Firebase project to the client SDK.
 */
import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import {
  getFirestore,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** True when .env still has the placeholder values. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== 'your-api-key' &&
    firebaseConfig.projectId,
)

/**
 * The Web API key. It is not a secret — it ships inside the client bundle and
 * only identifies the project — but it is the one credential the Identity
 * Toolkit REST API accepts, so the Users screen needs it to open a sign-in
 * account for a new staff member.
 */
export const apiKey = firebaseConfig.apiKey

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Offline support: cache Firestore reads locally (helps on flaky mobile links).
let db
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache() })
} catch {
  db = getFirestore(app)
}
export { db }

// Optional emulators for local development (set VITE_USE_EMULATORS=true).
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, 'localhost', 8080)
}

export default { app, auth, db }
