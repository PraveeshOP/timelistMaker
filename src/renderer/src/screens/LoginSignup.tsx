import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Spinner } from '../components/ui/Spinner'

export function LoginSignup(): React.JSX.Element {
  const { signInWithPassword, signUpWithPassword, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      if (mode === 'signIn') {
        const { error: err } = await signInWithPassword(email, password)
        if (err) setError(err)
      } else {
        if (!fullName.trim()) {
          setError('Please enter your full name.')
          return
        }
        const { error: err } = await signUpWithPassword(email, password, fullName.trim())
        if (err) setError(err)
        else setInfo('Account created. Check your email if confirmation is required, then sign in.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogle(): Promise<void> {
    setError(null)
    setGoogleSubmitting(true)
    try {
      const { error: err } = await signInWithGoogle()
      if (err) setError(err)
      else setInfo('Continue in your browser to finish signing in with Google…')
    } finally {
      setGoogleSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">TimelistMaker</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'signIn' ? 'Sign in to your account' : 'Create an account'}
        </p>

        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          {mode === 'signUp' && (
            <Input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-emerald-600">{info}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Spinner />}
            {mode === 'signIn' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          or
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <Button
          variant="secondary"
          className="w-full"
          onClick={handleGoogle}
          disabled={googleSubmitting}
        >
          {googleSubmitting && <Spinner />}
          Sign in with Google
        </Button>

        <p className="mt-6 text-center text-sm text-slate-500">
          {mode === 'signIn' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="font-medium text-indigo-600 hover:underline"
            onClick={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn')
              setError(null)
              setInfo(null)
            }}
          >
            {mode === 'signIn' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
