import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { TimelistProvider, useTimelist } from './context/TimelistContext'
import { LoginSignup } from './screens/LoginSignup'
import { PostLoginChoice } from './screens/PostLoginChoice'
import { WorkplaceSetup } from './screens/WorkplaceSetup'
import { TimelistEditor } from './screens/TimelistEditor'
import { TopBar } from './components/TopBar'
import { Spinner } from './components/ui/Spinner'

type Screen = 'postLoginChoice' | 'workplaceSetup' | 'editor'

function AuthenticatedApp(): React.JSX.Element {
  const {
    workplaces,
    priorTimelists,
    refreshWorkplaces,
    refreshPriorTimelists,
    generateFresh,
    generateFromTemplate,
    importFromExcelFile
  } = useTimelist()
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

  function renderScreen(): React.JSX.Element {
    if (screen === null) {
      return (
        <div className="flex flex-1 items-center justify-center">
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
          onImportFromFile={async (buffer) => {
            const result = await importFromExcelFile(buffer)
            if (!result.error) setScreen('editor')
            return result
          }}
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

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar onHome={() => setScreen(null)} />
      {renderScreen()}
    </div>
  )
}

function Root(): React.JSX.Element {
  const { user, loading } = useAuth()

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
      <AuthenticatedApp />
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
