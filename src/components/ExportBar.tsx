import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTimelist } from '../context/TimelistContext'
import { buildTimesheetWorkbook, MONTH_NAMES } from '../lib/excelExport'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function sanitizeForFilename(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '') || 'User'
}

/** Triggers a browser download of the given buffer — there's no native save dialog on
 *  the web, so this hands the file to the browser's own download flow (which typically
 *  saves straight to the Downloads folder, or prompts, depending on browser settings). */
function downloadBuffer(buffer: ArrayBuffer, fileName: string): void {
  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function ExportBar(): React.JSX.Element {
  const { user } = useAuth()
  const { generated, save, saving } = useTimelist()
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSaveAndExport(): Promise<void> {
    if (!generated || !user) return
    setMessage(null)

    const saveResult = await save()
    if (saveResult.error) {
      setMessage(`Could not save: ${saveResult.error}`)
      return
    }

    setExporting(true)
    try {
      const namePart = sanitizeForFilename(user.fullName || user.email)
      const monthPart = MONTH_NAMES[generated.month - 1]
      const fileName = `${namePart}_Timelist_${monthPart}_${generated.year}.xlsx`

      const buffer = await buildTimesheetWorkbook(generated, user.fullName || user.email)
      downloadBuffer(buffer, fileName)
      setMessage('Exported successfully.')
    } catch (error) {
      setMessage(`Export failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
      <span className="text-sm text-slate-500">
        {generated ? `Grand total: ${generated.grandTotalHours.toFixed(2)} h` : ''}
      </span>
      <div className="flex items-center gap-3">
        {message && <span className="text-sm text-slate-500">{message}</span>}
        <Button variant="secondary" onClick={save} disabled={saving || !generated}>
          {saving && <Spinner />}
          Save
        </Button>
        <Button onClick={handleSaveAndExport} disabled={exporting || saving || !generated}>
          {exporting && <Spinner />}
          Export to Excel
        </Button>
      </div>
    </div>
  )
}
