import { useTimelist } from '../context/TimelistContext'
import { WorkplaceTable } from '../components/WorkplaceTable'
import { ExportBar } from '../components/ExportBar'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

interface TimelistEditorProps {
  onBackToWorkplaces: () => void
}

export function TimelistEditor({ onBackToWorkplaces }: TimelistEditorProps): React.JSX.Element {
  const { generated } = useTimelist()

  if (!generated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-400">No timelist generated yet.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            {MONTH_NAMES[generated.month - 1]} {generated.year}
          </h1>
          <p className="text-sm text-slate-500">Edit any field — dates, times, hours, or workplace names.</p>
        </div>
        <button className="text-sm text-slate-500 hover:underline" onClick={onBackToWorkplaces}>
          Manage workplaces
        </button>
      </header>

      <main className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        {generated.tables.map((table) => (
          <WorkplaceTable key={table.workplace.id} table={table} />
        ))}
      </main>

      <ExportBar />
    </div>
  )
}
