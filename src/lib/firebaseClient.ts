import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.FIREBASE_API_KEY,
  authDomain: import.meta.env.FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.FIREBASE_APP_ID
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    'Missing Firebase config (FIREBASE_*). Copy .env.example to .env and fill it in.'
  )
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)

// Firebase's default persistence tries IndexedDB first, which has known reliability
// gaps at surviving a signInWithRedirect round trip (app -> Google -> Firebase's auth
// handler -> back to the app) under some browsers'/extensions' privacy/storage
// restrictions — it fails silently (getRedirectResult just resolves to null, no error)
// rather than throwing. Plain localStorage is simpler and more consistently preserved
// across that kind of full-page navigation.
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Failed to set Firebase auth persistence:', error)
})
