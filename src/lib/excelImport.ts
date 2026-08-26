import ExcelJS from 'exceljs'
import type { TimelistRow } from '@shared/domain'
import { getHolidayName, isWeekend } from '@shared/holidays'
import { MONTH_NAMES } from './excelExport'

const NAME_COLUMN = 1
const COLS_PER_TABLE = 4
const FIRST_DATA_ROW = 4
const MAX_SCAN_ROW = 40 // generous upper bound covering every day-of-month row plus totals
const MAX_WORKPLACE_GROUPS = 50 // safety cap against a malformed/huge file

export interface ParsedWorkplace {
  name: string
  rows: TimelistRow[]
}

export interface ParsedTimesheet {
  month: number
  year: number
  workplaces: ParsedWorkplace[]
}

export type ParseResult = { ok: true; data: ParsedTimesheet } | { ok: false; error: string }

function parseSheetName(name: string): { month: number; year: number } | null {
  const match = name.trim().match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (!match) return null
  const monthIndex = MONTH_NAMES.findIndex((m) => m.toLowerCase() === match[1].toLowerCase())
  if (monthIndex === -1) return null
  return { month: monthIndex + 1, year: Number(match[2]) }
}

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** Reads a cell that should hold a time-of-day. Our own export writes these as Excel
 *  date serials, which exceljs reads back as UTC-based Date objects — but a plain
 *  number is also accepted in case another tool wrote the file. */
function cellToTime(value: ExcelJS.CellValue): string | null {
  if (value == null) return null
  if (value instanceof Date) {
    return `${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}`
  }
  if (typeof value === 'number') {
    const fraction = value - Math.floor(value)
    const totalMinutes = Math.round(fraction * 1440)
    return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`
  }
  return null
}

function cellToHours(value: ExcelJS.CellValue): number {
  return typeof value === 'number' ? value : 0
}

function cellToText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'object' && 'richText' in (value as object)) {
    return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join('').trim()
  }
  return String(value).trim()
}

/** Reverses our own two-table(+)-side-by-side export layout back into per-workplace,
 *  per-day rows: reads the month/year from the sheet name, walks each 4-column
 *  workplace group (Start/Stopp/Antall timer/Kundenavn) starting at column B, and pulls
 *  the workplace name from the first non-blank Kundenavn cell in that group. */
export async function parseTimesheetWorkbook(buffer: ArrayBuffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch {
    return { ok: false, error: 'This file could not be read as an Excel workbook.' }
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) return { ok: false, error: 'The workbook has no sheets.' }

  const parsedName = parseSheetName(sheet.name)
  if (!parsedName) {
    return {
      ok: false,
      error: `Couldn't recognize "${sheet.name}" as a "Month Year" timesheet sheet (e.g. "April 2025").`
    }
  }
  const { month, year } = parsedName
  const totalDays = daysInMonth(month, year)

  const workplaces: ParsedWorkplace[] = []
  let groupIndex = 0

  while (groupIndex < MAX_WORKPLACE_GROUPS) {
    const startCol = NAME_COLUMN + 1 + groupIndex * COLS_PER_TABLE
    const stopCol = startCol + 1
    const hoursCol = startCol + 2
    const custCol = startCol + 3

    const headerValue = sheet.getCell(1, startCol).value
    if (headerValue == null || headerValue === '') break

    let name = ''
    for (let r = FIRST_DATA_ROW; r <= MAX_SCAN_ROW; r++) {
      const text = cellToText(sheet.getCell(r, custCol).value)
      if (text) {
        name = text
        break
      }
    }
    if (!name) name = `Workplace ${groupIndex + 1}`

    const rows: TimelistRow[] = []
    for (let day = 1; day <= totalDays; day++) {
      const row = day + 3
      const dateStr = isoDate(year, month, day)
      const dateObj = new Date(`${dateStr}T00:00:00`)
      const holidayName = getHolidayName(dateObj)

      rows.push({
        date: dateStr,
        workplaceId: '', // resolved once the workplace is matched/created in Supabase
        startTime: cellToTime(sheet.getCell(row, startCol).value),
        stopTime: cellToTime(sheet.getCell(row, stopCol).value),
        totalHours: cellToHours(sheet.getCell(row, hoursCol).value),
        isWeekend: isWeekend(dateObj),
        isHoliday: holidayName !== null,
        holidayName
      })
    }

    workplaces.push({ name, rows })
    groupIndex += 1
  }

  if (workplaces.length === 0) {
    return { ok: false, error: 'No workplace columns were found in this file.' }
  }

  return { ok: true, data: { month, year, workplaces } }
}
