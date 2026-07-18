import ExcelJS from 'exceljs'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTimelist } from '../context/TimelistContext'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'

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

function sanitizeForFilename(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, '') || 'User'
}

async function buildWorkbookBuffer(
  generated: NonNullable<ReturnType<typeof useTimelist>['generated']>
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()

  for (const table of generated.tables) {
    const sheet = workbook.addWorksheet(table.workplace.name.slice(0, 31) || 'Workplace')
    sheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Day', key: 'day', width: 8 },
      { header: 'Start', key: 'start', width: 10 },
      { header: 'Stop', key: 'stop', width: 10 },
      { header: 'Hours', key: 'hours', width: 10 },
      { header: 'Note', key: 'note', width: 16 }
    ]
    sheet.getRow(1).font = { bold: true }

    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    for (const row of table.rows) {
      const dateObj = new Date(`${row.date}T00:00:00`)
      sheet.addRow({
        date: row.date,
        day: weekdayLabels[dateObj.getDay()],
        start: row.startTime ?? '',
        stop: row.stopTime ?? '',
        hours: row.totalHours,
        note: row.isHoliday ? row.holidayName : row.isWeekend ? 'Weekend' : ''
      })
    }

    const totalRow = sheet.addRow({ date: '', day: '', start: '', stop: 'Total', hours: table.subtotalHours })
    totalRow.font = { bold: true }
  }

  const summarySheet = workbook.addWorksheet('Summary')
  summarySheet.columns = [
    { header: 'Workplace', key: 'workplace', width: 30 },
    { header: 'Total Hours', key: 'hours', width: 14 }
  ]
  summarySheet.getRow(1).font = { bold: true }
  for (const table of generated.tables) {
    summarySheet.addRow({ workplace: table.workplace.name, hours: table.subtotalHours })
  }
  const grandRow = summarySheet.addRow({ workplace: 'Grand total', hours: generated.grandTotalHours })
  grandRow.font = { bold: true }

  return workbook.xlsx.writeBuffer()
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
      const defaultFileName = `${namePart}_Timelist_${monthPart}_${generated.year}.xlsx`

      const dialogResult = await window.api.dialogSaveFile({ defaultFileName })
      if (dialogResult.canceled || !dialogResult.filePath) return

      const buffer = await buildWorkbookBuffer(generated)
      const writeResult = await window.api.exportWriteXlsx({
        filePath: dialogResult.filePath,
        buffer
      })
      setMessage(writeResult.ok ? 'Exported successfully.' : `Export failed: ${writeResult.error}`)
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
