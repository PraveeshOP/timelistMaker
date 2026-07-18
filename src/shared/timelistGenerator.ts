import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from 'date-fns'
import { getHolidayName, isWeekend } from './holidays'
import type { GeneratedTimelist, TimeEntry, TimelistRow, Workplace, WorkplaceTableData } from './domain'

function computeHours(startTime: string | null, stopTime: string | null): number {
  if (!startTime || !stopTime) return 0
  const [startH, startM] = startTime.split(':').map(Number)
  const [stopH, stopM] = stopTime.split(':').map(Number)
  const minutes = stopH * 60 + stopM - (startH * 60 + startM)
  if (minutes <= 0) return 0
  return Math.round((minutes / 60) * 100) / 100
}

function monthDates(month: number, year: number): Date[] {
  const anchor = new Date(year, month - 1, 1)
  return eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) })
}

function blankRow(date: Date, workplaceId: string): TimelistRow {
  const holidayName = getHolidayName(date)
  const weekend = isWeekend(date)
  return {
    date: format(date, 'yyyy-MM-dd'),
    workplaceId,
    startTime: null,
    stopTime: null,
    totalHours: 0,
    isWeekend: weekend,
    isHoliday: holidayName !== null,
    holidayName
  }
}

/** Fresh generation: blank grid for the month, weekends/holidays defaulted blank but editable. */
export function generateFreshTimelist(
  month: number,
  year: number,
  workplaces: Workplace[]
): GeneratedTimelist {
  const dates = monthDates(month, year)

  const tables: WorkplaceTableData[] = workplaces.map((workplace) => {
    const rows = dates.map((date) => blankRow(date, workplace.id))
    return { workplace, rows, subtotalHours: 0 }
  })

  return { month, year, tables, grandTotalHours: 0 }
}

interface WeekdayPattern {
  startTime: string
  stopTime: string
}

/** Derives, per workplace, which weekdays (0=Sun..6=Sat) historically had a non-blank entry,
 *  and a representative start/stop time (most recent occurrence) to prefill with. */
function buildWeekdayPatterns(templateEntries: TimeEntry[]): Map<string, Map<number, WeekdayPattern>> {
  const byWorkplace = new Map<string, Map<number, WeekdayPattern>>()

  // Sort ascending by date so the last write per weekday is the most recent occurrence.
  const sorted = [...templateEntries].sort((a, b) => a.date.localeCompare(b.date))

  for (const entry of sorted) {
    if (!entry.startTime || !entry.stopTime) continue
    const weekday = getDay(new Date(entry.date))
    if (!byWorkplace.has(entry.workplaceId)) byWorkplace.set(entry.workplaceId, new Map())
    byWorkplace
      .get(entry.workplaceId)!
      .set(weekday, { startTime: entry.startTime, stopTime: entry.stopTime })
  }

  return byWorkplace
}

/** Template-based generation: reuses a prior month's per-workplace weekday pattern, shifted to
 *  the new month, with weekend/holiday status always recomputed against the new month's real dates. */
export function generateTimelistFromTemplate(
  month: number,
  year: number,
  workplaces: Workplace[],
  templateEntries: TimeEntry[]
): GeneratedTimelist {
  const dates = monthDates(month, year)
  const patternsByWorkplace = buildWeekdayPatterns(templateEntries)

  const tables: WorkplaceTableData[] = workplaces.map((workplace) => {
    const pattern = patternsByWorkplace.get(workplace.id)

    const rows = dates.map((date) => {
      const row = blankRow(date, workplace.id)
      if (row.isWeekend || row.isHoliday) return row

      const weekdayPattern = pattern?.get(getDay(date))
      if (!weekdayPattern) return row

      return {
        ...row,
        startTime: weekdayPattern.startTime,
        stopTime: weekdayPattern.stopTime,
        totalHours: computeHours(weekdayPattern.startTime, weekdayPattern.stopTime)
      }
    })

    return { workplace, rows, subtotalHours: 0 }
  })

  return { month, year, tables, grandTotalHours: 0 }
}

/** Recomputes totalHours (from start/stop, unless explicitly overridden), subtotals, and grand total. */
export function recalculateTotals(timelist: GeneratedTimelist): GeneratedTimelist {
  const tables = timelist.tables.map((table) => {
    const subtotalHours = round2(table.rows.reduce((sum, row) => sum + row.totalHours, 0))
    return { ...table, subtotalHours }
  })
  const grandTotalHours = round2(tables.reduce((sum, table) => sum + table.subtotalHours, 0))
  return { ...timelist, tables, grandTotalHours }
}

/** Applies a start/stop edit to one row and recalculates its totalHours from the new times. */
export function applyTimeEdit(
  row: TimelistRow,
  field: 'startTime' | 'stopTime',
  value: string | null
): TimelistRow {
  const updated = { ...row, [field]: value }
  return { ...updated, totalHours: computeHours(updated.startTime, updated.stopTime) }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export { computeHours }
