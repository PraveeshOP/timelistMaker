import { useRef, useState } from 'react'
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

interface PostLoginChoiceProps {
  onUseTemplate: (templateTimelistId: string, month: number, year: number) => void
  onStartFromScratch: () => void
  onImportFromFile: (buffer: ArrayBuffer) => Promise<{ error?: string }>
}

export function PostLoginChoice({
  onUseTemplate,
  onStartFromScratch,
  onImportFromFile
}: PostLoginChoiceProps): React.JSX.Element {
  const { priorTimelists } = useTimelist()
  const mostRecent = priorTimelists[0]

  // Default target month = the month after the most recent existing timelist.
  const defaultTarget = mostRecent
    ? mostRecent.month === 12
      ? { month: 1, year: mostRecent.year + 1 }
      : { month: mostRecent.month + 1, year: mostRecent.year }
    : { month: new Date().getMonth() + 1, year: new Date().getFullYear() }

  const [templateId, setTemplateId] = useState(mostRecent?.id ?? '')
  const [month, setMonth] = useState(defaultTarget.month)
  const [year, setYear] = useState(defaultTarget.year)
  const [showTemplateForm, setShowTemplateForm] = useState(false)

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setImportError('Please choose a .xlsx file.')
      return
    }
    setImportError(null)
    setImporting(true)
    const buffer = await file.arrayBuffer()
    const result = await onImportFromFile(buffer)
    setImporting(false)
    if (result.error) setImportError(result.error)
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-xl font-semibold text-slate-900">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-500">How would you like to start this session?</p>

      <div className="mt-8 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-medium text-slate-800">Generate a new month from a template</h2>
          <p className="mt-1 text-sm text-slate-500">
            Reuse a previous timelist's workplaces and daily pattern, shifted to a new month.
          </p>

          {!showTemplateForm ? (
            <Button className="mt-4" variant="secondary" onClick={() => setShowTemplateForm(true)}>
              Choose template…
            </Button>
          ) : (
            <div className="mt-4 space-y-3">
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {priorTimelists.map((t) => (
                  <option key={t.id} value={t.id}>
                    {MONTH_NAMES[t.month - 1]} {t.year}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
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
              <Button onClick={() => onUseTemplate(templateId, month, year)} disabled={!templateId}>
                Generate {MONTH_NAMES[month - 1]} {year}
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-medium text-slate-800">Start from scratch</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage your workplaces and build a fresh timelist for any month.
          </p>
          <Button className="mt-4" variant="secondary" onClick={onStartFromScratch}>
            Start from scratch
          </Button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-medium text-slate-800">Import from an Excel file</h2>
          <p className="mt-1 text-sm text-slate-500">
            Drag and drop a previously exported timesheet, or choose one from your computer.
          </p>

          <div
            className={`mt-4 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${
              dragActive ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragActive(false)
              const file = e.dataTransfer.files[0]
              if (file) handleFile(file)
            }}
          >
            <p className="text-slate-500">Drop an .xlsx file here</p>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? 'Importing…' : 'Browse…'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.target.value = ''
              }}
            />
          </div>

          {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
        </div>
      </div>
    </div>
  )
}
