import { useEffect, useState } from 'react'
import { useTimelist } from '../context/TimelistContext'
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

interface WorkplaceSetupProps {
  onContinue: (month: number, year: number) => void
}

export function WorkplaceSetup({ onContinue }: WorkplaceSetupProps): React.JSX.Element {
  const { workplaces, addWorkplace, renameWorkplaceById, removeWorkplace, refreshWorkplaces } =
    useTimelist()
  const [newName, setNewName] = useState('')
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  useEffect(() => {
    refreshWorkplaces()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!newName.trim()) return
    await addWorkplace(newName)
    setNewName('')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-xl font-semibold text-slate-900">Your workplaces</h1>
      <p className="mt-1 text-sm text-slate-500">
        Add each place you track hours for. You can edit these later too.
      </p>

      <ul className="mt-6 space-y-2">
        {workplaces.map((w) => (
          <li
            key={w.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2"
          >
            <input
              className="flex-1 border-none bg-transparent text-sm text-slate-800 focus:outline-none"
              defaultValue={w.name}
              onBlur={(e) => {
                if (e.target.value !== w.name) renameWorkplaceById(w.id, e.target.value)
              }}
            />
            <button
              className="text-sm text-red-500 hover:underline"
              onClick={() => removeWorkplace(w.id)}
            >
              Remove
            </button>
          </li>
        ))}
        {workplaces.length === 0 && (
          <p className="text-sm text-slate-400">No workplaces yet — add one below.</p>
        )}
      </ul>

      <form className="mt-4 flex gap-2" onSubmit={handleAdd}>
        <Input
          placeholder="e.g. MYBW - Helly Hansen"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit">Add</Button>
      </form>

      <div className="mt-10 border-t border-slate-200 pt-6">
        <h2 className="text-sm font-medium text-slate-700">Generate a timelist for</h2>
        <div className="mt-2 flex gap-2">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <Input
            type="number"
            className="w-28"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>

        <Button
          className="mt-4"
          disabled={workplaces.length === 0}
          onClick={() => onContinue(month, year)}
        >
          Generate timelist
        </Button>
      </div>
    </div>
  )
}
