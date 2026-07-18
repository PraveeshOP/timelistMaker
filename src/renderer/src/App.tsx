import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { TimelistProvider, useTimelist } from './context/TimelistContext'
import { LoginSignup } from './screens/LoginSignup'
import { PostLoginChoice } from './screens/PostLoginChoice'
import { WorkplaceSetup } from './screens/WorkplaceSetup'
import { TimelistEditor } from './screens/TimelistEditor'
import { Spinner } from './components/ui/Spinner'

type Screen = 'postLoginChoice' | 'workplaceSetup' | 'editor'

function AuthenticatedApp(): React.JSX.Element {
  const { workplaces, priorTimelists, refreshWorkplaces, refreshPriorTimelists, generateFresh, generateFromTemplate } =
    useTimelist()
  const [screen, setScreen] = useState<Screen | null>(null)

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      await Promise.all([refreshWorkplaces(), refreshPriorTimelists()])
    }
    bootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (screen !== null) return
    if (priorTimelists.length === 0 && workplaces.length === 0) {
      setScreen('workplaceSetup')
    } else if (priorTimelists.length > 0) {
      setScreen('postLoginChoice')
    } else {
      setScreen('workplaceSetup')
    }
  }, [screen, priorTimelists, workplaces])

  if (screen === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-indigo-500" />
      </div>
    )
  }

  if (screen === 'postLoginChoice') {
    return (
      <PostLoginChoice
        onUseTemplate={async (templateId, month, year) => {
          await generateFromTemplate(templateId, month, year)
          setScreen('editor')
        }}
        onStartFromScratch={() => setScreen('workplaceSetup')}
      />
    )
  }

  if (screen === 'workplaceSetup') {
    return (
      <WorkplaceSetup
        onContinue={(month, year) => {
          generateFresh(month, year)
          setScreen('editor')
        }}
      />
    )
  }

  return <TimelistEditor onBackToWorkplaces={() => setScreen('workplaceSetup')} />
}

function Root(): React.JSX.Element {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-indigo-500" />
      </div>
    )
  }

  if (!user) return <LoginSignup />

  return (
    <TimelistProvider>
      <div className="relative min-h-screen">
        <button
          className="absolute right-4 top-4 z-10 text-xs text-slate-400 hover:underline"
          onClick={signOut}
        >
          Sign out ({user.email})
        </button>
        <AuthenticatedApp />
      </div>
    </TimelistProvider>
  )
}

export function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}
