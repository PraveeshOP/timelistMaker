import { useState } from 'react'
import { useTimelist } from '../context/TimelistContext'
import { WorkplaceTable } from '../components/WorkplaceTable'
import { ExportBar } from '../components/ExportBar'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

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
  const { generated, addWorkplace } = useTimelist()
  const [addingWorkplace, setAddingWorkplace] = useState(false)
  const [newWorkplaceName, setNewWorkplaceName] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAddWorkplace(): Promise<void> {
    if (!newWorkplaceName.trim()) return
    setAdding(true)
    await addWorkplace(newWorkplaceName)
    setAdding(false)
    setNewWorkplaceName('')
    setAddingWorkplace(false)
  }

  if (!generated) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-slate-400">No timelist generated yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
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

        {addingWorkplace ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-4">
            <Input
              placeholder="e.g. Privatemegeleren Park"
              value={newWorkplaceName}
              onChange={(e) => setNewWorkplaceName(e.target.value)}
              autoFocus
            />
            <Button onClick={handleAddWorkplace} disabled={adding}>
              {adding ? 'Adding…' : 'Add'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setAddingWorkplace(false)
                setNewWorkplaceName('')
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            className="w-full rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
            onClick={() => setAddingWorkplace(true)}
          >
            + Add workplace
          </button>
        )}
      </main>

      <ExportBar />
    </div>
  )
}
