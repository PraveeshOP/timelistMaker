import ExcelJS from 'exceljs'
import type { TimelistRow } from '@shared/domain'
import { getHolidayName, isWeekend } from '@shared/holidays'
import { computeHours } from '@shared/timelistGenerator'
import { MONTH_NAMES } from './excelExport'

const NAME_COLUMN = 1
const COLS_PER_TABLE = 4
const FIRST_DATA_ROW = 4
const MAX_WORKPLACE_GROUPS = 50

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

function blankMonthRows(month: number, year: number): TimelistRow[] {
  const rows: TimelistRow[] = []
  for (let day = 1; day <= daysInMonth(month, year); day++) {
    const date = isoDate(year, month, day)
    const dateObj = new Date(`${date}T00:00:00`)
    const holidayName = getHolidayName(dateObj)
    rows.push({
      date,
      workplaceId: '',
      startTime: null,
      stopTime: null,
      totalHours: 0,
      isWeekend: isWeekend(dateObj),
      isHoliday: holidayName !== null,
      holidayName
    })
  }
  return rows
}

function cellToText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'object' && 'richText' in (value as object)) {
    return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join('').trim()
  }
  return String(value).trim()
}

function dateFromExcelSerial(value: number): Date {
  const wholeDays = Math.floor(value)
  const fraction = value - wholeDays
  const utcMs = Date.UTC(1899, 11, 30) + wholeDays * 86400000 + Math.round(fraction * 86400000)
  return new Date(utcMs)
}

function cellToDate(value: ExcelJS.CellValue): Date | null {
  if (value == null) return null
  if (value instanceof Date) return value
  if (typeof value === 'number') return dateFromExcelSerial(value)
  return null
}

function cellToTime(value: ExcelJS.CellValue): string | null {
  const date = cellToDate(value)
  if (!date) return null
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`
}

function dateToIso(value: ExcelJS.CellValue): string | null {
  const date = cellToDate(value)
  if (!date) return null
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

function cellToHours(value: ExcelJS.CellValue): number {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'result' in value) {
    const result = (value as { result?: unknown }).result
    return typeof result === 'number' ? result : 0
  }
  return 0
}

function findTotalsRow(sheet: ExcelJS.Worksheet, stopCol: number, hoursCol: number): number {
  for (let r = FIRST_DATA_ROW; r <= Math.max(sheet.rowCount, FIRST_DATA_ROW); r++) {
    const stopText = cellToText(sheet.getCell(r, stopCol).value).toLowerCase()
    const hoursValue = sheet.getCell(r, hoursCol).value
    const hasSumFormula =
      hoursValue != null &&
      typeof hoursValue === 'object' &&
      'formula' in hoursValue &&
      String((hoursValue as { formula?: unknown }).formula ?? '').toUpperCase().startsWith('SUM(')

    if (stopText === 'total' || hasSumFormula) return r
  }
  return sheet.rowCount + 1
}

function hasTableHeader(sheet: ExcelJS.Worksheet, startCol: number): boolean {
  return cellToText(sheet.getCell(3, startCol).value).toLowerCase() === 'start'
}

/** Reads the compact exported timesheet layout:
 *  each workplace is a 4-column block (Start/Stopp/Antall timer/Kundenavn),
 *  rows are compact per workplace, and dates come from the Start/Stopp cells. */
export async function parseTimesheetWorkbook(buffer: ArrayBuffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch {
    return { ok: false, error: 'This file could not be read as an Excel workbook.' }
  }

  const sheet = workbook.worksheets.find((ws) => parseSheetName(ws.name)) ?? workbook.worksheets[0]
  if (!sheet) return { ok: false, error: 'The workbook has no sheets.' }

  const parsedName = parseSheetName(sheet.name)
  if (!parsedName) {
    return {
      ok: false,
      error: `Couldn't recognize "${sheet.name}" as a "Month Year" timesheet sheet (e.g. "April 2025").`
    }
  }

  const { month, year } = parsedName
  const workplaces: ParsedWorkplace[] = []

  for (let groupIndex = 0; groupIndex < MAX_WORKPLACE_GROUPS; groupIndex++) {
    const startCol = NAME_COLUMN + 1 + groupIndex * COLS_PER_TABLE
    const stopCol = startCol + 1
    const hoursCol = startCol + 2
    const custCol = startCol + 3

    if (!hasTableHeader(sheet, startCol)) break

    const totalsRow = findTotalsRow(sheet, stopCol, hoursCol)
    const rows = blankMonthRows(month, year)
    let name = ''
    let sawAnyEntry = false

    for (let r = FIRST_DATA_ROW; r < totalsRow; r++) {
      const startDate = dateToIso(sheet.getCell(r, startCol).value)
      const date = startDate ?? dateToIso(sheet.getCell(r, stopCol).value)
      const startTime = cellToTime(sheet.getCell(r, startCol).value)
      const stopTime = cellToTime(sheet.getCell(r, stopCol).value)
      const workplaceName = cellToText(sheet.getCell(r, custCol).value)
      const hoursFromCell = cellToHours(sheet.getCell(r, hoursCol).value)

      if (workplaceName && !name) name = workplaceName
      if (!date || !date.startsWith(`${year}-${pad2(month)}-`)) continue

      const row = rows.find((candidate) => candidate.date === date)
      if (!row) continue

      row.startTime = startTime
      row.stopTime = stopTime
      row.totalHours = hoursFromCell || computeHours(startTime, stopTime)
      sawAnyEntry = true
    }

    if (!name) name = `Workplace ${groupIndex + 1}`
    if (sawAnyEntry || name) workplaces.push({ name, rows })
  }

  if (workplaces.length === 0) {
    return { ok: false, error: 'No workplace columns were found in this file.' }
  }

  return { ok: true, data: { month, year, workplaces } }
}
