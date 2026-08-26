import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser
} from 'firebase/auth'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { auth } from '../lib/firebaseClient'
import { ensureUserDoc, updateUserFullName } from '../lib/data'

export interface AppUser {
  id: string
  email: string
  fullName: string
}

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>
  signUpWithPassword: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error?: string }>
  signInWithGoogle: () => Promise<{ error?: string }>
  signOut: () => Promise<void>
  updateFullName: (fullName: string) => Promise<{ error?: string }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toAppUser(firebaseUser: FirebaseUser | null): AppUser | null {
  if (!firebaseUser) return null
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    fullName: firebaseUser.displayName ?? ''
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Picks up the return leg of signInWithGoogle's redirect, if the user just came
    // back from Google — resolves to null on every other page load. Runs alongside
    // onAuthStateChanged (below) rather than blocking on it, since nothing in this app
    // reads the Firestore users/{uid} doc back on the critical path — it's fine for
    // ensureUserDoc to finish a moment after the signed-in UI already shows.
    getRedirectResult(auth)
      .then((result) => {
        if (result && getAdditionalUserInfo(result)?.isNewUser) {
          return ensureUserDoc(result.user.uid, result.user.email ?? '', result.user.displayName ?? '')
        }
      })
      .catch((error) => {
        console.error('Google redirect sign-in failed:', error)
      })

    // Fires on sign-in, sign-out, and token refresh — but NOT on a bare updateProfile()
    // call, so signUpWithPassword/updateFullName below refresh `user` explicitly too.
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(toAppUser(firebaseUser))
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async signInWithPassword(email, password) {
        try {
          await signInWithEmailAndPassword(auth, email, password)
          return {}
        } catch (error) {
          return { error: errorMessage(error) }
        }
      },
      async signUpWithPassword(email, password, fullName) {
        try {
          const credential = await createUserWithEmailAndPassword(auth, email, password)
          await updateProfile(credential.user, { displayName: fullName })
          await ensureUserDoc(credential.user.uid, email, fullName)
          setUser(toAppUser(auth.currentUser))
          return {}
        } catch (error) {
          return { error: errorMessage(error) }
        }
      },
      async signInWithGoogle() {
        // Redirect rather than popup: signInWithPopup is unreliable across browsers
        // (Safari and, increasingly, Chrome block it under various conditions
        // regardless of how the click handler is wired). This navigates the whole
        // page away to Google and back — the result is picked up by getRedirectResult
        // in the effect above, not returned here.
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider())
          return {}
        } catch (error) {
          return { error: errorMessage(error) }
        }
      },
      async signOut() {
        await firebaseSignOut(auth)
      },
      async updateFullName(fullName: string) {
        if (!auth.currentUser) return { error: 'Not signed in.' }
        try {
          await updateProfile(auth.currentUser, { displayName: fullName })
          await updateUserFullName(auth.currentUser.uid, fullName)
          setUser(toAppUser(auth.currentUser))
          return {}
        } catch (error) {
          return { error: errorMessage(error) }
        }
      }
    }),
    [user, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
