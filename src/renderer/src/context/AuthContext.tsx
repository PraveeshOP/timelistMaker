import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { supabase } from '../lib/supabaseClient'
import { ipc } from '../lib/ipc'

export interface AppUser {
  id: string
  email: string
  fullName: string
}

interface AuthContextValue {
  session: Session | null
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
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toAppUser(session: Session | null): AppUser | null {
  const user: User | undefined = session?.user
  if (!user) return null
  return {
    id: user.id,
    email: user.email ?? '',
    fullName: (user.user_metadata?.full_name as string | undefined) ?? ''
  }
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    const unsubscribeDeepLink = ipc.onAuthCallback((payload) => {
      supabase.auth.setSession({
        access_token: payload.accessToken,
        refresh_token: payload.refreshToken
      })
    })

    return () => {
      subscription.unsubscribe()
      unsubscribeDeepLink()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: toAppUser(session),
      loading,
      async signInWithPassword(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message }
      },
      async signUpWithPassword(email, password, fullName) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        })
        return { error: error?.message }
      },
      async signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'timelistmaker://auth-callback',
            skipBrowserRedirect: true
          }
        })
        if (error) return { error: error.message }
        if (!data.url) return { error: 'Supabase did not return an OAuth URL.' }

        const result = await ipc.authOpenExternal({ url: data.url })
        if (!result.ok) return { error: result.error ?? 'Failed to open the sign-in page.' }
        return {}
      },
      async signOut() {
        await supabase.auth.signOut()
      }
    }),
    [session, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
