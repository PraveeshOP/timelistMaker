import { useMemo, useState } from 'react'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import type { GeneratedTimelist } from '@shared/domain'
import { getHolidayName, isWeekend } from '@shared/holidays'
import { useTimelist } from '../context/TimelistContext'
import { Input } from './ui/Input'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface CalendarViewProps {
  generated: GeneratedTimelist
}

interface DayEntry {
  workplaceId: string
  workplaceName: string
  startTime: string | null
  stopTime: string | null
  totalHours: number
}

export function CalendarView({ generated }: CalendarViewProps): React.JSX.Element {
  const { updateRowTime, updateRowTotalHours } = useTimelist()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const anchor = useMemo(() => new Date(generated.year, generated.month - 1, 1), [
    generated.year,
    generated.month
  ])

  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchor))
    const end = endOfWeek(endOfMonth(anchor))
    return eachDayOfInterval({ start, end })
  }, [anchor])

  function dayTotalHours(dateStr: string): number {
    return generated.tables.reduce((sum, table) => {
      const row = table.rows.find((r) => r.date === dateStr)
      return sum + (row?.totalHours ?? 0)
    }, 0)
  }

  function entriesForDate(dateStr: string): DayEntry[] {
    return generated.tables.map((table) => {
      const row = table.rows.find((r) => r.date === dateStr)
      return {
        workplaceId: table.workplace.id,
        workplaceName: table.workplace.name,
        startTime: row?.startTime ?? null,
        stopTime: row?.stopTime ?? null,
        totalHours: row?.totalHours ?? 0
      }
    })
  }

  const selectedEntries = selectedDate ? entriesForDate(selectedDate) : []

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium uppercase text-slate-400">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="px-2 py-2">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {gridDays.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const inMonth = isSameMonth(date, anchor)
            const holidayName = getHolidayName(date)
            const special = isWeekend(date) || holidayName !== null
            const total = inMonth ? dayTotalHours(dateStr) : 0
            const isSelected = selectedDate === dateStr

            return (
              <button
                key={dateStr}
                disabled={!inMonth}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex min-h-[72px] flex-col items-start gap-1 border-b border-r border-slate-100 p-2 text-left last:border-r-0 ${
                  !inMonth ? 'bg-slate-50 text-slate-300' : special ? 'bg-slate-50' : 'bg-white'
                } ${isSelected ? 'ring-2 ring-inset ring-indigo-400' : ''} ${
                  inMonth ? 'hover:bg-indigo-50' : 'cursor-default'
                }`}
              >
                <span className={`text-sm ${special && inMonth ? 'text-slate-400' : 'text-slate-700'}`}>
                  {format(date, 'd')}
                </span>
                {inMonth && total > 0 && (
                  <span className="text-xs font-medium text-indigo-600">{total.toFixed(2)} h</span>
                )}
                {inMonth && holidayName && (
                  <span className="text-[11px] text-slate-400">{holidayName}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">
            {format(new Date(`${selectedDate}T00:00:00`), 'EEEE d MMMM yyyy')}
          </h3>
          <div className="mt-3 space-y-2">
            {selectedEntries.map((entry) => (
              <div key={entry.workplaceId} className="flex flex-wrap items-center gap-2">
                <span className="w-40 truncate text-sm text-slate-600">{entry.workplaceName}</span>
                <Input
                  type="time"
                  className="w-28"
                  value={entry.startTime ?? ''}
                  onChange={(e) =>
                    updateRowTime(entry.workplaceId, selectedDate, 'startTime', e.target.value)
                  }
                />
                <Input
                  type="time"
                  className="w-28"
                  value={entry.stopTime ?? ''}
                  onChange={(e) =>
                    updateRowTime(entry.workplaceId, selectedDate, 'stopTime', e.target.value)
                  }
                />
                <Input
                  type="number"
                  step="0.25"
                  className="w-20"
                  value={entry.totalHours}
                  onChange={(e) =>
                    updateRowTotalHours(entry.workplaceId, selectedDate, Number(e.target.value))
                  }
                />
                <span className="text-xs text-slate-400">hours</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
